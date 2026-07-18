import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const homeSource = readFileSync(path.join(root, "app/page.tsx"), "utf8");
const searchSource = readFileSync(path.join(root, "app/municipalities/page.tsx"), "utf8");
const searchFilterSource = readFileSync(path.join(root, "components/MunicipalitySearchFilters.tsx"), "utf8");
const mapPageSource = readFileSync(path.join(root, "app/map/page.tsx"), "utf8");
const mapComponentSource = readFileSync(path.join(root, "components/JapanMapSelector.tsx"), "utf8");
const headerSource = readFileSync(path.join(root, "components/SiteHeader.tsx"), "utf8");
const copySource = readFileSync(path.join(root, "lib/copy.ts"), "utf8");
const cssSource = readFileSync(path.join(root, "app/globals.css"), "utf8");
const searchImplementationSource = `${searchSource}\n${searchFilterSource}`;

function cssBlock(selector: string) {
  const start = cssSource.lastIndexOf(`${selector} {`);
  expect(start, `${selector} block exists`).toBeGreaterThanOrEqual(0);
  const end = cssSource.indexOf("}", start);
  expect(end, `${selector} block closes`).toBeGreaterThan(start);
  return cssSource.slice(start, end + 1);
}

function sourceAround(source: string, pattern: string, radius = 360) {
  const index = source.indexOf(pattern);
  expect(index, `${pattern} exists`).toBeGreaterThanOrEqual(0);
  return source.slice(Math.max(0, index - radius), index + pattern.length + radius);
}

describe("UI fidelity rebuild v2 guardrails", () => {
  it("keeps the updated product shell and reference navigation", () => {
    expect(copySource).toContain('siteName = "全国下水道使用料適正診断"');
    for (const label of ["ホーム", "全国マップ", "自治体検索", "ランキング", "改定情報", "データの見方"]) {
      expect(headerSource).toContain(`label: "${label}"`);
    }
    expect(headerSource).toContain("site-logo");
    expect(cssSource).toContain("min-height: 80px;");
    expect(cssSource).toContain(".site-nav a");
  });

  it("prevents mobile header navigation from returning to horizontal scroll", () => {
    expect(headerSource).toContain('className="site-mobile-nav');
    expect(headerSource).toContain('"site-mobile-nav-link"');
    const mobileNavSnippet = sourceAround(headerSource, 'className="site-mobile-nav', 420);
    expect(mobileNavSnippet).not.toContain("overflow-x-auto");
    expect(mobileNavSnippet).not.toContain("shrink-0");
    expect(cssSource).toContain(".site-mobile-nav");
    expect(cssSource).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
  });

  it("separates home dashboard map from full atlas map", () => {
    expect(homeSource).toContain("<JapanMapSelector summaries={prefectureSummaries} municipalities={mapMunicipalities} overview={data} />");
    expect(mapPageSource).toContain('variant="atlas"');
    expect(mapComponentSource).toContain('type JapanMapVariant = "home" | "atlas"');
    expect(mapComponentSource).toContain('variant = "home"');
    expect(mapComponentSource).toContain("function HomeNationalMap");
    expect(mapComponentSource).toContain("compact: boolean");
    expect(mapComponentSource).toContain('data-compact={compact ? "true" : "false"}');
    expect(mapComponentSource).toContain("function PrefectureSelectorPanel");
    expect(mapComponentSource).toContain("home-national-map-legend");
    expect(mapComponentSource).toContain("prefecture-region-tabs");
    expect(mapComponentSource).toContain("prefecturesByRegion(region)");
    expect(mapComponentSource).toContain("const [focusedRegion, setFocusedRegion] = useState<RegionName | null>(null);");
    expect(mapComponentSource).toContain("normalizedQuery || !activeRegion");
    expect(mapComponentSource).toContain("activeRegion={focusedRegion}");
    expect(mapComponentSource).toContain("onRegionChange={focusRegion}");
    expect(cssSource).toContain("grid-template-columns: minmax(0, 1fr) 424px;");
    expect(cssSource).toContain("height: 452px;");
    expect(cssBlock(".prefecture-region-list")).toContain("max-height: 290px");
    expect(cssBlock(".home-map-explorer--home .home-support-grid")).toContain("0.82fr");
  });

  it("keeps home dashboard required panels visible as real components", () => {
    expect(homeSource).toContain("home-kpi-cards");
    expect(homeSource).toContain("収録自治体数");
    expect(homeSource).toContain("経費回収率100%未満の割合");
    expect(mapComponentSource).toContain("<RankingPair items={municipalities} />");
    expect(mapComponentSource).toContain("<HowToCards />");
    expect(mapComponentSource).toContain('href="/municipalities" className="prefecture-all-link"');
    expect(mapComponentSource).not.toContain("<img");
    expect(mapComponentSource).not.toContain("backgroundImage");
  });

  it("rebuilds municipality search with multi-filter panel, KPI rail, real views, and dense results", () => {
    expect(searchSource).toContain("MunicipalitySearchFilterPanel");
    expect(searchImplementationSource).toContain("キーワード検索");
    expect(searchImplementationSource).toContain("都道府県");
    expect(searchImplementationSource).toContain("事業種別");
    expect(searchImplementationSource).toContain("法適用区分");
    expect(searchImplementationSource).toContain("経費回収率レンジ");
    expect(searchImplementationSource).toContain("流域下水道は常に除外");
    expect(searchFilterSource).toContain("filter-advanced-panel");
    expect(searchFilterSource).toContain("window.matchMedia(\"(max-width: 900px)\")");
    expect(searchFilterSource).toContain("advancedRef.current.open = !mediaQuery.matches || advancedActive;");
    expect(searchSource).toContain("const view: ViewMode");
    expect(searchSource).toContain("function MunicipalityCardGrid");
    expect(searchSource).toContain('view === "card" ? <MunicipalityCardGrid items={data.items} /> : <MunicipalityTable items={data.items} />');
    expect(searchSource).toContain('const limit = Number(getParam(params.limit) || 10);');
    expect(searchSource).toContain("page-size-menu");
    expect(cssSource).toContain("filter-advanced-grid");
    expect(cssBlock(".municipality-search-page .data-table td")).toContain("height: 40px");
  });

  it("uses real links for card/table toggles and preserves query-state navigation", () => {
    const toggleSnippet = sourceAround(searchSource, '<div className="view-toggle"', 760);
    expect(toggleSnippet).toContain("<Link");
    expect(toggleSnippet).toContain('view: "table"');
    expect(toggleSnippet).toContain('view: "card"');
    expect(toggleSnippet).not.toContain("<button");
    expect(searchSource).toContain('if (view && view !== "table") params.set("view", view);');
    expect(searchSource).toContain('href={municipalityHref({ ...filters, limit: size, page: 1 })}');
  });
});
