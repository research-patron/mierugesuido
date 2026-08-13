import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("withdrawn transfer fields in static publication", () => {
  it("omits the withdrawn fields, evidence, and derived risk score from municipality detail", () => {
    const detail = JSON.parse(readFileSync(
      path.join(root, "public/data/static/municipalities/151009.json"),
      "utf8"
    ));
    const business = detail.businesses.find((item: any) =>
      item.businessKey === "17-1-000" && item.accountingType === "legal_applied"
    );
    const annual = business.annualFinancials.find((item: any) => item.surveyYear === 2024);

    expect(Object.hasOwn(annual, "generalAccountTransfer")).toBe(false);
    for (const field of [
      "nonStandardTransfer",
      "table40RainwaterBurden",
      "table40OtherAccountSubsidy",
      "table40CapitalOtherAccountSubsidy",
      "table40RainwaterBurdenNonStandard",
      "table40OtherAccountSubsidyNonStandard",
      "table40CapitalOtherAccountSubsidyNonStandard"
    ]) {
      expect(Object.hasOwn(annual, field)).toBe(false);
      expect(business.evidenceEntries.some(([evidenceField]: [string]) => evidenceField === field)).toBe(false);
    }
    expect(Object.hasOwn(annual.diagnosisResult, "revisionRiskScore")).toBe(false);
    expect(Object.hasOwn(annual.diagnosisResult, "revisionRiskLabel")).toBe(false);
  });

  it("keeps operating coverage and expense recovery while omitting the withdrawn peer fields", () => {
    const comparison = JSON.parse(readFileSync(
      path.join(root, "public/data/static/peers/15/17-1-000.json"),
      "utf8"
    ));
    const row = comparison.rows.find((item: any) =>
      item.municipalityCode === "151009" && item.businessKey === "17-1-000"
    );

    expect(row.operatingCoverageRatio).toBeCloseTo(81.38696, 5);
    expect(row.expenseRecoveryRate).toBeCloseTo(103.9923, 4);
    expect(Object.hasOwn(row, "nonStandardTransfer")).toBe(false);
    expect(Object.hasOwn(row, "transferBasisBreakdown")).toBe(false);
    expect(comparison.summary.totals).toBeUndefined();
    expect(Object.hasOwn(comparison.summary.positiveCounts, "nonStandardTransfer")).toBe(false);
  });
});
