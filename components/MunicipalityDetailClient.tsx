"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  ChevronDown,
  Database,
  ExternalLink,
  FileChartColumnIncreasing,
  Landmark,
  MapPinned,
  ShieldCheck
} from "lucide-react";
import { CitizenAssessmentPanel } from "@/components/municipality-detail/CitizenAssessmentPanel";
import { FeeLevelAnalysisPanel } from "@/components/municipality-detail/FeeLevelAnalysisPanel";
import { FinancialStory } from "@/components/municipality-detail/FinancialStory";
import { PrefecturePeerComparison } from "@/components/municipality-detail/PrefecturePeerComparison";
import { YearbookOriginalData } from "@/components/municipality-detail/YearbookOriginalData";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import { accountingTypeLabel, businessCategoryCode, displayBusinessName } from "@/lib/businessDisplay";
import {
  buildCitizenMunicipalityAssessment,
  buildCitizenR6DataAvailability
} from "@/lib/citizenMunicipalityAssessment";
import { formulaCopy } from "@/lib/copy";
import { mergeCostCompositionIntoDetail, type StaticCostCompositionBundle } from "@/lib/costCompositionStatic";
import { formatSettlementFiscalLabel } from "@/lib/format";
import {
  fundShortageAssessmentSelectionKey,
  type FundShortageAssessment
} from "@/lib/fundShortage";
import type { MunicipalityFeeRevisionComparison } from "@/lib/municipalityFeeRevision";
import {
  mergePrefecturePeerFeeCostSupplement,
  type PrefecturePeerComparisonResult,
  type PrefecturePeerComparisonRow
} from "@/lib/prefecturePeerComparison";
import styles from "@/app/municipalities/[municipalityCode]/page.module.css";

type DetailView = "fees" | "fee-analysis" | "finance" | "prefecture" | "yearbook";
type MunicipalityDetail = any;
type DetailBusiness = MunicipalityDetail["businesses"][number];
type DetailAnnual = DetailBusiness["annualFinancials"][number];

type BusinessGroup = {
  key: string;
  businesses: DetailBusiness[];
  latestBusiness: DetailBusiness;
  latest: DetailAnnual;
};

type CurrentFundingContext = {
  operatingRevenue: number | null;
  operatingExpense: number | null;
  operatingLoss: number | null;
};

type PeerComparisonLoadState = {
  requestKey: string | null;
  status: "idle" | "loading" | "ready" | "error";
  model: PrefecturePeerComparisonResult | null;
};

type MunicipalityDetailClientProps = {
  municipalityCode: string;
  fundShortageAssessments: Record<string, FundShortageAssessment>;
  feeRevisionComparison: MunicipalityFeeRevisionComparison | null;
  availableJointOperatorMunicipalityCodes: string[];
  availableMunicipalityDetailCodes: string[];
};

export function selectPeerComparisonView(
  requestKey: string | null,
  state: PeerComparisonLoadState
) {
  const matchesCurrentRequest = requestKey != null && state.requestKey === requestKey;
  return {
    peerLoading: requestKey != null && (!matchesCurrentRequest || state.status === "loading"),
    prefecturePeerComparison: matchesCurrentRequest ? state.model : null
  };
}

