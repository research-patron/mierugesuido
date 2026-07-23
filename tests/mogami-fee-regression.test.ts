import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
  });
});
