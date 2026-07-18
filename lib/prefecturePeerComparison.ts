export const PREFECTURE_PEER_COMPARISON_SURVEY_YEAR = 2024 as const;
export const OPERATING_COVERAGE_CRITICAL_THRESHOLD = 50 as const;

export const PREFECTURE_PEER_PUBLIC_SEWER_BUSINESS_KEY = "17-1-000" as const;
export const PREFECTURE_PEER_TOKKAN_BUSINESS_KEY = "17-4-000" as const;

const PUBLIC_SEWER_COMPARISON_FAMILY = [
  PREFECTURE_PEER_PUBLIC_SEWER_BUSINESS_KEY,
  PREFECTURE_PEER_TOKKAN_BUSINESS_KEY
] as const;

export type PrefecturePeerComparisonSurveyYear = typeof PREFECTURE_PEER_COMPARISON_SURVEY_YEAR;

export type PrefecturePeerExclusionCode =
  | "flow_sewer_excluded"
  | "same_business_not_found"
  | "legal_applied_not_found"
  | "r6_data_not_found";

export type PrefecturePeerExclusionReason = {
  code: PrefecturePeerExclusionCode;
  label: string;
};

export type PrefecturePeerFinancialStatementItemInput = {
  itemCode: string;
  amount: number;
};

export type PrefecturePeerAnnualInput = {
  surveyYear: number;
  fiscalYearLabel?: string | null;
  accountingType: string;
  householdFee20m3Yen?: number | null;
  nonStandardTransfer?: number | null;
  servicePopulation?: number | null;
  connectedPopulation?: number | null;
  diagnosisResult?: {
    expenseRecoveryRate?: number | null;
  } | null;
  financialStatementItems: PrefecturePeerFinancialStatementItemInput[];
};

export type PrefecturePeerBusinessInput = {
  businessKey: string;
  businessName?: string | null;
  businessType?: string | null;
  accountingType: string;
  annualFinancials: PrefecturePeerAnnualInput[];
};

export type PrefecturePeerMunicipalityInput = {
  municipalityCode?: string | null;
  prefectureCode?: string | null;
  prefectureName: string;
  municipalityName: string;
  businesses: PrefecturePeerBusinessInput[];
};

export type PrefecturePeerJointOperationInput = {
  operatorMunicipalityCode: string;
  operatorMunicipalityName: string;
  businessKey: string;
  servedMunicipalities: Array<{
    municipalityCode: string;
    municipalityName: string;
  }>;
  businesses: PrefecturePeerBusinessInput[];
  sourceUrl: string;
  sourceLabel: string;
};

export type PrefecturePeerComparisonRow = {
  municipalityCode: string;
  municipalityName: string;
  representedMunicipalityCodes: string[];
  representedMunicipalityNames: string[];
  representedMunicipalityCount: number;
  prefectureName: string;
  businessKey: string;
  businessName: string | null;
  businessType: string | null;
  accountingType: string | null;
  comparisonUnitKey: string;
  detailMunicipalityCode: string;
  isJointOperation: boolean;
  operatorMunicipalityCode: string | null;
  operatorMunicipalityName: string | null;
  jointOperationSourceUrl: string | null;
  jointOperationSourceLabel: string | null;
  isCurrent: boolean;
  eligible: boolean;
  exclusionReason: PrefecturePeerExclusionReason | null;
  householdFee20m3Yen: number | null;
  expenseRecoveryRate: number | null;
  operatingRevenue: number | null;
  operatingExpense: number | null;
  operatingCoverageRatio: number | null;
  nonStandardTransfer: number | null;
  servicePopulation: number | null;
  connectedPopulation: number | null;
};

export type PrefecturePeerComparisonSummary = {
  totalMunicipalities: number;
  eligibleMunicipalities: number;
  eligibleComparisonUnits: number;
  excludedMunicipalities: number;
  exclusionCounts: Record<PrefecturePeerExclusionCode, number>;
  averages: {
    operatingCoverageRatio: number | null;
  };
  totals: {
    nonStandardTransfer: number | null;
  };
  positiveCounts: {
    expenseRecoveryAtLeast100: number;
    operatingCoverageBelow100: number;
    highRecoveryButOperatingCoverageBelow100: number;
    nonStandardTransfer: number;
  };
  missingCounts: {
    expenseRecoveryRate: number;
    operatingCoverageRatio: number;
  };
};

