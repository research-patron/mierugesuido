import { describe, expect, it } from "vitest";
import {
  buildYearbookFeeComparison,
  type YearbookFeeSnapshot
} from "@/lib/yearbookFeeChanges";

describe("R5-R6 yearbook fee comparison", () => {
  it("separates the official revision rate from the household fee change rate", () => {
    const result = buildYearbookFeeComparison([
      snapshot({
        surveyYear: 2023,
        municipalityCode: "013331",
        municipalityName: "知内町",
        businessKey: "17-4-000",
        categoryCode: "17/4",
        currentUsageFeeEffectiveDate: { iso: "2014-08-01", raw: "4260801" },
        previousUsageFeeRevisionDate: { iso: "2003-06-01", raw: "4150601" },
        householdFee20m3Yen: 2685
      }),
      snapshot({
        surveyYear: 2024,
        municipalityCode: "013331",
        municipalityName: "知内町",
        businessKey: "17-4-000",
        categoryCode: "17/4",
        currentUsageFeeEffectiveDate: { iso: "2024-04-01", raw: "5060401" },
        previousUsageFeeRevisionDate: { iso: "2014-08-01", raw: "4260801" },
        householdFee20m3Yen: 3300,
        revisionRatesPercent: { household20m3: 26, average: 26 }
      })
    ]);

    expect(result.counts.supported).toEqual({ businessCount: 1, municipalityCount: 1 });
    expect(result.items[0]).toMatchObject({
      status: "reported_revision",
      accountingTypes: { r5: "legal_applied", r6: "legal_applied" },
      previousUsageFeeRevisionDate: { r6MatchesR5Current: true },
      officialRevisionRate: {
        household20m3Percent: 26,
        averagePercent: 26,
        reported: true
      },
      householdFee20m3: { r5: 2685, r6: 3300, delta: 615 }
    });
    expect(result.items[0].householdFee20m3.changeRate! * 100).toBeCloseTo(22.9, 1);
    expect(result.items[0].householdFee20m3.changeRate! * 100).not.toBe(26);
  });

  it("keeps a backwards effective-date change as a candidate", () => {
    const result = buildYearbookFeeComparison([
      snapshot({ surveyYear: 2023, currentUsageFeeEffectiveDate: date("2020-04-01") }),
      snapshot({ surveyYear: 2024, currentUsageFeeEffectiveDate: date("2019-04-01") })
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      status: "revision_candidate",
      currentUsageFeeEffectiveDate: { changed: true, r6WithinCurrentFiscalYear: false }
    });
    expect(result.counts).toMatchObject({
      dateChanged: { businessCount: 1 },
      currentYear: { businessCount: 0 },
      candidate: { businessCount: 1 }
    });
  });

  it("keeps a business-only tariff change separate from a dated revision", () => {
    const result = buildYearbookFeeComparison([
      snapshot({
        surveyYear: 2023,
        currentUsageFeeEffectiveDate: date("2020-04-01"),
        householdFee20m3Yen: 3000,
        businessFeesYen: businessFees({ 100: 20_000 })
      }),
      snapshot({
        surveyYear: 2024,
        currentUsageFeeEffectiveDate: date("2020-04-01"),
        householdFee20m3Yen: 3000,
        businessFeesYen: businessFees({ 100: 21_000 })
      })
    ]);

    expect(result.items[0]).toMatchObject({
      status: "amount_difference_only",
      direction: "unchanged",
      householdFee20m3: { delta: 0, changeRate: 0 }
    });
    expect(result.items[0].tariffChanges).toEqual([{
      key: "businessFee100m3Yen",
      label: "業務用100m³／月",
      r5: 20_000,
      r6: 21_000,
      delta: 1_000
    }]);
    expect(result.counts.amountOnly).toEqual({ businessCount: 1, municipalityCount: 1 });
  });

  it("pairs the same business across an accounting-basis transition", () => {
    const result = buildYearbookFeeComparison([
      snapshot({
        surveyYear: 2023,
        accountingType: "non_legal_applied",
        currentUsageFeeEffectiveDate: date("2018-04-01")
      }),
      snapshot({
        surveyYear: 2024,
        accountingType: "legal_applied",
        currentUsageFeeEffectiveDate: date("2024-10-01"),
        previousUsageFeeRevisionDate: date("2018-04-01")
      })
    ]);

    expect(result.counts.common.businessCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      status: "reported_revision",
      accountingType: "legal_applied",
      accountingTypes: { r5: "non_legal_applied", r6: "legal_applied" }
    });
  });

  it("excludes missing effective dates and unpaired years from comparable results", () => {
    const result = buildYearbookFeeComparison([
      snapshot({ surveyYear: 2023, municipalityCode: "013331", currentUsageFeeEffectiveDate: date(null) }),
      snapshot({ surveyYear: 2024, municipalityCode: "013331", currentUsageFeeEffectiveDate: date("2024-04-01") }),
      snapshot({ surveyYear: 2024, municipalityCode: "999999", currentUsageFeeEffectiveDate: date("2024-04-01") })
    ]);

    expect(result.counts.common).toEqual({ businessCount: 1, municipalityCount: 1 });
    expect(result.counts.comparable).toEqual({ businessCount: 0, municipalityCount: 0 });
    expect(result.items).toEqual([]);
  });

  it("reports every comparison stage for businesses and municipalities", () => {
    const result = buildYearbookFeeComparison([
      ...pair("reported", {
        currentR5: "2014-08-01",
        currentR6: "2024-04-01",
        previousR6: "2014-08-01"
      }),
      ...pair("candidate", { currentR5: "2020-04-01", currentR6: "2019-04-01" }),
      ...pair("amount", { currentR5: "2020-04-01", currentR6: "2020-04-01", r5Fee: 3000, r6Fee: 3200 }),
      ...pair("missing", { currentR5: null, currentR6: "2024-04-01" })
    ]);

    expect(result.counts).toEqual({
      common: { businessCount: 4, municipalityCount: 4 },
      comparable: { businessCount: 3, municipalityCount: 3 },
      dateChanged: { businessCount: 2, municipalityCount: 2 },
      currentYear: { businessCount: 1, municipalityCount: 1 },
      supported: { businessCount: 1, municipalityCount: 1 },
      candidate: { businessCount: 1, municipalityCount: 1 },
      amountOnly: { businessCount: 1, municipalityCount: 1 }
    });
  });

  it("rejects duplicate snapshots for the same business and year", () => {
    const duplicate = snapshot({ surveyYear: 2023 });
    expect(() => buildYearbookFeeComparison([duplicate, { ...duplicate }]))
      .toThrow("同一年度の料金スナップショットが重複しています");
  });
});

