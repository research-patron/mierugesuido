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
    expect(detailSource).toContain("家庭向け料金表と事業全体の決算を、対象と単位を分けて確認します");
    expect(detailSource).toContain("全利用者の実績平均や事業全体の費用回収額ではありません");
  });

  it("uses the official fee-recovery cost boundary instead of gross operating expense", () => {
    expect(detailSource).toContain("汚水処理費（公費負担分等を除く）");
    expect(detailSource).toContain("維持管理費分");
    expect(detailSource).toContain("資本費分");
    expect(detailSource).toContain("営業費用と、経費回収率の対象となる汚水処理費は同じ範囲ではありません");
    expect(detailSource).toContain("/data/static/citizen-fee-costs/");
    expect(detailSource).toContain("mergePrefecturePeerFeeCostSupplement(model, feeCosts)");
    expect(detailSource).toContain("年間下水道使用料収入");
    expect(detailSource).toContain("年間不足額");
    expect(detailSource).toContain("事業全体の使用料収入を${requiredIncreaseRate.toFixed(1)}%増やす必要がある");
    expect(detailSource).toContain("家庭の20m³月額への換算ではありません");
    expect(detailSource).toContain("Math.abs(opex + capital - treatment) < 0.5");
    expect(detailSource).toContain("内訳が未取得または合計と一致しないため、確認できた合計だけを表示しています");
    expect(assessmentSource).toContain("月20m³料金へ単純換算すると");
    expect(assessmentLogicSource).toContain("すべての料金区分が同じ率で変わると仮定");
    expect(assessmentLogicSource).toContain("料金改定の予測、推奨改定率、公式指標ではありません");
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

  it("explains the fee level with maintenance and capital cost drivers before showing limits", () => {
    expect(feeAnalysisSource).toContain("料金水準の考察");
    expect(feeAnalysisSource).toContain("R6実績");
    expect(feeAnalysisSource).toContain("assessment.comparisonBasis.scopeLabel");
    expect(feeAnalysisSource).not.toContain("同種・法適用事業");
    expect(feeAnalysisSource).toContain("維持管理費分");
    expect(feeAnalysisSource).toContain("資本費分");
    expect(feeAnalysisSource).toContain("汚水処理原価");
    expect(feeAnalysisSource).toContain("この事業");
    expect(feeAnalysisSource).toContain("中央値との差");
    expect(feeAnalysisSource).toContain("料金と総原価の位置");
    expect(feeAnalysisSource).toContain("有収水量（料金収入につながる水量）");
    expect(feeAnalysisSource).toContain("費目の内訳と、ここから先の確認事項");
    expect(feeAnalysisSource).toContain("目的別｜どの施設・業務に費用がかかるか");
    expect(feeAnalysisSource).toContain("管渠費・ポンプ場費・処理場費");
    expect(feeAnalysisSource).toContain("性質別｜何に費用を使っているか");
    expect(feeAnalysisSource).toContain("人件費、動力費、薬品費、修繕費、委託料、減価償却費");
    expect(feeAnalysisSource).toContain("汚水処理費の二分とは集計範囲が異なります");
    expect(feeAnalysisSource).toContain("3〜5年程度の算定期間");
    expect(feeAnalysisSource).toContain("排水需要");
    expect(feeAnalysisSource).toContain("資産維持費");
    expect(feeAnalysisSource).toContain("控除");
    expect(feeAnalysisSource).toContain("料金体系");
    expect(feeAnalysisSource).toContain("減価償却費等");
    expect(feeAnalysisSource).toContain("地方債元利償還費等");
    expect(feeAnalysisSource).toContain("単年度");
    expect(feeAnalysisSource).toContain("https://www.jswa.jp/2017/11/27/7200/");
    expect(feeAnalysisSource).toContain("下水道使用料算定の基本的考え方（2016年度版）");
    expect(feeAnalysisSource).toContain('<Link href={diagnosisHref}');
    expect(feeAnalysisSource).toContain('<Link href={financeHref}');
    expect(feeAnalysisSource).toContain('<Link href={yearbookHref}');
    expect(feeAnalysisSource).toContain("費用と財務の根拠を見る");
    expect(feeAnalysisSource).toContain("orderDetailedCostItems(feeLevelCostAnalysis.natureItems)");
    expect(feeAnalysisSource).not.toContain(".slice(0, limit)");
    expect(assessmentLogicSource).toContain("有収水量1m³当たり");
    expect(assessmentLogicSource).toContain("同じ年度の関連性");
    expect(assessmentLogicSource).toContain("purposeCostItems");
    expect(assessmentLogicSource).toContain("natureCostItems");
    expect(sharedCopySource).toContain('title: "維持管理費分原価"');
    expect(sharedCopySource).toContain('title: "資本費分原価"');
    expect(detailSource).toContain("accountingType: latestBusiness.accountingType");
    expect(assessmentLogicSource).toContain('accountingType === "non_legal_applied"');
    expect(fieldDefinitionsSource).toContain("法非適用では地方債元利償還費等");
    expect(fieldDefinitionsSource).toContain("資産維持費は単年度年鑑だけでは確認できません");
    expect(peerComparisonSource).toContain("isPrefecturePeerFeeCostSupplement(supplement)");
    expect(peerComparisonSource).toContain("sourceAnnualBillableVolume !== row.annualBillableVolume");
    expect(peerComparisonSource).toContain("assertPrefecturePeerFeeCostsReconciled(model)");
    expect(staticGeneratorSource).toContain("if (comparison.rows.length === 0)");
    expect(municipalityPageSource).toContain("維持管理費・資本費に分けた料金水準の背景");
    expect(assessmentLogicSource).not.toContain("年鑑の費用データだけでは料金水準を説明できません");
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
