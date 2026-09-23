import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { comparisonHref, competitionRanks, meanFinite, normalizeHomeComparison, orderRankingRows, selectComparisonRows } from "@/lib/comparison";
import { formatSettlementFiscalLabel } from "@/lib/format";
import { municipalityDetailHref } from "@/lib/municipalityLinks";
import { buildRankingCoverage } from "@/scripts/static/rankingCoverage";
import { countRankingPopulation, groupRankingPopulation } from "@/lib/rankingCoverage";

describe("phase 1 comparison contracts", () => {
  it("does not substitute an older year or mistake missing values for zero", () => {
    const items = [
      { municipalityCode: "012001", latestYear: 2024, businessKey: "17-1-000", expenseRecoveryRate: 0 },
      { municipalityCode: "012002", latestYear: 2022, businessKey: "17-1-000", expenseRecoveryRate: 80 },
      { municipalityCode: "012003", latestYear: 2024, businessKey: "17-1-000", expenseRecoveryRate: null },
      { municipalityCode: "012004", latestYear: 2024, businessKey: "17-4-000", expenseRecoveryRate: 150 }
    ];
    const rows = selectComparisonRows(items, new URLSearchParams({ fiscalYear: "2024", businessType: "17/1" }), 2024);
    expect(rows).toHaveLength(2);
    expect(meanFinite(rows.map(row => row.expenseRecoveryRate))).toBe(0);
    expect(meanFinite([null, undefined, NaN])).toBeNull();
    expect(selectComparisonRows(items, new URLSearchParams({ fiscalYear: "2025" }), 2024)).toEqual([]);
  });

  it("keeps business identity, tab, year and accounting on navigation", () => {
    const context = new URLSearchParams({ fiscalYear: "2024", businessType: "17/4", accountingType: "legal_applied", prefecture: "新潟県", rowUnit: "municipality", business: "wrong", q: "private input" });
    const link = comparisonHref(municipalityDetailHref("151009", "17-4-000", "finance"), context);
    const parsed = new URL(link, "https://example.test");
    expect(parsed.searchParams.get("business")).toBe("17-4-000");
    expect(parsed.searchParams.get("view")).toBe("finance");
    expect(parsed.searchParams.get("fiscalYear")).toBe("2024");
    expect(parsed.searchParams.get("accountingType")).toBe("legal_applied");
    expect(parsed.searchParams.has("q")).toBe(false);
    expect(comparisonHref("/rankings/expense-recovery-low?businessType=17%2F1", context)).toContain("businessType=17%2F1");
  });

  it("uses stored precision and competition ranks without excluding extreme values", () => {
    const rows = orderRankingRows([
      { expenseRecoveryRate: 90.04 }, { expenseRecoveryRate: 500 }, { expenseRecoveryRate: null },
      { expenseRecoveryRate: 90.01 }, { expenseRecoveryRate: 90.01 }, { expenseRecoveryRate: 0 }
    ], "expense-recovery-low");
    expect(rows.map(row => row.expenseRecoveryRate)).toEqual([0, 90.01, 90.01, 90.04, 500]);
    expect(competitionRanks(rows, "expense-recovery-low")).toEqual([1, 2, 2, 4, 5]);
  });

  it("uses settlement years rather than a catalog-year offset", () => {
    expect(formatSettlementFiscalLabel({ surveyYear: 2024 })).toBe("R6");
    expect(formatSettlementFiscalLabel({ surveyYear: 2023, fiscalYearLabel: "令和5年度" })).toBe("R5");
  });

  it("reconciles the real home corpus at the common year without mutating inputs", () => {
    const original = JSON.parse(readFileSync("data/static/home.json", "utf8"));
    const before = JSON.stringify(original);
    const normalized = normalizeHomeComparison(original);
    for (const scope of Object.values(normalized.mapScopes) as any[]) {
      expect(scope.mapMunicipalities.every((row: any) => row.latestYear === normalized.overview.latestYear)).toBe(true);
      expect(scope.overview.municipalityCount).toBe(scope.mapMunicipalities.length);
      expect(scope.prefectureSummaries.reduce((n: number, row: any) => n + row.municipalityCount, 0)).toBe(scope.mapMunicipalities.length);
    }
    expect(JSON.stringify(original)).toBe(before);
  });

  it("keeps the official household tariff different from the revenue-per-volume proxy", () => {
    const detail = JSON.parse(readFileSync("public/data/static/municipalities/011002.json", "utf8"));
    const annual = detail.businesses.find((b: any) => b.businessKey === "17-1-000" && b.accountingType === "legal_applied").annualFinancials.find((a: any) => a.surveyYear === 2024);
    expect(annual.householdFee20m3Yen).toBe(1397);
    expect(annual.householdFee20m3Yen).not.toBe(annual.diagnosisResult.feeUnitPriceYenPerM3 * 20);
  });

  it("binds denominators to the exact published edition and rejects duplicate accounts", () => {
    const rows = [
      { municipalityCode: "a", businessKey: "17-1-000", accountingType: "legal_applied", surveyYear: 2024, prefectureName: "新潟県", expenseRecoveryRate: 90 },
      { municipalityCode: "b", businessKey: "17-4-000", accountingType: "non_legal_applied", surveyYear: 2024, prefectureName: "新潟県", expenseRecoveryRate: 80 }
    ];
    const coverage = buildRankingCoverage(rows, rows.slice(0, 1));
    expect(coverage.populationCount).toBe(2);
    expect(countRankingPopulation(coverage, new URLSearchParams({ businessType: "17/4" }))).toBe(1);
    expect(() => buildRankingCoverage(rows, [rows[1]])).toThrow(/does not match/);
    expect(() => groupRankingPopulation([rows[0], rows[0]])).toThrow(/Duplicate/);
    expect(() => buildRankingCoverage([rows[0], { ...rows[1], surveyYear: 2023 }], [rows[0]])).toThrow(/Mixed/);
  });
});
