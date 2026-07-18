import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

type Point = [number, number];
type Ring = Point[];
type ScreenRing = Point[];
type Bounds = [number, number, number, number];
type MapSlot = { x: number; y: number; width: number; height: number; pad?: number };

type FeatureGroup = {
  code: string;
  name: string;
  prefectureCode: string;
  prefectureName: string;
  rings: Ring[];
  bounds: Bounds;
};

const DATA_YEAR = "2023";
const DATA_DATE = "20230101";
const GEOJSON_DATE = "230101";
const OUTPUT = "public/gis/mlit-n03-simplified.json";
const WIDTH = 1000;
const HEIGHT = 760;
const DEFAULT_TOLERANCE = 0.008;
const MIN_RING_AREA = 0.00000002;
const MIN_SCREEN_RING_AREA = 0.35;
const FULL_SLOT: MapSlot = { x: 0, y: 0, width: WIDTH, height: HEIGHT, pad: 16 };
const NATIONAL_MAIN_SLOT: MapSlot = { x: 245, y: 118, width: 650, height: 535, pad: 10 };
const NATIONAL_HOKKAIDO_SLOT: MapSlot = { x: 50, y: 38, width: 365, height: 245, pad: 8 };
const NATIONAL_OKINAWA_SLOT: MapSlot = { x: 690, y: 610, width: 200, height: 118, pad: 8 };
const NATIONAL_REMOTE_RING_RATIO = 0.0025;
const NATIONAL_LABEL_POINT_OVERRIDES: Record<string, Point> = {
  "01": [230, 172],
  "47": [785, 678]
};

const PREFECTURES = [
  ["01", "北海道"],
  ["02", "青森県"],
  ["03", "岩手県"],
  ["04", "宮城県"],
  ["05", "秋田県"],
  ["06", "山形県"],
  ["07", "福島県"],
  ["08", "茨城県"],
  ["09", "栃木県"],
  ["10", "群馬県"],
  ["11", "埼玉県"],
  ["12", "千葉県"],
  ["13", "東京都"],
  ["14", "神奈川県"],
  ["15", "新潟県"],
  ["16", "富山県"],
  ["17", "石川県"],
  ["18", "福井県"],
  ["19", "山梨県"],
  ["20", "長野県"],
  ["21", "岐阜県"],
  ["22", "静岡県"],
  ["23", "愛知県"],
  ["24", "三重県"],
  ["25", "滋賀県"],
  ["26", "京都府"],
  ["27", "大阪府"],
  ["28", "兵庫県"],
  ["29", "奈良県"],
  ["30", "和歌山県"],
  ["31", "鳥取県"],
  ["32", "島根県"],
  ["33", "岡山県"],
  ["34", "広島県"],
  ["35", "山口県"],
  ["36", "徳島県"],
  ["37", "香川県"],
  ["38", "愛媛県"],
  ["39", "高知県"],
  ["40", "福岡県"],
  ["41", "佐賀県"],
  ["42", "長崎県"],
  ["43", "熊本県"],
  ["44", "大分県"],
  ["45", "宮崎県"],
  ["46", "鹿児島県"],
  ["47", "沖縄県"]
] as const;

const args = new Map(
  process.argv.slice(1).filter((arg) => arg !== "--" && arg.startsWith("--")).map((arg) => {
    const [key, value = "true"] = arg.replace(/\\=/g, "=").replace(/^--/, "").split("=");
    return [key, value];
  })
);

const tolerance = Number(args.get("tolerance") ?? DEFAULT_TOLERANCE);
const municipalityTolerance = Number(args.get("municipality-tolerance") ?? process.env.N03_MUNICIPALITY_TOLERANCE ?? 0.003);
const selected = new Set((args.get("prefectures") ?? process.env.N03_PREFECTURES ?? PREFECTURES.map(([code]) => code).join(",")).split(","));
const cacheDir = args.get("cache-dir") ?? process.env.N03_CACHE_DIR ?? path.join(os.tmpdir(), "sewer-fee-n03-2023");

if (process.env.N03_DEBUG === "1") {
  console.error(JSON.stringify({
    argv: process.argv,
    args: Object.fromEntries(args),
    envPrefectures: process.env.N03_PREFECTURES,
    selected: [...selected],
    cacheDir
  }, null, 2));
}

