"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Download,
  ChevronRight,
  ExternalLink,
  Info,
  ListFilter,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  Minus,
  Plus,
  Search,
  Table2
} from "lucide-react";
import clsx from "clsx";
import { Badge } from "@/components/Badge";
import { accountingTypeLabel, displayBusinessName } from "@/lib/businessDisplay";
import { getFeeAdequacyLabel } from "@/lib/calculations";
import { displayFeeRecoveryBandLabel } from "@/lib/feeRecoveryCopy";
import { formatPercent, formatRevisionRate, formatYenPerM3 } from "@/lib/format";
import {
  GIS_HEIGHT,
  GIS_PAD,
  GIS_WIDTH,
  atlasDisplayPath,
  clamp,
  mapFeatureHref,
  pathScreenBounds,
  screenViewBox,
  type Bounds
} from "@/lib/gisMapLayout";
import {
  getPrefectureCode,
  getPrefectureName,
  normalizePrefectureName,
  prefecturesByRegion,
  regionNames,
  type RegionName
} from "@/lib/prefectures";

export type PrefectureSummary = {
  prefectureName: string;
  municipalityCount: number;
  averageExpenseRecoveryRate?: number | null;
  revisionEventCount?: number;
  excludedBusinessCount?: number;
};

export type MapMunicipality = {
  municipalityCode: string | null;
  prefectureName: string;
  municipalityName: string;
  municipalityNameKana?: string | null;
  latestYear?: number | null;
  businessKey?: string | null;
  businessType?: string | null;
  businessName?: string | null;
  estatBusinessCategory?: string | null;
  businessCount?: number;
  dataQualityStatus?: string | null;
  flags?: string[];
  accountingType?: string | null;
  expenseRecoveryRate?: number | null;
  feeUnitPriceYenPerM3?: number | null;
  treatmentCostYenPerM3?: number | null;
  requiredRevisionRateTo100?: number | null;
  feeAdequacyLabel?: string | null;
  hasRevisionEvent?: boolean;
};

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
  callout?: {
    from: [number, number];
    to: [number, number];
  };
  layoutGroup?: "main" | "hokkaido" | "okinawa" | "tokyo-islands" | "remote-islands";
  municipalityCount?: number;
};

type GisData = {
  source: {
    name: string;
    url: string;
    dataYear: string;
    dataDate: string;
    note: string;
  };
  viewBox: {
    width: number;
    height: number;
  };
  guideLines?: {
    from: [number, number];
    to: [number, number];
  }[];
  prefectures: GisFeature[];
  municipalitiesByPrefecture: Record<string, GisFeature[]>;
};

type OverviewStats = {
  municipalityCount: number;
  latestYear: number | null;
  below100Rate: number | null;
  revisionEventCount: number;
};

type JapanMapVariant = "home" | "atlas";

const statusLegend = [
  { key: "適正水準", label: "100%以上", note: "", color: "#3db5a4" },
  { key: "やや不足", label: "90%以上100%未満", note: "", color: "#a9d66f" },
  { key: "要注意", label: "80%以上90%未満", note: "", color: "#f5c65e" },
  { key: "改定圧力高", label: "80%未満", note: "単価150円/m³以上・不明", color: "#f39a43" },
  { key: "重点監視", label: "80%未満", note: "単価150円/m³未満", color: "#e95b5d" },
  { key: "データなし・対象外", label: "データなし・対象外", note: "", color: "#d1d4d8" }
];

const statusColors: Record<string, string> = Object.fromEntries(statusLegend.map((item) => [item.key, item.color]));
const nationalRecoveryLegend = [
  { key: "100%以上", label: "100%以上", color: "#3db5a4" },
  { key: "90%以上100%未満", label: "90%以上100%未満", color: "#a9d66f" },
  { key: "80%以上90%未満", label: "80%以上90%未満", color: "#f5c65e" },
  { key: "80%未満", label: "80%未満", color: "#e95b5d" },
  { key: "データなし・対象外", label: "データなし・対象外", color: "#d1d4d8" }
] as const;
const nationalRecoveryColors: Record<string, string> = Object.fromEntries(
  nationalRecoveryLegend.map((item) => [item.key, item.color])
);

const NATIONAL_HOVER_DELAY_MS = 280;
type NationalHoverEvent = MouseEvent<SVGGElement | HTMLAnchorElement> | PointerEvent<SVGGElement | HTMLAnchorElement>;

export function JapanMapSelector({
  summaries,
  municipalities = [],
  overview,
  variant = "home"
}: {
  summaries: PrefectureSummary[];
  municipalities?: MapMunicipality[];
  overview?: OverviewStats;
  variant?: JapanMapVariant;
}) {
  return (
    <NationalMapExplorer
      summaries={summaries}
      municipalities={municipalities}
      variant={variant}
      overview={overview ?? {
        municipalityCount: municipalities.length,
        latestYear: null,
        below100Rate: null,
        revisionEventCount: municipalities.filter((item) => item.hasRevisionEvent).length
      }}
    />
  );
}

