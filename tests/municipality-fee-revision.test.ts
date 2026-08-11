import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addComparableUnchangedMunicipalities,
  buildMunicipalityFeeRevisionIndex,
  formatMunicipalityFeeRevisionCsv,
  municipalityFeeRevisionStatus
} from "@/lib/municipalityFeeRevision";
import type { YearbookFeeChange, YearbookFeeSnapshot } from "@/lib/yearbookFeeChanges";

describe("municipality fee revision comparison", () => {
  it("enriches the search JSON and prefecture CSV from one strict comparison index", () => {
    const generator = readFileSync(path.join(process.cwd(), "scripts/static/generate.ts"), "utf8");

    expect(generator).toContain("addComparableUnchangedMunicipalities(");
    expect(generator).toContain("buildMunicipalityFeeRevisionIndex(yearbookFeeComparison.items)");
    expect(generator).toContain("yearbookFeeSnapshots");
    expect(generator).toContain("feeRevisionComparison: item.municipalityCode");
    expect(generator).toContain("items: municipalitySearchItems");
    expect(generator).toContain("feeRevisionMunicipalityCount");
    expect(generator).toContain("const rows = municipalitySearchItems");
  });

  it("groups only strict effective-date changes by municipality code", () => {
    const index = buildMunicipalityFeeRevisionIndex([
      feeChange("052116", "17-4-000", "特定環境保全公共下水道", "2012-01-01", "2024-06-01"),
      feeChange("052116", "17-1-000", "公共下水道", "2012-01-01", "2024-06-01"),
      feeChange(null, "17-1-000", "組合事業", "2018-04-01", "2024-04-01"),
      feeChange("999999", "17-1-000", "変化なし事業", "2024-04-01", "2024-04-01", false)
    ]);

    expect([...index.keys()]).toEqual(["052116"]);
    expect(index.get("052116")).toEqual({
      status: "changed",
      comparableBusinessCount: 2,
      changedBusinessCount: 2,
      changes: [
        expect.objectContaining({ businessKey: "17-1-000", businessName: "公共下水道" }),
        expect.objectContaining({ businessKey: "17-4-000", businessName: "特定環境保全公共下水道" })
      ]
    });
    expect(formatMunicipalityFeeRevisionCsv(index.get("052116"))).toContain(
      "施行年月日が変化（2事業）｜公共下水道 R5 2012年1月1日 → R6 2024年6月1日"
    );
    expect(formatMunicipalityFeeRevisionCsv(null)).toBe("比較対象外");
  });

  it("labels only fully comparable unchanged municipalities as no revision information", () => {
    const changedIndex = buildMunicipalityFeeRevisionIndex([
      feeChange("052116", "17-1-000", "公共下水道", "2012-01-01", "2024-06-01")
    ]);
    const index = addComparableUnchangedMunicipalities(changedIndex, [
      feeSnapshot(2023, "052116", "17-1-000", "2012-01-01"),
      feeSnapshot(2024, "052116", "17-1-000", "2024-06-01"),
      feeSnapshot(2023, "052116", "17-4-000", "2012-01-01"),
      feeSnapshot(2024, "052116", "17-4-000", "2012-01-01"),
      feeSnapshot(2023, "151009", "17-1-000", "2020-04-01"),
      feeSnapshot(2024, "151009", "17-1-000", "2020-04-01")
    ]);

    expect(municipalityFeeRevisionStatus(index.get("052116"))).toBe("changed");
    expect(index.get("052116")?.comparableBusinessCount).toBe(2);
    expect(index.get("151009")).toEqual({
      status: "unchanged",
      comparableBusinessCount: 1,
      changedBusinessCount: 0,
      changes: []
    });
    expect(formatMunicipalityFeeRevisionCsv(index.get("151009"))).toBe(
      "改定情報なし（R5・R6施行年月日を比較済み・1事業）"
    );
  });

  it("does not call unmatched or non-comparable municipality records unchanged", () => {
    const index = addComparableUnchangedMunicipalities(new Map(), [
      // A comparable business plus another business missing from R6: municipality-level result is unknown.
      feeSnapshot(2023, "011002", "17-1-000", "2020-04-01"),
      feeSnapshot(2024, "011002", "17-1-000", "2020-04-01"),
      feeSnapshot(2023, "011002", "17-4-000", "2020-04-01"),
      // Invalid R6 effective date: not comparable.
      feeSnapshot(2023, "022012", "17-1-000", "2020-04-01"),
      feeSnapshot(2024, "022012", "17-1-000", null),
      // A date change absent from the strict changed index must never become unchanged.
      feeSnapshot(2023, "032018", "17-1-000", "2020-04-01"),
      feeSnapshot(2024, "032018", "17-1-000", "2024-04-01")
    ]);

    expect(index.has("011002")).toBe(false);
    expect(index.has("022012")).toBe(false);
    expect(index.has("032018")).toBe(false);
    expect(municipalityFeeRevisionStatus(index.get("011002"))).toBe("unavailable");
  });

  it("maps the official R5-R6 list to administrative municipality search without using its representative business", () => {
    const revisions = JSON.parse(readFileSync(path.join(process.cwd(), "data/static/revisions.json"), "utf8"));
    const municipalities = JSON.parse(readFileSync(path.join(process.cwd(), "public/data/static/municipalities.json"), "utf8"));
    const index = buildMunicipalityFeeRevisionIndex(revisions.yearbookFeeComparison.items);
    const municipalityCodes = new Set<string>(municipalities.items.map((item: any) => item.municipalityCode));
    const mappedCodes = [...index.keys()].filter((code) => municipalityCodes.has(code));
    const missingCodes = [...index.keys()].filter((code) => !municipalityCodes.has(code));

    expect(index.size).toBe(109);
    expect(mappedCodes).toHaveLength(108);
    expect(missingCodes).toEqual(["089192"]);
    expect(index.get("089192")?.changedBusinessCount).toBe(2);

    const katagami = municipalities.items.find((item: any) => item.municipalityCode === "052116");
    expect(katagami.businessKey).toBe("18-0-000");
    expect(index.get("052116")).toMatchObject({
      changedBusinessCount: 2,
      changes: [
        { businessKey: "17-1-000", businessName: "公共下水道" },
        { businessKey: "17-4-000", businessName: "特定環境保全公共下水道" }
      ]
    });
  });
});

