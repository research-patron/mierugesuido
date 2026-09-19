"use client";

import Link from "next/link";
import React, { useId, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { buildCostComparisonChart, COST_CHART_METRICS, type CostChartMetric } from "@/lib/costComparisonChart";
import type { PrefecturePeerComparisonRow } from "@/lib/prefecturePeerComparison";
import styles from "./CostComparisonScatter.module.css";

export function CostComparisonScatter({rows, currentKey, areaLabel, loading}: {
  rows: PrefecturePeerComparisonRow[];
  currentKey?: string;
  areaLabel: string;
  loading: boolean;
}) {
  const id = useId();
  const [metric, setMetric] = useState<CostChartMetric>("nature:depreciation");
  const [selectedKey, setSelectedKey] = useState<string | undefined>(currentKey);
  const {points, fit} = useMemo(() => buildCostComparisonChart(rows, metric), [rows, metric]);
  const current = points.find((point) => point.key === currentKey);
  const selected = points.find((point) => point.key === selectedKey) ?? current ?? points[0];
  const metricLabel = COST_CHART_METRICS.find((item) => item.key === metric)!.label;
  const distant = points.filter((point) => point.distant);
  const maxX = niceMax(Math.max(0.01, ...points.map((point) => point.x)));
  const maxY = niceMax(Math.max(0.01, ...points.map((point) => point.y)));
  const minObservedX = Math.min(...points.map((point) => point.x));
  const maxObservedX = Math.max(...points.map((point) => point.x));
  const plot = {left: 90, top: 36, width: 600, height: 290};
  const x = (value: number) => plot.left + value / maxX * plot.width;
  const y = (value: number) => plot.top + plot.height - value / maxY * plot.height;
  const equation = fit ? `y ≈ ${formatCoefficient(fit.slope)}x ${fit.intercept < 0 ? "−" : "+"} ${formatCoefficient(Math.abs(fit.intercept))}` : null;

  return <section className={styles.root} aria-labelledby="cost-scatter-title">
    <div className={styles.heading}>
      <div><h3 id="cost-scatter-title">費用項目ごとに{areaLabel}で比べる</h3>
        <p>事業の規模と費用を比較できます。点を選ぶと内訳が表示されます。</p></div>
      <span className={styles.count}>{loading ? "読み込み中" : `${points.length}事業`}</span>
    </div>
    <div className={styles.metricChoice}>
      <label htmlFor={`${id}-metric`}>費用項目</label>
      <select id={`${id}-metric`} value={metric} onChange={(event) => setMetric(event.target.value as CostChartMetric)}>
        {["性質別の費用", "目的別の費用"].map((group) => <optgroup key={group} label={group}>
          {COST_CHART_METRICS.filter((item) => item.group === group).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </optgroup>)}
      </select>
      <span>{metric.startsWith("nature:") ? "第21表・性質別費用" : "第20表・目的別営業費用"}・R6</span>
    </div>
    {loading ? <p className={styles.empty} role="status">{areaLabel}の比較データを読み込み中です。</p>
      : points.length === 0 ? <p className={styles.empty}>{metricLabel}を比較できるR6データがありません。</p>
      : <>
        {currentKey && !current ? <p className={styles.missingCurrent}>この事業の{metricLabel}はデータ未取得です。{areaLabel}の事業を表示しています。</p> : null}
        <div className={styles.chartLayout}>
          <div className={styles.plotArea}>
            <div className={styles.legend}>{current ? <span data-color="current">この事業</span> : null}<span data-color="peer">{areaLabel}の事業</span><span data-color="distant">傾向線から離れた事業</span></div>
            <svg viewBox="0 0 720 380" className={styles.svg} role="group" aria-label={`${areaLabel}の年間有収水量と${metricLabel}の散布図`}>
              <defs><clipPath id={`${id}-plot`}><rect x={plot.left} y={plot.top} width={plot.width} height={plot.height}/></clipPath></defs>
              <text x={plot.left} y={17} className={styles.axisTitle}>年間費用（百万円）</text>
              {[0,1,2,3,4].map((index) => <g key={index}>
                <line x1={plot.left} x2={plot.left+plot.width} y1={y(maxY*index/4)} y2={y(maxY*index/4)} className={styles.grid}/>
                <text x={plot.left-10} y={y(maxY*index/4)+4} textAnchor="end">{formatAmount(maxY*index/4)}</text>
                <text x={x(maxX*index/4)} y={plot.top+plot.height+23} textAnchor="middle">{formatAmount(maxX*index/4)}</text>
              </g>)}
              <text x={plot.left+plot.width} y={371} textAnchor="end" className={styles.axisTitle}>年間有収水量（百万m³）</text>
              {fit ? <g clipPath={`url(#${id}-plot)`}>
                <line x1={x(minObservedX)} y1={y(fit.slope*minObservedX+fit.intercept)} x2={x(maxObservedX)} y2={y(fit.slope*maxObservedX+fit.intercept)} className={styles.fit}/>
              </g> : null}
              {[...points].sort((a,b) => Number(a.key === currentKey) - Number(b.key === currentKey)).map((point) => {
                const isCurrent = point.key === currentKey;
                const active = point.key === selected?.key;
                return <g key={point.key} role="button" tabIndex={0} aria-pressed={active}
                  aria-label={`${point.name}・${point.businessName}、年間有収水量${formatAmount(point.x)}百万m³、${metricLabel}${formatAmount(point.y)}百万円${isCurrent ? "、この事業" : ""}${point.distant ? "、傾向線から離れた事業" : ""}`}
                  onClick={() => setSelectedKey(point.key)} onFocus={() => setSelectedKey(point.key)}
                  onKeyDown={(event) => {if(event.key === "Enter" || event.key === " "){event.preventDefault();setSelectedKey(point.key);}}}
                  className={styles.point} data-current={isCurrent} data-distant={point.distant} data-active={active}>
                  <circle cx={x(point.x)} cy={y(point.y)} r={14} fill="transparent"/>
                  {active || isCurrent ? <circle className={styles.ring} cx={x(point.x)} cy={y(point.y)} r={10}/> : null}
                  {point.distant ? <path className={styles.dot} d={`M${x(point.x)},${y(point.y)-6} l6,6 -6,6 -6,-6 Z`}/>
                    : <circle className={styles.dot} cx={x(point.x)} cy={y(point.y)} r={isCurrent ? 6 : 4.5}/>}
                </g>;
              })}
            </svg>
            <p className={styles.fitSummary}>{fit ? <>破線：{areaLabel}の傾向線　<code>{equation}</code>　R² = {fit.rSquared == null ? "—" : fit.rSquared.toFixed(2)}</> : "異なる有収水量の3事業以上で傾向線を表示します。"}</p>
          </div>
          <div className={styles.selection}>
            <label htmlFor={`${id}-business`}>グラフで見る事業</label>
            <select id={`${id}-business`} value={selected?.key ?? ""} onChange={(event) => setSelectedKey(event.target.value)}>
              {points.map((point) => <option key={point.key} value={point.key}>{point.name}・{point.businessName}{point.key === currentKey ? "（この事業）" : ""}</option>)}
            </select>
            {selected ? <div aria-live="polite">
              <span className={styles.tag}>{selected.key === currentKey ? "この事業" : selected.distant ? "傾向線から離れた事業" : "選択中"}</span>
              <h4>{selected.name}</h4><p>{selected.businessName}</p>
              <dl>
                <div><dt>年間費用</dt><dd>{formatAmount(selected.y)}<small>百万円</small></dd></div>
                <div><dt>1m³当たり</dt><dd>{selected.yenPerM3.toFixed(1)}<small>円/m³</small></dd></div>
                <div><dt>年間有収水量</dt><dd>{formatAmount(selected.x)}<small>百万m³</small></dd></div>
                <div><dt>傾向線との差</dt><dd>{selected.residual == null ? "—" : signedAmount(selected.residual)}{selected.residual != null ? <small>百万円</small> : null}</dd></div>
              </dl>
              {selected.key !== currentKey ? <Link href={`/municipalities/${selected.municipalityCode}/?business=${encodeURIComponent(selected.businessKey)}&view=fee-analysis`}>この事業の考察を見る <ArrowRight size={14}/></Link> : null}
              {current && selected.key !== currentKey ? <button type="button" onClick={() => setSelectedKey(currentKey)}>この事業に戻す</button> : null}
            </div> : null}
          </div>
        </div>
        {distant.length > 0 ? <div className={styles.distantList}><strong>傾向線から離れた事業</strong>{distant.map((point) => <button key={point.key} type="button" aria-pressed={selected?.key === point.key} onClick={() => setSelectedKey(point.key)}>{point.name}・{point.businessName} <span>{signedAmount(point.residual!)}百万円</span></button>)}</div> : null}
        <details className={styles.method}><summary>グラフの計算方法</summary><p>1事業を1点で表示。xは年間有収水量（百万m³）、yは選んだ項目の年間費用（百万円）です。費用は1m³当たりの費用×年間有収水量で算出しています。傾向線は最小二乗法による直線近似、R²は直線の当てはまりです。5事業以上で標準化残差の絶対値が2を超える点をひし形で表示しています。</p></details>
      </>}
  </section>;
}

function niceMax(value: number) {
  const scale = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value * 1.1 / scale * 2) / 2 * scale;
}
function formatAmount(value: number) {
  return value.toLocaleString("ja-JP", Math.abs(value) > 0 && Math.abs(value) < 0.01
    ? {maximumSignificantDigits: 2} : {maximumFractionDigits: 2});
}
function signedAmount(value: number) {return `${value >= 0 ? "+" : "−"}${formatAmount(Math.abs(value))}`;}
function formatCoefficient(value: number) {return Number(value.toPrecision(4)).toLocaleString("ja-JP", {maximumSignificantDigits: 4});}
