import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RankingNav } from "@/components/RankingNav";
import { rankingMetricValue } from "@/lib/rankingDisplay";
import {
  rankingLabels,
  rankingMetrics,
  rankingSelection,
  type RankingType
} from "@/lib/rankings";

const root = process.cwd();
const dataSource = readFileSync(path.join(root, "lib/data.ts"), "utf8");
const rankingPageSource = readFileSync(path.join(root, "app/rankings/page.tsx"), "utf8");
const searchFilterSource = readFileSync(path.join(root, "components/MunicipalitySearchFilters.tsx"), "utf8");
const searchPageSource = readFileSync(path.join(root, "app/municipalities/page.tsx"), "utf8");
const prefectureSelectorSource = readFileSync(path.join(root, "components/JapanMapSelector.tsx"), "utf8");

describe("ranking basis and bidirectional comparison", () => {
  it("publishes four retained metrics in both directions and no required-increase ranking", () => {
    const types = Object.keys(rankingLabels) as RankingType[];

    expect(rankingMetrics.map((item) => item.metric)).toEqual([
      "expense-recovery",
      "fee-unit",
      "treatment-cost",
      "transfer-amount"
    ]);
    expect(types).toHaveLength(8);
    for (const metric of rankingMetrics) {
      expect(types).toContain(metric.types.high);
      expect(types).toContain(metric.types.low);
      expect(rankingSelection(metric.types.high)).toMatchObject({ direction: "high", metric: { metric: metric.metric } });
      expect(rankingSelection(metric.types.low)).toMatchObject({ direction: "low", metric: { metric: metric.metric } });
    }
    expect(types.join(" ")).not.toContain("required-revision");
    expect(dataSource).not.toContain("highRevision");
  });

  it("renders a compact URL-addressable selector that preserves metric and direction independently", () => {
    const types = Object.keys(rankingLabels) as RankingType[];
    const destinations = rankingMetrics.flatMap((metric) => [metric.types.high, metric.types.low]);

    expect(destinations).toHaveLength(8);
    expect(new Set(destinations).size).toBe(8);
    expect([...destinations].sort()).toEqual([...types].sort());

    for (const current of types) {
      const markup = renderToStaticMarkup(createElement(RankingNav, { current }));
      const { metric: selectedMetric, direction } = rankingSelection(current);
      const hrefs = [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

      expect(hrefs).toEqual([
        ...rankingMetrics.map((metric) => `/rankings/${metric.types[direction]}`),
        `/rankings/${selectedMetric.types.high}`,
        `/rankings/${selectedMetric.types.low}`
      ]);
      expect(markup.match(/aria-current="page"/g)).toHaveLength(2);
      expect(markup.match(/aria-label="選択中"/g)).toHaveLength(1);
      const highAccessible = selectedMetric.metric === "transfer-amount" ? "金額が大きい順" : "値が高い順";
      const lowAccessible = selectedMetric.metric === "transfer-amount" ? "金額が小さい順" : "値が低い順";
      expect(markup).toContain(`aria-label="${selectedMetric.label}を${highAccessible}で表示"`);
      expect(markup).toContain(`aria-label="${selectedMetric.label}を${lowAccessible}で表示"`);
      expect(markup).not.toContain("大きい値から");
      expect(markup).not.toContain("小さい値から");
      expect(markup).toContain('aria-label="比較する指標"');
      expect(markup).toContain('aria-label="並び順"');
      expect(markup).toContain('aria-labelledby="ranking-condition-title"');
      expect(markup).toContain('aria-describedby="ranking-condition-description"');
      expect(markup).toContain("気になる指標を選ぶだけで、全国の並びをすぐに切り替えられます");
      expect(markup).not.toContain("<fieldset");
    }

    expect(rankingPageSource).not.toContain("下の比較ビューから、見たい指標と並び順をすぐに切り替えられます");
    expect(rankingPageSource).not.toContain("使用料収入の必要増加率");
  });

  it("offers symmetric official-indicator sorts in search surfaces", () => {
    const sources = `${searchFilterSource}\n${searchPageSource}\n${prefectureSelectorSource}`;
    for (const label of [
      "経費回収率｜高い順",
      "経費回収率｜低い順",
      "使用料単価｜高い順",
      "使用料単価｜低い順",
      "汚水処理原価｜高い順",
      "汚水処理原価｜低い順"
    ]) {
      expect(searchFilterSource).toContain(label);
    }
    expect(searchFilterSource).toContain('label="比較指標・並び順"');
    expect(sources).not.toContain("required-revision-high");
    expect(sources).not.toContain("revision-desc");
  });

  it("generates exactly the retained ranking routes in the requested direction", () => {
    const manifest = JSON.parse(readFileSync(path.join(root, "data/static/manifest.json"), "utf8"));
    const home = JSON.parse(readFileSync(path.join(root, "data/static/home.json"), "utf8"));
    const types = Object.keys(rankingLabels) as RankingType[];

    expect(manifest.rankingTypes).toEqual(types);
    expect(existsSync(path.join(root, "data/static/rankings/required-revision-high.json"))).toBe(false);
    expect(home.overview).not.toHaveProperty("highRevision");
    expect(home.mapScopes.public.overview).not.toHaveProperty("highRevision");
    expect(home.mapScopes.tokkan.overview).not.toHaveProperty("highRevision");

    for (const type of types) {
      const rows = JSON.parse(readFileSync(path.join(root, `data/static/rankings/${type}.json`), "utf8"));
      const values = rows.map((row: unknown) => rankingMetricValue(row, type));
      expect(values.every((value: number | null) => value != null && Number.isFinite(value))).toBe(true);
      const { direction } = rankingSelection(type);
      for (let index = 1; index < values.length; index += 1) {
        if (direction === "high") expect(values[index - 1]).toBeGreaterThanOrEqual(values[index]);
        else expect(values[index - 1]).toBeLessThanOrEqual(values[index]);
      }
    }
  });
});
