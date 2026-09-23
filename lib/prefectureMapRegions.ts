import { combineBounds, pathScreenBounds, type Bounds, type GisLayoutFeature } from "./gisMapLayout";

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

export function remoteIslandFeatures<T extends GisLayoutFeature>(code: string, features: T[]): T[] {
  const islands = new Set(islandCodes[code] ?? []);
  return features.filter(feature => islands.has(feature.code));
}

export function fittedRegionViewBox(features: GisLayoutFeature[]): string | null {
  const boxes = features.map(f => pathScreenBounds(f.path)).filter((b): b is Bounds => b !== null);
  if (!boxes.length) return null;
  const [x, y, right, bottom] = combineBounds(boxes);
  // Relative padding matters: Tokyo's mainland occupies only about 46 source
  // units. The old fixed 22-unit margin overwhelmed any local fit.
  const padding = Math.max(right - x, bottom - y, 0.001) * 0.045;
  return `${x - padding} ${y - padding} ${Math.max(right - x, 0.001) + padding * 2} ${Math.max(bottom - y, 0.001) + padding * 2}`;
}

export function mainlandMapFeatures<T extends GisLayoutFeature>(code: string, features: T[]): T[] {
  const islands = new Set(islandCodes[code] ?? []);
  return features.filter(feature => !islands.has(feature.code));
}
