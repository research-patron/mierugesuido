import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildMunicipalityLookup, filterPrefectureMapFeatures } from "@/components/PrefectureMapExplorer";
import { splitSubpaths } from "@/lib/gisMapLayout";

const root = process.cwd();
const pageSource = readFileSync(path.join(root, "app/map/[prefectureCode]/page.tsx"), "utf8");
const componentSource = readFileSync(path.join(root, "components/PrefectureMapExplorer.tsx"), "utf8");
const cssSource = readFileSync(path.join(root, "components/PrefectureMapExplorer.module.css"), "utf8");
const hokkaidoGisData = JSON.parse(readFileSync(path.join(root, "public/gis/municipalities/01.json"), "utf8"));

describe("prefecture municipality map UI guardrails", () => {
  it("routes the prefecture page through the refined explorer", () => {
    expect(pageSource).toContain('from "@/components/PrefectureMapExplorer"');
    expect(pageSource).not.toContain('PrefectureMapExplorer } from "@/components/JapanMapSelector"');
    expect(pageSource).toContain("<PrefectureMapExplorer");
  });

  it("keeps map controls functional and municipality keyboard navigation roving", () => {
    for (const label of ["縮小", "拡大", "全域表示"]) {
      expect(componentSource).toContain(`aria-label="${label}"`);
    }
    expect(componentSource).toContain('aria-label={labelsVisible ? "自治体名を非表示" : "自治体名を表示"}');
    expect(componentSource).toContain("function changeZoom(direction: -1 | 1)");
    expect(componentSource).toContain("onClick={() => changeZoom(-1)}");
    expect(componentSource).toContain("onClick={() => changeZoom(1)}");
    expect(componentSource).toContain("function resetMap()");
    expect(componentSource).toContain("function startPan(");
    expect(componentSource).toContain("function movePan(");
    expect(componentSource).toContain('data-pannable={zoom > 1 ? "true" : "false"}');
    expect(componentSource).toContain("handleRegionKey(event, feature)");
    expect(componentSource).toContain("data-municipality-region={feature.code}");
    expect(componentSource).toContain("focusedFeatureCode === feature.code ? 0 : -1");
    expect(componentSource).toContain('["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]');
    expect(componentSource).toContain('event.key === "Escape"');
    expect(componentSource).toContain("showKeyboardHover(feature, match)");
    expect(componentSource).toContain("showKeyboardHover(nextFeature, lookupMunicipality(municipalityLookup, nextFeature))");
    expect(componentSource).toContain("setHover(null);");
    expect(componentSource).toContain('role="group"');
    expect(componentSource).not.toContain('role="img"');
  });

  it("separates a light tap from panning and keeps the current map center while zooming", () => {
    expect(componentSource).toContain("hasExceededDragThreshold(deltaX, deltaY, drag.pointerType)");
    expect(componentSource).toContain("event.currentTarget.setPointerCapture(event.pointerId)");
    expect(componentSource.indexOf("hasExceededDragThreshold(deltaX, deltaY, drag.pointerType)"))
      .toBeLessThan(componentSource.indexOf("event.currentTarget.setPointerCapture(event.pointerId)"));
    expect(componentSource).toContain("suppressClickUntilRef.current = Date.now() + dragClickSuppressionMs");
    expect(componentSource).toContain("preserveMapCenterAcrossZoom({");
    expect(componentSource).toContain('data-pan-enabled={zoom > 1 ? "true" : "false"}');
    expect(componentSource).toContain("data-map-zoom={zoom.toFixed(2)}");
  });

  it("lets mobile users find, confirm, and then open every municipality", () => {
    expect(componentSource).toContain("自治体名から地図上の位置を探す");
    expect(componentSource).toContain("municipalityFinderOptions.map");
    expect(componentSource).toContain("focusMapFeature({");
    expect(componentSource).toContain("if (isMobileViewport)");
    expect(componentSource).toContain("selectAndFocusFeature(feature)");
    expect(componentSource).toContain("選択中の自治体");
    expect(componentSource).toContain("の詳細を見る");
    expect(componentSource).toContain('data-tap-confirmation={isMobileViewport ? "true" : "false"}');
    expect(componentSource).toContain('aria-describedby="prefecture-map-instructions"');
    expect(cssSource).toContain("min-height: 48px;");
  });

  it("omits the six Hokkaido geography records only at display time and keeps every current Tomari part", () => {
    const omittedCodes = ["01695", "01696", "01697", "01698", "01699", "01700"];
    const sourceFeatures = hokkaidoGisData.features.filter((item: any) => omittedCodes.includes(item.code));
    const displayedFeatures = filterPrefectureMapFeatures("01", hokkaidoGisData.features);
    const currentTomari = displayedFeatures.find((item: any) => item.code === "01403");

    expect(sourceFeatures.map((item: any) => item.code)).toEqual(omittedCodes);
    expect(sourceFeatures.every((item: any) => item.kind === "geography")).toBe(true);
    expect(displayedFeatures.some((item: any) => omittedCodes.includes(item.code))).toBe(false);
    expect(currentTomari?.name).toBe("泊村");
    expect(splitSubpaths(currentTomari?.path ?? "")).toHaveLength(58);
    expect(currentTomari?.path).toBe(hokkaidoGisData.features.find((item: any) => item.code === "01403")?.path);
    expect(filterPrefectureMapFeatures("47", hokkaidoGisData.features)).toBe(hokkaidoGisData.features);
    expect(componentSource).toContain("filterPrefectureMapFeatures(prefectureCode, data.features)");
    expect(componentSource).toContain("d={feature.path}");
    expect(componentSource).not.toContain("municipalityDisplayPaths");
    expect(componentSource).not.toContain("display.paths.excludedPath");
  });

  it("resolves GIS municipalities by the five-digit prefix of exact six-digit detail codes", () => {
    const orthographyRegressions = [
      { prefectureCode: "02", gisCode: "02321", gisName: "鰺ヶ沢町", staticCode: "023213", staticName: "鰺ケ沢町" },
      { prefectureCode: "02", gisCode: "02411", gisName: "六ヶ所村", staticCode: "024112", staticName: "六ケ所村" },
      { prefectureCode: "04", gisCode: "04302", gisName: "七ヶ宿町", staticCode: "043028", staticName: "七ケ宿町" },
      { prefectureCode: "04", gisCode: "04404", gisName: "七ヶ浜町", staticCode: "044041", staticName: "七ケ浜町" },
      { prefectureCode: "20", gisCode: "20210", gisName: "駒ヶ根市", staticCode: "202100", staticName: "駒ケ根市" },
      { prefectureCode: "39", gisCode: "39405", gisName: "檮原町", staticCode: "394050", staticName: "梼原町" }
    ];

    for (const expected of orthographyRegressions) {
      const prefectureData = JSON.parse(readFileSync(
        path.join(root, "data/static/prefectures", `${expected.prefectureCode}.json`),
        "utf8"
      ));
      const gisData = JSON.parse(readFileSync(
        path.join(root, "public/gis/municipalities", `${expected.prefectureCode}.json`),
        "utf8"
      ));
      const feature = gisData.features.find((item: any) => item.code === expected.gisCode);
      const match = buildMunicipalityLookup(prefectureData.municipalities).get(expected.gisCode);

      expect(feature?.name).toBe(expected.gisName);
      expect(match?.municipalityName).toBe(expected.staticName);
      expect(match?.municipalityCode).toBe(expected.staticCode);
    }
  });

  it("indexes every available static municipality under its matching official GIS code", () => {
    for (let index = 1; index <= 47; index += 1) {
      const prefectureCode = String(index).padStart(2, "0");
      const prefectureData = JSON.parse(readFileSync(
        path.join(root, "data/static/prefectures", `${prefectureCode}.json`),
        "utf8"
      ));
      const gisData = JSON.parse(readFileSync(
        path.join(root, "public/gis/municipalities", `${prefectureCode}.json`),
        "utf8"
      ));
      const lookup = buildMunicipalityLookup(prefectureData.municipalities);
      const gisCodes = new Set(
        gisData.features
          .filter((item: any) => item.kind !== "geography")
          .map((item: any) => item.code)
      );

      for (const municipality of prefectureData.municipalities) {
        if (!/^\d{6}$/.test(municipality.municipalityCode ?? "")) continue;
        const gisCode = municipality.municipalityCode.slice(0, 5);
        if (!gisCodes.has(gisCode)) continue;
        expect(lookup.get(gisCode)?.municipalityCode, `${prefectureCode} ${gisCode}`)
          .toBe(municipality.municipalityCode);
      }
    }
  });

  it("uses the same rate-and-unit-price diagnosis across map, hover card, and table", () => {
    expect(componentSource).toContain("const status = match?.feeAdequacyLabel ?? labelFromMetrics(");
    expect(componentSource).toContain("label: displayFeeRecoveryBandLabel(match?.feeAdequacyLabel ?? labelFromMetrics(");
    expect(componentSource).toContain("区分 ${displayFeeRecoveryBandLabel(status)}");
    expect(componentSource).toContain("getFeeAdequacyLabel(recovery, feeUnit)");
    expect(componentSource).not.toContain("function labelFromRate");
    expect(componentSource).toContain("使用料収入の必要増加率");
  });

  it("uses the former side-panel space for a full-width adaptive-label map", () => {
    expect(componentSource).toContain("const observer = new ResizeObserver(updateSize);");
    expect(componentSource).toContain("const labelLayout = useMemo(");
    expect(componentSource).toContain("buildLabelLayout({");
    expect(componentSource).not.toContain("const showLabel = active || labelLayout.codes.has(feature.code);");
    expect(componentSource).toContain('data-map-label-layer="true"');
    expect(componentSource).toContain("if (!labelLayout.codes.has(feature.code)) return null;");
    expect(componentSource).toContain("screenRectsOverlap(item.rect, rect, collisionGap)");
    expect(componentSource).toContain("lineIntersectsRect");
    expect(componentSource).not.toContain("const densityBudget = dense");
    expect(componentSource).toContain("collisionAwareOffsets(compact, zoom)");
    expect(componentSource).toContain("fallbackFeatures.push(feature)");
    expect(componentSource).not.toContain("labelLayout.fallbackFeatures.map");
    expect(componentSource).not.toContain("地図上で重なりを避けた市町村名");
    expect(componentSource).toContain("placements.set(feature.code");
    expect(componentSource).toContain("activeFeatureCode: selectedFeatureCode");
    expect(componentSource).toContain("className={styles.mapLabelCallout}");
    expect(componentSource).not.toContain("className={styles.resultList}");
    expect(componentSource).not.toContain("className={clsx(styles.resultRow");
    expect(componentSource).not.toContain("自治体を探す");
    expect(componentSource).not.toContain('className="data-table min-w-[500px]"');
    expect(componentSource).toContain("const exportHref = `/data/static/csv/prefectures/${prefectureCode}.csv`;");
    expect(componentSource).toContain("<Link href={exportHref}>");
    expect(componentSource).not.toContain("limit=100&format=csv");
    expect(cssSource).not.toContain(".resultList {");
    expect(cssSource).not.toContain(".labelFallback {");
    expect(cssSource).toContain("height: clamp(600px, 44vw, 640px);");
    expect(cssSource).toContain("shape-rendering: geometricPrecision;");
    expect(cssSource).toContain("stroke-width: 0.58;");
    expect(cssSource).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    const legendCss = cssSource.slice(cssSource.indexOf(".legend {"), cssSource.indexOf(".mapSurface {"));
    expect(legendCss).not.toContain("text-overflow: ellipsis;");
    expect(legendCss).not.toContain("white-space: nowrap;");
  });

  it("keeps the hovered municipality name on its own full-width row", () => {
    expect(componentSource).toContain("const municipalityTooltipHeight = 196;");
    expect(componentSource).toContain("<strong>{hover.title}</strong>");
    expect(cssSource).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(cssSource).toContain("width: 100%;");
    expect(cssSource).toContain("overflow-wrap: anywhere;");
    expect(cssSource).toContain("white-space: normal;");
  });

  it("keeps the full map and its controls readable on mobile without a redundant mode switch", () => {
    expect(componentSource).not.toContain('type MobilePanel = "map" | "list";');
    expect(componentSource).not.toContain('aria-pressed={mobilePanel === "map"}');
    expect(componentSource).not.toContain('aria-pressed={mobilePanel === "list"}');
    expect(componentSource).not.toContain("styles.mobileHidden");
    expect(cssSource).toContain("@media (max-width: 767px)");
    expect(cssSource).not.toContain(".mobileHidden {");
    expect(cssSource).toContain("width: 44px;");
    expect(cssSource).toContain("height: min(64vh, 470px);");
    expect(cssSource).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
  });
});
