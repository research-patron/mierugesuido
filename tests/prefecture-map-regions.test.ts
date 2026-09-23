import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildPrefectureMapRegions } from "@/lib/prefectureMapRegions";
import { combineBounds, pathScreenBounds, splitSubpaths } from "@/lib/gisMapLayout";
import { panFromPointerDelta, parseMapViewBox } from "@/lib/mapGesture";
import { filterPrefectureMapFeatures } from "@/components/PrefectureMapExplorer";

const load = (code: string) => JSON.parse(readFileSync(`public/gis/municipalities/${code}.json`, "utf8"));

describe("P0 prefecture display regions", () => {
  it.each(Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, "0")))("%s keeps every source ring and identity exactly once outside its full overview", code => {
    const source = load(code);
    const features = filterPrefectureMapFeatures(code, source.features);
    const before = JSON.stringify(source);
    const regions = buildPrefectureMapRegions(code, features);
    expect(regions.length).toBeGreaterThan(0);
    expect(new Set(regions.map(r => r.id)).size).toBe(regions.length);
    const partition = regions.length === 1 ? regions : regions.filter(r => r.id !== "all");
    const rings = (items: typeof features) => items.flatMap(f => splitSubpaths(f.path).map(p => `${f.code}:${p}`)).sort();
    expect(rings(partition.flatMap(r => r.features))).toEqual(rings(features));
    expect(regions.find(r => r.id === "all")!.features).toBe(features);
    expect(JSON.stringify(source)).toBe(before);
    for (const region of regions) {
      const box = parseMapViewBox(region.viewBox)!;
      expect(box).not.toBeNull();
      expect(region.features.length).toBeGreaterThan(0);
      for (const feature of region.features) {
        expect(feature.path).not.toMatch(/NaN|Infinity/);
        const b = pathScreenBounds(feature.path)!;
        expect(b).not.toBeNull();
        expect(b[0]).toBeGreaterThanOrEqual(box.x);
        expect(b[1]).toBeGreaterThanOrEqual(box.y);
        expect(b[2]).toBeLessThanOrEqual(box.x + box.width + 1e-8);
        expect(b[3]).toBeLessThanOrEqual(box.y + box.height + 1e-8);
      }
      // The fitted geometry's longest axis must occupy most of the viewBox;
      // do not impose an area ratio on long thin islands.
      const bounds = combineBounds(region.features.map(f => pathScreenBounds(f.path)!));
      expect(Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]) / Math.max(box.width, box.height)).toBeGreaterThan(0.85);
    }
  });

  it("starts Tokyo on the mainland and keeps all nine island municipalities and distant Ogasawara parts reachable", () => {
    const regions = buildPrefectureMapRegions("13", load("13").features);
    expect(regions[0].label).toBe("本州側（区部・多摩）");
    expect(regions[0].features).toHaveLength(56);
    const codes = new Set(regions.slice(1, -1).flatMap(r => r.features.map(f => f.code)));
    for (const code of ["13361", "13362", "13363", "13364", "13381", "13382", "13401", "13402", "13421"]) expect(codes.has(code)).toBe(true);
    expect(regions.filter(r => r.id.startsWith("13421-")).length).toBeGreaterThan(1);
    for (const [width, height] of [[1399, 638], [330, 418], [300, 418]]) {
      const box = parseMapViewBox(regions[0].viewBox)!;
      const scale = Math.min(width / box.width, height / box.height);
      const city = pathScreenBounds(regions[0].features.find(f => f.code === "13201")!.path)!;
      expect((city[2] - city[0]) * scale).toBeGreaterThan(width < 400 ? 60 : 200);
    }
  });

  it("uses the SVG meet scale for both pan axes with horizontal and vertical letterboxing", () => {
    expect(panFromPointerDelta({ baseViewBox: "0 0 1000 400", zoom: 2, startPan: { x: 0, y: 0 }, deltaX: 20, deltaY: 20, surfaceSize: { width: 400, height: 500 } })).toEqual({ x: -25, y: -25 });
    expect(panFromPointerDelta({ baseViewBox: "0 0 400 1000", zoom: 2, startPan: { x: 0, y: 0 }, deltaX: 20, deltaY: 20, surfaceSize: { width: 500, height: 400 } })).toEqual({ x: -25, y: -25 });
  });
});
