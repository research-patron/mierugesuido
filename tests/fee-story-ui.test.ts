import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCurrentFundingContext } from "@/components/MunicipalityDetailClient";

const detailSource = readFileSync(
  path.join(process.cwd(), "components/MunicipalityDetailClient.tsx"),
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
    expect(detailSource).toContain("料金表データ未取得");
    expect(detailSource).toContain("税込・料金表上の標準額（使用料単価×20ではありません）");
    expect(detailSource).not.toContain("税込・使用料単価 ${formatYenPerM3");
    expect(detailSource).toContain("対象も単位も異なるため、家庭向け料金表と事業全体の決算を分けて表示します");
    expect(detailSource).toContain("全利用者の実績平均や事業全体の費用回収額ではありません");
  });

  it("uses the official fee-recovery cost boundary instead of gross operating expense", () => {
    expect(detailSource).toContain("汚水処理費（公費負担分等を除く）");
    expect(detailSource).toContain("維持管理費分");
    expect(detailSource).toContain("資本費分");
    expect(detailSource).toContain("営業費用と、経費回収率の対象となる汚水処理費は同じ範囲ではありません");
    expect(detailSource).toContain("年間下水道使用料収入");
    expect(detailSource).toContain("年間不足額");
    expect(detailSource).toContain("事業全体の使用料収入を${requiredIncreaseRate.toFixed(1)}%増やす必要がある");
    expect(detailSource).toContain("家庭の20m³月額への換算ではありません");
    expect(detailSource).toContain("Math.abs(opex + capital - treatment) < 0.5");
    expect(detailSource).toContain("内訳が未取得または合計と一致しないため、確認できた合計だけを表示しています");
    expect(detailSource).not.toContain("経費回収率100%相当の月額");
    expect(detailSource).not.toContain("現在の月額との差");
    expect(detailSource).not.toContain("formatSignedMonthlyDifference");
    expect(detailSource).not.toContain("calculateRequiredHouseholdFee20m3");
    expect(detailSource).not.toContain("改定リスクスコア");
  });

  it("shows the official R6 table 40 non-standard transfer without an income-statement proxy", () => {
    expect(detailSource).toContain("<NonStandardTransferFinanceSummary");
    expect(detailSource).toContain('findAnnual(group, 2024, group.latestBusiness.accountingType)');
    expect(detailSource).toContain("基準外繰入金合計");
    expect(detailSource).toContain("第40表の値をそのまま表示");
    expect(detailSource).toContain("営業収益−（営業費用−減価償却費）");
    expect(detailSource).toContain("基準外繰入金の定義・算式ではありません");
    expect(detailSource).toContain("formatTransferExact(context.nonStandardTransfer)");
    expect(detailSource).not.toContain("nonStandardTransfer: operatingRevenue");
    expect(detailSource).not.toContain("nonStandardTransfer: operatingExpense");
  });

  it("selects the exact R6 transfer and never falls back to another fiscal year", () => {
    const group = {
      key: "17-1-000",
      latestBusiness: {
        accountingType: "legal_applied",
        financialStory: { income: { operatingRevenue: 80, operatingExpense: 100, revenueBreakdown: [] } }
      },
      latest: { surveyYear: 2025, nonStandardTransfer: 999 },
      businesses: [{
        accountingType: "legal_applied",
        annualFinancials: [
          { surveyYear: 2023, nonStandardTransfer: 777 },
          { surveyYear: 2024, nonStandardTransfer: 0 }
        ]
      }]
    } as any;

    expect(buildCurrentFundingContext(group).nonStandardTransfer).toBe(0);
    group.businesses[0].annualFinancials = [{ surveyYear: 2023, nonStandardTransfer: 777 }];
    expect(buildCurrentFundingContext(group).nonStandardTransfer).toBeNull();
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
