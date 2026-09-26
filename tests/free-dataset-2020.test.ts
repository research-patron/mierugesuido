import { describe,it,expect } from "vitest";
import { readFileSync } from "node:fs";
import XLSX from "xlsx";
import { buildFree2020Rows,parseOfficialNumber,sourceIdentity,FREE_COLUMNS,FREE_COSTS,freeRowsCsv,type FreeInput } from "@/lib/freeDataset2020";
import { COST_CHART_METRICS,buildCostComparisonChart } from "@/lib/costComparisonChart";
import { freeSurveyReady,validGoogleResponderUrl,freeSurveyEntryHref } from "@/lib/freeDatasetSurvey";
import { freeCalculationDefinitions,freeSourceTaxBasis } from "@/lib/freeDatasetTrace";
const make=(code:string,amount:number|null,volume=1000,acc="legal_applied"):FreeInput=>({operatorCode:code,operatorName:"試験市",businessKey:"17-1-000",accountingType:acc,fiscalYear:2020,values:{annualBillableVolume:volume,depreciation_cost:amount,total_cost:100,operating_expense:100,sewerFeeRevenue:50,wastewaterTreatmentCost:100,opexComponent:60,capitalCostComponent:40,householdFee20m3Yen:1234}});
describe("2020 free data",()=>{
 it("separates missing from zero, treats negative source amounts honestly",()=>{
  expect(parseOfficialNumber("0")).toBe(0);expect(parseOfficialNumber("1,234")).toBe(1234);expect(parseOfficialNumber("-")).toBeNull();expect(parseOfficialNumber("")).toBeNull();expect(()=>parseOfficialNumber("Infinity")).toThrow();
  const rs=buildFree2020Rows([make("011002",0),make("012025",null),make("012033",-1)]);
  expect(rs[0].nature_depreciation_unit).toBe(0);expect(rs[1].nature_depreciation_unit).toBeNull();expect(rs[2].nature_depreciation_annual).toBe(-1);expect(rs[2].nature_depreciation_unit).toBeNull();expect(rs[0].nature_depreciation_count).toBe(1);
 });
 it("calculates an unweighted item-specific median without crossing prefectures or accounting types",()=>{
  const rs=buildFree2020Rows([make("011002",0),make("012025",100),make("012033",1000),make("012041",9999,1000,"non_legal_applied"),make("012050",100,0),make("021013",9999)]);
  expect(rs[0].nature_depreciation_median).toBe(100);expect(rs[0].nature_depreciation_difference).toBe(-100);expect(rs[0].nature_depreciation_count).toBe(3);expect(rs[3].nature_depreciation_annual).toBeNull();expect(rs[3].maintenance_annual).toBe(60);expect(rs[3].maintenance_median).toBeNull();expect(rs[4].comparisonEligible).toBe("対象外");
  expect(rs[0].householdFee20m3Yen).toBe(1234);expect(rs[0].feeUnitPrice).toBe(50);
 });
 it("rejects wrong years and duplicate accounts without projecting shared operators onto municipalities",()=>{
  const r=make("118541",5);r.operatorName="坂戸、鶴ケ島下水道組合";
  expect(buildFree2020Rows([r])).toHaveLength(1);expect(()=>buildFree2020Rows([r,r])).toThrow(/Duplicate/);expect(()=>buildFree2020Rows([{...r,fiscalYear:2024}])).toThrow();expect(()=>sourceIdentity({決算年度:2024})).toThrow();
 });
 it("does not silently total an incomplete purpose category",()=>{
  const r=make("011002",5);r.values.business_expense=10;r.values.general_administration_expense=null;
  const row=buildFree2020Rows([r])[0];expect(row['purpose_general-management_annual']).toBeNull();expect(row.purpose_business_annual).toBe(10);
 });
 it("covers every chart metric and retains BOM, leading zeros and safe external text",()=>{
  for(const metric of COST_CHART_METRICS)expect(FREE_COSTS.some(c=>c.id===metric.key.replace(":","_"))).toBe(true);
  expect(new Set(FREE_COLUMNS.map(c=>c.id)).size).toBe(FREE_COLUMNS.length);expect(new Set(FREE_COLUMNS.map(c=>c.label)).size).toBe(FREE_COLUMNS.length);
  const r=make("011002",1);r.operatorName='=HYPERLINK("bad")';const csv=freeRowsCsv(buildFree2020Rows([r]));expect(csv.startsWith("\uFEFF")).toBe(true);expect(csv).toContain('"011002"');expect(csv).toContain("'=HYPERLINK");
 });
 it("the committed complete CSV contains the official R2 population and can reproduce the existing chart geometry",()=>{
  const text=readFileSync("public/free-data/public-sewer-2020-national/public-sewer-2020.csv","utf8");const wb=XLSX.read(Buffer.from(text),{type:"buffer",raw:true});const rows=XLSX.utils.sheet_to_json<Record<string,string>>(wb.Sheets[wb.SheetNames[0]],{raw:true,defval:""});
  expect(rows).toHaveLength(1189);expect(rows.every(r=>r["決算年度"]==="2020")).toBe(true);expect(new Set(rows.map(r=>r["行識別子"])).size).toBe(rows.length);
  expect(rows.filter(r=>r["会計区分"]==="法適用")).toHaveLength(906);expect(rows.filter(r=>r["会計区分"]==="法非適用")).toHaveLength(283);
  const selected=rows.filter(r=>r["都道府県"]==="和歌山県"&&r["費用比較対象"]==="対象");
  const model=buildCostComparisonChart(selected.map(r=>({comparisonUnitKey:r["行識別子"],eligible:true,annualBillableVolume:Number(r["年間有収水量（m³/年）"]),municipalityName:r["自治体・運営団体名"],businessKey:r["事業キー"],businessName:"公共下水道",detailMunicipalityCode:r["団体コード"],costCompositionShares:[{id:"depreciation",yenPerM3:Number(r["減価償却費：単位費用（円/m³）"])}]} as any)),"nature:depreciation");
  expect(model.points.length).toBe(selected.length);for(let i=0;i<selected.length;i++)expect(model.points[i].y).toBeCloseTo(Number(selected[i]["減価償却費：年額（千円/年）"])/1000,8);
  expect(rows.find(r=>r["団体コード"]==="151009")!["一般家庭用20m³月額（円/月・税込）"]).toBe("3047");
 });
});
describe("survey release gate",()=>{
 it("requires actual form/privacy/publication verification, independent of note configuration",()=>{
  const config={provider:"google_forms",responderUrl:"https://docs.google.com/forms/d/e/test-form/viewform",status:"active",privacySettingsVerified:true,publicationApproved:true,publishedFormVerified:true,confirmationDownloadUrl:"https://mierugesuido.pages.dev/datasets/free-2020/download/"};
  expect(freeSurveyReady(config)).toBe(true);
  expect(freeSurveyEntryHref(config)).toBe(config.responderUrl);
  expect(freeSurveyEntryHref({...config,status:"draft"})).toBe("/datasets/free-2020");
  for(const key of ["privacySettingsVerified","publicationApproved","publishedFormVerified"])expect(freeSurveyReady({...config,[key]:false})).toBe(false);
  expect(freeSurveyReady({...config,status:"draft"})).toBe(false);expect(freeSurveyReady({...config,responderUrl:null})).toBe(false);
  for(const u of ["javascript:alert(1)","https://evil.com/forms/d/e/test/viewform","https://docs.google.com/forms/d/test/edit","https://docs.google.com/forms/d/e/test/viewform?email=private"])expect(validGoogleResponderUrl(u)).toBe(false);
 });
});
describe("free data calculation trace",()=>{
 it("preserves official tax bases instead of mixing tax-exclusive revenue with tax-inclusive costs",()=>{
  const f={id:"sewerFeeRevenue",label:"使用料収入",unit:"千円/年",table:20,row:1,col:3};
  expect(freeSourceTaxBasis(f,"legal_applied")).toBe("税抜");
  expect(freeSourceTaxBasis(f,"non_legal_applied")).toBe("税込");
  expect(freeSourceTaxBasis({...f,id:"householdFee20m3Yen",unit:"円/月・税込"},"legal_applied")).toBe("税込");
  expect(freeSourceTaxBasis({...f,id:"annualBillableVolume",unit:"m³/年"},"non_legal_applied")).toBe("金額以外");
 });
 it("documents every published column with the right dependencies, denominators and median semantics",()=>{
  const defs=freeCalculationDefinitions([]);
  expect(defs.map(d=>d["項目ID"])).toEqual(FREE_COLUMNS.map(c=>c.id));
  const find=(id:string)=>defs.find(d=>d["項目ID"]===id)!;
  expect(find("expenseRecoveryRate")["算定式・転記方法"]).toBe("sewerFeeRevenue × 100 ÷ wastewaterTreatmentCost");
  expect(find("nature_depreciation_share")["入力項目ID"]).toBe("nature_depreciation_annual | total_cost");
  expect(find("purpose_general-management_annual")["入力項目ID"]).toBe("business_expense | general_administration_expense");
  expect(find("nature_depreciation_median")["算定式・転記方法"]).toBe("MEDIAN(比較対象の nature_depreciation_unit)");
  expect(find("nature_depreciation_difference")["算定式・転記方法"]).toBe("nature_depreciation_unit − nature_depreciation_median");
 });
 it("offers raw inputs and source row addresses without responses or survey bypass parameters",()=>{
  const base="public/free-data/public-sewer-2020-national/";
  for(const name of ["input-values.csv","source-records.csv","calculations.csv"]){
   const csv=readFileSync(base+name,"utf8");expect(csv.startsWith("\uFEFF")).toBe(true);expect(csv).not.toMatch(/@gmail|answered=true|\/Users\//);
  }
  const page=readFileSync("app/datasets/page.tsx","utf8");expect(page).toContain("href={freeSurveyEntryHref(survey)}");expect(page).not.toContain("/datasets/free-2020/download");
 });
});