export function MunicipalityDetailClient({
  municipalityCode,
  fundShortageAssessments,
  feeRevisionComparison,
  availableJointOperatorMunicipalityCodes,
  availableMunicipalityDetailCodes
}: MunicipalityDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [municipality, setMunicipality] = useState<MunicipalityDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    const detailRequest = fetch(`/data/static/municipalities/${municipalityCode}.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Municipality detail unavailable");
        return response.json();
      });
    const costCompositionRequest = fetch(`/data/static/cost-composition/${municipalityCode}.json`)
      .then((response) => response.ok ? response.json() as Promise<StaticCostCompositionBundle> : null)
      .catch(() => null);
    Promise.all([detailRequest, costCompositionRequest])
      .then(([detail, costComposition]) => {
        if (!cancelled) setMunicipality(mergeCostCompositionIntoDetail(detail, costComposition));
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [municipalityCode]);

  const groups = useMemo(
    () => municipality ? buildBusinessGroups(municipality.businesses) : [],
    [municipality]
  );
  const requestedBusiness = searchParams.get("business") ?? undefined;
  const view = parseDetailView(searchParams.get("view") ?? undefined);
  const selectedGroup = selectBusinessGroup(groups, requestedBusiness);
  const peerRequestKey = municipality && selectedGroup
    ? [
        municipality.municipalityCode,
        municipality.prefectureCode,
        selectedGroup.key,
        selectedGroup.latestBusiness.businessKey
      ].join(":")
    : null;
  const [peerComparisonState, setPeerComparisonState] = useState<PeerComparisonLoadState>({
    requestKey: null,
    status: "idle",
    model: null
  });
  const { peerLoading, prefecturePeerComparison } = selectPeerComparisonView(
    peerRequestKey,
    peerComparisonState
  );

  useEffect(() => {
    let cancelled = false;
    if (!municipality || !selectedGroup || !peerRequestKey) {
      setPeerComparisonState({ requestKey: null, status: "idle", model: null });
      return;
    }
    setPeerComparisonState({ requestKey: peerRequestKey, status: "loading", model: null });
    const currentFundingContext = buildCurrentFundingContext(selectedGroup);
    const peerRequest = fetch(`/data/static/citizen-peers/${municipality.prefectureCode}/${encodeURIComponent(selectedGroup.key)}.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Peer comparison unavailable");
        return response.json() as Promise<PrefecturePeerComparisonResult>;
      });
    const feeCostRequest = fetch(`/data/static/citizen-fee-costs/${municipality.prefectureCode}/${encodeURIComponent(selectedGroup.key)}.json`)
      .then((response) => response.ok ? response.json() as Promise<unknown> : null)
      .catch(() => null);
    Promise.all([peerRequest, feeCostRequest])
      .then(([model, feeCosts]) => {
        if (cancelled) return;
        setPeerComparisonState({
          requestKey: peerRequestKey,
          status: "ready",
          model: bindPeerComparisonToSelectedBusiness({
            model: mergePrefecturePeerFeeCostSupplement(model, feeCosts),
            municipalityCode: municipality.municipalityCode,
            businessKey: selectedGroup.latestBusiness.businessKey,
            currentFundingContext
          })
        });
      })
      .catch(() => {
        if (!cancelled) {
          setPeerComparisonState({ requestKey: peerRequestKey, status: "error", model: null });
        }
      });
    return () => { cancelled = true; };
  }, [municipality, peerRequestKey, selectedGroup]);

  if (loadFailed) {
    return <div className={styles.page}><div className={styles.container}><p className={styles.emptySupport}>自治体データを読み込めませんでした。</p></div></div>;
  }
  if (!municipality) {
    return <div className={styles.page}><div className={styles.container}><p className={styles.emptySupport}>自治体データを読み込んでいます…</p></div></div>;
  }
  if (!selectedGroup) {
    return (
      <EmptyMunicipality
        municipality={municipality}
        availableJointOperatorMunicipalityCodes={availableJointOperatorMunicipalityCodes}
      />
    );
  }

  const { latest, latestBusiness } = selectedGroup;
  const qualityFlags = parseStringArray(latest.flagsJson);
  const diagnosis = withExactRecoveryRate(
    sanitizeAmbiguousDiagnosis(latest.diagnosisResult, qualityFlags),
    latest
  );
  const fiscal = formatSettlementFiscalLabel({
    surveyYear: latest.surveyYear,
    fiscalYearLabel: latest.fiscalYearLabel
  });
  const trendPoints = buildTrendPoints(selectedGroup);
  const evidenceEntries = latestBusiness.evidenceEntries ?? [];
  const financialStory = latestBusiness.financialStory;
  const financialStatementsReady = latestBusiness.financialStatementsReady;
  const financeAvailabilityLabel = latestBusiness.accountingType === "non_legal_applied"
    ? "財務図 対象外"
    : financialStatementsReady ? "R6 財務を読む" : "R6 財務（未取得）";
  const categoryCode = businessCategoryCode(latestBusiness);
  const r6DataAvailability = buildCitizenR6DataAvailability(latest.surveyYear, fiscal);
  const householdFee20m3Applicability = categoryCode === "17/2" ? "not_applicable" : "applicable";
  const localComparisonLabel = prefectureComparisonLabel(municipality.prefectureName);
  const areaLabel = prefectureAreaLabel(municipality.prefectureName);
  const currentPeerRow = findCurrentPeerRow(
    prefecturePeerComparison?.rows ?? [],
    municipality.municipalityCode,
    latestBusiness.businessKey
  );
  const selectedPeerComparison = r6DataAvailability.status === "available" && currentPeerRow
    ? prefecturePeerComparison
    : null;
  const fundShortage = fundShortageAssessments[fundShortageAssessmentSelectionKey(latestBusiness)] ?? null;
  const assessment = buildCitizenMunicipalityAssessment({
    r6DataAvailability,
    householdFee20m3Applicability,
    peerComparison: selectedPeerComparison,
    currentComparisonUnitKey: currentPeerRow?.comparisonUnitKey,
    householdFee20m3Yen: householdFee20m3Applicability === "not_applicable" ? null : latest.householdFee20m3Yen,
    feeUnitPriceYenPerM3: diagnosis?.feeUnitPriceYenPerM3,
    treatmentCostYenPerM3: diagnosis?.treatmentCostYenPerM3,
    expenseRecoveryRate: diagnosis?.expenseRecoveryRate,
    sewerFeeRevenue: latest.sewerFeeRevenue,
    wastewaterTreatmentCost: latest.wastewaterTreatmentCost,
    annualBillableVolume: latest.annualBillableVolume,
    opexComponent: latest.opexComponent,
    capitalCostComponent: latest.capitalCostComponent,
    accountingType: latestBusiness.accountingType,
    purposeCostItems: buildPurposeCostItems(financialStory?.income?.expenseBreakdown),
    annuals: trendPoints.map((point) => ({
      surveyYear: point.year,
      annualBillableVolume: point.annualBillableVolume,
      bondBalance: findAnnual(selectedGroup, point.year, latestBusiness.accountingType)?.bondBalance ?? null
    })),
    costComposition: financialStory?.costComposition ? {
      total: financialStory.costComposition.total,
      items: financialStory.costComposition.items
    } : null,
    finance: {
      netIncome: financialStory?.income?.netIncome ?? latest.netIncome,
      currentNetAssets: financialStory?.balance?.totalNetAssets,
      priorNetAssets: financialStory?.balance?.priorNetAssets,
      bondBalances: trendPoints.map((point) => ({
        surveyYear: point.year,
        value: findAnnual(selectedGroup, point.year, latestBusiness.accountingType)?.bondBalance ?? null
      }))
    },
    fundShortage
  });
  const businessLabelsByKey = Object.fromEntries(groups.map((group) => [
    group.key,
    displayBusinessName(group.latestBusiness)
  ]));

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="パンくず">
          <Link href="/">ホーム</Link>
          <span aria-hidden="true">/</span>
          <Link href="/municipalities">自治体検索</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">自治体詳細</span>
        </nav>

        <header className={styles.summary}>
          <div className={styles.identity}>
            <span className={styles.municipalityIcon} aria-hidden="true"><Building2 size={28} /></span>
            <div className={styles.identityCopy}>
              <div className={styles.titleRow}>
                <h1>{municipality.municipalityName}</h1>
                <span className={styles.prefecture}>{municipality.prefectureName}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaPill}>{displayBusinessName(latestBusiness)}</span>
                <span className={latestBusiness.accountingType === "legal_applied" ? styles.metaPillBlue : styles.metaPillMuted}>
                  {accountingTypeLabel(latestBusiness.accountingType)}
                  {latestBusiness.accountingType === "non_legal_applied" ? "（参考）" : ""}
                </span>
                <span className={styles.metaPillNeutral}>{fiscal}</span>
                <span className={styles.code}>自治体コード {municipality.municipalityCode ?? "不明"}</span>
              </div>
            </div>
          </div>
          <Link href="/municipalities" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            自治体を変更
          </Link>
        </header>

        {groups.length > 1 ? (
          <section className={styles.businessSelector} aria-labelledby="business-selector-title">
            <div className={styles.businessSelectorCopy}>
              <span>{groups.length}種類の下水道事業</span>
              <h2 id="business-selector-title">表示する事業を選ぶ</h2>
              <p>事業ごとの料金と経営状況を見られます。</p>
            </div>
            <label className={styles.businessSelectControl}>
              <span>選択中の決算事業</span>
              <select
                value={selectedGroup.key}
                onChange={(event) => router.push(detailHref(municipalityCode, event.currentTarget.value, view))}
              >
                {groups.map((group) => (
                  <option key={group.key} value={group.key}>
                    {displayBusinessName(group.latestBusiness)}／{accountingTypeLabel(group.latestBusiness.accountingType)}／{formatSettlementFiscalLabel({ surveyYear: group.latest.surveyYear, fiscalYearLabel: group.latest.fiscalYearLabel })}
                  </option>
                ))}
              </select>
            </label>
          </section>
        ) : null}

        {qualityFlags.length > 0 ? (
          <aside className={styles.qualityWarning} role="note" aria-label="データ品質の注記">
            <AlertTriangle size={18} aria-hidden="true" />
            <div><strong>データの確認状況</strong><p>{qualityFlags.join("／")}</p></div>
          </aside>
        ) : null}

        <JointOperationLinks
          municipality={municipality}
          availableJointOperatorMunicipalityCodes={availableJointOperatorMunicipalityCodes}
        />

        {view === "fees" ? (
          <CitizenAssessmentPanel
            assessment={assessment}
            municipalityName={municipality.municipalityName}
            prefectureName={municipality.prefectureName}
            businessKey={latestBusiness.businessKey}
            businessLabel={displayBusinessName(latestBusiness)}
            fiscalLabel={fiscal}
            peerLoading={peerLoading}
            fundShortage={fundShortage}
            revisionComparison={feeRevisionComparison}
            businessLabelsByKey={businessLabelsByKey}
            prefectureHref={detailHref(municipalityCode, selectedGroup.key, "prefecture")}
            feeAnalysisHref={detailHref(municipalityCode, selectedGroup.key, "fee-analysis")}
            financeHref={detailHref(municipalityCode, selectedGroup.key, "finance")}
            yearbookHref={detailHref(municipalityCode, selectedGroup.key, "yearbook")}
          />
        ) : null}

        <nav className={styles.viewTabs} aria-label="詳細の表示切り替え">
          <Link
            href={detailHref(municipalityCode, selectedGroup.key, "fees")}
            className={view === "fees" || view === "fee-analysis" ? styles.activeTab : undefined}
            aria-current={view === "fees" ? "page" : view === "fee-analysis" ? "location" : undefined}
            aria-label="このまちの診断"
          >
            <ChartNoAxesCombined size={18} aria-hidden="true" />
            <span className={styles.tabLabelDesktop}>このまちの診断</span>
            <span className={styles.tabLabelMobile}>診断</span>
          </Link>
          <Link
            href={detailHref(municipalityCode, selectedGroup.key, "finance")}
            className={view === "finance" ? styles.activeTab : undefined}
            aria-current={view === "finance" ? "page" : undefined}
            aria-label={`財務の根拠（${financeAvailabilityLabel}）`}
          >
            <FileChartColumnIncreasing size={18} aria-hidden="true" />
            <span className={styles.tabLabelDesktop}>財務の根拠</span>
            <span className={styles.tabLabelMobile}>財務</span>
          </Link>
          <Link
            href={detailHref(municipalityCode, selectedGroup.key, "prefecture")}
            className={view === "prefecture" ? styles.activeTab : undefined}
            aria-current={view === "prefecture" ? "page" : undefined}
            aria-label={`県内の位置（${municipality.prefectureName}内の比較）`}
          >
            <MapPinned size={18} aria-hidden="true" />
            <span className={styles.tabLabelDesktop}>県内の位置</span>
            <span className={styles.tabLabelMobile}>県内</span>
          </Link>
          <Link
            href={detailHref(municipalityCode, selectedGroup.key, "yearbook")}
            className={view === "yearbook" ? styles.activeTab : undefined}
            aria-current={view === "yearbook" ? "page" : undefined}
            aria-label="公式データ"
          >
            <Database size={18} aria-hidden="true" />
            <span className={styles.tabLabelDesktop}>公式データ</span>
            <span className={styles.tabLabelMobile}>公式</span>
          </Link>
        </nav>

        {view === "fees" ? (
          <>
            <details className={styles.feeEvidenceDetails}>
              <summary>
                <span><strong>料金と費用回収の詳しい根拠</strong><small>公式値、年間収入・費用、計算範囲を確認</small></span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <div className={styles.feeEvidenceBody}>
                <FeeRecoveryStory annual={latest} diagnosis={diagnosis} fiscal={fiscal} />
              </div>
            </details>
            <section className={styles.contentSection} aria-labelledby="trend-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <span>R2—R6</span>
                  <h2 id="trend-heading">5年間の料金指標</h2>
                </div>
                <p>料金と経営指標の推移（空欄はデータ未取得）</p>
              </div>
              <TrendChart points={trendPoints} />
            </section>
          </>
        ) : view === "fee-analysis" ? (
          <FeeLevelAnalysisPanel
            key={`${municipalityCode}:${selectedGroup.key}`}
            peerComparison={selectedPeerComparison}
            currentComparisonUnitKey={currentPeerRow?.comparisonUnitKey}
            assessment={assessment}
            municipalityName={municipality.municipalityName}
            prefectureName={municipality.prefectureName}
            businessLabel={displayBusinessName(latestBusiness)}
            fiscalLabel={fiscal}
            peerLoading={peerLoading}
            diagnosisHref={detailHref(municipalityCode, selectedGroup.key, "fees")}
            financeHref={detailHref(municipalityCode, selectedGroup.key, "finance")}
            yearbookHref={detailHref(municipalityCode, selectedGroup.key, "yearbook")}
          />
        ) : view === "finance" ? (
          <section className={styles.financeSection} aria-label="R6財務の読み解き">
            <FinancialStory {...financialStory} />
          </section>
        ) : view === "yearbook" ? (
          <section id="official-data" className={styles.yearbookView} aria-labelledby="yearbook-view-title">
            <div className={styles.yearbookViewHeading}>
              <span>{fiscal}・選択中の決算事業</span>
              <h2 id="yearbook-view-title">公式データと計算根拠</h2>
              <p>総務省「地方公営企業年鑑」の原表と、各指標の計算に使った数値です。</p>
            </div>
            <YearbookOriginalData
              enabled={view === "yearbook"}
              municipalityCode={municipality.municipalityCode}
              businessKey={latestBusiness.businessKey}
              accountingType={latestBusiness.accountingType}
              evidenceEntries={evidenceEntries}
              annual={latest}
              diagnosis={diagnosis}
            />
          </section>
        ) : selectedPeerComparison ? (
          <section className={styles.financeSection} aria-label={`${localComparisonLabel}の比較`}>
            <PrefecturePeerComparison
              model={selectedPeerComparison}
              businessLabel={displayBusinessName(latestBusiness)}
              availableMunicipalityDetailCodes={availableMunicipalityDetailCodes}
            />
          </section>
        ) : (
          <p className={styles.peerStatus} role="status">
            {peerLoading ? `${localComparisonLabel}の比較データを読み込んでいます…` : `この条件では${areaLabel}比較データを読み込めませんでした。`}
          </p>
        )}

        <section className={styles.formulaSection} aria-labelledby="indicator-formula-title">
          <header className={styles.formulaHeading}>
            <span><Calculator size={18} aria-hidden="true" /></span>
            <div><h2 id="indicator-formula-title">指標の計算式</h2><p>使用料水準の算定方法</p></div>
          </header>
          <div className={styles.formulaGrid}>
            {formulaCopy.map((item) => (
              <div key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.formula}</span>
              </div>
            ))}
          </div>
        </section>


      </div>
    </div>
  );
}

