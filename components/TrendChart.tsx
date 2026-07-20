"use client";

import React, { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { formatPercent, formatSettlementFiscalLabel, formatVolume, formatYenPerM3 } from "@/lib/format";

export type TrendPoint = {
  year: number;
  fiscalYearLabel?: string | null;
  accountingType?: string | null;
  expenseRecoveryRate: number | null;
  householdFee20m3Yen: number | null;
  feeUnitPriceYenPerM3: number | null;
  treatmentCostYenPerM3: number | null;
  annualBillableVolume?: number | null;
  generalAccountTransfer?: number | null;
};

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const chartPoints = points.map(sanitizeTrendPoint);
  const hasNonLegalYears = chartPoints.some((point) => point.accountingType === "non_legal_applied");
  const hasLegalYears = chartPoints.some((point) => point.accountingType === "legal_applied");

  return (
    <div className="grid gap-3">
      {hasNonLegalYears ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-white px-4 py-2 text-xs font-bold text-muted">
          <span>同じ算式で比較できる料金指標のみを表示しています。</span>
          <span className="flex flex-wrap items-center gap-4" aria-label="会計方式の凡例">
            {hasLegalYears ? <LegendSwatch label="法適用" color="#007f8f" /> : null}
            <LegendSwatch label="法非適用（参考）" color="#8294a8" dashed />
          </span>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-4">
        <LineChart
          title="経費回収率の推移（%）"
          ariaLabel="経費回収率推移"
          points={chartPoints.map((point) => ({ ...point, value: point.expenseRecoveryRate }))}
          formatter={formatPercent}
          reference={100}
        />
        <BarChart
          title="一般家庭用20m³／月（税込）"
          ariaLabel="一般家庭用20立方メートル月額使用料の推移"
          points={chartPoints.map((point) => ({ ...point, value: point.householdFee20m3Yen }))}
          formatter={formatHouseholdMonthlyFee}
          color="#3f9bd6"
        />
        <DualBarChart
          title="使用料単価と汚水処理原価（円/m³）"
          ariaLabel="使用料単価と汚水処理原価"
          points={chartPoints.map((point) => ({ ...point, first: point.feeUnitPriceYenPerM3, second: point.treatmentCostYenPerM3 }))}
        />
        <BarChart
          title="有収水量の推移"
          ariaLabel="有収水量推移"
          points={chartPoints.map((point) => ({ ...point, value: point.annualBillableVolume }))}
          formatter={formatVolume}
          color="#70d1ca"
        />
      </div>
    </div>
  );
}

function sanitizeTrendPoint(point: TrendPoint): TrendPoint {
  return {
    ...point,
    expenseRecoveryRate: chartableValue(point.expenseRecoveryRate),
    householdFee20m3Yen: chartableValue(point.householdFee20m3Yen),
    feeUnitPriceYenPerM3: chartableValue(point.feeUnitPriceYenPerM3),
    treatmentCostYenPerM3: chartableValue(point.treatmentCostYenPerM3),
    annualBillableVolume: chartableValue(point.annualBillableVolume)
  };
}

function chartableValue(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) || value < 0 ? null : value;
}

