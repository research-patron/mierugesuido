import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import {
  buildCostCompositionDisplay,
  type CitizenMunicipalityAssessment,
  type FeeLevelDetailedCostItemAssessment,
  type MetricMedianComparison
} from "@/lib/citizenMunicipalityAssessment";
import type { PrefecturePeerComparisonResult } from "@/lib/prefecturePeerComparison";
import { CostComparisonScatter } from "./CostComparisonScatter";
import styles from "./CitizenAssessmentPanel.module.css";

type FeeLevelAnalysisPanelProps = {
  assessment: CitizenMunicipalityAssessment;
  municipalityName: string;
  prefectureName: string;
  businessLabel: string;
  fiscalLabel: string;
  peerLoading: boolean;
  peerComparison: PrefecturePeerComparisonResult | null;
  currentComparisonUnitKey?: string;
  diagnosisHref: string;
  financeHref: string;
  yearbookHref: string;
};

export function FeeLevelAnalysisPanel({
  assessment, municipalityName, prefectureName, businessLabel, fiscalLabel,
  peerLoading, peerComparison, currentComparisonUnitKey, diagnosisHref, financeHref, yearbookHref
}: FeeLevelAnalysisPanelProps) {
  const areaLabel = prefectureName === "北海道" ? "道内" : prefectureName === "東京都" ? "都内"
    : prefectureName === "大阪府" || prefectureName === "京都府" ? "府内" : "県内";
  const analysis = assessment.feeLevelCostAnalysis;
  const maintenanceCost = analysis.components.find((c) => c.kind === "maintenance");
  const capitalCost = analysis.components.find((c) => c.kind === "capital");
  const natureItems = [...analysis.natureItems].sort((a,b) => b.yenPerM3 - a.yenPerM3 || a.label.localeCompare(b.label, "ja"));
  const costDisplay = buildCostCompositionDisplay(assessment.costComposition);
  const r6Available = assessment.r6DataAvailability.status === "available";
  const comparisonLoading = r6Available && peerLoading;
  const currentPeer = peerComparison?.rows.find((row) => row.comparisonUnitKey === currentComparisonUnitKey);
  const comparisonExcluded = currentPeer?.eligible === false;
  const unavailableLabel = comparisonExcluded ? "対象外" : "未取得";
  const comparisonScope = assessment.comparisonBasis.scopeLabel.replace("同一都道府県の", `${prefectureName}内の`);

  return <section className={styles.analysisRoot} aria-labelledby="fee-level-analysis-title">
    <header className={styles.analysisHeader}>
      <Link href={diagnosisHref} className={styles.analysisBackLink}><ArrowLeft size={16} aria-hidden="true" /> このまちの診断に戻る</Link>
      <div><span>{fiscalLabel}・{businessLabel}</span><h2 id="fee-level-analysis-title">{municipalityName}の料金水準の考察</h2>
        <p>{r6Available ? comparisonExcluded ? "この事業の費用の内訳です。" : "費用の内訳を、県内の事業と比べてみましょう。".replace("県内", areaLabel) : assessment.r6DataAvailability.reason}</p>
      </div>
    </header>
    <div className={styles.analysisBody}>
      <div className={styles.costConclusion} data-state={analysis.state} aria-live="polite">
        <span>{comparisonLoading ? "比較データを読み込み中" : r6Available ? "R6の費用の特徴" : "R6のデータ不足"}</span>
        <strong>{comparisonLoading ? `${areaLabel}の費用比較を読み込み中です` : analysis.headline.replaceAll("県内", areaLabel)}</strong>
      </div>
      {maintenanceCost && capitalCost ? <>
        <div className={styles.costEquation} aria-label="汚水処理原価の内訳（円/m³）">
          <span data-kind="maintenance"><small>維持管理費分</small><strong>{maintenanceCost.yenPerM3.toFixed(1)}<em>円/m³</em></strong><small>施設の運転・維持にかかる費用</small></span>
          <b aria-hidden="true">＋</b>
          <span data-kind="capital"><small>資本費分</small><strong>{capitalCost.yenPerM3.toFixed(1)}<em>円/m³</em></strong><small>施設整備にかかる費用</small></span>
          <b aria-hidden="true">＝</b>
          <span className={styles.costEquationTotal}><small>汚水処理原価</small><strong>{(maintenanceCost.yenPerM3+capitalCost.yenPerM3).toFixed(1)}<em>円/m³</em></strong><small>汚水1m³を処理する費用</small></span>
        </div>
        <div className={styles.costComponentGrid}>
          {[maintenanceCost, capitalCost].map((component) => <article key={component.kind} className={styles.costComponent} data-kind={component.kind}>
            <div className={styles.costComponentHeading}><span>{component.label}</span><strong>全体の {component.sharePercent.toFixed(1)}%</strong></div>
            <CostBars items={[{id: component.kind, label: component.label, yenPerM3: component.yenPerM3, comparison: component.comparison}]} areaLabel={areaLabel} loading={comparisonLoading} unavailableLabel={unavailableLabel} hideItemLabel />
          </article>)}
        </div>
      </> : <p className={styles.analysisComparisonScope}>{analysis.explanation}</p>}
      <p className={styles.analysisComparisonScope}>比較対象：{comparisonScope}・R6</p>
      <p className={styles.analysisComparisonScope}>有収水量（料金収入につながる水量）の変化 R2→R6：{assessment.volumeTrend.changePercent == null ? "データ不足" : `${assessment.volumeTrend.changePercent > 0 ? "+" : ""}${assessment.volumeTrend.changePercent.toFixed(1)}%`}</p>
      {comparisonExcluded ? <p className={styles.analysisComparisonScope}>この事業は{areaLabel}の費用比較の対象外です。</p>
        : <CostComparisonScatter rows={r6Available && currentPeer?.eligible ? peerComparison?.rows ?? [] : []} currentKey={currentComparisonUnitKey} areaLabel={areaLabel} loading={comparisonLoading}/>}

      <section className={styles.costBreakdownSection} aria-labelledby="cost-breakdown-title">
        <div className={styles.breakdownHeading}><h3 id="cost-breakdown-title">費用の内訳</h3><p>1m³当たりの金額と、{areaLabel}中央値との差</p></div>
        <div className={styles.costReasonBody}>
          <section aria-labelledby="purpose-cost-title">
            <h4 id="purpose-cost-title">どの施設・業務にかかる？</h4><p className={styles.costScopeNote}>目的別の営業費用・第20表（円/m³）</p>
            {analysis.purposeItems.length > 0 ? <CostBars items={analysis.purposeItems} areaLabel={areaLabel} loading={comparisonLoading} unavailableLabel={unavailableLabel}/>
              : <p>目的別の費用データがありません。</p>}
          </section>
          <section aria-labelledby="nature-cost-title">
            <h4 id="nature-cost-title">何に使っている？</h4><p className={styles.costScopeNote}>性質別の費用・第21表（円/m³）</p>
            {natureItems.length > 0 ? <CostBars items={natureItems} areaLabel={areaLabel} loading={comparisonLoading} unavailableLabel={unavailableLabel}/>
              : costDisplay.topItems.length > 0 ? <ul className={styles.fallbackCosts}>{[...costDisplay.topItems, ...costDisplay.additionalAbovePeerMedianItems].map((item) => <li key={item.id}><span>{item.label}</span><strong>{item.sharePercent.toFixed(1)}%</strong></li>)}</ul>
                : <p>性質別の費用データがありません。</p>}
          </section>
        </div>
      </section>
      <section className={styles.costNextSteps} aria-labelledby="other-fee-factors-title">
        <h3 id="other-fee-factors-title">料金に関わるほかの要素</h3>
        <ul><li>今後3〜5年の利用量と費用</li><li>公費で負担する費用</li><li>施設更新に備える資産維持費</li><li>基本料金と従量料金の組み合わせ</li></ul>
        <p>詳しくは自治体の経営戦略・使用料算定資料・条例に掲載されています。</p>
      </section>
    </div>
    <footer className={styles.analysisActions} aria-label="料金水準の考察に関する詳しい根拠">
      <Link href={financeHref} className={styles.analysisPrimaryLink}>費用と財務の根拠を見る <ArrowRight size={15} aria-hidden="true" /></Link>
      <Link href={yearbookHref} className={styles.analysisSecondaryLink}>{fiscalLabel}の公式値と計算式 <ArrowRight size={14} aria-hidden="true" /></Link>
      <a className={styles.analysisSecondaryLink} href="https://www.jswa.jp/2017/11/27/7200/" target="_blank" rel="noreferrer">日本下水道協会「下水道使用料算定の基本的考え方（2016年度版）」 <ExternalLink size={13} aria-hidden="true" /></a>
    </footer>
  </section>;
}

