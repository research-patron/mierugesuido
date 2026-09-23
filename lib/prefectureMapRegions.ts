import { combineBounds, pathScreenBounds, primaryFeatureScreenBounds, splitSubpaths, type Bounds, type GisLayoutFeature } from "./gisMapLayout";

// Display-only membership, keyed by the codes in the shipped N03 data. No
// financial rows or source geometry are filtered by these settings.
const islandCodes: Record<string, string[]> = {
  "13": ["13361", "13362", "13363", "13364", "13381", "13382", "13401", "13402", "13421", "13801", "13802", "13803", "13804"],
  "46": ["46213", "46222", "46303", "46304", "46501", "46502", "46505", "46523", "46524", "46525", "46527", "46529", "46530", "46531", "46532", "46533", "46534", "46535", "46801", "46802"],
  "47": ["47207", "47214", "47353", "47354", "47355", "47356", "47357", "47358", "47359", "47360", "47361", "47375", "47381", "47382"],
  "42": ["42209", "42210", "42211", "42383", "42411"],
  "15": ["15224", "15586"],
  "32": ["32525", "32526", "32527", "32528"],
  "01": ["01367", "01517", "01518", "01519"]
};

export type MapRegion<T> = { id: string; label: string; features: T[]; viewBox: string };

export function fittedRegionViewBox(features: GisLayoutFeature[]): string | null {
  const boxes = features.map(f => pathScreenBounds(f.path)).filter((b): b is Bounds => b !== null);
  if (!boxes.length) return null;
  const [x, y, right, bottom] = combineBounds(boxes);
  // Relative padding matters: Tokyo's mainland occupies only about 46 source
  // units. The old fixed 22-unit margin overwhelmed any local fit.
  const padding = Math.max(right - x, bottom - y, 0.001) * 0.045;
  return `${x - padding} ${y - padding} ${Math.max(right - x, 0.001) + padding * 2} ${Math.max(bottom - y, 0.001) + padding * 2}`;
}

type Part = { path: string; bounds: Bounds };
function separateRemoteParts(parts: Part[], gapLimit: number): Part[][] {
  let best: { axis: number; index: number; gap: number; sorted: Part[] } | null = null;
  for (const axis of [0, 1]) {
    const sorted = [...parts].sort((a, b) => a.bounds[axis] - b.bounds[axis]);
    let end = sorted[0]?.bounds[axis + 2] ?? 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].bounds[axis] - end;
      if (gap > gapLimit && (!best || gap > best.gap)) best = { axis, index: i, gap, sorted };
      end = Math.max(end, sorted[i].bounds[axis + 2]);
    }
  }
  return best
    ? [...separateRemoteParts(best.sorted.slice(0, best.index), gapLimit), ...separateRemoteParts(best.sorted.slice(best.index), gapLimit)]
    : [parts];
}

export function buildPrefectureMapRegions<T extends GisLayoutFeature>(code: string, features: T[]): MapRegion<T>[] {
  const fullViewBox = fittedRegionViewBox(features);
  if (!fullViewBox) return [];
  const all = { id: "all", label: "都道府県全域", features, viewBox: fullViewBox };
  const islands = new Set(islandCodes[code] ?? []);
  if (!islands.size) return [all];
  const main = features.filter(f => !islands.has(f.code));
  const regions: MapRegion<T>[] = [];
  const mainViewBox = fittedRegionViewBox(main);
  if (mainViewBox) regions.push({ id: "main", label: code === "13" ? "本州側（区部・多摩）" : "主図", features: main, viewBox: mainViewBox });
  for (const feature of features.filter(f => islands.has(f.code))) {
    const parts = splitSubpaths(feature.path).map(path => ({ path, bounds: pathScreenBounds(path)! }));
    if (!parts.length) continue;
    // Split only genuinely remote components; preserve every ring verbatim.
    // Nearby rings (including holes) remain together. Numerical region names
    // refer to display frames, not invented administrative/geographic areas.
    const largestDimension = Math.max(...parts.map(p => Math.max(p.bounds[2] - p.bounds[0], p.bounds[3] - p.bounds[1])));
    const groups = separateRemoteParts(parts, Math.max(largestDimension * 2, 0.001));
    groups.sort((a, b) => {
      const area = (ps: Part[]) => ps.reduce((sum, p) => sum + (p.bounds[2] - p.bounds[0]) * (p.bounds[3] - p.bounds[1]), 0);
      return area(b) - area(a);
    });
    groups.forEach((group, index) => {
      const path = group.map(p => p.path).join("");
      const bounds = primaryFeatureScreenBounds({ ...feature, path })!;
      const partFeature = { ...feature, path, labelPoint: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2], callout: undefined };
      regions.push({ id: `${feature.code}-${index + 1}`, label: `${feature.name}${groups.length > 1 ? `（表示枠${index + 1}/${groups.length}）` : ""}`, features: [partFeature], viewBox: fittedRegionViewBox([partFeature])! });
    });
  }
  return [...regions, all];
}
