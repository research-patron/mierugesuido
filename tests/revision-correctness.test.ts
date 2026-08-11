import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatOfficialRevisionRate } from "../lib/format";
import { effectiveFiscalYear, revisionPeriodLabel } from "../lib/revisionEvents";
import { isStaticRevisionDataset } from "../lib/staticRevisionDataset";
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

  it("lists only effective-date changes and keeps monetary fields as reference details", () => {
    const source = readFileSync(path.join(process.cwd(), "app/revisions/page.tsx"), "utf8");
    expect(source).toContain("主判定項目");
    expect(source).toContain("現行使用料施行年月日");
    expect(source).toContain("金額差だけでは一覧に含めません");
    expect(source).toContain("hasChangedEffectiveDateShape");
    expect(source).toContain("第33表の公式記載");
    expect(source).toContain("20m³料金の単純変化率");
    expect(source).toContain("公式の実質使用料改定率とは異なる単純計算です。");
    expect(source).toContain("業務用料金・料金体系・関連項目を見る");
    expect(source).toContain("自治体が公式に公表した改定情報");
    expect(source.match(/<StatCard\b/g)).toHaveLength(2);
    expect(source).toContain("changedMunicipalityCount");
    expect(source).toContain("changedBusinessCount");
    expect(source).not.toContain("判定区分");
    expect(source).not.toContain("金額差のみ");
    expect(source).not.toContain("revision_candidate");
    expect(source).toContain('role="combobox"');
    expect(source).toContain('aria-autocomplete="list"');
    expect(source).toContain('role="listbox"');
    expect(source).toContain("文字入力でも、候補の選択でも絞り込めます。");
    expect(source).toContain("const revisionGroupPageSize = 40");
    expect(source).toContain("さらに{Math.min(revisionGroupPageSize");
    expect(source.match(/onKeyDown=\{toggleDetailsOnKeyboard\}/g)).toHaveLength(2);
    expect(source).not.toContain("feeUnitPrice");
    expect(source).not.toContain("増減方向");
  });

  it("groups the revision list by municipality and paginates whole groups", () => {
    const dataset = JSON.parse(readFileSync(
      path.join(process.cwd(), "public/data/static/revisions.json"),
      "utf8"
    ));
    const municipalityCodes = dataset.yearbookFeeComparison.items.map((item: any) => item.municipalityCode);
    expect(new Set(municipalityCodes).size).toBe(dataset.yearbookFeeComparison.changedMunicipalityCount);
    expect(municipalityCodes).toHaveLength(dataset.yearbookFeeComparison.changedBusinessCount);

    const source = readFileSync(path.join(process.cwd(), "app/revisions/page.tsx"), "utf8");
    expect(source).toContain("function groupYearbookChangesByMunicipality");
    expect(source).toContain("const groupsByKey = new Map<string, RevisionMunicipalityGroup>()");
    expect(source).toContain("existing.items.push(item)");
    expect(source).toContain('<section className="revision-municipality-group" aria-labelledby={headingId}>');
    expect(source).toContain("<h3 id={headingId}>");
    expect(source).toContain("<h4 id={businessHeadingId}>");
    expect(source.match(/<h5>/g)).toHaveLength(3);
    expect(source).toContain("団体（${visibleBusinessCount.toLocaleString");
    expect(source).toContain("setVisibleGroupCount((current) => current + revisionGroupPageSize)");
  });

  it("keeps an empty prefecture suggestion list unselected and recoverable", () => {
    const source = readFileSync(path.join(process.cwd(), "app/revisions/page.tsx"), "utf8");

    expect(source).toContain("if (options.length === 0) return -1;");
    expect(source).toContain("activeOption !== undefined");
    expect(source).toContain("choose(activeOption)");
    expect(source).not.toContain("choose(filteredOptions[activeIndex])");
    expect(source).toContain("aria-activedescendant={open && activeOption !== undefined");
    expect(source).toContain("const nextFilteredOptions = filterPrefectureOptions(options, nextQuery);");
    expect(source).toContain("setActiveIndex(firstPrefectureOptionIndex(nextFilteredOptions));");
    expect(source).toContain("setActiveIndex(firstPrefectureOptionIndex(options));");
  });

  it("never presents zero results while revision data is loading or unavailable", () => {
    const source = readFileSync(path.join(process.cwd(), "app/revisions/page.tsx"), "utf8");

    expect(source).toContain('type RevisionLoadState = "loading" | "ready" | "error";');
    expect(source).toContain('useState<RevisionLoadState>("loading")');
    expect(source).toContain('setLoadState("ready")');
    expect(source).toContain('setLoadState("error")');
    expect(source).toContain('aria-busy={isLoading}');
    expect(source).toContain('role="status"');
    expect(source).toContain('施行年月日比較データを読み込んでいます');
    expect(source).toContain('role="alert"');
    expect(source).toContain('施行年月日比較データを取得できませんでした');
    expect(source).toContain('再試行する');
    expect(source).toContain('ページを再読み込みしてください');
    expect(source).toContain('setLoadAttempt((current) => current + 1)');
    expect(source).toContain('isStaticRevisionDataset(json)');
    expect(source).not.toContain('.catch(() => undefined)');
    expect(source).not.toContain('(comparison?.changedMunicipalityCount ?? 0)');
    expect(source).not.toContain('(comparison?.changedBusinessCount ?? 0)');
    expect(source.match(/<StatCard\b/g)).toHaveLength(2);
  });

  it("rejects incomplete revision payloads before rendering them", () => {
    const validDataset = JSON.parse(readFileSync(
      path.join(process.cwd(), "public/data/static/revisions.json"),
      "utf8"
    ));
    const firstComparisonItem = validDataset.yearbookFeeComparison.items[0];

    expect(isStaticRevisionDataset(validDataset)).toBe(true);
    expect(isStaticRevisionDataset({ ...validDataset, summary: {} })).toBe(false);
    expect(isStaticRevisionDataset({
      ...validDataset,
      yearbookFeeComparison: {
        ...validDataset.yearbookFeeComparison,
        items: [{ ...firstComparisonItem, tariffChanges: null }]
      }
    })).toBe(false);
    expect(isStaticRevisionDataset({
      ...validDataset,
      yearbookFeeComparison: {
        ...validDataset.yearbookFeeComparison,
        changedBusinessCount: validDataset.yearbookFeeComparison.changedBusinessCount + 1
      }
    })).toBe(false);

    const generatedEventWithNullableCode = {
      id: 1,
      targetBusiness: null,
      averageRevisionRate: null,
      effectiveDate: null,
      sourceUrl: "https://example.test/revision",
      municipality: {
        municipalityCode: null,
        municipalityName: "コード未登録団体",
        prefectureName: "テスト県"
      }
    };
    expect(isStaticRevisionDataset({
      ...validDataset,
      summary: { ...validDataset.summary, total: 1 },
      items: [generatedEventWithNullableCode]
    })).toBe(true);
  });
});