export type PrefecturePeerComparisonResult = {
  prefectureCode: string | null;
  prefectureName: string;
  businessKey: string;
  currentMunicipalityCode: string | null;
  surveyYear: PrefecturePeerComparisonSurveyYear;
  fiscalLabel: "R6";
  rows: PrefecturePeerComparisonRow[];
  summary: PrefecturePeerComparisonSummary;
};

export type BuildPrefecturePeerComparisonParams = {
  prefectureCode?: string | null;
  prefectureName: string;
  businessKey: string;
  currentMunicipalityCode?: string | null;
  surveyYear?: PrefecturePeerComparisonSurveyYear;
  municipalities: PrefecturePeerMunicipalityInput[];
  jointOperations?: PrefecturePeerJointOperationInput[];
};

export function operatingCoverageDisplayValue(value: number) {
  return Number(value.toFixed(1));
}

export function isOperatingCoverageCritical(value: number | null | undefined) {
  return value != null
    && Number.isFinite(value)
    && value < OPERATING_COVERAGE_CRITICAL_THRESHOLD;
}

const EXCLUSION_LABELS: Record<PrefecturePeerExclusionCode, string> = {
  flow_sewer_excluded: "流域下水道は市町村比較の対象外",
  same_business_not_found: "同じ事業種別なし",
  legal_applied_not_found: "同種の法適用事業なし",
  r6_data_not_found: "同種法適用事業のR6決算なし"
};

const PUBLIC_SEWER_FAMILY_EXCLUSION_LABELS: Partial<Record<PrefecturePeerExclusionCode, string>> = {
  same_business_not_found: "市町村単独の公共下水道・特環決算なし",
  legal_applied_not_found: "市町村単独の法適用公共下水道・特環決算なし",
  r6_data_not_found: "市町村単独の法適用公共下水道・特環のR6決算なし"
};

const INCOME_ITEM_CODES = {
  operatingRevenue: "operating_revenue",
  operatingExpense: "operating_expense"
} as const;

export const PREFECTURE_PEER_INCOME_ITEM_CODES = Object.freeze(Object.values(INCOME_ITEM_CODES));

/**
 * Returns the business keys that can be compared for the selected business.
 * Public sewerage and tokkan are treated as one comparison family; every other
 * business type continues to require an exact business-key match.
 */
export function getPrefecturePeerBusinessKeys(businessKey: string): string[] {
  if (!isPublicSewerComparisonFamilyKey(businessKey)) return [businessKey];
  return [
    businessKey,
    ...PUBLIC_SEWER_COMPARISON_FAMILY.filter((familyKey) => familyKey !== businessKey)
  ];
}

