import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  FileSearch,
  Landmark,
  Scale,
  TrendingUp
} from "lucide-react";
import type { CitizenMunicipalityAssessment } from "@/lib/citizenMunicipalityAssessment";
import type { FundShortageAssessment } from "@/lib/fundShortage";
import {
  formatFeeRevisionEffectiveDate,
  municipalityFeeRevisionStatus,
  type MunicipalityFeeRevisionComparison
} from "@/lib/municipalityFeeRevision";
import styles from "./CitizenAssessmentPanel.module.css";

type CitizenAssessmentPanelProps = {
  assessment: CitizenMunicipalityAssessment;
  municipalityName: string;
  prefectureName: string;
  businessKey: string;
  businessLabel: string;
  financeHref: string;
  fiscalLabel: string;
  peerLoading: boolean;
  fundShortage: FundShortageAssessment | null;
  revisionComparison: MunicipalityFeeRevisionComparison | null;
  businessLabelsByKey: Record<string, string>;
  prefectureHref: string;
  feeAnalysisHref: string;
  yearbookHref: string;
};

export function CitizenAssessmentPanel({
  assessment,
  municipalityName,
  prefectureName,
  businessKey,
  businessLabel,
  fiscalLabel,
  peerLoading,
  fundShortage,
  revisionComparison,
  businessLabelsByKey,
  prefectureHref,
  feeAnalysisHref,
  yearbookHref,
  financeHref
}: CitizenAssessmentPanelProps) {
  const fee = assessment.feeCostRelationship.fee.current;
  const feeRank = assessment.feeRank;
  const scenario = assessment.feeScenario;
  const householdFeeNotApplicable = assessment.householdFee20m3Applicability === "not_applicable";
  const revisionStatus = municipalityFeeRevisionStatus(revisionComparison);
  const areaLabel = prefectureAreaLabel(prefectureName);
  const selectedRevision = revisionComparison?.changes.find((change) => change.businessKey === businessKey) ?? null;
  const feeLevelCostAnalysis = assessment.feeLevelCostAnalysis;
  const feeComparisonLoading = assessment.r6DataAvailability.status === "available" && peerLoading;
  const sustainabilityTone = fundShortage?.status === "shortage"
    && fundShortage.isAtOrAboveManagementImprovementThreshold
    ? "critical"
    : assessment.sustainability.reasons.some((reason) => reason.direction === "pressure")
      ? "pressure"
    : assessment.sustainability.reasons.some((reason) => reason.direction === "supportive")
      ? "supportive"
      : "neutral";
  const futureTone = scenario.status === "gap"
    ? "pressure"
    : scenario.status === "no_current_gap"
      ? "supportive"
      : "neutral";
  const fundTone = fundShortage?.status === "shortage"
    ? fundShortage.isAtOrAboveManagementImprovementThreshold ? "critical" : "pressure"
    : "neutral";

  return (
    <section className={styles.root} aria-labelledby="citizen-assessment-title">
      <header className={styles.heading}>
        <div>
          <span>{fiscalLabel}・{businessLabel}</span>
          <h2 id="citizen-assessment-title">{municipalityName}の下水道を、知りたい順に見る</h2>
        </div>

      </header>

      {assessment.r6DataAvailability.status === "unavailable" ? (
        <div className={styles.r6Unavailable} role="note">
          <strong>R6診断に必要な決算が揃っていません</strong>
          <p>{assessment.r6DataAvailability.reason}</p>
        </div>
      ) : null}

      <article className={styles.feePosition} data-topic="fee" aria-labelledby="citizen-fee-position-title">
        <div className={styles.questionLead}>
          <span className={styles.questionIcon} aria-hidden="true"><CircleDollarSign size={21} /></span>
          <div>
            <h3 id="citizen-fee-position-title">料金は{areaLabel}で高い？</h3>
          </div>
        </div>
        <div className={styles.feeAmount}>
          <strong data-usage-visible-value={fee != null && !householdFeeNotApplicable ? "household" : undefined}>{householdFeeNotApplicable ? "対象外" : fee == null ? "未取得" : `${Math.round(fee).toLocaleString("ja-JP")}円`}</strong>
          <span>{householdFeeNotApplicable ? "特定公共下水道" : "一般家庭用20m³／月・税込"}</span>
        </div>
        <div className={styles.rankAnswer} aria-live="polite">
          {feeRank ? (
            <>
              <strong>{feeRank.tied ? "同率" : ""}{feeRank.rank}位 <span>／ {feeRank.total}事業体・高い順</span></strong>
              <p>
                {areaLabel}中央値 {formatYen(feeRank.median)}より
                <b>{formatSignedYen(feeRank.differenceYen)}（{formatSignedPercent(feeRank.differencePercent)}）</b>
              </p>
            </>
          ) : (
            <>
              <strong>{peerLoading ? `${areaLabel}順位を計算中` : `${areaLabel}順位は算定できません`}</strong>
              <p>{peerLoading ? "比較データを読み込んでいます。" : localizeAreaLabel(assessment.feeRankUnavailableReason, areaLabel)}</p>
            </>
          )}
        </div>
        <Link href={prefectureHref} className={styles.evidenceLink}>
          {areaLabel}で比べる <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </article>

      <div className={styles.questionList}>
        <article className={styles.questionRow} data-topic="cost" aria-labelledby="citizen-cost-title">
          <div className={styles.questionLead}>
            <span className={styles.questionIcon} aria-hidden="true"><FileSearch size={20} /></span>
            <div><h3 id="citizen-cost-title">なぜ、この料金水準？</h3></div>
          </div>
          <div className={styles.questionAnswer}>
            <div className={styles.costConclusion} data-state={feeLevelCostAnalysis.state}>
              <strong>{feeComparisonLoading
                ? `${areaLabel}の費用比較を読み込んでいます`
                : localizeAreaLabel(feeLevelCostAnalysis.headline, areaLabel)}</strong>
            </div>
          </div>
          <Link href={feeAnalysisHref} className={styles.evidenceLink}>料金水準の考察を見る <ArrowRight size={15} aria-hidden="true" /></Link>
        </article>

        <article className={styles.questionRow} data-topic="sustainability" data-tone={sustainabilityTone} aria-labelledby="citizen-sustainability-title">
          <div className={styles.questionLead}>
            <span className={styles.questionIcon} aria-hidden="true"><Scale size={20} /></span>
            <div><h3 id="citizen-sustainability-title">経営の状況は？</h3></div>
          </div>
          <div className={styles.questionAnswer}>
            <strong>{assessment.sustainability.headline}</strong>
            <ul className={styles.reasonList}>
              {assessment.sustainability.reasons.map((reason) => (
                <li
                  key={reason.category}
                  data-direction={reason.direction}
                  data-critical={reason.category === "fund_shortage" && fundShortage?.isAtOrAboveManagementImprovementThreshold ? "true" : undefined}
                >
                  <span>{reason.title}</span>
                  {reason.category === "expense_recovery" && assessment.recovery.rate != null ? <b>{assessment.recovery.rate.toFixed(1)}%</b> : null}
                  {reason.category === "billable_volume" && assessment.volumeTrend.changePercent != null ? <b>{formatSignedPercent(assessment.volumeTrend.changePercent)}<small>R2→R6</small></b> : null}
                </li>
              ))}
            </ul>
          </div>
          <Link href={financeHref} className={styles.evidenceLink}>財務を見る <ArrowRight size={15} aria-hidden="true" /></Link>
        </article>

        <article className={styles.questionRow} data-topic="future" data-tone={futureTone} aria-labelledby="citizen-fee-future-title">
          <div className={styles.questionLead}>
            <span className={styles.questionIcon} aria-hidden="true"><TrendingUp size={20} /></span>
            <div><h3 id="citizen-fee-future-title">料金改定と収入の不足は？</h3></div>
          </div>
          <div className={styles.questionAnswer}>
            <div className={styles.revisionStatus} data-status={revisionStatus}>
              <span>改定履歴 R5→R6</span>
              <strong>{revisionStatusLabel(revisionComparison, selectedRevision)}</strong>
              {selectedRevision ? (
                <small>{formatFeeRevisionEffectiveDate(selectedRevision.r5EffectiveDate)} → {formatFeeRevisionEffectiveDate(selectedRevision.r6EffectiveDate)}</small>
              ) : null}
            </div>
            <strong>{scenario.status === "gap" && scenario.revenueIncreaseRatePercent != null
              ? `費用を賄うための使用料収入：あと +${scenario.revenueIncreaseRatePercent.toFixed(1)}%`
              : scenario.status === "no_current_gap"
                ? "使用料収入で現在の費用を賄えています"
                : "収入不足の試算：データ不足"}</strong>
            {scenario.status !== "unavailable" ? <p>R6の費用・有収水量を固定した、事業全体の単純試算</p> : null}
            {scenario.householdIllustration && scenario.status === "gap" ? (
              <details className={styles.householdScenario}>
                <summary>月20m³料金へ単純換算すると <ChevronDown size={15} aria-hidden="true" /></summary>
                <div>
                  <strong>{formatYen(scenario.householdIllustration.currentFeeYen)} → {formatYen(scenario.householdIllustration.illustratedFeeYen)}</strong>
                  <span>月額差 +{scenario.householdIllustration.monthlyDifferenceYen.toLocaleString("ja-JP")}円</span>
                  <p>{scenario.householdIllustration.assumption}</p>
                </div>
              </details>
            ) : null}
          </div>
          <Link href={yearbookHref} className={styles.evidenceLink}>公式値と計算式を見る <ArrowRight size={15} aria-hidden="true" /></Link>
        </article>

        <article className={styles.questionRow} data-topic="fund" data-tone={fundTone} aria-labelledby="citizen-fund-shortage-title">
          <div className={styles.questionLead}>
            <span className={styles.questionIcon} aria-hidden="true"><Landmark size={20} /></span>
            <div><h3 id="citizen-fund-shortage-title">資金不足は？</h3></div>
          </div>
          <div className={styles.questionAnswer}>
            <FundShortageStatus
              assessment={fundShortage}
              businessLabelsByKey={businessLabelsByKey}
            />
          </div>
          <a href={fundShortage?.sourceUrls.landingPage ?? "https://www.soumu.go.jp/menu_news/s-news/01zaisei07_02000434.html"} target="_blank" rel="noreferrer" className={styles.evidenceLink}>
            総務省 R6確報 <ExternalLink size={14} aria-hidden="true" />
          </a>
        </article>
      </div>

      <details className={styles.comparisonBasis}>
        <summary>{areaLabel}比較の対象 <ChevronDown size={15} aria-hidden="true" /></summary>
        <p>{prefectureName}内の{assessment.comparisonBasis.scopeLabel.replace("同一都道府県の", "")}（R6・本サイトの比較区分）</p>
      </details>
    </section>
  );
}