function JointOperationLinks({
  municipality,
  availableJointOperatorMunicipalityCodes
}: {
  municipality: MunicipalityDetail;
  availableJointOperatorMunicipalityCodes: string[];
}) {
  const membershipsByKey = new Map<string, any>();
  for (const membership of municipality.servedServiceMemberships as any[]) {
    membershipsByKey.set(`${membership.operatorMunicipality.municipalityCode}:${membership.businessKey}`, membership);
  }
  const memberships = [...membershipsByKey.values()];
  if (memberships.length === 0) return null;
  const operatorNames = [...new Set(memberships.map((membership) => membership.operatorMunicipality.municipalityName))];
  const firstSource = memberships[0];
  return (
    <aside className={styles.jointOperationCard} aria-label="組合運営の関連下水道事業">
      <div className={styles.jointOperationCopy}>
        <span aria-hidden="true"><Landmark size={18} /></span>
        <div>
          <strong>組合運営の関連下水道があります</strong>
          <p>{operatorNames.join("・")}が運営する、組合全体の決算です。</p>
        </div>
      </div>
      <div className={styles.jointOperationLinks}>
        {memberships.map((membership) => {
          const operatorCode = membership.operatorMunicipality.municipalityCode;
          if (!operatorCode) return null;
          const href = jointOperationHref(
            operatorCode,
            membership.businessKey,
            availableJointOperatorMunicipalityCodes
          );
          if (!href) {
            return (
              <span className={styles.jointOperationUnavailable} key={`${operatorCode}:${membership.businessKey}`}>
                <span>{sewerBusinessKeyLabel(membership.businessKey)}</span>
                <small>組合全体の料金指標は、当サイトでは未掲載です</small>
              </span>
            );
          }
          return (
            <Link key={`${operatorCode}:${membership.businessKey}`} href={href}>
              <span>{sewerBusinessKeyLabel(membership.businessKey)}</span>
              <small>組合全体の料金指標を見る</small>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          );
        })}
        <a href={firstSource.sourceUrl} target="_blank" rel="noreferrer" className={styles.jointOperationSource} aria-label={firstSource.sourceLabel}>
          公式根拠
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
}

function sewerBusinessKeyLabel(businessKey: string) {
  if (businessKey === "17-1-000") return "公共下水道";
  if (businessKey === "17-4-000") return "特定環境保全公共下水道";
  return `関連事業 ${businessKey}`;
}

function EmptyMunicipality({
  municipality,
  availableJointOperatorMunicipalityCodes
}: {
  municipality: MunicipalityDetail;
  availableJointOperatorMunicipalityCodes: string[];
}) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.summary}>
          <div className={styles.identity}>
            <span className={styles.municipalityIcon} aria-hidden="true"><Building2 size={28} /></span>
            <div className={styles.identityCopy}>
              <div className={styles.titleRow}><h1>{municipality.municipalityName}</h1><span className={styles.prefecture}>{municipality.prefectureName}</span></div>
              <p className={styles.code}>市町村単独名義の比較対象事業データは未登録です。</p>
            </div>
          </div>
          <Link href="/municipalities" className={styles.backLink}><ArrowLeft size={16} />自治体を変更</Link>
        </header>
        <JointOperationLinks
          municipality={municipality}
          availableJointOperatorMunicipalityCodes={availableJointOperatorMunicipalityCodes}
        />
      </div>
    </div>
  );
}