export function buildPrefecturePeerComparison({
  prefectureCode = null,
  prefectureName,
  businessKey,
  currentMunicipalityCode = null,
  surveyYear = PREFECTURE_PEER_COMPARISON_SURVEY_YEAR,
  municipalities,
  jointOperations = []
}: BuildPrefecturePeerComparisonParams): PrefecturePeerComparisonResult {
  assertR6(surveyYear);
  const flowSewerSelected = isFlowSewerBusinessKey(businessKey);
  const comparisonBusinessKeys = getPrefecturePeerBusinessKeys(businessKey);
  const municipalityInputs = municipalities
    .filter((municipality) => isMunicipalityName(municipality.municipalityName));
  const municipalityByCode = new Map(municipalityInputs.map((municipality) => [
    municipality.municipalityCode ?? "",
    municipality
  ]));
  const claimedMunicipalityCodes = new Set<string>();
  const jointRows = selectPreferredJointOperations(jointOperations, comparisonBusinessKeys, surveyYear)
    .flatMap((operation) => {
      const representedMunicipalities = operation.servedMunicipalities
        .filter((served) => {
          const municipality = municipalityByCode.get(served.municipalityCode);
          if (!municipality || claimedMunicipalityCodes.has(served.municipalityCode)) return false;
          return !municipality.businesses.some((candidate) => comparisonBusinessKeys.includes(candidate.businessKey));
        })
        .sort((a, b) => a.municipalityCode.localeCompare(b.municipalityCode, "ja"));
      if (representedMunicipalities.length === 0) return [];
      representedMunicipalities.forEach((served) => claimedMunicipalityCodes.add(served.municipalityCode));
      return [buildJointRow({
        operation,
        representedMunicipalities,
        prefectureName,
        currentMunicipalityCode,
        surveyYear,
        flowSewerSelected
      })];
    });
  const rows = municipalityInputs
    .filter((municipality) => !claimedMunicipalityCodes.has(municipality.municipalityCode ?? ""))
    .map((municipality) => buildRow({
      municipality,
      businessKey,
      currentMunicipalityCode,
      surveyYear,
      flowSewerSelected
    }))
    .concat(jointRows)
    .sort(compareMunicipalityCode);
  const summary = buildSummary(rows);

  return {
    prefectureCode,
    prefectureName,
    businessKey,
    currentMunicipalityCode,
    surveyYear,
    fiscalLabel: "R6",
    rows,
    summary
  };
}

function buildJointRow({
  operation,
  representedMunicipalities,
  prefectureName,
  currentMunicipalityCode,
  surveyYear,
  flowSewerSelected
}: {
  operation: PrefecturePeerJointOperationInput;
  representedMunicipalities: PrefecturePeerJointOperationInput["servedMunicipalities"];
  prefectureName: string;
  currentMunicipalityCode: string | null;
  surveyYear: PrefecturePeerComparisonSurveyYear;
  flowSewerSelected: boolean;
}): PrefecturePeerComparisonRow {
  const municipalityCodes = representedMunicipalities.map((item) => item.municipalityCode);
  const municipalityNames = representedMunicipalities.map((item) => item.municipalityName);
  const row = buildRow({
    municipality: {
      municipalityCode: municipalityCodes[0] ?? operation.operatorMunicipalityCode,
      prefectureCode: operation.operatorMunicipalityCode.slice(0, 2),
      prefectureName,
      municipalityName: municipalityNames.join("・") || operation.operatorMunicipalityName,
      businesses: operation.businesses
    },
    businessKey: operation.businessKey,
    currentMunicipalityCode: null,
    surveyYear,
    flowSewerSelected
  });
  return {
    ...row,
    representedMunicipalityCodes: municipalityCodes,
    representedMunicipalityNames: municipalityNames,
    representedMunicipalityCount: representedMunicipalities.length,
    comparisonUnitKey: `${operation.operatorMunicipalityCode}:${row.businessKey}`,
    detailMunicipalityCode: operation.operatorMunicipalityCode,
    isJointOperation: true,
    operatorMunicipalityCode: operation.operatorMunicipalityCode,
    operatorMunicipalityName: operation.operatorMunicipalityName,
    jointOperationSourceUrl: operation.sourceUrl,
    jointOperationSourceLabel: operation.sourceLabel,
    isCurrent: currentMunicipalityCode === operation.operatorMunicipalityCode
      || municipalityCodes.includes(currentMunicipalityCode ?? "")
  };
}

