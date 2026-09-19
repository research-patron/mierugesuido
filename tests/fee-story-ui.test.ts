import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCurrentFundingContext } from "@/components/MunicipalityDetailClient";

const detailSource = readFileSync(
  path.join(process.cwd(), "components/MunicipalityDetailClient.tsx"),
  "utf8"
);
const assessmentSource = readFileSync(
  path.join(process.cwd(), "components/municipality-detail/CitizenAssessmentPanel.tsx"),
  "utf8"
);
const feeAnalysisSource = readFileSync(
  path.join(process.cwd(), "components/municipality-detail/FeeLevelAnalysisPanel.tsx"),
  "utf8"
);
const assessmentLogicSource = readFileSync(
  path.join(process.cwd(), "lib/citizenMunicipalityAssessment.ts"),
  "utf8"
);
const sharedCopySource = readFileSync(
  path.join(process.cwd(), "lib/copy.ts"),
  "utf8"
);
const municipalityPageSource = readFileSync(
  path.join(process.cwd(), "app/municipalities/[municipalityCode]/page.tsx"),
  "utf8"
);
const fieldDefinitionsSource = readFileSync(
  path.join(process.cwd(), "lib/fieldDefinitions.ts"),
  "utf8"
);
const peerComparisonSource = readFileSync(
  path.join(process.cwd(), "lib/prefecturePeerComparison.ts"),
  "utf8"
);
const staticGeneratorSource = readFileSync(
  path.join(process.cwd(), "scripts/static/generate.ts"),
  "utf8"
);
const etlSource = readFileSync(
  path.join(process.cwd(), "scripts/etl/etl.ts"),
  "utf8"
);