async function main() {
  await mkdir(cacheDir, { recursive: true });
  const prefectureGroups = new Map<string, FeatureGroup>();
  const municipalityGroups = new Map<string, FeatureGroup>();

  for (const [prefectureCode, expectedPrefectureName] of PREFECTURES) {
    if (!selected.has(prefectureCode)) continue;
    console.error(`processing ${prefectureCode} ${expectedPrefectureName}`);
    const zipPath = await ensureZip(prefectureCode);
    const geojson = await readGeoJson(zipPath, prefectureCode);

    for (const feature of geojson.features ?? []) {
      const properties = feature.properties ?? {};
      const prefectureName = String(properties.N03_001 ?? expectedPrefectureName);
      const n03Code = String(properties.N03_007 ?? "");
      const municipalityName = normalizeMunicipalityName(properties);
      if (!municipalityName || !feature.geometry) continue;

      const rawRings = geometryToRings(feature.geometry)
        .filter(isRenderableGeoRing);
      const rings = rawRings
        .map((ring) => simplifyClosedRing(ring, municipalityTolerance))
        .filter(isRenderableGeoRing);

      if (rings.length === 0) continue;

      const prefGroup = getGroup(prefectureGroups, prefectureCode, prefectureName, prefectureCode, prefectureName);
      addRings(prefGroup, rawRings);

      const municipalityCode = normalizeMunicipalityCode(n03Code, properties);
      const key = `${prefectureCode}:${municipalityName}`;
      const municipalityGroup = getGroup(municipalityGroups, key, municipalityName, prefectureCode, prefectureName, municipalityCode);
      addRings(municipalityGroup, rings);
    }
    console.error(`processed ${prefectureCode} ${expectedPrefectureName}`);
  }

  for (const group of prefectureGroups.values()) {
    group.rings = group.rings
      .map((ring) => simplifyFastRing(ring, tolerance * 1.8))
      .filter(isRenderableGeoRing);
  }

  const nationalRingsByPrefecture = new Map<string, Ring[]>();
  for (const [code] of PREFECTURES) {
    const group = prefectureGroups.get(code);
    if (!group) continue;
    nationalRingsByPrefecture.set(code, ringsForNationalDisplay(code, group.rings));
  }
  const nationalMainRingBounds = [...nationalRingsByPrefecture.entries()]
    .filter(([code]) => code !== "01" && code !== "47")
    .flatMap(([, rings]) => rings.map(ringBounds));
  const nationalMainBounds = nationalMainRingBounds.length > 0
    ? combineBounds(nationalMainRingBounds)
    : combineBounds([...prefectureGroups.values()].map((group) => group.bounds));
  const prefectures = PREFECTURES
    .filter(([code]) => prefectureGroups.has(code))
    .map(([code]) => {
      const group = prefectureGroups.get(code)!;
      const layoutGroup = nationalLayoutGroup(code);
      const slot = nationalSlot(layoutGroup);
      const displayRings = nationalRingsByPrefecture.get(code) ?? group.rings;
      const displayBounds = layoutGroup === "main" ? nationalMainBounds : combineBounds(displayRings.map(ringBounds));
      const screenRings = projectRings(displayRings, displayBounds, slot);
      const label = labelSpecForFeature(group.name, screenRings, "national");
      const labelPoint = NATIONAL_LABEL_POINT_OVERRIDES[code] ?? label.labelPoint;
      return {
        code,
        name: group.name,
        path: pathFromScreenRings(screenRings),
        bounds: roundBounds(group.bounds),
        centroid: centroid(group.bounds),
        labelPoint,
        labelLines: label.labelLines,
        labelSize: label.labelSize,
        labelAnchor: label.labelAnchor,
        layoutGroup,
        municipalityCount: [...municipalityGroups.values()].filter((item) => item.prefectureCode === code).length
      };
    });

  const municipalitiesByPrefecture = Object.fromEntries(
    PREFECTURES
      .filter(([code]) => prefectureGroups.has(code))
      .map(([code]) => {
        const localGroups = [...municipalityGroups.values()]
          .filter((group) => group.prefectureCode === code)
          .sort((a, b) => a.code.localeCompare(b.code, "ja") || a.name.localeCompare(b.name, "ja"));
        const localBounds = combineBounds(localGroups.map((group) => group.bounds));
        return [
          code,
          localGroups.map((group) => {
            const screenRings = projectRings(group.rings, localBounds, FULL_SLOT);
            const label = labelSpecForFeature(group.name, screenRings, "municipality");
            return {
              code: group.code,
              name: group.name,
              prefectureCode: group.prefectureCode,
              prefectureName: group.prefectureName,
              path: pathFromScreenRings(screenRings),
              bounds: roundBounds(group.bounds),
              centroid: centroid(group.bounds),
              labelPoint: label.labelPoint,
              labelLines: label.labelLines,
              labelSize: label.labelSize,
              labelAnchor: label.labelAnchor,
              callout: label.callout
            };
          })
        ];
      })
  );

  const output = {
    source: {
      name: "国土交通省 国土数値情報 行政区域データ N03",
      url: "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-v3_1.html",
      dataYear: DATA_YEAR,
      dataDate: "2023-01-01",
      format: "県別ZIP内GeoJSONをWeb表示用SVGパスへ軽量化",
      note: "国土数値情報の行政区域データを簡略化して表示しています。境界未確定地域等の注意事項は国土数値情報の原典を確認してください。"
    },
    viewBox: { width: WIDTH, height: HEIGHT },
    guideLines: [
      { from: [325, 284], to: [470, 157] },
      { from: [692, 612], to: [640, 552] }
    ],
    prefectures,
    municipalitiesByPrefecture
  };

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(output));
  console.log(JSON.stringify({
    output: OUTPUT,
    prefectures: prefectures.length,
    municipalities: Object.values(municipalitiesByPrefecture).reduce((sum, items) => sum + items.length, 0),
    bytes: JSON.stringify(output).length
  }, null, 2));
}