function buildRow({
  municipality,
  businessKey,
  currentMunicipalityCode,
  surveyYear,
  flowSewerSelected
}: {
  municipality: PrefecturePeerMunicipalityInput;
  businessKey: string;
  currentMunicipalityCode: string | null;
  surveyYear: PrefecturePeerComparisonSurveyYear;
  flowSewerSelected: boolean;
}): PrefecturePeerComparisonRow {
  const municipalityCode = municipality.municipalityCode ?? "";
  const comparisonBusinessKeys = getPrefecturePeerBusinessKeys(businessKey);
  const matchingBusinesses = municipality.businesses.filter((business) =>
    comparisonBusinessKeys.includes(business.businessKey)
  );
  const matchingBusiness = preferredBusiness(matchingBusinesses, comparisonBusinessKeys, surveyYear);
  const base = {
    municipalityCode,
    municipalityName: municipality.municipalityName,
    representedMunicipalityCodes: municipalityCode ? [municipalityCode] : [],
    representedMunicipalityNames: [municipality.municipalityName],
    representedMunicipalityCount: 1,
    prefectureName: municipality.prefectureName,
    businessKey: matchingBusiness?.businessKey ?? businessKey,
    businessName: matchingBusiness?.businessName ?? null,
    businessType: matchingBusiness?.businessType ?? null,
    accountingType: matchingBusiness?.accountingType ?? null,
    comparisonUnitKey: `${municipalityCode}:${matchingBusiness?.businessKey ?? businessKey}`,
    detailMunicipalityCode: municipalityCode,
    isJointOperation: false,
    operatorMunicipalityCode: null,
    operatorMunicipalityName: null,
    jointOperationSourceUrl: null,
    jointOperationSourceLabel: null,
    isCurrent: municipalityCode !== "" && municipalityCode === currentMunicipalityCode
  };

  if (flowSewerSelected) return excludedRow(base, "flow_sewer_excluded", businessKey);
  if (matchingBusinesses.length === 0) return excludedRow(base, "same_business_not_found", businessKey);

  const legalBusinesses = matchingBusinesses.filter((business) => business.accountingType === "legal_applied");
  const legalBusiness = preferredBusiness(legalBusinesses, comparisonBusinessKeys, surveyYear);
  if (!legalBusiness) return excludedRow(base, "legal_applied_not_found", businessKey);

  const legalBusinessWithR6 = comparisonBusinessKeys
    .map((candidateKey) => legalBusinesses.find((business) =>
      business.businessKey === candidateKey && findLegalAnnual(business, surveyYear) != null
    ))
    .find((business): business is PrefecturePeerBusinessInput => business != null) ?? null;
  const adoptedBusiness = legalBusinessWithR6 ?? legalBusiness;
  const annual = findLegalAnnual(adoptedBusiness, surveyYear);
  const legalBase = {
    ...base,
    businessKey: adoptedBusiness.businessKey,
    businessName: adoptedBusiness.businessName ?? null,
    businessType: adoptedBusiness.businessType ?? null,
    accountingType: adoptedBusiness.accountingType,
    comparisonUnitKey: `${municipalityCode}:${adoptedBusiness.businessKey}`
  };
  if (!annual) return excludedRow(legalBase, "r6_data_not_found", businessKey);

  const items = new Map(annual.financialStatementItems.map((item) => [item.itemCode, finiteOrNull(item.amount)]));
  const expenseRecoveryRate = finiteOrNull(annual.diagnosisResult?.expenseRecoveryRate);
  const operatingRevenue = itemAmount(items, INCOME_ITEM_CODES.operatingRevenue);
  const operatingExpense = itemAmount(items, INCOME_ITEM_CODES.operatingExpense);
  const operatingCoverageRatio = operatingRevenue == null || operatingExpense == null || operatingExpense <= 0
    ? null
    : (operatingRevenue / operatingExpense) * 100;

  return {
    ...legalBase,
    eligible: true,
    exclusionReason: null,
    householdFee20m3Yen: positiveFiniteOrNull(annual.householdFee20m3Yen),
    expenseRecoveryRate,
    operatingRevenue,
    operatingExpense,
    operatingCoverageRatio,
    nonStandardTransfer: finiteOrNull(annual.nonStandardTransfer),
    servicePopulation: finiteOrNull(annual.servicePopulation),
    connectedPopulation: finiteOrNull(annual.connectedPopulation)
  };
}

