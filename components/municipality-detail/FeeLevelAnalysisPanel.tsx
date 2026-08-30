import Link from "next/link";
import type { KeyboardEvent, ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import {
  buildCostCompositionDisplay,
  type CitizenCostCompositionInsight,
  type CitizenMunicipalityAssessment,
  type MetricMedianComparison
} from "@/lib/citizenMunicipalityAssessment";
import styles from "./CitizenAssessmentPanel.module.css";

type FeeLevelAnalysisPanelProps = {
  assessment: CitizenMunicipalityAssessment;
  municipalityName: string;
  prefectureName: string;
  businessLabel: string;
  fiscalLabel: string;
  peerLoading: boolean;
  diagnosisHref: string;
  financeHref: string;
  yearbookHref: string;
};

export function FeeLevelAnalysisPanel({
  assessment,
  municipalityName,
  prefectureName,
  businessLabel,
  fiscalLabel,
  peerLoading,
  diagnosisHref,
  financeHref,
  yearbookHref
}: FeeLevelAnalysisPanelProps) {
  const areaLabel = prefectureAreaLabel(prefectureName);
  const feeLevelCostAnalysis = assessment.feeLevelCostAnalysis;
  const maintenanceCost = feeLevelCostAnalysis.components.find((component) => component.kind === "maintenance") ?? null;
  const capitalCost = feeLevelCostAnalysis.components.find((component) => component.kind === "capital") ?? null;
  const purposeCostItems = feeLevelCostAnalysis.purposeItems;
  const natureCostItems = orderDetailedCostItems(feeLevelCostAnalysis.natureItems);
  const costDisplay = buildCostCompositionDisplay(assessment.costComposition);
  const r6Available = assessment.r6DataAvailability.status === "available";
  const comparisonLoading = r6Available && peerLoading;
  const comparisonScope = assessment.comparisonBasis.scopeLabel.replace(
    "同一都道府県の",
    `${prefectureName}内の`
  );

  return (
    <section className={styles.analysisRoot} aria-labelledby="fee-level-analysis-title">
      <header className={styles.analysisHeader}>
        <Link href={diagnosisHref} className={styles.analysisBackLink}>
          <ArrowLeft size={16} aria-hidden="true" /> このまちの診断に戻る
        </Link>
        <div>
          <span>{fiscalLabel}・{businessLabel}</span>
          <h2 id="fee-level-analysis-title">{municipalityName}の料金水準の考察</h2>
          <p>{r6Available
            ? "地方公営企業年鑑のR6実績から、料金と費用の同じ年度の関係を整理します。料金決定の原因や自治体の公式判断を断定するものではありません。"
            : `${assessment.r6DataAvailability.reason} R6実績が揃わないため、料金水準の費用分析は行いません。`}</p>
        </div>
      </header>

      <div className={styles.analysisBody}>
        <div className={styles.costConclusion} data-state={feeLevelCostAnalysis.state} aria-live="polite">
          <span>{comparisonLoading ? "比較データを読み込み中" : r6Available ? "R6実績から考えられる要因" : "R6実績の確認状況"}</span>
          <strong>{comparisonLoading
            ? `${areaLabel}の費用比較を準備しています`
            : localizeAreaLabel(feeLevelCostAnalysis.headline, areaLabel)}</strong>
          <p>{comparisonLoading
            ? "維持管理費分・資本費分と比較対象の中央値を確認しています。"
            : localizeAreaLabel(feeLevelCostAnalysis.explanation, areaLabel)}</p>
        </div>

        <div className={styles.analysisDefinitions} role="note" aria-label="下水道使用料を支える費用の考え方">
          <p><strong>維持管理費</strong>は、既存施設を維持管理するための費用です。目的別には管渠費・ポンプ場費・処理場費・一般管理費、性質別には人件費・動力費・薬品費・修繕費・流域下水道維持管理負担金・委託料などで構成されます。</p>
          <p><strong>資本費</strong>は、施設整備に必要な費用です。法適用では減価償却費等、法非適用では地方債元利償還費等に加え、中長期の更新計画から算定する資産維持費を確認します。</p>
        </div>

        {maintenanceCost && capitalCost ? (
          <>
            <div
              className={styles.costEquation}
              aria-label={`汚水処理費1立方メートル当たり、維持管理費分${maintenanceCost.yenPerM3.toFixed(1)}円、資本費分${capitalCost.yenPerM3.toFixed(1)}円`}
            >
              <span><small>維持管理費分</small><strong>{maintenanceCost.yenPerM3.toFixed(1)}円/m³</strong></span>
              <b aria-hidden="true">＋</b>
              <span><small>資本費分</small><strong>{capitalCost.yenPerM3.toFixed(1)}円/m³</strong></span>
              <b aria-hidden="true">＝</b>
              <span className={styles.costEquationTotal}>
                <small>汚水処理原価</small>
                <strong>{(maintenanceCost.yenPerM3 + capitalCost.yenPerM3).toFixed(1)}円/m³</strong>
              </span>
            </div>

            <p className={styles.analysisComparisonScope}>
              {comparisonLoading
                ? `${comparisonScope}の中央値を読み込んでいます。`
                : `中央値は、比較できる場合に${comparisonScope}を同じ単位へそろえて算定しています。`}
            </p>

            <div className={styles.costComponentGrid}>
              {[maintenanceCost, capitalCost].map((component) => (
                <article key={component.kind} className={styles.costComponent} data-position={component.comparison.position}>
                  <div className={styles.costComponentHeading}>
                    <span>{component.label}</span>
                    <strong>{component.sharePercent.toFixed(1)}%</strong>
                  </div>
                  <div className={styles.costShareTrack} aria-hidden="true">
                    <span style={{ width: `${Math.min(Math.max(component.sharePercent, 0), 100)}%` }} />
                  </div>
                  <dl>
                    <div><dt>この事業</dt><dd>{component.yenPerM3.toFixed(1)}円/m³</dd></div>
                    <div><dt>{areaLabel}中央値</dt><dd>{comparisonLoading ? "読み込み中" : component.comparison.median == null ? "比較なし" : `${component.comparison.median.toFixed(1)}円/m³`}</dd></div>
                    <div><dt>中央値との差</dt><dd>{comparisonLoading ? "読み込み中" : formatCostComponentDifference(component.comparison)}</dd></div>
                  </dl>
                  <p>{component.shortDefinition}</p>
                </article>
              ))}
            </div>
          </>
        ) : null}

        <div className={styles.costRelationship}>
          <strong>料金と総原価の位置</strong>
          <p>{comparisonLoading
            ? "料金と汚水処理原価の比較対象を読み込んでいます。"
            : `${localizeAreaLabel(assessment.feeCostRelationship.headline, areaLabel)}。${localizeAreaLabel(assessment.feeCostRelationship.explanation, areaLabel)}`}</p>
          <dl className={styles.compactMetrics}>
            <div>
              <dt>一般家庭用20m³／月（税込）</dt>
              <dd>{comparisonLoading ? "比較を読み込み中" : formatHouseholdFeeComparison(assessment.feeCostRelationship.fee, areaLabel)}</dd>
            </div>
            <div>
              <dt>汚水処理原価（1m³あたり）</dt>
              <dd>{comparisonLoading ? "比較を読み込み中" : formatMetricComparison(assessment.feeCostRelationship.treatmentCost, "円/m³", areaLabel)}</dd>
            </div>
            <div>
              <dt>R2→R6 有収水量（料金収入につながる水量）</dt>
              <dd>{assessment.volumeTrend.changePercent == null ? "比較不可" : formatSignedPercent(assessment.volumeTrend.changePercent)}</dd>
            </div>
          </dl>
        </div>

        <details className={styles.costReasonDetails}>
          <summary onKeyDown={toggleDetailsFromKeyboard}>費目の内訳と、ここから先の確認事項 <ChevronDown size={15} aria-hidden="true" /></summary>
          <div className={styles.costReasonBody}>
            <section>
              <h3>目的別｜どの施設・業務に費用がかかるか</h3>
              <p>法適用事業の第20表から、管渠費・ポンプ場費・処理場費と、一般管理に近い業務費・総係費を1m³当たりで比較します。</p>
              {purposeCostItems.length > 0 ? (
                <ul>{purposeCostItems.map((item) => <li key={item.id}>{formatDetailedCostItem(item, areaLabel, comparisonLoading)}</li>)}</ul>
              ) : (
                <p>目的別費用は、同じ会計基準の値が揃う法適用事業で表示します。</p>
              )}
              <p className={styles.costScopeNote}>第20表の営業費用項目であり、汚水処理費の維持管理費分だけを切り分けた値ではありません。</p>
            </section>

            <section>
              <h3>性質別｜何に費用を使っているか</h3>
              <p>法適用事業の第21表から、人件費、動力費、薬品費、修繕費、委託料、減価償却費などを1m³当たりで比較します。</p>
              {natureCostItems.length > 0 ? (
                <ul>{natureCostItems.map((item) => <li key={item.id}>{formatDetailedCostItem(item, areaLabel, comparisonLoading)}</li>)}</ul>
              ) : costDisplay.topItems.length > 0 ? (
                <>
                  <strong className={styles.costItemLabel}>主な費目：</strong>
                  <ul>{costDisplay.topItems.map((item) => <li key={item.id}>{formatCostCompositionItem(item, areaLabel, comparisonLoading)}</li>)}</ul>
                  {costDisplay.additionalAbovePeerMedianItems.length > 0 ? (
                    <>
                      <strong className={styles.costItemLabel}>{areaLabel}中央値を5ポイント以上上回るほかの費目：</strong>
                      <ul>{costDisplay.additionalAbovePeerMedianItems.map((item) => <li key={item.id}>{formatCostCompositionItem(item, areaLabel, comparisonLoading)}</li>)}</ul>
                    </>
                  ) : null}
                </>
              ) : (
                <p>人件費、動力費、薬品費、修繕費、委託料、減価償却費などの費目比較は、同じ会計基準の値が揃う法適用事業で表示します。</p>
              )}
              <p className={styles.costScopeNote}>第21表の費用合計を構成する項目であり、汚水処理費の二分とは集計範囲が異なります。</p>
            </section>

            <section className={styles.costNextSteps}>
              <h3>料金の決定理由を確かめるために必要なこと</h3>
              <ul>
                <li>3〜5年程度の算定期間における排水需要と維持管理費・資本費の見通し</li>
                <li>維持管理費・資本費から、公費負担分など使用料の対象に含めない控除・調整額</li>
                <li>中長期の更新計画から算定する資産維持費</li>
                <li>基本使用料・従量使用料、使用者群への配賦など料金体系の設計</li>
              </ul>
              <p>これらは単年度の地方公営企業年鑑だけでは揃わないため、自治体の経営戦略・使用料算定資料・条例などで最終確認します。</p>
            </section>
          </div>
        </details>
      </div>

      <footer className={styles.analysisActions} aria-label="料金水準の考察に関する詳しい根拠">
        <Link href={financeHref} className={styles.analysisPrimaryLink}>
          費用と財務の根拠を見る <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link href={yearbookHref} className={styles.analysisSecondaryLink}>
          {fiscalLabel}の公式値と計算式 <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <a className={styles.analysisSecondaryLink} href="https://www.jswa.jp/2017/11/27/7200/" target="_blank" rel="noreferrer">
          日本下水道協会「下水道使用料算定の基本的考え方（2016年度版）」 <ExternalLink size={13} aria-hidden="true" />
        </a>
      </footer>
    </section>
  );
}

function formatMetricComparison(comparison: MetricMedianComparison, unit: string, areaLabel: string) {
  if (comparison.current == null) return "未取得";
  const current = `${comparison.current.toFixed(1)}${unit}`;
  if (comparison.median == null) return `${current}（${areaLabel}比較なし）`;
  return `${current}／${areaLabel}中央値 ${comparison.median.toFixed(1)}${unit}`;
}

function formatHouseholdFeeComparison(comparison: MetricMedianComparison, areaLabel: string) {
  if (comparison.current == null) return "未取得";
  const current = `${Math.round(comparison.current).toLocaleString("ja-JP")}円`;
  if (comparison.median == null) return `${current}（${areaLabel}比較なし）`;
  return `${current}／${areaLabel}中央値 ${Math.round(comparison.median).toLocaleString("ja-JP")}円`;
}

function formatCostCompositionItem(
  item: CitizenCostCompositionInsight,
  areaLabel: string,
  comparisonLoading = false
) {
  const current = `${item.label} ${item.sharePercent.toFixed(1)}%`;
  if (comparisonLoading) return `${current}（${areaLabel}比較を読み込み中）`;
  if (item.peerMedianPercent == null || item.differencePoints == null) return `${current}（${areaLabel}比較なし）`;
  return `${current}（${areaLabel}中央値 ${item.peerMedianPercent.toFixed(1)}%、差 ${formatSignedPoints(item.differencePoints)}）`;
}

function orderDetailedCostItems(
  items: CitizenMunicipalityAssessment["feeLevelCostAnalysis"]["natureItems"]
) {
  return [...items].sort((a, b) => b.yenPerM3 - a.yenPerM3 || a.label.localeCompare(b.label, "ja"));
}

function formatDetailedCostItem(
  item: CitizenMunicipalityAssessment["feeLevelCostAnalysis"]["natureItems"][number],
  areaLabel: string,
  comparisonLoading = false
): ReactNode {
  const median = item.comparison.median;
  return (
    <>
      <strong>{item.label}</strong>：{item.yenPerM3.toFixed(1)}円/m³
      {comparisonLoading
        ? `（${areaLabel}比較を読み込み中）`
        : median == null
          ? `（${areaLabel}比較なし）`
          : `（${areaLabel}中央値 ${median.toFixed(1)}円/m³、差 ${formatCostComponentDifference(item.comparison)}）`}
    </>
  );
}

export function formatCostComponentDifference(comparison: MetricMedianComparison) {
  if (comparison.difference == null) return "比較なし";
  const difference = `${formatSignedDecimal(comparison.difference)}円/m³`;
  if (comparison.differencePercent == null) return `${difference}（率比較不可）`;
  return `${difference}（${formatSignedPercent(comparison.differencePercent)}）`;
}

function formatSignedDecimal(value: number) {
  if (Math.abs(value) < 0.05) return "±0.0";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`;
}

function formatSignedPercent(value: number) {
  if (Math.abs(value) < 0.05) return "±0.0%";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function formatSignedPoints(value: number) {
  if (Math.abs(value) < 0.05) return "±0.0ポイント";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}ポイント`;
}

function toggleDetailsFromKeyboard(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  const details = event.currentTarget.closest("details");
  if (details) details.open = !details.open;
}

function localizeAreaLabel(text: string | null | undefined, areaLabel: string) {
  return text?.replaceAll("県内", areaLabel) ?? "";
}

function prefectureAreaLabel(prefectureName: string) {
  if (prefectureName === "北海道") return "道内";
  if (prefectureName === "東京都") return "都内";
  if (prefectureName === "大阪府" || prefectureName === "京都府") return "府内";
  return "県内";
}
