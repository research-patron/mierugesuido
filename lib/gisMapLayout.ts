export type Bounds = [number, number, number, number];

export type GisLayoutFeature = {
  code: string;
  name?: string;
  layoutGroup?: string;
  prefectureCode?: string;
  prefectureName?: string;
  path: string;
};

export type GisHrefMunicipality = {
  municipalityCode?: string | null;
  businessKey?: string | null;
  prefectureName: string;
  municipalityName: string;
};

export const GIS_WIDTH = 1000;
export const GIS_HEIGHT = 760;
export const GIS_PAD = 16;
export const NATIONAL_OVERVIEW_VIEWBOX = "300 112 580 470";
export const NATIONAL_TOKYO_REMOTE_ISLAND_CUTOFF_Y = 325;
export const ATLAS_KAGOSHIMA_REMOTE_ISLAND_CUTOFF_Y = 455;
export const ATLAS_NAGASAKI_REMOTE_ISLAND_MIN_X = 383;
export const ATLAS_NAGASAKI_REMOTE_ISLAND_MIN_Y = 360;
export const ATLAS_HOKKAIDO_OVERVIEW_SCALE_Y = 1.12;
const INSET_VIEWBOX_PAD = 4;

export function nationalOverviewPath(feature: GisLayoutFeature) {
  if (feature.code !== "13") return feature.path;

  const keptSubpaths = splitSubpaths(feature.path).filter((path) => {
    const bounds = pathScreenBounds(path);
    return !bounds || bounds[1] <= NATIONAL_TOKYO_REMOTE_ISLAND_CUTOFF_Y;
  });

  return keptSubpaths.length > 0 ? keptSubpaths.join("") : feature.path;
}

export function atlasOverviewPath(feature: GisLayoutFeature) {
  const overviewPath = nationalOverviewPath(feature);
  if (feature.code === "42") {
    const keptSubpaths = splitSubpaths(overviewPath).filter((path) => {
      const bounds = pathScreenBounds(path);
      return !bounds
        || (bounds[0] >= ATLAS_NAGASAKI_REMOTE_ISLAND_MIN_X
          && bounds[1] >= ATLAS_NAGASAKI_REMOTE_ISLAND_MIN_Y);
    });

    return keptSubpaths.length > 0 ? keptSubpaths.join("") : overviewPath;
  }

  if (feature.code !== "46") return overviewPath;

  const keptSubpaths = splitSubpaths(overviewPath).filter((path) => {
    const bounds = pathScreenBounds(path);
    return !bounds || bounds[3] <= ATLAS_KAGOSHIMA_REMOTE_ISLAND_CUTOFF_Y;
  });

  return keptSubpaths.length > 0 ? keptSubpaths.join("") : overviewPath;
}

export function atlasDisplayPath(feature: GisLayoutFeature) {
  const overviewPath = atlasOverviewPath(feature);
  if (feature.code !== "01") return overviewPath;

  const bounds = pathScreenBounds(overviewPath);
  if (!bounds) return overviewPath;
  const originY = (bounds[1] + bounds[3]) / 2;
  return scalePathY(overviewPath, ATLAS_HOKKAIDO_OVERVIEW_SCALE_Y, originY);
}

export function scalePathY(path: string, scale: number, originY: number) {
  if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(originY) || scale === 1) return path;

  return path.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_match, xValue: string, yValue: string) => {
    const x = Number(xValue);
    const y = Number(yValue);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return `${xValue} ${yValue}`;
    const scaledY = originY + (y - originY) * scale;
    return `${formatNumber(x)} ${formatNumber(scaledY)}`;
  });
}

export function mapFeatureHref(feature: GisLayoutFeature, municipalities?: GisHrefMunicipality[]) {
  if (feature.prefectureCode) {
    const first = municipalities?.[0];
    if (first?.municipalityCode) {
      if (!first.businessKey) return `/municipalities/${first.municipalityCode}`;
      const query = new URLSearchParams();
      query.set("business", first.businessKey);
      query.set("view", "fees");
      return `/municipalities/${first.municipalityCode}?${query.toString()}`;
    }

    return `/municipalities?prefecture=${encodeURIComponent(first?.prefectureName ?? feature.prefectureName ?? "")}&q=${encodeURIComponent(feature.name ?? "")}`;
  }

  return `/map/${feature.code}`;
}

