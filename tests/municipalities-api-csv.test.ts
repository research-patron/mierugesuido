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
      feeRevisionComparison: null,
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
      feeRevisionComparison: null,
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
      feeRevisionComparison: null,
      hasRevisionEvent: false,
      dataQualityStatus: "ok",
      flags: []
    }]);

    expect(csv).toContain('"25.0"');
    expect(csv).not.toContain('"0.25"');
  });

  it("exports the strict Table 33 effective-date change instead of the manual event flag", () => {
    const csv = municipalitiesToCsv([{
      prefectureName: "秋田県",
      municipalityName: "潟上市",
      municipalityCode: "052116",
      businessKey: "18-0-000",
      accountingType: "legal_applied",
      diagnosis: null,
      hasRevisionEvent: false,
      feeRevisionComparison: {
        status: "changed",
        comparableBusinessCount: 2,
        changedBusinessCount: 2,
        changes: [
          {
            businessKey: "17-1-000",
            businessName: "公共下水道",
            r5EffectiveDate: "2012-01-01",
            r6EffectiveDate: "2024-06-01"
          },
          {
            businessKey: "17-4-000",
            businessName: "特定環境保全公共下水道",
            r5EffectiveDate: "2012-01-01",
            r6EffectiveDate: "2024-06-01"
          }
        ]
      }
    }]);

    expect(csv).toContain('"改定情報"');
    expect(csv).not.toContain('"公式改定情報"');
    expect(csv).toContain("施行年月日が変化（2事業）");
    expect(csv).toContain("公共下水道 R5 2012年1月1日 → R6 2024年6月1日");
    expect(csv).not.toContain("未登録");
  });

  it("distinguishes a compared no-change municipality from unavailable comparison data", () => {
    const csv = municipalitiesToCsv([
      {
        prefectureName: "新潟県",
        municipalityName: "比較済市",
        municipalityCode: "150003",
        businessKey: "17-1-000",
        accountingType: "legal_applied",
        diagnosis: null,
        hasRevisionEvent: true,
        feeRevisionComparison: {
          status: "unchanged",
          comparableBusinessCount: 1,
          changedBusinessCount: 0,
          changes: []
        }
      },
      {
        prefectureName: "新潟県",
        municipalityName: "比較不能町",
        municipalityCode: "150004",
        businessKey: "17-1-000",
        accountingType: "legal_applied",
        diagnosis: null,
        hasRevisionEvent: false,
        feeRevisionComparison: null
      }
    ]);

    expect(csv).toContain("改定情報なし（R5・R6施行年月日を比較済み・1事業）");
    expect(csv).toContain('"比較対象外"');
    expect(csv).not.toContain("変更一覧に掲載なし");
  });
});
