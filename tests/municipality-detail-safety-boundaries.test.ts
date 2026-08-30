import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  bindPeerComparisonToSelectedBusiness,
  jointOperationHref
} from "@/components/MunicipalityDetailClient";
import type {
  PrefecturePeerComparisonResult,
  PrefecturePeerComparisonRow
} from "@/lib/prefecturePeerComparison";

const root = process.cwd();
const detailSource = readFileSync(
  path.join(root, "components/MunicipalityDetailClient.tsx"),
  "utf8"
);
const routeSource = readFileSync(
  path.join(root, "app/municipalities/[municipalityCode]/page.tsx"),
  "utf8"
);
const assessmentPanelSource = readFileSync(
  path.join(root, "components/municipality-detail/CitizenAssessmentPanel.tsx"),
  "utf8"
);
const feeAnalysisPanelSource = readFileSync(
  path.join(root, "components/municipality-detail/FeeLevelAnalysisPanel.tsx"),
  "utf8"
);

describe("municipality detail safety boundaries", () => {
  it("treats the peer comparison as unavailable when no row exactly matches the selected business", () => {
    const model = peerModel([
      peerRow({
        businessKey: "17-4-000",
        comparisonUnitKey: "012345:17-4-000",
        isCurrent: true
      })
    ]);

    expect(bindPeerComparisonToSelectedBusiness({
      model,
      municipalityCode: "012345",
      businessKey: "17-1-000",
      currentFundingContext: emptyFundingContext
    })).toBeNull();
    expect(detailSource).toContain("peerComparison: selectedPeerComparison");
  });

  it("marks only the exact selected-business row current and clears a stale current marker", () => {
    const model = peerModel([
      peerRow({
        businessKey: "17-4-000",
        comparisonUnitKey: "012345:17-4-000",
        isCurrent: true
      }),
      peerRow({
        businessKey: "17-1-000",
        comparisonUnitKey: "012345:17-1-000",
        isCurrent: false
      })
    ]);

    const adopted = bindPeerComparisonToSelectedBusiness({
      model,
      municipalityCode: "012345",
      businessKey: "17-1-000",
      currentFundingContext: {
        operatingRevenue: 80,
        operatingExpense: 100,
        operatingLoss: 20
      }
    });

    expect(adopted?.rows.map((row) => [row.businessKey, row.isCurrent])).toEqual([
      ["17-4-000", false],
      ["17-1-000", true]
    ]);
    expect(adopted?.rows[1]).toMatchObject({
      operatingRevenue: 80,
      operatingExpense: 100,
      operatingLoss: 20
    });
  });

  it("creates a joint-operation link only when the operator has a generated static detail", () => {
    expect(jointOperationHref("069663", "17-1-000", ["062120", "063410"])).toBeNull();
    expect(jointOperationHref("069663", "17-1-000", ["069663"])).toBe(
      "/municipalities/069663?business=17-1-000&view=fees"
    );
    expect(routeSource).toContain("staticMunicipalityCodes.has(operatorCode)");
    expect(detailSource).toContain("組合全体の料金指標は、当サイトでは未掲載です");
  });

  it("connects R6 and household-fee availability to explicit citizen-facing states", () => {
    expect(detailSource).toContain("buildCitizenR6DataAvailability(latest.surveyYear, fiscal)");
    expect(detailSource).toContain('categoryCode === "17/2" ? "not_applicable" : "applicable"');
    expect(assessmentPanelSource).toContain("R6診断に必要な決算が揃っていません");
    expect(assessmentPanelSource).toContain('householdFeeNotApplicable ? "対象外"');
  });

  it("always keeps top cost items and adds only non-duplicate peer outliers", () => {
    expect(feeAnalysisPanelSource).toContain("buildCostCompositionDisplay(assessment.costComposition)");
    expect(feeAnalysisPanelSource).toContain("主な費目：");
    expect(feeAnalysisPanelSource).toContain("中央値を5ポイント以上上回るほかの費目");
    expect(assessmentPanelSource).not.toContain("buildCostCompositionDisplay(assessment.costComposition)");
  });
});

const emptyFundingContext = {
  operatingRevenue: null,
  operatingExpense: null,
  operatingLoss: null
};

function peerModel(rows: PrefecturePeerComparisonRow[]): PrefecturePeerComparisonResult {
  return {
    prefectureCode: "01",
    prefectureName: "テスト道",
    businessKey: "17-1-000",
    currentMunicipalityCode: "012345",
    surveyYear: 2024,
    fiscalLabel: "R6",
    rows,
    summary: {
      totalMunicipalities: rows.length,
      eligibleMunicipalities: rows.length,
      eligibleComparisonUnits: rows.length,
      excludedMunicipalities: 0,
      exclusionCounts: {
        flow_sewer_excluded: 0,
        outside_public_sewer_comparison_scope: 0,
        same_business_not_found: 0,
        legal_applied_not_found: 0,
        r6_data_not_found: 0
      },
      averages: { operatingCoverageRatio: null },
      positiveCounts: {
        expenseRecoveryAtLeast100: 0,
        operatingCoverageBelow100: 0,
        highRecoveryButOperatingCoverageBelow100: 0
      },
      missingCounts: {
        expenseRecoveryRate: 0,
        operatingCoverageRatio: 0
      }
    }
  };
}

function peerRow(overrides: Partial<PrefecturePeerComparisonRow>): PrefecturePeerComparisonRow {
  return {
    municipalityCode: "012345",
    municipalityName: "テスト市",
    representedMunicipalityCodes: ["012345"],
    representedMunicipalityNames: ["テスト市"],
    representedMunicipalityCount: 1,
    prefectureName: "テスト道",
    businessKey: "17-1-000",
    businessName: "公共下水道",
    businessType: "公共下水道",
    accountingType: "legal_applied",
    comparisonUnitKey: "012345:17-1-000",
    detailMunicipalityCode: "012345",
    isJointOperation: false,
    operatorMunicipalityCode: null,
    operatorMunicipalityName: null,
    jointOperationSourceUrl: null,
    jointOperationSourceLabel: null,
    isCurrent: false,
    eligible: true,
    exclusionReason: null,
    householdFee20m3Yen: 3_000,
    feeUnitPriceYenPerM3: 150,
    treatmentCostYenPerM3: 180,
    annualBillableVolume: 1_000,
    wastewaterTreatmentCost: 180_000,
    costCompositionShares: [],
    expenseRecoveryRate: 83.3,
    operatingRevenue: null,
    operatingExpense: null,
    operatingLoss: null,
    operatingCoverageRatio: null,
    servicePopulation: null,
    connectedPopulation: null,
    ...overrides
  };
}