export function NationalMapExplorer({
  summaries,
  municipalities,
  overview,
  variant
}: {
  summaries: PrefectureSummary[];
  municipalities: MapMunicipality[];
  overview: OverviewStats;
  variant: JapanMapVariant;
}) {
  const [data, setData] = useState<GisData | null>(null);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [activePrefectureCode, setActivePrefectureCode] = useState<string | null>(null);
  const [manualZoom, setManualZoom] = useState(1);
  const [focusedRegion, setFocusedRegion] = useState<RegionName | null>(null);
  const hoverDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHoverRef = useRef<HoverState | null>(null);
  const hoverTargetCodeRef = useRef<string | null>(null);
  const mapSurfaceRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const compactAtlas = useMediaQuery("(max-width: 767px)");

  useGisData(setData, setError);

  const summaryMap = useMemo(
    () => new Map(summaries.map((summary) => [displayPrefectureName(summary.prefectureName), summary])),
    [summaries]
  );
  const byPrefecture = useMemo(() => groupMunicipalitiesByPrefecture(municipalities), [municipalities]);
  const atlasMainFeatures = useMemo(
    () => data?.prefectures.filter(isNationalMainMapFeature) ?? [],
    [data]
  );
  const featureByPrefectureName = useMemo(() => {
    if (!data) return new Map<string, GisFeature>();
    return new Map(data.prefectures.map((feature) => [displayPrefectureName(feature.name), feature]));
  }, [data]);

  useEffect(() => () => {
    if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current);
  }, []);

  useEffect(() => {
    const clearWhenOutside = (event: globalThis.PointerEvent) => {
      const surface = mapSurfaceRef.current;
      if (!surface) return;
      const bounds = surface.getBoundingClientRect();
      const outside = event.clientX < bounds.left
        || event.clientX > bounds.right
        || event.clientY < bounds.top
        || event.clientY > bounds.bottom;
      if (outside && (hoverTargetCodeRef.current || pendingHoverRef.current)) {
        clearNationalHover();
        setActivePrefectureCode(null);
      }
    };
    window.addEventListener("pointermove", clearWhenOutside, { passive: true });
    return () => window.removeEventListener("pointermove", clearWhenOutside);
  }, []);

  function clearNationalHover() {
    if (hoverDelayRef.current) {
      clearTimeout(hoverDelayRef.current);
      hoverDelayRef.current = null;
    }
    pendingHoverRef.current = null;
    hoverTargetCodeRef.current = null;
    setHover(null);
  }

  function scheduleNationalHover(
    event: NationalHoverEvent,
    feature: GisFeature,
    summary: PrefectureSummary | undefined,
    featureMunicipalities: MapMunicipality[] | undefined
  ) {
    const nextHover = hoverStateFromEvent(event, feature, summary, featureMunicipalities, mapSurfaceRef.current);
    pendingHoverRef.current = nextHover;

    if (hoverTargetCodeRef.current !== feature.code) {
      if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current);
      hoverTargetCodeRef.current = feature.code;
      setHover(null);
      if (NATIONAL_HOVER_DELAY_MS <= 0) {
        setHover(nextHover);
        hoverDelayRef.current = null;
        return;
      }
      hoverDelayRef.current = setTimeout(() => {
        if (pendingHoverRef.current?.code === feature.code) {
          setHover(pendingHoverRef.current);
        }
        hoverDelayRef.current = null;
      }, NATIONAL_HOVER_DELAY_MS);
      return;
    }

    if (hover?.code === feature.code) {
      setHover(nextHover);
    }
  }

  function focusRegion(region: RegionName) {
    clearNationalHover();
    setActivePrefectureCode(null);
    setManualZoom(1);
    setFocusedRegion((current) => current === region ? null : region);
  }

  function showNationalView() {
    clearNationalHover();
    setActivePrefectureCode(null);
    setManualZoom(1);
    setFocusedRegion(null);
  }

  const MapHeading = variant === "home" ? "h1" : "h2";

  return (
    <section className={clsx("home-map-explorer grid gap-4", `home-map-explorer--${variant}`)}>
      <div className={clsx("home-map-layout grid gap-5", `home-map-layout--${variant}`)}>
        <div className="panel national-map-panel overflow-hidden p-4">
          <div className="home-panel-title-row">
            <div>
              <MapHeading>経費回収率</MapHeading>
            </div>
            <InfoDisclosure label="全国マップの使い方">
              {variant === "home"
                ? "都道府県を選ぶと、市区町村別の詳細マップへ移動します。色は各市区町村の最新年度・最も注意度が高い表示事業1件の経費回収率を使った単純平均です。自治体全体の合算値や公式全国平均ではありません。"
                : "都道府県を選ぶと、市区町村別の詳細マップを表示します。色は各市区町村の最新年度・最も注意度が高い表示事業1件の経費回収率を使った単純平均です。自治体全体の合算値や公式全国平均ではありません。"}
            </InfoDisclosure>
          </div>
          <div
            ref={mapSurfaceRef}
            className={clsx(
              "gis-map-surface relative overflow-hidden rounded-md border border-line bg-white",
              "gis-map-surface--home-national"
            )}
            onMouseLeave={() => {
              clearNationalHover();
              setActivePrefectureCode(null);
            }}
            onPointerLeave={() => {
              clearNationalHover();
              setActivePrefectureCode(null);
            }}
          >
            {!data && !error ? <LoadingMap label="全国マップを読み込み中" /> : null}
            {error ? <FallbackPrefectureList summaries={summaries} /> : null}
            {data ? (
              <>
                <div className="home-national-map-legend">
                  <MapLegend compact />
                </div>
                <HomeNationalMap
                  mainFeatures={atlasMainFeatures}
                  featureByPrefectureName={featureByPrefectureName}
                  summaryMap={summaryMap}
                  byPrefecture={byPrefecture}
                  activePrefectureCode={activePrefectureCode}
                  manualZoom={manualZoom}
                  focusedRegion={focusedRegion}
                  compact={compactAtlas}
                  onOpen={(feature) => router.push(`/map/${feature.code}`)}
                  onActivate={setActivePrefectureCode}
                  onHover={scheduleNationalHover}
                />
                <p className="sr-only" role="status" aria-live="polite">
                  {focusedRegion
                    ? `${focusedRegion}を拡大表示中。都道府県名を表示しています。`
                    : "全国を表示中。"}
                </p>
              </>
            ) : null}
            {hover ? <MapHoverCard hover={hover} showDetailLink={variant !== "home"} /> : null}
            <div className="map-control-stack map-control-stack--home" role="group" aria-label="地図操作">
              <button type="button" onClick={() => setManualZoom((value) => clamp(value + 0.18, 1, 1.72))} aria-label="拡大">
                <Plus size={20} />
              </button>
              <button type="button" onClick={() => setManualZoom((value) => clamp(value - 0.18, 1, 1.72))} aria-label="縮小">
                <Minus size={20} />
              </button>
              <button type="button" onClick={showNationalView} className="map-reset-button" aria-label="全国を表示">
                <LocateFixed size={16} />
                <span>全国を表示</span>
              </button>
            </div>
          </div>
        </div>
        <PrefectureSelectorPanel
          summaries={summaries}
          activeRegion={focusedRegion}
          onRegionChange={focusRegion}
        />
      </div>

      <div className="home-support-grid grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <RankingPair items={municipalities} />
        <HowToCards />
      </div>
    </section>
  );
}

function HomeNationalMap({
  mainFeatures,
  featureByPrefectureName,
  summaryMap,
  byPrefecture,
  activePrefectureCode,
  manualZoom,
  focusedRegion,
  compact,
  onOpen,
  onActivate,
  onHover
}: {
  mainFeatures: GisFeature[];
  featureByPrefectureName: Map<string, GisFeature>;
  summaryMap: Map<string, PrefectureSummary>;
  byPrefecture: Map<string, MapMunicipality[]>;
  activePrefectureCode: string | null;
  manualZoom: number;
  focusedRegion: RegionName | null;
  compact: boolean;
  onOpen: (feature: GisFeature) => void;
  onActivate: (code: string | null) => void;
  onHover: (
    event: NationalHoverEvent,
    feature: GisFeature,
    summary: PrefectureSummary | undefined,
    featureMunicipalities: MapMunicipality[] | undefined
  ) => void;
}) {
  const homeZoom = 1 + (manualZoom - 1) * 0.12;
  const viewBox = compact ? "0 0 390 440" : "0 0 980 500";
  const mainFrame = compact
    ? { x: 18, y: 132, width: 354, height: 236, pad: 8, useOverviewPathBounds: true }
    : { x: 165, y: 30, width: 650, height: 460, pad: 8, useOverviewPathBounds: true };
  const focusFrame = compact
    ? { x: 14, y: 108, width: 362, height: 286 }
    : { x: 250, y: 18, width: 700, height: 455 };
  const northFocusFrame = compact
    ? { x: 205, y: 108, width: 171, height: 286 }
    : { x: 515, y: 18, width: 430, height: 455 };
  const insetNames = compact
    ? [
        { title: "北海道", name: "北海道", x: 18, y: 14, width: 142, height: 88 },
        { title: "沖縄県", name: "沖縄県", x: 232, y: 372, width: 128, height: 54 }
      ]
    : [
        { title: "北海道", name: "北海道", x: 250, y: 18, width: 160, height: 104 },
        { title: "沖縄県", name: "沖縄県", x: 812, y: 372, width: 142, height: 94 }
      ];
  const focusedPrefectures = useMemo(
    () => focusedRegion ? prefecturesByRegion(focusedRegion) : [],
    [focusedRegion]
  );
  const focusedCodes = useMemo(
    () => new Set(focusedPrefectures.map((prefecture) => prefecture.code)),
    [focusedPrefectures]
  );
  const focusedMainFeatures = useMemo(
    () => focusedRegion ? mainFeatures.filter((feature) => focusedCodes.has(feature.code)) : mainFeatures,
    [focusedCodes, focusedRegion, mainFeatures]
  );
  const focusedViewBox = focusedRegion
    ? atlasOverviewScreenViewBox(focusedMainFeatures, 18)
    : null;
  const activeFocusFrame = focusedRegion === "北海道・東北" ? northFocusFrame : focusFrame;
  const renderedFrame = focusedRegion && focusedViewBox
    ? { ...activeFocusFrame, viewBox: focusedViewBox }
    : mainFrame;
  const renderedFeatures = focusedRegion && focusedMainFeatures.length > 0
    ? focusedMainFeatures
    : mainFeatures;
  const visibleInsets = focusedRegion === "北海道・東北"
    ? [compact
        ? { title: "北海道", name: "北海道", x: 18, y: 218, width: 175, height: 120 }
        : { title: "北海道", name: "北海道", x: 250, y: 92, width: 250, height: 178 }]
    : focusedRegion === "九州・沖縄"
      ? [compact
          ? { title: "沖縄県", name: "沖縄県", x: 238, y: 366, width: 132, height: 62 }
          : { title: "沖縄県", name: "沖縄県", x: 774, y: 352, width: 180, height: 116 }]
      : focusedRegion
        ? []
        : insetNames;
  const transformCenter = focusedRegion
    ? { x: activeFocusFrame.x + activeFocusFrame.width / 2, y: activeFocusFrame.y + activeFocusFrame.height / 2 }
    : compact ? { x: 195, y: 244 } : { x: 520, y: 270 };
  const homeTransform = `translate(${transformCenter.x} ${transformCenter.y}) scale(${homeZoom}) translate(-${transformCenter.x} -${transformCenter.y})`;
  const labelScale = focusedRegion && focusedViewBox
    ? nationalFocusLabelScale(focusedViewBox, activeFocusFrame, compact ? 11 : 13)
    : 1;

  return (
    <svg
      id="national-prefecture-map"
      viewBox={viewBox}
      role="group"
      aria-label={focusedRegion
        ? `${focusedRegion}の都道府県別経費回収率区分マップ`
        : "全国の都道府県別経費回収率区分マップ"}
      className="gis-home-national-map h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      data-compact={compact ? "true" : "false"}
      data-focused-region={focusedRegion ?? "national"}
    >
      <rect width="100%" height="100%" fill="#ffffff" />
      <g key={focusedRegion ?? "national"} className="home-national-map-stage">
        <g transform={homeTransform} data-manual-zoom={manualZoom.toFixed(2)}>
          <AtlasRegionLayer
            features={renderedFeatures}
            frame={renderedFrame}
            summaryMap={summaryMap}
            byPrefecture={byPrefecture}
            activePrefectureCode={activePrefectureCode}
            showLabels={Boolean(focusedRegion)}
            labelScale={labelScale}
            onOpen={onOpen}
            onActivate={onActivate}
            onHover={onHover}
          />
        </g>
        {visibleInsets.map((inset) => {
          const feature = featureByPrefectureName.get(inset.name);
          return feature ? (
            <HomeInsetMap
              key={inset.title}
              title={inset.title}
              feature={feature}
              frame={inset}
              summaryMap={summaryMap}
              byPrefecture={byPrefecture}
              activePrefectureCode={activePrefectureCode}
              onOpen={onOpen}
              onActivate={onActivate}
              onHover={onHover}
            />
          ) : null;
        })}
      </g>
    </svg>
  );
}