describe("household 20m3 fee and recovery-story UI", () => {
  it("keeps the official household tariff separate from the average unit price", () => {
    expect(detailSource).toContain("家庭の料金表");
    expect(detailSource).toContain("一般家庭用20m³／月");
    expect(assessmentSource).toContain('fee == null ? "未取得"');
    expect(assessmentSource).toContain("一般家庭用20m³／月・税込");
    expect(detailSource).not.toContain("税込・使用料単価 ${formatYenPerM3");
    expect(detailSource).toContain("家庭の月額料金と、事業全体の年間収支です");
    expect(detailSource).toContain("税込・地方公営企業年鑑の家庭向け料金表より");
  });

  it("uses the official fee-recovery cost boundary instead of gross operating expense", () => {
    expect(detailSource).toContain("汚水処理費（公費負担分等を除く）");
    expect(detailSource).toContain("維持管理費分");
    expect(detailSource).toContain("資本費分");
    expect(detailSource).toContain("経費回収率の対象は、公費負担分等を除いた汚水処理費です");
    expect(detailSource).toContain("/data/static/citizen-fee-costs/");
    expect(detailSource).toContain("mergePrefecturePeerFeeCostSupplement(model, feeCosts)");
    expect(detailSource).toContain("年間下水道使用料収入");
    expect(detailSource).toContain("年間不足額");
    expect(detailSource).toContain("事業全体の使用料収入があと${requiredIncreaseRate.toFixed(1)}%あれば");
    expect(detailSource).toContain("費用・有収水量を固定した単純試算");
    expect(detailSource).toContain("Math.abs(opex + capital - treatment) < 0.5");
    expect(detailSource).toContain("内訳が未取得または合計と一致しないため、確認できた合計だけを表示しています");
    expect(assessmentSource).toContain("月20m³料金へ単純換算すると");
    expect(assessmentLogicSource).toContain("すべての料金区分が同じ率で変わると仮定");
    expect(assessmentLogicSource).toContain("費用・有収水量・利用者構成を固定した単純試算");
    expect(detailSource).not.toContain("改定リスクスコア");
  });

  it("keeps the diagnosis concise and moves the full fee-level reasoning behind its exact CTA", () => {
    expect(assessmentSource).toContain("なぜ、この料金水準？");
    expect(assessmentSource).toContain('<Link href={feeAnalysisHref} className={styles.evidenceLink}>');
    expect(assessmentSource).toContain("料金水準の考察を見る");
    expect(assessmentSource).not.toContain("costEquation");
    expect(assessmentSource).not.toContain("costComponentGrid");
    expect(assessmentSource).not.toContain("costReasonDetails");
    expect(assessmentSource).not.toContain("第20表");
    expect(assessmentSource).not.toContain("第21表");
    expect(assessmentSource).not.toContain("https://www.jswa.jp/2017/11/27/7200/");
    expect(detailSource).toContain('feeAnalysisHref={detailHref(municipalityCode, selectedGroup.key, "fee-analysis")}');
  });

  it("shows all available cost evidence as charts with source and finance links", () => {
    expect(feeAnalysisSource).toContain("料金水準の考察");
    expect(feeAnalysisSource).toContain("assessment.comparisonBasis.scopeLabel");
    expect(feeAnalysisSource).toContain("維持管理費分");
    expect(feeAnalysisSource).toContain("資本費分");
    expect(feeAnalysisSource).toContain("汚水処理原価");
    expect(feeAnalysisSource).toContain("<CostComparisonScatter");
    expect(feeAnalysisSource).toContain("<CostBars items={analysis.purposeItems}");
    expect(feeAnalysisSource).toContain("<CostBars items={natureItems}");
    expect(feeAnalysisSource).toContain("目的別の営業費用・第20表");
    expect(feeAnalysisSource).toContain("性質別の費用・第21表");
    expect(feeAnalysisSource).toContain("https://www.jswa.jp/2017/11/27/7200/");
    expect(feeAnalysisSource).toContain('<Link href={financeHref}');
    expect(feeAnalysisSource).toContain('<Link href={yearbookHref}');
    expect(feeAnalysisSource).toContain("料金に関わるほかの要素");
    expect(feeAnalysisSource).not.toContain("<details");
    expect(peerComparisonSource).toContain("sourceAnnualBillableVolume !== row.annualBillableVolume");
    expect(peerComparisonSource).toContain("assertPrefecturePeerFeeCostsReconciled(model)");
    expect(assessmentLogicSource).toContain('accountingType === "non_legal_applied"');
  });

  it("keeps the finance context limited to operating-statement values", () => {
    const group = {
      key: "17-1-000",
      latestBusiness: {
        accountingType: "legal_applied",
        financialStory: { income: { operatingRevenue: 80, operatingExpense: 100, revenueBreakdown: [] } }
      },
      latest: { surveyYear: 2025 },
      businesses: []
    } as any;

    expect(buildCurrentFundingContext(group)).toEqual({
      operatingRevenue: 80,
      operatingExpense: 100,
      operatingLoss: 20
    });
    expect(detailSource).not.toContain("NonStandardTransferFinanceSummary");
    expect(detailSource).not.toContain("transferBasisBreakdown");
  });

  it("removes the repeated reading note and misleading shorthand from every detail tab", () => {
    expect(detailSource).not.toContain("readingNote");
    expect(detailSource).not.toContain("20m³の負担");
    expect(detailSource).not.toContain("使用料で賄う範囲");
    expect(detailSource).not.toContain("必要改定率");
    expect(detailSource).not.toContain("料金の適正性");
  });

  it("maps R2-R6 official e-Stat table coordinates correctly", () => {
    expect(etlSource).toContain('{ field: "householdFee20m3Yen", label: "一般家庭用20m³／月使用料", rowNo: "01", colNo: 13');
    expect(etlSource).toContain('{ field: "opexComponent", label: "汚水処理費（維持管理費分）", rowNo: "01", colNo: 44');
    expect(etlSource).toContain('{ field: "capitalCostComponent", label: "汚水処理費（資本費分）", rowNo: "02", colNo: 8');
    expect(etlSource).toContain('{ field: "wastewaterTreatmentCost", label: "汚水処理費（合計）", rowNo: "02", colNo: 16');
    expect(etlSource).not.toContain('{ field: "wastewaterTreatmentCost", label: "汚水処理費", rowNo: "01", colNo: 44');
  });
});
