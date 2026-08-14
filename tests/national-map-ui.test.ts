import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ATLAS_HOKKAIDO_OVERVIEW_SCALE_Y,
  ATLAS_KAGOSHIMA_REMOTE_ISLAND_CUTOFF_Y,
  ATLAS_NAGASAKI_REMOTE_ISLAND_MIN_X,
  ATLAS_NAGASAKI_REMOTE_ISLAND_MIN_Y,
  ATLAS_OKINAWA_OVERVIEW_SCALE_Y,
  NATIONAL_OKINAWA_INSET_MAX_X,
  NATIONAL_OKINAWA_INSET_MAX_Y,
  NATIONAL_OKINAWA_INSET_MIN_X,
  NATIONAL_OVERVIEW_VIEWBOX,
  NATIONAL_TOKYO_REMOTE_ISLAND_CUTOFF_Y,
  atlasDisplayPath,
  atlasOverviewPath,
  combineBounds,
  mapFeatureHref,
  nationalInsetDisplayPath,
  nationalOverviewPath,
  pathScreenBounds,
  screenViewBox,
  splitSubpaths
} from "@/lib/gisMapLayout";
import { positionNationalHover } from "@/components/JapanMapSelector";
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

function fidelityCssBlock(selector: string) {
  const start = fidelityCssSource.indexOf(`${selector} {`);
  expect(start, `${selector} fidelity block exists`).toBeGreaterThanOrEqual(0);
  const end = fidelityCssSource.indexOf("}", start);
  expect(end, `${selector} fidelity block closes`).toBeGreaterThan(start);
  return fidelityCssSource.slice(start, end + 1);
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

function numericJsxProp(source: string, prop: string) {
  const value = source.match(new RegExp(`${prop}=\\{([\\d.]+)\\}`))?.[1];
  expect(value, `${prop} numeric value exists`).toBeTruthy();
  return Number(value);
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
    expect(componentSource).toContain("paths.set(feature.code, atlasDisplayPath(feature));");
    expect(componentSource).toContain("const displayPath = nationalInsetDisplayPath(feature);");
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

  it("corrects the latitude-dependent flattening of the detached Hokkaido and Okinawa maps", () => {
    const correctedFeatures = [
      { feature: featureByName("北海道"), scaleY: ATLAS_HOKKAIDO_OVERVIEW_SCALE_Y },
      { feature: featureByName("沖縄県"), scaleY: ATLAS_OKINAWA_OVERVIEW_SCALE_Y }
    ];

    expect(ATLAS_HOKKAIDO_OVERVIEW_SCALE_Y).toBeCloseTo(1.38, 2);
    expect(ATLAS_OKINAWA_OVERVIEW_SCALE_Y).toBeCloseTo(1.11, 2);
    for (const { feature, scaleY } of correctedFeatures) {
      const overviewPath = atlasOverviewPath(feature);
      const displayPath = atlasDisplayPath(feature);
      const overviewBounds = pathBounds(overviewPath);
      const displayBounds = pathBounds(displayPath);

      expect(displayPath).not.toBe(overviewPath);
      expect(displayBounds[0]).toBeCloseTo(overviewBounds[0], 1);
      expect(displayBounds[2]).toBeCloseTo(overviewBounds[2], 1);
      expect(Math.abs(
        (displayBounds[3] - displayBounds[1])
        - (overviewBounds[3] - overviewBounds[1]) * scaleY
      )).toBeLessThan(0.2);
    }
    expect(componentSource).toContain("atlasDisplayPath(feature)");
    expect(componentSource).toContain("pathScreenBounds(atlasDisplayPath(feature))");
  });

  it("keeps the national Okinawa inset readable while retaining the full prefecture path elsewhere", () => {
    const okinawa = featureByName("沖縄県");
    const fullDisplayPath = atlasDisplayPath(okinawa);
    const insetDisplayPath = nationalInsetDisplayPath(okinawa);
    const insetBounds = pathBounds(insetDisplayPath);

    expect(splitSubpaths(insetDisplayPath).length).toBeLessThan(splitSubpaths(fullDisplayPath).length);
    expect(insetBounds[0]).toBeGreaterThanOrEqual(NATIONAL_OKINAWA_INSET_MIN_X);
    expect(insetBounds[2]).toBeLessThanOrEqual(NATIONAL_OKINAWA_INSET_MAX_X);
    expect(insetBounds[3]).toBeLessThanOrEqual(NATIONAL_OKINAWA_INSET_MAX_Y + 3);
    expect((insetBounds[2] - insetBounds[0]) / (insetBounds[3] - insetBounds[1])).toBeLessThan(1.15);
    expect(splitSubpaths(okinawa.path)).toHaveLength(splitSubpaths(fullDisplayPath).length);
  });

  it("places edge hover cards on a free side and clamps all four edges", () => {
    const base = {
      containerWidth: 1_000,
      containerHeight: 500,
      cardWidth: 224,
      cardHeight: 206
    };
    const rightTarget = { targetLeft: 80, targetTop: 230, targetRight: 120, targetBottom: 270 };
    const leftTarget = { targetLeft: 880, targetTop: 230, targetRight: 920, targetBottom: 270 };
    const belowTarget = { targetLeft: 130, targetTop: 30, targetRight: 170, targetBottom: 70 };
    const aboveTarget = { targetLeft: 130, targetTop: 430, targetRight: 170, targetBottom: 470 };
    const placements = [
      positionNationalHover({ ...base, ...rightTarget }),
      positionNationalHover({ ...base, ...leftTarget }),
      positionNationalHover({ ...base, containerWidth: 300, ...belowTarget }),
      positionNationalHover({ ...base, containerWidth: 300, ...aboveTarget })
    ];

    expect(placements.map((item) => item.side)).toEqual(["right", "left", "below", "above"]);
    expect(placements[0].x).toBeGreaterThanOrEqual(rightTarget.targetRight + 16);
    expect(placements[1].x + base.cardWidth).toBeLessThanOrEqual(leftTarget.targetLeft - 16);
    expect(placements[2].y).toBeGreaterThanOrEqual(belowTarget.targetBottom + 16);
    expect(placements[3].y + base.cardHeight).toBeLessThanOrEqual(aboveTarget.targetTop - 16);
    for (const placement of placements) {
      expect(placement.x).toBeGreaterThanOrEqual(12);
      expect(placement.y).toBeGreaterThanOrEqual(12);
      expect(placement.x + base.cardWidth).toBeLessThanOrEqual((placement.side === "below" || placement.side === "above" ? 300 : 1_000) - 12);
      expect(placement.y + base.cardHeight).toBeLessThanOrEqual(500 - 12);
    }

    const okinawaFrame = { targetLeft: 796, targetTop: 360, targetRight: 966, targetBottom: 476 };
    const okinawaPlacement = positionNationalHover({
      ...base,
      containerWidth: 980,
      ...okinawaFrame
    });
    expect(okinawaPlacement.side).toBe("left");
    expect(okinawaPlacement.x + base.cardWidth).toBeLessThanOrEqual(okinawaFrame.targetLeft - 16);
    expect(okinawaPlacement.y).toBeGreaterThanOrEqual(12);
    expect(okinawaPlacement.y + base.cardHeight).toBeLessThanOrEqual(500 - 12);
  });

  it("uses the same home renderer, selector, and three controls for home and atlas", () => {
    const explorer = componentFunctionBlock("NationalMapExplorer");
    const homeRenderer = componentFunctionBlock("HomeNationalMap");

    expect(explorer.match(/<HomeNationalMap/g)).toHaveLength(1);
    expect(explorer).toContain("const [focusedRegion, setFocusedRegion] = useState<RegionName | null>(null);");
    expect(explorer).toContain("focusedRegion={focusedRegion}");
    expect(explorer).toContain("activeRegion={focusedRegion}");
    expect(explorer).toContain("onRegionChange={focusRegion}");
    expect(explorer).not.toContain("onShowNational");
    expect(explorer).toContain("setFocusedRegion(nextFocusedRegion);");
    expect(explorer).toContain("setFocusedRegion(null);");
    expect(explorer).toContain('className="map-control-stack map-control-stack--home"');
    expect(explorer.match(/aria-label="拡大"/g)).toHaveLength(1);
    expect(explorer.match(/aria-label="縮小"/g)).toHaveLength(1);
    expect(explorer.match(/aria-label="全国を表示"/g)).toHaveLength(1);
    expect(explorer).toContain('onClick={showNationalView} className="map-reset-button"');
    expect(explorer).toContain('"gis-map-surface--home-national"');
    expect(componentSource).not.toContain("function AtlasNationalMap");
    expect(componentSource).not.toContain("ATLAS_VIEWBOX");
    expect(componentSource).not.toContain("ATLAS_CONNECTORS");
    expect(componentSource).not.toContain("map-control-stack--atlas");
    expect(homeRenderer).toContain('const viewBox = compact ? "0 0 390 440" : "0 0 980 500";');
    expect(homeRenderer).toContain('{ title: "北海道", name: "北海道", x: 232, y: 16, width: 232, height: 162 }');
    expect(homeRenderer).toContain('{ title: "沖縄県", name: "沖縄県", x: 796, y: 360, width: 170, height: 116 }');
    const insetRenderer = componentFunctionBlock("HomeInsetMap");
    expect(insetRenderer).toContain('data-map-inset-code={feature.code}');
    expect(insetRenderer).toContain("nationalInsetDisplayPath(feature)");
    expect(insetRenderer).toContain('overflow="visible"');
    expect(insetRenderer).toContain('className={clsx("home-map-inset gis-region"');
    expect(insetRenderer).toContain('className="home-map-inset-hit-area"');
    expect(insetRenderer).toContain('pointerEvents="all"');
    expect(insetRenderer).toContain('fill="transparent"');
    expect(insetRenderer.match(/role="link"/g)).toHaveLength(1);
    expect(insetRenderer.match(/tabIndex=\{0\}/g)).toHaveLength(1);
    expect(insetRenderer).not.toContain("home-map-inset-frame");
    expect(insetRenderer).not.toContain("home-map-inset-plus");
    expect(fidelityCssSource).toContain(".home-map-layout--atlas");
  });

  it("provides a real compact camera, deliberate tap confirmation, and thresholded pan", () => {
    const explorer = componentFunctionBlock("NationalMapExplorer");
    const homeRenderer = componentFunctionBlock("HomeNationalMap");
    const insetRenderer = componentFunctionBlock("HomeInsetMap");
    const atlasLayer = componentFunctionBlock("AtlasRegionLayer");
    const panStart = explorer.slice(
      explorer.indexOf("function startNationalPan"),
      explorer.indexOf("function moveNationalPan")
    );
    const panMove = explorer.slice(
      explorer.indexOf("function moveNationalPan"),
      explorer.indexOf("function endNationalPan")
    );

    expect(componentSource).toContain("const MOBILE_NATIONAL_INITIAL_ZOOM = 1.5;");
    expect(componentSource).toContain("const MOBILE_NATIONAL_REGION_ZOOM = 1.25;");
    expect(componentSource).toContain("const MOBILE_NATIONAL_MAX_ZOOM = 4.5;");
    expect(componentSource).toContain("const NATIONAL_DRAG_CLICK_SUPPRESSION_MS = 800;");
    expect(explorer).toContain("setManualZoom(MOBILE_NATIONAL_INITIAL_ZOOM);");
    expect(explorer).toContain("nextFocusedRegion ? MOBILE_NATIONAL_REGION_ZOOM : MOBILE_NATIONAL_INITIAL_ZOOM");
    expect(explorer).toContain("setManualZoom(1);");
    expect(explorer).toContain("setMapPan({ x: 0, y: 0 });");
    expect(homeRenderer).toContain("pannedZoomViewBox(renderedBaseViewBox, manualZoom, pan)");
    expect(homeRenderer).toContain("compact || desktopHomeZoom === 1");

    expect(explorer).toContain('data-pannable={compactAtlas && manualZoom > 1 ? "true" : "false"}');
    expect(explorer).toContain('data-panning={isPanning ? "true" : "false"}');
    expect(explorer).toContain("data-map-zoom={manualZoom.toFixed(2)}");
    expect(panStart).toContain("!event.isPrimary");
    expect(panStart).not.toContain("setPointerCapture");
    expect(panMove).toContain("hasExceededDragThreshold(deltaX, deltaY, drag.pointerType)");
    expect(panMove.indexOf("hasExceededDragThreshold")).toBeLessThan(panMove.indexOf("setPointerCapture"));
    expect(panMove).toContain("panFromPointerDelta({");
    expect(explorer).toContain("suppressMapClickRef.current = true;");

    expect(explorer).toContain("setSelectedMobilePrefecture(feature);");
    expect(explorer).toContain('className="mobile-national-map-confirmation"');
    expect(explorer).toContain("地図を上下左右にスワイプ");
    expect(explorer).toContain("<Link href={`/map/${selectedMobilePrefecture.code}`}>");
    expect(insetRenderer).toContain("onKeyboardOpen(feature);");
    expect(atlasLayer).toContain("handleAtlasRegionKey(event, feature, onKeyboardOpen);");
    expect(fidelityCssBlock('.gis-map-surface--home-national[data-pannable="true"]')).toContain("touch-action: none");
    expect(fidelityCssBlock(".mobile-national-map-confirmation > a")).toContain("min-height: 44px");
    expect(fidelityCssSource).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.national-map-panel \.gis-map-surface--home-national\s*\{[^}]*min-height:\s*440px;[^}]*height:\s*clamp\(440px, 60vh, 480px\);/);
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
    expect(homeRenderer).toContain('{ title: "北海道", name: "北海道", x: 232, y: 68, width: 292, height: 208 }');
    expect(homeRenderer).toContain('{ title: "沖縄県", name: "沖縄県", x: 758, y: 336, width: 208, height: 142 }');
    expect(homeRenderer).toContain('data-focused-region={focusedRegion ?? "national"}');
    expect(homeRenderer).toContain('showLabels={Boolean(focusedRegion)}');
    expect(componentSource).toContain("nationalFocusLabelOffsets");
    expect(componentSource).toContain('scope="national"');
    expect(selector).toContain('role="group" aria-label="地図の表示地域"');
    expect(selector).toContain('aria-controls="national-prefecture-map"');
    expect(selector).not.toContain("onShowNational");
    expect(selector).not.toContain("prefecture-region-tab--national");
    expect(selector).not.toMatch(/>\s*全国\s*</);
    expect(selector).toContain("aria-pressed={region === activeRegion}");
    expect(regionNames).toHaveLength(6);
    expect(regionNames).not.toContain("全国");
    const selectorColumns = fidelityCssBlock(".prefecture-region-tabs")
      .match(/grid-template-columns:\s*([^;]+);/)?.[1]
      .trim()
      .split(/\s+/);
    expect(selectorColumns).toHaveLength(6);
    expect(fidelityCssSource).not.toContain(".prefecture-region-tabs .prefecture-region-tab--national");
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
    expect(componentSource).toContain("<MapHeading>経費回収率（{activeScopeLabel}）</MapHeading>");
    expect(componentSource).toContain('role="radiogroup" aria-label="地図に表示する下水道事業"');
    expect(componentSource).toContain('role="radio"');
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
    const silhouettePath = componentPathElementAround('className="gis-prefecture-silhouette"');
    const coverPath = componentPathElementAround('className={clsx("gis-shape"');
    const boundaryWidth = numericJsxProp(silhouettePath, "strokeWidth");
    const boundaryOpacity = numericJsxProp(silhouettePath, "strokeOpacity");
    const coverWidth = numericJsxProp(coverPath, "strokeWidth");
    const exposedBoundaryWidth = (boundaryWidth - coverWidth) / 2;

    expect(silhouetteIndex).toBeGreaterThanOrEqual(0);
    expect(fillIndex).toBeGreaterThan(silhouetteIndex);
    expect(shapeBlock).toContain('stroke="#263744"');
    expect(shapeBlock).toContain("stroke={fillColor}");
    expect(shapeBlock.match(/fillRule="nonzero"/g)).toHaveLength(2);
    expect(boundaryWidth).toBe(4.5);
    expect(boundaryOpacity).toBe(0.62);
    expect(coverWidth).toBe(2.7);
    expect(exposedBoundaryWidth).toBeCloseTo(0.9, 5);
    expect(exposedBoundaryWidth).toBeGreaterThanOrEqual(0.85);
    expect(exposedBoundaryWidth).toBeLessThanOrEqual(1.05);
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
    const tooltipOpeningTag = componentOpeningTagAround('className="map-tooltip absolute z-20 w-[224px] p-4"');
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
    expect(hoverStateBlock).toContain("const targetRect = event.currentTarget.getBoundingClientRect();");
    expect(hoverStateBlock).toContain("positionNationalHover({");
    expect(hoverStateBlock).toContain("targetLeft: targetRect.left - rect.left");
    expect(hoverStateBlock).toContain("targetRight: targetRect.right - rect.left");
    expect(hoverStateBlock).not.toContain("event.clientX");
    expect(hoverCardBlock).toContain('left: `${hover.x}px`');
    expect(hoverCardBlock).toContain('top: `${hover.y}px`');
    expect(componentSource).toContain("const NATIONAL_HOVER_DELAY_MS = 280;");
    expect(cssBlock(".map-tooltip")).toContain("pointer-events: auto");
    expect(cssBlock(".map-tooltip[data-passive]")).toContain("pointer-events: none");
    expect(cssBlock(".map-tooltip-cta")).toContain("display: inline-flex");
    expect(cssBlock(".map-tooltip-cta")).toContain("min-height: 34px");
    expect(cssBlock(".map-tooltip-cta")).toContain("cursor: pointer");
    expect(cssBlock(".home-map-inset-hit-area")).toContain("fill: transparent");
    expect(cssBlock(".home-map-inset-hit-area")).toContain("stroke: none");
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

  it("keeps atlas responsive separately from the stacked homepage layout", () => {
    expect(fidelityCssSource).toMatch(/\.home-map-layout--atlas\s*\{[^}]*grid-template-columns:\s*minmax\(0, 2\.302fr\) minmax\(0, 1fr\)/s);
    expect(fidelityCssSource).toContain(".home-map-layout--atlas > .national-map-panel");
    expect(fidelityCssSource).toContain(".home-map-explorer--atlas .home-support-grid");
    expect(fidelityCssSource).toContain(".national-map-panel .gis-map-surface--home-national");
    expect(fidelityCssSource).toContain("min-height: 438px");
    expect(fidelityCssSource).toContain("height: 438px");
  });
});
