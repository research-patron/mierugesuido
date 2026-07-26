import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  compareOfficialValue,
  resolveOfficialRowReference,
  resolvePublishedCalculationReference
} from "@/lib/yearbookEvidence";

describe("最上町R6の料金表と事業全体の費用回収", () => {
  it("keeps the official tariff and annual business figures separate", () => {
    const municipality = JSON.parse(readFileSync("public/data/static/municipalities/063622.json", "utf8"));
    const business = municipality.businesses.find((candidate: any) => (
      candidate.businessKey === "17-1-000" && candidate.accountingType === "legal_applied"
    ));
    const annual = business.annualFinancials.find((candidate: any) => candidate.surveyYear === 2024);

    expect(annual).toMatchObject({
      householdFee20m3Yen: 2910,
      sewerFeeRevenue: 32688,
      wastewaterTreatmentCost: 70477
    });
    expect(annual.wastewaterTreatmentCost - annual.sewerFeeRevenue).toBe(37789);
    expect(annual.diagnosisResult.expenseRecoveryRate).toBe(46.3811);
    expect(annual.diagnosisResult.requiredRevisionRateTo100).toBe(1.156051);
  });

  it("matches the official individual-table display values", () => {
    const yearbook = JSON.parse(readFileSync("public/data/static/yearbook/063622.json", "utf8"));
    const business = yearbook.businesses.find((candidate: any) => (
      candidate.businessKey === "17-1-000" && candidate.accountingType === "legal_applied"
    ));
    const rows = business.groups.flatMap((group: any) => group.rows);
    const tariff = rows.find((row: any) => row.labelCells.join("").includes("一般家庭用20m3／月（円）"));
    const recovery = rows.find((row: any) => row.labelCells.join("").includes("汚水処理費に対する使用料の割合"));

    expect(tariff).toMatchObject({ rowNumber: 17, valueText: "2,910" });
    expect(recovery).toMatchObject({ rowNumber: 28, valueText: "46.4" });
    expect(business.groups.flatMap((group: any) => group.rows)
      .filter((row: any) => row.kind === "data" && row.labelCells.length === 0)).toHaveLength(0);
  });

  it("links every key calculation to the exact official rows and published display values", () => {
    const yearbook = JSON.parse(readFileSync("public/data/static/yearbook/063622.json", "utf8"));
    const business = yearbook.businesses.find((candidate: any) => (
      candidate.businessKey === "17-1-000" && candidate.accountingType === "legal_applied"
    ));

    expect(resolveOfficialRowReference(business, "householdFee20m3Yen")).toMatchObject({
      groupNumber: 2,
      rowNumber: 17,
      valueText: "2,910"
    });
    expect(resolveOfficialRowReference(business, "sewerFeeRevenue")).toMatchObject({
      groupNumber: 3,
      rowNumber: 13,
      valueText: "32,688"
    });
    expect(resolveOfficialRowReference(business, "annualBillableVolume")).toMatchObject({
      groupNumber: 1,
      rowNumber: 74,
      valueText: "220,554"
    });
    expect(resolveOfficialRowReference(business, "opexComponent")).toMatchObject({
      groupNumber: 2,
      rowNumber: 69,
      valueText: "55,050"
    });
    expect(resolveOfficialRowReference(business, "capitalCostComponent")).toMatchObject({
      groupNumber: 2,
      rowNumber: 80,
      valueText: "15,427"
    });
    expect(resolveOfficialRowReference(business, "wastewaterTreatmentCost")).toMatchObject({
      groupNumber: 2,
      rowNumber: 88,
      valueText: "70,477"
    });

    const publishedRecovery = resolvePublishedCalculationReference(business, "expenseRecoveryRate");
    expect(publishedRecovery).toMatchObject({ groupNumber: 2, rowNumber: 28, valueText: "46.4" });
    expect(compareOfficialValue(32688 / 70477 * 100, publishedRecovery, 1)).toBe("exact");
  });

  it("does not expose the ambiguous general-account-transfer field for a law-applied business", () => {
    const municipality = JSON.parse(readFileSync("public/data/static/municipalities/063622.json", "utf8"));
    const business = municipality.businesses.find((candidate: any) => (
      candidate.businessKey === "17-1-000" && candidate.accountingType === "legal_applied"
    ));
    expect(business.evidenceEntries.map(([field]: [string]) => field)).not.toContain("generalAccountTransfer");
  });
});
