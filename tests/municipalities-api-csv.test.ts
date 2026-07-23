import { describe, expect, it } from "vitest";
import { municipalitiesToCsv } from "@/lib/municipalityCsv";

describe("static municipality CSV", () => {
  it("exports every supplied municipality instead of truncating at 100 rows", () => {
    const items = Array.from({ length: 173 }, (_, index) => ({
      prefectureName: "北海道",
      municipalityName: `自治体${index + 1}`,
      municipalityCode: String(index + 1).padStart(6, "0"),
      businessType: "公共下水道",
      latestYear: 2024,
      latestFiscalYearLabel: "令和6年度",
      diagnosis: null,
      hasRevisionEvent: false
    }));

    const csv = municipalitiesToCsv(items);

    expect(csv.trim().split("\n")).toHaveLength(174);
    expect(csv).toContain("使用料収入の必要増加率（%・単純計算）");
  });

  it("exports no required increase when recovery is already sufficient", () => {
    const csv = municipalitiesToCsv([{
      prefectureName: "新潟県",
      municipalityName: "余剰市",
      municipalityCode: "150002",
      businessKey: "17-1-000",
      accountingType: "legal_applied",
      diagnosis: { requiredRevisionRateTo100: -0.04 },
      hasRevisionEvent: false
    }]);

    expect(csv).toContain('"0.0"');
    expect(csv).not.toContain('"-4.0"');
  });

  it("exports an internal 0.25 revision fraction as 25.0 percent", () => {
    const csv = municipalitiesToCsv([{
      prefectureName: "新潟県",
      municipalityName: "検証市",
      municipalityCode: "150001",
      businessKey: "17-1-000",
      businessType: "公共下水道",
      accountingType: "legal_applied",
      latestYear: 2024,
      latestFiscalYearLabel: "R6",
      diagnosis: {
        requiredRevisionRateTo100: 0.25,
        expenseRecoveryRate: 80,
        feeUnitPriceYenPerM3: 120,
        treatmentCostYenPerM3: 150,
        feeAdequacyLabel: "要注意"
      },
      hasRevisionEvent: false,
      dataQualityStatus: "ok",
      flags: []
    }]);

    expect(csv).toContain('"25.0"');
    expect(csv).not.toContain('"0.25"');
  });
});
