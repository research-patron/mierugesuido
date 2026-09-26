import type { YearbookFeeChange } from "@/lib/yearbookFeeChanges";

export type NationalMapRevision = Pick<YearbookFeeChange,
  "municipalityCode" | "prefectureName" | "operatorName" | "categoryCode" | "accountingType"
>;

export function nationalMapRevisions(items: readonly YearbookFeeChange[]): NationalMapRevision[] {
  return items.filter(item => item.currentUsageFeeEffectiveDate.changed
    && item.currentUsageFeeEffectiveDate.r5.iso !== item.currentUsageFeeEffectiveDate.r6.iso)
    .map(({ municipalityCode, prefectureName, operatorName, categoryCode, accountingType }) => ({
      municipalityCode, prefectureName, operatorName, categoryCode, accountingType
    }));
}

// Count the revision list's municipalities, not events or representative financial rows.
// A shared operator without a municipality code remains one identified operator.
export function countNationalMapRevisions(
  items: readonly NationalMapRevision[] | undefined,
  prefectureName: string,
  categoryCode: string,
  fiscalYear: number,
  accountingType: string | null = null
): number | null {
  if (!items || fiscalYear !== 2024) return null;
  return new Set(items.filter(item => item.prefectureName === prefectureName
    && item.categoryCode === categoryCode
    && (!accountingType || item.accountingType === accountingType))
    .map(item => item.municipalityCode ?? `${item.prefectureName}\u0000${item.operatorName}`)).size;
}
