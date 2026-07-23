"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  LocateFixed,
  Minus,
  Plus
} from "lucide-react";
import clsx from "clsx";
import { Badge } from "@/components/Badge";
import type { MapMunicipality, PrefectureSummary } from "@/components/JapanMapSelector";
import { displayBusinessName } from "@/lib/businessDisplay";
import { getFeeAdequacyLabel } from "@/lib/calculations";
import { displayFeeRecoveryBandLabel } from "@/lib/feeRecoveryCopy";
import { formatPercent, formatRevisionRate, formatYenPerM3 } from "@/lib/format";
import {
  municipalityDisplayPaths,
  pathScreenBounds,
  primaryFeatureScreenBounds,
  screenViewBox,
  type Bounds
} from "@/lib/gisMapLayout";
import { getPrefectureName } from "@/lib/prefectures";
import styles from "./PrefectureMapExplorer.module.css";

type GisFeature = {
  code: string;
  name: string;
  prefectureCode?: string;
  prefectureName?: string;
  path: string;
  bounds: Bounds;
  centroid?: [number, number];
  labelPoint?: [number, number];
  labelLines?: string[];
  labelSize?: number;
  labelAnchor?: "middle" | "start" | "end";
  callout?: { from: [number, number]; to: [number, number] };
};

type GisData = {
  viewBox: { width: number; height: number };
  municipalitiesByPrefecture: Record<string, GisFeature[]>;
};

type MapPan = { x: number; y: number };
type SurfaceSize = { width: number; height: number };

type HoverState = {
  href: string;
  title: string;
  label: string;
  recovery: string;
  feeUnit: string;
  revision: string;
  x: number;
  y: number;
};

const statusLegend = [
  { key: "適正水準", label: "100%以上", note: "", color: "#3db5a4" },
  { key: "やや不足", label: "90%以上100%未満", note: "", color: "#a9d66f" },
  { key: "要注意", label: "80%以上90%未満", note: "", color: "#f5c65e" },
  { key: "改定圧力高", label: "80%未満", note: "単価150円/m³以上・不明", color: "#f39a43" },
  { key: "重点監視", label: "80%未満", note: "単価150円/m³未満", color: "#e95b5d" },
  { key: "データなし・対象外", label: "データなし・対象外", note: "", color: "#d8e0e6" }
];

const statusColors = Object.fromEntries(statusLegend.map((item) => [item.key, item.color])) as Record<string, string>;
const zoomSteps = [1, 1.35, 1.75, 2.25];

