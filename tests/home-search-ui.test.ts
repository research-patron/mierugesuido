import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const homeSource = readFileSync(path.join(root, "app/page.tsx"), "utf8");
const searchSource = readFileSync(path.join(root, "app/municipalities/page.tsx"), "utf8");
const searchFilterSource = readFileSync(path.join(root, "components/MunicipalitySearchFilters.tsx"), "utf8");
const municipalityTableSource = readFileSync(path.join(root, "components/MunicipalityTable.tsx"), "utf8");
const mapPageSource = readFileSync(path.join(root, "app/map/page.tsx"), "utf8");
const mapComponentSource = readFileSync(path.join(root, "components/JapanMapSelector.tsx"), "utf8");
const headerSource = readFileSync(path.join(root, "components/SiteHeader.tsx"), "utf8");
const copySource = readFileSync(path.join(root, "lib/copy.ts"), "utf8");
const cssSource = readFileSync(path.join(root, "app/globals.css"), "utf8");
const fidelityCssSource = readFileSync(path.join(root, "app/ui-fidelity.css"), "utf8");
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

function bracedBlock(source: string, startPattern: string) {
  const start = source.indexOf(startPattern);
  expect(start, `${startPattern} block exists`).toBeGreaterThanOrEqual(0);
  const openingBrace = source.indexOf("{", start);
  expect(openingBrace, `${startPattern} block opens`).toBeGreaterThan(start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${startPattern} block does not close`);
}

describe("UI fidelity rebuild v2 guardrails", () => {
  it("keeps the updated product shell and reference navigation", () => {
    expect(copySource).toContain('siteName = "まる見え！全国の下水道使用料"');
    expect(copySource).toContain('siteSubtitle = "― あなたのまちの使用料を診断・比較 ―"');
    expect(headerSource).toContain("{siteSubtitle}");
    expect(headerSource).not.toContain("block truncate");
    expect(fidelityCssSource).toContain(".site-brand-copy");
    expect(fidelityCssSource).toContain("white-space: nowrap;");
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
    expect(homeSource).toContain("mapScopes={mapScopes} initialScope={defaultMapScope}");
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
    const homeMapLayout = bracedBlock(fidelityCssSource, ".home-map-layout--home");
    const homeSupportLayout = bracedBlock(fidelityCssSource, ".home-map-explorer--home .home-support-grid");
    expect(homeMapLayout).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(homeMapLayout).not.toContain(".home-map-layout--atlas");
    expect(homeSupportLayout).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(homeSupportLayout).not.toContain(".home-map-explorer--atlas");
  });

  it("keeps four desktop KPI columns and the existing two-column mobile rail", () => {
    const baseKpiLayout = bracedBlock(fidelityCssSource, ".home-kpi-cards");
    const compactDesktop = bracedBlock(fidelityCssSource, "@media (max-width: 1280px)");
    const mobileLayout = bracedBlock(fidelityCssSource, "@media (max-width: 900px)");
    const mobileKpiLayout = bracedBlock(mobileLayout, ".home-kpi-cards");

    expect(homeSource.match(/<StatCard\b/g)).toHaveLength(4);
    expect(baseKpiLayout).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(compactDesktop).not.toMatch(/\.home-kpi-cards\s*\{[^}]*grid-template-columns/s);
    expect(mobileKpiLayout).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });

  it("keeps home dashboard required panels visible as real components", () => {
    expect(homeSource).toContain("home-kpi-cards");
    expect(homeSource).toContain("収録自治体数");
    expect(homeSource).toContain("公共下水道：100%未満の割合");
    expect(homeSource).toContain('label="施行年月日が変わった団体"');
    expect(homeSource).toContain("R5→R6の変更一覧");
    expect(homeSource).toContain("changedMunicipalityCount");
    expect(homeSource).toContain("changedBusinessCount");
    expect(homeSource).toContain("施行年月日の変更一覧を見る");
    expect(homeSource).toContain('href="/revisions"');
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
    expect(searchSource).toContain('const requestedLimit = Number(searchParams.get("limit") || 10);');
    expect(searchSource).toContain('fetch("/data/static/municipalities.json")');
    expect(searchSource).toContain("page-size-menu");
    expect(searchSource).toContain("search-summary-footer");
    expect(cssSource).toContain("filter-advanced-grid");
    expect(cssBlock(".municipality-search-page .data-table td")).toContain("height: 40px");
  });

  it("uses the strict R5-R6 effective-date comparison as municipality revision information", () => {
    expect(searchSource).toContain('searchParams.get("hasFeeRevisionChange")');
    expect(searchSource).toContain('searchParams.get("hasRevisionEvent")');
    expect(searchSource).toContain('params.set("hasFeeRevisionChange", hasFeeRevisionChange)');
    expect(searchSource).not.toContain('params.set("hasRevisionEvent"');
    expect(searchSource).toContain("municipalityFeeRevisionStatus(item.feeRevisionComparison)");
    expect(searchSource).not.toContain("item.hasRevisionEvent");
    expect(searchSource).toContain('label="改定情報の掲載"');
    expect(searchFilterSource).toContain('label="改定情報"');
    expect(searchFilterSource).toContain('name="hasFeeRevisionChange"');
    expect(searchFilterSource).toContain("施行年月日が変化");
    expect(searchFilterSource).toContain("改定情報なし（比較済み）");
    expect(searchFilterSource).toContain('label="比較指標・並び順"');
    expect(searchFilterSource).toContain("経費回収率｜高い順");
    expect(searchFilterSource).toContain("経費回収率｜低い順");
    expect(searchFilterSource).toContain("使用料単価｜高い順");
    expect(searchFilterSource).toContain("使用料単価｜低い順");
    expect(searchFilterSource).not.toContain("required-revision-high");
    expect(municipalityTableSource).toContain("施行年月日が変化");
    expect(municipalityTableSource).toContain("改定情報なし");
    expect(municipalityTableSource).toContain("比較対象外");
    expect(municipalityTableSource).toContain("change.businessName");
    expect(municipalityTableSource).toContain("change.r5EffectiveDate");
    expect(municipalityTableSource).toContain("change.r6EffectiveDate");
    expect(municipalityTableSource).not.toContain("公式改定情報");
    expect(municipalityTableSource).not.toContain("item.hasRevisionEvent");
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
