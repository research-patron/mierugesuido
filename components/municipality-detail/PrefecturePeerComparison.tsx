import Link from "next/link";
import {
  BadgeJapaneseYen,
  BarChart3,
  ChevronDown,
  CircleAlert,
  Info,
  Landmark,
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
  const expenseRecoveryMedian = median(eligibleRows.map((row) => row.expenseRecoveryRate));
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
          icon={Landmark}
          label="基準外繰入金あり"
          value={`${model.summary.positiveCounts.nonStandardTransfer}事業体`}
          note="繰出基準外の一般会計等からの繰入"
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
          icon={BadgeJapaneseYen}
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
              <strong>営業収支と公費・繰入の内訳</strong>
              <small>経費回収率との違いと、第40表の公式値を確認</small>
            </span>
            <ChevronDown className={styles.detailsChevron} size={20} aria-hidden="true" />
          </summary>
          <div className={styles.financialDetailsBody}>
            <MetricComparison
              icon={BarChart3}
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
              formulaNote="営業収支比率は一般に（営業収益−受託工事収益等）÷（営業費用−受託工事費等）×100で分析します。本データでは受託工事収益を別掲できないため、営業収益÷営業費用×100の簡易比率です。値は改変せず、50%未満は赤、50%以上は緑で区別します。50%は表示上の注意区分で十分性の基準ではありません。"
            />
            <OperatingFundingContext row={current} />
          </div>
        </details>
      ) : null}

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
          <p>営業収支と一般会計からの収入・繰入の関係は、上の補足表示で項目を分けて確認できます。</p>
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

function OperatingFundingContext({ row }: { row: PrefecturePeerComparisonRow }) {
  const breakdown = row.transferBasisBreakdown;
  const transferRows = [
    {
      label: "雨水処理負担金",
      accountingClass: "営業収益",
      values: breakdown.rainwaterBurden
    },
    {
      label: "他会計補助金",
      accountingClass: "営業外収益",
      values: breakdown.otherAccountSubsidy
    },
    {
      label: "資本勘定の他会計補助金",
      accountingClass: "資本的収入",
      values: breakdown.capitalOtherAccountSubsidy
    }
  ];
  return (
    <section className={styles.fundingCard} aria-labelledby="operating-funding-title">
      <header className={styles.fundingHeading}>
        <span className={styles.chartIcon} aria-hidden="true"><Landmark size={20} /></span>
        <div>
          <p className={styles.eyebrow}>R6 第40表｜公費・繰入を分けて見る</p>
          <h3 id="operating-funding-title">公費・繰入の内訳</h3>
          <p>営業収益が営業費用を下回る場合、使用料で賄うべき費用の不足を基準外繰入金で補っている可能性があります。ただし、雨水処理に加え、汚水関連でも分流式下水道や高度処理など、公的便益を理由に基準内公費負担となる経費があります。また、基準内の他会計補助金が営業外収益に計上される場合もあるため、この比率だけで基準外繰入金の有無や金額は判定できません。</p>
        </div>
      </header>
      <div className={styles.transferTableScroll}>
        <table className={styles.transferTable}>
          <caption>R6繰入金に関する調（第40表）の公費・繰入内訳</caption>
          <thead>
            <tr>
              <th scope="col">科目</th>
              <th scope="col">会計上の区分</th>
              <th scope="col">実額</th>
              <th scope="col">基準内</th>
              <th scope="col">基準外</th>
            </tr>
          </thead>
          <tbody>
            {transferRows.map((item) => (
              <tr key={item.label}>
                <th scope="row">{item.label}</th>
                <td>{item.accountingClass}</td>
                <td>{formatTransferAmount(item.values.total)}</td>
                <td>{formatTransferAmount(item.values.standard)}</td>
                <td>{formatTransferAmount(item.values.nonStandard)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.transferTotal}>
        <span>第40表｜基準外繰入金合計</span>
        <strong>{formatTransferAmount(breakdown.nonStandardTransferTotal)}</strong>
      </div>
      <div className={styles.fundingNotes}>
        <p><strong>他会計補助金</strong>は科目名であり、基準内・基準外の双方を含み得ます。<strong>基準外繰入金</strong>は、実繰入額が基準額を超える部分や、繰出基準にない事由による部分です。</p>
        <p>基準内額は、実額と基準外額をともに正常取得でき、基準外額が実額以下の場合だけ差額で算定しています。「—」は判定に必要な値を取得できない場合です。</p>
        <p>基準外繰入金合計には、収益勘定だけでなく資本勘定や他会計借入金が含まれる場合があります。営業損失と同額になるとは限りません。</p>
        <p><a href="https://www.mlit.go.jp/mizukokudo/sewerage/crd_sewerage_tk_000140.html" target="_blank" rel="noreferrer">国土交通省「下水道事業の経営原則」</a>では「雨水公費・汚水私費」を原則としつつ、分流式下水道や高度処理などの一部を公費負担対象としています。</p>
      </div>
    </section>
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
        <td>{formatMoneyThousandYen(row.nonStandardTransfer)}</td>
      </> : <td colSpan={3} className={styles.excludedCell}><span>比較対象外</span>{row.exclusionReason?.label ?? "R6法適用データなし"}</td>}
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

function formatHouseholdFee(value: number | null) {
  return value == null || !Number.isFinite(value) ? "未取得" : `${Math.round(value).toLocaleString("ja-JP")}円`;
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
    return `${rate}で、この年度の下水道使用料収入が対象となる汚水処理費を全額賄っています。将来の更新費用まで含めた料金判断ではありません。`;
  }
  return `${rate}で、この年度の下水道使用料収入だけでは対象となる汚水処理費の全額に届いていません。`;
}


function formatTransferAmount(value: number | null) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : `${Math.round(value).toLocaleString("ja-JP")}千円`;
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
