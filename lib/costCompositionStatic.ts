import { COST_COMPOSITION_ITEM_DEFINITIONS } from "@/lib/costCompositionDefinition";
import type { FinancialCostComposition, FinancialValue } from "@/lib/financialStory";

export type StaticCostCompositionBundle = {
  municipalityCode: string;
  fiscalYearLabel: "R6";
  businesses: Array<{
    businessKey: string;
    accountingType: string;
    total: FinancialValue;
    values: FinancialValue[];
    officialSourceUrl?: string;
  }>;
};

export function separateCostCompositionFromDetail(detail: any): {
  detail: any;
  costCompositionBundle: StaticCostCompositionBundle | null;
} {
  const costBusinessIndex = new Map<string, StaticCostCompositionBundle["businesses"][number]>();
  const businesses = (detail.businesses ?? []).map((business: any) => {
    const story = business.financialStory;
    if (!story || !("costComposition" in story)) return business;
    const { costComposition, ...storyWithoutCostComposition } = story;
    if (costComposition && business.accountingType === "legal_applied") {
      const valueById = new Map(
        (costComposition as FinancialCostComposition).items.map((item) => [item.id, item.value])
      );
      const record = {
        businessKey: business.businessKey,
        accountingType: business.accountingType,
        total: costComposition.total,
        values: COST_COMPOSITION_ITEM_DEFINITIONS.map((item) => valueById.get(item.id) ?? null),
        ...(costComposition.officialSource?.sourceUrl
          ? { officialSourceUrl: costComposition.officialSource.sourceUrl }
          : {})
      };
      const key = `${record.businessKey}\u0000${record.accountingType}`;
      const existing = costBusinessIndex.get(key);
      if (existing && JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error(`${detail.municipalityCode}/${record.businessKey}: 費用構成の重複値が一致しません`);
      }
      costBusinessIndex.set(key, record);
    }
    return { ...business, financialStory: storyWithoutCostComposition };
  });

  return {
    detail: { ...detail, businesses },
    costCompositionBundle: costBusinessIndex.size > 0 ? {
      municipalityCode: detail.municipalityCode,
      fiscalYearLabel: "R6",
      businesses: [...costBusinessIndex.values()]
    } : null
  };
}

export function mergeCostCompositionIntoDetail(
  detail: any,
  bundle: StaticCostCompositionBundle | null | undefined
) {
  if (!bundle || bundle.municipalityCode !== detail.municipalityCode) return detail;
  const index = new Map(bundle.businesses.map((business) => [
    `${business.businessKey}\u0000${business.accountingType}`,
    business
  ]));

  return {
    ...detail,
    businesses: (detail.businesses ?? []).map((business: any) => {
      const costRecord = index.get(`${business.businessKey}\u0000${business.accountingType}`);
      if (!costRecord || !business.financialStory) return business;
      const costComposition: FinancialCostComposition = {
        total: costRecord.total,
        items: COST_COMPOSITION_ITEM_DEFINITIONS.map((item, index) => ({
          id: item.id,
          label: item.label,
          value: costRecord.values[index] ?? null,
          note: item.note
        })),
        ...(costRecord.officialSourceUrl ? {
          officialSource: {
            label: "地方公営企業年鑑 個表（2）",
            sourceUrl: costRecord.officialSourceUrl,
            note: "13費目と費用合計の全14項目を第21表と照合済み"
          }
        } : {})
      };
      return {
        ...business,
        financialStory: { ...business.financialStory, costComposition }
      };
    })
  };
}
