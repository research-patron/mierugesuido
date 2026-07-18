import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  atlasDisplayPath,
  pathScreenBounds,
  screenViewBox
} from "@/lib/gisMapLayout";

type GisFeature = {
  code: string;
  name: string;
  layoutGroup?: string;
  path: string;
};

type RawImage = {
  data: Buffer;
  channels: number;
  width: number;
  height: number;
};

type Frame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const gisData = JSON.parse(
  readFileSync(path.join(process.cwd(), "public/gis/mlit-n03-simplified.json"), "utf8")
) as { prefectures: GisFeature[] };

const require = createRequire(import.meta.url);
const STATUS_COLORS = ["#3db5a4", "#a9d66f", "#f5c65e", "#f39a43", "#e95b5d", "#d1d4d8"];
const HOME_FRAME = { width: 980, height: 500 };
const MOBILE_FRAME = { width: 390, height: 440 };
const HOME_MAIN_FRAME = { x: 165, y: 30, width: 650, height: 460 };
const MOBILE_MAIN_FRAME = { x: 18, y: 132, width: 354, height: 236 };

function featureByName(name: string) {
  const feature = gisData.prefectures.find((item) => item.name === name);
  expect(feature, `${name} exists`).toBeDefined();
  return feature!;
}

async function loadSharp() {
  const pnpmDir = path.join(process.cwd(), "node_modules/.pnpm");
  const sharpEntry = readdirSync(pnpmDir)
    .filter((entry) => entry.startsWith("sharp@"))
    .sort()
    .at(-1);
  expect(sharpEntry, "sharp is available from the existing lockfile").toBeTruthy();
  const sharpPath = path.join(pnpmDir, sharpEntry!, "node_modules/sharp/lib/index.js");
  expect(existsSync(sharpPath), "sharp entrypoint exists").toBe(true);
  const mod = require(sharpPath);
  return mod.default ?? mod;
}

function statusColorForCode(code: string) {
  const index = (Number(code) - 1) % (STATUS_COLORS.length - 1);
  return STATUS_COLORS[index] ?? STATUS_COLORS[STATUS_COLORS.length - 1];
}

function flatShapeSvg(displayPath: string, fillColor: string) {
  return [
    `<path d="${displayPath}" fill="${fillColor}" fill-rule="nonzero" stroke="#263744" stroke-opacity="0.48" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" vector-effect="non-scaling-stroke" paint-order="stroke fill" shape-rendering="geometricPrecision"/>`,
    `<path d="${displayPath}" fill="${fillColor}" fill-rule="nonzero" stroke="${fillColor}" stroke-opacity="1" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.7" vector-effect="non-scaling-stroke" paint-order="stroke fill" shape-rendering="geometricPrecision"/>`
  ].join("");
}

function exposedMunicipalityStrokeSvg(displayPath: string, fillColor: string) {
  return `<path d="${displayPath}" fill="${fillColor}" fill-rule="nonzero" stroke="#263744" stroke-opacity="0.5" stroke-linecap="round" stroke-linejoin="round" stroke-width="0.65" vector-effect="non-scaling-stroke" shape-rendering="geometricPrecision"/>`;
}

function overviewViewBox(features: GisFeature[], pad = 8) {
  const bounds = features
    .map((feature) => pathScreenBounds(atlasDisplayPath(feature)))
    .filter((value): value is [number, number, number, number] => Boolean(value));
  expect(bounds.length).toBeGreaterThan(0);
  const [minX, minY, maxX, maxY] = bounds.reduce<[number, number, number, number]>((acc, value) => [
    Math.min(acc[0], value[0]),
    Math.min(acc[1], value[1]),
    Math.max(acc[2], value[2]),
    Math.max(acc[3], value[3])
  ], [Infinity, Infinity, -Infinity, -Infinity]);
  return `${Math.max(minX - pad, 0)} ${Math.max(minY - pad, 0)} ${Math.max(maxX - minX + pad * 2, 1)} ${Math.max(maxY - minY + pad * 2, 1)}`;
}

