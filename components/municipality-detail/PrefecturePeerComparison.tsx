import Link from "next/link";
import {
  BadgeJapaneseYen,
  BarChart3,
  CircleAlert,
  MapPinned
} from "lucide-react";
import {
  OPERATING_COVERAGE_CRITICAL_THRESHOLD,
  PREFECTURE_PEER_PUBLIC_SEWER_BUSINESS_KEY,
  PREFECTURE_PEER_TOKKAN_BUSINESS_KEY,
  isOperatingCoverageCritical,
  operatingCoverageDisplayValue,
  type PrefecturePeerComparisonResult,
  type PrefecturePeerComparisonRow
} from "@/lib/prefecturePeerComparison";
import { formatMoneyThousandYen, formatPercent } from "@/lib/format";
import styles from "./PrefecturePeerComparison.module.css";

export function PrefecturePeerComparison({
  model,
  businessLabel
}: {
  model: PrefecturePeerComparisonResult;
  businessLabel: string;
}) {
  const current = model.rows.find((row) => row.isCurrent) ?? null;
  const eligibleRows = model.rows.filter((row) => row.eligible);
  const feeMedian = median(eligibleRows.map((row) => row.householdFee20m3Yen));
  const operatingCoverageMedian = median(eligibleRows.map((row) => row.operatingCoverageRatio));
  const comparesPublicAndTokkan = model.businessKey === PREFECTURE_PEER_PUBLIC_SEWER_BUSINESS_KEY
    || model.businessKey === PREFECTURE_PEER_TOKKAN_BUSINESS_KEY;
  const scopeLabel = comparesPublicAndTokkan ? "公共＋特環" : businessLabel;
  const scopeDescription = comparesPublicAndTokkan
    ? "R6に地方公営企業法を適用する公共下水道と特環を、本サイト独自に都道府県内で横並び比較します。総務省の公式類似団体区分では公共下水道と特環は別区分です。両方がある自治体は表示中の事業種別を優先し、比較可能なR6決算がない場合だけ他方を採用します。"
    : `R6に地方公営企業法を適用する「${businessLabel}」を同じ事業種別で比較します。`;

  return (
    <div className={styles.root} id="prefecture-comparison">
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>R6 都道府県内比較</p>
          <h2>{model.prefectureName}の市町村を、同じ条件で比べる</h2>
          <p>
            {scopeDescription} 一覧は自治体コード順です。
          </p>
        </div>
        <div className={styles.conditions} aria-label="比較条件">
          <span>R6</span><span>{scopeLabel}</span><span>法適用のみ</span>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="県内比較の要約">
        <SummaryCard
          icon={MapPinned}
          label="比較できる事業体"
          value={`${model.summary.eligibleComparisonUnits}事業体`}
          note={`${model.summary.eligibleMunicipalities} / ${model.summary.totalMunicipalities}市町村をカバー・対象外${model.summary.excludedMunicipalities}市町村も表示`}
        />
        <SummaryCard
          icon={BadgeJapaneseYen}
          label="経費回収率100%以上"
          value={`${model.summary.positiveCounts.expenseRecoveryAtLeast100}事業体`}
          note="下水道使用料 ÷ 汚水処理費"
        />
        <SummaryCard
          icon={BarChart3}
          label="そのうち営業費用を全額賄えない"
          value={`${model.summary.positiveCounts.highRecoveryButOperatingCoverageBelow100}事業体`}
          note="営業収益 ÷ 営業費用が100%未満"
          tone="amber"
        />
      </section>

      {current && !current.eligible ? (
        <div className={styles.currentExcluded} role="status">
          <CircleAlert size={18} aria-hidden="true" />
          <p><strong>{current.municipalityName}はこの料金・財務比較の対象外です。</strong>{current.exclusionReason?.label}</p>
        </div>
      ) : null}

      <section className={styles.comparisonGrid} aria-label="表示中の市町村と都道府県内中央値の比較">
        <MetricComparison
          icon={BadgeJapaneseYen}
          eyebrow="20m³月額を比べる"
          title="一般家庭用20m³の月額使用料"
          description="一般家庭が1か月に20m³使用した場合の、料金表上の税込月額です。"
          currentLabel={current?.municipalityName ?? "この市町村"}
          currentValue={current?.eligible ? current.householdFee20m3Yen : null}
          medianLabel={`${model.prefectureName} 中央値`}
          medianValue={feeMedian}
          scaleMax={comparisonScaleMax([current?.eligible ? current.householdFee20m3Yen : null, feeMedian], 1_000, 500)}
          formatValue={(value) => `${Math.round(value).toLocaleString("ja-JP")}円 / 月`}
          formatAxisEnd={(value) => `${Math.round(value).toLocaleString("ja-JP")}円`}
          ariaLabel={`${model.prefectureName}の20m³月額使用料比較。${current?.municipalityName ?? "この市町村"}は${formatChartFee(current?.eligible ? current.householdFee20m3Yen : null)}、都道府県内中央値は${formatChartFee(feeMedian)}。`}
          missingLabel="未取得"
        />
        <MetricComparison
          icon={BarChart3}
          eyebrow="損益計算書の営業収支を比べる"
          title="営業収益で営業費用を何％賄えているか（サイト算定）"
          description="R6損益計算書の営業収益÷営業費用の参考割合です。営業収益には下水道使用料のほか雨水処理負担金等を含みます。100%以上なら全額を賄えます。50%未満は赤、50%以上は緑で示します。50%は本サイトの表示区分で、国の健全性基準ではありません。"
          currentLabel={current?.municipalityName ?? "この市町村"}
          currentValue={current?.eligible ? current.operatingCoverageRatio : null}
          medianLabel={`${model.prefectureName} 中央値`}
          medianValue={operatingCoverageMedian}
          scaleMax={comparisonScaleMax([current?.eligible ? current.operatingCoverageRatio : null, operatingCoverageMedian, 100], 120, 20)}
          formatValue={formatOperatingCoverage}
          formatAxisEnd={(value) => `${value.toFixed(0)}%`}
          ariaLabel={`${model.prefectureName}の、営業収益で賄えている営業費用の割合の比較。${current?.municipalityName ?? "この市町村"}は${formatOperatingCoverageForAria(current?.eligible ? current.operatingCoverageRatio : null)}、都道府県内中央値は${formatOperatingCoverageForAria(operatingCoverageMedian)}。`}
          axisStartLabel="0%"
          referenceValue={100}
          referenceLabel="100%（全額）"
          criticalBelow={OPERATING_COVERAGE_CRITICAL_THRESHOLD}
          contextLabel={current?.eligible ? `経費回収率 ${formatPercent(current.expenseRecoveryRate)}` : undefined}
          contextText={operatingCoverageContext(current)}
          formulaNote="経費回収率＝下水道使用料÷汚水処理費（公費負担分を除く）×100 ／ この割合＝営業収益÷営業費用×100。この割合は経費回収率・経常収支比率とは別です。"
        />
      </section>

      <section className={styles.tableSection} aria-labelledby="peer-table-title">
        <div className={styles.tableHeading}>
          <div>
            <p className={styles.eyebrow}>R6・法適用・自治体コード順</p>
            <h3 id="peer-table-title">市町村ごとの料金・財務比較</h3>
          </div>
        </div>
        <DesktopTable model={model} scopeLabel={scopeLabel} />
        <MobileCards model={model} />
        <div className={styles.classificationNote}>
          {model.rows.some((row) => row.isJointOperation) ? (
            <p><strong>組合運営</strong>は構成市町村を1行にまとめた組合全体の決算値です。市町村別に配分した金額ではなく、平均・合計にも1回だけ集計します。</p>
          ) : null}
          <p><strong>組合関係の収録範囲</strong>は、構成市町村と事業の公式根拠を確認できた関係に限ります。未確認の組合運営は比較に反映されない場合があります。</p>
          <p><strong>基準外繰入金</strong>は、総務省の繰出基準に当たらない一般会計等からの繰入額です（R6「繰入金に関する調」）。</p>
          <p>損益計算書の「他会計補助金」には繰出基準内の補助も含まれるため、この表では基準外繰入金の代わりに使っていません。</p>
          <p>経費回収率と「営業収益で賄えている営業費用の割合」は、比べる収益・費用の範囲が異なるため、結果は一致しません。</p>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  note,
  tone = "teal"
}: {
  icon: typeof MapPinned;
  label: string;
  value: string;
  note: string;
  tone?: "teal" | "amber" | "navy";
}) {
  return (
    <article className={styles.summaryCard} data-tone={tone}>
      <span className={styles.summaryIcon} aria-hidden="true"><Icon size={19} /></span>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </article>
  );
}

