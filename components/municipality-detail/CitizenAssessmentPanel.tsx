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
  yearbookHref
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
          <span>{fiscalLabel}・市民向け診断</span>
          <h2 id="citizen-assessment-title">{municipalityName}の下水道を、知りたい順に見る</h2>
        </div>
        <p>{businessLabel}の公式値と本サイトの計算を分け、結論の根拠までたどれるように整理しています。</p>
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
            <span>まず知りたいこと</span>
            <h3 id="citizen-fee-position-title">料金は{areaLabel}で高い？</h3>
          </div>
        </div>
        <div className={styles.feeAmount}>
          <strong>{householdFeeNotApplicable ? "対象外" : fee == null ? "未取得" : `${Math.round(fee).toLocaleString("ja-JP")}円`}</strong>
          <span>{householdFeeNotApplicable ? "特定公共下水道" : "一般家庭用20m³／月・税込"}</span>
        </div>
        <div className={styles.rankAnswer} aria-live="polite">
          {feeRank ? (
            <>
              <strong>{feeRank.tied ? "同率" : ""}{feeRank.rank}位 <span>／ {feeRank.total}事業体</span></strong>
              <p>
                高い方からの順位。{areaLabel}中央値 {formatYen(feeRank.median)}に対して
                <b>{formatSignedYen(feeRank.differenceYen)}（{formatSignedPercent(feeRank.differencePercent)}）</b>です。
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
          {areaLabel}の比較根拠を見る <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </article>

      <div className={styles.questionList}>
        <article className={styles.questionRow} data-topic="cost" aria-labelledby="citizen-cost-title">
          <div className={styles.questionLead}>
            <span className={styles.questionIcon} aria-hidden="true"><FileSearch size={20} /></span>
            <div><span>データから考えられる要因</span><h3 id="citizen-cost-title">なぜ、この料金水準？</h3></div>
          </div>
          <div className={styles.questionAnswer}>
            <div className={styles.costConclusion} data-state={feeLevelCostAnalysis.state}>
              <strong>{feeComparisonLoading
                ? `${areaLabel}の費用比較を読み込んでいます`
                : localizeAreaLabel(feeLevelCostAnalysis.headline, areaLabel)}</strong>
              <p>{feeComparisonLoading
                ? "維持管理費分・資本費分と比較対象の中央値を確認しています。"
                : localizeAreaLabel(feeLevelCostAnalysis.explanation, areaLabel)}</p>
            </div>
          </div>
          <Link href={feeAnalysisHref} className={styles.evidenceLink}>料金水準の考察を見る <ArrowRight size={15} aria-hidden="true" /></Link>
        </article>

        <article className={styles.questionRow} data-topic="sustainability" data-tone={sustainabilityTone} aria-labelledby="citizen-sustainability-title">
          <div className={styles.questionLead}>
            <span className={styles.questionIcon} aria-hidden="true"><Scale size={20} /></span>
            <div><span>根拠別の見立て</span><h3 id="citizen-sustainability-title">将来も続けられる？</h3></div>
          </div>
          <div className={styles.questionAnswer}>
            <strong>{assessment.sustainability.headline}</strong>
            <p>{assessment.sustainability.derivedConclusion || "確認できる指標が限られるため、根拠を追加して判断する必要があります。"}</p>
            <ul className={styles.reasonList}>
              {assessment.sustainability.reasons.map((reason) => (
                <li
                  key={reason.category}
                  data-direction={reason.direction}
                  data-critical={reason.category === "fund_shortage" && fundShortage?.isAtOrAboveManagementImprovementThreshold ? "true" : undefined}
                >
                  <span>{reason.title}</span>
                  <small>{reason.detail}</small>
                </li>
              ))}
            </ul>
            <details className={styles.limitations}>
              <summary>この診断だけでは判断できないこと <ChevronDown size={15} aria-hidden="true" /></summary>
              <ul>{assessment.sustainability.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
            </details>
          </div>
        </article>

        <article className={styles.questionRow} data-topic="future" data-tone={futureTone} aria-labelledby="citizen-fee-future-title">
          <div className={styles.questionLead}>
            <span className={styles.questionIcon} aria-hidden="true"><TrendingUp size={20} /></span>
            <div><span>公式情報と単純計算を分離</span><h3 id="citizen-fee-future-title">料金が上がる可能性は？</h3></div>
          </div>
          <div className={styles.questionAnswer}>
            <div className={styles.revisionStatus} data-status={revisionStatus}>
              <span>R5・R6 公式施行年月日</span>
              <strong>{revisionStatusLabel(revisionComparison, selectedRevision)}</strong>
              {selectedRevision ? (
                <small>{formatFeeRevisionEffectiveDate(selectedRevision.r5EffectiveDate)} → {formatFeeRevisionEffectiveDate(selectedRevision.r6EffectiveDate)}</small>
              ) : null}
            </div>
            <strong>{scenario.status === "gap" && scenario.revenueIncreaseRatePercent != null
              ? `現在の費用を使用料収入だけで回収する単純シナリオ：事業全体で +${scenario.revenueIncreaseRatePercent.toFixed(1)}%`
              : scenario.status === "no_current_gap"
                ? "現在の費用を使用料収入だけで回収する単純シナリオ：追加増収は不要"
                : "現在の費用を使用料収入だけで回収する単純シナリオ：計算できません"}</strong>
            <p>{scenario.explanation}</p>
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
            <p className={styles.caveat}>{scenario.caveat} 施行年月日の変化は将来の改定予定を示すものではありません。</p>
          </div>
          <Link href={yearbookHref} className={styles.evidenceLink}>公式値と計算式を見る <ArrowRight size={15} aria-hidden="true" /></Link>
        </article>

        <article className={styles.questionRow} data-topic="fund" data-tone={fundTone} aria-labelledby="citizen-fund-shortage-title">
          <div className={styles.questionLead}>
            <span className={styles.questionIcon} aria-hidden="true"><Landmark size={20} /></span>
            <div><span>会計単位の公式値</span><h3 id="citizen-fund-shortage-title">この事業を含む会計の資金不足</h3></div>
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
        <summary>{areaLabel}順位・要因整理の比較条件 <ChevronDown size={15} aria-hidden="true" /></summary>
        <p>{prefectureName}内の{assessment.comparisonBasis.scopeLabel.replace("同一都道府県の", "")}を比較しています。総務省の公式類似団体区分ではなく、本サイト独自の比較です。</p>
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
        <strong>公式データとの会計単位の照合ができません</strong>
        <p>会計単位とは、同じ決算書にまとめられる事業のまとまりです。資金不足なし、または0%とは扱いません。公式資料で会計名を確認してください。</p>
      </div>
    );
  }
  if (assessment.status === "no_shortage") {
    return (
      <div className={styles.fundStatus} data-status="no_shortage">
        <strong>資金不足会計一覧に掲載なし（{assessment.fiscalYearLabel}確報）</strong>
        <p>総務省の「資金不足額がある公営企業会計」一覧との照合結果です。この会計の資金不足額を直接示す公表値ではなく、長期的な持続可能性を保証するものでもありません。</p>
        <small>{assessment.municipalityName}・会計単位（同じ決算書のまとまり） {assessment.accountUnit}</small>
      </div>
    );
  }

  const sharedLabels = assessment.sharedBusinessKeys.map((key) => businessLabelsByKey[key] ?? key);
  return (
    <div className={styles.fundStatus} data-status={assessment.isAtOrAboveManagementImprovementThreshold ? "threshold" : "shortage"}>
      <strong>資金不足比率 {assessment.ratioPercent == null ? "比率未確認" : `${assessment.ratioPercent.toFixed(1)}%`}</strong>
      <p>{assessment.accountName ?? "会計名未取得"}・資金不足額 {assessment.amountThousandYen == null ? "未取得" : `${assessment.amountThousandYen.toLocaleString("ja-JP")}千円`}</p>
      {assessment.isAtOrAboveManagementImprovementThreshold ? (
        <p>20%以上は原則として経営健全化計画の基準です。地方債の発行が一律に禁じられる制度ではありませんが、計画や地方債の協議・許可で経営見通しが確認されます。</p>
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
  if (!comparison) return "比較できる公式データが揃っていません";
  if (selectedRevision) return "選択中の事業で施行年月日が変化";
  if (comparison.status === "changed") return "自治体内の別事業で施行年月日が変化";
  return "比較済み・施行年月日の変化なし";
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
