import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const home = JSON.parse(readFileSync(path.join(process.cwd(), "data/static/home.json"), "utf8"));
const revisions = JSON.parse(readFileSync(path.join(process.cwd(), "data/static/revisions.json"), "utf8"));

describe("R6 national map scopes and R5-R6 fee revision evidence", () => {
  it("keeps public and special-environment records out of each other's map averages", () => {
    expect(home.defaultMapScope).toBe("public");
    expect(home.mapScopes.public.mapMunicipalities).not.toHaveLength(0);
    expect(home.mapScopes.tokkan.mapMunicipalities).not.toHaveLength(0);
    expect(home.mapScopes.public.mapMunicipalities.every((item: any) => item.businessKey.startsWith("17-1-"))).toBe(true);
    expect(home.mapScopes.tokkan.mapMunicipalities.every((item: any) => item.businessKey.startsWith("17-4-"))).toBe(true);

    for (const scope of [home.mapScopes.public, home.mapScopes.tokkan]) {
      for (const summary of scope.prefectureSummaries) {
        const values = scope.mapMunicipalities
          .filter((item: any) => item.prefectureName === summary.prefectureName)
          .map((item: any) => item.expenseRecoveryRate)
          .filter((value: unknown): value is number => typeof value === "number" && Number.isFinite(value));
        const expected = values.reduce((sum: number, value: number) => sum + value, 0) / values.length;
        expect(summary.averageExpenseRecoveryRate).toBeCloseTo(expected, 10);
      }
    }
  });

  it("does not collapse the public map into a nationwide red state", () => {
    const averages = home.mapScopes.public.prefectureSummaries.map((item: any) => item.averageExpenseRecoveryRate);
    expect(averages.filter((value: number) => value >= 100).length).toBeGreaterThan(0);
    expect(averages.filter((value: number) => value >= 80).length).toBeGreaterThan(30);
    expect(averages.filter((value: number) => value < 80).length).toBeLessThan(20);
  });

  it("publishes the fixed Table 33 evidence stages without treating the 20m³ difference as the revision test", () => {
    const comparison = revisions.yearbookFeeComparison;
    expect(comparison.counts).toEqual({
      common: { businessCount: 1926, municipalityCount: 1450 },
      comparable: { businessCount: 1887, municipalityCount: 1424 },
      dateChanged: { businessCount: 138, municipalityCount: 109 },
      currentYear: { businessCount: 101, municipalityCount: 77 },
      supported: { businessCount: 100, municipalityCount: 77 },
      candidate: { businessCount: 38, municipalityCount: 33 },
      amountOnly: { businessCount: 179, municipalityCount: 161 }
    });
    expect(comparison.items).toHaveLength(317);
    expect(home.yearbookFeeChangeSummary.counts.supported).toEqual(comparison.counts.supported);
    expect(comparison.items.filter((item: any) => item.status === "reported_revision")).toHaveLength(100);
    expect(comparison.items.filter((item: any) => item.status === "revision_candidate")).toHaveLength(38);
    expect(comparison.items.filter((item: any) => item.status === "amount_difference_only")).toHaveLength(179);
    expect(comparison.items.every((item: any) => !("feeUnitPrice" in item))).toBe(true);
    expect(comparison.sourceLabel).toContain("第33表");
    expect(comparison.sourcePageUrls.r5).toContain("e-stat.go.jp/stat-search/files");
    expect(comparison.sourcePageUrls.r6).toContain("e-stat.go.jp/stat-search/files");

    const chiba = comparison.items.find((item: any) => (
      item.operatorName === "千葉市" && item.categoryCode === "17/1"
    ));
    expect(chiba).toMatchObject({
      status: "reported_revision",
      currentUsageFeeEffectiveDate: {
        r5: { iso: "2014-04-01", raw: "4260401" },
        r6: { iso: "2024-04-01", raw: "5060401" }
      },
      previousUsageFeeRevisionDate: { r6MatchesR5Current: true },
      officialRevisionRate: { household20m3Percent: 5.2, averagePercent: 5.4 },
      householdFee20m3: { r5: 2035, r6: 2140, delta: 105 }
    });
    expect(chiba.householdFee20m3.changeRate * 100).toBeCloseTo(5.2, 1);

    const shiriuchi = comparison.items.find((item: any) => (
      item.operatorName === "知内町" && item.categoryCode === "17/4"
    ));
    expect(shiriuchi).toMatchObject({
      status: "reported_revision",
      officialRevisionRate: { household20m3Percent: 26, averagePercent: 26 },
      householdFee20m3: { r5: 2685, r6: 3300, delta: 615 }
    });
    expect(shiriuchi.householdFee20m3.changeRate * 100).toBeCloseTo(22.9, 1);
    expect(shiriuchi.householdFee20m3.changeRate * 100).not.toBe(26);
  });
});
