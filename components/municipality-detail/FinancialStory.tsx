import React, { useId, type CSSProperties, type ReactNode } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Database,
  Landmark,
  Minus,
  Scale,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import {
  analyzeFinancialStory,
  chooseMoneyScale,
  formatFinancialAmount,
  formatFinancialPercent,
  prepareBreakdown,
  type BalanceAnalysis,
  type FinancialBreakdownItem,
  type FinancialBreakdownGroup,
  type FinancialStoryDisplayModel,
  type IncomeAnalysis,
  type MoneyScale,
  type NetAssetsComponentChange,
  type PreparedBreakdown,
  type PreparedBreakdownItem
} from "@/lib/financialStory";
import styles from "./FinancialStory.module.css";

export type FinancialStoryProps = FinancialStoryDisplayModel;

type VisualBoxItem = PreparedBreakdownItem & {
  tone: "revenue" | "expense" | "profit" | "loss";
  details?: PreparedBreakdownItem[];
  shareLabel?: string;
};

export function FinancialStory(props: FinancialStoryProps) {
  const titleId = useId();
  const analysis = analyzeFinancialStory(props);
  const year = fiscalYearLabel(props.year);

  if (props.accountingType === "non_legal_applied") {
    return (
      <FinancialStoryState
        titleId={titleId}
        year={year}
        title="法非適用事業はこの決算構造図の対象外です"
        body="この図は、地方公営企業法の財務規定に基づく損益計算書と貸借対照表を同じ定義で比較するためのものです。会計基準が異なるため、法非適用事業は法適用事業と同じ尺度のボックス図にはしません。"
        trace={props.trace}
      />
    );
  }

  if (props.accountingType !== "legal_applied") {
    return (
      <FinancialStoryState
        titleId={titleId}
        year={year}
        title="会計区分を確認できません"
        body="法適用事業であることを確認できるまで、損益・貸借の図は表示しません。会計区分と原資料を確認してください。"
        trace={props.trace}
      />
    );
  }

  if (props.status?.state === "unavailable") {
    return (
      <FinancialStoryState
        titleId={titleId}
        year={year}
        title={props.status.label ?? "決算構造を表示できません"}
        body={props.status.message ?? "必要な決算項目が未取得です。未取得値を推測値や0円とみなして表示しません。"}
        trace={props.trace}
      />
    );
  }

  const overallState = storyState(analysis.income, analysis.balance, analysis.netAssetsChange, props.status?.state);
  const statusLabel = overallState === "limited" && (analysis.balance.totalNetAssets ?? 0) < 0
    ? "純資産がマイナス"
    : overallState === props.status?.state
      ? props.status?.label
      : undefined;
  const summaries = buildSummaries(analysis.income, analysis.balance, analysis.netAssetsChange);

  return (
    <section className={styles.root} aria-labelledby={titleId}>
      <div className={styles.headingRow}>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}>{year} 決算構造</p>
          <h2 id={titleId}>{year}の決算を、3つの要点で理解する</h2>
          <p>家庭用料金や経費回収率とは分けて、事業全体の収益・費用と資産の支え方を見ます。</p>
        </div>
        <StoryStatus state={overallState} label={statusLabel} />
      </div>

      {props.status?.message ? <p className={styles.statusMessage}>{props.status.message}</p> : null}

      <ol className={styles.summaryGrid} aria-label={`${year}決算の3つの要点`}>
        {summaries.map((summary, index) => (
          <li key={summary.label} className={styles.summaryCard}>
            <span className={styles.summaryNumber}>{index + 1}</span>
            <div>
              <span className={styles.summaryLabel}>{summary.label}</span>
              <strong>{summary.value}</strong>
              <span className={styles.summaryNote}>{summary.note}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className={styles.statementGrid}>
        <IncomeStatement year={year} income={props.income} analysis={analysis.income} />
        <BalanceSheet year={year} balance={props.balance} analysis={analysis.balance} />
      </div>

      <NetAssetsChange year={year} analysis={analysis.netAssetsChange} />

      <TraceDetails trace={props.trace} />
    </section>
  );
}

function IncomeStatement({
  year,
  income,
  analysis
}: {
  year: string;
  income: FinancialStoryProps["income"];
  analysis: IncomeAnalysis;
}) {
  const titleId = useId();
  const result = incomeResultCopy(analysis);
  const operatingProfitLoss = analysis.operatingRevenue != null && analysis.operatingExpense != null
    ? analysis.operatingRevenue - analysis.operatingExpense
    : null;
  const equationTotal = analysis.equation.total ?? 0;
  const leftItems = incomeVisualItems(
    analysis.equation.left,
    income?.expenseBreakdown ?? [],
    analysis.totalExpense ?? 0,
    "expense"
  );
  const rightItems = incomeVisualItems(
    analysis.equation.right,
    income?.revenueBreakdown ?? [],
    analysis.totalRevenue ?? 0,
    "revenue"
  );
  const leftTitle = analysis.equation.resultSide === "left" ? "費用＋純利益" : "費用";
  const rightTitle = analysis.equation.resultSide === "right" ? "収益＋純損失" : "収益";
  const detailedFrameHeights = equationFrameHeights(leftItems, rightItems);

  return (
    <article className={styles.statementCard} aria-labelledby={titleId}>
      <CardHeading
        icon={<Banknote size={21} aria-hidden="true" />}
        titleId={titleId}
        title="損益｜1年間の収益と費用"
        description="営業収益−営業費用が営業損益です。営業外損益・特別損益まで含めた総収益と総費用の差が、最終的な純損益になります。"
      />

      {!analysis.available || !analysis.visualizable ? (
        <InlineState messages={analysis.messages} />
      ) : (
        <figure className={styles.equationFigure}>
          <div className={styles.equationPlot} role="group" aria-label={`${year}損益の勘定式。${incomeEquationCopy(analysis)}`}>
            <EquationColumn title={leftTitle} total={equationTotal} items={leftItems} scale={analysis.scale} detailed frameHeights={detailedFrameHeights} />
            <span className={styles.equalsMark} aria-hidden="true">＝</span>
            <EquationColumn title={rightTitle} total={equationTotal} items={rightItems} scale={analysis.scale} detailed frameHeights={detailedFrameHeights} />
          </div>
          <p className={styles.accountingTermNote}><strong>用語の区別</strong>「他会計補助金（営業外収益）」には繰出基準内の補助も含まれます。基準外繰入金とは一致しません。</p>
        </figure>
      )}

      {analysis.available ? (
        <div className={classNames(styles.resultBand, resultToneClass(result.tone))}>
          {result.tone === "negative"
            ? <TrendingDown size={19} aria-hidden="true" />
            : result.tone === "positive"
              ? <TrendingUp size={19} aria-hidden="true" />
              : <Minus size={19} aria-hidden="true" />}
          <div>
            <strong>{result.title}</strong>
            <span>{result.note}</span>
          </div>
        </div>
      ) : null}

      <details className={styles.cardDetails}>
        <summary><span>収益・費用の全項目とデータ確認</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <dl className={styles.metricList}>
          <MetricPair label="営業収益" value={formatFinancialAmount(analysis.operatingRevenue, analysis.scale)} />
          <MetricPair label="営業外収益" value={formatFinancialAmount(analysis.nonOperatingRevenue, analysis.scale)} />
          <MetricPair label="営業費用" value={formatFinancialAmount(analysis.operatingExpense, analysis.scale)} />
          <MetricPair label="営業損益（営業収益−営業費用）" value={formatAdaptiveAmount(operatingProfitLoss)} />
          <MetricPair label="営業外費用" value={formatFinancialAmount(analysis.nonOperatingExpense, analysis.scale)} />
          <MetricPair label="当年度純損益" value={formatAdaptiveAmount(analysis.netIncome)} />
          <MetricPair label="総収益で総費用を賄えている割合" value={analysis.revenueCoverageRate == null ? "判定できません" : `${analysis.revenueCoverageRate.toFixed(1)}%`} />
        </dl>
        <MoneyTable
          caption={`${year}の損益データ（原表単位：千円）`}
          visible
          rows={[
            { label: "総収益", value: analysis.totalRevenue },
            ...(income?.revenueBreakdown ?? []),
            { label: "総費用", value: analysis.totalExpense },
            ...(income?.expenseBreakdown ?? []),
            { label: "当年度純損益", value: analysis.netIncome }
          ]}
        />
        <IntegrityMessages messages={analysis.messages} />
      </details>
    </article>
  );
}

function BalanceSheet({
  year,
  balance,
  analysis
}: {
  year: string;
  balance: FinancialStoryProps["balance"];
  analysis: BalanceAnalysis;
}) {
  const titleId = useId();
  const hasNetAssetsDeficit = Boolean(
    analysis.available &&
    analysis.reconciled &&
    (analysis.totalNetAssets ?? 0) < 0 &&
    (analysis.totalAssets ?? -1) >= 0 &&
    (analysis.totalLiabilities ?? -1) >= 0
  );

  return (
    <article className={styles.statementCard} aria-labelledby={titleId}>
      <CardHeading
        icon={<Landmark size={21} aria-hidden="true" />}
        titleId={titleId}
        title="貸借｜年度末の資産と財源"
        description="年度末の資産を、負債と純資産がどう支えているかを示します（資産 ＝ 負債 ＋ 純資産）。"
      />

      {hasNetAssetsDeficit ? (
        <>
          <BalanceDeficitRelationship analysis={analysis} />
          <div className={classNames(styles.resultBand, styles.resultNegative)}>
            <AlertCircle size={19} aria-hidden="true" />
            <div>
              <strong>純資産がマイナス（債務超過）</strong>
              <span>負債が資産を {formatAdaptiveAmount(Math.abs(analysis.totalNetAssets ?? 0))} 上回っています。負債は、繰延収益を含む貸借対照表上の合計です。これは資金不足や返済能力を直接示す指標ではありません。</span>
            </div>
          </div>
        </>
      ) : !analysis.available || !analysis.visualizable ? (
        <InlineState messages={analysis.messages} />
      ) : (
        <BalanceRelationship analysis={analysis} />
      )}

      <details className={styles.cardDetails}>
        <summary><span>勘定科目の内訳とデータ確認</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <dl className={styles.metricList}>
          <MetricPair label="資産に対する負債" value={formatBalancePercent(analysis.debtRatio)} />
          <MetricPair label="資産に対する純資産" value={formatBalancePercent(analysis.netAssetsRatio)} />
          <MetricPair label="資産合計" value={formatFinancialAmount(analysis.totalAssets, analysis.scale)} />
          <MetricPair label="負債＋純資産" value={formatFinancialAmount(analysis.fundingTotal, analysis.scale)} />
        </dl>
        <div className={styles.balanceDetailGrid}>
          <MoneyTable
            caption={`${year} 資産の内訳（原表単位：千円）`}
            visible
            rows={[
              { label: "固定資産", value: balance?.fixedAssets },
              { label: "流動資産", value: balance?.currentAssets },
              { label: "繰延資産", value: balance?.deferredAssets },
              { label: "資産合計", value: balance?.totalAssets }
            ]}
          />
          <MoneyTable
            caption={`${year} 負債の内訳（原表単位：千円）`}
            visible
            rows={[
              { label: "固定負債", value: balance?.fixedLiabilities },
              { label: "流動負債", value: balance?.currentLiabilities },
              { label: "繰延収益", value: balance?.deferredRevenue },
              { label: "負債合計", value: balance?.totalLiabilities }
            ]}
          />
          <MoneyTable
            caption={`${year} 純資産の内訳（原表単位：千円）`}
            visible
            rows={[
              { label: "資本金", value: balance?.capital },
              { label: "剰余金（小計）", value: balance?.surplus, note: "資本剰余金＋利益剰余金" },
              { label: "うち 資本剰余金", value: balance?.capitalSurplus, note: "小計の内訳。合計に再加算しません" },
              { label: "うち 利益剰余金", value: balance?.retainedEarnings, note: "小計の内訳。合計に再加算しません" },
              { label: "その他有価証券評価差額", value: balance?.otherSecuritiesValuationDifference },
              { label: "純資産合計", value: balance?.totalNetAssets }
            ]}
          />
        </div>
        <p className={styles.detailNote}>表示割合は元の総額から計算し、小数1桁で表示しています。</p>
        <IntegrityMessages messages={analysis.messages} />
      </details>
    </article>
  );
}

function NetAssetsChange({
  year,
  analysis
}: {
  year: string;
  analysis: ReturnType<typeof analyzeFinancialStory>["netAssetsChange"];
}) {
  const titleId = useId();
  const direction = netAssetsDirectionCopy(analysis);
  const componentsReady = analysis.components.length === 4 && analysis.componentsReconciled === true;
  const componentsInvalid = analysis.components.length === 4 && analysis.componentsReconciled === false;
  const changedComponents = [...analysis.components]
    .filter((component) => component.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const leadingComponent = changedComponents[0] ?? null;

  return (
    <article className={styles.netAssetsCard} aria-labelledby={titleId}>
      <CardHeading
        icon={<Scale size={21} aria-hidden="true" />}
        titleId={titleId}
        title="純資産｜前年より増えたか"
        description="純資産は資産から負債を差し引いた差額です。現金の増減とは一致しません。"
      />

      {!analysis.available ? (
        <InlineState messages={["前年度が法非適用、または同一事業の前年度・当年度純資産を確認できないため、増減を判定できません。未取得値を0千円とは扱いません。"]} />
      ) : (
        <>
          <div className={styles.netAssetsSnapshot} aria-label={`${year}末の純資産と前年比、主な変化`}>
            <NetAssetsSnapshotItem
              label={`${year}末の純資産`}
              value={formatFinancialAmount(analysis.current, analysis.scale)}
              note={(analysis.current ?? 0) < 0 ? "資産より負債が多い債務超過" : "資産から負債を差し引いた差額"}
              tone={(analysis.current ?? 0) < 0 ? "negative" : "positive"}
            />
            <NetAssetsSnapshotItem
              label="前年から"
              value={direction.shortLabel}
              note={`${formatFinancialAmount(analysis.prior, analysis.scale)} → ${formatFinancialAmount(analysis.current, analysis.scale)}`}
              tone={direction.tone}
            />
            <NetAssetsSnapshotItem
              label="最大の変化"
              value={leadingComponent ? leadingComponent.label : "内訳も変化なし"}
              note={leadingComponent ? formatSignedSourceThousandYen(leadingComponent.delta) : "4項目すべて±0千円"}
              tone={leadingComponent?.delta && leadingComponent.delta < 0 ? "negative" : "positive"}
            />
          </div>

          {componentsReady ? (
            <section className={styles.netAssetsDrivers} aria-labelledby={`${titleId}-drivers`}>
              <div className={styles.driverHeading}>
                <div>
                  <span>前年比の足し算・引き算</span>
                  <h4 id={`${titleId}-drivers`}>増減を動かした項目</h4>
                </div>
              </div>

              {changedComponents.length > 0 ? (
                <div className={styles.netAssetsFormula} aria-label={netAssetsFormulaLabel({ ...analysis, components: changedComponents })}>
                  <span><small>前年度末</small><strong>{formatSourceThousandYen(analysis.prior)}</strong></span>
                  {changedComponents.map((component) => (
                    <span key={`${component.id}-formula`} className={component.delta < 0 ? styles.formulaNegative : undefined}>
                      <small>{component.label}</small>
                      <strong>{component.delta < 0 ? "−" : "＋"}{formatSourceThousandYen(Math.abs(component.delta))}</strong>
                    </span>
                  ))}
                  <span className={styles.formulaResult}><small>{year}末</small><strong>＝ {formatSourceThousandYen(analysis.current)}</strong></span>
                </div>
              ) : (
                <div className={styles.noNetAssetsChange}>
                  <Minus size={18} aria-hidden="true" />
                  <strong>資本金・資本剰余金・利益剰余金・評価差額は、すべて前年末と同額です。</strong>
                </div>
              )}

              <div className={styles.driverConclusion}>
                <Scale size={18} aria-hidden="true" />
                <div>
                  <strong>{netAssetsDriverConclusion(analysis.components)}</strong>
                  <p>{netAssetsDriverExplanation(analysis.components)}</p>
                </div>
              </div>

              {analysis.currentNetIncome != null ? (
                <div className={styles.learningNote}>
                  <Banknote size={18} aria-hidden="true" />
                  <p><strong>当年度の純損益は {formatSignedSourceThousandYen(analysis.currentNetIncome)}。</strong> 利益剰余金は過年度を含む残高なので、前年差と当年度純損益が同額でなくても異常ではありません。</p>
                </div>
              ) : null}

              <details className={styles.netAssetsDetails}>
                <summary>4項目の残高・意味とデータ整合を見る</summary>
                <span className={styles.driverIntegrity}><CheckCircle2 size={14} aria-hidden="true" />4項目の合計と前年差が一致</span>
                <div className={styles.driverGrid}>
                  {analysis.components.map((component) => (
                    <NetAssetsDriver key={component.id} component={component} />
                  ))}
                </div>
                <p className={styles.driverCaveat}>前年差は貸借対照表の残高差です。出資・利益処分などの詳しい理由は、各団体の剰余金計算書等で確認する必要があります。</p>
              </details>
            </section>
          ) : (
            <div className={styles.componentUnavailable} role="note">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>純資産4項目の前年比較は表示できません</strong>
                <p>{componentsInvalid
                  ? `純資産総額と4項目の合計に差額があります（前年度末 ${formatSignedSourceThousandYen(analysis.priorComponentDifference)}、当年度末 ${formatSignedSourceThousandYen(analysis.currentComponentDifference)}、前年差 ${formatSignedSourceThousandYen(analysis.componentDifference)}）。原表または取込値を確認してください。`
                  : "前年度が法非適用、または同一事業の内訳データがない場合は、総額だけを表示します。未取得値を0千円とは扱いません。"}</p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="sr-only">
        <table>
          <caption>{year}の純資産増減</caption>
          <tbody>
            <tr><th scope="row">前年度末純資産</th><td>{formatSourceThousandYen(analysis.prior)}</td></tr>
            {analysis.components.map((component) => (
              <tr key={`${component.id}-table`}><th scope="row">{component.label}の前年差</th><td>{formatSignedSourceThousandYen(component.delta)}</td></tr>
            ))}
            <tr><th scope="row">前年差</th><td>{formatSignedMoney(analysis.delta)}</td></tr>
            <tr><th scope="row">当年度末純資産</th><td>{formatSourceThousandYen(analysis.current)}</td></tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}

function NetAssetsSnapshotItem({
  label,
  value,
  note,
  tone
}: {
  label: string;
  value: string;
  note: string;
  tone: "positive" | "negative";
}) {
  return (
    <article className={classNames(styles.netAssetsSnapshotItem, tone === "negative" ? styles.snapshotNegative : styles.snapshotPositive)}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function EquationColumn({
  title,
  total,
  items,
  scale,
  detailed = false,
  frameHeights
}: {
  title: string;
  total: number;
  items: VisualBoxItem[];
  scale: MoneyScale;
  detailed?: boolean;
  frameHeights?: { desktop: number; mobile: number };
}) {
  return (
    <div className={styles.boxColumn} role="group" aria-label={`${title} ${formatFinancialAmount(total, scale)}`}>
      <div className={styles.boxColumnTitle}>
        <span>{title}</span>
        <strong>{formatFinancialAmount(total, scale)}</strong>
      </div>
      <div
        className={classNames(styles.stackFrame, detailed ? styles.stackFrameDetailed : undefined)}
        style={detailed && frameHeights ? {
          "--stack-detailed-height": `${frameHeights.desktop}px`,
          "--stack-detailed-mobile-height": `${frameHeights.mobile}px`
        } as CSSProperties : undefined}
      >
        <div className={styles.stack} role="list" aria-label={`${title}の構成`}>
          {items.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className={classNames(
                styles.segment,
                segmentToneClass(item.tone),
                item.derived ? styles.segmentDerived : undefined,
                item.details && item.details.length > 0 ? styles.segmentWithDetails : undefined
              )}
              style={{
                flexGrow: Math.max(item.value, 0),
                flexBasis: 0,
                "--detail-min-height": `${72 + (item.details?.length ?? 0) * 32}px`,
                "--detail-mobile-min-height": `${76 + (item.details?.length ?? 0) * 44}px`
              } as CSSProperties}
              role="listitem"
              aria-label={segmentAriaLabel(item, total)}
            >
              <div className={styles.segmentHeader}>
                <span>{item.label}</span>
                <span className={styles.segmentMeta}>
                  <strong>{formatAdaptiveAmount(item.value)}</strong>
                  <small>{item.shareLabel ?? `全体の${formatShare(item.value, total)}`}</small>
                </span>
              </div>
              {item.details && item.details.length > 0 ? (
                <ul className={styles.segmentDetails}>
                  {item.details.map((detail) => (
                    <li key={`${item.id}-${detail.id}`}>
                      <span><small>うち</small>{detail.label}</span>
                      <span>
                        <strong>{formatSourceThousandYen(detail.value)}</strong>
                        <small>大項目内 {formatShare(detail.value, item.value)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BalanceRelationship({ analysis }: { analysis: BalanceAnalysis }) {
  const assetAmount = analysis.totalAssets ?? 0;
  const liabilityAmount = analysis.totalLiabilities ?? 0;
  const netAssetsAmount = analysis.totalNetAssets ?? 0;
  const liabilityRatio = Math.max(0, Math.min(100, analysis.debtRatio ?? 0));
  const netAssetsRatio = Math.max(0, Math.min(100, analysis.netAssetsRatio ?? 0));
  const liabilityCompact = liabilityRatio < (analysis.liabilities.items.length >= 3 ? 35 : 30);
  const netAssetsCompact = netAssetsRatio < (analysis.netAssets.items.length >= 3 ? 28 : 22);
  const liabilityMobileCompact = !liabilityCompact && liabilityRatio < balanceMobileCompactThreshold(analysis.liabilities.items.length);
  const netAssetsMobileCompact = !netAssetsCompact && netAssetsRatio < balanceMobileCompactThreshold(analysis.netAssets.items.length);
  const diagramScale = chooseBalanceBoxScale(
    [assetAmount, liabilityAmount, netAssetsAmount],
    analysis.scale,
    "standard"
  );
  const assetLabel = formatBalanceBoxAmount(assetAmount, diagramScale);
  const liabilityLabel = formatBalanceBoxAmount(liabilityAmount, diagramScale);
  const netAssetsLabel = formatBalanceBoxAmount(netAssetsAmount, diagramScale);
  const accessibleSummary = [
    `資産合計${assetLabel}。施設・設備などの帳簿価額や現金・未収金などの合計です。${balanceBreakdownSummary("資産", analysis.assets.items, assetAmount, diagramScale, analysis.assets.state)}`,
    `負債${liabilityLabel}、資産の${formatBalancePercent(analysis.debtRatio)}。固定負債・流動負債・繰延収益の合計です。${balanceBreakdownSummary("負債", analysis.liabilities.items, liabilityAmount, diagramScale, analysis.liabilities.state)}`,
    `純資産${netAssetsLabel}、資産の${formatBalancePercent(analysis.netAssetsRatio)}。資産から負債を差し引いた残りです。${balanceBreakdownSummary("純資産", analysis.netAssets.items, netAssetsAmount, diagramScale, analysis.netAssets.state)}`
  ].join("。") + "。資産は、負債と純資産で支えられています。";

  return (
    <figure className={styles.balanceFigure}>
      <div className={styles.balanceEquation} data-balance-relation="standard" aria-hidden="true">
        <div className={styles.balanceBoxFrame} data-balance-frame="asset">
          <BalanceBoxRegion
            label="資産"
            amountLabel={assetLabel}
            shareLabel="年度末残高"
            tone="asset"
            items={analysis.assets.items}
            groupLabel="資産"
            groupTotal={assetAmount}
            breakdownState={analysis.assets.state}
            scale={diagramScale}
          />
        </div>
        <span className={styles.balanceConnector}>＝</span>
        <div
          className={classNames(styles.balanceBoxFrame, styles.balanceFundingStack)}
          data-balance-frame="funding"
        >
          <BalanceBoxRegion
            label="負債"
            amountLabel={liabilityLabel}
            shareLabel={`資産の ${formatBalancePercent(analysis.debtRatio)}`}
            tone="liability"
            weight={liabilityAmount}
            compact={liabilityCompact}
            mobileCompact={liabilityMobileCompact}
            items={analysis.liabilities.items}
            groupLabel="負債"
            groupTotal={liabilityAmount}
            breakdownState={analysis.liabilities.state}
            scale={diagramScale}
          />
          <BalanceBoxRegion
            label="純資産"
            amountLabel={netAssetsLabel}
            shareLabel={`資産の ${formatBalancePercent(analysis.netAssetsRatio)}`}
            tone="net-assets"
            weight={netAssetsAmount}
            compact={netAssetsCompact}
            mobileCompact={netAssetsMobileCompact}
            items={analysis.netAssets.items}
            groupLabel="純資産"
            groupTotal={netAssetsAmount}
            breakdownState={analysis.netAssets.state}
            scale={diagramScale}
          />
        </div>
      </div>
      <BalanceReadingNote hasDeferredRevenue={analysis.liabilities.items.some((item) => item.id === "deferred-revenue")} />
      <p className="sr-only">{accessibleSummary}</p>
    </figure>
  );
}

function BalanceDeficitRelationship({ analysis }: { analysis: BalanceAnalysis }) {
  const assetAmount = analysis.totalAssets ?? 0;
  const liabilityAmount = analysis.totalLiabilities ?? 0;
  const deficitAmount = Math.abs(analysis.totalNetAssets ?? 0);
  const deficitRatio = assetAmount > 0 ? (deficitAmount / assetAmount) * 100 : null;
  const liabilityRatio = assetAmount > 0 ? (liabilityAmount / assetAmount) * 100 : null;
  const diagramScale = chooseBalanceBoxScale(
    [assetAmount, deficitAmount, liabilityAmount],
    analysis.scale,
    "deficit"
  );
  const assetLabel = formatBalanceBoxAmount(assetAmount, diagramScale);
  const deficitLabel = formatBalanceBoxAmount(deficitAmount, diagramScale);
  const liabilityLabel = formatBalanceBoxAmount(liabilityAmount, diagramScale);

  return (
    <figure className={styles.balanceFigure}>
      <div className={styles.balanceDeficitEquation} data-balance-relation="deficit" aria-hidden="true">
        <div className={styles.balanceBoxFrame}>
          <BalanceBoxRegion
            label="資産"
            amountLabel={assetLabel}
            shareLabel={assetAmount > 0 ? "年度末残高" : "割合なし"}
            tone="asset"
            items={analysis.assets.items}
            groupLabel="資産"
            groupTotal={assetAmount}
            breakdownState={analysis.assets.state}
            scale={diagramScale}
          />
        </div>
        <span className={styles.balanceConnector}>＋</span>
        <div className={styles.balanceBoxFrame}>
          <BalanceBoxRegion
            label="純資産のマイナス分"
            amountLabel={deficitLabel}
            shareLabel={deficitRatio == null ? "割合を判定できません" : `資産の ${formatBalancePercent(deficitRatio)}`}
            meaning={`債務超過額（差額）／純資産 ${formatAdaptiveAmount(analysis.totalNetAssets)}`}
            tone="deficit"
          />
        </div>
        <span className={styles.balanceConnector}>＝</span>
        <div className={styles.balanceBoxFrame}>
          <BalanceBoxRegion
            label="負債"
            amountLabel={liabilityLabel}
            shareLabel={liabilityRatio == null ? "割合を判定できません" : `資産の ${formatBalancePercent(liabilityRatio)}`}
            tone="liability"
            items={analysis.liabilities.items}
            groupLabel="負債"
            groupTotal={liabilityAmount}
            breakdownState={analysis.liabilities.state}
            scale={diagramScale}
          />
        </div>
      </div>
      <BalanceReadingNote hasDeferredRevenue={analysis.liabilities.items.some((item) => item.id === "deferred-revenue")} />
      <p className="sr-only">
        純資産が{formatBalanceBoxAmount(analysis.totalNetAssets ?? 0, diagramScale)}の債務超過です。
        資産{assetLabel}に債務超過額{deficitLabel}を足すと、
        負債{liabilityLabel}になります。{balanceBreakdownSummary("資産", analysis.assets.items, assetAmount, diagramScale, analysis.assets.state)}。
        {balanceBreakdownSummary("負債", analysis.liabilities.items, liabilityAmount, diagramScale, analysis.liabilities.state)}。負債は、繰延収益を含む貸借対照表上の合計です。
      </p>
    </figure>
  );
}

function BalanceBoxRegion({
  label,
  amountLabel,
  shareLabel,
  meaning,
  tone,
  weight,
  compact = false,
  mobileCompact = false,
  items = [],
  groupLabel,
  groupTotal,
  breakdownState = "ready",
  scale
}: {
  label: string;
  amountLabel: string;
  shareLabel: string;
  meaning?: string;
  tone: "asset" | "liability" | "net-assets" | "deficit";
  weight?: number;
  compact?: boolean;
  mobileCompact?: boolean;
  items?: PreparedBreakdownItem[];
  groupLabel?: string;
  groupTotal?: number;
  breakdownState?: PreparedBreakdown["state"];
  scale?: MoneyScale;
}) {
  const regionStyle = weight == null
    ? undefined
    : ({ flexGrow: Math.max(weight, 0), flexBasis: 0 } as CSSProperties);

  return (
    <div
      className={classNames(styles.balanceBoxRegion, balanceMajorToneClass(tone))}
      data-balance-box={tone}
      data-balance-compact={compact ? tone : undefined}
      data-balance-mobile-compact={mobileCompact ? tone : undefined}
      style={regionStyle}
    >
      {compact ? (
        <div className={styles.balanceCompactInline} data-balance-inline={tone}>
          <strong>{label}</strong>
          <span>{amountLabel}</span>
          <small>{shareLabel}</small>
        </div>
      ) : (
        <div className={classNames(styles.balanceBoxContent, groupLabel ? styles.balanceBoxContentWithDetails : undefined)}>
          <div className={styles.balanceBoxTopline}>
            <span>{label}</span>
            <strong>{shareLabel}</strong>
          </div>
          <strong className={styles.balanceAmount}>{amountLabel}</strong>
          {groupLabel && scale ? <BalanceBoxBreakdown items={items} total={Math.max(groupTotal ?? weight ?? 0, 0)} groupLabel={groupLabel} tone={tone} scale={scale} state={breakdownState} /> : null}
          {meaning ? <p>{meaning}</p> : null}
        </div>
      )}
    </div>
  );
}

function BalanceBoxBreakdown({
  items,
  total,
  groupLabel,
  tone,
  scale,
  state,
}: {
  items: PreparedBreakdownItem[];
  total: number;
  groupLabel: string;
  tone: "asset" | "liability" | "net-assets" | "deficit";
  scale: MoneyScale;
  state: PreparedBreakdown["state"];
}) {
  const proportionsUnavailable = state === "limited" || state === "invalid";
  const hasExplicitMissingRemainder = items.some((item) => item.label.includes("未取得"));
  const showPartialNotice = state === "partial" && !hasExplicitMissingRemainder;
  if (items.length === 0 && !proportionsUnavailable && !showPartialNotice) return null;

  return (
    <ul
      className={styles.balanceBoxDetails}
      data-balance-breakdown={tone}
      data-balance-breakdown-state={state}
    >
      {proportionsUnavailable ? (
        <li className={styles.balanceBoxDetailStatus} data-balance-detail-state="unavailable">
          相殺・不整合を含むため、内訳の割合は表示しません
        </li>
      ) : items.map((item) => {
        const label = balanceBreakdownDisplay(item);
        const hint = balanceBreakdownHint(item.id);
        return (
          <li key={`${tone}-${item.id}`} data-balance-detail={item.id} data-balance-derived={item.derived ? "true" : undefined}>
            <span className={styles.balanceBoxDetailLabel}>
              <span>{label.prefix ? <small>{label.prefix}</small> : null}{label.label}</span>
              {hint ? <small className={styles.balanceBoxDetailHint}>{hint}</small> : null}
            </span>
            {label.showValue && total > 0 ? (
              <span className={styles.balanceBoxDetailMeta}>
                <strong>{formatBalanceBreakdownAmount(item.value, scale)}</strong>
                <small>{groupLabel}内 {formatBalancePercent((item.value / total) * 100)}</small>
              </span>
            ) : null}
          </li>
        );
      })}
      {showPartialNotice ? (
        <li className={styles.balanceBoxDetailStatus} data-balance-detail-state="partial">
          一部内訳未取得（0円とは扱いません）
        </li>
      ) : null}
    </ul>
  );
}

function BalanceReadingNote({ hasDeferredRevenue }: { hasDeferredRevenue: boolean }) {
  return (
    <p className={styles.balanceReadingNote}>
      <strong>内訳の見方</strong>
      各内訳の「〇〇内」は、その箱の合計に占める割合です。割合は原表の千円値から計算し、金額は読みやすい単位に丸めています。
      {hasDeferredRevenue ? " 繰延収益は主に施設整備の補助金等の未収益化残高で、返済予定額ではありません。" : ""}
    </p>
  );
}

function NetAssetsDriver({ component }: { component: NetAssetsComponentChange }) {
  const meta = netAssetsComponentMeta(component.id);
  const tone = component.delta > 0 ? styles.driverPositive : component.delta < 0 ? styles.driverNegative : styles.driverFlat;
  return (
    <article className={classNames(styles.driverCard, tone)}>
      <div className={styles.driverCardTopline}>
        <span>{meta.kicker}</span>
        <strong>{formatSignedSourceThousandYen(component.delta)}</strong>
      </div>
      <h5>{component.label}</h5>
      <p>{meta.meaning}</p>
      <dl>
        <div><dt>前年度末</dt><dd>{formatSourceThousandYen(component.prior)}</dd></div>
        <div><dt>当年度末</dt><dd>{formatSourceThousandYen(component.current)}</dd></div>
      </dl>
    </article>
  );
}

function CardHeading({ icon, titleId, title, description }: { icon: ReactNode; titleId: string; title: string; description: string }) {
  return (
    <div className={styles.cardHeading}>
      <span className={styles.cardIcon}>{icon}</span>
      <div>
        <h3 id={titleId}>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function StoryStatus({
  state,
  label
}: {
  state: "ready" | "partial" | "limited" | "invalid" | "unavailable";
  label?: string;
}) {
  const copy = {
    ready: { text: "表示項目確認済み", icon: <CheckCircle2 size={15} aria-hidden="true" />, className: styles.statusReady },
    partial: { text: "一部未取得", icon: <AlertCircle size={15} aria-hidden="true" />, className: styles.statusPartial },
    limited: { text: "図示に制約あり", icon: <AlertCircle size={15} aria-hidden="true" />, className: styles.statusPartial },
    invalid: { text: "要検算", icon: <AlertCircle size={15} aria-hidden="true" />, className: styles.statusInvalid },
    unavailable: { text: "表示不可", icon: <AlertCircle size={15} aria-hidden="true" />, className: styles.statusInvalid }
  }[state];
  return <span className={classNames(styles.statusBadge, copy.className)}>{copy.icon}{label ?? copy.text}</span>;
}

function FinancialStoryState({
  titleId,
  year,
  title,
  body,
  trace
}: {
  titleId: string;
  year: string;
  title: string;
  body: string;
  trace: FinancialStoryProps["trace"];
}) {
  return (
    <section className={styles.root} aria-labelledby={titleId}>
      <div className={styles.headingRow}>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}>{year} 決算構造</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <StoryStatus state="unavailable" />
      </div>
      <div className={styles.exclusionState} role="note">
        <AlertCircle size={24} aria-hidden="true" />
        <div>
          <strong>比較できないものは、図にしません</strong>
          <p>{body}</p>
        </div>
      </div>
      <TraceDetails trace={trace} />
    </section>
  );
}

function InlineState({ messages }: { messages: string[] }) {
  return (
    <div className={styles.inlineState} role="note">
      <AlertCircle size={21} aria-hidden="true" />
      <div>
        <strong>決算構造図を表示していません</strong>
        <p>{messages[0] ?? "必要な項目を確認できません。"}</p>
      </div>
    </div>
  );
}

function TraceDetails({ trace }: { trace: FinancialStoryProps["trace"] }) {
  if (!trace || trace.length === 0) return null;
  return (
    <details className={styles.traceDetails}>
      <summary><Database size={16} aria-hidden="true" />出典・データトレース</summary>
      <ul>
        {trace.map((item, index) => (
          <li key={item.id ?? `${item.label}-${index}`}>
            <div>
              <strong>{item.label}</strong>
              {item.table ? <span>{item.table}</span> : null}
              {item.note ? <p>{item.note}</p> : null}
            </div>
            {item.sourceUrl ? <a href={item.sourceUrl}>原資料</a> : <span>URL未登録</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function MoneyTable({
  caption,
  rows,
  visible = false
}: {
  caption: string;
  rows: Array<{ label: string; value: number | null | undefined; note?: string }>;
  visible?: boolean;
}) {
  const table = (
    <table className={visible ? styles.visibleMoneyTable : undefined}>
      <caption>{caption}</caption>
      <thead><tr><th scope="col">項目</th><th scope="col">金額</th></tr></thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.label}-${index}`}>
            <th scope="row">{row.label}{row.note ? <small>{row.note}</small> : null}</th>
            <td>{formatSourceThousandYen(row.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return visible ? table : <div className="sr-only">{table}</div>;
}

function MetricPair({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function IntegrityMessages({ messages }: { messages: string[] }) {
  if (messages.length === 0) return <p className={styles.integrityOk}><CheckCircle2 size={15} aria-hidden="true" />取得値の範囲で整合しています。</p>;
  return (
    <ul className={styles.integrityMessages}>
      {messages.map((message) => <li key={message}>{message}</li>)}
    </ul>
  );
}

function buildSummaries(
  income: IncomeAnalysis,
  balance: BalanceAnalysis,
  netAssets: ReturnType<typeof analyzeFinancialStory>["netAssetsChange"]
) {
  const incomeCopy = incomeResultCopy(income);
  const netCopy = netAssetsDirectionCopy(netAssets);
  const balanceValue = !balance.available
    ? "貸借を判定できません"
    : (balance.totalNetAssets ?? 0) < 0
      ? "純資産がマイナス"
    : balance.reconciled === false
      ? "貸借に差額あり"
      : `負債比率 ${formatBalancePercent(balance.debtRatio)}`;
  const balanceNote = balance.available
    ? (balance.totalNetAssets ?? 0) < 0
      ? `負債が資産を ${formatAdaptiveAmount(Math.abs(balance.totalNetAssets ?? 0))} 上回る`
      : `純資産比率 ${formatBalancePercent(balance.netAssetsRatio)}`
    : "資産・負債・純資産の取得待ち";

  return [
    { label: "1年間の損益", value: incomeCopy.title, note: incomeCopy.note },
    { label: "資産・負債・純資産", value: balanceValue, note: balanceNote },
    { label: "純資産の変化", value: netCopy.shortLabel, note: netCopy.longLabel }
  ];
}

function incomeResultCopy(analysis: IncomeAnalysis) {
  if (!analysis.available || analysis.gap == null) {
    return { title: "損益を判定できません", note: "総収益・総費用の取得待ち", tone: "negative" as const };
  }
  if (analysis.gap === 0) {
    if (analysis.totalRevenue === 0 && analysis.totalExpense === 0) {
      return { title: "収益・費用とも0", note: "当年度の計上はありません。", tone: "neutral" as const };
    }
    return { title: "収支均衡", note: "総収益と総費用が同額です。", tone: "neutral" as const };
  }
  const difference = formatAdaptiveAmount(Math.abs(analysis.gap));
  const coverage = analysis.revenueCoverageRate == null
    ? "総収益で総費用を賄えている割合は判定できません"
    : `総収益で総費用を賄えている割合 ${analysis.revenueCoverageRate.toFixed(1)}%`;
  if (analysis.gap < 0) {
    return { title: `費用が${difference}上回っています`, note: coverage, tone: "negative" as const };
  }
  return { title: `収益が${difference}上回っています`, note: coverage, tone: "positive" as const };
}

function incomeEquationCopy(analysis: IncomeAnalysis) {
  const expense = formatFinancialAmount(analysis.totalExpense, analysis.scale);
  const revenue = formatFinancialAmount(analysis.totalRevenue, analysis.scale);
  const result = formatAdaptiveAmount(Math.abs(analysis.netIncome ?? analysis.gap ?? 0));
  if (analysis.equation.resultSide === "left") {
    return `費用 ${expense} ＋ 当年度純利益 ${result} ＝ 収益 ${revenue}`;
  }
  if (analysis.equation.resultSide === "right") {
    return `費用 ${expense} ＝ 収益 ${revenue} ＋ 当年度純損失 ${result}`;
  }
  return `費用 ${expense} ＝ 収益 ${revenue}`;
}

function majorGroupFor(id: string): FinancialBreakdownGroup | null {
  if (id.startsWith("operating-")) return "operating";
  if (id.startsWith("non-operating-")) return "non-operating";
  if (id.startsWith("extraordinary-")) return "extraordinary";
  return null;
}

function incomeVisualItems(
  items: PreparedBreakdownItem[],
  detailItems: FinancialBreakdownItem[],
  statementTotal: number,
  baseTone: "expense" | "revenue"
): VisualBoxItem[] {
  return items.map((item) => {
    const isProfit = item.id === "net-profit";
    const isLoss = item.id === "net-loss";
    const group = majorGroupFor(item.id);
    const details = group && group !== "extraordinary"
      ? prepareBreakdown(
          item.value,
          detailItems.filter((detail) => detail.group === group),
          item.label
        ).items
      : [];
    const denominatorLabel = isProfit
      ? "総収益"
      : isLoss
        ? "総費用"
        : baseTone === "expense"
          ? "総費用"
          : "総収益";
    const denominator = isProfit || isLoss
      ? items.reduce((sum, candidate) => sum + candidate.value, 0)
      : statementTotal;

    return {
      ...item,
      tone: isProfit ? "profit" : isLoss ? "loss" : baseTone,
      details,
      shareLabel: `${denominatorLabel}の${formatShare(item.value, denominator)}`
    };
  });
}

function formatShare(value: number, total: number) {
  return total > 0 ? `${(value / total * 100).toFixed(1)}%` : "—";
}

function balanceBreakdownDisplay(item: PreparedBreakdownItem) {
  if (item.derived && /合計$/.test(item.label)) {
    return { prefix: "", label: "内訳の割合は表示できません", showValue: false };
  }
  if (item.label === "内訳未取得") {
    return { prefix: "", label: item.label, showValue: false };
  }
  if (item.derived) {
    return {
      prefix: "残り",
      label: item.label.includes("未取得") ? "（その他・未取得）" : "（総額との差額）",
      showValue: true
    };
  }
  return { prefix: "うち", label: item.label, showValue: true };
}

function balanceBreakdownHint(id: string) {
  return ({
    "fixed-assets": "施設・設備などの帳簿価額",
    "current-assets": "現金・未収金など",
    "deferred-assets": "将来へ繰り延べた支出の未償却額",
    "fixed-liabilities": "企業債・引当金など、主に長期",
    "current-liabilities": "未払金・1年以内返済分など",
    "deferred-revenue": "主に施設整備の補助金等の未収益化残高",
    capital: "自治体等からの出資・剰余金からの組入れ",
    surplus: "資本取引と利益・欠損の累積",
    "valuation-difference": "有価証券の時価評価による差額"
  } as Record<string, string>)[id];
}

function balanceBreakdownSummary(
  groupLabel: string,
  items: PreparedBreakdownItem[],
  total: number,
  scale: MoneyScale,
  state: PreparedBreakdown["state"]
) {
  if (state === "limited" || state === "invalid") {
    return `${groupLabel}の内訳は相殺・不整合を含むため、割合を表示していません`;
  }
  if (items.length === 0 || total <= 0) return `${groupLabel}の内訳は確認できません`;
  const details = items.map((item) => {
    const label = balanceBreakdownDisplay(item);
    const displayedLabel = label.prefix ? `${label.prefix}${label.label}` : label.label;
    return label.showValue
      ? `${displayedLabel}${formatBalanceBreakdownAmount(item.value, scale)}、${groupLabel}内${formatBalancePercent((item.value / total) * 100)}`
      : displayedLabel;
  });
  const partialNotice = state === "partial" && !items.some((item) => item.label.includes("未取得"))
    ? "、一部内訳未取得（0円とは扱いません）"
    : "";
  return `${groupLabel}の内訳は${details.join("、")}${partialNotice}`;
}

function balanceMobileCompactThreshold(itemCount: number) {
  const mobileInnerFrameHeight = 530;
  const requiredHeight = 64 + 27 * Math.max(itemCount, 0);
  return Math.min(45, requiredHeight / mobileInnerFrameHeight * 100);
}

function formatBalancePercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "判定できません";
  if (value === 0) return "0.0%";
  if (value > 0 && value < 0.1) return "0.1%未満";
  if (value < 0 && value > -0.1) return "−0.1%未満";
  return `${value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;
}

function equationFrameHeights(...columns: VisualBoxItem[][]) {
  const detailRows = Math.max(0, ...columns.map((items) =>
    items.reduce((sum, item) => sum + (item.details?.length ?? 0), 0)
  ));
  const segmentCount = Math.max(0, ...columns.map((items) => items.length));
  return {
    desktop: Math.max(600, 180 + detailRows * 40 + segmentCount * 64),
    mobile: Math.max(650, 180 + detailRows * 50 + segmentCount * 72)
  };
}

function netAssetsDirectionCopy(analysis: ReturnType<typeof analyzeFinancialStory>["netAssetsChange"]) {
  if (!analysis.available || analysis.delta == null) {
    return { shortLabel: "増減を判定できません", longLabel: "前年度純資産の取得待ちです。", tone: "negative" as const };
  }
  const amount = formatAdaptiveAmount(Math.abs(analysis.delta));
  const rate = analysis.percent == null ? "" : `（${formatFinancialPercent(Math.abs(analysis.percent))}）`;
  if ((analysis.prior ?? 0) < 0 && (analysis.current ?? 0) >= 0) {
    return { shortLabel: "債務超過を解消", longLabel: `純資産は${amount}改善し、債務超過を解消しました。`, tone: "positive" as const };
  }
  if ((analysis.prior ?? 0) >= 0 && (analysis.current ?? 0) < 0) {
    return { shortLabel: "債務超過に転じた", longLabel: `純資産は${amount}減少し、債務超過に転じました。`, tone: "negative" as const };
  }
  if ((analysis.prior ?? 0) < 0 && (analysis.current ?? 0) < 0) {
    if (analysis.direction === "increase") return { shortLabel: `${amount}改善`, longLabel: `純資産は${amount}増え、債務超過が縮小しました。`, tone: "positive" as const };
    if (analysis.direction === "decrease") return { shortLabel: `${amount}悪化`, longLabel: `純資産は${amount}減り、債務超過が拡大しました。`, tone: "negative" as const };
  }
  if (analysis.direction === "increase") return { shortLabel: `${amount}増加`, longLabel: `純資産は前年より${amount}${rate}増えています。`, tone: "positive" as const };
  if (analysis.direction === "decrease") return { shortLabel: `${amount}減少`, longLabel: `純資産は前年より${amount}${rate}減っています。`, tone: "negative" as const };
  return { shortLabel: "前年差0千円", longLabel: "純資産は前年と同額です（原表単位：千円）。", tone: "positive" as const };
}

function netAssetsComponentMeta(id: NetAssetsComponentChange["id"]) {
  return {
    capital: {
      kicker: "事業の元手",
      meaning: "自治体からの出資や剰余金からの組入れなどで動く、返済を原則要しない基礎資本です。料金で稼いだ額とは限りません。"
    },
    "capital-surplus": {
      kicker: "利益以外の残高",
      meaning: "受贈財産や寄附など、料金収入による利益とは異なる資本取引の残高です。"
    },
    "retained-earnings": {
      kicker: "利益・欠損の蓄積",
      meaning: "過年度を含む利益や積立金の蓄積です。利益処分、欠損補填、資本金への組入れでも動きます。"
    },
    "valuation-difference": {
      kicker: "有価証券の時価差",
      meaning: "保有有価証券の評価額の変化です。現金収入や下水道事業の営業成果そのものではありません。"
    }
  }[id];
}

function netAssetsDriverConclusion(components: NetAssetsComponentChange[]) {
  const changed = [...components]
    .filter((component) => component.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (changed.length === 0) return "4項目とも前年末から変化していません";
  const largestMagnitude = Math.abs(changed[0].delta);
  const leading = changed.filter((component) => Math.abs(component.delta) === largestMagnitude);
  if (leading.length > 1) {
    return `主な変化は${leading.map((component) => `${component.label}（${formatSignedSourceThousandYen(component.delta)}）`).join("、")}です`;
  }
  return `変化の中心は${leading[0].label}（${formatSignedSourceThousandYen(leading[0].delta)}）です`;
}

function netAssetsDriverExplanation(components: NetAssetsComponentChange[]) {
  const changed = [...components]
    .filter((component) => component.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (changed.length === 0) return "純資産の構成も総額も、取得した貸借対照表の範囲では横ばいです。";
  const largestMagnitude = Math.abs(changed[0].delta);
  const leadingChanges = changed.filter((component) => Math.abs(component.delta) === largestMagnitude);
  const hasPositive = components.some((component) => component.delta > 0);
  const hasNegative = components.some((component) => component.delta < 0);
  if (leadingChanges.length > 1) {
    const core = `同じ大きさの主な変化が${leadingChanges.map((component) => component.label).join("と")}にあります。`;
    return hasPositive && hasNegative ? `${core} 増加項目と減少項目が一部相殺されています。` : core;
  }
  const leading = changed[0];
  const directionText = leading.delta > 0 ? "増えた" : "減った";
  const core = {
    capital: `原則返済不要の基礎資本が${directionText}方向ですが、料金収入の成果とは限りません。`,
    "capital-surplus": `利益以外の資本取引の残高が${directionText}方向です。`,
    "retained-earnings": `利益・欠損の蓄積が${directionText}方向ですが、当年度純損益だけでなく処分や組入れも含みます。`,
    "valuation-difference": `有価証券の評価差が${directionText}方向で、営業成果や現金の増減そのものではありません。`
  }[leading.id];
  return hasPositive && hasNegative ? `${core} 増加項目と減少項目が一部相殺されています。` : core;
}

function netAssetsFormulaLabel(analysis: ReturnType<typeof analyzeFinancialStory>["netAssetsChange"]) {
  const parts = analysis.components.map((component) =>
    `${component.label}${component.delta < 0 ? "マイナス" : "プラス"}${formatSourceThousandYen(Math.abs(component.delta))}`
  );
  return `前年度末純資産${formatSourceThousandYen(analysis.prior)}、${parts.join("、")}、当年度末純資産${formatSourceThousandYen(analysis.current)}`;
}

function segmentAriaLabel(item: VisualBoxItem, total: number) {
  const details = item.details?.map((detail) =>
    `${detail.label}${formatSourceThousandYen(detail.value)}、大項目内${formatShare(detail.value, item.value)}`
  ).join("、") ?? "";
  return `${item.label}${formatAdaptiveAmount(item.value)}、${item.shareLabel ?? `全体の${formatShare(item.value, total)}`}${details ? `、内訳は${details}` : ""}`;
}

function storyState(
  income: IncomeAnalysis,
  balance: BalanceAnalysis,
  netAssets: ReturnType<typeof analyzeFinancialStory>["netAssetsChange"],
  external?: "ready" | "partial" | "unavailable"
) {
  if (external === "unavailable") return "unavailable" as const;
  if (income.state === "invalid" || balance.state === "invalid" || netAssets.componentsReconciled === false) return "invalid" as const;
  if (income.state === "limited" || balance.state === "limited") return "limited" as const;
  if (external === "partial" || income.state !== "ready" || balance.state !== "ready") return "partial" as const;
  return "ready" as const;
}

function resultToneClass(tone: "positive" | "negative" | "neutral") {
  if (tone === "positive") return styles.resultPositive;
  if (tone === "negative") return styles.resultNegative;
  return styles.resultNeutral;
}

function balanceMajorToneClass(tone: "asset" | "liability" | "net-assets" | "deficit") {
  return {
    asset: styles.balanceAsset,
    liability: styles.balanceLiability,
    "net-assets": styles.balanceNetAssets,
    deficit: styles.balanceDeficit
  }[tone];
}

function segmentToneClass(tone: VisualBoxItem["tone"]) {
  return {
    revenue: styles.segmentRevenue,
    expense: styles.segmentExpense,
    profit: styles.segmentProfit,
    loss: styles.segmentLoss
  }[tone];
}

function formatSignedMoney(value: number | null) {
  if (value == null) return "判定できません";
  if (value === 0) return formatAdaptiveAmount(0);
  return `${value > 0 ? "+" : "−"}${formatAdaptiveAmount(Math.abs(value))}`;
}

function formatSourceThousandYen(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "取得できません";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(value)}千円`;
}

function formatSignedSourceThousandYen(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "取得できません";
  if (value === 0) return `±${formatSourceThousandYen(0)}`;
  return `${value > 0 ? "＋" : "−"}${formatSourceThousandYen(Math.abs(value))}`;
}

function formatAdaptiveAmount(value: number | null | undefined) {
  return formatFinancialAmount(value, chooseMoneyScale([value]));
}

function chooseBalanceBoxScale(
  values: [number, number, number],
  preferred: MoneyScale,
  relation: "standard" | "deficit"
) {
  const scales: MoneyScale[] = [
    { divisor: 100_000, unit: "億円", maximumFractionDigits: 1 },
    { divisor: 1_000, unit: "百万円", maximumFractionDigits: 1 },
    { divisor: 1, unit: "千円", maximumFractionDigits: 0 }
  ];
  const preferredIndex = Math.max(0, scales.findIndex((scale) => scale.divisor === preferred.divisor));

  return scales.slice(preferredIndex).find((scale) => {
    const rounded = values.map((value) => roundAtScale(value, scale)) as [number, number, number];
    const keepsNonzeroValues = values.every((value, index) => value === 0 || rounded[index] !== 0);
    const avoidsInequalityLabels = values.every(
      (value) => value === 0 || Math.abs(value / scale.divisor) >= 0.1
    );
    const equationDifference = relation === "standard"
      ? rounded[0] - rounded[1] - rounded[2]
      : rounded[0] + rounded[1] - rounded[2];
    return keepsNonzeroValues && avoidsInequalityLabels && Math.abs(equationDifference) < 1e-9;
  }) ?? scales[scales.length - 1];
}

function roundAtScale(value: number, scale: MoneyScale) {
  const precision = 10 ** scale.maximumFractionDigits;
  return Math.round((value / scale.divisor) * precision) / precision;
}

function formatBalanceBoxAmount(value: number, scale: MoneyScale) {
  const scaled = value / scale.divisor;
  if (value !== 0 && Math.abs(scaled) < 0.1) {
    return `${value < 0 ? "−" : ""}0.1${scale.unit}未満`;
  }
  return formatFinancialAmount(value, scale);
}

function formatBalanceBreakdownAmount(value: number, scale: MoneyScale) {
  if (value !== 0 && Math.abs(value / scale.divisor) < 0.1) {
    return formatSourceThousandYen(value);
  }
  return formatBalanceBoxAmount(value, scale);
}

function fiscalYearLabel(year: string | number) {
  const label = String(year).trim();
  if (!label) return "決算年度不明";
  return /年度$/.test(label) ? label : `${label}年度`;
}

function classNames(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}