function HomeInsetMap({
  title,
  feature,
  frame,
  summaryMap,
  byPrefecture,
  activePrefectureCode,
  onOpen,
  onActivate,
  onHover
}: {
  title: string;
  feature: GisFeature;
  frame: { x: number; y: number; width: number; height: number };
  summaryMap: Map<string, PrefectureSummary>;
  byPrefecture: Map<string, MapMunicipality[]>;
  activePrefectureCode: string | null;
  onOpen: (feature: GisFeature) => void;
  onActivate: (code: string | null) => void;
  onHover: (
    event: NationalHoverEvent,
    feature: GisFeature,
    summary: PrefectureSummary | undefined,
    featureMunicipalities: MapMunicipality[] | undefined
  ) => void;
}) {
  const displayName = displayPrefectureName(feature.name);
  const summary = summaryMap.get(displayName);
  const featureMunicipalities = byPrefecture.get(displayName);
  const recoveryRate = summary?.averageExpenseRecoveryRate
    ?? averageMetric(featureMunicipalities, (item) => item.expenseRecoveryRate);
  const diagnosisLabel = nationalRecoveryBandLabel(recoveryRate);
  const fillColor = atlasStatusColor(recoveryRate);
  const active = activePrefectureCode === feature.code;
  const displayPath = atlasDisplayPath(feature);
  const viewBox = screenViewBox([{ ...feature, path: displayPath }], 8);

  if (!viewBox) return null;

  return (
    <g className="home-map-inset">
      <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} rx="5" className="home-map-inset-frame" />
      <text x={frame.x + 10} y={frame.y + 18} className="home-map-inset-title">{title}</text>
      <svg
        x={frame.x + 10}
        y={frame.y + 24}
        width={frame.width - 20}
        height={frame.height - 32}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        overflow="hidden"
      >
        <g
          className={clsx("gis-region", active && "gis-region--active")}
          role="link"
          tabIndex={0}
          aria-label={`${displayName}の詳細マップへ。経費回収率${formatPercent(recoveryRate)}、${diagnosisLabel}`}
          onClick={() => onOpen(feature)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onOpen(feature);
          }}
          onFocus={() => onActivate(feature.code)}
          onBlur={() => onActivate(null)}
          onPointerEnter={(event) => {
            onActivate(feature.code);
            onHover(event, feature, summary, featureMunicipalities);
          }}
          onPointerMove={(event) => onHover(event, feature, summary, featureMunicipalities)}
          onMouseOver={(event) => {
            onActivate(feature.code);
            onHover(event, feature, summary, featureMunicipalities);
          }}
          onMouseMove={(event) => onHover(event, feature, summary, featureMunicipalities)}
        >
          <FlatPrefectureShape path={displayPath} fillColor={fillColor} inset />
        </g>
      </svg>
      <rect x={frame.x + frame.width - 21} y={frame.y + frame.height - 23} width="18" height="18" rx="3" className="home-map-inset-plus-bg" />
      <path d={`M${frame.x + frame.width - 12} ${frame.y + frame.height - 19}V${frame.y + frame.height - 9}M${frame.x + frame.width - 17} ${frame.y + frame.height - 14}H${frame.x + frame.width - 7}`} className="home-map-inset-plus" />
    </g>
  );
}