function mainLayerSvg(
  features: GisFeature[],
  frame: Frame,
  renderShape: (displayPath: string, fillColor: string) => string
) {
  const paths = features.map((feature) => (
    renderShape(atlasDisplayPath(feature), statusColorForCode(feature.code))
  )).join("");
  return `<svg x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" viewBox="${overviewViewBox(features)}" preserveAspectRatio="xMidYMid meet" overflow="visible">${paths}</svg>`;
}

function insetSvg(
  feature: GisFeature,
  frame: Frame,
  renderShape: (displayPath: string, fillColor: string) => string
) {
  const displayPath = atlasDisplayPath(feature);
  const viewBox = screenViewBox([{ ...feature, path: displayPath }], 8);
  expect(viewBox).toBeTruthy();
  return `<svg x="${frame.x + 10}" y="${frame.y + 24}" width="${frame.width - 20}" height="${frame.height - 32}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" overflow="hidden">${renderShape(displayPath, statusColorForCode(feature.code))}</svg>`;
}

function renderHomeMap(
  compact = false,
  renderShape: (displayPath: string, fillColor: string) => string = flatShapeSvg
) {
  const frame = compact ? MOBILE_FRAME : HOME_FRAME;
  const mainFrame = compact ? MOBILE_MAIN_FRAME : HOME_MAIN_FRAME;
  const hokkaidoFrame = compact
    ? { x: 18, y: 14, width: 142, height: 88 }
    : { x: 250, y: 18, width: 160, height: 104 };
  const okinawaFrame = compact
    ? { x: 232, y: 372, width: 128, height: 54 }
    : { x: 812, y: 372, width: 142, height: 94 };
  const mainFeatures = gisData.prefectures.filter((feature) => !feature.layoutGroup || feature.layoutGroup === "main");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}">
    <rect width="${frame.width}" height="${frame.height}" fill="#ffffff"/>
    ${mainLayerSvg(mainFeatures, mainFrame, renderShape)}
    ${insetSvg(featureByName("北海道"), hokkaidoFrame, renderShape)}
    ${insetSvg(featureByName("沖縄県"), okinawaFrame, renderShape)}
  </svg>`;
}

async function rasterize(svg: string): Promise<RawImage> {
  const sharp = await loadSharp();
  const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  return { data, channels: info.channels, width: info.width, height: info.height };
}

function pixel(image: RawImage, x: number, y: number) {
  const index = (y * image.width + x) * image.channels;
  return [image.data[index], image.data[index + 1], image.data[index + 2]];
}

function hexRgb(hex: string) {
  return hex.match(/[0-9a-f]{2}/gi)?.map((part) => Number.parseInt(part, 16)) ?? [0, 0, 0];
}

function colorDistance(value: number[], hex: string) {
  const [r, g, b] = hexRgb(hex);
  return Math.sqrt((value[0] - r) ** 2 + (value[1] - g) ** 2 + (value[2] - b) ** 2);
}

function isStatusFill(value: number[]) {
  return STATUS_COLORS.some((color) => colorDistance(value, color) < 44);
}

function boundsFor(image: RawImage, box: Frame, predicate: (value: number[]) => boolean) {
  let count = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) {
      if (!predicate(pixel(image, x, y))) continue;
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return { count, bounds: null };
  return { count, bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
}

function internalInkPixels(image: RawImage) {
  let count = 0;
  for (let y = 3; y < image.height - 3; y += 1) {
    for (let x = 3; x < image.width - 3; x += 1) {
      const current = pixel(image, x, y);
      if (isStatusFill(current) || colorDistance(current, "#ffffff") < 30) continue;
      const horizontal = STATUS_COLORS.some((color) => (
        colorDistance(pixel(image, x - 3, y), color) < 44
        && colorDistance(pixel(image, x + 3, y), color) < 44
      ));
      const vertical = STATUS_COLORS.some((color) => (
        colorDistance(pixel(image, x, y - 3), color) < 44
        && colorDistance(pixel(image, x, y + 3), color) < 44
      ));
      if (horizontal || vertical) count += 1;
    }
  }
  return count;
}

describe("national map browserless pixel audit", () => {
  it("renders the shared desktop home composition with stable insets and no municipal ink seams", async () => {
    const image = await rasterize(renderHomeMap());
    const exposedMunicipalityImage = await rasterize(renderHomeMap(false, exposedMunicipalityStrokeSvg));
    const main = boundsFor(image, { x: 150, y: 20, width: 680, height: 470 }, isStatusFill);
    const hokkaido = boundsFor(image, { x: 240, y: 10, width: 180, height: 120 }, (value) => colorDistance(value, statusColorForCode("01")) < 44);
    const okinawa = boundsFor(image, { x: 800, y: 360, width: 160, height: 125 }, (value) => colorDistance(value, statusColorForCode("47")) < 44);
    const whole = boundsFor(image, { x: 0, y: 0, width: HOME_FRAME.width, height: HOME_FRAME.height }, isStatusFill);

    expect(main.count).toBeGreaterThan(24000);
    expect(main.bounds?.width).toBeGreaterThan(500);
    expect(main.bounds?.height).toBeGreaterThan(350);
    expect(hokkaido.count).toBeGreaterThan(1300);
    expect(hokkaido.bounds?.x).toBeGreaterThanOrEqual(250);
    expect(hokkaido.bounds?.y).toBeGreaterThanOrEqual(34);
    expect(okinawa.count).toBeGreaterThan(120);
    expect(okinawa.bounds?.x).toBeGreaterThanOrEqual(810);
    expect(okinawa.bounds?.y).toBeGreaterThanOrEqual(390);
    expect(whole.count).toBeGreaterThan(27000);
    expect(internalInkPixels(image)).toBeLessThan(internalInkPixels(exposedMunicipalityImage) * 0.45);
  });

  it("renders the same composition responsively at the mobile viewBox", async () => {
    const image = await rasterize(renderHomeMap(true));
    const exposedMunicipalityImage = await rasterize(renderHomeMap(true, exposedMunicipalityStrokeSvg));
    const main = boundsFor(image, { x: 10, y: 120, width: 370, height: 260 }, isStatusFill);
    const hokkaido = boundsFor(image, { x: 10, y: 10, width: 160, height: 110 }, (value) => colorDistance(value, statusColorForCode("01")) < 44);
    const okinawa = boundsFor(image, { x: 225, y: 365, width: 140, height: 70 }, (value) => colorDistance(value, statusColorForCode("47")) < 44);

    expect(main.count).toBeGreaterThan(8500);
    expect(main.bounds?.width).toBeGreaterThan(270);
    expect(main.bounds?.height).toBeGreaterThan(180);
    expect(hokkaido.count).toBeGreaterThan(700);
    expect(hokkaido.bounds?.x).toBeLessThan(150);
    expect(hokkaido.bounds?.y).toBeLessThan(105);
    expect(okinawa.count).toBeGreaterThan(20);
    expect(okinawa.bounds?.x).toBeGreaterThanOrEqual(235);
    expect(okinawa.bounds?.y).toBeGreaterThanOrEqual(390);
    expect(internalInkPixels(image)).toBeLessThan(internalInkPixels(exposedMunicipalityImage) * 0.45);
  });

  it("covers a synthetic municipality boundary while retaining the outer silhouette", async () => {
    const joinedMunicipalities = "M1 1L11 1L11 11L1 11L1 1ZM11 1L21 1L21 11L11 11L11 1Z";
    const fillColor = STATUS_COLORS[0];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120" viewBox="0 0 22 12"><rect width="22" height="12" fill="#ffffff"/>${flatShapeSvg(joinedMunicipalities, fillColor)}</svg>`;
    const image = await rasterize(svg);

    for (let y = 18; y <= 102; y += 6) {
      expect(colorDistance(pixel(image, 110, y), fillColor)).toBeLessThan(8);
    }
    expect(internalInkPixels(image)).toBe(0);
    expect(colorDistance(pixel(image, 8, 60), fillColor)).toBeGreaterThan(8);
  });
});