function MetricComparison({
  icon: Icon,
  eyebrow,
  title,
  description,
  currentLabel,
  currentValue,
  medianLabel,
  medianValue,
  scaleMax,
  formatValue,
  formatAxisEnd,
  ariaLabel,
  missingLabel = "算定不可",
  axisStartLabel = "0円",
  referenceValue,
  referenceLabel,
  criticalBelow,
  contextLabel,
  contextText,
  formulaNote
}: {
  icon: typeof MapPinned;
  eyebrow: string;
  title: string;
  description: string;
  currentLabel: string;
  currentValue: number | null;
  medianLabel: string;
  medianValue: number | null;
  scaleMax: number;
  formatValue: (value: number) => string;
  formatAxisEnd: (value: number) => string;
  ariaLabel: string;
  missingLabel?: string;
  axisStartLabel?: string;
  referenceValue?: number;
  referenceLabel?: string;
  criticalBelow?: number;
  contextLabel?: string;
  contextText?: string | null;
  formulaNote?: string;
}) {
  return (
    <figure className={styles.chartCard} role="img" aria-label={ariaLabel}>
      <figcaption className={styles.chartHeading}>
        <span className={styles.chartIcon} aria-hidden="true"><Icon size={20} /></span>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </figcaption>
      {contextText ? <div className={styles.metricContext}>{contextLabel ? <span>{contextLabel}</span> : null}<strong>{contextText}</strong></div> : null}
      <div className={styles.comparisonBars}>
        <MetricBar label={currentLabel} value={currentValue} max={scaleMax} formatValue={formatValue} missingLabel={missingLabel} referenceValue={referenceValue} criticalBelow={criticalBelow} emphasized />
        <MetricBar label={medianLabel} value={medianValue} max={scaleMax} formatValue={formatValue} missingLabel={missingLabel} referenceValue={referenceValue} criticalBelow={criticalBelow} />
        <div className={styles.axis} aria-hidden="true" data-reference={referenceValue != null || undefined}>
          <span>{axisStartLabel}</span>
          {referenceValue != null && referenceLabel ? <span className={styles.axisReference} style={{ left: `${Math.min(100, referenceValue / scaleMax * 100)}%` }}>{referenceLabel}</span> : null}
          <span>{formatAxisEnd(scaleMax)}</span>
        </div>
      </div>
      {formulaNote ? <p className={styles.formulaNote}>{formulaNote}</p> : null}
    </figure>
  );
}

