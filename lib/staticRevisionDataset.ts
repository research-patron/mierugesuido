import type {
  YearbookFeeChange,
  YearbookFeeChangeSupportReason,
  YearbookFeeComparisonDataset
} from "@/lib/yearbookFeeChanges";

type StaticRevisionEvent = {
  id: number;
  targetBusiness: string | null;
  averageRevisionRate: number | null;
  effectiveDate: string | null;
  sourceUrl: string;
  municipality: {
    municipalityCode: string | null;
    municipalityName: string;
    prefectureName: string;
  };
  sewerBusiness?: {
    businessKey?: string | null;
    businessName?: string | null;
    businessType?: string | null;
    estatBusinessCategory?: string | null;
  };
};

type StaticYearbookFeeComparison = Pick<
  YearbookFeeComparisonDataset,
  "sourceLabel" | "sourcePageUrls" | "changedBusinessCount" | "changedMunicipalityCount" | "items"
>;

export type StaticRevisionDataset = {
  summary: {
    total: number;
  };
  items: StaticRevisionEvent[];
  prefectures: string[];
  yearbookFeeComparison: StaticYearbookFeeComparison;
};

const supportReasons = new Set<YearbookFeeChangeSupportReason>([
  "previous_date_matches",
  "official_rate_reported",
  "tariff_changed",
  "tariff_system_changed"
]);

export function isStaticRevisionDataset(value: unknown): value is StaticRevisionDataset {
  if (!isRecord(value) || !isRecord(value.summary)) return false;
  if (!isNonNegativeInteger(value.summary.total)) return false;
  if (!Array.isArray(value.items) || !value.items.every(isStaticRevisionEvent)) return false;
  if (value.summary.total !== value.items.length) return false;
  if (!Array.isArray(value.prefectures) || !value.prefectures.every(isString)) return false;
  return isYearbookFeeComparisonDataset(value.yearbookFeeComparison);
}

function isStaticRevisionEvent(value: unknown): value is StaticRevisionEvent {
  if (!isRecord(value) || !isRecord(value.municipality)) return false;
  if (!isNonNegativeInteger(value.id)) return false;
  if (!isNullableString(value.targetBusiness)) return false;
  if (!isNullableFiniteNumber(value.averageRevisionRate)) return false;
  if (!isNullableString(value.effectiveDate) || !isString(value.sourceUrl)) return false;
  if (!isNullableString(value.municipality.municipalityCode)) return false;
  if (!isString(value.municipality.municipalityName) || !isString(value.municipality.prefectureName)) return false;
  if (value.sewerBusiness === undefined) return true;
  const sewerBusiness = value.sewerBusiness;
  if (!isRecord(sewerBusiness)) return false;
  return ["businessKey", "businessName", "businessType", "estatBusinessCategory"]
    .every((key) => isOptionalNullableString(sewerBusiness[key]));
}

function isYearbookFeeComparisonDataset(value: unknown): value is StaticYearbookFeeComparison {
  if (!isRecord(value) || !isRecord(value.sourcePageUrls)) return false;
  if (!isString(value.sourceLabel)) return false;
  if (!isString(value.sourcePageUrls.r5) || !isString(value.sourcePageUrls.r6)) return false;
  if (!isNonNegativeInteger(value.changedBusinessCount) || !isNonNegativeInteger(value.changedMunicipalityCount)) return false;
  if (!Array.isArray(value.items) || !value.items.every(isYearbookFeeChange)) return false;
  if (value.changedBusinessCount !== value.items.length) return false;
  const municipalityCount = new Set(value.items.map((item) => (
    item.municipalityCode ?? `${item.prefectureName}\u0000${item.operatorName}`
  ))).size;
  return value.changedMunicipalityCount === municipalityCount;
}

function isYearbookFeeChange(value: unknown): value is YearbookFeeChange {
  if (!isRecord(value)) return false;
  if (!["id", "prefectureName", "operatorName", "businessKey", "businessName", "categoryCode", "accountingType"].every(
    (key) => isString(value[key])
  )) return false;
  if (!isNullableString(value.municipalityCode)) return false;
  if (!isOneOf(value.direction, ["increase", "decrease", "unchanged"])) return false;
  if (!isAccountingTypes(value.accountingTypes)) return false;
  if (!isCurrentEffectiveDate(value.currentUsageFeeEffectiveDate)) return false;
  if (!isPreviousRevisionDate(value.previousUsageFeeRevisionDate)) return false;
  if (!isOfficialRevisionRate(value.officialRevisionRate)) return false;
  if (!isHouseholdFeeComparison(value.householdFee20m3)) return false;
  if (!Array.isArray(value.tariffChanges) || !value.tariffChanges.every(isTariffChange)) return false;
  if (!Array.isArray(value.tariffSystemChanges) || !value.tariffSystemChanges.every(isTariffSystemChange)) return false;
  return Array.isArray(value.supportReasons)
    && value.supportReasons.every((reason) => isString(reason) && supportReasons.has(reason as YearbookFeeChangeSupportReason));
}

function isAccountingTypes(value: unknown) {
  return isRecord(value) && isString(value.r5) && isString(value.r6);
}

function isCurrentEffectiveDate(value: unknown) {
  if (!isRecord(value)) return false;
  const r5 = value.r5;
  const r6 = value.r6;
  return isDateSnapshot(r5, false)
    && isDateSnapshot(r6, false)
    && isString(r5.iso)
    && isString(r6.iso)
    && value.changed === true
    && r5.iso !== r6.iso
    && typeof value.r6WithinCurrentFiscalYear === "boolean";
}

function isPreviousRevisionDate(value: unknown) {
  return isRecord(value)
    && isDateSnapshot(value.r5, true)
    && isDateSnapshot(value.r6, true)
    && typeof value.r6MatchesR5Current === "boolean";
}

function isDateSnapshot(value: unknown, allowNullIso: boolean): value is { iso: string | null; raw: string | null } {
  return isRecord(value)
    && (allowNullIso ? isNullableString(value.iso) : isString(value.iso))
    && isNullableString(value.raw);
}

function isOfficialRevisionRate(value: unknown) {
  return isRecord(value)
    && isNullableFiniteNumber(value.household20m3Percent)
    && isNullableFiniteNumber(value.averagePercent)
    && typeof value.reported === "boolean";
}

function isHouseholdFeeComparison(value: unknown) {
  return isRecord(value)
    && isNullableFiniteNumber(value.r5)
    && isNullableFiniteNumber(value.r6)
    && isNullableFiniteNumber(value.delta)
    && isNullableFiniteNumber(value.changeRate);
}

function isTariffChange(value: unknown) {
  return isRecord(value)
    && isString(value.key)
    && isString(value.label)
    && isFiniteNumber(value.r5)
    && isFiniteNumber(value.r6)
    && isFiniteNumber(value.delta);
}

function isTariffSystemChange(value: unknown) {
  return isRecord(value)
    && isString(value.key)
    && isTariffSystemValue(value.r5)
    && isTariffSystemValue(value.r6);
}

function isTariffSystemValue(value: unknown) {
  return isString(value) || typeof value === "boolean" || isFiniteNumber(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOptionalNullableString(value: unknown) {
  return value === undefined || isNullableString(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isOneOf<T extends string>(value: unknown, candidates: readonly T[]): value is T {
  return isString(value) && candidates.includes(value as T);
}