async function ensureZip(prefectureCode: string) {
  const file = `N03-${DATA_DATE}_${prefectureCode}_GML.zip`;
  const zipPath = path.join(cacheDir, file);
  if (existsSync(zipPath)) return zipPath;

  const url = `https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-${DATA_YEAR}/${file}`;
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url);
    lastStatus = response.status;
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(zipPath, buffer);
      return zipPath;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
  }
  throw new Error(`Failed to download ${url}: ${lastStatus}`);
  return zipPath;
}

async function readGeoJson(zipPath: string, prefectureCode: string) {
  const expected = `N03-23_${prefectureCode}_${GEOJSON_DATE}.geojson`;
  try {
    const text = execFileSync("unzip", ["-p", zipPath, expected], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
    return JSON.parse(text);
  } catch {
    const list = execFileSync("unzip", ["-Z1", zipPath]).toString("utf8").split("\n");
    const geojsonFile = list.find((name) => name.endsWith(".geojson"));
    if (!geojsonFile) throw new Error(`No GeoJSON found in ${zipPath}`);
    const text = execFileSync("unzip", ["-p", zipPath, geojsonFile], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
    return JSON.parse(text);
  }
}

function normalizeMunicipalityName(properties: Record<string, unknown>) {
  const cityOrCounty = stringOrNull(properties.N03_003);
  const cityTown = stringOrNull(properties.N03_004);
  if (cityOrCounty && cityTown && cityTown.startsWith(cityOrCounty) && cityTown.endsWith("区")) return cityOrCounty;
  return cityTown ?? cityOrCounty;
}

function normalizeMunicipalityCode(n03Code: string, properties: Record<string, unknown>) {
  const cityOrCounty = stringOrNull(properties.N03_003);
  const cityTown = stringOrNull(properties.N03_004);
  if (cityOrCounty && cityTown && cityTown.startsWith(cityOrCounty) && cityTown.endsWith("区") && n03Code.length >= 3) {
    return `${n03Code.slice(0, 3)}00`;
  }
  return n03Code;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getGroup(
  map: Map<string, FeatureGroup>,
  key: string,
  name: string,
  prefectureCode: string,
  prefectureName: string,
  code = key
) {
  const existing = map.get(key);
  if (existing) return existing;
  const group = {
    code,
    name,
    prefectureCode,
    prefectureName,
    rings: [],
    bounds: [Infinity, Infinity, -Infinity, -Infinity] as Bounds
  };
  map.set(key, group);
  return group;
}

function geometryToRings(geometry: any): Ring[] {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flatMap((polygon: Ring[]) => polygon);
  return [];
}

function addRings(group: FeatureGroup, rings: Ring[]) {
  for (const ring of rings) {
    group.rings.push(ring);
    for (const [lon, lat] of ring) {
      group.bounds[0] = Math.min(group.bounds[0], lon);
      group.bounds[1] = Math.min(group.bounds[1], lat);
      group.bounds[2] = Math.max(group.bounds[2], lon);
      group.bounds[3] = Math.max(group.bounds[3], lat);
    }
  }
}

function nationalLayoutGroup(code: string) {
  if (code === "01") return "hokkaido";
  if (code === "47") return "okinawa";
  return "main";
}

function nationalSlot(group: string): MapSlot {
  if (group === "hokkaido") return NATIONAL_HOKKAIDO_SLOT;
  if (group === "okinawa") return NATIONAL_OKINAWA_SLOT;
  return NATIONAL_MAIN_SLOT;
}

function ringsForNationalDisplay(code: string, rings: Ring[]) {
  if (code === "01" || code === "47") return rings;
  const areas = rings.map((ring) => Math.abs(ringArea(ring)));
  const largest = Math.max(...areas, 0);
  const threshold = largest * NATIONAL_REMOTE_RING_RATIO;
  return rings.filter((ring, index) => areas[index] >= threshold);
}

function ringBounds(ring: Ring): Bounds {
  return ring.reduce<Bounds>((acc, [x, y]) => [
    Math.min(acc[0], x),
    Math.min(acc[1], y),
    Math.max(acc[2], x),
    Math.max(acc[3], y)
  ], [Infinity, Infinity, -Infinity, -Infinity]);
}

function projectRings(rings: Ring[], bounds: Bounds, slot: MapSlot): ScreenRing[] {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const pad = slot.pad ?? 16;
  const lonSpan = Math.max(maxLon - minLon, 0.001);
  const latSpan = Math.max(maxLat - minLat, 0.001);
  const scale = Math.min((slot.width - pad * 2) / lonSpan, (slot.height - pad * 2) / latSpan);
  const offsetX = slot.x + (slot.width - lonSpan * scale) / 2;
  const offsetY = slot.y + (slot.height - latSpan * scale) / 2;

  return rings
    .map((ring) => ring.map(([lon, lat]) => [
      offsetX + (lon - minLon) * scale,
      offsetY + (maxLat - lat) * scale
    ] as Point))
    .filter(isRenderableScreenRing);
}

function pathFromScreenRings(rings: ScreenRing[]) {
  return rings
    .map((ring) => {
      const commands = ring.map(([x, y], index) => `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`).join("");
      return `${commands}Z`;
    })
    .filter(Boolean)
    .join("");
}

type LabelSpec = {
  labelPoint: Point;
  labelLines: string[];
  labelSize: number;
  labelAnchor: "middle" | "start" | "end";
  callout?: { from: Point; to: Point };
};

function labelSpecForFeature(name: string, screenRings: ScreenRing[], scope: "national" | "municipality"): LabelSpec {
  const primaryRing = largestScreenRing(screenRings);
  const bounds = primaryRing ? screenBounds(primaryRing) : [WIDTH / 2, HEIGHT / 2, WIDTH / 2, HEIGHT / 2] as Bounds;
  const anchor = primaryRing ? visualCenter(primaryRing, bounds) : [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] as Point;
  const lines = splitLabelLines(name, scope);
  const size = labelSizeForBounds(name, lines, bounds, scope);
  const lineHeight = size * 1.1;
  const labelWidth = Math.max(...lines.map((line) => line.length)) * size;
  const labelHeight = lines.length * lineHeight;
  const availableWidth = Math.max(bounds[2] - bounds[0], 1);
  const availableHeight = Math.max(bounds[3] - bounds[1], 1);

  if (scope === "municipality" && (availableWidth < labelWidth * 0.74 || availableHeight < labelHeight * 0.78)) {
    const calloutPoint = calloutLabelPoint(anchor, bounds, labelWidth, labelHeight);
    return {
      labelPoint: roundPoint(calloutPoint),
      labelLines: lines,
      labelSize: Math.max(5.8, Math.min(size, 8.2)),
      labelAnchor: calloutPoint[0] >= anchor[0] ? "start" : "end",
      callout: { from: roundPoint(anchor), to: roundPoint(calloutPoint) }
    };
  }

  return {
    labelPoint: roundPoint(anchor),
    labelLines: lines,
    labelSize: size,
    labelAnchor: "middle"
  };
}

function largestScreenRing(rings: ScreenRing[]) {
  let largest: ScreenRing | null = null;
  let largestArea = -1;
  for (const ring of rings) {
    const area = Math.abs(screenRingArea(ring));
    if (area > largestArea) {
      largest = ring;
      largestArea = area;
    }
  }
  return largest;
}

function screenBounds(ring: ScreenRing): Bounds {
  return ring.reduce<Bounds>((acc, [x, y]) => [
    Math.min(acc[0], x),
    Math.min(acc[1], y),
    Math.max(acc[2], x),
    Math.max(acc[3], y)
  ], [Infinity, Infinity, -Infinity, -Infinity]);
}

function visualCenter(ring: ScreenRing, bounds: Bounds): Point {
  const center: Point = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
  let best = pointInPolygon(center, ring) ? center : ring[Math.floor(ring.length / 2)] ?? center;
  let bestDistance = pointInPolygon(best, ring) ? distanceToRing(best, ring) : -1;
  let step = Math.max(Math.min(bounds[2] - bounds[0], bounds[3] - bounds[1]) / 5, 2);

  for (let roundIndex = 0; roundIndex < 4; roundIndex += 1) {
    const minX = Math.max(bounds[0], best[0] - step * 3);
    const maxX = Math.min(bounds[2], best[0] + step * 3);
    const minY = Math.max(bounds[1], best[1] - step * 3);
    const maxY = Math.min(bounds[3], best[1] + step * 3);

    for (let x = minX; x <= maxX; x += step) {
      for (let y = minY; y <= maxY; y += step) {
        const point: Point = [x, y];
        if (!pointInPolygon(point, ring)) continue;
        const distance = distanceToRing(point, ring);
        if (distance > bestDistance) {
          best = point;
          bestDistance = distance;
        }
      }
    }
    step /= 2;
  }

  return best;
}

function splitLabelLines(name: string, scope: "national" | "municipality") {
  if (scope === "national" || name.length <= 4) return [name];
  const suffix = name.match(/^(.+)(市|町|村|区)$/);
  if (suffix && suffix[1].length >= 3 && name.length <= 7) return [suffix[1], suffix[2]];
  const countyTown = name.match(/^(.+郡)(.+)$/);
  if (countyTown && countyTown[2].length >= 2) return [countyTown[1], countyTown[2]];
  const splitAt = Math.ceil(name.length / 2);
  return [name.slice(0, splitAt), name.slice(splitAt)];
}

function labelSizeForBounds(name: string, lines: string[], bounds: Bounds, scope: "national" | "municipality") {
  const width = Math.max(bounds[2] - bounds[0], 1);
  const height = Math.max(bounds[3] - bounds[1], 1);
  const shortSide = Math.min(width, height);
  const area = width * height;

  if (scope === "national") {
    if (name === "北海道") return 15;
    if (shortSide < 15 || area < 700) return 8.2;
    if (shortSide < 24 || name.length >= 4) return 9.5;
    if (shortSide > 55 && area > 6000) return 13.2;
    return 11.4;
  }

  const longest = Math.max(...lines.map((line) => line.length));
  if (shortSide < 9 || area < 90) return 5.8;
  if (shortSide < 15 || area < 180) return 6.5;
  if (longest >= 5 || lines.length > 1) return 8.2;
  if (shortSide > 40 && area > 1800) return 12.4;
  return 10.2;
}

function calloutLabelPoint(anchor: Point, bounds: Bounds, labelWidth: number, labelHeight: number): Point {
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;
  const directionX = anchor[0] >= centerX ? 1 : -1;
  const directionY = anchor[1] >= centerY ? 1 : -1;
  const x = clamp(anchor[0] + directionX * Math.max(labelWidth * 0.46, 16), 18, WIDTH - 18);
  const y = clamp(anchor[1] + directionY * Math.max(labelHeight * 0.72, 14), 18, HEIGHT - 18);
  return [x, y];
}

function pointInPolygon(point: Point, ring: ScreenRing) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 0.000001) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToRing(point: Point, ring: ScreenRing) {
  let minDistance = Infinity;
  for (let index = 0; index < ring.length - 1; index += 1) {
    minDistance = Math.min(minDistance, pointToSegmentDistance(point, ring[index], ring[index + 1]));
  }
  return minDistance;
}

function pointToSegmentDistance(point: Point, start: Point, end: Point) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundPoint(point: Point): Point {
  return [round(point[0]), round(point[1])];
}

function buildExteriorBoundaryRings(rings: Ring[]): Ring[] {
  const edges = new Map<string, [Point, Point]>();

  for (const ring of rings) {
    for (let index = 0; index < ring.length - 1; index += 1) {
      const a = normalizePoint(ring[index]);
      const b = normalizePoint(ring[index + 1]);
      if (samePoint(a, b)) continue;
      const key = edgeKey(a, b);
      if (edges.has(key)) {
        edges.delete(key);
      } else {
        edges.set(key, [a, b]);
      }
    }
  }

  const adjacency = new Map<string, Set<string>>();
  for (const [key, [a, b]] of edges) {
    addNeighbor(adjacency, pointKey(a), pointKey(b));
    addNeighbor(adjacency, pointKey(b), pointKey(a));
    edges.set(key, [a, b]);
  }

  const remaining = new Set(edges.keys());
  const result: Ring[] = [];

  while (remaining.size > 0) {
    const firstKey = remaining.values().next().value;
    if (!firstKey) break;
    const firstEdge = edges.get(firstKey);
    if (!firstEdge) {
      remaining.delete(firstKey);
      continue;
    }

    remaining.delete(firstKey);
    const start = pointKey(firstEdge[0]);
    let previous = start;
    let current = pointKey(firstEdge[1]);
    const chain = [firstEdge[0], firstEdge[1]];

    for (let guard = 0; guard < 50000 && current !== start; guard += 1) {
      const neighbors = [...(adjacency.get(current) ?? [])];
      const next = neighbors.find((neighbor) => neighbor !== previous && remaining.has(edgeKeyFromKeys(current, neighbor)))
        ?? neighbors.find((neighbor) => remaining.has(edgeKeyFromKeys(current, neighbor)));

      if (!next) break;
      remaining.delete(edgeKeyFromKeys(current, next));
      chain.push(pointFromKey(next));
      previous = current;
      current = next;
    }

    if (chain.length >= 4 && samePoint(chain[0], chain[chain.length - 1])) {
      result.push(chain);
    }
  }

  return result;
}

function addNeighbor(adjacency: Map<string, Set<string>>, a: string, b: string) {
  const neighbors = adjacency.get(a) ?? new Set<string>();
  neighbors.add(b);
  adjacency.set(a, neighbors);
}

function normalizePoint(point: Point): Point {
  return [Math.round(point[0] * 1000000) / 1000000, Math.round(point[1] * 1000000) / 1000000];
}

function pointKey(point: Point) {
  return `${point[0]},${point[1]}`;
}

function pointFromKey(key: string): Point {
  const [lon, lat] = key.split(",").map(Number);
  return [lon, lat];
}

function edgeKey(a: Point, b: Point) {
  return edgeKeyFromKeys(pointKey(a), pointKey(b));
}

function edgeKeyFromKeys(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function combineBounds(boundsList: Bounds[]) {
  return boundsList.reduce<Bounds>((acc, bounds) => [
    Math.min(acc[0], bounds[0]),
    Math.min(acc[1], bounds[1]),
    Math.max(acc[2], bounds[2]),
    Math.max(acc[3], bounds[3])
  ], [Infinity, Infinity, -Infinity, -Infinity]);
}

function pathFromRings(rings: Ring[], bounds: Bounds) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const pad = 16;
  const lonSpan = Math.max(maxLon - minLon, 0.001);
  const latSpan = Math.max(maxLat - minLat, 0.001);
  const scale = Math.min((WIDTH - pad * 2) / lonSpan, (HEIGHT - pad * 2) / latSpan);
  const offsetX = (WIDTH - lonSpan * scale) / 2;
  const offsetY = (HEIGHT - latSpan * scale) / 2;

  return rings
    .map((ring) => {
      const points = ring.map(([lon, lat]) => [
        offsetX + (lon - minLon) * scale,
        offsetY + (maxLat - lat) * scale
      ]);
      if (!isRenderableScreenRing(points)) return "";
      const commands = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`).join("");
      return `${commands}Z`;
    })
    .filter(Boolean)
    .join("");
}

function centroid(bounds: Bounds) {
  return [round((bounds[0] + bounds[2]) / 2), round((bounds[1] + bounds[3]) / 2)];
}

function roundBounds(bounds: Bounds) {
  return bounds.map((value) => Math.round(value * 100000) / 100000);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function simplifyFastRing(points: Ring, epsilon: number): Ring {
  if (points.length <= 8) return points;
  const closed = samePoint(points[0], points[points.length - 1]);
  const source = closed ? points.slice(0, -1) : points;
  const simplified = douglasPeucker(source, epsilon);
  if (closed && !samePoint(simplified[0], simplified[simplified.length - 1])) simplified.push(simplified[0]);
  return simplified;
}

function simplifyClosedRing(points: Ring, epsilon: number): Ring {
  if (points.length <= 8) return points;
  const closed = samePoint(points[0], points[points.length - 1]);
  if (!closed) {
    const simplified = douglasPeucker(points, epsilon);
    return simplified.length >= 4 ? simplified : points;
  }

  const source = points.slice(0, -1);
  const splitIndex = farthestPointIndex(source, source[0]);
  if (splitIndex <= 0 || splitIndex >= source.length - 1) {
    const simplified = douglasPeucker([...source, source[0]], epsilon);
    if (!samePoint(simplified[0], simplified[simplified.length - 1])) simplified.push(simplified[0]);
    return simplified.length >= 4 ? simplified : minimumClosedRing(source, splitIndex);
  }

  const firstHalf = douglasPeucker(source.slice(0, splitIndex + 1), epsilon);
  const secondHalf = douglasPeucker([...source.slice(splitIndex), source[0]], epsilon);
  const simplified = firstHalf.slice(0, -1).concat(secondHalf);
  if (!samePoint(simplified[0], simplified[simplified.length - 1])) simplified.push(simplified[0]);
  return simplified.length >= 4 ? simplified : minimumClosedRing(source, splitIndex);
}

function farthestPointIndex(points: Ring, origin: Point) {
  let maxDistance = -1;
  let index = 0;
  for (let i = 0; i < points.length; i += 1) {
    const distance = Math.hypot(points[i][0] - origin[0], points[i][1] - origin[1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  return index;
}

function farthestFromSegmentIndex(points: Ring, start: Point, end: Point) {
  let maxDistance = -1;
  let index = 0;
  for (let i = 0; i < points.length; i += 1) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  return index;
}

function minimumClosedRing(points: Ring, splitIndex: number): Ring {
  const start = points[0];
  const normalizedSplitIndex = splitIndex > 0 && splitIndex < points.length ? splitIndex : farthestPointIndex(points, start);
  const split = points[normalizedSplitIndex];
  const anchorIndex = farthestFromSegmentIndex(points, start, split);
  const anchor = points[anchorIndex];

  if (!start || !split || !anchor || samePoint(start, split) || samePoint(start, anchor) || samePoint(split, anchor)) {
    return points.slice(0, 3).concat(points[0]);
  }

  if (anchorIndex > 0 && anchorIndex < normalizedSplitIndex) {
    return [start, anchor, split, start];
  }
  return [start, split, anchor, start];
}

function isRenderableGeoRing(ring: Ring) {
  return ring.length >= 4 && uniquePointCount(ring) >= 3 && Math.abs(ringArea(ring)) >= MIN_RING_AREA;
}

function isRenderableScreenRing(points: number[][]) {
  return points.length >= 4 && uniqueScreenPointCount(points) >= 3 && Math.abs(screenRingArea(points)) >= MIN_SCREEN_RING_AREA;
}

function uniquePointCount(ring: Ring) {
  return new Set(ring.map((point) => pointKey(normalizePoint(point)))).size;
}

function uniqueScreenPointCount(points: number[][]) {
  return new Set(points.map(([x, y]) => `${round(x)},${round(y)}`)).size;
}

function ringArea(ring: Ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function screenRingArea(points: number[][]) {
  let area = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function douglasPeucker(points: Ring, epsilon: number): Ring {
  if (points.length <= 2) return [...points];
  let maxDistance = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }

  if (maxDistance > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [start, end];
}

function perpendicularDistance(point: Point, start: Point, end: Point) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / Math.hypot(dx, dy);
}

function samePoint(a: Point, b: Point) {
  return a[0] === b[0] && a[1] === b[1];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
