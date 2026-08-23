import { describe, expect, it } from "vitest";

import {
  buildCitizenMunicipalityAssessment,
  buildCitizenR6DataAvailability,
  buildCostCompositionAssessment,
  buildCostCompositionDisplay,
  buildFeeCostRelationship,
  buildFeeRankSummary,
  buildRecoveryBand,
  buildSimpleFeeScenario,
  buildSustainabilityAssessment,
  buildVolumeTrend,
  compareMetricToMedian
} from "@/lib/citizenMunicipalityAssessment";
import type { PrefecturePeerComparisonRow } from "@/lib/prefecturePeerComparison";

describe("citizen municipality assessment", () => {
  it("uses descending competition ranking and exact ties", () => {
    const rows = [
      peerRow("a", 5_000),
      peerRow("b", 4_000, { isCurrent: true }),
      peerRow("c", 4_000),
      peerRow("d", 3_000)
    ];

    expect(buildFeeRankSummary(rows)).toEqual({
      currentComparisonUnitKey: "b",
      currentFee: 4_000,
      rank: 2,
      total: 4,
      tied: true,
      tieCount: 2,
      median: 4_000,
      differenceYen: 0,
      differencePercent: 0
    });
  });

  it("deduplicates a comparison unit and reports the median gap", () => {
    const rows = [
      peerRow("a", 5_000, { isCurrent: true }),
      peerRow("b", 4_000),
      peerRow("b", 4_000),
      peerRow("c", 3_000)
    ];

    expect(buildFeeRankSummary(rows)).toMatchObject({
      rank: 1,
      total: 3,
      median: 4_000,
      differenceYen: 1_000,
      differencePercent: 25
    });
  });

  it("does not invent a rank for excluded or missing-fee rows", () => {
    expect(buildFeeRankSummary([
      peerRow("a", null, { isCurrent: true })
    ])).toBeNull();
    expect(buildFeeRankSummary([
      peerRow("a", 3_000, {
        isCurrent: true,
        eligible: false,
        exclusionReason: { code: "legal_applied_not_found", label: "法適用事業なし" }
      })
    ])).toBeNull();
  });

  it("treats exactly plus or minus ten percent as the same range", () => {
    expect(compareMetricToMedian(110, [100])).toMatchObject({
      position: "similar",
      differencePercent: 10
    });
    expect(compareMetricToMedian(90, [100])).toMatchObject({
      position: "similar",
      differencePercent: -10
    });
    expect(compareMetricToMedian(110.01, [100]).position).toBe("higher");
    expect(compareMetricToMedian(89.99, [100]).position).toBe("lower");
  });

  it.each([
    [130, 130, "high_fee_high_cost"],
    [130, 100, "high_fee_cost_not_high"],
    [100, 130, "fee_not_high_high_cost"],
    [70, 70, "low_fee_low_cost"]
  ] as const)("explains fee %s and cost %s without a causal claim", (fee, cost, kind) => {
    const result = buildFeeCostRelationship({
      currentHouseholdFee20m3Yen: fee,
      peerHouseholdFees: [100],
      currentTreatmentCostYenPerM3: cost,
      peerTreatmentCostsYenPerM3: [100]
    });

    expect(result.kind).toBe(kind);
    expect(result.explanation).not.toContain("原因です");
  });

  it("requires both R2 and R6 for the five-year volume trend", () => {
    expect(buildVolumeTrend([
      { surveyYear: 2020, annualBillableVolume: 100 },
      { surveyYear: 2024, annualBillableVolume: 95 }
    ])).toMatchObject({ kind: "stable", changePercent: -5 });
    expect(buildVolumeTrend([
      { surveyYear: 2020, annualBillableVolume: 100 },
      { surveyYear: 2024, annualBillableVolume: 94.9 }
    ]).kind).toBe("decreasing");
    expect(buildVolumeTrend([
      { surveyYear: 2020, annualBillableVolume: 100 },
      { surveyYear: 2024, annualBillableVolume: 105 }
    ]).kind).toBe("stable");
    expect(buildVolumeTrend([
      { surveyYear: 2024, annualBillableVolume: 105 }
    ]).kind).toBe("unavailable");
  });

  it("uses the four explicit recovery bands", () => {
    expect(buildRecoveryBand(100).band).toBe("covered");
    expect(buildRecoveryBand(99.9).band).toBe("slight_shortfall");
    expect(buildRecoveryBand(90).band).toBe("slight_shortfall");
    expect(buildRecoveryBand(89.9).band).toBe("attention");
    expect(buildRecoveryBand(80).band).toBe("attention");
    expect(buildRecoveryBand(79.9).band).toBe("large_shortfall");
    expect(buildRecoveryBand(null).band).toBe("unavailable");
  });

  it("reports top costs and at most two items five points above peer medians", () => {
    const result = buildCostCompositionAssessment({
      total: 100,
      items: [
        { id: "a", label: "A", value: 45 },
        { id: "b", label: "B", value: 35 },
        { id: "c", label: "C", value: 20 }
      ]
    }, [
      peerRow("a", 3_000, { costCompositionShares: shares({ a: 40, b: 25, c: 10 }) }),
      peerRow("b", 4_000, { costCompositionShares: shares({ a: 40, b: 25, c: 10 }) })
    ]);

    expect(result.state).toBe("ready");
    expect(result.topItems.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(result.abovePeerMedianItems).toHaveLength(2);
    expect(result.abovePeerMedianItems.map((item) => [item.id, item.differencePoints])).toEqual([
      ["b", 10],
      ["c", 10]
    ]);
  });

  it("keeps Yubari-style top costs visible and adds non-duplicate peer outliers", () => {
    const depreciation = costInsight("depreciation", "減価償却費", 45, 12);
    const outsourcing = costInsight("outsourcing", "委託料", 30, null);
    const personnel = costInsight("personnel", "職員給与費", 15, 7);
    const interest = costInsight("interest", "支払利息", 10, 9);
    const display = buildCostCompositionDisplay({
      topItems: [depreciation, outsourcing, personnel],
      abovePeerMedianItems: [depreciation, interest]
    });

    expect(display.topItems.map((item) => item.id)).toEqual([
      "depreciation",
      "outsourcing",
      "personnel"
    ]);
    expect(display.additionalAbovePeerMedianItems.map((item) => item.id)).toEqual(["interest"]);
  });

  it("prioritizes fund shortage, recovery and volume without an opaque score", () => {
    const result = buildSustainabilityAssessment({
      fundShortage: { status: "shortage", ratioPercent: 20, fiscalYearLabel: "R6" },
      recovery: buildRecoveryBand(79),
      volumeTrend: buildVolumeTrend([
        { surveyYear: 2020, annualBillableVolume: 100 },
        { surveyYear: 2024, annualBillableVolume: 80 }
      ]),
      finance: {
        netIncome: -1,
        currentNetAssets: 90,
        priorNetAssets: 100
      }
    });

    expect(result.headline).toContain("基準以上");
    expect(result.reasons.map((reason) => reason.category)).toEqual([
      "fund_shortage",
      "expense_recovery",
      "billable_volume"
    ]);
    expect(result.reasons[0].detail).toContain("20%以上");
    expect(JSON.stringify(result)).not.toContain("自動的に起債");
    expect(result).not.toHaveProperty("score");
  });

  it("keeps a positive-list 0.0 percent row as shortage and does not call no-shortage safe", () => {
    const shortage = buildSustainabilityAssessment({
      fundShortage: { status: "shortage", ratioPercent: 0, fiscalYearLabel: "R6" },
      recovery: buildRecoveryBand(null),
      volumeTrend: buildVolumeTrend([])
    });
    expect(shortage.reasons[0]).toMatchObject({
      category: "fund_shortage",
      direction: "pressure",
      title: "資金不足額あり"
    });

    const noShortage = buildSustainabilityAssessment({
      fundShortage: { status: "no_shortage", ratioPercent: null, fiscalYearLabel: "R6" },
      recovery: buildRecoveryBand(91),
      volumeTrend: buildVolumeTrend([])
    });
    expect(noShortage.reasons.some((reason) => reason.category === "fund_shortage")).toBe(false);
    expect(noShortage.reasons[0]).toMatchObject({ category: "expense_recovery" });
    expect(noShortage.derivedConclusion).not.toContain("資金不足");
    expect(JSON.stringify(noShortage)).not.toContain("安全");
  });

  it("falls through to finance evidence when higher-priority evidence is unavailable", () => {
    const result = buildSustainabilityAssessment({
      fundShortage: { status: "unavailable", ratioPercent: null, fiscalYearLabel: "R6" },
      recovery: buildRecoveryBand(null),
      volumeTrend: buildVolumeTrend([]),
      finance: {
        netIncome: -20,
        currentNetAssets: 80,
        priorNetAssets: 100,
        bondBalances: [
          { surveyYear: 2020, value: 100 },
          { surveyYear: 2024, value: 120 }
        ]
      }
    });
    expect(result.reasons.map((reason) => reason.category)).toEqual([
      "financial_result",
      "net_assets",
      "bond_balance"
    ]);
    expect(result.limitations[0]).toContain("会計単位の照合");
  });

  it("builds the businesswide gap and optional uniform household illustration", () => {
    const result = buildSimpleFeeScenario({
      currentHouseholdFee20m3Yen: 3_000,
      sewerFeeRevenue: 40,
      wastewaterTreatmentCost: 100
    });
    expect(result).toMatchObject({
      status: "gap",
      revenueIncreaseRatePercent: 150,
      householdIllustration: {
        currentFeeYen: 3_000,
        illustratedFeeYen: 7_500,
        monthlyDifferenceYen: 4_500
      }
    });
    expect(result.caveat).toContain("予測");
    expect(result.householdIllustration?.assumption).toContain("すべての料金区分");
  });

  it("does not imply no future increase when R6 recovery is at least 100 percent", () => {
    const result = buildSimpleFeeScenario({
      currentHouseholdFee20m3Yen: 3_000,
      sewerFeeRevenue: 100,
      wastewaterTreatmentCost: 80
    });
    expect(result).toMatchObject({ status: "no_current_gap", revenueIncreaseRatePercent: 0 });
    expect(result.explanation).toContain("将来の値上げがないこと");
  });

  it("returns unavailable instead of infinity when revenue is zero", () => {
    expect(buildSimpleFeeScenario({
      currentHouseholdFee20m3Yen: 3_000,
      sewerFeeRevenue: 0,
      wastewaterTreatmentCost: 80
    })).toMatchObject({
      status: "unavailable",
      revenueIncreaseRatePercent: null,
      householdIllustration: null
    });
  });

  it("assembles the public assessment from explicit evidence inputs", () => {
    const peerRows = [
      peerRow("current", 3_000, {
        isCurrent: true,
        treatmentCostYenPerM3: 150,
        expenseRecoveryRate: 80
      }),
      peerRow("peer", 2_000, { treatmentCostYenPerM3: 100 })
    ];
    const result = buildCitizenMunicipalityAssessment({
      r6DataAvailability: buildCitizenR6DataAvailability(2024, "R6"),
      householdFee20m3Applicability: "applicable",
      peerRows,
      sewerFeeRevenue: 80,
      wastewaterTreatmentCost: 100,
      annuals: [
        { surveyYear: 2020, annualBillableVolume: 100 },
        { surveyYear: 2024, annualBillableVolume: 90 }
      ],
      fundShortage: { status: "no_shortage", ratioPercent: null, fiscalYearLabel: "R6" }
    });

    expect(result.feeRank).toMatchObject({ rank: 1, total: 2, differenceYen: 500 });
    expect(result.feeCostRelationship.kind).toBe("high_fee_high_cost");
    expect(result.recovery.band).toBe("attention");
    expect(result.volumeTrend.kind).toBe("decreasing");
    expect(result.feeScenario.revenueIncreaseRatePercent).toBe(25);
    expect(result.comparisonBasis.scopeLabel).toContain("法適用");
  });

  it("美郷町型: does not compare fee or treatment cost when the selected peer row is ineligible", () => {
    const result = buildCitizenMunicipalityAssessment({
      r6DataAvailability: buildCitizenR6DataAvailability(2024, "R6"),
      householdFee20m3Applicability: "applicable",
      peerRows: [
        peerRow("current", 4_000, {
          isCurrent: true,
          eligible: false,
          treatmentCostYenPerM3: 300,
          exclusionReason: {
            code: "legal_applied_not_found",
            label: "市町村単独の法適用公共下水道・特環決算なし"
          }
        }),
        peerRow("peer", 2_000, { treatmentCostYenPerM3: 100 })
      ],
      householdFee20m3Yen: 4_000,
      treatmentCostYenPerM3: 300
    });

    expect(result.feeRank).toBeNull();
    expect(result.feeCostRelationship).toMatchObject({
      kind: "unavailable",
      fee: { current: 4_000, median: null },
      treatmentCost: { current: 300, median: null }
    });
    expect(result.feeCostRelationship.explanation).toContain("法適用の比較対象事業の中央値と料金・原価を比較しません");
  });

  it("does not substitute an older latest annual into the R6 assessment", () => {
    const r6DataAvailability = buildCitizenR6DataAvailability(2023, "R5");
    const result = buildCitizenMunicipalityAssessment({
      r6DataAvailability,
      householdFee20m3Applicability: "applicable",
      peerRows: [peerRow("current", 4_000, { isCurrent: true, treatmentCostYenPerM3: 300 })],
      householdFee20m3Yen: 4_000,
      treatmentCostYenPerM3: 300,
      expenseRecoveryRate: 75,
      sewerFeeRevenue: 75,
      wastewaterTreatmentCost: 100,
      annuals: [
        { surveyYear: 2020, annualBillableVolume: 100 },
        { surveyYear: 2024, annualBillableVolume: 80 }
      ]
    });

    expect(result.r6DataAvailability).toEqual(r6DataAvailability);
    expect(result.r6DataAvailability.reason).toContain("R5の値をR6診断に代用していません");
    expect(result.feeRank).toBeNull();
    expect(result.feeCostRelationship.fee.current).toBeNull();
    expect(result.feeCostRelationship.treatmentCost.current).toBeNull();
    expect(result.recovery.band).toBe("unavailable");
    expect(result.volumeTrend.kind).toBe("unavailable");
    expect(result.feeScenario.status).toBe("unavailable");
  });

  it("北上市17-2型: never restores a household 20m3 fee from peers when that tariff is not applicable", () => {
    const result = buildCitizenMunicipalityAssessment({
      r6DataAvailability: buildCitizenR6DataAvailability(2024, "R6"),
      householdFee20m3Applicability: "not_applicable",
      peerRows: [peerRow("current", 9_999, { isCurrent: true })],
      householdFee20m3Yen: null,
      sewerFeeRevenue: 80,
      wastewaterTreatmentCost: 100
    });

    expect(result.householdFee20m3Applicability).toBe("not_applicable");
    expect(result.feeRank).toBeNull();
    expect(result.feeCostRelationship.fee.current).toBeNull();
    expect(result.feeRankUnavailableReason).toContain("特定公共下水道");
    expect(result.feeScenario).toMatchObject({
      status: "gap",
      householdIllustration: null
    });
  });
});

function shares(values: Record<string, number>) {
  return Object.entries(values).map(([id, sharePercent]) => ({
    id: id as PrefecturePeerComparisonRow["costCompositionShares"][number]["id"],
    label: id.toUpperCase(),
    sharePercent
  }));
}

function costInsight(
  id: string,
  label: string,
  sharePercent: number,
  differencePoints: number | null
) {
  return {
    id,
    label,
    sharePercent,
    peerMedianPercent: differencePoints == null ? null : sharePercent - differencePoints,
    differencePoints
  };
}

function peerRow(
  comparisonUnitKey: string,
  householdFee20m3Yen: number | null,
  overrides: Partial<PrefecturePeerComparisonRow> = {}
): PrefecturePeerComparisonRow {
  return {
    municipalityCode: comparisonUnitKey,
    municipalityName: `${comparisonUnitKey}市`,
    representedMunicipalityCodes: [comparisonUnitKey],
    representedMunicipalityNames: [`${comparisonUnitKey}市`],
    representedMunicipalityCount: 1,
    prefectureName: "テスト県",
    businessKey: "17-1-000",
    businessName: "公共下水道",
    businessType: "公共下水道",
    accountingType: "legal_applied",
    comparisonUnitKey,
    detailMunicipalityCode: comparisonUnitKey,
    isJointOperation: false,
    operatorMunicipalityCode: null,
    operatorMunicipalityName: null,
    jointOperationSourceUrl: null,
    jointOperationSourceLabel: null,
    isCurrent: false,
    eligible: true,
    exclusionReason: null,
    householdFee20m3Yen,
    feeUnitPriceYenPerM3: 100,
    treatmentCostYenPerM3: 100,
    annualBillableVolume: 100,
    wastewaterTreatmentCost: 100,
    costCompositionShares: [],
    expenseRecoveryRate: 100,
    operatingRevenue: 100,
    operatingExpense: 100,
    operatingLoss: 0,
    operatingCoverageRatio: 100,
    servicePopulation: 100,
    connectedPopulation: 100,
    ...overrides
  };
}