function buildBusinessGroups(businesses: DetailBusiness[]): BusinessGroup[] {
  const grouped = new Map<string, DetailBusiness[]>();
  for (const business of businesses) {
    if (isFlowSewerBusiness(business) || business.annualFinancials.length === 0) continue;
    const rows = grouped.get(business.businessKey) ?? [];
    rows.push(business);
    grouped.set(business.businessKey, rows);
  }

  return [...grouped.entries()]
    .flatMap(([key, rows]) => {
      const latestPair = rows
        .flatMap((business: any) => business.annualFinancials.map((annual: any) => ({ business, annual })))
        .sort((a, b) => {
          if (a.annual.surveyYear !== b.annual.surveyYear) return b.annual.surveyYear - a.annual.surveyYear;
          return accountingPriority(b.business.accountingType) - accountingPriority(a.business.accountingType);
        })[0];
      return latestPair ? [{ key, businesses: rows, latestBusiness: latestPair.business, latest: latestPair.annual }] : [];
    })
    .sort((a, b) =>
      b.latest.surveyYear - a.latest.surveyYear
      || businessGroupPriority(b) - businessGroupPriority(a)
      || displayBusinessName(a.latestBusiness).localeCompare(displayBusinessName(b.latestBusiness), "ja")
    );
}

function selectBusinessGroup(groups: BusinessGroup[], requested?: string) {
  return groups.find((group) => group.key === requested) ?? groups[0] ?? null;
}

