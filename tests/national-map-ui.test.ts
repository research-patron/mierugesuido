import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ATLAS_HOKKAIDO_OVERVIEW_SCALE_Y,
  ATLAS_KAGOSHIMA_REMOTE_ISLAND_CUTOFF_Y,
  ATLAS_NAGASAKI_REMOTE_ISLAND_MIN_X,
  ATLAS_NAGASAKI_REMOTE_ISLAND_MIN_Y,
  NATIONAL_OVERVIEW_VIEWBOX,
  NATIONAL_TOKYO_REMOTE_ISLAND_CUTOFF_Y,
  atlasDisplayPath,
  atlasOverviewPath,
  combineBounds,
  mapFeatureHref,
  nationalOverviewPath,
  pathScreenBounds,
  screenViewBox,
  splitSubpaths
} from "@/lib/gisMapLayout";
import {
  getPrefectureCode,
  normalizePrefectureName,
  prefecturesByRegion,
  regionNames
} from "@/lib/prefectures";

type Bounds = [number, number, number, number];

type GisFeature = {
  code: string;
  name: string;
  layoutGroup?: string;
  path: string;
};

type GisData = {
  prefectures: GisFeature[];
};

const componentSource = readFileSync(
  path.join(process.cwd(), "components/JapanMapSelector.tsx"),
  "utf8"
);
const cssSource = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
const fidelityCssSource = readFileSync(path.join(process.cwd(), "app/ui-fidelity.css"), "utf8");
const gisData = JSON.parse(
  readFileSync(path.join(process.cwd(), "public/gis/mlit-n03-simplified.json"), "utf8")
) as GisData;

function featureByName(name: string) {
  const feature = gisData.prefectures.find((item) => item.name === name);
  expect(feature, `${name} exists`).toBeDefined();
  return feature!;
}

function pathBounds(svgPath: string): Bounds {
  const bounds = pathScreenBounds(svgPath);
  expect(bounds, "path has bounds").toBeTruthy();
  return bounds!;
}

function cssBlock(selector: string) {
  const start = cssSource.indexOf(`${selector} {`);
  expect(start, `${selector} block exists`).toBeGreaterThanOrEqual(0);
  const end = cssSource.indexOf("}", start);
  expect(end, `${selector} block closes`).toBeGreaterThan(start);
  return cssSource.slice(start, end + 1);
}

function cssBlockFromStart(startPattern: string) {
  const start = cssSource.indexOf(startPattern);
  expect(start, `${startPattern} block exists`).toBeGreaterThanOrEqual(0);
  const end = cssSource.indexOf("}", start);
  expect(end, `${startPattern} block closes`).toBeGreaterThan(start);
  return cssSource.slice(start, end + 1);
}

function componentSnippetAround(pattern: string, radius = 420) {
  const index = componentSource.indexOf(pattern);
  expect(index, `${pattern} exists`).toBeGreaterThanOrEqual(0);
  return componentSource.slice(Math.max(0, index - radius), index + pattern.length + radius);
}

function componentPathElementAround(pattern: string) {
  const index = componentSource.indexOf(pattern);
  expect(index, `${pattern} exists`).toBeGreaterThanOrEqual(0);
  const start = componentSource.lastIndexOf("<path", index);
  const end = componentSource.indexOf("/>", index);
  expect(start, `${pattern} path starts`).toBeGreaterThanOrEqual(0);
  expect(end, `${pattern} path ends`).toBeGreaterThan(index);
  return componentSource.slice(start, end + 2);
}

function componentOpeningTagAround(pattern: string) {
  const index = componentSource.indexOf(pattern);
  expect(index, `${pattern} exists`).toBeGreaterThanOrEqual(0);
  const start = componentSource.lastIndexOf("<", index);
  const end = componentSource.indexOf(">", index);
  expect(start, `${pattern} tag starts`).toBeGreaterThanOrEqual(0);
  expect(end, `${pattern} tag ends`).toBeGreaterThan(index);
  return componentSource.slice(start, end + 1);
}

