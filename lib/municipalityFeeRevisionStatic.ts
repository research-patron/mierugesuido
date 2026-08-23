import type { MunicipalityFeeRevisionComparison } from "@/lib/municipalityFeeRevision";

export type MunicipalityFeeRevisionStaticIndex = Record<string, MunicipalityFeeRevisionComparison>;

export type MunicipalityFeeRevisionStaticSource = {
  municipalityCode?: string | null;
  feeRevisionComparison?: MunicipalityFeeRevisionComparison | null;
};

export function buildMunicipalityFeeRevisionStaticIndex(
  items: readonly MunicipalityFeeRevisionStaticSource[]
): MunicipalityFeeRevisionStaticIndex {
  return Object.fromEntries(items.flatMap((item) => {
    const municipalityCode = item.municipalityCode?.trim();
    const comparison = item.feeRevisionComparison;
    if (!municipalityCode || !comparison) return [];
    return [[municipalityCode, comparison] as const];
  }));
}

export function municipalityFeeRevisionFromStaticIndex(
  index: MunicipalityFeeRevisionStaticIndex | null | undefined,
  municipalityCode: string
) {
  return index?.[municipalityCode] ?? null;
}
