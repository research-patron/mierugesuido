import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("R6 table 40 static publication", () => {
  it("publishes Niigata City's exact transfer breakdown without the ambiguous legal-applied field", () => {
    const detail = JSON.parse(readFileSync(
      path.join(root, "public/data/static/municipalities/151009.json"),
      "utf8"
    ));
    const business = detail.businesses.find((item: any) =>
      item.businessKey === "17-1-000" && item.accountingType === "legal_applied"
    );
    const annual = business.annualFinancials.find((item: any) => item.surveyYear === 2024);

    expect(Object.hasOwn(annual, "generalAccountTransfer")).toBe(false);
    expect(annual).toMatchObject({
      table40RainwaterBurden: 8_961_461,
      table40OtherAccountSubsidy: 2_235_741,
      table40CapitalOtherAccountSubsidy: 2_879_067,
      table40RainwaterBurdenNonStandard: 0,
      table40OtherAccountSubsidyNonStandard: 36_466,
      table40CapitalOtherAccountSubsidyNonStandard: 160_000,
      nonStandardTransfer: 196_466
    });
  });

  it("keeps operating coverage and expense recovery separate in the generated peer model", () => {
    const comparison = JSON.parse(readFileSync(
      path.join(root, "public/data/static/peers/15/17-1-000.json"),
      "utf8"
    ));
    const row = comparison.rows.find((item: any) =>
      item.municipalityCode === "151009" && item.businessKey === "17-1-000"
    );

    expect(row.operatingCoverageRatio).toBeCloseTo(81.38696, 5);
    expect(row.expenseRecoveryRate).toBeCloseTo(103.9923, 4);
    expect(row.transferBasisBreakdown).toEqual({
      rainwaterBurden: { total: 8_961_461, standard: 8_961_461, nonStandard: 0 },
      otherAccountSubsidy: { total: 2_235_741, standard: 2_199_275, nonStandard: 36_466 },
      capitalOtherAccountSubsidy: { total: 2_879_067, standard: 2_719_067, nonStandard: 160_000 },
      capitalOtherAccountSubsidyNonStandard: 160_000,
      nonStandardTransferTotal: 196_466
    });
  });
});
