import { displayBusinessName } from "@/lib/businessDisplay";

export const YEARBOOK_R5_PAGE_URL = "https://www.e-stat.go.jp/stat-search/files?cycle=7&layout=datalist&month=0&page=1&result_back=1&tclass1=000001125336&tclass2=000001125337&tclass3val=0&toukei=00200251&tstat=000001125335&year=20240";
export const YEARBOOK_R6_PAGE_URL = "https://www.e-stat.go.jp/stat-search/files?cycle=7&layout=datalist&month=0&page=1&result_back=1&tclass1=000001125336&tclass2=000001125337&tclass3val=0&toukei=00200251&tstat=000001125335&year=20250";

export type YearbookFeeChangeDirection = "increase" | "decrease" | "unchanged";

export type TariffSystemSignalValue = string | number | boolean | null;
export type YearbookBusinessFeeVolume = 100 | 500 | 1000 | 5000 | 10000;

export type YearbookDateSnapshot = {
  iso: string | null;
  raw: string | null;
};

export type YearbookTariffSystemSignals = {
  systemCodeRaw: TariffSystemSignalValue;
  waterVolumeRankCount: TariffSystemSignalValue;
  minimumExcessUnitPriceYenPerM3: TariffSystemSignalValue;
  maximumExcessUnitPriceYenPerM3: TariffSystemSignalValue;
  progressivity: TariffSystemSignalValue;
};

export type YearbookFeeSnapshot = {
  surveyYear: 2023 | 2024;
  municipalityCode: string | null;
  municipalityName: string;
  prefectureName: string;
  businessKey: string;
  businessName?: string | null;
  businessType?: string | null;
  categoryCode: string;
  accountingType: string;
  currentUsageFeeEffectiveDate: YearbookDateSnapshot;
  previousUsageFeeRevisionDate: YearbookDateSnapshot;
  householdFee20m3Yen: number | null;
  businessFeesYen: Record<YearbookBusinessFeeVolume, number | null>;
  revisionRatesPercent: {
    household20m3: number | null;
    average: number | null;
  };
  tariffSystemSignals: YearbookTariffSystemSignals;
};

export type YearbookFeeChangeSupportReason =
  | "previous_date_matches"
  | "official_rate_reported"
  | "tariff_changed"
  | "tariff_system_changed";

export type YearbookTariffChange = {
  key: YearbookTariffField;
  label: string;
  r5: number;
  r6: number;
  delta: number;
};

export type YearbookTariffSystemChange = {
  key: string;
  r5: Exclude<TariffSystemSignalValue, null>;
  r6: Exclude<TariffSystemSignalValue, null>;
};

export type YearbookFeeChange = {
  id: string;
  municipalityCode: string | null;
  prefectureName: string;
  operatorName: string;
  businessKey: string;
  businessName: string;
  categoryCode: string;
  direction: YearbookFeeChangeDirection;
  accountingType: string;
  accountingTypes: { r5: string; r6: string };
  currentUsageFeeEffectiveDate: {
    r5: { iso: string; raw: string | null };
    r6: { iso: string; raw: string | null };
    changed: boolean;
    r6WithinCurrentFiscalYear: boolean;
  };
  previousUsageFeeRevisionDate: {
    r5: { iso: string | null; raw: string | null };
    r6: { iso: string | null; raw: string | null };
    r6MatchesR5Current: boolean;
  };
  officialRevisionRate: {
    household20m3Percent: number | null;
    averagePercent: number | null;
    reported: boolean;
  };
  householdFee20m3: {
    r5: number | null;
    r6: number | null;
    delta: number | null;
    changeRate: number | null;
  };
  tariffChanges: YearbookTariffChange[];
  tariffSystemChanges: YearbookTariffSystemChange[];
  supportReasons: YearbookFeeChangeSupportReason[];
};

export type YearbookFeeComparisonCount = {
  businessCount: number;
  municipalityCount: number;
};

export type YearbookFeeComparisonDataset = {
  previousSurveyYear: 2023;
  currentSurveyYear: 2024;
  sourceLabel: string;
  sourcePageUrls: { r5: string; r6: string };
  counts: {
    common: YearbookFeeComparisonCount;
    comparable: YearbookFeeComparisonCount;
    dateChanged: YearbookFeeComparisonCount;
    currentYear: YearbookFeeComparisonCount;
    supported: YearbookFeeComparisonCount;
    candidate: YearbookFeeComparisonCount;
    amountOnly: YearbookFeeComparisonCount;
  };
  comparedBusinessCount: number;
  comparedMunicipalityCount: number;
  changedBusinessCount: number;
  changedMunicipalityCount: number;
  increaseCount: number;
  decreaseCount: number;
  items: YearbookFeeChange[];
};

