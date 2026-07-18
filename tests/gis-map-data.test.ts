import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

type Point = [number, number];

type GisFeature = {
  code: string;
  name: string;
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

const data = JSON.parse(
  readFileSync(path.join(process.cwd(), "public/gis/mlit-n03-simplified.json"), "utf8")
) as GisData;

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
});