function FundShortageStatus({
  assessment,
  businessLabelsByKey
}: {
  assessment: FundShortageAssessment | null;
  businessLabelsByKey: Record<string, string>;
}) {
  if (!assessment || assessment.status === "unavailable") {
    return (
      <div className={styles.fundStatus} data-status="unavailable">
        <strong>資金不足のデータ未確認</strong>

      </div>
    );
  }
  if (assessment.status === "no_shortage") {
    return (
      <div className={styles.fundStatus} data-status="no_shortage">
        <strong>資金不足会計一覧に掲載なし（{assessment.fiscalYearLabel}確報）</strong>

        <small>{assessment.municipalityName}・会計単位 {assessment.accountUnit}</small>
      </div>
    );
  }

  const sharedLabels = assessment.sharedBusinessKeys.map((key) => businessLabelsByKey[key] ?? key);
  return (
    <div className={styles.fundStatus} data-status={assessment.isAtOrAboveManagementImprovementThreshold ? "threshold" : "shortage"}>
      <strong>資金不足比率 {assessment.ratioPercent == null ? "比率未確認" : `${assessment.ratioPercent.toFixed(1)}%`}</strong>
      <p>{assessment.accountName ?? "会計名未取得"}・資金不足額 {assessment.amountThousandYen == null ? "未取得" : `${assessment.amountThousandYen.toLocaleString("ja-JP")}千円`}</p>
      {assessment.isAtOrAboveManagementImprovementThreshold ? (
        <p>経営健全化基準の20%以上です。</p>
      ) : (
        <p>資金不足はありますが、20%の経営健全化基準未満です。</p>
      )}
      {sharedLabels.length > 1 ? <small>同じ会計に含まれる事業：{sharedLabels.join("、")}</small> : null}
    </div>
  );
}

function revisionStatusLabel(
  comparison: MunicipalityFeeRevisionComparison | null,
  selectedRevision: MunicipalityFeeRevisionComparison["changes"][number] | null
) {
  if (!comparison) return "改定履歴のデータ不足";
  if (selectedRevision) return "使用料の施行日が変更";
  if (comparison.status === "changed") return "別の事業で施行日が変更";
  return "使用料の施行日に変更なし";
}

function localizeAreaLabel(text: string | null | undefined, areaLabel: string) {
  return text?.replaceAll("県内", areaLabel) ?? "比較に必要な公式値が揃っていません。";
}

function formatYen(value: number) {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function formatSignedYen(value: number) {
  if (Math.abs(value) < 0.5) return "差なし";
  return `${value > 0 ? "+" : "−"}${Math.round(Math.abs(value)).toLocaleString("ja-JP")}円`;
}

function formatSignedPercent(value: number) {
  if (Math.abs(value) < 0.05) return "±0.0%";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function prefectureAreaLabel(prefectureName: string) {
  if (prefectureName === "北海道") return "道内";
  if (prefectureName === "東京都") return "都内";
  if (prefectureName === "大阪府" || prefectureName === "京都府") return "府内";
  return "県内";
}