export type YearbookTariffField =
  | "householdFee20m3Yen"
  | "businessFee100m3Yen"
  | "businessFee500m3Yen"
  | "businessFee1000m3Yen"
  | "businessFee5000m3Yen"
  | "businessFee10000m3Yen";

type SnapshotPair = { r5: YearbookFeeSnapshot; r6: YearbookFeeSnapshot };

const TARIFF_FIELDS: Array<{
  key: YearbookTariffField;
  label: string;
  value: (snapshot: YearbookFeeSnapshot) => number | null;
}> = [
  { key: "householdFee20m3Yen", label: "一般家庭用20m³／月", value: (snapshot) => snapshot.householdFee20m3Yen },
  { key: "businessFee100m3Yen", label: "業務用100m³／月", value: (snapshot) => snapshot.businessFeesYen[100] },
  { key: "businessFee500m3Yen", label: "業務用500m³／月", value: (snapshot) => snapshot.businessFeesYen[500] },
  { key: "businessFee1000m3Yen", label: "業務用1,000m³／月", value: (snapshot) => snapshot.businessFeesYen[1000] },
  { key: "businessFee5000m3Yen", label: "業務用5,000m³／月", value: (snapshot) => snapshot.businessFeesYen[5000] },
  { key: "businessFee10000m3Yen", label: "業務用10,000m³／月", value: (snapshot) => snapshot.businessFeesYen[10000] }
];

export function buildYearbookFeeComparison(snapshots: YearbookFeeSnapshot[]): YearbookFeeComparisonDataset {
  const pairs = buildSnapshotPairs(snapshots);
  const comparablePairs = pairs.filter(hasComparableEffectiveDates);
  const dateChangedPairs = comparablePairs.filter(hasEffectiveDateChange);
  const currentYearPairs = dateChangedPairs.filter(({ r6 }) => isWithinFiscalYear(
    r6.currentUsageFeeEffectiveDate.iso!,
    r6.surveyYear
  ));

  // The public revision list is defined only by an official effective-date
  // change. Tariff amounts and support fields remain evidence on each row, but
  // they never add an unchanged-date business to the list.
  const items = dateChangedPairs.map((pair): YearbookFeeChange => {
    const tariffChanges = compareTariffs(pair.r5, pair.r6);
    const tariffSystemChanges = compareTariffSystemSignals(pair.r5.tariffSystemSignals, pair.r6.tariffSystemSignals);
    const previousDateMatches = validIsoDate(pair.r6.previousUsageFeeRevisionDate.iso) != null
      && pair.r6.previousUsageFeeRevisionDate.iso === pair.r5.currentUsageFeeEffectiveDate.iso;
    const officialRateReported = hasReportedOfficialRate(pair.r6);
    const currentFiscalYear = isWithinFiscalYear(pair.r6.currentUsageFeeEffectiveDate.iso!, pair.r6.surveyYear);
    const supportReasons = compactSupportReasons({
      previousDateMatches,
      officialRateReported,
      tariffChanged: tariffChanges.length > 0,
      tariffSystemChanged: tariffSystemChanges.length > 0
    });
    const householdFee20m3 = compareHouseholdFee(pair.r5.householdFee20m3Yen, pair.r6.householdFee20m3Yen);
    return {
      id: snapshotIdentity(pair.r6),
      municipalityCode: pair.r6.municipalityCode,
      prefectureName: pair.r6.prefectureName,
      operatorName: pair.r6.municipalityName,
      businessKey: pair.r6.businessKey,
      businessName: displayBusinessName(pair.r6),
      categoryCode: pair.r6.categoryCode,
      direction: householdFeeDirection(householdFee20m3.delta),
      accountingType: pair.r6.accountingType,
      accountingTypes: { r5: pair.r5.accountingType, r6: pair.r6.accountingType },
      currentUsageFeeEffectiveDate: {
        r5: { iso: pair.r5.currentUsageFeeEffectiveDate.iso!, raw: pair.r5.currentUsageFeeEffectiveDate.raw },
        r6: { iso: pair.r6.currentUsageFeeEffectiveDate.iso!, raw: pair.r6.currentUsageFeeEffectiveDate.raw },
        changed: true,
        r6WithinCurrentFiscalYear: currentFiscalYear
      },
      previousUsageFeeRevisionDate: {
        r5: { iso: validIsoDate(pair.r5.previousUsageFeeRevisionDate.iso), raw: pair.r5.previousUsageFeeRevisionDate.raw },
        r6: { iso: validIsoDate(pair.r6.previousUsageFeeRevisionDate.iso), raw: pair.r6.previousUsageFeeRevisionDate.raw },
        r6MatchesR5Current: previousDateMatches
      },
      officialRevisionRate: {
        household20m3Percent: finiteOrNull(pair.r6.revisionRatesPercent.household20m3),
        averagePercent: finiteOrNull(pair.r6.revisionRatesPercent.average),
        reported: officialRateReported
      },
      householdFee20m3,
      tariffChanges,
      tariffSystemChanges,
      supportReasons
    };
  });

  items.sort(compareItems);
  const supportedPairs = dateChangedPairs.filter((pair) => (
    isWithinFiscalYear(pair.r6.currentUsageFeeEffectiveDate.iso!, pair.r6.surveyYear)
    && hasRevisionSupport(pair)
  ));
  const candidatePairs = dateChangedPairs.filter((pair) => !supportedPairs.includes(pair));
  const amountOnlyPairs = comparablePairs.filter((pair) => (
    !hasEffectiveDateChange(pair)
    && (compareTariffs(pair.r5, pair.r6).length > 0
      || compareTariffSystemSignals(pair.r5.tariffSystemSignals, pair.r6.tariffSystemSignals).length > 0)
  ));
  const counts = {
    common: countPairs(pairs),
    comparable: countPairs(comparablePairs),
    dateChanged: countPairs(dateChangedPairs),
    currentYear: countPairs(currentYearPairs),
    supported: countPairs(supportedPairs),
    candidate: countPairs(candidatePairs),
    amountOnly: countPairs(amountOnlyPairs)
  };
  return {
    previousSurveyYear: 2023,
    currentSurveyYear: 2024,
    sourceLabel: "総務省 地方公営企業決算状況調査 R5・R6 第33表（経営分析に関する調（二））",
    sourcePageUrls: { r5: YEARBOOK_R5_PAGE_URL, r6: YEARBOOK_R6_PAGE_URL },
    counts,
    comparedBusinessCount: counts.comparable.businessCount,
    comparedMunicipalityCount: counts.comparable.municipalityCount,
    changedBusinessCount: counts.dateChanged.businessCount,
    changedMunicipalityCount: counts.dateChanged.municipalityCount,
    increaseCount: items.filter((item) => item.direction === "increase").length,
    decreaseCount: items.filter((item) => item.direction === "decrease").length,
    items
  };
}

