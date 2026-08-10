import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { requireSafeDesignatedCityDissolve } from "@/scripts/gis/build-n03-simplified";

type Point = [number, number];

type GisFeature = {
  code: string;
  name: string;
  kind?: "municipality" | "geography";
  path: string;
  bounds?: [number, number, number, number];
  labelPoint?: Point;
  labelLines?: string[];
};

type GisData = {
  viewBox: {
    width: number;
    height: number;
  };
  prefectures: GisFeature[];
  municipalitiesByPrefecture: Record<string, GisFeature[]>;
};

const nationalData = JSON.parse(
  readFileSync(path.join(process.cwd(), "public/gis/mlit-n03-simplified.json"), "utf8")
) as Omit<GisData, "municipalitiesByPrefecture">;
const municipalitiesByPrefecture = Object.fromEntries(Array.from({ length: 47 }, (_, index) => {
  const prefectureCode = String(index + 1).padStart(2, "0");
  const prefectureData = JSON.parse(readFileSync(
    path.join(process.cwd(), "public/gis/municipalities", `${prefectureCode}.json`),
    "utf8"
  )) as { features: GisFeature[] };
  return [prefectureCode, prefectureData.features];
}));
const data: GisData = { ...nationalData, municipalitiesByPrefecture };

function expectRenderableLabel(feature: GisFeature, width: number, height: number) {
  expect(feature.labelPoint, `${feature.name} has labelPoint`).toBeDefined();
  const [x, y] = feature.labelPoint!;
  expect(Number.isFinite(x), `${feature.name} label x is finite`).toBe(true);
  expect(Number.isFinite(y), `${feature.name} label y is finite`).toBe(true);
  expect(x, `${feature.name} label x is in viewBox`).toBeGreaterThanOrEqual(0);
  expect(x, `${feature.name} label x is in viewBox`).toBeLessThanOrEqual(width);
  expect(y, `${feature.name} label y is in viewBox`).toBeGreaterThanOrEqual(0);
  expect(y, `${feature.name} label y is in viewBox`).toBeLessThanOrEqual(height);
  expect(feature.labelLines?.join(""), `${feature.name} has label text`).toBe(feature.name);
}

function pathRings(pathText: string) {
  return [...pathText.matchAll(/M([^Z]+)Z/g)].map((match) => (
    [...match[1].matchAll(/(?:L)?(-?[0-9.]+) (-?[0-9.]+)/g)]
      .map((point) => [Number(point[1]), Number(point[2])] as Point)
  ));
}

function absolutePathArea(pathText: string) {
  return pathRings(pathText).reduce((total, ring) => {
    let area = 0;
    for (let index = 1; index < ring.length; index += 1) {
      const [x1, y1] = ring[index - 1];
      const [x2, y2] = ring[index];
      area += x1 * y2 - x2 * y1;
    }
    return total + Math.abs(area / 2);
  }, 0);
}