export function PrefectureMapExplorer({
  prefectureCode,
  summaries,
  municipalities
}: {
  prefectureCode: string;
  summaries: PrefectureSummary[];
  municipalities: MapMunicipality[];
}) {
  const router = useRouter();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ clientX: number; clientY: number; pan: MapPan; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [data, setData] = useState<GisData | null>(null);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selectedFeatureCode, setSelectedFeatureCode] = useState<string | null>(null);
  const [focusedFeatureCode, setFocusedFeatureCode] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [pan, setPan] = useState<MapPan>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [surfaceSize, setSurfaceSize] = useState<SurfaceSize>({ width: 0, height: 0 });
  const prefectureName = getPrefectureName(prefectureCode) ?? municipalities[0]?.prefectureName ?? "都道府県";
  const zoom = zoomSteps[zoomIndex];

  useEffect(() => {
    let cancelled = false;
    fetch("/gis/mlit-n03-simplified.json")
      .then((response) => {
        if (!response.ok) throw new Error("GIS data unavailable");
        return response.json() as Promise<GisData>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver === "undefined") return;
    const updateSize = () => {
      const rect = surface.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setSurfaceSize((current) => {
        if (Math.abs(current.width - rect.width) < 0.5 && Math.abs(current.height - rect.height) < 0.5) return current;
        return { width: rect.width, height: rect.height };
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  const summary = summaries.find((item) => item.prefectureName === prefectureName);
  const municipalityLookup = useMemo(
    () => new Map(municipalities.map((item) => [item.municipalityName, item])),
    [municipalities]
  );
  const features = data?.municipalitiesByPrefecture[prefectureCode] ?? [];
  const displayFeatureMap = useMemo(() => new Map(features.map((feature) => {
    const paths = municipalityDisplayPaths(feature);
    return [feature.code, {
      paths,
      feature: paths.excludedPath
        ? { ...feature, path: paths.interactivePath, labelPoint: undefined, callout: undefined }
        : feature
    }];
  })), [features]);
  const baseViewBox = useMemo(() => screenViewBox(features, 22), [features]);
  const visibleViewBox = useMemo(
    () => baseViewBox ? pannedZoomViewBox(baseViewBox, zoom, pan) : null,
    [baseViewBox, pan, zoom]
  );

  useEffect(() => {
    if (!focusedFeatureCode && features[0]) setFocusedFeatureCode(features[0].code);
  }, [features, focusedFeatureCode]);

  const rows = useMemo(
    () => [...municipalities].sort((a, b) => nullsLast(a.expenseRecoveryRate, b.expenseRecoveryRate, "desc")),
    [municipalities]
  );
  const labelLayout = useMemo(
    () => buildLabelLayout({
      features,
      displayFeatureMap,
      municipalityLookup,
      surfaceSize,
      viewBox: visibleViewBox ?? baseViewBox,
      zoom,
      labelsVisible,
      activeFeatureCode: selectedFeatureCode
    }),
    [baseViewBox, displayFeatureMap, features, labelsVisible, municipalityLookup, selectedFeatureCode, surfaceSize, visibleViewBox, zoom]
  );
  const exportHref = `/data/static/csv/prefectures/${prefectureCode}.csv`;

  function openMunicipality(feature: GisFeature) {
    if (suppressClickRef.current) return;
    const match = municipalityLookup.get(feature.name);
    if (match?.municipalityCode) {
      router.push(municipalityHref(match));
      return;
    }
    router.push(`/municipalities?prefecture=${encodeURIComponent(prefectureName)}&q=${encodeURIComponent(feature.name)}`);
  }

  function resetMap() {
    setZoomIndex(0);
    setPan({ x: 0, y: 0 });
    setHover(null);
    setSelectedFeatureCode(null);
  }

  function changeZoom(direction: -1 | 1) {
    setZoomIndex((value) => Math.min(Math.max(value + direction, 0), zoomSteps.length - 1));
    setPan({ x: 0, y: 0 });
    setHover(null);
  }

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (zoom <= 1 || event.button !== 0) return;
    dragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      pan,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const surface = surfaceRef.current;
    if (!drag || !surface || !baseViewBox) return;
    const rect = surface.getBoundingClientRect();
    const visible = parseViewBox(pannedZoomViewBox(baseViewBox, zoom, drag.pan));
    if (!visible) return;
    const deltaX = event.clientX - drag.clientX;
    const deltaY = event.clientY - drag.clientY;
    if (Math.hypot(deltaX, deltaY) > 3) drag.moved = true;
    setPan(clampMapPan(baseViewBox, zoom, {
      x: drag.pan.x - (deltaX / Math.max(rect.width, 1)) * visible.width,
      y: drag.pan.y - (deltaY / Math.max(rect.height, 1)) * visible.height
    }));
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    const moved = dragRef.current?.moved ?? false;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPanning(false);
    if (moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }

  function updateHover(event: MouseEvent<SVGGElement>, feature: GisFeature, match?: MapMunicipality) {
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const width = 252;
    const height = 154;
    const margin = 12;
    const offset = 16;
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const openRight = cursorX + offset + width <= rect.width - margin;
    const preferredX = openRight ? cursorX + offset : cursorX - offset - width;
    const x = clampNumber(preferredX, margin, Math.max(rect.width - width - margin, margin));
    const y = clampNumber(cursorY - height / 2, margin, Math.max(rect.height - height - margin, margin));
    const href = match?.municipalityCode
      ? municipalityHref(match)
      : `/municipalities?prefecture=${encodeURIComponent(prefectureName)}&q=${encodeURIComponent(feature.name)}`;
    setHover({
      href,
      title: feature.name,
      label: displayFeeRecoveryBandLabel(match?.feeAdequacyLabel ?? labelFromMetrics(
        match?.expenseRecoveryRate,
        match?.feeUnitPriceYenPerM3
      )),
      recovery: formatPercent(match?.expenseRecoveryRate),
      feeUnit: formatYenPerM3(match?.feeUnitPriceYenPerM3),
      revision: match?.hasRevisionEvent ? "登録あり" : "未登録",
      x,
      y
    });
  }

  function handleRegionKey(event: KeyboardEvent<SVGGElement>, feature: GisFeature) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMunicipality(feature);
      return;
    }
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
    const regionNodes = Array.from(
      event.currentTarget.ownerSVGElement?.querySelectorAll<SVGGElement>("[data-municipality-region]") ?? []
    );
    if (regionNodes.length < 2) return;
    event.preventDefault();
    const currentIndex = regionNodes.indexOf(event.currentTarget);
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    regionNodes[(currentIndex + direction + regionNodes.length) % regionNodes.length]?.focus();
  }

  return (
    <section className={styles.explorer}>
      <section className={styles.mapPanel} aria-labelledby="prefecture-map-title">
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>{prefectureName} / {summary?.municipalityCount ?? municipalities.length}市区町村</p>
              <h2 id="prefecture-map-title">市区町村別マップ</h2>
            </div>
            <div className={styles.mapControls} role="group" aria-label="地図操作">
              <button type="button" onClick={() => changeZoom(-1)} disabled={zoomIndex === 0} aria-label="縮小">
                <Minus size={17} />
              </button>
              <span aria-live="polite">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => changeZoom(1)} disabled={zoomIndex === zoomSteps.length - 1} aria-label="拡大">
                <Plus size={17} />
              </button>
              <button type="button" onClick={resetMap} aria-label="全域表示" title="全域表示">
                <LocateFixed size={17} />
              </button>
              <button
                type="button"
                onClick={() => setLabelsVisible((value) => !value)}
                aria-pressed={labelsVisible}
                aria-label={labelsVisible ? "自治体名を非表示" : "自治体名を表示"}
                title={labelsVisible ? "自治体名を非表示" : "自治体名を表示"}
              >
                {labelsVisible ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
            </div>
          </header>

          <div className={styles.legend} role="list" aria-label="経費回収率の凡例">
            {statusLegend.map((item) => (
              <span key={item.key} role="listitem">
                <i style={{ backgroundColor: item.color }} />
                <b>{item.label}</b>
                {item.note ? <small>{item.note}</small> : null}
              </span>
            ))}
          </div>

          <div
            ref={surfaceRef}
            className={styles.mapSurface}
            data-pannable={zoom > 1 ? "true" : "false"}
            data-panning={isPanning ? "true" : "false"}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onMouseLeave={() => {
              setHover(null);
              if (!isPanning) setSelectedFeatureCode(null);
            }}
          >
            {!data && !error ? <div className={styles.loading}>地図を読み込んでいます…</div> : null}
            {error ? (
              <div className={styles.fallback}>
                <strong>地図を読み込めませんでした</strong>
                <p>下の比較データから自治体の詳細を開けます。</p>
              </div>
            ) : null}
            {data && features.length > 0 ? (
              <svg
                viewBox={visibleViewBox ?? `0 0 ${data.viewBox.width} ${data.viewBox.height}`}
                role="group"
                aria-label={`${prefectureName}の市区町村別経費回収率区分マップ`}
                preserveAspectRatio="xMidYMid meet"
              >
                {features.map((feature, index) => {
                  const display = displayFeatureMap.get(feature.code) ?? {
                    feature,
                    paths: { interactivePath: feature.path, excludedPath: "" }
                  };
                  const match = municipalityLookup.get(feature.name);
                  const status = match?.feeAdequacyLabel ?? labelFromMetrics(
                    match?.expenseRecoveryRate,
                    match?.feeUnitPriceYenPerM3
                  );
                  const active = selectedFeatureCode === feature.code;
                  return (
                    <g key={`${feature.code}-${feature.name}`}>
                      {display.paths.excludedPath ? (
                        <path
                          className={styles.excludedShape}
                          d={display.paths.excludedPath}
                          fill={statusColors["データなし・対象外"]}
                          fillRule="evenodd"
                          vectorEffect="non-scaling-stroke"
                          aria-hidden="true"
                        />
                      ) : null}
                      <g
                        data-municipality-region={feature.code}
                        className={clsx(styles.mapRegion, active && styles.active)}
                        role="link"
                        aria-label={`${feature.name}、経費回収率 ${formatPercent(match?.expenseRecoveryRate)}、区分 ${displayFeeRecoveryBandLabel(status)}。詳細を開く`}
                        tabIndex={focusedFeatureCode ? (focusedFeatureCode === feature.code ? 0 : -1) : index === 0 ? 0 : -1}
                        onClick={() => openMunicipality(feature)}
                        onKeyDown={(event) => handleRegionKey(event, feature)}
                        onBlur={() => setSelectedFeatureCode(null)}
                        onFocus={() => {
                          setFocusedFeatureCode(feature.code);
                          setSelectedFeatureCode(feature.code);
                        }}
                        onMouseEnter={(event) => {
                          setSelectedFeatureCode(feature.code);
                          updateHover(event, feature, match);
                        }}
                        onMouseMove={(event) => {
                          if (hover?.title !== feature.name) updateHover(event, feature, match);
                        }}
                      >
                        <path
                          className={styles.shape}
                          d={display.paths.interactivePath}
                          fill={statusColors[status]}
                          fillRule="evenodd"
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                    </g>
                  );
                })}
                <g
                  className={styles.mapLabelLayer}
                  data-map-label-layer="true"
                  data-label-count={labelLayout.codes.size}
                  aria-hidden="true"
                >
                  {features.map((feature) => {
                    if (!labelLayout.codes.has(feature.code)) return null;
                    const display = displayFeatureMap.get(feature.code)?.feature ?? feature;
                    return (
                      <FeatureLabel
                        key={`label-${feature.code}-${feature.name}`}
                        feature={display}
                        mapScale={labelLayout.scale}
                        compact={surfaceSize.width > 0 && surfaceSize.width < 700}
                      />
                    );
                  })}
                </g>
              </svg>
            ) : null}
            {hover ? <MapHoverCard hover={hover} /> : null}
          </div>
          <p className={styles.mapNote}>
            色は各市区町村の最新年度の表示事業による経費回収率です。複数事業がある場合は診断上の注意度が最も高い1事業を表示し、自治体全体の合算値ではありません。詳細画面で事業を切り替えられます。{zoom > 1 ? "地図をドラッグして移動できます。" : ""}
          </p>
      </section>

      <section className={styles.comparisonPanel} aria-labelledby="municipality-comparison-title">
        <header>
          <div>
            <p className={styles.eyebrow}>{prefectureName}内の比較データ</p>
            <h2 id="municipality-comparison-title">比較データ <span>経費回収率順・先頭{Math.min(rows.length, 10)}件</span></h2>
          </div>
          <Link href={exportHref}>
            <Download size={16} />{prefectureName}の{rows.length}件をCSVでダウンロード
          </Link>
        </header>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th scope="col">市区町村名（事業種別）</th>
                <th scope="col">年度</th>
                <th scope="col">経費回収率</th>
                <th scope="col">使用料単価</th>
                <th scope="col">汚水処理原価</th>
                <th scope="col">使用料収入の必要増加率</th>
                <th scope="col">公式改定情報</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((item) => (
                <tr key={item.municipalityCode ?? `${item.prefectureName}-${item.municipalityName}`}>
                  <td><Link href={municipalityHref(item)}>{item.municipalityName}<small>{displayBusinessName(item)}{(item.businessCount ?? 0) > 1 ? "・複数事業あり" : ""}{item.flags?.length ? `・要確認（${item.flags.length}）` : ""}</small></Link></td>
                  <td>{item.latestYear ? `${item.latestYear}年度` : "—"}</td>
                  <td><strong>{formatPercent(item.expenseRecoveryRate)}</strong><Badge>{item.feeAdequacyLabel ?? labelFromMetrics(item.expenseRecoveryRate, item.feeUnitPriceYenPerM3)}</Badge></td>
                  <td>{formatYenPerM3(item.feeUnitPriceYenPerM3)}</td>
                  <td>{formatYenPerM3(item.treatmentCostYenPerM3)}</td>
                  <td>{formatRevisionRate(item.requiredRevisionRateTo100)}</td>
                  <td>{item.hasRevisionEvent ? <Badge>登録あり</Badge> : "未登録"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <div className={styles.emptyState}>表示できる比較データがありません。</div> : null}
      </section>
    </section>
  );
}

function FeatureLabel({ feature, mapScale, compact }: { feature: GisFeature; mapScale: number; compact: boolean }) {
  const point = feature.labelPoint ?? centerOfFeature(feature);
  if (!point) return null;
  const lines = feature.labelLines?.length ? feature.labelLines : splitLabel(feature.name);
  const fontSize = labelTargetPixels(feature, compact) / Math.max(mapScale, 0.001);
  const lineHeight = fontSize * 1.1;
  const startY = point[1] - ((lines.length - 1) * lineHeight) / 2;
  return (
    <>
      {feature.callout ? (
        <line
          className={styles.mapLabelCallout}
          x1={feature.callout.from[0]}
          y1={feature.callout.from[1]}
          x2={feature.callout.to[0]}
          y2={feature.callout.to[1]}
          vectorEffect="non-scaling-stroke"
          aria-hidden="true"
        />
      ) : null}
      <text
        className={styles.mapLabel}
        x={point[0]}
        y={startY}
        textAnchor={feature.labelAnchor ?? "middle"}
        fontSize={fontSize}
        aria-hidden="true"
      >
        {lines.map((line, index) => (
          <tspan key={`${feature.code}-${line}-${index}`} x={point[0]} dy={index === 0 ? 0 : lineHeight}>{line}</tspan>
        ))}
      </text>
    </>
  );
}

function MapHoverCard({ hover }: { hover: HoverState }) {
  return (
    <div className={styles.tooltip} style={{ left: hover.x, top: hover.y }}>
      <div className={styles.tooltipTitle}><strong>{hover.title}</strong><span>{hover.label}</span></div>
      <dl>
        <div><dt>経費回収率</dt><dd>{hover.recovery}</dd></div>
        <div><dt>使用料単価</dt><dd>{hover.feeUnit}</dd></div>
        <div><dt>公式改定情報</dt><dd>{hover.revision}</dd></div>
      </dl>
      <Link href={hover.href}>詳細を見る<ChevronRight size={14} /></Link>
    </div>
  );
}

function parseViewBox(viewBox: string) {
  const [x, y, width, height] = viewBox.trim().split(/\s+/).map(Number);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x, y, width, height };
}

function pannedZoomViewBox(baseViewBox: string, zoom: number, pan: MapPan) {
  const base = parseViewBox(baseViewBox);
  if (!base) return baseViewBox;
  const width = base.width / Math.max(zoom, 1);
  const height = base.height / Math.max(zoom, 1);
  const centeredX = base.x + (base.width - width) / 2;
  const centeredY = base.y + (base.height - height) / 2;
  const x = clampNumber(centeredX + pan.x, base.x, base.x + base.width - width);
  const y = clampNumber(centeredY + pan.y, base.y, base.y + base.height - height);
  return `${x} ${y} ${width} ${height}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampMapPan(baseViewBox: string, zoom: number, pan: MapPan): MapPan {
  const base = parseViewBox(baseViewBox);
  if (!base || zoom <= 1) return { x: 0, y: 0 };
  const maxX = (base.width - base.width / zoom) / 2;
  const maxY = (base.height - base.height / zoom) / 2;
  return {
    x: clampNumber(pan.x, -maxX, maxX),
    y: clampNumber(pan.y, -maxY, maxY)
  };
}

function municipalityHref(item: MapMunicipality) {
  if (item.municipalityCode) {
    const query = new URLSearchParams();
    if (item.businessKey) query.set("business", item.businessKey);
    query.set("view", "fees");
    return `/municipalities/${item.municipalityCode}?${query.toString()}`;
  }
  return `/municipalities?prefecture=${encodeURIComponent(item.prefectureName)}&q=${encodeURIComponent(item.municipalityName)}`;
}

function labelFromMetrics(
  recoveryRate: number | null | undefined,
  feeUnitPrice: number | null | undefined
) {
  const recovery = recoveryRate != null && Number.isFinite(recoveryRate) ? recoveryRate : null;
  const feeUnit = feeUnitPrice != null && Number.isFinite(feeUnitPrice) ? feeUnitPrice : null;
  const label = getFeeAdequacyLabel(recovery, feeUnit);
  return label === "判定不可" ? "データなし・対象外" : label;
}

function nullsLast(a: number | null | undefined, b: number | null | undefined, direction: "asc" | "desc") {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

function featureArea(feature: GisFeature) {
  const bounds = primaryFeatureScreenBounds(feature) ?? pathScreenBounds(feature.path);
  return bounds ? Math.max(bounds[2] - bounds[0], 0) * Math.max(bounds[3] - bounds[1], 0) : 0;
}

function buildLabelLayout({
  features,
  displayFeatureMap,
  municipalityLookup,
  surfaceSize,
  viewBox,
  zoom,
  labelsVisible,
  activeFeatureCode
}: {
  features: GisFeature[];
  displayFeatureMap: Map<string, { paths: { interactivePath: string; excludedPath: string }; feature: GisFeature }>;
  municipalityLookup: Map<string, MapMunicipality>;
  surfaceSize: SurfaceSize;
  viewBox: string | null;
  zoom: number;
  labelsVisible: boolean;
  activeFeatureCode: string | null;
}) {
  const codes = new Set<string>();
  const parsed = viewBox ? parseViewBox(viewBox) : null;
  if (!labelsVisible || !parsed || surfaceSize.width <= 0 || surfaceSize.height <= 0) {
    return { codes, scale: 1 };
  }

  const scale = Math.min(surfaceSize.width / parsed.width, surfaceSize.height / parsed.height);
  const offsetX = (surfaceSize.width - parsed.width * scale) / 2;
  const offsetY = (surfaceSize.height - parsed.height * scale) / 2;
  const compact = surfaceSize.width < 700;
  const dense = features.length > 100;
  const collisionGap = compact ? 5 : dense ? 7 : 4;
  const baseDensityBudget = Math.floor((surfaceSize.width * surfaceSize.height) / (compact ? 14500 : 15000));
  const densityBudget = dense
    ? clampNumber(
        Math.round(baseDensityBudget * Math.pow(Math.max(zoom, 1), 1.25)),
        compact ? 9 : 48,
        compact ? 28 : 96
      )
    : features.length;
  const accepted: Array<{
    rect: { x: number; y: number; width: number; height: number };
    leader: { from: [number, number]; to: [number, number] } | null;
  }> = [];
  const toScreen = (point: [number, number]): [number, number] => [
    offsetX + (point[0] - parsed.x) * scale,
    offsetY + (point[1] - parsed.y) * scale
  ];
  const candidates = features
    .filter((feature) => !overviewLabelExcludedNames.has(feature.name))
    .map((feature) => displayFeatureMap.get(feature.code)?.feature ?? feature)
    .sort((a, b) => labelPriority(b, municipalityLookup, activeFeatureCode) - labelPriority(a, municipalityLookup, activeFeatureCode)
      || a.code.localeCompare(b.code, "ja"));

  for (const feature of candidates) {
    if (codes.size >= densityBudget && feature.code !== activeFeatureCode) break;
    const point = feature.labelPoint ?? centerOfFeature(feature);
    if (!point) continue;
    const lines = feature.labelLines?.length ? feature.labelLines : splitLabel(feature.name);
    const targetPixels = labelTargetPixels(feature, compact);
    const longestLine = Math.max(...lines.map((line) => line.length), 1);
    const width = longestLine * targetPixels + 9;
    const height = lines.length * targetPixels * 1.1 + 7;
    const screenX = offsetX + (point[0] - parsed.x) * scale;
    const screenY = offsetY + (point[1] - parsed.y) * scale;
    const anchor = feature.labelAnchor ?? "middle";
    const x = anchor === "start" ? screenX - 3 : anchor === "end" ? screenX - width + 3 : screenX - width / 2;
    const rect = { x, y: screenY - height / 2, width, height };
    const withinSurface = rect.x >= 7
      && rect.y >= 7
      && rect.x + rect.width <= surfaceSize.width - 7
      && rect.y + rect.height <= surfaceSize.height - 7;
    const leader = feature.callout
      ? { from: toScreen(feature.callout.from), to: toScreen(feature.callout.to) }
      : null;
    const overlapsLabel = accepted.some((placed) => screenRectsOverlap(placed.rect, rect, collisionGap));
    const leaderHitsLabel = leader != null && accepted.some((placed) => lineIntersectsRect(leader.from, leader.to, placed.rect));
    const labelHitsLeader = accepted.some((placed) => placed.leader && lineIntersectsRect(placed.leader.from, placed.leader.to, rect));
    const leaderCrossesLeader = leader != null && accepted.some((placed) => placed.leader
      && lineSegmentsIntersect(leader.from, leader.to, placed.leader.from, placed.leader.to));
    if (!withinSurface || overlapsLabel || leaderHitsLabel || labelHitsLeader || leaderCrossesLeader) continue;
    accepted.push({ rect, leader });
    codes.add(feature.code);
  }

  return { codes, scale };
}

const overviewLabelExcludedNames = new Set(["色丹村", "留夜別村", "留別村", "紗那村", "蘂取村"]);

function labelPriority(
  feature: GisFeature,
  municipalityLookup: Map<string, MapMunicipality>,
  activeFeatureCode: string | null
) {
  const active = feature.code === activeFeatureCode ? 1_000_000_000 : 0;
  const comparable = municipalityLookup.has(feature.name) ? 1_000_000 : 0;
  const city = feature.name.endsWith("市") ? 180_000 : 0;
  const callout = feature.callout ? 120_000 : 0;
  return active + comparable + city + callout + featureArea(feature);
}

function screenRectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  gap: number
) {
  return a.x < b.x + b.width + gap
    && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap
    && a.y + a.height + gap > b.y;
}

function lineIntersectsRect(
  start: [number, number],
  end: [number, number],
  rect: { x: number; y: number; width: number; height: number }
) {
  const topLeft: [number, number] = [rect.x, rect.y];
  const topRight: [number, number] = [rect.x + rect.width, rect.y];
  const bottomRight: [number, number] = [rect.x + rect.width, rect.y + rect.height];
  const bottomLeft: [number, number] = [rect.x, rect.y + rect.height];
  return pointInsideRect(start, rect)
    || pointInsideRect(end, rect)
    || lineSegmentsIntersect(start, end, topLeft, topRight)
    || lineSegmentsIntersect(start, end, topRight, bottomRight)
    || lineSegmentsIntersect(start, end, bottomRight, bottomLeft)
    || lineSegmentsIntersect(start, end, bottomLeft, topLeft);
}

function pointInsideRect(point: [number, number], rect: { x: number; y: number; width: number; height: number }) {
  return point[0] >= rect.x
    && point[0] <= rect.x + rect.width
    && point[1] >= rect.y
    && point[1] <= rect.y + rect.height;
}

function lineSegmentsIntersect(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number]
) {
  const cross = (p: [number, number], q: [number, number], r: [number, number]) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0))
    && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0));
}

function labelTargetPixels(feature: GisFeature, compact: boolean) {
  const base = feature.labelSize ?? labelSize(feature);
  return compact
    ? clampNumber(base * 0.84, 8.5, 10.5)
    : clampNumber(base * 0.95, 9.5, 12);
}

function centerOfFeature(feature: GisFeature): [number, number] | null {
  const bounds = primaryFeatureScreenBounds(feature) ?? pathScreenBounds(feature.path);
  return bounds ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : null;
}

function splitLabel(name: string) {
  if (name.length <= 4) return [name];
  const suffix = name.match(/^(.+)(市|町|村|区)$/);
  if (suffix && suffix[1].length >= 3 && name.length <= 7) return [suffix[1], suffix[2]];
  const splitAt = Math.ceil(name.length / 2);
  return [name.slice(0, splitAt), name.slice(splitAt)];
}

function labelSize(feature: GisFeature) {
  const bounds = primaryFeatureScreenBounds(feature) ?? pathScreenBounds(feature.path);
  if (!bounds) return 8;
  const shortSide = Math.min(bounds[2] - bounds[0], bounds[3] - bounds[1]);
  if (shortSide < 12) return 6.5;
  if (shortSide < 20 || feature.name.length >= 6) return 7.4;
  return feature.name.length >= 5 ? 8.2 : 9;
}