function businessGroupPriority(group: BusinessGroup) {
  const publicSewer = /^17-1(?:-|$)/.test(group.key) || displayBusinessName(group.latestBusiness) === "公共下水道";
  return (publicSewer ? 10 : 0) + accountingPriority(group.latestBusiness.accountingType);
}

function accountingPriority(accountingType: string | null | undefined) {
  return accountingType === "legal_applied" ? 2 : accountingType === "non_legal_applied" ? 1 : 0;
}

function isFlowSewerBusiness(business: Pick<DetailBusiness, "businessKey" | "businessName" | "businessType" | "estatBusinessCategory">) {
  if (/^17[-/]3(?:[-/]|$)/.test(business.businessKey) || /^17\/3(?:\/|$)/.test(business.estatBusinessCategory ?? "")) return true;
  const normalized = [business.businessName, business.businessType].filter(Boolean).join(" ").normalize("NFKC").replace(/\s+/g, "");
  return normalized.includes("流域下水道") || normalized.includes("下水道事業(一)事業コード3");
}

function buildTrendPoints(group: BusinessGroup): TrendPoint[] {
  return [2020, 2021, 2022, 2023, 2024].map((year) => {
    const annual = findAnnual(group, year);
    const diagnosis = withExactRecoveryRate(
      sanitizeAmbiguousDiagnosis(
        annual?.diagnosisResult ?? null,
        parseStringArray(annual?.flagsJson)
      ),
      annual
    );
    return {
      year,
      fiscalYearLabel: annual?.fiscalYearLabel ?? `R${year - 2018}`,
      accountingType: annual?.accountingType ?? null,
      expenseRecoveryRate: diagnosis?.expenseRecoveryRate ?? null,
      householdFee20m3Yen: positiveFiniteOrNull(annual?.householdFee20m3Yen),
      feeUnitPriceYenPerM3: diagnosis?.feeUnitPriceYenPerM3 ?? null,
      treatmentCostYenPerM3: diagnosis?.treatmentCostYenPerM3 ?? null,
      annualBillableVolume: annual?.annualBillableVolume ?? null
    };
  });
}

