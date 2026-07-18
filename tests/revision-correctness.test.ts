import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatOfficialRevisionRate } from "../lib/format";
import { effectiveFiscalYear, revisionPeriodLabel } from "../lib/revisionEvents";
import {
  type ManualRevisionEventRecord,
  upsertManualRevisionEvent
} from "../scripts/etl/manualRevisionEvents";
import { readEstatSurveyYear } from "../scripts/etl/surveyYear";

describe("revision schedule correctness", () => {
  it("buckets January through March into the previous fiscal year", () => {
    expect(effectiveFiscalYear("2025-03-31")).toBe(2024);
    expect(effectiveFiscalYear("2025-04-01")).toBe(2025);
    expect(effectiveFiscalYear("2026年2月1日")).toBe(2025);
    expect(effectiveFiscalYear("2026年4月")).toBe(2026);

    expect(revisionPeriodLabel("2025-03-31")).toBe("2024年度内");
    expect(revisionPeriodLabel("2025-04-01")).toBe("2025年度");
    expect(revisionPeriodLabel("2026-01-15")).toBe("2025年度");
    expect(revisionPeriodLabel("2026-04-01")).toBe("2026年度");
    expect(revisionPeriodLabel("not-a-date")).toBe("未定");
    expect(revisionPeriodLabel(null)).toBe("未定");
  });

  it("formats official revision rates neutrally, including zero and reductions", () => {
    expect(formatOfficialRevisionRate(0.125)).toBe("12.5%");
    expect(formatOfficialRevisionRate(0)).toBe("0.0%");
    expect(formatOfficialRevisionRate(-0.05)).toBe("-5.0%");
    expect(formatOfficialRevisionRate(null)).toBe("未公表");
    expect(formatOfficialRevisionRate(Number.NaN)).toBe("未公表");
  });

  it("accepts only numeric R2-R6 settlement years from e-Stat rows", () => {
    expect(readEstatSurveyYear({ 決算年度: 2020 })).toBe(2020);
    expect(readEstatSurveyYear({ 決算年度: "2024" })).toBe(2024);
    expect(() => readEstatSurveyYear({})).toThrow(/missing a numeric 決算年度/);
    expect(() => readEstatSurveyYear({ 決算年度: 2019 })).toThrow(/Unsupported/);
    expect(() => readEstatSurveyYear({ 決算年度: 2025 })).toThrow(/Unsupported/);
    expect(() => readEstatSurveyYear({ 決算年度: 2024.5 })).toThrow(/Unsupported/);
  });

  it("updates the same manual revision event instead of creating a duplicate", async () => {
    const state: { stored: (ManualRevisionEventRecord & { id: number }) | null } = { stored: null };
    const delegate = {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (!state.stored) return null;
        const matches = Object.entries(where).every(([key, value]) => state.stored?.[key as keyof ManualRevisionEventRecord] === value);
        return matches ? { id: state.stored.id } : null;
      }),
      create: vi.fn(async ({ data }: { data: ManualRevisionEventRecord }) => {
        state.stored = { ...data, id: 1 };
        return state.stored;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: ManualRevisionEventRecord }) => {
        state.stored = { ...data, id: where.id };
        return state.stored;
      })
    };
    const event: ManualRevisionEventRecord = {
      municipalityId: 1,
      status: "confirmed",
      effectiveDate: "2025-04-01",
      announcedDate: "2024-12-01",
      averageRevisionRate: 0,
      targetBusiness: "公共下水道",
      title: "使用料改定",
      summary: "初回取込",
      sourceUrl: "https://example.test/revision",
      extractionConfidence: 1,
      checkedAt: "2026-07-17"
    };

    expect(await upsertManualRevisionEvent(delegate, event)).toBe("created");
    expect(await upsertManualRevisionEvent(delegate, { ...event, summary: "再確認済み" })).toBe("updated");
    expect(delegate.create).toHaveBeenCalledTimes(1);
    expect(delegate.update).toHaveBeenCalledTimes(1);
    expect(state.stored?.summary).toBe("再確認済み");
  });

  it("uses the official formatter only on the official revision page", () => {
    const source = readFileSync(path.join(process.cwd(), "app/revisions/page.tsx"), "utf8");
    expect(source).toContain("formatOfficialRevisionRate");
    expect(source).not.toContain("formatRevisionRate(");
  });
});
