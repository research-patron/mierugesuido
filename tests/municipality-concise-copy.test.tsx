import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCitizenMunicipalityAssessment } from "@/lib/citizenMunicipalityAssessment";
import { CitizenAssessmentPanel } from "@/components/municipality-detail/CitizenAssessmentPanel";
import { FeeLevelAnalysisPanel } from "@/components/municipality-detail/FeeLevelAnalysisPanel";
import { CostComparisonScatter } from "@/components/municipality-detail/CostComparisonScatter";
import type { PrefecturePeerComparisonResult, PrefecturePeerComparisonRow } from "@/lib/prefecturePeerComparison";

const assessment = buildCitizenMunicipalityAssessment({r6DataAvailability:{status:"available",sourceSurveyYear:2024,reason:null},
  householdFee20m3Applicability:"applicable",householdFee20m3Yen:3000,sewerFeeRevenue:80,wastewaterTreatmentCost:100,
  annualBillableVolume:1000,opexComponent:60,capitalCostComponent:40,expenseRecoveryRate:80,accountingType:"legal_applied",
  purposeCostItems:[{id:"pipeline",label:"管渠費",value:30}],
  costComposition:{total:100,items:[{id:"labor",label:"人件費",value:20,sharePercent:20}]}});
const props={assessment,municipalityName:"試験市",prefectureName:"山形県",businessLabel:"公共下水道",fiscalLabel:"R6",peerLoading:false,financeHref:"/finance",yearbookHref:"/yearbook"};

describe("concise municipality content",()=>{
  it("retains the revenue gap and uniform household assumption without duplicate caveats",()=>{
    const html=renderToStaticMarkup(<CitizenAssessmentPanel {...props} businessKey="17-1-000" fundShortage={null} revisionComparison={null} businessLabelsByKey={{}} prefectureHref="/prefecture" feeAnalysisHref="/analysis"/>);
    expect(html).toContain("あと +25.0%");
    expect(html).toContain("すべての料金区分が同じ率で変わると仮定");
    expect(html).toContain("資金不足のデータ未確認");
    expect(html).not.toMatch(/断定|確認する必要|保証|この診断だけでは/);
    expect(html).not.toContain("derivedConclusion");
  });
  it("renders cost evidence and other factors immediately, outside disclosures",()=>{
    const html=renderToStaticMarkup(<FeeLevelAnalysisPanel {...props} diagnosisHref="/diagnosis" peerComparison={null}/>);
    expect(html).toContain('id="cost-breakdown-title"');
    expect(html).toContain("管渠費");
    expect(html).toContain("人件費");
    expect(html).toContain("料金に関わるほかの要素");
    expect(html).not.toContain("<details"); // No points: even the optional chart-method disclosure is absent.
    expect(html).not.toContain("確認する必要");
  });
  it("has accessible point controls, a mobile selector and distinct business destinations",()=>{
    const rows=[{comparisonUnitKey:"a",municipalityName:"同名市",businessName:"公共下水道",businessKey:"17-1-000",detailMunicipalityCode:"000001",eligible:true,annualBillableVolume:1_000_000,costCompositionShares:[{id:"depreciation",yenPerM3:200}]}] as PrefecturePeerComparisonRow[];
    const html=renderToStaticMarkup(<CostComparisonScatter rows={rows} currentKey="a" areaLabel="県内" loading={false}/>);
    expect(html).toContain('role="button" tabindex="0"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("同名市・公共下水道");
    expect(html).toContain("<select");
    expect(html).toContain('value="nature:depreciation" selected=""');
    expect(html).toContain("年間有収水量と減価償却費の散布図");
    expect(html).not.toMatch(/月額|20m³|料金と費用/);
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });
  it("shows loading separately from unavailable peer data",()=>{
    const loading=renderToStaticMarkup(<CostComparisonScatter rows={[]} areaLabel="県内" loading/>);
    const empty=renderToStaticMarkup(<CostComparisonScatter rows={[]} areaLabel="県内" loading={false}/>);
    expect(loading).toContain('role="status"');
    expect(loading).not.toContain("データがありません");
    expect(empty).toContain("比較できるR6データがありません");
  });
  it("does not present eligible peers as the selected business when that business is excluded",()=>{
    const rows=[{comparisonUnitKey:"excluded",eligible:false},{comparisonUnitKey:"peer",eligible:true,
      annualBillableVolume:1_000_000,costCompositionShares:[{id:"depreciation",yenPerM3:200}]}] as PrefecturePeerComparisonRow[];
    const html=renderToStaticMarkup(<FeeLevelAnalysisPanel {...props} diagnosisHref="/diagnosis"
      peerComparison={{rows} as PrefecturePeerComparisonResult} currentComparisonUnitKey="excluded"/>);
    expect(html).toContain("この事業は県内の費用比較の対象外です");
    expect(html).not.toContain("減価償却費を比較できるR6データがありません");
    expect(html).not.toContain('aria-label="県内の年間有収水量');
  });
  it("identifies the missing current expense without hiding available prefecture data",()=>{
    const rows=[{comparisonUnitKey:"peer",municipalityName:"比較市",businessKey:"17-1-000",eligible:true,
      annualBillableVolume:1_000_000,costCompositionShares:[{id:"depreciation",yenPerM3:200}]}] as PrefecturePeerComparisonRow[];
    const html=renderToStaticMarkup(<CostComparisonScatter rows={rows} currentKey="current" areaLabel="県内" loading={false}/>);
    expect(html).toContain("この事業の減価償却費はデータ未取得です");
    expect(html).toContain("比較市");
  });
});