function sanitizeAmbiguousDiagnosis(
  diagnosis: DetailAnnual["diagnosisResult"],
  flags: string[]
) {
  if (!diagnosis || !flags.some((flag) => flag.includes("0または欠損"))) return diagnosis;
  return {
    ...diagnosis,
    feeUnitPriceYenPerM3: null,
    treatmentCostYenPerM3: null,
    expenseRecoveryRate: null,
    requiredRevisionRateTo80: null,
    requiredRevisionRateTo100: null,
    requiredRevisionRateTo150yen: null,
    feeAdequacyLabel: null
  };
}

function withExactRecoveryRate(
  diagnosis: DetailAnnual["diagnosisResult"],
  annual?: DetailAnnual | null
) {
  if (!diagnosis) return diagnosis;
  const revenue = finiteOrNull(annual?.sewerFeeRevenue);
  const cost = finiteOrNull(annual?.wastewaterTreatmentCost);
  if (revenue == null || revenue < 0 || cost == null || cost <= 0) {
    return {
      ...diagnosis,
      expenseRecoveryRate: null,
      requiredRevisionRateTo100: null
    };
  }
  const expenseRecoveryRate = revenue / cost * 100;
  return {
    ...diagnosis,
    expenseRecoveryRate,
    requiredRevisionRateTo100: revenue > 0 ? Math.max(cost / revenue - 1, 0) : null
  };
}

function findAnnual(group: BusinessGroup, year: number, preferredAccountingType?: string | null) {
  return group.businesses
    .flatMap((business: any) => business.annualFinancials
      .filter((annual: any) => annual.surveyYear === year)
      .map((annual: any) => ({ business, annual })))
    .sort((a, b) => {
      const aPreferred = preferredAccountingType && a.business.accountingType === preferredAccountingType ? 1 : 0;
      const bPreferred = preferredAccountingType && b.business.accountingType === preferredAccountingType ? 1 : 0;
      if (aPreferred !== bPreferred) return bPreferred - aPreferred;
      return accountingPriority(b.business.accountingType) - accountingPriority(a.business.accountingType);
    })[0]?.annual;
}