describe("GIS map label data", () => {
  it("provides exactly one renderable label for every prefecture", () => {
    expect(data.prefectures).toHaveLength(47);
    for (const feature of data.prefectures) {
      expectRenderableLabel(feature, data.viewBox.width, data.viewBox.height);
    }
  });

  it("provides renderable labels for every municipality in every prefecture", () => {
    for (const [prefectureCode, features] of Object.entries(data.municipalitiesByPrefecture)) {
      expect(features.length, `${prefectureCode} has municipality features`).toBeGreaterThan(0);
      for (const feature of features) {
        expectRenderableLabel(feature, data.viewBox.width, data.viewBox.height);
      }
    }
  });

  it("keeps all Yamagata municipality labels available", () => {
    const yamagata = data.municipalitiesByPrefecture["06"] ?? [];
    expect(yamagata).toHaveLength(35);
    expect(yamagata.map((feature) => feature.name)).toContain("山形市");
    expect(yamagata.map((feature) => feature.name)).toContain("新庄市");
  });

  it("uses one unique semantic feature code per municipality", () => {
    for (const [prefectureCode, features] of Object.entries(data.municipalitiesByPrefecture)) {
      const municipalities = features.filter((feature) => feature.kind !== "geography");
      const codes = municipalities.map((feature) => feature.code);
      const names = municipalities.map((feature) => feature.name);
      expect(new Set(codes).size, `${prefectureCode} has no duplicate municipality codes`).toBe(codes.length);
      expect(new Set(names).size, `${prefectureCode} has one semantic feature per municipality name`).toBe(names.length);
    }

    const kanagawa = data.municipalitiesByPrefecture["14"];
    expect(kanagawa.find((feature) => feature.name === "横浜市")?.code).toBe("14100");
    expect(kanagawa.find((feature) => feature.name === "川崎市")?.code).toBe("14130");
    expect(kanagawa.find((feature) => feature.name === "相模原市")?.code).toBe("14150");
    expect(kanagawa.filter((feature) => ["横浜市", "川崎市", "相模原市"].includes(feature.name))).toHaveLength(3);
    expect(data.municipalitiesByPrefecture["27"].filter((feature) => feature.name === "大阪市")).toHaveLength(1);
  });

  it("dissolves designated-city ward seams while retaining disconnected islands", () => {
    const niigata = data.municipalitiesByPrefecture["15"].find((feature) => feature.name === "新潟市");
    const yokohama = data.municipalitiesByPrefecture["14"].find((feature) => feature.name === "横浜市");
    const hiroshima = data.municipalitiesByPrefecture["34"].find((feature) => feature.name === "広島市");
    const sado = data.municipalitiesByPrefecture["15"].find((feature) => feature.name === "佐渡市");

    expect(niigata?.path.match(/M/g)?.length).toBe(19);
    expect(yokohama?.path.match(/M/g)?.length).toBe(25);
    expect(hiroshima?.path.match(/M/g)?.length).toBe(32);
    expect(sado?.path.match(/M/g)?.length).toBeGreaterThan(1);
  });

  it("fails generation instead of restoring raw ward rings after an unsafe designated-city dissolve", () => {
    const sourceRings: Point[][] = [
      [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
      [[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]
    ];
    const safeExterior: Point[][] = [
      [[0, 0], [2, 0], [2, 1], [0, 1], [0, 0]]
    ];
    const collapsedExterior: Point[][] = [
      [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
    ];
    const designatedCity = { code: "99900", name: "検証市" };

    expect(requireSafeDesignatedCityDissolve(designatedCity, sourceRings, safeExterior))
      .toBe(safeExterior);
    expect(() => requireSafeDesignatedCityDissolve(designatedCity, sourceRings, collapsedExterior))
      .toThrow("Unsafe designated-city ward dissolve: 99900 検証市");

    const generatorSource = readFileSync(
      path.join(process.cwd(), "scripts/gis/build-n03-simplified.ts"),
      "utf8"
    );
    expect(generatorSource).toContain("displayRings = requireSafeDesignatedCityDissolve(group, sourceRings, exteriorRings)");
    expect(generatorSource).not.toContain("preserving ward source rings after unsafe dissolve");
  });

  it("keeps every municipality path non-empty with a positive rendered area", () => {
    for (const [prefectureCode, features] of Object.entries(data.municipalitiesByPrefecture)) {
      for (const feature of features.filter((item) => item.kind !== "geography")) {
        expect(feature.path, `${prefectureCode} ${feature.code} ${feature.name} has a path`).toMatch(/^M/);
        expect(pathRings(feature.path).length, `${feature.name} has at least one subpath`).toBeGreaterThan(0);
        expect(absolutePathArea(feature.path), `${feature.name} has positive rendered area`).toBeGreaterThan(0);
      }
    }
  });

  it("preserves coastal municipality bounds, area and disconnected subpaths", () => {
    const regressions = [
      { prefecture: "03", code: "03203", name: "大船渡市", minWidth: 0.3, minHeight: 0.21, minArea: 6000, minSubpaths: 1 },
      { prefecture: "03", code: "03202", name: "宮古市", minWidth: 0.73, minHeight: 0.39, minArea: 24000, minSubpaths: 3 },
      { prefecture: "03", code: "03211", name: "釜石市", minWidth: 0.34, minHeight: 0.24, minArea: 8300, minSubpaths: 2 },
      { prefecture: "32", code: "32205", name: "大田市", minWidth: 0.35, minHeight: 0.27, minArea: 2500, minSubpaths: 1 }
    ];

    for (const expected of regressions) {
      const feature = data.municipalitiesByPrefecture[expected.prefecture]
        .find((item) => item.code === expected.code);
      expect(feature?.name).toBe(expected.name);
      expect(feature?.bounds, `${expected.name} keeps official bounds`).toBeDefined();
      const [minX, minY, maxX, maxY] = feature!.bounds!;
      expect(maxX - minX, `${expected.name} keeps east-west extent`).toBeGreaterThan(expected.minWidth);
      expect(maxY - minY, `${expected.name} keeps north-south extent`).toBeGreaterThan(expected.minHeight);
      expect(absolutePathArea(feature!.path), `${expected.name} does not collapse`).toBeGreaterThan(expected.minArea);
      expect(pathRings(feature!.path).length, `${expected.name} keeps meaningful subpaths`)
        .toBeGreaterThanOrEqual(expected.minSubpaths);
    }
  });
});