function CostBars({items, areaLabel, loading, unavailableLabel = "未取得", hideItemLabel = false}: {
  items: FeeLevelDetailedCostItemAssessment[]; areaLabel: string; loading: boolean; unavailableLabel?: string; hideItemLabel?: boolean;
}) {
  const maximum = Math.max(1, ...items.flatMap((item) => [item.yenPerM3, loading ? 0 : item.comparison.median ?? 0]));
  return <ul className={styles.costBars}>{items.map((item) => <li key={item.id}>
    {!hideItemLabel ? <div className={styles.costBarHeading}><strong>{item.label}</strong><span>{loading || item.comparison.difference == null ? "" : `${item.comparison.difference >= 0 ? "+" : "−"}${Math.abs(item.comparison.difference).toFixed(1)}円/m³`}</span></div> : null}
    <div className={styles.costBarRow}><span>この事業</span><div className={styles.costBarTrack} aria-hidden="true"><i style={{width:`${item.yenPerM3/maximum*100}%`}}/></div><b>{item.yenPerM3.toFixed(1)}</b></div>
    <div className={styles.costBarRow} data-peer="true"><span>{areaLabel}中央値</span><div className={styles.costBarTrack} aria-hidden="true">{!loading && item.comparison.median != null ? <i style={{width:`${item.comparison.median/maximum*100}%`}}/> : null}</div><b>{loading ? "読込中" : item.comparison.median == null ? unavailableLabel : item.comparison.median.toFixed(1)}</b></div>
    {hideItemLabel ? <p className={styles.costDifference}>中央値との差 <strong>{loading ? "読み込み中" : formatCostComponentDifference(item.comparison)}</strong></p> : null}
  </li>)}</ul>;
}

export function formatCostComponentDifference(comparison: MetricMedianComparison) {
  if (comparison.difference == null) return "比較なし";
  const value = comparison.difference;
  const difference = `${Math.abs(value) < 0.05 ? "±0.0" : `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`}円/m³`;
  if (comparison.differencePercent == null) return `${difference}（率比較不可）`;
  const percent = comparison.differencePercent;
  return `${difference}（${Math.abs(percent) < 0.05 ? "±0.0" : `${percent > 0 ? "+" : "−"}${Math.abs(percent).toFixed(1)}`}%）`;
}
