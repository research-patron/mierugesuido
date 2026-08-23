import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCitizenMunicipalityAssessment } from "@/lib/citizenMunicipalityAssessment";
import type { PrefecturePeerComparisonResult } from "@/lib/prefecturePeerComparison";

const root = process.cwd();
const hokkaidoPeers = readJson<PrefecturePeerComparisonResult>(
  "public/data/static/citizen-peers/01/17-1-000.json"
);

describe("citizen diagnosis derived static data", () => {
  it("answers the Sapporo low-fee but recovery-shortfall case", () => {
    const result = buildAssessment("011002");
    expect(result.feeRank).toMatchObject({
      currentFee: 1_397,
      rank: 151,
      total: 151,
      median: 3_656,
      differenceYen: -2_259
    });
    expect(result.feeCostRelationship.kind).toBe("low_fee_low_cost");
    expect(result.recovery.band).toBe("slight_shortfall");
    expect(result.feeScenario).toMatchObject({
      status: "gap",
      householdIllustration: {
        currentFeeYen: 1_397,
        illustratedFeeYen: 1_522,
        monthlyDifferenceYen: 125
      }
    });
  });

  it("answers the Yubari high-fee and large simple-scenario case", () => {
    const result = buildAssessment("012092");
    expect(result.feeRank).toMatchObject({
      currentFee: 5_105,
      rank: 2,
      total: 151,
      median: 3_656
    });
    expect(result.feeCostRelationship.kind).toBe("high_fee_high_cost");
    expect(result.recovery.band).toBe("large_shortfall");
    expect(result.feeScenario.revenueIncreaseRatePercent).toBeCloseTo(150.009, 3);
  });

  it("keeps a recovery-at-least-100 business out of the additional-revenue scenario", () => {
    const result = buildAssessment("012041");
    expect(result.recovery.band).toBe("covered");
    expect(result.feeScenario.status).toBe("no_current_gap");
    expect(result.feeScenario.explanation).toContain("将来の値上げがないこと");
  });

  it("publishes only the diagnosis fields required by the peer UI", () => {
    const source = readFileSync(
      path.join(root, "public/data/static/citizen-peers/01/17-1-000.json"),
      "utf8"
    );
    expect(hokkaidoPeers.rows.length).toBeGreaterThan(100);
    expect(hokkaidoPeers.rows[0]).toHaveProperty("costCompositionShares");
    expect(source).not.toContain("nonStandardTransfer");
    expect(source).not.toContain("基準外繰入金");
  });
});

function buildAssessment(municipalityCode: string) {
  const detail = readJson<any>(`public/data/static/municipalities/${municipalityCode}.json`);
  const business = detail.businesses.find((candidate: any) => (
    candidate.businessKey === "17-1-000"
    && candidate.accountingType === "legal_applied"
  ));
  const annual = business?.annualFinancials.find((candidate: any) => candidate.surveyYear === 2024);
  const rows = hokkaidoPeers.rows.map((row) => ({
    ...row,
    isCurrent: row.municipalityCode === municipalityCode
  }));
  const current = rows.find((row) => row.isCurrent && row.businessKey === "17-1-000");
  if (!business || !annual || !current) throw new Error(`${municipalityCode}の代表ケースを構成できません`);
  return buildCitizenMunicipalityAssessment({
    r6DataAvailability: { status: "available", sourceSurveyYear: 2024, reason: null },
    householdFee20m3Applicability: "applicable",
    peerRows: rows,
    currentComparisonUnitKey: current.comparisonUnitKey,
    householdFee20m3Yen: annual.householdFee20m3Yen,
    treatmentCostYenPerM3: annual.diagnosisResult?.treatmentCostYenPerM3,
    expenseRecoveryRate: annual.diagnosisResult?.expenseRecoveryRate,
    sewerFeeRevenue: annual.sewerFeeRevenue,
    wastewaterTreatmentCost: annual.wastewaterTreatmentCost,
    annuals: business.annualFinancials.map((item: any) => ({
      surveyYear: item.surveyYear,
      annualBillableVolume: item.annualBillableVolume,
      bondBalance: item.bondBalance
    }))
  });
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}