function detailHref(municipalityCode: string, business: string, view: DetailView) {
  const query = new URLSearchParams({ business, view });
  return `/municipalities/${municipalityCode}?${query.toString()}`;
}

function parseDetailView(value?: string): DetailView {
  return value === "fee-analysis" || value === "finance" || value === "prefecture" || value === "yearbook"
    ? value
    : "fees";
}

function prefectureComparisonLabel(prefectureName: string) {
  if (prefectureName === "北海道") return "道内市町村";
  if (prefectureName === "東京都") return "都内市区町村";
  if (prefectureName === "大阪府" || prefectureName === "京都府") return "府内市町村";
  return "県内市町村";
}

function prefectureAreaLabel(prefectureName: string) {
  if (prefectureName === "北海道") return "道内";
  if (prefectureName === "東京都") return "都内";
  if (prefectureName === "大阪府" || prefectureName === "京都府") return "府内";
  return "県内";
}

function findCurrentPeerRow(
  rows: PrefecturePeerComparisonRow[],
  municipalityCode: string,
  businessKey: string
) {
  return rows.find((row) => (
    row.isCurrent
    && row.businessKey === businessKey
    && (
      row.detailMunicipalityCode === municipalityCode
      || row.operatorMunicipalityCode === municipalityCode
      || row.representedMunicipalityCodes.includes(municipalityCode)
    )
  )) ?? null;
}

export function bindPeerComparisonToSelectedBusiness({
  model,
  municipalityCode,
  businessKey,
  currentFundingContext
}: {
  model: PrefecturePeerComparisonResult;
  municipalityCode: string;
  businessKey: string;
  currentFundingContext: CurrentFundingContext;
}): PrefecturePeerComparisonResult | null {
  const rows = model.rows.map((row) => {
    const isCurrent = row.businessKey === businessKey && (
      row.detailMunicipalityCode === municipalityCode
      || row.operatorMunicipalityCode === municipalityCode
      || row.representedMunicipalityCodes.includes(municipalityCode)
    );
    return {
      ...row,
      ...(isCurrent ? mergeFundingContext(row, currentFundingContext) : {}),
      isCurrent
    };
  });

  if (!rows.some((row) => row.isCurrent)) return null;
  return {
    ...model,
    currentMunicipalityCode: municipalityCode,
    rows
  };
}

export function jointOperationHref(
  operatorMunicipalityCode: string,
  businessKey: string,
  availableJointOperatorMunicipalityCodes: readonly string[]
) {
  if (!availableJointOperatorMunicipalityCodes.includes(operatorMunicipalityCode)) return null;
  const query = new URLSearchParams({ business: businessKey, view: "fees" });
  return `/municipalities/${operatorMunicipalityCode}?${query.toString()}`;
}