function MetricBar({
  label,
  value,
  max,
  formatValue,
  missingLabel,
  referenceValue,
  criticalBelow,
  emphasized = false
}: {
  label: string;
  value: number | null;
  max: number;
  formatValue: (value: number) => string;
  missingLabel: string;
  referenceValue?: number;
  criticalBelow?: number;
  emphasized?: boolean;
}) {
  const width = value == null ? 0 : Math.min(100, Math.max(0, value / max * 100));
  const referencePosition = referenceValue == null ? null : Math.min(100, Math.max(0, referenceValue / max * 100));
  const critical = value != null
    && criticalBelow != null
    && value < criticalBelow;
  const cleared = value != null && criticalBelow != null && !critical;
  return (
    <div
      className={styles.metricBar}
      data-emphasized={emphasized || undefined}
      data-critical={critical || undefined}
      data-cleared={cleared || undefined}
    >
      <div><strong>{label}</strong><span>{value == null ? missingLabel : formatValue(value)}{critical ? <small className={styles.criticalInline}>半分未満</small> : null}</span></div>
      <span className={styles.barTrack} data-coverage={referenceValue != null || undefined}>
        <span className={styles.barFill} style={{ width: `${width}%` }} />
        {referencePosition != null ? <span className={styles.barReference} style={{ left: `${referencePosition}%` }} /> : null}
      </span>
    </div>
  );
}

function DesktopTable({ model, scopeLabel }: { model: PrefecturePeerComparisonResult; scopeLabel: string }) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <caption>R6・法適用・{scopeLabel}の{model.prefectureName}市町村比較</caption>
        <thead><tr>
          <th scope="col">市町村</th>
          <th scope="col">20m³使用料（月額）</th>
          <th scope="col">経費回収率</th>
          <th scope="col">営業収益÷営業費用（サイト算定）</th>
          <th scope="col">基準外繰入金</th>
        </tr></thead>
        <tbody>{model.rows.map((row) => <DesktopRow key={`${row.municipalityCode}-${row.municipalityName}`} row={row} />)}</tbody>
      </table>
    </div>
  );
}