function AtlasRegionLayer({
  features,
  frame,
  summaryMap,
  byPrefecture,
  activePrefectureCode,
  showLabels = false,
  labelScale = 1,
  onOpen,
  onActivate,
  onHover
}: {
  features: GisFeature[];
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
    pad?: number;
    viewBox?: string;
    useOverviewPathBounds?: boolean;
  };
  summaryMap: Map<string, PrefectureSummary>;
  byPrefecture: Map<string, MapMunicipality[]>;
  activePrefectureCode: string | null;
  showLabels?: boolean;
  labelScale?: number;
  onOpen: (feature: GisFeature) => void;
  onActivate: (code: string | null) => void;
  onHover: (
    event: NationalHoverEvent,
    feature: GisFeature,
    summary: PrefectureSummary | undefined,
    featureMunicipalities: MapMunicipality[] | undefined
  ) => void;
}) {
  const viewBox = frame.viewBox ?? (
    frame.useOverviewPathBounds
      ? atlasOverviewScreenViewBox(features, frame.pad ?? 5)
      : screenViewBox(features, frame.pad ?? 5)
  );
  const displayPathMap = useMemo(() => {
    const paths = new Map<string, string>();
    for (const feature of features) {
      paths.set(feature.code, atlasDisplayPath(feature));
    }
    return paths;
  }, [features]);
  const labelOffsets = useMemo(
    () => showLabels && viewBox
      ? nationalFocusLabelOffsets(features, displayPathMap, viewBox, labelScale)
      : new Map<string, [number, number]>(),
    [displayPathMap, features, labelScale, showLabels, viewBox]
  );

  if (!viewBox || features.length === 0) return null;

  return (
    <svg
      x={frame.x}
      y={frame.y}
      width={frame.width}
      height={frame.height}
      viewBox={viewBox}
      className="gis-atlas-region-layer"
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
    >
      {features.map((feature) => {
        const displayName = displayPrefectureName(feature.name);
        const summary = summaryMap.get(displayName);
        const featureMunicipalities = byPrefecture.get(displayName);
        const count = summary?.municipalityCount ?? feature.municipalityCount ?? 0;
        const active = activePrefectureCode === feature.code;
        const recoveryRate = summary?.averageExpenseRecoveryRate
          ?? averageMetric(featureMunicipalities, (item) => item.expenseRecoveryRate);
        const diagnosisLabel = nationalRecoveryBandLabel(recoveryRate);
        const fillColor = atlasStatusColor(recoveryRate);
        const displayPath = displayPathMap.get(feature.code) ?? feature.path;

        return (
          <g
            key={feature.code}
            className={clsx("gis-region", active && "gis-region--active")}
            role="link"
            tabIndex={active || (!activePrefectureCode && feature.code === features[0]?.code) ? 0 : -1}
            data-map-region-code={feature.code}
            aria-label={`${displayName}: ${count.toLocaleString("ja-JP")}市区町村、経費回収率${formatPercent(recoveryRate)}、${diagnosisLabel}`}
            onClick={() => onOpen(feature)}
            onKeyDown={(event) => {
              handleAtlasRegionKey(event, feature, onOpen);
            }}
            onFocus={() => onActivate(feature.code)}
            onBlur={() => onActivate(null)}
            onPointerEnter={(event) => {
              onActivate(feature.code);
              onHover(event, feature, summary, featureMunicipalities);
            }}
            onPointerOver={(event) => {
              onActivate(feature.code);
              onHover(event, feature, summary, featureMunicipalities);
            }}
            onPointerMove={(event) => onHover(event, feature, summary, featureMunicipalities)}
            onMouseOver={(event) => {
              onActivate(feature.code);
              onHover(event, feature, summary, featureMunicipalities);
            }}
            onMouseMove={(event) => onHover(event, feature, summary, featureMunicipalities)}
          >
            <FlatPrefectureShape path={displayPath} fillColor={fillColor} />
          </g>
        );
      })}
      {showLabels ? features.map((feature) => (
        <MapFeatureLabel
          key={`label-${feature.code}`}
          feature={feature}
          scope="national"
          active={activePrefectureCode === feature.code}
          labelScale={labelScale}
          labelOffset={labelOffsets.get(feature.code)}
          displayPath={displayPathMap.get(feature.code)}
        />
      )) : null}
    </svg>
  );
}