function pair(name: string, values: {
  currentR5: string | null;
  currentR6: string | null;
  previousR6?: string | null;
  r5Fee?: number | null;
  r6Fee?: number | null;
}): YearbookFeeSnapshot[] {
  const municipalityCode = `code-${name}`;
  return [
    snapshot({
      surveyYear: 2023,
      municipalityCode,
      municipalityName: name,
      currentUsageFeeEffectiveDate: date(values.currentR5),
      householdFee20m3Yen: values.r5Fee ?? null
    }),
    snapshot({
      surveyYear: 2024,
      municipalityCode,
      municipalityName: name,
      currentUsageFeeEffectiveDate: date(values.currentR6),
      previousUsageFeeRevisionDate: date(values.previousR6 ?? null),
      householdFee20m3Yen: values.r6Fee ?? null
    })
  ];
}

function snapshot(overrides: Partial<YearbookFeeSnapshot> & Pick<YearbookFeeSnapshot, "surveyYear">): YearbookFeeSnapshot {
  const { surveyYear, ...rest } = overrides;
  return {
    surveyYear,
    municipalityCode: "063622",
    municipalityName: "最上町",
    prefectureName: "山形県",
    businessKey: "17-1-000",
    businessName: "公共下水道",
    categoryCode: "17/1",
    accountingType: "legal_applied",
    currentUsageFeeEffectiveDate: date("2020-04-01"),
    previousUsageFeeRevisionDate: date(null),
    householdFee20m3Yen: null,
    businessFeesYen: businessFees({}),
    revisionRatesPercent: { household20m3: null, average: null },
    tariffSystemSignals: {
      systemCodeRaw: null,
      waterVolumeRankCount: null,
      minimumExcessUnitPriceYenPerM3: null,
      maximumExcessUnitPriceYenPerM3: null,
      progressivity: null
    },
    ...rest
  };
}

function date(iso: string | null) {
  return { iso, raw: null };
}

function businessFees(values: Partial<Record<100 | 500 | 1000 | 5000 | 10000, number | null>>) {
  return {
    100: null,
    500: null,
    1000: null,
    5000: null,
    10000: null,
    ...values
  };
}