function excludedRow(
  base: Pick<PrefecturePeerComparisonRow,
    | "municipalityCode"
    | "municipalityName"
    | "representedMunicipalityCodes"
    | "representedMunicipalityNames"
    | "representedMunicipalityCount"
    | "prefectureName"
    | "businessKey"
    | "businessName"
    | "businessType"
    | "accountingType"
    | "comparisonUnitKey"
    | "detailMunicipalityCode"
    | "isJointOperation"
    | "operatorMunicipalityCode"
    | "operatorMunicipalityName"
    | "jointOperationSourceUrl"
    | "jointOperationSourceLabel"
    | "isCurrent">,
  code: PrefecturePeerExclusionCode,
  comparisonBusinessKey: string
): PrefecturePeerComparisonRow {
  return {
    ...base,
    eligible: false,
    exclusionReason: {
      code,
      label: isPublicSewerComparisonFamilyKey(comparisonBusinessKey)
        ? PUBLIC_SEWER_FAMILY_EXCLUSION_LABELS[code] ?? EXCLUSION_LABELS[code]
        : EXCLUSION_LABELS[code]
    },
    householdFee20m3Yen: null,
    expenseRecoveryRate: null,
    operatingRevenue: null,
    operatingExpense: null,
    operatingCoverageRatio: null,
    nonStandardTransfer: null,
    servicePopulation: null,
    connectedPopulation: null
  };
}

function buildSummary(rows: PrefecturePeerComparisonRow[]): PrefecturePeerComparisonSummary {
  const eligibleRows = rows.filter((row) => row.eligible);
  const totalMunicipalities = representedCount(rows);
  const eligibleMunicipalities = representedCount(eligibleRows);
  const exclusionCounts = Object.fromEntries(
    (Object.keys(EXCLUSION_LABELS) as PrefecturePeerExclusionCode[]).map((code) => [
      code,
      representedCount(rows.filter((row) => row.exclusionReason?.code === code))
    ])
  ) as Record<PrefecturePeerExclusionCode, number>;

  return {
    totalMunicipalities,
    eligibleMunicipalities,
    eligibleComparisonUnits: eligibleRows.length,
    excludedMunicipalities: totalMunicipalities - eligibleMunicipalities,
    exclusionCounts,
    averages: {
      operatingCoverageRatio: average(eligibleRows.map((row) => row.operatingCoverageRatio))
    },
    totals: {
      nonStandardTransfer: sumOrNull(eligibleRows.map((row) => row.nonStandardTransfer))
    },
    positiveCounts: {
      expenseRecoveryAtLeast100: eligibleRows.filter((row) => row.expenseRecoveryRate != null && row.expenseRecoveryRate >= 100).length,
      operatingCoverageBelow100: eligibleRows.filter((row) => row.operatingCoverageRatio != null && row.operatingCoverageRatio < 100).length,
      highRecoveryButOperatingCoverageBelow100: eligibleRows.filter((row) =>
        row.expenseRecoveryRate != null
        && row.expenseRecoveryRate >= 100
        && row.operatingCoverageRatio != null
        && row.operatingCoverageRatio < 100
      ).length,
      nonStandardTransfer: eligibleRows.filter((row) => (row.nonStandardTransfer ?? 0) > 0).length
    },
    missingCounts: {
      expenseRecoveryRate: eligibleRows.filter((row) => row.expenseRecoveryRate == null).length,
      operatingCoverageRatio: eligibleRows.filter((row) => row.operatingCoverageRatio == null).length
    }
  };
}

function representedCount(rows: PrefecturePeerComparisonRow[]) {
  return rows.reduce((total, row) => total + row.representedMunicipalityCount, 0);
}

function average(values: Array<number | null>) {
  const finiteValues = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function sumOrNull(values: Array<number | null>) {
  const finiteValues = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0);
}

function itemAmount(items: Map<string, number | null>, itemCode: string) {
  return items.get(itemCode) ?? null;
}

function finiteOrNull(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? null : value;
}

function positiveFiniteOrNull(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) || value <= 0 ? null : value;
}

function isMunicipalityName(name: string) {
  return /(?:市|区|町|村)$/u.test(name);
}

function isFlowSewerBusinessKey(businessKey: string) {
  const [industryCode, businessCode] = businessKey.trim().split(/[-/]/);
  return industryCode === "17" && Number(businessCode) === 3;
}