function FeeRecoveryStory({
  annual,
  diagnosis,
  fiscal
}: {
  annual: DetailAnnual;
  diagnosis: DetailAnnual["diagnosisResult"];
  fiscal: string;
}) {
  const currentFee = positiveFiniteOrNull(annual.householdFee20m3Yen);
  const recoveryRate = finiteOrNull(diagnosis?.expenseRecoveryRate);
  const hasShortfall = recoveryRate != null && recoveryRate < 100;
  const revenue = finiteOrNull(annual.sewerFeeRevenue);
  const opex = finiteOrNull(annual.opexComponent);
  const capital = finiteOrNull(annual.capitalCostComponent);
  const treatment = finiteOrNull(annual.wastewaterTreatmentCost);
  const balance = revenue != null && treatment != null ? revenue - treatment : null;
  const requiredIncreaseRate = revenue != null && treatment != null && revenue > 0
    ? Math.max(treatment / revenue - 1, 0) * 100
    : null;
  const componentsReady = opex != null && capital != null && treatment != null;
  const componentsReconciled = componentsReady && Math.abs(opex + capital - treatment) < 0.5;

  return (
    <section className={styles.feeDecision} aria-labelledby="fee-decision-heading">
      <div className={styles.feeDecisionHeading}>
        <div>
          <span>{fiscal} 計算根拠</span>
          <h2 id="fee-decision-heading">料金と費用回収の根拠</h2>
          <p>家庭の月額料金と、事業全体の年間収支です。</p>
        </div>
        <span className={hasShortfall ? styles.feeDecisionWarning : styles.feeDecisionReady}>
          <ShieldCheck size={15} aria-hidden="true" />
          {recoveryRate == null ? "判定不可" : hasShortfall ? "使用料収入が不足" : "汚水処理費を回収"}
        </span>
      </div>

      <div className={styles.feeDecisionFlow}>
        <section className={styles.feeTariffPanel} aria-labelledby="household-tariff-title">
          <div>
            <span>家庭の料金表</span>
            <h3 id="household-tariff-title">一般家庭用20m³／月</h3>
          </div>
          <strong>{currentFee == null ? "未取得" : `${Math.round(currentFee).toLocaleString("ja-JP")}円／月`}</strong>
          <p>税込・地方公営企業年鑑の家庭向け料金表より</p>
        </section>

        <section className={styles.feeRecoveryPanel} aria-labelledby="business-recovery-title">
          <div className={styles.feeRecoveryPanelHeading}>
            <div>
              <span>事業全体の費用回収</span>
              <h3 id="business-recovery-title">経費回収率</h3>
            </div>
            <strong>{recoveryRate == null ? "算定不可" : `${recoveryRate.toFixed(1)}%`}</strong>
          </div>
          <dl className={styles.feeRecoveryLedger}>
            <div>
              <dt>年間下水道使用料収入</dt>
              <dd>{formatThousandYenExact(revenue)}</dd>
            </div>
            <div>
              <dt>汚水処理費（公費負担分等を除く）</dt>
              <dd>{formatThousandYenExact(treatment)}</dd>
            </div>
            <div className={balance != null && balance < 0 ? styles.feeRecoveryShortfall : styles.feeRecoveryBalance}>
              <dt>{balance == null ? "差額" : balance < 0 ? "年間不足額" : "年間余剰額"}</dt>
              <dd>{balance == null ? "算定不可" : formatThousandYenExact(Math.abs(balance))}</dd>
            </div>
          </dl>

          <p className={styles.feeRecoveryInterpretation}>
            {requiredIncreaseRate == null
              ? "使用料収入または汚水処理費が未取得・不適切なため、必要増加率は算定できません。"
              : requiredIncreaseRate > 0
                ? `費用・有収水量を固定した単純試算：事業全体の使用料収入があと${requiredIncreaseRate.toFixed(1)}%あれば、現在の費用を賄えます。`
                : "この年度は、使用料収入で汚水処理費を賄えています。"}
          </p>

          <details className={styles.costBreakdown}>
            <summary>
              汚水処理費の内訳と対象範囲
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            {componentsReconciled ? (
              <dl className={styles.costBreakdownRows}>
                <div><dt>維持管理費分</dt><dd>{formatThousandYenExact(opex)}</dd></div>
                <div><dt>資本費分</dt><dd>{formatThousandYenExact(capital)}</dd></div>
                <div><dt>汚水処理費 合計</dt><dd>{formatThousandYenExact(treatment)}</dd></div>
              </dl>
            ) : (
              <p className={styles.costUnavailable}>内訳が未取得または合計と一致しないため、確認できた合計だけを表示しています。</p>
            )}
            <div className={styles.costBoundaryNote}>
              <strong>経費回収率の対象は、公費負担分等を除いた汚水処理費です。</strong>
              <p>雨水処理などの公費負担分を除き、汚水に係る維持管理費と資本費を総務省基準で整理した額です。営業費用に含まれない企業債利息等が資本費に入る場合もあります。</p>
            </div>
          </details>
        </section>
      </div>
    </section>
  );
}

export function buildCurrentFundingContext(group: BusinessGroup): CurrentFundingContext {
  const income = group.latestBusiness.financialStory?.income;
  const operatingRevenue = finiteOrNull(income?.operatingRevenue);
  const operatingExpense = finiteOrNull(income?.operatingExpense);
  return {
    operatingRevenue,
    operatingExpense,
    operatingLoss: operatingRevenue == null || operatingExpense == null
      ? null
      : Math.max(operatingExpense - operatingRevenue, 0)
  };
}

function buildPurposeCostItems(
  items: Array<{ id?: string; label: string; value?: number | null }> | null | undefined
) {
  const value = (id: string) => finiteOrNull(items?.find((item) => item.id === id)?.value);
  const business = value("business");
  const administration = value("administration");
  return [
    { id: "pipeline", label: "管渠費", value: value("pipeline") },
    { id: "pump-station", label: "ポンプ場費", value: value("pump-station") },
    { id: "treatment-plant", label: "処理場費", value: value("treatment-plant") },
    {
      id: "general-management",
      label: "業務費・総係費（一般管理）",
      value: business == null || administration == null ? null : business + administration
    }
  ];
}

function mergeFundingContext(row: PrefecturePeerComparisonRow, context: CurrentFundingContext) {
  return {
    operatingRevenue: context.operatingRevenue ?? finiteOrNull(row.operatingRevenue),
    operatingExpense: context.operatingExpense ?? finiteOrNull(row.operatingExpense),
    operatingLoss: context.operatingLoss ?? finiteOrNull(row.operatingLoss)
  };
}

function finiteOrNull(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? null : value;
}

function positiveFiniteOrNull(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) || value <= 0 ? null : value;
}

function formatThousandYenExact(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "未取得";
  return `${Math.round(value).toLocaleString("ja-JP")}千円`;
}

function parseStringArray(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
