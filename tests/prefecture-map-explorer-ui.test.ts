import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { municipalityDisplayPaths, pathScreenBounds, splitSubpaths } from "@/lib/gisMapLayout";

const root = process.cwd();
const pageSource = readFileSync(path.join(root, "app/map/[prefectureCode]/page.tsx"), "utf8");
const componentSource = readFileSync(path.join(root, "components/PrefectureMapExplorer.tsx"), "utf8");
const cssSource = readFileSync(path.join(root, "components/PrefectureMapExplorer.module.css"), "utf8");
const gisData = JSON.parse(readFileSync(path.join(root, "public/gis/mlit-n03-simplified.json"), "utf8"));

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
    expect(componentSource).toContain('role="group"');
    expect(componentSource).not.toContain('role="img"');
  });

  it("separates the known Hokkaido Tomari name collision before interaction", () => {
    const tomari = gisData.municipalitiesByPrefecture["01"].find((item: any) => item.code === "01403");
    expect(tomari?.name).toBe("泊村");
    expect(splitSubpaths(tomari.path)).toHaveLength(2);

    const paths = municipalityDisplayPaths(tomari);
    const interactiveBounds = pathScreenBounds(paths.interactivePath);
    const excludedBounds = pathScreenBounds(paths.excludedPath);

    expect(splitSubpaths(paths.interactivePath)).toHaveLength(1);
    expect(splitSubpaths(paths.excludedPath)).toHaveLength(1);
    expect(interactiveBounds?.[2]).toBeLessThan(200);
    expect(excludedBounds?.[0]).toBeGreaterThan(600);
    expect(componentSource).toContain("const paths = municipalityDisplayPaths(feature);");
    expect(componentSource).toContain("d={display.paths.interactivePath}");
    expect(componentSource).toContain("d={display.paths.excludedPath}");
  });

  it("uses the same rate-and-unit-price diagnosis across map, hover card, and table", () => {
    expect(componentSource).toContain("const status = match?.feeAdequacyLabel ?? labelFromMetrics(");
    expect(componentSource).toContain("label: displayFeeRecoveryBandLabel(match?.feeAdequacyLabel ?? labelFromMetrics(");
    expect(componentSource).toContain("区分 ${displayFeeRecoveryBandLabel(status)}");
    expect(componentSource).toContain("getFeeAdequacyLabel(recovery, feeUnit)");
    expect(componentSource).not.toContain("function labelFromRate");
    expect(componentSource).toContain("100%相当の増収率");
  });

  it("uses the former side-panel space for a full-width adaptive-label map", () => {
    expect(componentSource).toContain("const observer = new ResizeObserver(updateSize);");
    expect(componentSource).toContain("const labelLayout = useMemo(");
    expect(componentSource).toContain("buildLabelLayout({");
    expect(componentSource).not.toContain("const showLabel = active || labelLayout.codes.has(feature.code);");
    expect(componentSource).toContain('data-map-label-layer="true"');
    expect(componentSource).toContain("if (!labelLayout.codes.has(feature.code)) return null;");
    expect(componentSource).toContain("screenRectsOverlap(placed.rect, rect, collisionGap)");
    expect(componentSource).toContain("lineIntersectsRect");
    expect(componentSource).toContain("const densityBudget = dense");
    expect(componentSource).toContain("baseDensityBudget * Math.pow(Math.max(zoom, 1), 1.25)");
    expect(componentSource).toContain("compact ? 28 : 96");
    expect(componentSource).toContain("activeFeatureCode: selectedFeatureCode");
    expect(componentSource).toContain("className={styles.mapLabelCallout}");
    expect(componentSource).not.toContain("className={styles.resultList}");
    expect(componentSource).not.toContain("className={clsx(styles.resultRow");
    expect(componentSource).not.toContain("自治体を探す");
    expect(componentSource).not.toContain('className="data-table min-w-[500px]"');
    expect(componentSource).toContain("const exportHref = useMemo(");
    expect(componentSource).toContain("<Link href={exportHref}>");
    expect(componentSource).not.toContain("limit=100&format=csv");
    expect(cssSource).not.toContain(".resultList {");
    expect(cssSource).toContain("height: clamp(600px, 44vw, 640px);");
    expect(cssSource).toContain("shape-rendering: geometricPrecision;");
    expect(cssSource).toContain("stroke-width: 0.78;");
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
