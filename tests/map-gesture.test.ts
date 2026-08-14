import { describe, expect, it } from "vitest";
import {
  MOUSE_DRAG_THRESHOLD_PX,
  TOUCH_DRAG_THRESHOLD_PX,
  clampMapPan,
  dragThresholdForPointer,
  focusMapFeature,
  hasExceededDragThreshold,
  panFromPointerDelta,
  pannedZoomViewBox,
  parseMapViewBox,
  preserveMapCenterAcrossZoom
} from "@/lib/mapGesture";

describe("map gesture geometry", () => {
  it("parses a valid positive viewBox", () => {
    expect(parseMapViewBox(" 10  20 300 150 ")).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 150
    });
  });

  it.each([
    ["", "missing values"],
    ["0 0 100", "too few values"],
    ["x 0 100 80", "non-numeric origin"],
    ["0 0 Infinity 80", "non-finite width"],
    ["0 0 0 80", "zero width"],
    ["0 0 100 -1", "negative height"]
  ])("rejects an invalid viewBox (%s: %s)", (viewBox) => {
    expect(parseMapViewBox(viewBox)).toBeNull();
  });

  it.each([
    ["right", { x: 10, y: 0 }, "45 40 50 40"],
    ["left", { x: -10, y: 0 }, "25 40 50 40"],
    ["down", { x: 0, y: 8 }, "35 48 50 40"],
    ["up", { x: 0, y: -8 }, "35 32 50 40"],
    ["diagonally up-right", { x: 10, y: -8 }, "45 32 50 40"]
  ])("applies zoomed pan %s", (_direction, pan, expectedViewBox) => {
    expect(pannedZoomViewBox("10 20 100 80", 2, pan)).toBe(expectedViewBox);
  });

  it("clamps pan at all four map edges", () => {
    const baseViewBox = "10 20 100 80";

    expect(clampMapPan(baseViewBox, 2, { x: 999, y: 0 })).toEqual({ x: 25, y: 0 });
    expect(clampMapPan(baseViewBox, 2, { x: -999, y: 0 })).toEqual({ x: -25, y: 0 });
    expect(clampMapPan(baseViewBox, 2, { x: 0, y: 999 })).toEqual({ x: 0, y: 20 });
    expect(clampMapPan(baseViewBox, 2, { x: 0, y: -999 })).toEqual({ x: 0, y: -20 });
    expect(clampMapPan(baseViewBox, 2, { x: 999, y: -999 })).toEqual({ x: 25, y: -20 });

    expect(pannedZoomViewBox(baseViewBox, 2, { x: -999, y: -999 })).toBe("10 20 50 40");
    expect(pannedZoomViewBox(baseViewBox, 2, { x: 999, y: 999 })).toBe("60 60 50 40");
  });

  it("resets pan and viewBox at zoom one or below", () => {
    const baseViewBox = "10 20 100 80";
    const displacedPan = { x: 999, y: -999 };

    expect(clampMapPan(baseViewBox, 1, displacedPan)).toEqual({ x: 0, y: 0 });
    expect(clampMapPan(baseViewBox, 0.5, displacedPan)).toEqual({ x: 0, y: 0 });
    expect(pannedZoomViewBox(baseViewBox, 1, displacedPan)).toBe(baseViewBox);
    expect(pannedZoomViewBox(baseViewBox, 0.5, displacedPan)).toBe(baseViewBox);
  });

  it("keeps touch jitter through 8px as a tap and treats larger movement as a drag", () => {
    expect(TOUCH_DRAG_THRESHOLD_PX).toBe(8);
    expect(dragThresholdForPointer("touch")).toBe(8);
    expect(dragThresholdForPointer("pen")).toBe(8);
    expect(hasExceededDragThreshold(8, 0, "touch")).toBe(false);
    expect(hasExceededDragThreshold(4.8, 6.4, "touch")).toBe(false);
    expect(hasExceededDragThreshold(8.01, 0, "touch")).toBe(true);
    expect(hasExceededDragThreshold(6, 6, "touch")).toBe(true);
    expect(hasExceededDragThreshold(8.01, 0, "pen")).toBe(true);
  });

  it("uses the tighter 4px threshold for a mouse", () => {
    expect(MOUSE_DRAG_THRESHOLD_PX).toBe(4);
    expect(dragThresholdForPointer("mouse")).toBe(4);
    expect(dragThresholdForPointer("")).toBe(4);
    expect(hasExceededDragThreshold(4, 0, "mouse")).toBe(false);
    expect(hasExceededDragThreshold(4.01, 0, "mouse")).toBe(true);
    expect(hasExceededDragThreshold(3, 3, "mouse")).toBe(true);
  });

  it.each([
    ["right", 100, 0, { x: -100, y: 0 }],
    ["left", -100, 0, { x: 100, y: 0 }],
    ["down", 0, 80, { x: 0, y: -80 }],
    ["up", 0, -80, { x: 0, y: 80 }],
    ["diagonally up-right", 100, -80, { x: -100, y: 80 }]
  ])("converts a pointer drag %s into map-space pan", (_direction, deltaX, deltaY, expectedPan) => {
    expect(panFromPointerDelta({
      baseViewBox: "0 0 1000 800",
      zoom: 2,
      startPan: { x: 0, y: 0 },
      deltaX,
      deltaY,
      surfaceSize: { width: 500, height: 400 }
    })).toEqual(expectedPan);
  });

  it("zooms a large feature enough and centers it when pan remains in range", () => {
    const baseViewBox = "0 0 1000 800";
    const featureBounds: [number, number, number, number] = [550, 350, 750, 550];
    const result = focusMapFeature({
      baseViewBox,
      featureBounds,
      surfaceSize: { width: 400, height: 400 }
    });
    const visible = parseMapViewBox(pannedZoomViewBox(baseViewBox, result.zoom, result.pan));

    expect(result.zoom).toBe(1.5);
    expect(result.pan).toEqual({ x: 150, y: 50 });
    expect(visible).not.toBeNull();
    expect(visible!.x + visible!.width / 2).toBeCloseTo(650, 8);
    expect(visible!.y + visible!.height / 2).toBeCloseTo(450, 8);
    expect(200 * 0.4 * result.zoom).toBeGreaterThanOrEqual(112);
  });

  it("preserves the visible center when zoom changes", () => {
    const baseViewBox = "0 0 1000 800";
    const current = parseMapViewBox(pannedZoomViewBox(baseViewBox, 2, { x: 140, y: -90 }));
    const nextPan = preserveMapCenterAcrossZoom({
      baseViewBox,
      currentZoom: 2,
      nextZoom: 4,
      pan: { x: 140, y: -90 }
    });
    const next = parseMapViewBox(pannedZoomViewBox(baseViewBox, 4, nextPan));

    expect(current).not.toBeNull();
    expect(next).not.toBeNull();
    expect(next!.x + next!.width / 2).toBeCloseTo(current!.x + current!.width / 2, 8);
    expect(next!.y + next!.height / 2).toBeCloseTo(current!.y + current!.height / 2, 8);
    expect(preserveMapCenterAcrossZoom({
      baseViewBox,
      currentZoom: 4,
      nextZoom: 1,
      pan: nextPan
    })).toEqual({ x: 0, y: 0 });
  });

  it("zooms an extremely small edge feature to a usable size and clamps focus at the map edges", () => {
    const baseViewBox = "0 0 1000 800";
    const surfaceSize = { width: 390, height: 440 };
    const featureBounds: [number, number, number, number] = [998, 799, 1000, 800];
    const result = focusMapFeature({ baseViewBox, featureBounds, surfaceSize });
    const visible = parseMapViewBox(pannedZoomViewBox(baseViewBox, result.zoom, result.pan));
    const baseScale = Math.min(surfaceSize.width / 1000, surfaceSize.height / 800);
    const maximumPanX = (1000 - 1000 / result.zoom) / 2;
    const maximumPanY = (800 - 800 / result.zoom) / 2;

    expect(result.zoom).toBeCloseTo(112 / (2 * baseScale), 8);
    expect(2 * baseScale * result.zoom).toBeGreaterThanOrEqual(112 - 1e-8);
    expect(1 * baseScale * result.zoom).toBeGreaterThanOrEqual(36);
    expect(result.pan.x).toBeCloseTo(maximumPanX, 8);
    expect(result.pan.y).toBeCloseTo(maximumPanY, 8);
    expect(visible).not.toBeNull();
    expect(visible!.x + visible!.width).toBeCloseTo(1000, 8);
    expect(visible!.y + visible!.height).toBeCloseTo(800, 8);
  });
});