function isPublicSewerComparisonFamilyKey(businessKey: string): businessKey is typeof PUBLIC_SEWER_COMPARISON_FAMILY[number] {
  return (PUBLIC_SEWER_COMPARISON_FAMILY as readonly string[]).includes(businessKey);
}

function preferredBusiness(
  businesses: PrefecturePeerBusinessInput[],
  preferredBusinessKeys: string[],
  surveyYear: PrefecturePeerComparisonSurveyYear
) {
  return preferredBusinessKeys
    .flatMap((candidateKey) => businesses
      .filter((business) => business.businessKey === candidateKey)
      .sort((a, b) => businessCandidateRank(a, surveyYear) - businessCandidateRank(b, surveyYear)))
    .at(0) ?? null;
}

function selectPreferredJointOperations(
  operations: PrefecturePeerJointOperationInput[],
  preferredBusinessKeys: string[],
  surveyYear: PrefecturePeerComparisonSurveyYear
) {
  const operationsByOperator = new Map<string, PrefecturePeerJointOperationInput[]>();
  for (const operation of operations) {
    if (!preferredBusinessKeys.includes(operation.businessKey)) continue;
    const grouped = operationsByOperator.get(operation.operatorMunicipalityCode) ?? [];
    grouped.push(operation);
    operationsByOperator.set(operation.operatorMunicipalityCode, grouped);
  }

  return [...operationsByOperator.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "ja"))
    .flatMap(([, candidates]) => {
      const operationWithR6 = preferredBusinessKeys
        .map((candidateKey) => candidates.find((operation) =>
          operation.businessKey === candidateKey
          && operation.businesses.some((business) =>
            business.businessKey === candidateKey
            && business.accountingType === "legal_applied"
            && findLegalAnnual(business, surveyYear) != null
          )
        ))
        .find((operation): operation is PrefecturePeerJointOperationInput => operation != null);
      if (operationWithR6) return [operationWithR6];

      const legalOperation = preferredBusinessKeys
        .map((candidateKey) => candidates.find((operation) =>
          operation.businessKey === candidateKey
          && operation.businesses.some((business) =>
            business.businessKey === candidateKey && business.accountingType === "legal_applied"
          )
        ))
        .find((operation): operation is PrefecturePeerJointOperationInput => operation != null);
      if (legalOperation) return [legalOperation];

      const matchingOperation = preferredBusinessKeys
        .map((candidateKey) => candidates.find((operation) => operation.businessKey === candidateKey))
        .find((operation): operation is PrefecturePeerJointOperationInput => operation != null);
      return matchingOperation ? [matchingOperation] : [];
    });
}

function businessCandidateRank(
  business: PrefecturePeerBusinessInput,
  surveyYear: PrefecturePeerComparisonSurveyYear
) {
  if (business.accountingType === "legal_applied" && findLegalAnnual(business, surveyYear)) return 0;
  if (business.accountingType === "legal_applied") return 1;
  return 2;
}

function findLegalAnnual(
  business: PrefecturePeerBusinessInput,
  surveyYear: PrefecturePeerComparisonSurveyYear
) {
  return business.annualFinancials.find((item) =>
    item.surveyYear === surveyYear && item.accountingType === "legal_applied"
  ) ?? null;
}

function compareMunicipalityCode(a: PrefecturePeerComparisonRow, b: PrefecturePeerComparisonRow) {
  if (a.municipalityCode === b.municipalityCode) {
    return a.municipalityName.localeCompare(b.municipalityName, "ja");
  }
  if (!a.municipalityCode) return 1;
  if (!b.municipalityCode) return -1;
  return a.municipalityCode < b.municipalityCode ? -1 : 1;
}

function assertR6(surveyYear: number): asserts surveyYear is PrefecturePeerComparisonSurveyYear {
  if (surveyYear !== PREFECTURE_PEER_COMPARISON_SURVEY_YEAR) {
    throw new RangeError("Prefecture peer comparison supports R6 (surveyYear 2024) only.");
  }
}