function formatHouseholdMonthlyFee(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "未取得";
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

type ChartPoint = {
  year: number;
  fiscalYearLabel?: string | null;
  accountingType?: string | null;
};

function LineChart({
  title,
  ariaLabel,
  points,
  formatter,
  reference
}: {
  title: string;
  ariaLabel: string;
  points: Array<ChartPoint & { value: number | null | undefined }>;
  formatter: (value: number | null | undefined) => string;
  reference?: number;
}) {
  const width = 360;
  const height = 220;
  const padding = 34;
  const series = points.filter((point) => point.value != null && Number.isFinite(point.value));
  const max = Math.max(reference ?? 0, 120, ...series.map((point) => point.value ?? 0));
  const [minYear, maxYear] = yearRange(points);
  const segments = lineSegments(points);
  const summary = points.map((point) => `${yearLabel(point)} ${formatter(point.value)} ${basisLabel(point.accountingType)}`).join("、");

  return (
    <ChartFrame title={title} summary={`${ariaLabel}。${summary}`}>
      {series.length > 0 ? (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
          {reference ? <line x1={padding} x2={width - padding} y1={y(reference, max, height, padding)} y2={y(reference, max, height, padding)} stroke="#007f8f" strokeDasharray="4 5" /> : null}
          <Axes width={width} height={height} padding={padding} />
          {segments.map((segment, index) => {
            const path = segment.points.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${x(point.year, minYear, maxYear, width, padding)} ${y(point.value ?? 0, max, height, padding)}`).join(" ");
            return segment.points.length > 1 ? (
              <path
                key={`${segment.accountingType}-${index}`}
                d={path}
                fill="none"
                stroke={basisColor(segment.accountingType)}
                strokeWidth="3"
                strokeDasharray={segment.accountingType === "non_legal_applied" ? "6 5" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null;
          })}
          {series.map((point) => (
            <g key={point.year}>
              <circle
                cx={x(point.year, minYear, maxYear, width, padding)}
                cy={y(point.value ?? 0, max, height, padding)}
                r="4"
                fill={basisColor(point.accountingType)}
                stroke="#fff"
                strokeWidth="1.5"
              />
              <text x={x(point.year, minYear, maxYear, width, padding)} y={y(point.value ?? 0, max, height, padding) - 8} textAnchor="middle" className="chart-label">
                {formatter(point.value)}
              </text>
            </g>
          ))}
          <YearLabels points={points} width={width} height={height} padding={padding} />
        </svg>
      ) : (
        <EmptyChart />
      )}
    </ChartFrame>
  );
}

function DualBarChart({
  title,
  ariaLabel,
  points
}: {
  title: string;
  ariaLabel: string;
  points: Array<ChartPoint & { first: number | null | undefined; second: number | null | undefined }>;
}) {
  const width = 360;
  const height = 220;
  const padding = 34;
  const max = Math.max(1, ...points.flatMap((point) => [point.first ?? 0, point.second ?? 0]));
  const summary = points.map((point) => `${yearLabel(point)} 使用料単価${formatYenPerM3(point.first)}、汚水処理原価${formatYenPerM3(point.second)} ${basisLabel(point.accountingType)}`).join("、");

  return (
    <ChartFrame
      title={title}
      summary={`${ariaLabel}。${summary}`}
      legend={<><LegendSwatch label="使用料単価" color="#3f9bd6" /><LegendSwatch label="汚水処理原価" color="#8d7bd0" /></>}
    >
      {points.some((point) => point.first != null || point.second != null) ? (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
          <Axes width={width} height={height} padding={padding} />
          {points.map((point, index) => {
            const slot = (width - padding * 2) / Math.max(points.length, 1);
            const baseX = padding + slot * index + slot * 0.25;
            const barWidth = Math.min(18, slot * 0.22);
            const opacity = point.accountingType === "non_legal_applied" ? 0.55 : 1;
            return (
              <g key={point.year}>
                {point.first != null ? <rect x={baseX} y={y(point.first, max, height, padding)} width={barWidth} height={height - padding - y(point.first, max, height, padding)} fill="#3f9bd6" rx="2" opacity={opacity} {...basisBarOutline(point.accountingType)} /> : null}
                {point.second != null ? <rect x={baseX + barWidth + 4} y={y(point.second, max, height, padding)} width={barWidth} height={height - padding - y(point.second, max, height, padding)} fill="#8d7bd0" rx="2" opacity={opacity} {...basisBarOutline(point.accountingType)} /> : null}
                {point.first != null ? <text x={baseX + barWidth / 2} y={Math.max(y(point.first, max, height, padding) - 6, 14)} textAnchor="middle" className="chart-label">{point.first.toFixed(1)}</text> : null}
                {point.second != null ? <text x={baseX + barWidth * 1.5 + 4} y={Math.max(y(point.second, max, height, padding) - 6, 14)} textAnchor="middle" className="chart-label">{point.second.toFixed(1)}</text> : null}
                <text x={baseX + barWidth} y={height - 10} textAnchor="middle" className="chart-label">{basisYearLabel(point)}</text>
              </g>
            );
          })}
        </svg>
      ) : (
        <EmptyChart />
      )}
    </ChartFrame>
  );
}

function BarChart({
  title,
  ariaLabel,
  points,
  formatter,
  color
}: {
  title: string;
  ariaLabel: string;
  points: Array<ChartPoint & { value: number | null | undefined }>;
  formatter: (value: number | null | undefined) => string;
  color: string;
}) {
  const width = 360;
  const height = 220;
  const padding = 34;
  const max = Math.max(1, ...points.map((point) => point.value ?? 0));
  const summary = points.map((point) => `${yearLabel(point)} ${formatter(point.value)} ${basisLabel(point.accountingType)}`).join("、");

  return (
    <ChartFrame title={title} summary={`${ariaLabel}。${summary}`}>
      {points.some((point) => point.value != null) ? (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
          <Axes width={width} height={height} padding={padding} />
          {points.map((point, index) => {
            const slot = (width - padding * 2) / Math.max(points.length, 1);
            const barWidth = Math.min(28, slot * 0.45);
            const barX = padding + slot * index + (slot - barWidth) / 2;
            const barY = y(point.value ?? 0, max, height, padding);
            return (
              <g key={point.year}>
                {point.value != null ? <rect x={barX} y={barY} width={barWidth} height={height - padding - barY} fill={color} rx="2" opacity={point.accountingType === "non_legal_applied" ? 0.55 : 1} {...basisBarOutline(point.accountingType)} /> : null}
                {point.value != null ? <text x={barX + barWidth / 2} y={Math.max(barY - 8, 16)} textAnchor="middle" className="chart-label">{formatter(point.value)}</text> : null}
                <text x={barX + barWidth / 2} y={height - 10} textAnchor="middle" className="chart-label">{basisYearLabel(point)}</text>
              </g>
            );
          })}
        </svg>
      ) : (
        <EmptyChart />
      )}
    </ChartFrame>
  );
}

function ChartFrame({ title, summary, legend, children }: { title: string; summary: string; legend?: ReactNode; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const dialogTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (!expanded) {
      if (hasOpenedRef.current) {
        triggerButtonRef.current?.focus();
        hasOpenedRef.current = false;
      }
      return;
    }
    hasOpenedRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [expanded]);

  return (
    <section className="panel relative p-4" data-chart-card="true">
      <div className="mb-2 flex min-h-8 flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-black leading-5 text-ink">{title}</h3>
        <span className="flex flex-wrap items-center justify-end gap-3 text-[10px] font-bold text-muted">
          {legend}
          <span className="inline-flex items-center gap-1" aria-hidden="true"><Maximize2 size={13} />拡大</span>
        </span>
      </div>
      <p className="sr-only">{summary}</p>
      <button
        ref={triggerButtonRef}
        type="button"
        className="block w-full rounded-md border-0 bg-transparent p-0 text-left transition-shadow hover:shadow-[0_0_0_1px_rgba(0,127,143,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        onClick={() => setExpanded(true)}
        aria-label={`${title}を拡大表示`}
        aria-haspopup="dialog"
        aria-hidden={expanded ? "true" : undefined}
        tabIndex={expanded ? -1 : 0}
        data-chart-trigger="true"
      >
        {children}
      </button>
      {expanded ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setExpanded(false);
          }}
          data-chart-modal-backdrop="true"
        >
          <section
            className="flex max-h-[92vh] w-[min(96vw,980px)] flex-col overflow-hidden rounded-xl border border-line bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            data-chart-modal="true"
          >
            <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-[0.08em] text-teal">R2—R6</span>
                <h3 id={dialogTitleId} className="truncate text-base font-black text-ink sm:text-lg">{title}</h3>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-white text-muted transition-colors hover:border-teal hover:bg-panel hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                onClick={() => setExpanded(false)}
                aria-label="拡大表示を閉じる"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <p className="sr-only">{summary}</p>
            <div className="min-h-0 overflow-auto p-4 sm:p-6">
              <div className="mx-auto w-full max-w-[920px] [&>svg]:max-h-[68vh] [&>svg]:w-full">
                {children}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function LegendSwatch({ label, color, dashed = false }: { label: string; color: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-4 rounded-sm" style={{ background: dashed ? "transparent" : color, border: dashed ? `1px dashed ${color}` : undefined }} aria-hidden="true" />
      {label}
    </span>
  );
}

function Axes({ width, height, padding }: { width: number; height: number; padding: number }) {
  return (
    <>
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} className="chart-grid-line" />
      <line x1={padding} x2={padding} y1={padding} y2={height - padding} className="chart-grid-line" />
      <line x1={padding} x2={width - padding} y1={padding} y2={padding} className="chart-grid-line" opacity="0.55" />
      <line x1={padding} x2={width - padding} y1={(height - padding + padding) / 2} y2={(height - padding + padding) / 2} className="chart-grid-line" opacity="0.55" />
    </>
  );
}

function YearLabels({ points, width, height, padding }: { points: ChartPoint[]; width: number; height: number; padding: number }) {
  const [minYear, maxYear] = yearRange(points);
  return (
    <>
      {points.map((point) => (
        <text key={point.year} x={x(point.year, minYear, maxYear, width, padding)} y={height - 10} textAnchor="middle" className="chart-label">
          {basisYearLabel(point)}
        </text>
      ))}
    </>
  );
}

function EmptyChart() {
  return <div className="flex h-[220px] items-center justify-center rounded-md bg-panel text-sm font-bold text-muted">推移データは未登録です。</div>;
}

function lineSegments(points: Array<ChartPoint & { value: number | null | undefined }>) {
  const segments: Array<{ accountingType?: string | null; points: Array<ChartPoint & { value: number }> }> = [];
  for (const [index, point] of points.entries()) {
    if (point.value == null || !Number.isFinite(point.value)) continue;
    const previousPoint = points[index - 1];
    const previousSegment = segments.at(-1);
    const isContiguous = previousPoint?.year === point.year - 1 && previousPoint?.value != null;
    if (!previousSegment || !isContiguous || previousSegment.accountingType !== point.accountingType) {
      segments.push({ accountingType: point.accountingType, points: [{ ...point, value: point.value }] });
    } else {
      previousSegment.points.push({ ...point, value: point.value });
    }
  }
  return segments;
}

function yearLabel(point: ChartPoint) {
  return formatSettlementFiscalLabel({ surveyYear: point.year, fiscalYearLabel: point.fiscalYearLabel });
}

function basisYearLabel(point: ChartPoint) {
  return `${yearLabel(point)}${point.accountingType === "non_legal_applied" ? "※" : ""}`;
}

function basisBarOutline(accountingType?: string | null) {
  return accountingType === "non_legal_applied"
    ? { stroke: "#8294a8", strokeWidth: 1.5, strokeDasharray: "3 2" }
    : {};
}

function yearRange(points: Array<{ year: number }>) {
  if (points.length === 0) return [0, 0] as const;
  return [Math.min(...points.map((point) => point.year)), Math.max(...points.map((point) => point.year))] as const;
}

function basisColor(accountingType?: string | null) {
  return accountingType === "non_legal_applied" ? "#8294a8" : "#007f8f";
}

function basisLabel(accountingType?: string | null) {
  return accountingType === "non_legal_applied" ? "法非適用" : accountingType === "legal_applied" ? "法適用" : "会計方式不明";
}

function x(year: number, minYear: number, maxYear: number, width: number, padding: number) {
  if (minYear === maxYear) return width / 2;
  return padding + ((year - minYear) / (maxYear - minYear)) * (width - padding * 2);
}

function y(value: number, max: number, height: number, padding: number) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  return height - padding - (safeValue / safeMax) * (height - padding * 2);
}