function componentFunctionBlock(name: string) {
  const start = componentSource.indexOf(`function ${name}`);
  expect(start, `${name} function exists`).toBeGreaterThanOrEqual(0);
  const nextFunction = componentSource.indexOf("\nfunction ", start + 1);
  return componentSource.slice(start, nextFunction > start ? nextFunction : undefined);
}

describe("national map UI guardrails", () => {
  it("keeps the main atlas layer focused on the readable main map", () => {
    const [x, y, width, height] = NATIONAL_OVERVIEW_VIEWBOX.trim().split(/\s+/).map(Number);
    const [minX, minY, maxX, maxY] = combineBounds(
      gisData.prefectures
        .filter((feature) => !feature.layoutGroup || feature.layoutGroup === "main")
        .map((feature) => pathBounds(atlasOverviewPath(feature)))
    );

    expect(x).toBeLessThanOrEqual(minX);
    expect(y).toBeLessThanOrEqual(minY);
    expect(x + width).toBeGreaterThanOrEqual(maxX);
    expect(y + height).toBeGreaterThanOrEqual(maxY);
    expect((maxX - minX) / width).toBeGreaterThan(0.66);
    expect((maxY - minY) / height).toBeGreaterThan(0.66);
  });

  it("omits Tokyo archipelago from the national overview path only", () => {
    const tokyo = featureByName("東京都");
    const displayPath = nationalOverviewPath(tokyo);
    const displayBounds = pathBounds(displayPath);

    expect(splitSubpaths(displayPath).length).toBeLessThan(splitSubpaths(tokyo.path).length);
    expect(displayBounds[3]).toBeLessThanOrEqual(NATIONAL_TOKYO_REMOTE_ISLAND_CUTOFF_Y);
    expect(componentSource).toContain("const displayPath = atlasDisplayPath(feature);");
  });

  it("omits Nagasaki and Kagoshima archipelagos from the atlas overview only", () => {
    const nagasaki = featureByName("長崎県");
    const kagoshima = featureByName("鹿児島");
    const nagasakiDisplayPath = atlasOverviewPath(nagasaki);
    const displayPath = atlasOverviewPath(kagoshima);
    const nagasakiBounds = pathBounds(nagasakiDisplayPath);
    const displayBounds = pathBounds(displayPath);

    expect(splitSubpaths(nagasakiDisplayPath).length).toBeLessThan(splitSubpaths(nagasaki.path).length);
    expect(nagasakiBounds[0]).toBeGreaterThanOrEqual(ATLAS_NAGASAKI_REMOTE_ISLAND_MIN_X);
    expect(nagasakiBounds[1]).toBeGreaterThanOrEqual(ATLAS_NAGASAKI_REMOTE_ISLAND_MIN_Y);
    expect(splitSubpaths(displayPath).length).toBeLessThan(splitSubpaths(kagoshima.path).length);
    expect(displayBounds[3]).toBeLessThanOrEqual(ATLAS_KAGOSHIMA_REMOTE_ISLAND_CUTOFF_Y);
    expect(componentSource).toContain("atlasDisplayPath");
  });

  it("applies Hokkaido vertical correction only to the atlas display path", () => {
    const hokkaido = featureByName("北海道");
    const overviewPath = atlasOverviewPath(hokkaido);
    const displayPath = atlasDisplayPath(hokkaido);
    const overviewBounds = pathBounds(overviewPath);
    const displayBounds = pathBounds(displayPath);

    expect(ATLAS_HOKKAIDO_OVERVIEW_SCALE_Y).toBeGreaterThan(1);
    expect(displayPath).not.toBe(overviewPath);
    expect(displayBounds[0]).toBeCloseTo(overviewBounds[0], 1);
    expect(displayBounds[2]).toBeCloseTo(overviewBounds[2], 1);
    expect(displayBounds[3] - displayBounds[1]).toBeGreaterThan((overviewBounds[3] - overviewBounds[1]) * 1.07);
    expect(componentSource).toContain("atlasDisplayPath(feature)");
    expect(componentSource).toContain("pathScreenBounds(atlasDisplayPath(feature))");
  });

  it("uses the same home renderer, selector, and three controls for home and atlas", () => {
    const explorer = componentFunctionBlock("NationalMapExplorer");
    const homeRenderer = componentFunctionBlock("HomeNationalMap");

    expect(explorer.match(/<HomeNationalMap/g)).toHaveLength(1);
    expect(explorer).toContain("const [focusedRegion, setFocusedRegion] = useState<RegionName | null>(null);");
    expect(explorer).toContain("focusedRegion={focusedRegion}");
    expect(explorer).toContain("activeRegion={focusedRegion}");
    expect(explorer).toContain("onRegionChange={focusRegion}");
    expect(explorer).toContain("setFocusedRegion((current) => current === region ? null : region);");
    expect(explorer).toContain("setFocusedRegion(null);");
    expect(explorer).toContain('className="map-control-stack map-control-stack--home"');
    expect(explorer.match(/aria-label="拡大"/g)).toHaveLength(1);
    expect(explorer.match(/aria-label="縮小"/g)).toHaveLength(1);
    expect(explorer.match(/aria-label="全国を表示"/g)).toHaveLength(1);
    expect(explorer).toContain('"gis-map-surface--home-national"');
    expect(componentSource).not.toContain("function AtlasNationalMap");
    expect(componentSource).not.toContain("ATLAS_VIEWBOX");
    expect(componentSource).not.toContain("ATLAS_CONNECTORS");
    expect(componentSource).not.toContain("map-control-stack--atlas");
    expect(homeRenderer).toContain('const viewBox = compact ? "0 0 390 440" : "0 0 980 500";');
    expect(homeRenderer).toContain('{ title: "北海道", name: "北海道", x: 250, y: 18, width: 160, height: 104 }');
    expect(homeRenderer).toContain('{ title: "沖縄県", name: "沖縄県", x: 812, y: 372, width: 142, height: 94 }');
    expect(fidelityCssSource).toContain(".home-map-layout--home,\n.home-map-layout--atlas");
  });

  it("focuses every selector region while keeping the default national composition", () => {
    const homeRenderer = componentFunctionBlock("HomeNationalMap");
    const selector = componentFunctionBlock("PrefectureSelectorPanel");
    const nationalMainFeatures = gisData.prefectures.filter(
      (feature) => !feature.layoutGroup || feature.layoutGroup === "main"
    );
    const nationalViewBox = screenViewBox(
      nationalMainFeatures.map((feature) => ({ ...feature, path: atlasDisplayPath(feature) })),
      18
    );
    expect(nationalViewBox).toBeTruthy();
    const [, , nationalWidth, nationalHeight] = nationalViewBox!.split(/\s+/).map(Number);

    for (const region of regionNames) {
      const codes = new Set(prefecturesByRegion(region).map((prefecture) => prefecture.code));
      const focusedFeatures = nationalMainFeatures.filter((feature) => codes.has(feature.code));
      const focusedViewBox = screenViewBox(
        focusedFeatures.map((feature) => ({ ...feature, path: atlasDisplayPath(feature) })),
        18
      );
      expect(focusedFeatures.length, `${region} has main-map prefecture features`).toBeGreaterThan(0);
      expect(focusedViewBox, `${region} has a focus viewBox`).toBeTruthy();
      const [, , width, height] = focusedViewBox!.split(/\s+/).map(Number);
      expect(width * height, `${region} focus is tighter than national`).toBeLessThan(nationalWidth * nationalHeight);
    }

    expect(prefecturesByRegion("北海道・東北").some((prefecture) => prefecture.code === "01")).toBe(true);
    expect(prefecturesByRegion("九州・沖縄").some((prefecture) => prefecture.code === "47")).toBe(true);
    expect(homeRenderer).toContain("atlasOverviewScreenViewBox(focusedMainFeatures, 18)");
    expect(homeRenderer).toContain('focusedRegion === "北海道・東北"');
    expect(homeRenderer).toContain('{ title: "北海道", name: "北海道", x: 250, y: 92, width: 250, height: 178 }');
    expect(homeRenderer).toContain('{ title: "沖縄県", name: "沖縄県", x: 774, y: 352, width: 180, height: 116 }');
    expect(homeRenderer).toContain('data-focused-region={focusedRegion ?? "national"}');
    expect(homeRenderer).toContain('showLabels={Boolean(focusedRegion)}');
    expect(componentSource).toContain("nationalFocusLabelOffsets");
    expect(componentSource).toContain('scope="national"');
    expect(selector).toContain('role="group" aria-label="地図の表示地域"');
    expect(selector).toContain('aria-controls="national-prefecture-map"');
    expect(selector).toContain("aria-pressed={region === activeRegion}");
    expect(fidelityCssSource).toContain(".home-national-map-stage");
    expect(fidelityCssSource).toContain("animation: home-national-map-stage-in 210ms ease-out both");
    expect(fidelityCssSource).toContain("pointer-events: none");
    expect(fidelityCssSource).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("uses diagnosis category fills instead of reference-image regional colors", () => {
    const statusColorBlock = componentFunctionBlock("atlasStatusColor");

    expect(componentSource).toContain('const nationalRecoveryColors: Record<string, string>');
    expect(componentSource).toContain('key: "100%以上", label: "100%以上"');
    expect(componentSource).toContain('key: "80%未満", label: "80%未満", color: "#e95b5d"');
    expect(componentSource).toContain("summary?.averageExpenseRecoveryRate");
    expect(componentSource).toContain("averageMetric(featureMunicipalities, (item) => item.expenseRecoveryRate)");
    expect(statusColorBlock).toContain("nationalRecoveryBand(recoveryRate)");
    expect(statusColorBlock).not.toContain("feeUnitPrice");
    expect(statusColorBlock).toContain('nationalRecoveryColors["データなし・対象外"]');
    expect(componentSource).toContain("<MapHeading>経費回収率</MapHeading>");
    expect(componentSource).not.toContain("<MapHeading>経費回収率と使用料単価</MapHeading>");
    expect(componentSource).not.toContain("ATLAS_REGION_COLORS");
    expect(componentSource).not.toContain("atlasRegionColor");
    expect(componentSource).not.toContain("hokkaidoTohoku");
    expect(componentSource).not.toContain('kanto: "#f8e8d7"');
    expect(componentSource).not.toContain('chugokuShikoku: "#f9d8ef"');
    expect(componentSource).toContain("<FlatPrefectureShape path={displayPath} fillColor={fillColor}");
  });

  it("uses a two-layer flat prefecture silhouette and retires heuristic outlines", () => {
    const shapeBlock = componentFunctionBlock("FlatPrefectureShape");
    const silhouetteIndex = shapeBlock.indexOf('className="gis-prefecture-silhouette"');
    const fillIndex = shapeBlock.indexOf('className={clsx("gis-shape"');
    const boundaryWidth = Number(shapeBlock.match(/strokeWidth=\{4\}/)?.[0].match(/\d+/)?.[0]);
    const coverWidth = Number(shapeBlock.match(/strokeWidth=\{2\.7\}/)?.[0].match(/\d+(?:\.\d+)?/)?.[0]);

    expect(silhouetteIndex).toBeGreaterThanOrEqual(0);
    expect(fillIndex).toBeGreaterThan(silhouetteIndex);
    expect(shapeBlock).toContain('stroke="#263744"');
    expect(shapeBlock).toContain("stroke={fillColor}");
    expect(shapeBlock.match(/fillRule="nonzero"/g)).toHaveLength(2);
    expect((boundaryWidth - coverWidth) / 2).toBeCloseTo(0.65, 5);
    expect(shapeBlock).toContain('pointerEvents="none"');
    expect(componentSource).not.toContain("prefectureOutlinePath");
    expect(componentSource).not.toContain("gis-prefecture-outline");
    expect(componentSource).not.toContain("feMorphology");
    expect(fidelityCssSource).toContain("stroke: var(--region-fill) !important;");
    expect(fidelityCssSource).not.toContain("stroke: #263744 !important;");
  });

  it("does not reintroduce national hover lift, glow, or black path stroke", () => {
    const baseNationalBlock = cssBlock(".gis-region .gis-shape--national");
    const hoverNationalBlock = cssBlockFromStart(".gis-region:hover .gis-shape--national");

    expect(baseNationalBlock).toContain("transition: none");
    expect(hoverNationalBlock).not.toContain("transform");
    expect(hoverNationalBlock).not.toContain("translate");
    expect(hoverNationalBlock).not.toContain("scale");
    expect(hoverNationalBlock).not.toContain("#063b6f");
    expect(hoverNationalBlock).not.toContain("rgba(10, 18, 31");
    expect(hoverNationalBlock).toContain("stroke: var(--region-fill);");
    expect(hoverNationalBlock).toContain("stroke-width: 2.7");
  });

  it("keeps the national hover popup informational and removes its unreachable CTA", () => {
    const tooltipOpeningTag = componentOpeningTagAround('className="map-tooltip absolute z-20 min-w-[220px] p-4"');
    const hoverCardBlock = componentFunctionBlock("MapHoverCard");
    const hoverStateBlock = componentFunctionBlock("hoverStateFromEvent");

    expect(componentSource).toContain('<MapHoverCard hover={hover} showDetailLink={variant !== "home"} />');
    expect(hoverCardBlock).toContain("showDetailLink = true");
    expect(hoverCardBlock).toContain("{showDetailLink ? (");
    expect(tooltipOpeningTag).toContain("data-passive={!showDetailLink || undefined}");
    expect(tooltipOpeningTag).toContain("<div");
    expect(tooltipOpeningTag).not.toContain("<Link");
    expect(hoverStateBlock).toContain("const href = mapFeatureHref(feature, municipalities);");
    expect(hoverStateBlock).toContain("href,");
    expect(componentSource).toContain("const NATIONAL_HOVER_DELAY_MS = 280;");
    expect(cssBlock(".map-tooltip")).toContain("pointer-events: auto");
    expect(cssBlock(".map-tooltip[data-passive]")).toContain("pointer-events: none");
    expect(cssBlock(".map-tooltip-cta")).toContain("display: inline-flex");
    expect(cssBlock(".map-tooltip-cta")).toContain("min-height: 34px");
    expect(cssBlock(".map-tooltip-cta")).toContain("cursor: pointer");
  });

  it("resolves hover detail links for prefectures, municipalities, and search fallback", () => {
    const hokkaido = featureByName("北海道");
    expect(mapFeatureHref(hokkaido)).toBe("/map/01");
    expect(mapFeatureHref({
      code: "27100",
      name: "大阪市",
      prefectureCode: "27",
      prefectureName: "大阪府",
      path: "M0 0L1 0L1 1Z"
    }, [{
      municipalityCode: "271004",
      prefectureName: "大阪府",
      municipalityName: "大阪市"
    }])).toBe("/municipalities/271004");
    expect(mapFeatureHref({
      code: "99999",
      name: "未照合町",
      prefectureCode: "99",
      prefectureName: "テスト県",
      path: "M0 0L1 0L1 1Z"
    })).toBe("/municipalities?prefecture=%E3%83%86%E3%82%B9%E3%83%88%E7%9C%8C&q=%E6%9C%AA%E7%85%A7%E5%90%88%E7%94%BA");
  });

  it("normalizes abbreviated GIS prefecture names before summary and link lookup", () => {
    for (const feature of gisData.prefectures) {
      const normalizedName = normalizePrefectureName(feature.name);
      expect(getPrefectureCode(normalizedName), `${feature.name} resolves after normalization`).toBe(feature.code);
    }

    expect(normalizePrefectureName("神奈川")).toBe("神奈川県");
    expect(normalizePrefectureName("和歌山")).toBe("和歌山県");
    expect(normalizePrefectureName("鹿児島")).toBe("鹿児島県");
    expect(componentSource).toContain("return normalizePrefectureName(name);");
  });

  it("keeps atlas responsive through the shared home layout", () => {
    expect(fidelityCssSource).toContain(".home-map-layout--home,\n.home-map-layout--atlas");
    expect(fidelityCssSource).toContain("grid-template-columns: minmax(0, 2.302fr) minmax(0, 1fr)");
    expect(fidelityCssSource).toContain(".home-map-layout--atlas > .national-map-panel");
    expect(fidelityCssSource).toContain(".home-map-explorer--atlas .home-support-grid");
    expect(fidelityCssSource).toContain(".national-map-panel .gis-map-surface--home-national");
    expect(fidelityCssSource).toContain("min-height: 438px");
    expect(fidelityCssSource).toContain("height: 438px");
  });
});
