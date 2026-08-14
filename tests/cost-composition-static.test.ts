import { describe, expect, it } from "vitest";

import {
  mergeCostCompositionIntoDetail,
  separateCostCompositionFromDetail
} from "@/lib/costCompositionStatic";

describe("R6費用構成の静的サイドカー", () => {
  it("keeps the existing detail payload stable and restores cost data by business and accounting type", () => {
    const original = detailFixture();
    const separated = separateCostCompositionFromDetail(original);

    expect(separated.detail.businesses[0].financialStory).not.toHaveProperty("costComposition");
    expect(separated.detail.businesses[1].financialStory).not.toHaveProperty("costComposition");
    expect(separated.costCompositionBundle).toMatchObject({
      municipalityCode: "011002",
      fiscalYearLabel: "R6",
      businesses: [{
        businessKey: "17-1-000",
        accountingType: "legal_applied",
        total: 100,
        values: [null, null, null, null, null, null, null, null, null, null, null, null, 100]
      }]
    });

    const restored = mergeCostCompositionIntoDetail(separated.detail, separated.costCompositionBundle);
    expect(restored.businesses[0].financialStory.costComposition).toMatchObject({ total: 100 });
    expect(restored.businesses[0].financialStory.costComposition.items).toHaveLength(13);
    expect(restored.businesses[0].financialStory.costComposition.items.at(-1)).toMatchObject({
      id: "other",
      label: "その他",
      value: 100
    });
    expect(restored.businesses[1].financialStory).not.toHaveProperty("costComposition");
  });

  it("does not merge a bundle belonging to another municipality", () => {
    const original = detailFixture();
    const separated = separateCostCompositionFromDetail(original);
    const result = mergeCostCompositionIntoDetail(separated.detail, {
      ...separated.costCompositionBundle!,
      municipalityCode: "131016"
    });

    expect(result).toBe(separated.detail);
  });

  it("publishes one cost record for duplicate operator relationship rows", () => {
    const original = detailFixture();
    original.businesses.push(structuredClone(original.businesses[0]));

    const separated = separateCostCompositionFromDetail(original);

    expect(separated.detail.businesses).toHaveLength(3);
    expect(separated.costCompositionBundle?.businesses).toHaveLength(1);
  });
});

function detailFixture() {
  return {
    municipalityCode: "011002",
    businesses: [
      {
        businessKey: "17-1-000",
        accountingType: "legal_applied",
        financialStory: {
          year: "R6年度",
          costComposition: {
            total: 100,
            items: [{ id: "other", label: "その他", value: 100 }]
          }
        }
      },
      {
        businessKey: "18-0-000",
        accountingType: "non_legal_applied",
        financialStory: {
          year: "R6年度",
          costComposition: {
            total: 200,
            items: [{ id: "other", label: "その他", value: 200 }]
          }
        }
      }
    ]
  };
}
