import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { simplifySharedBoundaries } from "@/scripts/gis/sharedBoundary";

type Point = [number, number];
const edgeKeys = (ring: Point[]) => ring.slice(1).map((p, i) => [ring[i].join(","), p.join(",")].sort().join("/"));

describe("shared administrative boundaries", () => {
  it("keeps an identical common boundary with reversed winding and different ring starts", () => {
    const common: Point[] = [[1, 0], [1.04, .2], [.98, .4], [1.03, .6], [1, .8], [1, 1]];
    const left: Point[] = [[0, 0], ...common, [0, 1], [0, 0]];
    const right: Point[] = [[2, 1], ...[...common].reverse(), [2, 0], [2, 1]];
    const before = JSON.stringify([left, right]);
    const [a, b] = simplifySharedBoundaries([left, right], .025);
    expect(JSON.stringify([left, right])).toBe(before);
    const sharedA = edgeKeys(a).filter(edge => edgeKeys(b).includes(edge));
    expect(sharedA.length).toBeGreaterThan(1);
    const sharedVertices = sharedA.flatMap(edge => edge.split("/")).map(p => p.split(",").map(Number));
    expect(Math.min(...sharedVertices.map(p => p[1]))).toBe(0);
    expect(Math.max(...sharedVertices.map(p => p[1]))).toBe(1);
    expect([...new Set(a.filter(p => p[0] > .5 && p[0] < 1.5).map(p => p.join(",")))].sort()).toEqual([...new Set(b.filter(p => p[0] > .5 && p[0] < 1.5).map(p => p.join(",")))].sort());
  });

  it("retains tiny islands and both directions of a closed enclave", () => {
    const island: Point[] = [[0, 0], [.00001, 0], [.00001, .00001], [0, .00001], [0, 0]];
    const reverse = [...island].reverse();
    const rings = simplifySharedBoundaries([island, reverse], .00015);
    expect(rings).toHaveLength(2);
    expect(rings.every(r => r.length >= 4)).toBe(true);
    expect(edgeKeys(rings[0]).sort()).toEqual(edgeKeys(rings[1]).sort());
  });

  it("ships a detailed Tokyo mainland and continuous Hachioji/Akiruno shared edges", () => {
    const { features } = JSON.parse(readFileSync("public/gis/municipalities/13.json", "utf8"));
    const hachioji = features.find((f: { code: string }) => f.code === "13201");
    const akiruno = features.find((f: { code: string }) => f.code === "13228");
    expect(hachioji.path.match(/L/g).length).toBeGreaterThan(400);
    const edges = (path: string) => [...path.matchAll(/M([^Z]+)Z/g)].flatMap(m => edgeKeys([...m[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(p => [Number(p[1]), Number(p[2])] as Point)));
    const adjacent = new Set(edges(akiruno.path));
    expect(edges(hachioji.path).filter(edge => adjacent.has(edge)).length).toBeGreaterThan(50);
  });
});
