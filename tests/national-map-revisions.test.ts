import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countNationalMapRevisions, nationalMapRevisions, type NationalMapRevision } from "@/lib/nationalMapRevisions";
import type { YearbookFeeComparisonDataset } from "@/lib/yearbookFeeChanges";

const comparison = JSON.parse(readFileSync("data/static/revisions.json", "utf8")).yearbookFeeComparison as YearbookFeeComparisonDataset;
const changes = nationalMapRevisions(comparison.items);
const row: NationalMapRevision = { municipalityCode: "052019", prefectureName: "秋田県", operatorName: "秋田市", categoryCode: "17/1", accountingType: "legal_applied" };

describe("national map revision municipality counts", () => {
  it("matches distinct municipalities from the revision list for every prefecture and scope", () => {
    for (const prefecture of new Set(comparison.items.map(item => item.prefectureName))) {
      for (const category of ["17/1", "17/4"]) {
        const expected = new Set(comparison.items.filter(item => item.prefectureName === prefecture && item.categoryCode === category)
          .map(item => item.municipalityCode ?? `${item.prefectureName}\u0000${item.operatorName}`)).size;
        expect(countNationalMapRevisions(changes, prefecture, category, 2024)).toBe(expected);
      }
    }
    expect(countNationalMapRevisions(changes, "秋田県", "17/1", 2024)).toBeGreaterThan(0);
  });

  it("counts a municipality once and respects business/accounting scope", () => {
    const rows = [row, row, { ...row, categoryCode: "17/4" },
      { ...row, municipalityCode: "053000", accountingType: "non_legal_applied" },
      { ...row, prefectureName: "岩手県" }];
    expect(countNationalMapRevisions(rows, "秋田県", "17/1", 2024)).toBe(2);
    expect(countNationalMapRevisions(rows, "秋田県", "17/4", 2024)).toBe(1);
    expect(countNationalMapRevisions(rows, "秋田県", "17/1", 2024, "legal_applied")).toBe(1);
    expect(countNationalMapRevisions(rows, "秋田県", "17/1", 2024, "non_legal_applied")).toBe(1);
  });

  it("keeps a shared operator once without manufacturing municipality allocations", () => {
    const shared = { ...row, municipalityCode: null, operatorName: "共同組合" };
    expect(countNationalMapRevisions([shared, shared], "秋田県", "17/1", 2024)).toBe(1);
  });

  it("distinguishes zero from absent evidence and unsupported years", () => {
    expect(countNationalMapRevisions([], "秋田県", "17/1", 2024)).toBe(0);
    expect(countNationalMapRevisions(undefined, "秋田県", "17/1", 2024)).toBeNull();
    expect(countNationalMapRevisions(changes, "秋田県", "17/1", 2023)).toBeNull();
  });

  it("does not promote monetary changes or unchanged effective dates to revisions", () => {
    const source = comparison.items[0];
    expect(nationalMapRevisions([{ ...source, currentUsageFeeEffectiveDate: {
      ...source.currentUsageFeeEffectiveDate, changed: false
    } }])).toEqual([]);
    expect(nationalMapRevisions([{ ...source, currentUsageFeeEffectiveDate: {
      ...source.currentUsageFeeEffectiveDate, r6: source.currentUsageFeeEffectiveDate.r5
    } }])).toEqual([]);
  });
});