function buildSnapshotPairs(snapshots: YearbookFeeSnapshot[]): SnapshotPair[] {
  const byIdentityAndYear = new Map<string, YearbookFeeSnapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshotIdentityWithoutAccountingType(snapshot)}:${snapshot.surveyYear}`;
    if (byIdentityAndYear.has(key)) {
      throw new Error(`同一年度の料金スナップショットが重複しています: ${key}`);
    }
    byIdentityAndYear.set(key, snapshot);
  }

  const identities = new Set(snapshots.map(snapshotIdentityWithoutAccountingType));
  return [...identities].flatMap((identity): SnapshotPair[] => {
    const r5 = byIdentityAndYear.get(`${identity}:2023`);
    const r6 = byIdentityAndYear.get(`${identity}:2024`);
    return r5 && r6 ? [{ r5, r6 }] : [];
  });
}

function hasComparableEffectiveDates(pair: SnapshotPair) {
  return validIsoDate(pair.r5.currentUsageFeeEffectiveDate.iso) != null
    && validIsoDate(pair.r6.currentUsageFeeEffectiveDate.iso) != null;
}

function hasEffectiveDateChange(pair: SnapshotPair) {
  return pair.r5.currentUsageFeeEffectiveDate.iso !== pair.r6.currentUsageFeeEffectiveDate.iso;
}

function isWithinFiscalYear(isoDate: string, surveyYear: number) {
  const valid = validIsoDate(isoDate);
  if (!valid) return false;
  return valid >= `${surveyYear}-04-01` && valid <= `${surveyYear + 1}-03-31`;
}

function hasRevisionSupport({ r5, r6 }: SnapshotPair) {
  return (validIsoDate(r6.previousUsageFeeRevisionDate.iso) != null
      && r6.previousUsageFeeRevisionDate.iso === r5.currentUsageFeeEffectiveDate.iso)
    || hasReportedOfficialRate(r6)
    || compareTariffs(r5, r6).length > 0
    || compareTariffSystemSignals(r5.tariffSystemSignals, r6.tariffSystemSignals).length > 0;
}

function hasReportedOfficialRate(snapshot: YearbookFeeSnapshot) {
  return [snapshot.revisionRatesPercent.household20m3, snapshot.revisionRatesPercent.average]
    .some((value) => value != null && Number.isFinite(value) && value !== 0);
}

function compareTariffs(r5: YearbookFeeSnapshot, r6: YearbookFeeSnapshot) {
  return TARIFF_FIELDS.flatMap(({ key, label, value }): YearbookTariffChange[] => {
    const previous = positiveFiniteOrNull(value(r5));
    const current = positiveFiniteOrNull(value(r6));
    if (previous == null || current == null || previous === current) return [];
    return [{ key, label, r5: previous, r6: current, delta: current - previous }];
  });
}

function compareTariffSystemSignals(
  r5: Record<string, TariffSystemSignalValue>,
  r6: Record<string, TariffSystemSignalValue>
) {
  const commonKeys = Object.keys(r5).filter((key) => key in r6).sort((a, b) => a.localeCompare(b, "ja"));
  return commonKeys.flatMap((key): YearbookTariffSystemChange[] => {
    const previous = comparableSignal(r5[key]);
    const current = comparableSignal(r6[key]);
    if (previous == null || current == null || previous === current) return [];
    return [{ key, r5: previous, r6: current }];
  });
}

function compareHouseholdFee(r5Value: number | null, r6Value: number | null) {
  const r5 = positiveFiniteOrNull(r5Value);
  const r6 = positiveFiniteOrNull(r6Value);
  const delta = r5 == null || r6 == null ? null : r6 - r5;
  return {
    r5,
    r6,
    delta,
    changeRate: delta == null || r5 == null || r5 <= 0 ? null : delta / r5
  };
}

function compactSupportReasons({
  previousDateMatches,
  officialRateReported,
  tariffChanged,
  tariffSystemChanged
}: {
  previousDateMatches: boolean;
  officialRateReported: boolean;
  tariffChanged: boolean;
  tariffSystemChanged: boolean;
}) {
  const reasons: YearbookFeeChangeSupportReason[] = [];
  if (previousDateMatches) reasons.push("previous_date_matches");
  if (officialRateReported) reasons.push("official_rate_reported");
  if (tariffChanged) reasons.push("tariff_changed");
  if (tariffSystemChanged) reasons.push("tariff_system_changed");
  return reasons;
}

function countPairs(pairs: SnapshotPair[]): YearbookFeeComparisonCount {
  return {
    businessCount: pairs.length,
    municipalityCount: new Set(pairs.map(({ r6 }) => municipalityIdentity(r6))).size
  };
}

function compareItems(a: YearbookFeeChange, b: YearbookFeeChange) {
  return a.prefectureName.localeCompare(b.prefectureName, "ja")
    || a.operatorName.localeCompare(b.operatorName, "ja")
    || a.businessName.localeCompare(b.businessName, "ja");
}

function householdFeeDirection(delta: number | null): YearbookFeeChangeDirection {
  if (delta == null || delta === 0) return "unchanged";
  return delta > 0 ? "increase" : "decrease";
}

function validIsoDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function finiteOrNull(value: number | null) {
  return value != null && Number.isFinite(value) ? value : null;
}

function positiveFiniteOrNull(value: number | null) {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function comparableSignal(value: TariffSystemSignalValue) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.trim() ? value.trim() : null;
  return value;
}

function snapshotIdentity(snapshot: YearbookFeeSnapshot) {
  return `${snapshotIdentityWithoutAccountingType(snapshot)}:${snapshot.accountingType}`;
}

function snapshotIdentityWithoutAccountingType(snapshot: YearbookFeeSnapshot) {
  return `${snapshot.prefectureName}:${snapshot.municipalityCode ?? snapshot.municipalityName}:${snapshot.businessKey}`;
}

function municipalityIdentity(snapshot: Pick<YearbookFeeSnapshot, "prefectureName" | "municipalityCode" | "municipalityName">) {
  return `${snapshot.prefectureName}:${snapshot.municipalityCode ?? snapshot.municipalityName}`;
}
