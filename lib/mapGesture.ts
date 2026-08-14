export type MapPan = { x: number; y: number };
export type MapSurfaceSize = { width: number; height: number };

export type ParsedMapViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const TOUCH_DRAG_THRESHOLD_PX = 8;
export const MOUSE_DRAG_THRESHOLD_PX = 4;

export function clampMapNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function parseMapViewBox(viewBox: string): ParsedMapViewBox | null {
  const [x, y, width, height] = viewBox.trim().split(/\s+/).map(Number);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

export function clampMapPan(baseViewBox: string, zoom: number, pan: MapPan): MapPan {
  const base = parseMapViewBox(baseViewBox);
  if (!base || zoom <= 1) return { x: 0, y: 0 };
  const maxX = (base.width - base.width / zoom) / 2;
  const maxY = (base.height - base.height / zoom) / 2;
  return {
    x: clampMapNumber(pan.x, -maxX, maxX),
    y: clampMapNumber(pan.y, -maxY, maxY)
  };
}

export function pannedZoomViewBox(baseViewBox: string, zoom: number, pan: MapPan) {
  const base = parseMapViewBox(baseViewBox);
  if (!base) return baseViewBox;
  const safeZoom = Math.max(zoom, 1);
  const width = base.width / safeZoom;
  const height = base.height / safeZoom;
  const centeredX = base.x + (base.width - width) / 2;
  const centeredY = base.y + (base.height - height) / 2;
  const clampedPan = clampMapPan(baseViewBox, safeZoom, pan);
  return `${centeredX + clampedPan.x} ${centeredY + clampedPan.y} ${width} ${height}`;
}

export function dragThresholdForPointer(pointerType: string) {
  return pointerType === "touch" || pointerType === "pen"
    ? TOUCH_DRAG_THRESHOLD_PX
    : MOUSE_DRAG_THRESHOLD_PX;
}

export function hasExceededDragThreshold(deltaX: number, deltaY: number, pointerType: string) {
  return Math.hypot(deltaX, deltaY) > dragThresholdForPointer(pointerType);
}

export function panFromPointerDelta({
  baseViewBox,
  zoom,
  startPan,
  deltaX,
  deltaY,
  surfaceSize
}: {
  baseViewBox: string;
  zoom: number;
  startPan: MapPan;
  deltaX: number;
  deltaY: number;
  surfaceSize: MapSurfaceSize;
}) {
  const visible = parseMapViewBox(pannedZoomViewBox(baseViewBox, zoom, startPan));
  if (!visible) return startPan;
  return clampMapPan(baseViewBox, zoom, {
    x: startPan.x - (deltaX / Math.max(surfaceSize.width, 1)) * visible.width,
    y: startPan.y - (deltaY / Math.max(surfaceSize.height, 1)) * visible.height
  });
}

export function preserveMapCenterAcrossZoom({
  baseViewBox,
  currentZoom,
  nextZoom,
  pan
}: {
  baseViewBox: string;
  currentZoom: number;
  nextZoom: number;
  pan: MapPan;
}) {
  const base = parseMapViewBox(baseViewBox);
  const current = parseMapViewBox(pannedZoomViewBox(baseViewBox, currentZoom, pan));
  if (!base || !current || nextZoom <= 1) return { x: 0, y: 0 };
  const baseCenterX = base.x + base.width / 2;
  const baseCenterY = base.y + base.height / 2;
  const currentCenterX = current.x + current.width / 2;
  const currentCenterY = current.y + current.height / 2;
  return clampMapPan(baseViewBox, nextZoom, {
    x: currentCenterX - baseCenterX,
    y: currentCenterY - baseCenterY
  });
}

export function focusMapFeature({
  baseViewBox,
  featureBounds,
  surfaceSize,
  minimumZoom = 1.5,
  maximumZoom = 160,
  targetPrimaryPixels = 112,
  targetSecondaryPixels = 36
}: {
  baseViewBox: string;
  featureBounds: [number, number, number, number];
  surfaceSize: MapSurfaceSize;
  minimumZoom?: number;
  maximumZoom?: number;
  targetPrimaryPixels?: number;
  targetSecondaryPixels?: number;
}) {
  const base = parseMapViewBox(baseViewBox);
  if (!base) return { zoom: 1, pan: { x: 0, y: 0 } satisfies MapPan };

  const [minX, minY, maxX, maxY] = featureBounds;
  const featureWidth = Math.max(maxX - minX, 0.001);
  const featureHeight = Math.max(maxY - minY, 0.001);
  const fitScale = Math.min(
    Math.max(surfaceSize.width, 1) / base.width,
    Math.max(surfaceSize.height, 1) / base.height
  );
  const primaryPixels = Math.max(featureWidth, featureHeight) * fitScale;
  const secondaryPixels = Math.min(featureWidth, featureHeight) * fitScale;
  const requestedZoom = Math.max(
    targetPrimaryPixels / Math.max(primaryPixels, 0.001),
    targetSecondaryPixels / Math.max(secondaryPixels, 0.001),
    minimumZoom
  );
  const zoom = clampMapNumber(requestedZoom, minimumZoom, maximumZoom);
  const baseCenterX = base.x + base.width / 2;
  const baseCenterY = base.y + base.height / 2;
  const featureCenterX = minX + featureWidth / 2;
  const featureCenterY = minY + featureHeight / 2;
  const pan = clampMapPan(baseViewBox, zoom, {
    x: featureCenterX - baseCenterX,
    y: featureCenterY - baseCenterY
  });

  return { zoom, pan };
}