function DesktopRow({ row }: { row: PrefecturePeerComparisonRow }) {
  return (
    <tr
      id={comparisonRowAnchorId(row)}
      className={row.isCurrent ? styles.currentRow : undefined}
      data-comparison-unit={row.comparisonUnitKey}
    >
      <th scope="row">
        <span className={styles.municipalityNameLine}><MunicipalityLink row={row} /><BusinessTypeBadge row={row} /><JointOperationBadge row={row} /></span>
        <MunicipalityMeta row={row} showCurrent />
      </th>
      {row.eligible ? <>
        <td>{formatHouseholdFee(row.householdFee20m3Yen)}</td>
        <td>{formatPercent(row.expenseRecoveryRate)}</td>
        <td><OperatingCoverageValue row={row} /></td>
        <td>{formatMoneyThousandYen(row.nonStandardTransfer)}</td>
      </> : <td colSpan={4} className={styles.excludedCell}><span>比較対象外</span>{row.exclusionReason?.label ?? "R6法適用データなし"}</td>}
    </tr>
  );
}

function comparisonRowAnchorId(row: PrefecturePeerComparisonRow) {
  return `comparison-row-${row.comparisonUnitKey.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function MobileCards({ model }: { model: PrefecturePeerComparisonResult }) {
  return (
    <div className={styles.mobileCards} aria-label={`${model.prefectureName}市町村比較`}>
      {model.rows.map((row) => (
        <article
          key={`${row.municipalityCode}-${row.municipalityName}`}
          id={`mobile-${comparisonRowAnchorId(row)}`}
          className={row.isCurrent ? styles.mobileCurrent : styles.mobileCard}
          data-comparison-unit={row.comparisonUnitKey}
        >
          <header><div><span className={styles.municipalityNameLine}><MunicipalityLink row={row} /><BusinessTypeBadge row={row} /><JointOperationBadge row={row} /></span><MunicipalityMeta row={row} /></div>{row.isCurrent ? <span>表示中</span> : null}</header>
          {row.eligible ? <dl>
            <div><dt>20m³使用料（月額）</dt><dd>{formatHouseholdFee(row.householdFee20m3Yen)}</dd></div>
            <div><dt>経費回収率</dt><dd>{formatPercent(row.expenseRecoveryRate)}</dd></div>
            <div className={styles.mobileWide}><dt>営業収益÷営業費用（サイト算定）</dt><dd><OperatingCoverageValue row={row} /></dd></div>
            <div className={styles.mobileWide}><dt>基準外繰入金</dt><dd>{formatMoneyThousandYen(row.nonStandardTransfer)}</dd></div>
          </dl> : <p className={styles.mobileExcluded}><span>比較対象外</span>{row.exclusionReason?.label ?? "R6法適用データなし"}</p>}
        </article>
      ))}
    </div>
  );
}

function MunicipalityLink({ row }: { row: PrefecturePeerComparisonRow }) {
  if (!row.detailMunicipalityCode || !row.eligible) return <strong>{row.municipalityName}</strong>;
  const view = row.isJointOperation ? "finance" : "prefecture";
  const query = new URLSearchParams({ business: row.businessKey, view });
  const hash = row.isJointOperation ? "" : "#prefecture-comparison";
  return <Link href={`/municipalities/${row.detailMunicipalityCode}?${query.toString()}${hash}`}>{row.municipalityName}</Link>;
}

function BusinessTypeBadge({ row }: { row: PrefecturePeerComparisonRow }) {
  const label = businessTypeLabel(row);
  return label ? <span className={styles.businessTypeBadge}>{label}</span> : null;
}

function JointOperationBadge({ row }: { row: PrefecturePeerComparisonRow }) {
  return row.isJointOperation ? <span className={styles.jointOperationBadge}>組合運営</span> : null;
}

function MunicipalityMeta({
  row,
  showCurrent = false
}: {
  row: PrefecturePeerComparisonRow;
  showCurrent?: boolean;
}) {
  const codes = row.representedMunicipalityCodes.length > 0
    ? row.representedMunicipalityCodes.join(" / ")
    : row.municipalityCode || "コード不明";
  return <>
    <small>{codes}{showCurrent && row.isCurrent ? " · 表示中" : ""}</small>
    {row.isJointOperation && row.operatorMunicipalityName ? (
      <small className={styles.operatorLine}>
        組合全体の決算 · 運営: {row.operatorMunicipalityName}
        {row.jointOperationSourceUrl ? <a href={row.jointOperationSourceUrl} target="_blank" rel="noreferrer" aria-label={row.jointOperationSourceLabel ?? "組合運営の公式根拠"}>公式根拠</a> : null}
      </small>
    ) : null}
  </>;
}

function OperatingCoverageValue({ row }: { row: PrefecturePeerComparisonRow }) {
  if (row.operatingCoverageRatio == null || !Number.isFinite(row.operatingCoverageRatio)) {
    return <strong className={styles.unavailable}>算定不可</strong>;
  }
  const coverage = operatingCoverageDisplayValue(row.operatingCoverageRatio);
  const critical = isOperatingCoverageCritical(row.operatingCoverageRatio);
  const mismatch = hasRecoveryCoverageMismatch(row);
  const status = critical ? "critical" : "cleared";
  const statusLabel = critical
    ? mismatch ? "半分未満・経費回収率100%以上" : "半分未満"
    : mismatch ? "経費回収率100%以上でも全額未達" : null;
  return <span className={styles.coverageValue} data-status={status}>
    <strong>{formatOperatingCoverage(row.operatingCoverageRatio)}</strong>
    {statusLabel ? <small className={styles.coverageStatusBadge} data-tone={critical ? "critical" : "context"}>{statusLabel}</small> : null}
  </span>;
}

function formatHouseholdFee(value: number | null) {
  return value == null || !Number.isFinite(value) ? "未取得" : `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function formatOperatingCoverageForAria(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "算定不可";
  return value < OPERATING_COVERAGE_CRITICAL_THRESHOLD
    ? `${formatOperatingCoverage(value)}で、50%未満`
    : formatOperatingCoverage(value);
}

function formatChartFee(value: number | null) {
  return value == null || !Number.isFinite(value) ? "未取得" : `${Math.round(value).toLocaleString("ja-JP")}円 / 月`;
}

function hasRecoveryCoverageMismatch(row: PrefecturePeerComparisonRow) {
  return row.expenseRecoveryRate != null
    && row.expenseRecoveryRate >= 100
    && row.operatingCoverageRatio != null
    && row.operatingCoverageRatio < 100;
}

function operatingCoverageContext(row: PrefecturePeerComparisonRow | null) {
  if (!row?.eligible || row.operatingCoverageRatio == null) return null;
  if (row.operatingCoverageRatio >= 100) return `営業収益だけで営業費用の全額を賄えています（${formatOperatingCoverage(row.operatingCoverageRatio)}）。`;
  if (row.operatingCoverageRatio < OPERATING_COVERAGE_CRITICAL_THRESHOLD) {
    return `営業収益で賄えているのは営業費用の${formatOperatingCoverage(row.operatingCoverageRatio)}にとどまり、半分未満です。`;
  }
  if (hasRecoveryCoverageMismatch(row)) {
    return `経費回収率は100%以上でも、営業収益で賄えている営業費用は${formatOperatingCoverage(row.operatingCoverageRatio)}です。`;
  }
  return `営業収益で、営業費用の${formatOperatingCoverage(row.operatingCoverageRatio)}を賄えています。`;
}

function formatOperatingCoverage(value: number) {
  const rounded = operatingCoverageDisplayValue(value);
  if (value < OPERATING_COVERAGE_CRITICAL_THRESHOLD && rounded >= OPERATING_COVERAGE_CRITICAL_THRESHOLD) {
    return `${(Math.floor(value * 100) / 100).toFixed(2)}%`;
  }
  return `${rounded.toFixed(1)}%`;
}

function businessTypeLabel(row: PrefecturePeerComparisonRow) {
  if (row.businessKey === PREFECTURE_PEER_PUBLIC_SEWER_BUSINESS_KEY) return "公共";
  if (row.businessKey === PREFECTURE_PEER_TOKKAN_BUSINESS_KEY) return "特環";
  return null;
}

function median(values: Array<number | null>) {
  const sorted = values.filter((value): value is number => value != null && Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function comparisonScaleMax(values: Array<number | null>, minimum: number, step: number) {
  const max = Math.max(0, ...values.filter((value): value is number => value != null && Number.isFinite(value)));
  return Math.max(minimum, Math.ceil(max / step) * step);
}
