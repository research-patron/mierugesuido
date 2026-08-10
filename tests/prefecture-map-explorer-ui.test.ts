import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildMunicipalityLookup } from "@/components/PrefectureMapExplorer";
import { municipalityDisplayPaths, splitSubpaths } from "@/lib/gisMapLayout";

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

  it("keeps current Tomari separate from neutral Northern Territories geography", () => {
    const tomariFeatures = hokkaidoGisData.features.filter((item: any) => item.name === "泊村");
    expect(tomariFeatures.map((item: any) => item.code)).toEqual(["01403", "01696"]);
    expect(tomariFeatures.every((item: any) => splitSubpaths(item.path).length > 1)).toBe(true);
    const tomariDisplay = municipalityDisplayPaths(tomariFeatures[0]);
    expect(splitSubpaths(tomariDisplay.interactivePath)).toHaveLength(1);
    expect(splitSubpaths(tomariDisplay.excludedPath)).toHaveLength(57);
    expect(componentSource).toContain('const nonMunicipalityGeographyCodes = new Set(["01695", "01696"');
    expect(componentSource).toContain("if (!isMunicipalityFeature(feature))");
    expect(componentSource).toContain("const paths = municipalityDisplayPaths(feature);");
    expect(componentSource).toContain("d={display.paths.interactivePath}");
    expect(componentSource).toContain("d={display.paths.excludedPath}");
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
    expect(componentSource).toContain("labelLayout.fallbackFeatures.map");
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
    expect(cssSource).toContain("height: clamp(600px, 44vw, 640px);");
    expect(cssSource).toContain("shape-rendering: geometricPrecision;");
    expect(cssSource).toContain("stroke-width: 0.58;");
    expect(cssSource).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    const legendCss = cssSource.slice(cssSource.indexOf(".legend {"), cssSource.indexOf(".mapSurface {"));
    expect(legendCss).not.toContain("text-overflow: ellipsis;");
    expect(legendCss).not.toContain("white-space: nowrap;");
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