export function insetCardStyleVariables(feature: GisLayoutFeature) {
  const bounds = pathScreenBounds(feature.path);
  const isOkinawa = feature.layoutGroup === "okinawa";
  const isHokkaido = feature.layoutGroup === "hokkaido";
  const [viewBoxWidth, viewBoxHeight] = bounds
    ? [bounds[2] - bounds[0] + INSET_VIEWBOX_PAD * 2, bounds[3] - bounds[1] + INSET_VIEWBOX_PAD * 2]
    : [isOkinawa ? 190 : 356, isOkinawa ? 70 : 160];
  const viewBoxRatio = viewBoxWidth / Math.max(viewBoxHeight, 1);
  const targetMapHeight = isOkinawa ? 96 : isHokkaido ? 128 : 96;
  const minMapHeight = isOkinawa ? 90 : isHokkaido ? 118 : 88;
  const maxMapHeight = isOkinawa ? 104 : isHokkaido ? 134 : 108;

  const mapHeight = clamp(targetMapHeight, minMapHeight, maxMapHeight);
  const mapWidth = mapHeight * viewBoxRatio;
  const cardWidth = mapWidth + 64;
  const cardHeight = mapHeight + 64;

  return {
    "--inset-map-width": `${Math.round(mapWidth)}px`,
    "--inset-map-height": `${Math.round(mapHeight)}px`,
    "--inset-card-width": `${Math.round(cardWidth)}px`,
    "--inset-card-height": `${Math.round(cardHeight)}px`
  };
}

