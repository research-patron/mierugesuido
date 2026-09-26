import { describe,it,expect } from "vitest";
import { readFileSync } from "node:fs";
import { canPurchase,purchaseBlockers,validNoteUrl,type DatasetProduct } from "@/lib/datasetProduct";
import { buildDatasetEdition,datasetCsv,datasetColumns } from "@/lib/datasetEdition";
import { normalizeHomeComparison } from "@/lib/comparison";
import { configureUsageMeasurement,emitUsage,type UsageEvent } from "@/lib/telemetry";
import { buildBusinessGroups,buildTrendPoints } from "@/components/MunicipalityDetailClient";
const json=(file:string)=>JSON.parse(readFileSync(file,"utf8"));
const product=json("config/dataset-products.json")[0] as DatasetProduct;
const home=json("data/static/home.json");

describe("history selection preserves complete annual records",()=>{
 it("selects R6 without removing R2-R5, selects R5 without substituting R6",()=>{
  const detail=json("public/data/static/municipalities/151009.json");
  const before=JSON.stringify(detail);
  const current=buildBusinessGroups(detail.businesses,2024).find(group=>group.key==="17-1-000")!;
  expect(current.latest.surveyYear).toBe(2024);
  expect(buildTrendPoints(current).map(point=>point.householdFee20m3Yen)).toEqual([3047,3047,3047,3047,3047]);
  const prior=buildBusinessGroups(detail.businesses,2023).find(group=>group.key==="17-1-000")!;
  expect(prior.latest.surveyYear).toBe(2023);
  expect(buildTrendPoints(prior).map(point=>point.year)).toEqual([2019,2020,2021,2022,2023]);
  expect(buildTrendPoints(prior)[0].householdFee20m3Yen).toBeNull();
  expect(buildBusinessGroups(detail.businesses,2099)).toEqual([]);
  expect(JSON.stringify(detail)).toBe(before);
 });
 it("retains source histories for every published municipality and selected R6 business",()=>{
  const manifest=json("data/static/manifest.json");
  let checked=0;
  for(const code of manifest.municipalityCodes){
   const detail=json(`public/data/static/municipalities/${code}.json`);
   for(const group of buildBusinessGroups(detail.businesses,2024)){
    const originalCount=detail.businesses.filter((b:any)=>b.businessKey===group.key).reduce((count:number,b:any)=>count+b.annualFinancials.length,0);
    expect(group.businesses.reduce((count,b)=>count+b.annualFinancials.length,0)).toBe(originalCount);
    expect(group.latest.surveyYear).toBe(2024);
    expect(buildTrendPoints(group).map(point=>point.year)).toEqual([2020,2021,2022,2023,2024]);
    checked++;
   }
  }
  expect(checked).toBeGreaterThan(3000);
 });
 it("does not mix businesses or fabricate a missing history year",()=>{
  const business={businessKey:"17-1-000",businessName:"公共下水道",accountingType:"legal_applied",annualFinancials:[{surveyYear:2024,householdFee20m3Yen:1000},{surveyYear:2022,householdFee20m3Yen:900}]};
  const group=buildBusinessGroups([business],2024)[0];
  expect(buildTrendPoints(group).map(point=>point.householdFee20m3Yen)).toEqual([null,null,900,null,1000]);
 });
});
describe("dataset editions and safe selling state",()=>{
 it("uses exactly the screen population and stored values for all rows",()=>{
  const edition=buildDatasetEdition(home,product);
  const screen=normalizeHomeComparison(home).mapScopes.public.mapMunicipalities;
  expect(edition.rows).toHaveLength(screen.length);
  expect(edition.rows).toHaveLength(1168);
  for(const row of edition.rows){
   const original=screen.find((item:any)=>item.municipalityCode===row.municipalityCode)!;
   expect(row.expenseRecoveryRate).toBe(original.expenseRecoveryRate);
   expect(row.feeUnitPriceYenPerM3).toBe(original.feeUnitPriceYenPerM3);
   expect(row.treatmentCostYenPerM3).toBe(original.treatmentCostYenPerM3);
  }
  expect(edition.sampleRows).toEqual(edition.rows.slice(0,5));
  expect(buildDatasetEdition(home,product)).toEqual(edition);
  expect(datasetColumns.some(column=>column.id==="householdFee20m3Yen")).toBe(false);
 });
 it("blocks missing settings, stale approvals, draft, preview and retired products",()=>{
  expect(canPurchase(product,"edition",true)).toBe(false);
  const ready={...product,status:"published",priceJpy:100,noteUrl:"https://note.com/test_fixture/n/n0123456789ab",sellerName:"Test fixture",contactUrl:"https://seller-fixture.jp/contact",sellerDisclosureUrl:"https://seller-fixture.jp/terms",licenseSummary:"fixture",correctionPolicy:"fixture",newEditionPolicy:"fixture",refundSummary:"fixture",deliverySummary:"fixture",sourcesReviewed:true,sellerTermsReviewed:true,deliveryReviewed:true,publicationApproved:true,reviewedDataVersion:"edition"} as DatasetProduct;
  expect(purchaseBlockers(ready,"edition",true)).toEqual([]);
  for(const status of ["draft","preview","retired"] as const)expect(canPurchase({...ready,status},"edition",true)).toBe(false);
  for(const key of ["priceJpy","noteUrl","sellerName","contactUrl","sellerDisclosureUrl","licenseSummary","correctionPolicy","newEditionPolicy","refundSummary","deliverySummary","reviewedDataVersion"]){expect(canPurchase({...ready,[key]:null},"edition",true)).toBe(false);}
  for(const key of ["sourcesReviewed","sellerTermsReviewed","deliveryReviewed","publicationApproved"]){expect(canPurchase({...ready,[key]:false},"edition",true)).toBe(false);}
  expect(canPurchase(ready,"changed-edition",true)).toBe(false);
  expect(canPurchase(ready,"edition",false)).toBe(false);
  for(const noteUrl of ["#","javascript:alert(1)","http://note.com/a/n/n12","https://note.com.evil.test/a/n/n12","https://note.com/a","https://example.com/n/n12"])expect(validNoteUrl({...ready,noteUrl})).toBe(false);
 });
 it("preserves zero and null, quotes multiline cells, blocks formula text and preserves leading zeros",()=>{
  const csv=datasetCsv(["code","zero","missing","name"],[{code:"011002",zero:0,missing:null,name:'=SUM(A1)\n"quoted"'}]);
  expect(csv.startsWith("\uFEFF")).toBe(true);
  expect(csv).toContain('"011002","0","","\'=SUM(A1)\n""quoted"""');
 });
 it("stops duplicate or non-finite data rather than altering values",()=>{
  const copy=structuredClone(home);copy.mapScopes.public.mapMunicipalities.push(copy.mapScopes.public.mapMunicipalities[0]);
  expect(()=>buildDatasetEdition(copy,product)).toThrow(/Duplicate/);
  const bad=structuredClone(home);bad.mapScopes.public.mapMunicipalities[0].expenseRecoveryRate=Infinity;
  expect(()=>buildDatasetEdition(bad,product)).toThrow(/Non-finite/);
 });
});
describe("opt-in measurement without purchase or private input",()=>{
 it("stays disabled without approved transport and consent; safe to block or throw",()=>{
  const events:UsageEvent[]=[];
  configureUsageMeasurement({enabled:false,consent:true,send:event=>events.push(event)});
  expect(emitUsage("view_item",{productId:product.productId})).toBe(false);
  configureUsageMeasurement({enabled:true,consent:false,send:event=>events.push(event)});
  expect(emitUsage("view_item",{productId:product.productId})).toBe(false);
  configureUsageMeasurement({enabled:true,consent:true,send:event=>events.push(event)});
  expect(emitUsage("view_item",{productId:product.productId,email:"private@fixture.test",q:"自由入力",url:"https://fixture.test/?email=private",dataVersion:"abc"},"same")).toBe(true);
  expect(emitUsage("view_item",{productId:product.productId,email:"private@fixture.test",q:"自由入力",url:"https://fixture.test/?email=private",dataVersion:"abc"},"same")).toBe(false);
  expect(emitUsage("view_item",{productId:product.productId,dataVersion:"new"},"same")).toBe(true);
  emitUsage("note_outbound_click",{productId:product.productId});
  expect(events).toHaveLength(3);
  expect(events[0].properties).toEqual({productId:product.productId,dataVersion:"abc"});
  expect(emitUsage("purchase" as any,{})).toBe(false);
  configureUsageMeasurement({enabled:true,consent:true,send:()=>{throw Error("blocked");}});
  expect(()=>emitUsage("sample_download_click",{productId:product.productId})).not.toThrow();
  configureUsageMeasurement({enabled:false,consent:false});
 });
});