function feeChange(
  municipalityCode: string | null,
  businessKey: string,
  businessName: string,
  r5EffectiveDate: string,
  r6EffectiveDate: string,
  changed = true
): YearbookFeeChange {
  return {
    id: `${municipalityCode}:${businessKey}`,
    municipalityCode,
    prefectureName: "テスト県",
    operatorName: "テスト市",
    businessKey,
    businessName,
    categoryCode: "17/1",
    direction: "unchanged",
    accountingType: "legal_applied",
    accountingTypes: { r5: "legal_applied", r6: "legal_applied" },
    currentUsageFeeEffectiveDate: {
      r5: { iso: r5EffectiveDate, raw: null },
      r6: { iso: r6EffectiveDate, raw: null },
      changed,
      r6WithinCurrentFiscalYear: true
    },
    previousUsageFeeRevisionDate: {
      r5: { iso: null, raw: null },
      r6: { iso: null, raw: null },
      r6MatchesR5Current: false
    },
    officialRevisionRate: {
      household20m3Percent: 5.2,
      averagePercent: 5.4,
      reported: true
    },
    householdFee20m3: { r5: null, r6: null, delta: null, changeRate: null },
    tariffChanges: [],
    tariffSystemChanges: [],
    supportReasons: []
  };
}

function feeSnapshot(
  surveyYear: 2023 | 2024,
  municipalityCode: string,
  businessKey: string,
  effectiveDate: string | null
): YearbookFeeSnapshot {
  return {
    surveyYear,
    municipalityCode,
    municipalityName: `自治体${municipalityCode}`,
    prefectureName: "テスト県",
    businessKey,
    businessName: "公共下水道",
    businessType: "公共下水道",
    categoryCode: "17/1",
    accountingType: "legal_applied",
    currentUsageFeeEffectiveDate: { iso: effectiveDate, raw: effectiveDate },
    previousUsageFeeRevisionDate: { iso: null, raw: null },
    householdFee20m3Yen: null,
    businessFeesYen: { 100: null, 500: null, 1000: null, 5000: null, 10000: null },
    revisionRatesPercent: { household20m3: null, average: null },
    tariffSystemSignals: {
      systemCodeRaw: null,
      waterVolumeRankCount: null,
      minimumExcessUnitPriceYenPerM3: null,
      maximumExcessUnitPriceYenPerM3: null,
      progressivity: null
    }
  };
}
