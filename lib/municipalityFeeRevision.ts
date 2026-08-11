import type { YearbookFeeChange, YearbookFeeSnapshot } from "@/lib/yearbookFeeChanges";

export type MunicipalityFeeRevisionChange = {
  businessKey: string;
  businessName: string;
  r5EffectiveDate: string;
  r6EffectiveDate: string;
};

export type MunicipalityFeeRevisionComparison = {
  status: "changed" | "unchanged";
  comparableBusinessCount: number;
  changedBusinessCount: number;
  changes: MunicipalityFeeRevisionChange[];
};

/**
 * 改定情報ページと同じ、R5・R6第33表の「現行使用料施行年月日」が
 * 変わった事業だけを市町村コード単位にまとめる。
 * 金額差や手動登録の改定イベントはこの判定に使用しない。
 */
export function buildMunicipalityFeeRevisionIndex(
  items: readonly YearbookFeeChange[]
): Map<string, MunicipalityFeeRevisionComparison> {
  const changesByMunicipality = new Map<string, MunicipalityFeeRevisionChange[]>();

  for (const item of items) {
    const municipalityCode = item.municipalityCode?.trim();
    if (!municipalityCode || !hasStrictEffectiveDateChange(item)) continue;

    const changes = changesByMunicipality.get(municipalityCode) ?? [];
    changes.push({
      businessKey: item.businessKey,
      businessName: item.businessName,
      r5EffectiveDate: item.currentUsageFeeEffectiveDate.r5.iso,
      r6EffectiveDate: item.currentUsageFeeEffectiveDate.r6.iso
    });
    changesByMunicipality.set(municipalityCode, changes);
  }

  return new Map([...changesByMunicipality.entries()].map(([municipalityCode, changes]) => {
    const sortedChanges = [...changes].sort((a, b) => (
      a.businessName.localeCompare(b.businessName, "ja")
      || a.businessKey.localeCompare(b.businessKey, "ja")
    ));
    return [municipalityCode, {
      status: "changed",
      comparableBusinessCount: sortedChanges.length,
      changedBusinessCount: sortedChanges.length,
      changes: sortedChanges
    }];
  }));
}

/**
 * R5・R6の双方に同じ事業が存在し、全事業の現行使用料施行年月日が
 * 有効な日付として比較できる自治体だけに「変更なし」を付与する。
 *
 * 片年度だけの事業、事業キーの不一致、日付欠損を含む自治体は
 * 「改定情報なし」と断定せず、indexに追加しない。日付変更が確認できた
 * 自治体は、一部に比較不能事業があっても確認済みの変更事実を優先する。
 */
export function addComparableUnchangedMunicipalities(
  changedIndex: ReadonlyMap<string, MunicipalityFeeRevisionComparison>,
  snapshots: readonly YearbookFeeSnapshot[]
): Map<string, MunicipalityFeeRevisionComparison> {
  const result = new Map(changedIndex);
  const recordsByMunicipality = new Map<string, Map<string, Partial<Record<2023 | 2024, YearbookFeeSnapshot>>>>();

  for (const snapshot of snapshots) {
    const municipalityCode = snapshot.municipalityCode?.trim();
    if (!municipalityCode) continue;

    const businesses = recordsByMunicipality.get(municipalityCode) ?? new Map();
    const identity = `${snapshot.prefectureName}:${municipalityCode}:${snapshot.businessKey}`;
    const yearly = businesses.get(identity) ?? {};
    if (yearly[snapshot.surveyYear]) {
      throw new Error(`同一年度の料金スナップショットが重複しています: ${identity}:${snapshot.surveyYear}`);
    }
    yearly[snapshot.surveyYear] = snapshot;
    businesses.set(identity, yearly);
    recordsByMunicipality.set(municipalityCode, businesses);
  }

  for (const [municipalityCode, businesses] of recordsByMunicipality) {
    const pairs = [...businesses.values()];
    if (pairs.length === 0) continue;
    const comparableBusinessCount = pairs.filter((yearly) => (
      yearly[2023] != null
      && yearly[2024] != null
      && isValidIsoDate(yearly[2023].currentUsageFeeEffectiveDate.iso)
      && isValidIsoDate(yearly[2024].currentUsageFeeEffectiveDate.iso)
    )).length;
    const changedComparison = result.get(municipalityCode);
    if (changedComparison) {
      result.set(municipalityCode, {
        ...changedComparison,
        comparableBusinessCount
      });
      continue;
    }

    const allBusinessesComparable = pairs.every((yearly) => (
      yearly[2023] != null
      && yearly[2024] != null
      && isValidIsoDate(yearly[2023].currentUsageFeeEffectiveDate.iso)
      && isValidIsoDate(yearly[2024].currentUsageFeeEffectiveDate.iso)
    ));
    if (!allBusinessesComparable) continue;

    const hasDateChange = pairs.some((yearly) => (
      yearly[2023]!.currentUsageFeeEffectiveDate.iso !== yearly[2024]!.currentUsageFeeEffectiveDate.iso
    ));
    // A valid changed pair should already be present in changedIndex. If it is
    // not, leave the municipality unclassified instead of producing a false
    // "no revision information" state.
    if (hasDateChange) continue;

    result.set(municipalityCode, {
      status: "unchanged",
      comparableBusinessCount,
      changedBusinessCount: 0,
      changes: []
    });
  }

  return result;
}

export function municipalityFeeRevisionStatus(
  comparison: MunicipalityFeeRevisionComparison | null | undefined
) {
  if (comparison?.status === "unchanged") return "unchanged" as const;
  if (comparison?.status === "changed" || comparison?.changes.length) return "changed" as const;
  return "unavailable" as const;
}

export function formatFeeRevisionEffectiveDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : value;
}

export function formatMunicipalityFeeRevisionCsv(
  comparison: MunicipalityFeeRevisionComparison | null | undefined
) {
  const status = municipalityFeeRevisionStatus(comparison);
  if (status === "unavailable") return "比較対象外";
  if (status === "unchanged") {
    return `改定情報なし（R5・R6施行年月日を比較済み・${comparison!.comparableBusinessCount}事業）`;
  }
  const changedComparison = comparison!;
  const details = changedComparison.changes.map((change) => (
    `${change.businessName} R5 ${formatFeeRevisionEffectiveDate(change.r5EffectiveDate)}`
    + ` → R6 ${formatFeeRevisionEffectiveDate(change.r6EffectiveDate)}`
  )).join("／");
  return `施行年月日が変化（${changedComparison.changedBusinessCount}事業）｜${details}`;
}

function isValidIsoDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasStrictEffectiveDateChange(item: YearbookFeeChange) {
  const dates = item.currentUsageFeeEffectiveDate;
  return dates.changed === true
    && Boolean(dates.r5.iso)
    && Boolean(dates.r6.iso)
    && dates.r5.iso !== dates.r6.iso;
}
