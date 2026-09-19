import Link from "next/link";
import React, { type CSSProperties } from "react";
import {
  BadgeJapaneseYen,
  BarChart3,
  ChevronDown,
  CircleAlert,
  Info,
  MapPinned
} from "lucide-react";
import {
  OPERATING_COVERAGE_CRITICAL_THRESHOLD,
  PREFECTURE_PEER_PUBLIC_SEWER_BUSINESS_KEY,
  PREFECTURE_PEER_TOKKAN_BUSINESS_KEY,
  operatingCoverageDisplayValue,
  type PrefecturePeerComparisonResult,
  type PrefecturePeerComparisonRow
} from "@/lib/prefecturePeerComparison";
import { buildFeeRankSummary } from "@/lib/citizenMunicipalityAssessment";
import { formatPercent } from "@/lib/format";
import styles from "./PrefecturePeerComparison.module.css";

export function PrefecturePeerComparison({
  model,
  businessLabel,
  availableMunicipalityDetailCodes = []
}: {
  model: PrefecturePeerComparisonResult;
  businessLabel: string;
  availableMunicipalityDetailCodes?: readonly string[];
}) {
  const availableDetailCodes = new Set(availableMunicipalityDetailCodes);
  const current = model.rows.find((row) => row.isCurrent) ?? null;
  const eligibleRows = model.rows.filter((row) => row.eligible);
  const feeMedian = median(eligibleRows.map((row) => row.householdFee20m3Yen));
  const expenseRecoveryMedian = median(eligibleRows.map((row) => row.expenseRecoveryRate));
  const operatingCoverageMedian = median(eligibleRows.map((row) => row.operatingCoverageRatio));
  const comparisonScales = buildInlineComparisonScales(eligibleRows);
  const feeRank = buildFeeRankSummary(model.rows, current?.comparisonUnitKey);
  const nearestPeers = feeRank
    ? nearestFeePeers(model.rows, feeRank.currentComparisonUnitKey, feeRank.currentFee)
    : [];
  const comparesPublicAndTokkan = model.businessKey === PREFECTURE_PEER_PUBLIC_SEWER_BUSINESS_KEY
    || model.businessKey === PREFECTURE_PEER_TOKKAN_BUSINESS_KEY;
  const scopeLabel = comparesPublicAndTokkan ? "公共＋特環" : `${businessLabel}（比較対象外）`;
  const areaLabel = prefectureAreaLabel(model.prefectureName);
  const scopeDescription = comparesPublicAndTokkan
    ? "R6に地方公営企業法を適用する公共下水道と特環を、本サイト独自に都道府県内で横並び比較します。総務省の公式類似団体区分では公共下水道と特環は別区分です。両方がある自治体は表示中の事業種別を優先し、比較可能なR6決算がない場合だけ他方を採用します。"
    : `R6の県内順位・中央値は、地方公営企業法を適用する公共下水道と特環だけを対象とします。選択中の「${businessLabel}」は順位・中央値を算定しません。`;

  return (
    <div className={styles.root} id="prefecture-comparison">
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>R6 都道府県内比較</p>
          <h2>{model.prefectureName}の市町村を、同じ条件で比べる</h2>
          <p>料金の順位と、近い料金の事業体を先に確認できます。</p>
        </div>
        <div className={styles.conditions} aria-label="比較条件">
          <span>R6</span><span>{scopeLabel}</span><span>{comparesPublicAndTokkan ? "法適用のみ" : "順位・中央値なし"}</span>
        </div>
      </header>

      <section className={styles.positionSection} aria-labelledby="fee-position-title">
        <div className={styles.positionHeading}>
          <div>
            <p className={styles.eyebrow}>まず知りたい料金の位置</p>
            <h3 id="fee-position-title">このまちの料金は、{areaLabel}でどのくらい？</h3>
          </div>
          <p>一般家庭用20m³月額を、上の比較条件で高い順に並べています。</p>
        </div>

        {feeRank ? (
          <>
            <div className={styles.summaryGrid} aria-label={`20m³月額料金の${areaLabel}順位と中央値との差`}>
              <SummaryCard
                icon={MapPinned}
                tone="rank"
                label="料金が高い方から"
                value={`${feeRank.tied ? "同率" : ""}${feeRank.rank}位 / ${feeRank.total}事業体`}
                note={`${current?.isJointOperation ? "この組合会計" : current?.municipalityName ?? "この事業体"}は月額${formatHouseholdFee(feeRank.currentFee)}`}
              />
              <SummaryCard
                icon={BadgeJapaneseYen}
                tone="difference"
                label={`${model.prefectureName}中央値との差`}
                value={formatSignedYen(feeRank.differenceYen)}
                note={`中央値 ${formatHouseholdFee(feeRank.median)} · ${formatGapPercent(feeRank.differencePercent)}`}
              />
            </div>
            <p className={styles.positionSentence}>
              {feePositionSentence(model.prefectureName, feeRank.differenceYen, feeRank.differencePercent)}
              {feeRank.tied ? ` 同じ月額の事業体が${feeRank.tieCount}事業体あります。` : ""}
            </p>
          </>
        ) : (
          <div className={styles.currentExcluded} role="status">
            <CircleAlert size={18} aria-hidden="true" />
            <p><strong>この条件では{areaLabel}順位を算定できません。</strong>{feeRankUnavailableReason(current, areaLabel)}</p>
          </div>
        )}

        {feeRank && nearestPeers.length > 0 ? (
          <div className={styles.nearestPeers}>
            <div className={styles.nearestHeading}>
              <h4>料金が近い事業体</h4>
              <p>月額の差が小さい順に{nearestPeers.length}事業体を表示しています。</p>
            </div>
            <ol>
              {nearestPeers.map((row) => (
                <li key={row.comparisonUnitKey}>
                  <div className={styles.nearestPeerName}>
                    <span className={styles.municipalityNameLine}><MunicipalityLink row={row} availableDetailCodes={availableDetailCodes} /><BusinessTypeBadge row={row} /><JointOperationBadge row={row} /></span>
                    {row.isJointOperation ? <small>組合全体の料金</small> : null}
                  </div>
                  <div className={styles.nearestPeerValue}>
                    <strong>{formatHouseholdFee(row.householdFee20m3Yen)}</strong>
                    <small>{formatPeerDifference(row.householdFee20m3Yen, feeRank.currentFee)}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>

      <details className={styles.scopeDetails}>
        <summary>比較条件の詳しい説明 <ChevronDown size={16} aria-hidden="true" /></summary>
        <p>{scopeDescription}</p>
      </details>

      <section className={styles.comparisonGrid} aria-label="表示中の市町村と都道府県内中央値の比較">
        <MetricComparison
          icon={BadgeJapaneseYen}
          tone="fee"
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
          icon={BadgeJapaneseYen}
          tone="recovery"
          eyebrow="経費回収率を比べる"
          title="使用料で対象費用をどこまで賄えているか"
          description="下水道使用料収入を、公費負担分等を除く汚水処理費で割った公式指標です。100%以上なら、この年度の使用料収入で対象費用を全額賄っています。"
          currentLabel={current?.municipalityName ?? "この市町村"}
          currentValue={current?.eligible ? current.expenseRecoveryRate : null}
          medianLabel={`${model.prefectureName} 中央値`}
          medianValue={expenseRecoveryMedian}
          scaleMax={comparisonScaleMax([current?.eligible ? current.expenseRecoveryRate : null, expenseRecoveryMedian, 100], 120, 20)}
          formatValue={(value) => `${value.toFixed(1)}%`}
          formatAxisEnd={(value) => `${value.toFixed(0)}%`}
          ariaLabel={`${model.prefectureName}の経費回収率比較。${current?.municipalityName ?? "この市町村"}は${formatPercent(current?.eligible ? current.expenseRecoveryRate : null)}、都道府県内中央値は${formatPercent(expenseRecoveryMedian)}。`}
          axisStartLabel="0%"
          referenceValue={100}
          referenceLabel="100%（全額）"
          contextLabel={current?.eligible ? `経費回収率 ${formatPercent(current.expenseRecoveryRate)}` : undefined}
          contextText={expenseRecoveryContext(current)}
          formulaNote="経費回収率＝下水道使用料収入÷汚水処理費（公費負担分等を除く）×100。料金表上の20m³月額とは別の決算指標です。"
        />
      </section>

      {current?.eligible ? (
        <details className={styles.financialDetails}>
          <summary>
            <span className={styles.detailsIcon} aria-hidden="true"><Info size={19} /></span>
            <span>
              <strong>営業収支も確認する</strong>
              <small>経費回収率と会計上の営業損益の違い</small>
            </span>
            <ChevronDown className={styles.detailsChevron} size={20} aria-hidden="true" />
          </summary>
          <div className={styles.financialDetailsBody}>
            <MetricComparison
              icon={BarChart3}
              tone="operating"
              eyebrow="補足｜損益計算書の営業収支"
              title="営業収益で営業費用をどこまで賄えているか"
              description="営業損益を見る比率です。営業収益には雨水処理負担金など正当な公費負担も含まれるため、使用料の十分性とは分けて読みます。"
              currentLabel={current.municipalityName}
              currentValue={current.operatingCoverageRatio}
              medianLabel={`${model.prefectureName} 中央値`}
              medianValue={operatingCoverageMedian}
              scaleMax={comparisonScaleMax([current.operatingCoverageRatio, operatingCoverageMedian, 100], 120, 20)}
              formatValue={formatOperatingCoverage}
              formatAxisEnd={(value) => `${value.toFixed(0)}%`}
              ariaLabel={`${model.prefectureName}の、営業収益で賄えている営業費用の割合の比較。${current.municipalityName}は${formatOperatingCoverageForAria(current.operatingCoverageRatio)}、都道府県内中央値は${formatOperatingCoverageForAria(operatingCoverageMedian)}。`}
              axisStartLabel="0%"
              referenceValue={100}
              referenceLabel="100%（全額）"
              criticalBelow={OPERATING_COVERAGE_CRITICAL_THRESHOLD}
              contextText={operatingCoverageContext(current)}
              formulaNote="営業収益÷営業費用×100の簡易比率です。50%未満は赤、50%以上は緑で表示しています。"
            />
          </div>
        </details>
      ) : null}

      <section className={styles.fullListSection} aria-labelledby="full-prefecture-fee-comparison-title">
        <header className={styles.fullListHeading}>
          <div>
            <h3 id="full-prefecture-fee-comparison-title">{areaLabel}の全事業体と対象外の市町村</h3>
            <small>比較対象{model.summary.eligibleComparisonUnits}事業体・対象外{model.summary.excludedMunicipalities}市町村</small>
          </div>
        </header>
        <div className={styles.fullListBody}>
          <section className={styles.tableSection} aria-labelledby="peer-table-title">
            <div className={styles.tableHeading}>
              <div>
                <p className={styles.eyebrow}>R6・法適用・{scopeLabel}</p>
                <h3 id="peer-table-title">市町村ごとの料金・財務比較</h3>
                <p className={styles.tableScaleNote}>一覧は自治体コード順です。数値に加えて棒の長さでも比較できます。経費回収率の濃い縦線は100%を示します。</p>
              </div>
            </div>
            <DesktopTable model={model} scopeLabel={scopeLabel} scales={comparisonScales} availableDetailCodes={availableDetailCodes} />
            <MobileCards model={model} scales={comparisonScales} availableDetailCodes={availableDetailCodes} />
            <div className={styles.classificationNote}>
              {model.rows.some((row) => row.isJointOperation) ? (
                <p><strong>組合運営</strong>は構成市町村を1行にまとめた組合全体の決算値です。市町村別に配分した金額ではなく、順位・中央値では1事業体として1回だけ数え、平均・合計にも1回だけ集計します。</p>
              ) : null}
              <p><strong>組合関係の収録範囲</strong>は、構成市町村と事業の公式根拠を確認できた関係に限ります。未確認の組合運営は比較に反映されない場合があります。</p>
              <p>営業収支は上の補足表示で確認できます。使用料による費用回収とは対象範囲が異なります。</p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  label,
  value,
  note
}: {
  icon: typeof MapPinned;
  tone: "rank" | "difference";
  label: string;
  value: string;
  note: string;
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
  tone,
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
  tone: "fee" | "recovery" | "operating";
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
    <figure className={styles.chartCard} data-tone={tone} aria-label={ariaLabel}>
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

type InlineComparisonScales = {
  householdFee: number;
  expenseRecovery: number;
};

function DesktopTable({
  model,
  scopeLabel,
  scales,
  availableDetailCodes
}: {
  model: PrefecturePeerComparisonResult;
  scopeLabel: string;
  scales: InlineComparisonScales;
  availableDetailCodes: ReadonlySet<string>;
}) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <caption>R6・法適用・{scopeLabel}の{model.prefectureName}市町村比較</caption>
        <thead><tr>
          <th scope="col">市町村</th>
          <th scope="col">20m³使用料（月額）</th>
          <th scope="col">経費回収率</th>
        </tr></thead>
        <tbody>{model.rows.map((row) => <DesktopRow key={`${row.municipalityCode}-${row.municipalityName}`} row={row} scales={scales} availableDetailCodes={availableDetailCodes} />)}</tbody>
      </table>
    </div>
  );
}

function DesktopRow({
  row,
  scales,
  availableDetailCodes
}: {
  row: PrefecturePeerComparisonRow;
  scales: InlineComparisonScales;
  availableDetailCodes: ReadonlySet<string>;
}) {
  return (
    <tr
      id={comparisonRowAnchorId(row)}
      className={row.isCurrent ? styles.currentRow : undefined}
      data-comparison-unit={row.comparisonUnitKey}
    >
      <th scope="row">
        <span className={styles.municipalityNameLine}><MunicipalityLink row={row} availableDetailCodes={availableDetailCodes} /><BusinessTypeBadge row={row} /><JointOperationBadge row={row} /></span>
        <MunicipalityMeta row={row} showCurrent />
      </th>
      {row.eligible ? <>
        <td><InlineComparisonMetric value={row.householdFee20m3Yen} max={scales.householdFee} text={formatHouseholdFee(row.householdFee20m3Yen)} tone="fee" /></td>
        <td><InlineComparisonMetric value={row.expenseRecoveryRate} max={scales.expenseRecovery} text={formatPercent(row.expenseRecoveryRate)} tone="recovery" referenceValue={100} /></td>
      </> : <td colSpan={2} className={styles.excludedCell}><span>比較対象外</span>{row.exclusionReason?.label ?? "R6法適用データなし"}</td>}
    </tr>
  );
}

function comparisonRowAnchorId(row: PrefecturePeerComparisonRow) {
  return `comparison-row-${row.comparisonUnitKey.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function MobileCards({
  model,
  scales,
  availableDetailCodes
}: {
  model: PrefecturePeerComparisonResult;
  scales: InlineComparisonScales;
  availableDetailCodes: ReadonlySet<string>;
}) {
  return (
    <div className={styles.mobileCards} aria-label={`${model.prefectureName}市町村比較`}>
      {model.rows.map((row) => (
        <article
          key={`${row.municipalityCode}-${row.municipalityName}`}
          id={`mobile-${comparisonRowAnchorId(row)}`}
          className={row.isCurrent ? styles.mobileCurrent : styles.mobileCard}
          data-comparison-unit={row.comparisonUnitKey}
        >
          <header><div><span className={styles.municipalityNameLine}><MunicipalityLink row={row} availableDetailCodes={availableDetailCodes} /><BusinessTypeBadge row={row} /><JointOperationBadge row={row} /></span><MunicipalityMeta row={row} /></div>{row.isCurrent ? <span>表示中</span> : null}</header>
          {row.eligible ? <dl>
            <div className={styles.mobileWide}><dt>20m³使用料（月額）</dt><dd><InlineComparisonMetric value={row.householdFee20m3Yen} max={scales.householdFee} text={formatHouseholdFee(row.householdFee20m3Yen)} tone="fee" /></dd></div>
            <div className={styles.mobileWide}><dt>経費回収率</dt><dd><InlineComparisonMetric value={row.expenseRecoveryRate} max={scales.expenseRecovery} text={formatPercent(row.expenseRecoveryRate)} tone="recovery" referenceValue={100} /></dd></div>
          </dl> : <p className={styles.mobileExcluded}><span>比較対象外</span>{row.exclusionReason?.label ?? "R6法適用データなし"}</p>}
        </article>
      ))}
    </div>
  );
}

function InlineComparisonMetric({
  value,
  max,
  text,
  tone,
  referenceValue
}: {
  value: number | null;
  max: number;
  text: string;
  tone: "fee" | "recovery";
  referenceValue?: number;
}) {
  const width = inlineComparisonBarWidth(value, max);
  const referencePosition = referenceValue == null
    ? null
    : inlineComparisonBarWidth(referenceValue, max);
  return (
    <span className={styles.inlineMetric} data-tone={tone}>
      <strong>{text}</strong>
      <span className={styles.inlineBarTrack} aria-hidden="true">
        <span className={styles.inlineBarFill} style={{ width: `${width}%` }} />
        {referencePosition != null ? (
          <span
            className={styles.inlineBarReference}
            style={{ left: `${referencePosition}%` } as CSSProperties}
          />
        ) : null}
      </span>
    </span>
  );
}

export function inlineComparisonBarWidth(
  value: number | null | undefined,
  max: number
) {
  if (value == null || !Number.isFinite(value) || value <= 0 || !Number.isFinite(max) || max <= 0) return 0;
  const ratio = value / max;
  return Math.min(100, Math.max(0, ratio * 100));
}

function buildInlineComparisonScales(rows: PrefecturePeerComparisonRow[]): InlineComparisonScales {
  return {
    householdFee: comparisonScaleMax(rows.map((row) => row.householdFee20m3Yen), 1_000, 500),
    expenseRecovery: comparisonScaleMax([...rows.map((row) => row.expenseRecoveryRate), 100], 120, 20)
  };
}

function MunicipalityLink({
  row,
  availableDetailCodes
}: {
  row: PrefecturePeerComparisonRow;
  availableDetailCodes: ReadonlySet<string>;
}) {
  if (!row.detailMunicipalityCode || !row.eligible) return <strong>{row.municipalityName}</strong>;
  if (row.isJointOperation && !availableDetailCodes.has(row.detailMunicipalityCode)) {
    return (
      <span className={styles.unavailableDetail}>
        <strong>{row.municipalityName}</strong>
        <small>組合全体の詳細は当サイトでは未掲載</small>
      </span>
    );
  }
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
    <span className={styles.municipalityMetaLine}>
      <small>{codes}</small>
      {showCurrent && row.isCurrent ? <span className={styles.currentBadge}>表示中</span> : null}
    </span>
    {row.isJointOperation && row.operatorMunicipalityName ? (
      <small className={styles.operatorLine}>
        組合全体の決算 · 運営: {row.operatorMunicipalityName}
        {row.jointOperationSourceUrl ? <a href={row.jointOperationSourceUrl} target="_blank" rel="noreferrer" aria-label={row.jointOperationSourceLabel ?? "組合運営の公式根拠"}>公式根拠</a> : null}
      </small>
    ) : null}
  </>;
}

function formatHouseholdFee(value: number | null) {
  return value == null || !Number.isFinite(value) ? "未取得" : `${Math.round(value).toLocaleString("ja-JP")}円`;
}

export function nearestFeePeers(
  rows: PrefecturePeerComparisonRow[],
  currentComparisonUnitKey: string,
  currentFee: number,
  limit = 3
) {
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      if (
        !row.eligible
        || row.comparisonUnitKey === currentComparisonUnitKey
        || row.householdFee20m3Yen == null
        || !Number.isFinite(row.householdFee20m3Yen)
        || row.householdFee20m3Yen <= 0
        || seen.has(row.comparisonUnitKey)
      ) return false;
      seen.add(row.comparisonUnitKey);
      return true;
    })
    .sort((left, right) => {
      const leftDifference = Math.abs((left.householdFee20m3Yen ?? 0) - currentFee);
      const rightDifference = Math.abs((right.householdFee20m3Yen ?? 0) - currentFee);
      return leftDifference - rightDifference
        || left.municipalityCode.localeCompare(right.municipalityCode, "ja");
    })
    .slice(0, Math.max(0, limit));
}

function formatSignedYen(value: number) {
  const rounded = Math.round(value);
  if (rounded === 0) return "差なし";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toLocaleString("ja-JP")}円`;
}

function formatGapPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "差率算定不可";
  if (Math.abs(value) < 0.05) return "ほぼ同額";
  return `中央値より${Math.abs(value).toFixed(1)}%${value > 0 ? "高い" : "低い"}`;
}

function feePositionSentence(prefectureName: string, differenceYen: number, differencePercent: number | null) {
  const rounded = Math.round(differenceYen);
  if (rounded === 0) return `${prefectureName}の中央値と同額です。`;
  const percentage = differencePercent == null || !Number.isFinite(differencePercent)
    ? ""
    : `（${Math.abs(differencePercent).toFixed(1)}%）`;
  return `${prefectureName}の中央値より${Math.abs(rounded).toLocaleString("ja-JP")}円${rounded > 0 ? "高い" : "低い"}水準です${percentage}。`;
}

function formatPeerDifference(peerFee: number | null, currentFee: number) {
  if (peerFee == null || !Number.isFinite(peerFee)) return "差額を算定できません";
  const difference = Math.round(peerFee - currentFee);
  if (difference === 0) return "表示中の事業体と同じ月額";
  return `表示中より${Math.abs(difference).toLocaleString("ja-JP")}円${difference > 0 ? "高い" : "低い"}`;
}

function feeRankUnavailableReason(row: PrefecturePeerComparisonRow | null, areaLabel: string) {
  if (!row) return ` 表示中の事業体を${areaLabel}比較データで特定できません。`;
  if (!row.eligible) return ` ${row.municipalityName}は比較対象外です。${row.exclusionReason?.label ?? "R6法適用データがありません。"}`;
  if (row.householdFee20m3Yen == null || !Number.isFinite(row.householdFee20m3Yen)) {
    return " 一般家庭用20m³月額が未取得のためです。";
  }
  return " 同じ条件で料金を比較できる事業体がありません。";
}

function prefectureAreaLabel(prefectureName: string) {
  if (prefectureName === "北海道") return "道内";
  if (prefectureName === "東京都") return "都内";
  if (prefectureName === "大阪府" || prefectureName === "京都府") return "府内";
  return "県内";
}

function formatOperatingCoverageForAria(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "算定不可";
  if (value < OPERATING_COVERAGE_CRITICAL_THRESHOLD) return `${formatOperatingCoverage(value)}で、半分未満・全額未達`;
  if (value < 100) return `${formatOperatingCoverage(value)}で、50%以上・全額未達`;
  return `${formatOperatingCoverage(value)}で、全額を賄う水準`;
}

function formatChartFee(value: number | null) {
  return value == null || !Number.isFinite(value) ? "未取得" : `${Math.round(value).toLocaleString("ja-JP")}円 / 月`;
}

function expenseRecoveryContext(row: PrefecturePeerComparisonRow | null) {
  if (!row?.eligible || row.expenseRecoveryRate == null) return null;
  const rate = formatPercent(row.expenseRecoveryRate);
  if (row.expenseRecoveryRate >= 100) {
    return `${rate}で、この年度の下水道使用料収入が対象となる汚水処理費を全額賄っています。`;
  }
  return `${rate}で、この年度の下水道使用料収入だけでは対象となる汚水処理費の全額に届いていません。`;
}


function hasRecoveryCoverageMismatch(row: PrefecturePeerComparisonRow) {
  return row.expenseRecoveryRate != null
    && row.expenseRecoveryRate >= 100
    && row.operatingCoverageRatio != null
    && row.operatingCoverageRatio < 100;
}

function operatingCoverageContext(row: PrefecturePeerComparisonRow | null) {
  if (!row?.eligible || row.operatingCoverageRatio == null) return null;
  if (row.operatingCoverageRatio > 100) return `営業収益が営業費用を上回り、営業利益が生じています（${formatOperatingCoverage(row.operatingCoverageRatio)}）。`;
  if (row.operatingCoverageRatio === 100) return "営業収益と営業費用が同額で、営業損益は0です。";
  if (row.operatingCoverageRatio < OPERATING_COVERAGE_CRITICAL_THRESHOLD) {
    return `営業収益で賄えているのは営業費用の${formatOperatingCoverage(row.operatingCoverageRatio)}にとどまり、営業損失が生じています。`;
  }
  if (hasRecoveryCoverageMismatch(row)) {
    return `経費回収率は100%以上ですが、営業収益で賄えている営業費用は${formatOperatingCoverage(row.operatingCoverageRatio)}で、営業損失が生じています。両指標は対象範囲が異なります。`;
  }
  return `営業収益で営業費用の${formatOperatingCoverage(row.operatingCoverageRatio)}を賄っていますが、全額には届かず営業損失が生じています。`;
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