export function zoomViewBox(viewBox: string, zoom: number) {
  const values = viewBox.split(/\s+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return viewBox;
  const [x, y, width, height] = values;
  if (zoom <= 1) return viewBox;
  const nextWidth = width / zoom;
  const nextHeight = height / zoom;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const nextX = centerX - nextWidth / 2;
  const nextY = centerY - nextHeight / 2;
  return `${nextX} ${nextY} ${nextWidth} ${nextHeight}`;
}

export function screenViewBox(features: GisLayoutFeature[], pad = 18) {
  const bounds = features.map((feature) => pathScreenBounds(feature.path)).filter(Boolean) as Bounds[];
  if (bounds.length === 0) return null;
  const [minX, minY, maxX, maxY] = combineBounds(bounds);
  return `${Math.max(minX - pad, 0)} ${Math.max(minY - pad, 0)} ${Math.max(maxX - minX + pad * 2, 1)} ${Math.max(maxY - minY + pad * 2, 1)}`;
}

export function primaryFeatureScreenBounds(feature: GisLayoutFeature): Bounds | null {
  const subpathBounds = splitSubpaths(feature.path)
    .map((path) => pathScreenBounds(path))
    .filter(Boolean) as Bounds[];
  const primaryBounds = subpathBounds
    .map((bounds) => ({ bounds, area: Math.max(bounds[2] - bounds[0], 0) * Math.max(bounds[3] - bounds[1], 0) }))
    .sort((a, b) => b.area - a.area)[0]?.bounds ?? pathScreenBounds(feature.path);
  return primaryBounds ?? null;
}

export function pathScreenBounds(path: string): Bounds | null {
  const matches = path.matchAll(/[-]?\d+(?:\.\d+)?\s+[-]?\d+(?:\.\d+)?/g);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const match of matches) {
    const [x, y] = match[0].split(/\s+/).map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

export function combineBounds(boundsList: Bounds[]): Bounds {
  return boundsList.reduce<Bounds>((acc, bounds) => [
    Math.min(acc[0], bounds[0]),
    Math.min(acc[1], bounds[1]),
    Math.max(acc[2], bounds[2]),
    Math.max(acc[3], bounds[3])
  ], [Infinity, Infinity, -Infinity, -Infinity]);
}

export function splitSubpaths(path: string) {
  return path.match(/M[^M]+/g) ?? [];
}

const WESTERNMOST_MUNICIPALITY_SUBPATH_ONLY = new Set(["01403"]);

/**
 * The protected N03 payload contains one known same-name collision: the
 * present-day Hokkaido municipality `01403 泊村` and a distant historical
 * Northern Territories polygon were grouped into one feature. Keep the actual
 * western municipality interactive and return the distant polygon separately
 * so callers can render it as neutral, non-interactive geography. The source
 * GIS file remains unchanged.
 */
export function municipalityDisplayPaths(feature: { code: string; path: string }) {
  if (!WESTERNMOST_MUNICIPALITY_SUBPATH_ONLY.has(feature.code)) {
    return { interactivePath: feature.path, excludedPath: "" };
  }

  const parts = splitSubpaths(feature.path)
    .map((path) => ({ path, bounds: pathScreenBounds(path) }))
    .filter((item): item is { path: string; bounds: Bounds } => Boolean(item.bounds))
    .sort((a, b) => a.bounds[0] - b.bounds[0]);

  if (parts.length < 2) return { interactivePath: feature.path, excludedPath: "" };
  return {
    interactivePath: parts[0].path,
    excludedPath: parts.slice(1).map((item) => item.path).join("")
  };
}

type Point = [number, number];

type OutlineEdge = {
  from: Point;
  to: Point;
  fromKey: string;
  toKey: string;
};

type OutlineRing = {
  points: Point[];
  bounds: Bounds;
};

const OUTLINE_POINT_PRECISION = 0.1;
const OUTLINE_SIDE_SAMPLE_OFFSET = 0.95;

export function prefectureOutlinePath(path: string) {
  const rings = pathRings(path);
  const outlineEdges: OutlineEdge[] = [];

  for (const ring of rings) {
    const points = ring.points;

    for (let index = 0; index < points.length; index += 1) {
      const from = points[index];
      const to = points[(index + 1) % points.length];
      const fromKey = pointKey(from);
      const toKey = pointKey(to);
      if (fromKey === toKey) continue;
      const edge: OutlineEdge = { from, to, fromKey, toKey };
      if (isExteriorSegment(edge, rings)) outlineEdges.push(edge);
    }
  }

  return stitchOutlineEdges(outlineEdges);
}

function pathRings(path: string): OutlineRing[] {
  return splitSubpaths(path).map((subpath) => {
    const matches = subpath.matchAll(/[-]?\d+(?:\.\d+)?\s+[-]?\d+(?:\.\d+)?/g);
    const points = Array.from(matches, (match) => {
      const [x, y] = match[0].split(/\s+/).map(Number);
      return [x, y] as Point;
    }).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (points.length < 2) return null;
    const closedPoints = samePoint(points[0], points[points.length - 1]) ? points.slice(0, -1) : points;
    if (closedPoints.length < 2) return null;
    return { points: closedPoints, bounds: pointBounds(closedPoints) };
  }).filter((ring): ring is OutlineRing => Boolean(ring));
}

function isExteriorSegment(edge: OutlineEdge, rings: OutlineRing[]) {
  const dx = edge.to[0] - edge.from[0];
  const dy = edge.to[1] - edge.from[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.05) return false;

  const midpoint: Point = [(edge.from[0] + edge.to[0]) / 2, (edge.from[1] + edge.to[1]) / 2];
  const normal: Point = [-dy / length, dx / length];
  const left: Point = [
    midpoint[0] + normal[0] * OUTLINE_SIDE_SAMPLE_OFFSET,
    midpoint[1] + normal[1] * OUTLINE_SIDE_SAMPLE_OFFSET
  ];
  const right: Point = [
    midpoint[0] - normal[0] * OUTLINE_SIDE_SAMPLE_OFFSET,
    midpoint[1] - normal[1] * OUTLINE_SIDE_SAMPLE_OFFSET
  ];

  const leftInside = pointInAnyRing(left, rings);
  const rightInside = pointInAnyRing(right, rings);
  return !(leftInside && rightInside);
}

function pointInAnyRing(point: Point, rings: OutlineRing[]) {
  return rings.some((ring) => pointWithinBounds(point, ring.bounds, OUTLINE_SIDE_SAMPLE_OFFSET) && pointInRing(point, ring.points));
}

function pointInRing(point: Point, ring: Point[]) {
  const [x, y] = point;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    const intersects = (yi > y) !== (yj > y)
      && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointBounds(points: Point[]): Bounds {
  return points.reduce<Bounds>((acc, [x, y]) => [
    Math.min(acc[0], x),
    Math.min(acc[1], y),
    Math.max(acc[2], x),
    Math.max(acc[3], y)
  ], [Infinity, Infinity, -Infinity, -Infinity]);
}

function pointWithinBounds([x, y]: Point, bounds: Bounds, pad = 0) {
  return x >= bounds[0] - pad
    && x <= bounds[2] + pad
    && y >= bounds[1] - pad
    && y <= bounds[3] + pad;
}

function stitchOutlineEdges(edges: OutlineEdge[]) {
  const used = new Set<number>();
  const outgoing = new Map<string, number[]>();
  const incoming = new Map<string, number[]>();
  const paths: string[] = [];

  edges.forEach((edge, index) => {
    const out = outgoing.get(edge.fromKey) ?? [];
    out.push(index);
    outgoing.set(edge.fromKey, out);

    const inc = incoming.get(edge.toKey) ?? [];
    inc.push(index);
    incoming.set(edge.toKey, inc);
  });

  for (let index = 0; index < edges.length; index += 1) {
    if (used.has(index)) continue;

    const first = edges[index];
    const points: Point[] = [first.from, first.to];
    let startKey = first.fromKey;
    let currentKey = first.toKey;
    used.add(index);

    while (currentKey !== startKey) {
      const next = findUnused(outgoing.get(currentKey), used);
      if (next != null) {
        const edge = edges[next];
        points.push(edge.to);
        currentKey = edge.toKey;
        used.add(next);
        continue;
      }

      const reverse = findUnused(incoming.get(currentKey), used);
      if (reverse == null) break;
      const edge = edges[reverse];
      points.push(edge.from);
      currentKey = edge.fromKey;
      used.add(reverse);
    }

    if (points.length < 2) continue;
    const closed = currentKey === startKey;
    paths.push(`M${points.map(formatPoint).join("L")}${closed ? "Z" : ""}`);
  }

  return paths.join("");
}

function findUnused(indices: number[] | undefined, used: Set<number>) {
  return indices?.find((index) => !used.has(index)) ?? null;
}

function samePoint(a: Point, b: Point) {
  return pointKey(a) === pointKey(b);
}

function pointKey(point: Point) {
  return `${Math.round(point[0] / OUTLINE_POINT_PRECISION)}:${Math.round(point[1] / OUTLINE_POINT_PRECISION)}`;
}

function formatPoint([x, y]: Point) {
  return `${formatNumber(x)} ${formatNumber(y)}`;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