function FlatPrefectureShape({
  path,
  fillColor,
  inset = false
}: {
  path: string;
  fillColor: string;
  inset?: boolean;
}) {
  return (
    <>
      <path
        d={path}
        fill={fillColor}
        fillRule="nonzero"
        stroke="#263744"
        strokeOpacity={0.48}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
        className="gis-prefecture-silhouette"
        style={{ "--region-fill": fillColor } as CSSProperties}
        pointerEvents="none"
        paintOrder="stroke fill"
        shapeRendering="geometricPrecision"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path}
        fill={fillColor}
        fillRule="nonzero"
        stroke={fillColor}
        strokeOpacity={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.7}
        className={clsx("gis-shape", inset ? "gis-shape--home-inset" : "gis-shape--national")}
        style={{ "--region-fill": fillColor } as CSSProperties}
        paintOrder="stroke fill"
        shapeRendering="geometricPrecision"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

function PrefectureSelectorPanel({
  summaries,
  activeRegion,
  onRegionChange
}: {
  summaries: PrefectureSummary[];
  activeRegion: RegionName | null;
  onRegionChange: (region: RegionName) => void;
}) {
  const [query, setQuery] = useState("");
  const summaryByName = useMemo(
    () => new Map(summaries.map((summary) => [displayPrefectureName(summary.prefectureName), summary])),
    [summaries]
  );
  const normalizedQuery = query.trim();
  const visibleRegions = useMemo(
    () => normalizedQuery || !activeRegion
      ? regionNames
      : [activeRegion, ...regionNames.filter((region) => region !== activeRegion)],
    [activeRegion, normalizedQuery]
  );

  return (
    <aside className="panel prefecture-selector-panel grid content-start gap-4 p-4">
      <div className="prefecture-selector-heading">
        <h2>都道府県を選択</h2>
        <InfoDisclosure label="都道府県選択の使い方">
          地域タブまたは名称検索から県別マップへ移動できます。
        </InfoDisclosure>
      </div>
      <label className="prefecture-search-field">
        <span className="sr-only">都道府県名を入力</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input-control"
          placeholder="都道府県名を入力"
        />
        <Search size={18} aria-hidden="true" />
      </label>
      <div className="prefecture-region-tabs" role="group" aria-label="地図の表示地域">
        {regionNames.map((region) => (
          <button
            key={region}
            type="button"
            onClick={() => onRegionChange(region)}
            className={region === activeRegion ? "is-active" : undefined}
            aria-pressed={region === activeRegion}
            aria-controls="national-prefecture-map"
          >
            {region}
          </button>
        ))}
      </div>
      <div className="prefecture-region-list">
        {visibleRegions.map((region) => {
          const rows = prefecturesByRegion(region).filter((prefecture) => !normalizedQuery || prefecture.name.includes(normalizedQuery));
          if (rows.length === 0) return null;
          return (
            <section
              key={region}
              className={clsx("prefecture-region-block", region === activeRegion ? "is-active" : undefined)}
            >
              <h3>{region}</h3>
              <div className="prefecture-button-grid">
                {rows.map((prefecture) => {
                  const summary = summaryByName.get(prefecture.name);
                  return (
                    <Link
                      key={prefecture.code}
                      href={`/map/${prefecture.code}`}
                      className="prefecture-button"
                      aria-label={`${prefecture.name}${summary?.municipalityCount != null ? `（${summary.municipalityCount.toLocaleString("ja-JP")}自治体）` : ""}の詳細マップへ`}
                    >
                      <span>{prefecture.name}</span>
                      <span className="prefecture-button-meta">
                        <ChevronRight size={13} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <Link href="/municipalities" className="prefecture-all-link">
        すべての都道府県を一覧で見る
        <ListFilter size={17} />
      </Link>
    </aside>
  );
}

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
  const [data, setData] = useState<GisData | null>(null);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "city" | "town" | "village">("all");
  const [sort, setSort] = useState("recovery-desc");
  const prefectureName = getPrefectureName(prefectureCode) ?? municipalities[0]?.prefectureName ?? "都道府県";

  useGisData(setData, setError);

  const summary = summaries.find((item) => item.prefectureName === prefectureName);
  const municipalityLookup = useMemo(
    () => new Map(municipalities.map((item) => [`${item.prefectureName}::${item.municipalityName}`, item])),
    [municipalities]
  );
  const selectedGisMunicipalities = data?.municipalitiesByPrefecture[prefectureCode] ?? [];
  const localScreenViewBox = useMemo(
    () => (selectedGisMunicipalities.length > 0 ? screenViewBox(selectedGisMunicipalities, 24) : null),
    [selectedGisMunicipalities]
  );
  const rows = useMemo(() => {
    const normalizedQuery = query.trim();
    return municipalities
      .filter((item) => !normalizedQuery || item.municipalityName.includes(normalizedQuery) || item.municipalityNameKana?.includes(normalizedQuery))
      .filter((item) => {
        if (kind === "city") return item.municipalityName.endsWith("市") || item.municipalityName.endsWith("区");
        if (kind === "town") return item.municipalityName.endsWith("町");
        if (kind === "village") return item.municipalityName.endsWith("村");
        return true;
      })
      .sort((a, b) => sortMunicipalities(a, b, sort));
  }, [kind, municipalities, query, sort]);
  const selectedRow = selectedCode ? rows.find((item) => item.municipalityCode === selectedCode) ?? null : null;

  function openMunicipality(feature: GisFeature) {
    const match = municipalityLookup.get(`${prefectureName}::${feature.name}`);
    if (match?.municipalityCode) {
      router.push(municipalityHref(match));
      return;
    }
    router.push(`/municipalities?prefecture=${encodeURIComponent(prefectureName)}&q=${encodeURIComponent(feature.name)}`);
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="panel overflow-hidden p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <MapLegend compact />
            <div className="flex gap-2">
              <button type="button" className="button-secondary">
                <LocateFixed size={16} />
                全域表示
              </button>
            </div>
          </div>
          <div className="gis-map-surface gis-map-surface--prefecture relative min-h-[600px] overflow-hidden rounded-md border border-line bg-white" onMouseLeave={() => setHover(null)}>
            {!data && !error ? <LoadingMap label={`${prefectureName}の地図を読み込み中`} /> : null}
            {error ? <FallbackMunicipalityList municipalities={municipalities} /> : null}
            {data ? (
              <svg
                  viewBox={localScreenViewBox ?? `0 0 ${data.viewBox.width} ${data.viewBox.height}`}
                  role="img"
                  aria-label={`${prefectureName}の市区町村別経費回収率区分マップ`}
                  className="h-full min-h-[600px] w-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                <rect width={data.viewBox.width} height={data.viewBox.height} fill="transparent" />
                {selectedGisMunicipalities.map((feature) => {
                  const match = municipalityLookup.get(`${prefectureName}::${feature.name}`);
                  const label = match?.feeAdequacyLabel ?? labelFromMetrics(
                    match?.expenseRecoveryRate,
                    match?.feeUnitPriceYenPerM3
                  );
                  const active = selectedCode && selectedCode === match?.municipalityCode;
                  return (
                    <g
                      key={`${feature.code}-${feature.name}`}
                      className={clsx("gis-region", active && "gis-region--active")}
                      role="link"
                      tabIndex={0}
                      onClick={() => openMunicipality(feature)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") openMunicipality(feature);
                      }}
                      onFocus={() => setSelectedCode(match?.municipalityCode ?? null)}
                      onMouseEnter={(event) => {
                        setSelectedCode(match?.municipalityCode ?? null);
                        setHoverFromEvent(event, feature, summary, match ? [match] : undefined, setHover);
                      }}
                      onMouseMove={(event) => setHoverFromEvent(event, feature, summary, match ? [match] : undefined, setHover)}
                    >
                      <title>{match ? `${feature.name}を開く` : `${feature.name}で検索`}</title>
                      <path
                        d={feature.path}
                        fill={statusColors[label] ?? statusColors["データなし・対象外"]}
                        fillRule="evenodd"
                        stroke="#ffffff"
                        strokeLinejoin="round"
                        strokeWidth={active ? 2.4 : 1}
                        className="gis-shape"
                        vectorEffect="non-scaling-stroke"
                      />
                      <MapFeatureLabel
                        feature={feature}
                        scope="municipality"
                        active={Boolean(active)}
                      />
                    </g>
                  );
                })}
              </svg>
            ) : null}
            {hover ? <MapHoverCard hover={hover} /> : null}
            {selectedRow ? (
              <Link href={municipalityHref(selectedRow)} className="button-primary absolute bottom-4 right-4">
                {selectedRow.municipalityName}の詳細を見る
                <ExternalLink size={15} />
              </Link>
            ) : null}
          </div>
        </div>

        <aside className="panel grid content-start gap-4 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-ink">市区町村を絞り込む</h2>
              <p className="mt-1 text-sm font-medium leading-6 text-muted">
                地図または一覧から自治体詳細へ移動できます。
              </p>
            </div>
            <Link href="/map" className="button-secondary min-h-9 px-3">
              全国へ
            </Link>
          </div>
          <label className="relative block">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-ink" size={18} aria-hidden="true" />
            <span className="sr-only">市区町村名で検索</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input-control pr-10"
              placeholder="市区町村名を入力"
            />
          </label>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="input-control">
            <option value="recovery-desc">経費回収率（高い順）</option>
            <option value="recovery-asc">経費回収率（低い順）</option>
            <option value="revision-desc">使用料収入の必要増加率（高い順）</option>
            <option value="name">自治体コード順</option>
          </select>
          <div className="grid grid-cols-4 gap-2">
            {[
              ["all", `すべて (${municipalities.length})`],
              ["city", `市 (${municipalities.filter((item) => item.municipalityName.endsWith("市") || item.municipalityName.endsWith("区")).length})`],
              ["town", `町 (${municipalities.filter((item) => item.municipalityName.endsWith("町")).length})`],
              ["village", `村 (${municipalities.filter((item) => item.municipalityName.endsWith("村")).length})`]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value as typeof kind)}
                className={clsx(
                  "min-h-10 rounded-md text-sm font-black",
                  kind === value ? "bg-teal text-white" : "border border-line bg-panel text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-[360px] overflow-auto rounded-md border border-line">
            <table className="data-table min-w-[500px]">
              <thead>
                <tr>
                  <th>市区町村名</th>
                  <th>経費回収率</th>
                  <th>経費回収率区分</th>
                  <th>公式改定情報</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr
                    key={item.municipalityCode ?? `${item.prefectureName}-${item.municipalityName}`}
                    className={selectedCode === item.municipalityCode ? "bg-teal/10" : undefined}
                    onMouseEnter={() => setSelectedCode(item.municipalityCode)}
                    onFocus={() => setSelectedCode(item.municipalityCode)}
                  >
                    <td>
                      <Link href={municipalityHref(item)} className="inline-flex items-center gap-2 font-black text-ink hover:text-teal">
                        {item.municipalityName}
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                    <td>{formatPercent(item.expenseRecoveryRate)}</td>
                    <td><Badge>{item.feeAdequacyLabel ?? labelFromMetrics(item.expenseRecoveryRate, item.feeUnitPriceYenPerM3)}</Badge></td>
                    <td>{item.hasRevisionEvent ? <Badge>登録あり</Badge> : "未登録"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href={`/municipalities?prefecture=${encodeURIComponent(prefectureName)}`} className="button-secondary w-full">
            地図の表示範囲内を表示する
            <Table2 size={16} />
          </Link>
        </aside>
      </div>

      <div className="panel overflow-hidden p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-ink">市区町村の詳細一覧（表示件数: 上位10件）</h2>
          <Link href={`/data/static/csv/prefectures/${getPrefectureCode(prefectureName)}.csv`} className="inline-flex items-center gap-2 text-sm font-black text-teal hover:underline">
            一覧をCSVでダウンロード
            <Download size={16} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1100px]">
            <thead>
              <tr>
                <th>順位</th>
                <th>市区町村名（事業種別）</th>
                <th>経費回収率</th>
                <th>使用料単価</th>
                <th>汚水処理原価</th>
                <th>使用料収入の必要増加率</th>
                <th>公式改定情報</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((item, index) => (
                <tr key={`${item.municipalityCode}-${index}`}>
                  <td>{index + 1}</td>
                  <td>
                    <Link href={municipalityHref(item)} className="font-black text-ink hover:text-teal">
                      {item.municipalityName} <span className="text-xs text-muted">（{displayBusinessName(item)}・{accountingTypeLabel(item.accountingType)}{item.accountingType === "non_legal_applied" ? "・参考" : ""}）</span>
                    </Link>
                  </td>
                  <td>{formatPercent(item.expenseRecoveryRate)} <Badge>{item.feeAdequacyLabel ?? labelFromMetrics(item.expenseRecoveryRate, item.feeUnitPriceYenPerM3)}</Badge></td>
                  <td>{formatYenPerM3(item.feeUnitPriceYenPerM3)}</td>
                  <td>{formatYenPerM3(item.treatmentCostYenPerM3)}</td>
                  <td>{formatRevisionRate(item.requiredRevisionRateTo100)}</td>
                  <td>{item.hasRevisionEvent ? "登録あり" : "未登録"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <div className="p-6 text-sm font-bold text-muted">条件に一致する市区町村はありません。</div> : null}
      </div>
    </section>
  );
}

function useGisData(setData: (data: GisData) => void, setError: (value: boolean) => void) {
  useEffect(() => {
    let cancelled = false;
    fetch("/gis/mlit-n03-simplified.json")
      .then((response) => {
        if (!response.ok) throw new Error("GIS data unavailable");
        return response.json();
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
  }, [setData, setError]);
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function MapLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-2 text-xs" : "grid content-start gap-3"}>
      <div className="flex items-center gap-2 text-sm font-black text-ink">
        経費回収率（%）
        <Info size={15} className="text-teal" />
      </div>
      <div className={compact ? "grid gap-1.5" : "grid gap-2"}>
        {nationalRecoveryLegend.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="status-swatch" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoDisclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="info-disclosure">
      <summary aria-label={label} title={label}>
        <Info size={17} aria-hidden="true" />
      </summary>
      <div role="note">{children}</div>
    </details>
  );
}

function MapFeatureLabel({
  feature,
  scope,
  projectionBounds,
  active = false,
  labelScale = 1,
  labelOffset,
  displayPath,
  hidden = false
}: {
  feature: GisFeature;
  scope: "national" | "municipality";
  projectionBounds?: Bounds | null;
  active?: boolean;
  labelScale?: number;
  labelOffset?: [number, number];
  displayPath?: string;
  hidden?: boolean;
}) {
  if (hidden) return null;
  const point = featureLabelPoint(feature, projectionBounds, displayPath);
  if (!point) return null;
  const labelPoint: [number, number] = labelOffset ? [point[0] + labelOffset[0], point[1] + labelOffset[1]] : point;
  const displayName = displayPrefectureName(feature.name);
  const lines = feature.labelLines?.length ? feature.labelLines.map(displayPrefectureName) : splitMapLabel(displayName, scope);
  const fontSize = (feature.labelSize ?? labelFontSize(feature, scope)) * labelScale;
  const lineHeight = fontSize * 1.12;
  const startY = labelPoint[1] - ((lines.length - 1) * lineHeight) / 2;
  const anchor = feature.labelAnchor ?? "middle";

  return (
    <>
      {feature.callout ? (
        <line
          x1={feature.callout.from[0]}
          y1={feature.callout.from[1]}
          x2={feature.callout.to[0]}
          y2={feature.callout.to[1]}
          className={clsx("gis-callout-line", active && "gis-callout-line--active")}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <text
        x={labelPoint[0]}
        y={startY}
        className={clsx("gis-map-label", active && "gis-map-label--active")}
        data-map-label={scope}
        data-feature-code={feature.code}
        fontSize={fontSize}
        textAnchor={anchor}
        aria-hidden="true"
      >
        {lines.map((line, index) => (
          <tspan key={`${feature.code}-${line}-${index}`} x={labelPoint[0]} dy={index === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </>
  );
}

function RankingMini({
  title,
  href,
  items,
  mode
}: {
  title: string;
  href: string;
  items: MapMunicipality[];
  mode: "low" | "revision";
}) {
  const rows = [...items]
    .filter((item) => mode === "low" ? item.expenseRecoveryRate != null : item.requiredRevisionRateTo100 != null)
    .sort((a, b) => {
      if (mode === "low") return nullsLast(a.expenseRecoveryRate, b.expenseRecoveryRate, "asc");
      return nullsLast(a.requiredRevisionRateTo100, b.requiredRevisionRateTo100, "desc");
    })
    .slice(0, 5);

  return (
    <section className="panel overflow-hidden p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-ink">{title}</h2>
        <Link href={href} className="text-xs font-black text-ink hover:text-teal">もっと見る →</Link>
      </div>
      {rows.length > 0 ? (
        <table className="data-table">
          <tbody>
            {rows.map((item, index) => (
              <tr key={`${title}-${item.municipalityCode}-${index}`}>
                <td className="w-10 font-black">{index + 1}</td>
                <td>
                  <Link href={municipalityHref(item)} className="font-black text-ink hover:text-teal">
                    {item.prefectureName} {item.municipalityName}
                  </Link>
                </td>
                <td className={mode === "low" ? "text-danger" : "text-danger"}>
                  {mode === "low" ? formatPercent(item.expenseRecoveryRate) : formatRevisionRate(item.requiredRevisionRateTo100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="rounded-md bg-panel p-4 text-sm font-bold text-muted">ランキング表示用のデータは未登録です。</p>
      )}
    </section>
  );
}

function RankingPair({ items }: { items: MapMunicipality[] }) {
  const highRows = [...items]
    .filter((item) => item.expenseRecoveryRate != null)
    .sort((a, b) => nullsLast(a.expenseRecoveryRate, b.expenseRecoveryRate, "desc"))
    .slice(0, 5);
  const lowRows = [...items]
    .filter((item) => item.expenseRecoveryRate != null)
    .sort((a, b) => nullsLast(a.expenseRecoveryRate, b.expenseRecoveryRate, "asc"))
    .slice(0, 5);

  return (
    <section className="panel home-ranking-panel overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2>使用料水準ランキング（経費回収率）</h2>
          <InfoDisclosure label="ランキングの算出条件">
            流域下水道を除き、複数事業がある市区町村は最新年度のうち診断上の注意度が最も高い1事業を掲載します。合算値ではありません。法非適用は共通定義の料金指標のみ参考比較します。
          </InfoDisclosure>
        </div>
        <Link href="/rankings/expense-recovery-low" className="text-xs font-black text-ink hover:text-teal">もっと見る →</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <RankingList title="高い自治体 TOP5" rows={highRows} tone="high" />
        <RankingList title="低い自治体 TOP5" rows={lowRows} tone="low" />
      </div>
      {items.some((item) => item.accountingType === "non_legal_applied") ? (
        <p className="mt-2 text-[10px] font-bold text-muted">※法非適用は料金指標のみ参考比較</p>
      ) : null}
    </section>
  );
}

function RankingList({
  title,
  rows,
  tone
}: {
  title: string;
  rows: MapMunicipality[];
  tone: "high" | "low";
}) {
  return (
    <div className={clsx("home-ranking-list", tone === "high" ? "home-ranking-list--high" : "home-ranking-list--low")}>
      <div className="home-ranking-list-title">{title}</div>
      <table>
        <caption className="sr-only">{title}。順位、自治体、経費回収率</caption>
        <thead className="sr-only">
          <tr><th scope="col">順位</th><th scope="col">自治体</th><th scope="col">経費回収率</th></tr>
        </thead>
        <tbody>
          {rows.map((item, index) => {
            const href = municipalityHref(item);
            return (
              <tr key={`${tone}-${item.municipalityCode}-${index}`}>
                <td>
                  <span>{index + 1}</span>
                </td>
                <td><Link href={href} className="home-ranking-row-link" title={`${item.prefectureName} ${item.municipalityName}`}>{item.prefectureName} {item.municipalityName}{item.accountingType === "non_legal_applied" ? "※" : ""}</Link></td>
                <td>{formatPercent(item.expenseRecoveryRate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HowToCards() {
  const cards = [
    { title: "全国の状況を把握する", text: "全国マップで、都道府県ごとの経費回収率区分をひと目で確認できます。", href: "/map", icon: MapIcon },
    { title: "自治体を探す", text: "キーワードや条件で自治体を検索し、指標や年度別推移を比較できます。", href: "/municipalities", icon: Search },
    { title: "ランキングで比較する", text: "経費回収率や使用料単価から、他自治体との位置づけを比較できます。", href: "/rankings", icon: ChartNoAxesColumnIncreasing },
    { title: "公式改定情報を確認する", text: "使用料改定について登録した公式公表情報と原資料を確認できます。", href: "/revisions", icon: CalendarDays }
  ];
  return (
    <section className="panel p-4">
      <h2 className="text-base font-black text-ink">本サイトの使い方</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="rounded-md border border-line bg-white p-3 text-center hover:border-teal hover:bg-teal/5">
              <Icon className="mx-auto text-teal" size={34} />
              <div className="mt-2 font-black text-teal">{card.title}</div>
              <p className="mt-2 text-xs font-medium leading-5 text-slate-600">{card.text}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function LoadingMap({ label }: { label: string }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center text-sm font-black text-muted">
      <Loader2 className="mr-2 animate-spin" size={18} />
      {label}
    </div>
  );
}

function FallbackPrefectureList({ summaries }: { summaries: PrefectureSummary[] }) {
  return (
    <div className="grid gap-2 p-4 sm:grid-cols-2">
      {summaries.map((summary) => {
        const code = getPrefectureCode(summary.prefectureName);
        return (
          <Link
            key={summary.prefectureName}
            href={code ? `/map/${code}` : `/municipalities?prefecture=${encodeURIComponent(summary.prefectureName)}`}
            className="flex min-h-11 items-center justify-between rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink"
          >
            <span>{summary.prefectureName}</span>
            <span className="text-xs text-muted">{summary.municipalityCount}</span>
          </Link>
        );
      })}
    </div>
  );
}

function FallbackMunicipalityList({ municipalities }: { municipalities: MapMunicipality[] }) {
  return (
    <div className="grid gap-2 p-4 sm:grid-cols-2">
      {municipalities.map((item) => (
        <Link
          key={item.municipalityCode ?? `${item.prefectureName}-${item.municipalityName}`}
          href={municipalityHref(item)}
          className="flex min-h-11 items-center justify-between rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink"
        >
          <span>{item.municipalityName}</span>
          <span className="text-xs text-muted">{formatPercent(item.expenseRecoveryRate)}</span>
        </Link>
      ))}
    </div>
  );
}

type HoverState = {
  code: string;
  href: string;
  title: string;
  label: string;
  recovery: string;
  feeUnit: string;
  revision: string;
  basis: string;
  x: number;
  y: number;
};

function MapHoverCard({
  hover,
  showDetailLink = true
}: {
  hover: HoverState;
  showDetailLink?: boolean;
}) {
  return (
    <div
      className="map-tooltip absolute z-20 min-w-[220px] p-4"
      data-passive={!showDetailLink || undefined}
      style={{
        left: `min(calc(100% - 236px), ${hover.x + 16}px)`,
        top: `max(12px, ${hover.y - 96}px)`
      }}
    >
      <div className="flex items-center gap-2">
        <div className="text-lg font-black">{hover.title}</div>
        <span className="rounded bg-yellow-200 px-2 py-0.5 text-xs font-black text-ink">{hover.label}</span>
      </div>
      <div className="mt-3 grid gap-2 text-xs font-bold">
        <div className="flex justify-between gap-3"><span>経費回収率（全体）</span><span>{hover.recovery}</span></div>
        <div className="flex justify-between gap-3"><span>使用料単価</span><span>{hover.feeUnit}</span></div>
        <div className="flex justify-between gap-3"><span>会計方式</span><span className="text-right">{hover.basis}</span></div>
        <div className="flex justify-between gap-3"><span>公式改定情報</span><span>{hover.revision}</span></div>
      </div>
      {showDetailLink ? (
        <Link href={hover.href} className="map-tooltip-cta" aria-label={`${hover.title}の詳細を見る`}>
          詳細を見る
          <ExternalLink size={13} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function setHoverFromEvent(
  event: MouseEvent<SVGGElement>,
  feature: GisFeature,
  summary: PrefectureSummary | undefined,
  municipalities: MapMunicipality[] | undefined,
  setHover: (state: HoverState) => void
) {
  setHover(hoverStateFromEvent(event, feature, summary, municipalities));
}

function hoverStateFromEvent(
  event: MouseEvent<SVGGElement | HTMLAnchorElement> | PointerEvent<SVGGElement | HTMLAnchorElement>,
  feature: GisFeature,
  summary: PrefectureSummary | undefined,
  municipalities: MapMunicipality[] | undefined,
  container?: HTMLElement | SVGSVGElement | null
): HoverState {
  const ownerSvg = "ownerSVGElement" in event.currentTarget ? event.currentTarget.ownerSVGElement : null;
  const rect = (container ?? ownerSvg ?? event.currentTarget).getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const first = municipalities?.[0];
  const isMunicipalityFeature = Boolean(feature.prefectureCode);
  const recovery = isMunicipalityFeature
    ? first?.expenseRecoveryRate ?? null
    : summary?.averageExpenseRecoveryRate ?? averageMetric(municipalities, (item) => item.expenseRecoveryRate);
  const averageFee = averageMetric(municipalities, (item) => item.feeUnitPriceYenPerM3);
  const feeUnit = averageFee ?? first?.feeUnitPriceYenPerM3 ?? null;
  const label = nationalRecoveryBandLabel(recovery);
  const revisionCount = summary?.revisionEventCount ?? municipalities?.filter((item) => item.hasRevisionEvent).length ?? 0;
  const href = mapFeatureHref(feature, municipalities);
  return {
    code: feature.code,
    href,
    title: displayPrefectureName(feature.name),
    label,
    recovery: formatPercent(recovery),
    feeUnit: formatYenPerM3(feeUnit),
    revision: revisionCount > 0 ? `${revisionCount.toLocaleString("ja-JP")}件` : "—",
    basis: isMunicipalityFeature
      ? `${accountingTypeLabel(first?.accountingType)}${first?.accountingType === "non_legal_applied" ? "・料金指標は参考" : ""}`
      : "法非適用を含む参考平均",
    x,
    y
  };
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

function handleAtlasRegionKey(
  event: KeyboardEvent<SVGGElement>,
  feature: GisFeature,
  onOpen: (feature: GisFeature) => void
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onOpen(feature);
    return;
  }

  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
  const regionNodes = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<SVGGElement>("[data-map-region-code]") ?? []
  );
  if (regionNodes.length < 2) return;

  event.preventDefault();
  const currentIndex = regionNodes.indexOf(event.currentTarget);
  const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  const nextIndex = (currentIndex + direction + regionNodes.length) % regionNodes.length;
  regionNodes[nextIndex]?.focus();
}

function isNationalMainMapFeature(feature: GisFeature) {
  return !feature.layoutGroup || feature.layoutGroup === "main";
}

function atlasOverviewScreenViewBox(features: GisFeature[], pad = 5) {
  const bounds = features
    .map((feature) => pathScreenBounds(atlasDisplayPath(feature)))
    .filter((value): value is Bounds => Boolean(value));
  if (bounds.length === 0) return null;
  const [minX, minY, maxX, maxY] = bounds.reduce<Bounds>((acc, value) => [
    Math.min(acc[0], value[0]),
    Math.min(acc[1], value[1]),
    Math.max(acc[2], value[2]),
    Math.max(acc[3], value[3])
  ], [Infinity, Infinity, -Infinity, -Infinity]);
  return `${Math.max(minX - pad, 0)} ${Math.max(minY - pad, 0)} ${Math.max(maxX - minX + pad * 2, 1)} ${Math.max(maxY - minY + pad * 2, 1)}`;
}

function nationalFocusLabelScale(
  viewBox: string,
  frame: { width: number; height: number },
  targetPixels: number
) {
  const [, , width, height] = viewBox.trim().split(/\s+/).map(Number);
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) return 1;
  const screenScale = Math.min(frame.width / width, frame.height / height);
  if (!Number.isFinite(screenScale) || screenScale <= 0) return 1;
  return clamp(targetPixels / (8.2 * screenScale), 0.16, 1.15);
}

function nationalFocusLabelOffsets(
  features: GisFeature[],
  displayPathMap: Map<string, string>,
  viewBox: string,
  labelScale: number
) {
  const [viewX, viewY, viewWidth, viewHeight] = viewBox.trim().split(/\s+/).map(Number);
  if (![viewX, viewY, viewWidth, viewHeight].every(Number.isFinite)) {
    return new Map<string, [number, number]>();
  }

  const placed: Bounds[] = [];
  const offsets = new Map<string, [number, number]>();
  const orderedFeatures = [...features].sort((a, b) => {
    const pointA = featureLabelPoint(a, undefined, displayPathMap.get(a.code)) ?? [0, 0];
    const pointB = featureLabelPoint(b, undefined, displayPathMap.get(b.code)) ?? [0, 0];
    return pointA[1] - pointB[1] || pointA[0] - pointB[0];
  });

  for (const feature of orderedFeatures) {
    const displayPath = displayPathMap.get(feature.code) ?? feature.path;
    const point = featureLabelPoint(feature, undefined, displayPath);
    if (!point) continue;
    const lines = feature.labelLines?.length
      ? feature.labelLines.map(displayPrefectureName)
      : splitMapLabel(displayPrefectureName(feature.name), "national");
    const fontSize = (feature.labelSize ?? labelFontSize(feature, "national")) * labelScale;
    const width = Math.max(...lines.map((line) => line.length), 1) * fontSize * 0.96 + fontSize * 0.9;
    const height = Math.max(lines.length, 1) * fontSize * 1.12 + fontSize * 0.5;
    const stepX = Math.max(width * 0.78, fontSize * 2.2);
    const stepY = Math.max(height * 0.92, fontSize * 1.9);
    const margin = fontSize * 0.42;
    const candidates: [number, number][] = [[0, 0]];

    for (let ring = 1; ring <= 3; ring += 1) {
      for (let y = -ring; y <= ring; y += 1) {
        for (let x = -ring; x <= ring; x += 1) {
          if (Math.max(Math.abs(x), Math.abs(y)) !== ring) continue;
          candidates.push([x * stepX, y * stepY]);
        }
      }
    }
    candidates.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));

    const viable = candidates.map(([offsetX, offsetY]) => {
      const centerX = point[0] + offsetX;
      const centerY = point[1] + offsetY;
      const rect: Bounds = [
        centerX - width / 2,
        centerY - height / 2,
        centerX + width / 2,
        centerY + height / 2
      ];
      const inside = rect[0] >= viewX + margin
        && rect[1] >= viewY + margin
        && rect[2] <= viewX + viewWidth - margin
        && rect[3] <= viewY + viewHeight - margin;
      const overlap = placed.reduce((total, other) => total + labelOverlapArea(rect, other, margin), 0);
      return { offset: [offsetX, offsetY] as [number, number], rect, inside, overlap };
    }).filter((candidate) => candidate.inside);
    const selected = viable.find((candidate) => candidate.overlap === 0)
      ?? viable.sort((a, b) => a.overlap - b.overlap)[0];

    if (!selected) continue;
    offsets.set(feature.code, selected.offset);
    placed.push(selected.rect);
  }

  return offsets;
}

function labelOverlapArea(a: Bounds, b: Bounds, gap: number) {
  const width = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]) + gap);
  const height = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]) + gap);
  return width * height;
}

function atlasStatusColor(
  recoveryRate: number | null | undefined
) {
  return nationalRecoveryColors[nationalRecoveryBand(recoveryRate)]
    ?? nationalRecoveryColors["データなし・対象外"];
}

function nationalRecoveryBand(recoveryRate: number | null | undefined) {
  if (recoveryRate == null || !Number.isFinite(recoveryRate)) return "データなし・対象外";
  if (recoveryRate >= 100) return "100%以上";
  if (recoveryRate >= 90) return "90%以上100%未満";
  if (recoveryRate >= 80) return "80%以上90%未満";
  return "80%未満";
}

function nationalRecoveryBandLabel(recoveryRate: number | null | undefined) {
  const band = nationalRecoveryBand(recoveryRate);
  return band === "データなし・対象外" ? band : `経費回収率${band}`;
}

function groupMunicipalitiesByPrefecture(items: MapMunicipality[]) {
  const map = new Map<string, MapMunicipality[]>();
  for (const item of items) {
    const key = displayPrefectureName(item.prefectureName);
    const rows = map.get(key) ?? [];
    rows.push(item);
    map.set(key, rows);
  }
  return map;
}

function displayPrefectureName(name: string) {
  return normalizePrefectureName(name);
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

function averageMetric<T>(items: T[] | undefined, selector: (item: T) => number | null | undefined) {
  const values = (items ?? [])
    .map(selector)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortMunicipalities(a: MapMunicipality, b: MapMunicipality, sort: string) {
  if (sort === "recovery-asc") return nullsLast(a.expenseRecoveryRate, b.expenseRecoveryRate, "asc");
  if (sort === "revision-desc") return nullsLast(a.requiredRevisionRateTo100, b.requiredRevisionRateTo100, "desc");
  if (sort === "name") return (a.municipalityCode ?? "").localeCompare(b.municipalityCode ?? "", "ja");
  return nullsLast(a.expenseRecoveryRate, b.expenseRecoveryRate, "desc");
}

function nullsLast(a: number | null | undefined, b: number | null | undefined, direction: "asc" | "desc") {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

function featureLabelPoint(feature: GisFeature, projectionBounds?: Bounds | null, displayPath?: string): [number, number] | null {
  if (feature.labelPoint) return feature.labelPoint;
  if (feature.centroid && projectionBounds) {
    return projectGeoPoint(feature.centroid, projectionBounds);
  }
  const bounds = pathScreenBounds(displayPath ?? feature.path);
  if (!bounds) return null;
  return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
}

function projectGeoPoint(point: [number, number], bounds: Bounds): [number, number] {
  const [lon, lat] = point;
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const lonSpan = Math.max(maxLon - minLon, 0.001);
  const latSpan = Math.max(maxLat - minLat, 0.001);
  const scale = Math.min((GIS_WIDTH - GIS_PAD * 2) / lonSpan, (GIS_HEIGHT - GIS_PAD * 2) / latSpan);
  const offsetX = (GIS_WIDTH - lonSpan * scale) / 2;
  const offsetY = (GIS_HEIGHT - latSpan * scale) / 2;
  return [
    offsetX + (lon - minLon) * scale,
    offsetY + (maxLat - lat) * scale
  ];
}

function splitMapLabel(name: string, scope: "national" | "municipality") {
  if (scope !== "municipality" || name.length <= 4) return [name];
  const suffix = name.match(/^(.+)(市|町|村|区)$/);
  if (suffix && suffix[1].length >= 3 && name.length <= 7) {
    return [suffix[1], suffix[2]];
  }
  const splitAt = Math.ceil(name.length / 2);
  return [name.slice(0, splitAt), name.slice(splitAt)];
}

function labelFontSize(feature: GisFeature, scope: "national" | "municipality") {
  const bounds = pathScreenBounds(feature.path);
  if (!bounds) return scope === "municipality" ? 9 : 12;
  const width = Math.max(bounds[2] - bounds[0], 1);
  const height = Math.max(bounds[3] - bounds[1], 1);
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  if (scope === "national") {
    if (shortSide < 12 || longSide < 24) return 6.4;
    if (shortSide < 26 || feature.name.length >= 4) return 7.4;
    if (longSide > 120 && shortSide > 70) return 9.4;
    return 8.2;
  }
  if (shortSide < 12 || longSide < 18) return 6.4;
  if (shortSide < 18 || longSide < 30) return 7.2;
  if (feature.name.length >= 6) return 8;
  if (feature.name.length >= 5) return 8.8;
  return 10;
}
