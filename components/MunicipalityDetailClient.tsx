"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Database,
  Droplet,
  ExternalLink,
  FileChartColumnIncreasing,
  Landmark,
  MapPinned,
  Scale,
  ShieldCheck
} from "lucide-react";
import { FinancialStory } from "@/components/municipality-detail/FinancialStory";
import { PrefecturePeerComparison } from "@/components/municipality-detail/PrefecturePeerComparison";
import { YearbookOriginalData } from "@/components/municipality-detail/YearbookOriginalData";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import { accountingTypeLabel, businessCategoryCode, displayBusinessName } from "@/lib/businessDisplay";
import { detailDisclaimer, formulaCopy } from "@/lib/copy";
import { getFieldDefinition } from "@/lib/fieldDefinitions";
import { unitLabels } from "@/lib/fieldLabels";
import {
  formatMoneyThousandYen,
  formatSettlementFiscalLabel,
  formatYenPerM3
} from "@/lib/format";
import { transferBasisAmount, type TransferBasisBreakdown } from "@/lib/prefecturePeerComparison";
import styles from "@/app/municipalities/[municipalityCode]/page.module.css";

type DetailView = "fees" | "finance" | "prefecture" | "yearbook";
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
  rainwaterBurdenRevenue: number | null;
  otherAccountSubsidyRevenue: number | null;
  nonStandardTransfer: number | null;
  transferBasisBreakdown: TransferBasisBreakdown;
};

export function MunicipalityDetailClient({ municipalityCode }: { municipalityCode: string }) {
  const searchParams = useSearchParams();
  const [municipality, setMunicipality] = useState<MunicipalityDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    fetch(`/data/static/municipalities/${municipalityCode}.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Municipality detail unavailable");
        return response.json();
      })
      .then((json) => { if (!cancelled) setMunicipality(json); })
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
  const [prefecturePeerComparison, setPrefecturePeerComparison] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    if (!municipality || !selectedGroup || view !== "prefecture") {
      setPrefecturePeerComparison(null);
      return;
    }
    setPrefecturePeerComparison(null);
    const currentFundingContext = buildCurrentFundingContext(selectedGroup);
    fetch(`/data/static/peers/${municipality.prefectureCode}/${encodeURIComponent(selectedGroup.key)}.json`)
      .then((response) => {
        if (!response.ok) throw new Error("Peer comparison unavailable");
        return response.json();
      })
      .then((model) => {
        if (cancelled) return;
        setPrefecturePeerComparison({
          ...model,
          currentMunicipalityCode: municipality.municipalityCode,
          rows: model.rows.map((row: any) => ({
            ...row,
            ...(row.detailMunicipalityCode === municipality.municipalityCode
              && row.businessKey === selectedGroup.latestBusiness.businessKey
              ? mergeFundingContext(row, currentFundingContext)
              : {}),
            isCurrent: row.detailMunicipalityCode === municipality.municipalityCode
              || row.operatorMunicipalityCode === municipality.municipalityCode
              || row.representedMunicipalityCodes.includes(municipality.municipalityCode)
          }))
        });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [municipality, selectedGroup, view]);

  if (loadFailed) {
    return <div className={styles.page}><div className={styles.container}><p className={styles.emptySupport}>自治体データを読み込めませんでした。</p></div></div>;
  }
  if (!municipality) {
    return <div className={styles.page}><div className={styles.container}><p className={styles.emptySupport}>自治体データを読み込んでいます…</p></div></div>;
  }
  if (!selectedGroup) {
    return <EmptyMunicipality municipality={municipality} />;
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
  const prior = trendPoints.find((point) => point.year === latest.surveyYear - 1);
  const evidenceEntries = latestBusiness.evidenceEntries ?? [];
  const financialStory = latestBusiness.financialStory;
  const financialStatementsReady = latestBusiness.financialStatementsReady;
  const financeTabLabel = latestBusiness.accountingType === "non_legal_applied"
    ? "財務図 対象外"
    : financialStatementsReady ? "R6 財務を読む" : "R6 財務（未取得）";
  const categoryCode = businessCategoryCode(latestBusiness);
  const householdFeeMetric = categoryCode === "17/2"
    ? { value: "対象外" }
    : latest.householdFee20m3Yen === 0
      ? { value: "要確認" }
      : yenPerMonthMetric(latest.householdFee20m3Yen);
  const accounting = accountingMetric(latestBusiness.accountingType, latest);
  const localComparisonLabel = prefectureComparisonLabel(municipality.prefectureName);
  const localComparisonShortLabel = prefectureComparisonShortLabel(municipality.prefectureName);

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
            <div className={styles.businessSelectorHeading}>
              <div>
                <span>{groups.length}種類から選択</span>
                <h2 id="business-selector-title">表示する決算事業</h2>
              </div>
              <p>この下の料金・財務・比較データが、選んだ1件の事業に切り替わります。</p>
            </div>
            <div className={styles.businessOptions}>
              {groups.map((group) => {
                const selected = group.key === selectedGroup.key;
                return (
                  <Link
                    key={group.key}
                    href={detailHref(municipalityCode, group.key, view)}
                    className={styles.businessOption}
                    data-tone={businessTone(group.key)}
                    aria-current={selected ? "page" : undefined}
                  >
                    <span className={styles.businessOptionCopy}>
                      <strong>{displayBusinessName(group.latestBusiness)}</strong>
                      <small>{accountingTypeLabel(group.latestBusiness.accountingType)}・{formatSettlementFiscalLabel({ surveyYear: group.latest.surveyYear, fiscalYearLabel: group.latest.fiscalYearLabel })}</small>
                    </span>
                    <span className={styles.businessOptionState}>
                      {selected ? <><CheckCircle2 size={15} aria-hidden="true" />表示中</> : <>この事業の決算を表示<ArrowRight size={14} aria-hidden="true" /></>}
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className={styles.businessSelectorNote}>表示する決算データを選びます。自治体の事業・処理区域・契約先を変更する操作ではありません。</p>
          </section>
        ) : null}

        {qualityFlags.length > 0 ? (
          <aside className={styles.qualityWarning} role="note" aria-label="データ品質の注記">
            <AlertTriangle size={18} aria-hidden="true" />
            <div><strong>この決算データには要確認項目があります</strong><p>{qualityFlags.join("／")} — 0を欠損と断定せず、原資料とあわせて確認してください。</p></div>
          </aside>
        ) : null}

        <JointOperationLinks municipality={municipality} />

        <section className={styles.kpiGrid} aria-label={`${displayBusinessName(latestBusiness)}・${fiscal}の主要指標`}>
          <DetailKpiCard
            icon={CircleDollarSign}
            label="一般家庭用20m³／月"
            value={householdFeeMetric}
            sub={categoryCode === "17/2"
              ? "特定公共下水道は主に事業活動による汚水を対象とするため、家庭用月額は対象外"
              : latest.householdFee20m3Yen == null
              ? "料金表データ未取得"
              : latest.householdFee20m3Yen === 0
                ? "原表の0は無料・対象外・未取得を判別できないため原資料要確認"
              : `税込・使用料単価 ${formatYenPerM3(diagnosis?.feeUnitPriceYenPerM3)}`}
            tone="blue"
          />
          <DetailKpiCard
            icon={BarChart3}
            label="経費回収率"
            value={percentMetric(diagnosis?.expenseRecoveryRate)}
            sub={deltaLabel(diagnosis?.expenseRecoveryRate, prior?.expenseRecoveryRate, "pt")}
            tone="teal"
          />
          <DetailKpiCard
            icon={Droplet}
            label="汚水処理原価"
            value={yenPerM3Metric(diagnosis?.treatmentCostYenPerM3)}
            sub="公費負担分等を除く・円/m³"
            tone="violet"
          />
          <DetailKpiCard
            icon={Scale}
            label="会計上の収支"
            value={{ value: accounting.state }}
            sub={accounting.detail}
            tone={accounting.tone}
            status
          />
        </section>

        <nav className={styles.viewTabs} aria-label="詳細の表示切り替え">
          <Link
            href={detailHref(municipalityCode, selectedGroup.key, "fees")}
            className={view === "fees" ? styles.activeTab : undefined}
            aria-current={view === "fees" ? "page" : undefined}
            aria-label="料金と経費回収率"
          >
            <ChartNoAxesCombined size={18} aria-hidden="true" />
            <span className={styles.tabLabelDesktop}>料金と経費回収率</span>
            <span className={styles.tabLabelMobile}>料金・回収</span>
          </Link>
          <Link
            href={detailHref(municipalityCode, selectedGroup.key, "finance")}
            className={view === "finance" ? styles.activeTab : undefined}
            aria-current={view === "finance" ? "page" : undefined}
            aria-label={financeTabLabel}
          >
            <FileChartColumnIncreasing size={18} aria-hidden="true" />
            <span className={styles.tabLabelDesktop}>{financeTabLabel}</span>
            <span className={styles.tabLabelMobile}>R6財務</span>
          </Link>
          <Link
            href={detailHref(municipalityCode, selectedGroup.key, "prefecture")}
            className={view === "prefecture" ? styles.activeTab : undefined}
            aria-current={view === "prefecture" ? "page" : undefined}
            aria-label={localComparisonLabel}
          >
            <MapPinned size={18} aria-hidden="true" />
            <span className={styles.tabLabelDesktop}>{localComparisonLabel}</span>
            <span className={styles.tabLabelMobile}>{localComparisonShortLabel}</span>
          </Link>
          <Link
            href={detailHref(municipalityCode, selectedGroup.key, "yearbook")}
            className={view === "yearbook" ? styles.activeTab : undefined}
            aria-current={view === "yearbook" ? "page" : undefined}
            aria-label="年鑑・根拠データ"
          >
            <Database size={18} aria-hidden="true" />
            <span className={styles.tabLabelDesktop}>年鑑・根拠データ</span>
            <span className={styles.tabLabelMobile}>年鑑データ</span>
          </Link>
        </nav>

        {view === "fees" ? (
          <>
            <FeeRecoveryStory annual={latest} diagnosis={diagnosis} fiscal={fiscal} />
            <section className={styles.contentSection} aria-labelledby="trend-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <span>R2—R6</span>
                  <h2 id="trend-heading">5年間の料金指標</h2>
                </div>
                <p>家庭向け料金と経営指標を分けて表示します。空欄は未取得です。</p>
              </div>
              <TrendChart points={trendPoints} />
            </section>
          </>
        ) : view === "finance" ? (
          <section className={styles.financeSection} aria-label="R6財務の読み解き">
            <FinancialStory {...financialStory} />
          </section>
        ) : view === "yearbook" ? (
          <section className={styles.yearbookView} aria-labelledby="yearbook-view-title">
            <div className={styles.yearbookViewHeading}>
              <span>{fiscal}・選択中の決算事業</span>
              <h2 id="yearbook-view-title">年鑑・根拠データ</h2>
              <p>この画面の計算に使用する主要項目と、総務省「地方公営企業年鑑」の公式個表を確認できます。</p>
            </div>
            <section className={`${styles.evidenceSection} ${styles.yearbookEvidenceSection}`} aria-labelledby="indicator-evidence-title">
              <div>
                <strong id="indicator-evidence-title">この画面で使用する主要項目</strong>
                <small>{evidenceEntries.length}項目・計算用e-Statデータの出典</small>
              </div>
              <EvidenceContent entries={evidenceEntries} />
            </section>
            <YearbookOriginalData
              enabled={view === "yearbook"}
              municipalityCode={municipality.municipalityCode}
              businessKey={latestBusiness.businessKey}
              accountingType={latestBusiness.accountingType}
            />
          </section>
        ) : prefecturePeerComparison ? (
          <section className={styles.financeSection} aria-label={`${localComparisonLabel}の比較`}>
            <PrefecturePeerComparison
              model={prefecturePeerComparison}
              businessLabel={displayBusinessName(latestBusiness)}
            />
          </section>
        ) : null}

        <section className={styles.supportGrid} aria-label="補足情報">
          <article className={styles.revisionCard}>
            <div className={styles.supportHeading}>
              <span><Landmark size={18} aria-hidden="true" /></span>
              <div>
                <h2>公式改定情報</h2>
                <p>自治体が公表した改定予定・実績</p>
              </div>
            </div>
            {municipality.revisionEvents.length > 0 ? (
              <div className={styles.revisionList}>
                {municipality.revisionEvents.map((event: any) => (
                  <a key={event.id} href={event.sourceUrl} target="_blank" rel="noreferrer">
                    <span>{event.title ?? event.status}</span>
                    <small>{event.summary ?? "公式公表情報"}</small>
                    <ExternalLink size={15} aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : (
              <p className={styles.emptySupport}>公式改定情報は未登録です。</p>
            )}
          </article>

          <details className={styles.disclosure}>
            <summary>
              <span><Calculator size={18} aria-hidden="true" /></span>
              <div><strong>指標の計算式</strong><small>使用料水準の算定方法</small></div>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <div className={styles.formulaGrid}>
              {formulaCopy.map((item) => (
                <div key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.formula}</span>
                </div>
              ))}
            </div>
          </details>

        </section>

        <details className={styles.disclaimer}>
          <summary><AlertTriangle size={16} aria-hidden="true" />免責と読み方</summary>
          <p>{detailDisclaimer}</p>
        </details>
      </div>
    </div>
  );
}

function JointOperationLinks({ municipality }: { municipality: MunicipalityDetail }) {
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
          <p>{operatorNames.join("・")}が運営します。表示先の数値は組合全体の決算で、市町村別の配分額ではありません。</p>
        </div>
      </div>
      <div className={styles.jointOperationLinks}>
        {memberships.map((membership) => {
          const operatorCode = membership.operatorMunicipality.municipalityCode;
          if (!operatorCode) return null;
          const query = new URLSearchParams({ business: membership.businessKey, view: "fees" });
          return (
            <Link key={`${operatorCode}:${membership.businessKey}`} href={`/municipalities/${operatorCode}?${query.toString()}`}>
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

function EmptyMunicipality({ municipality }: { municipality: MunicipalityDetail }) {
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
        <JointOperationLinks municipality={municipality} />
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
    feeAdequacyLabel: null,
    revisionRiskScore: null,
    revisionRiskLabel: null
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

function businessTone(businessKey: string) {
  if (/^17[-/]1(?:[-/]|$)/.test(businessKey)) return "teal";
  if (/^17[-/](?:2|4)(?:[-/]|$)/.test(businessKey)) return "blue";
  if (/^(?:17[-/](?:5|6|7|8|9)|18[-/](?:0|1))(?:[-/]|$)/.test(businessKey)) return "violet";
  return "slate";
}

function parseDetailView(value?: string): DetailView {
  return value === "finance" || value === "prefecture" || value === "yearbook" ? value : "fees";
}

function prefectureComparisonLabel(prefectureName: string) {
  if (prefectureName === "北海道") return "道内市町村";
  if (prefectureName === "東京都") return "都内市区町村";
  if (prefectureName === "大阪府" || prefectureName === "京都府") return "府内市町村";
  return "県内市町村";
}

function prefectureComparisonShortLabel(prefectureName: string) {
  if (prefectureName === "北海道") return "道内比較";
  if (prefectureName === "東京都") return "都内比較";
  if (prefectureName === "大阪府" || prefectureName === "京都府") return "府内比較";
  return "県内比較";
}

type MetricParts = { value: string; unit?: string };
type KpiTone = "teal" | "blue" | "violet" | "amber" | "red" | "green" | "neutral";

function DetailKpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  status = false
}: {
  icon: LucideIcon;
  label: string;
  value: MetricParts;
  sub: string;
  tone: KpiTone;
  status?: boolean;
}) {
  return (
    <article className={styles.kpiCard} data-tone={tone}>
      <span className={styles.kpiIcon} aria-hidden="true"><Icon size={23} strokeWidth={2.1} /></span>
      <div>
        <span className={styles.kpiLabel}>{label}</span>
        <div className={status ? styles.kpiStatusValue : styles.kpiValue}>
          <strong>{value.value}</strong>
          {value.unit ? <span>{value.unit}</span> : null}
        </div>
        <small>{sub}</small>
      </div>
    </article>
  );
}

function percentMetric(value: number | null | undefined): MetricParts {
  return value == null || !Number.isFinite(value) ? { value: "算定不可" } : { value: value.toFixed(1), unit: "%" };
}

function yenPerM3Metric(value: number | null | undefined): MetricParts {
  return value == null || !Number.isFinite(value) ? { value: "算定不可" } : { value: value.toFixed(1), unit: "円/m³" };
}

function yenPerMonthMetric(value: number | null | undefined): MetricParts {
  return value == null || !Number.isFinite(value)
    ? { value: "未取得" }
    : { value: Math.round(value).toLocaleString("ja-JP"), unit: "円／月" };
}

function deltaLabel(current: number | null | undefined, previous: number | null | undefined, unit: string) {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return "前年比は算定不可";
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return `前年比 ±0.0${unit}`;
  return `前年比 ${delta > 0 ? "+" : ""}${delta.toFixed(1)}${unit}`;
}

function accountingMetric(accountingType: string | null | undefined, annual: DetailAnnual) {
  const nonLegal = accountingType === "non_legal_applied";
  const usesNetIncome = !nonLegal && annual.netIncome != null && Number.isFinite(annual.netIncome);
  const value = nonLegal ? annual.realBalance : usesNetIncome ? annual.netIncome : annual.ordinaryProfitLoss;
  const metricLabel = nonLegal ? "実質収支" : usesNetIncome ? "当年度純損益" : "経常損益";
  if (value == null || !Number.isFinite(value)) return { state: "判定不可", detail: "収支データ未取得", tone: "neutral" as const };
  if (value === 0) {
    return {
      state: "収支均衡",
      detail: `${metricLabel} 差額なし`,
      tone: "neutral" as const
    };
  }
  return {
    state: value > 0 ? "黒字" : "赤字",
    detail: `${metricLabel} ${formatMoneyThousandYen(value)}`,
    tone: value > 0 ? "green" as const : "red" as const
  };
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
          <span>{fiscal} 料金表・決算</span>
          <h2 id="fee-decision-heading">家庭の料金と事業全体の費用回収</h2>
          <p>対象も単位も異なるため、家庭向け料金表と事業全体の決算を分けて表示します。</p>
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
          <p>税込。地方公営企業年鑑「個表」の料金表上の金額です。全利用者の実績平均や事業全体の費用回収額ではありません。</p>
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
                ? `費用・有収水量等を一定とすると、事業全体の使用料収入を${requiredIncreaseRate.toFixed(1)}%増やす必要がある単純計算です。家庭の20m³月額への換算ではありません。`
                : "この年度は、事業全体の使用料収入が経費回収率の対象費用を賄っています。値下げ可能額を示すものではありません。"}
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
              <strong>営業費用と、経費回収率の対象となる汚水処理費は同じ範囲ではありません。</strong>
              <p>雨水処理などの公費負担分を除き、汚水に係る維持管理費と資本費を総務省基準で整理した額です。営業費用に含まれない企業債利息等が資本費に入る場合もあります。</p>
            </div>
          </details>
        </section>
      </div>
    </section>
  );
}

function buildCurrentFundingContext(group: BusinessGroup): CurrentFundingContext {
  const income = group.latestBusiness.financialStory?.income;
  const operatingRevenue = finiteOrNull(income?.operatingRevenue);
  const operatingExpense = finiteOrNull(income?.operatingExpense);
  return {
    operatingRevenue,
    operatingExpense,
    operatingLoss: operatingRevenue == null || operatingExpense == null
      ? null
      : Math.max(operatingExpense - operatingRevenue, 0),
    rainwaterBurdenRevenue: revenueBreakdownValue(income, "rainwater-burden"),
    otherAccountSubsidyRevenue: revenueBreakdownValue(income, "other-account-subsidy"),
    nonStandardTransfer: finiteOrNull(group.latest.nonStandardTransfer),
    transferBasisBreakdown: transferBasisBreakdownFromAnnual(group.latest)
  };
}

function mergeFundingContext(row: any, context: CurrentFundingContext) {
  return {
    operatingRevenue: context.operatingRevenue ?? finiteOrNull(row.operatingRevenue),
    operatingExpense: context.operatingExpense ?? finiteOrNull(row.operatingExpense),
    operatingLoss: context.operatingLoss ?? finiteOrNull(row.operatingLoss),
    rainwaterBurdenRevenue: context.rainwaterBurdenRevenue ?? finiteOrNull(row.rainwaterBurdenRevenue),
    otherAccountSubsidyRevenue: context.otherAccountSubsidyRevenue ?? finiteOrNull(row.otherAccountSubsidyRevenue),
    nonStandardTransfer: context.nonStandardTransfer ?? finiteOrNull(row.nonStandardTransfer),
    transferBasisBreakdown: context.transferBasisBreakdown ?? row.transferBasisBreakdown
  };
}

function transferBasisBreakdownFromAnnual(annual: DetailAnnual): TransferBasisBreakdown {
  const capitalNonStandard = finiteOrNull(annual.table40CapitalOtherAccountSubsidyNonStandard);
  return {
    rainwaterBurden: transferBasisAmount(
      annual.table40RainwaterBurden,
      annual.table40RainwaterBurdenNonStandard
    ),
    otherAccountSubsidy: transferBasisAmount(
      annual.table40OtherAccountSubsidy,
      annual.table40OtherAccountSubsidyNonStandard
    ),
    capitalOtherAccountSubsidy: transferBasisAmount(
      annual.table40CapitalOtherAccountSubsidy,
      capitalNonStandard
    ),
    capitalOtherAccountSubsidyNonStandard: capitalNonStandard,
    nonStandardTransferTotal: finiteOrNull(annual.nonStandardTransfer)
  };
}

function revenueBreakdownValue(income: any, id: string) {
  const item = Array.isArray(income?.revenueBreakdown)
    ? income.revenueBreakdown.find((candidate: any) => candidate?.id === id)
    : null;
  return finiteOrNull(item?.value);
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

function EvidenceContent({ entries }: { entries: Array<[string, any]> }) {
  if (entries.length === 0) return <p className={styles.emptySupport}>表示できる根拠データは未登録です。</p>;
  return (
    <div className={styles.evidenceList}>
      {entries.map(([field, item]) => {
        const definition = getFieldDefinition(field);
        return (
          <article key={field}>
            <div>
              <strong>{definition.label}</strong>
              <small>{definition.meaning}</small>
            </div>
            <div>
              <strong>{formatTraceValue(item?.value)} {unitLabels[item?.unit] ?? item?.unit ?? definition.unit}</strong>
              <small>{sourceTableLabel(item, definition.sourceTable)}</small>
              {item?.sourceUrl ? (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  e-Stat原資料
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              ) : <small>原資料リンク未登録</small>}
            </div>
          </article>
        );
      })}
    </div>
  );
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

function formatTraceValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(number)) return number.toLocaleString("ja-JP");
  return value == null ? "不明" : String(value);
}

function sourceTableLabel(item: any, fallback: string) {
  const tableNo = item?.tableNo ? `${item.tableNo}表` : "";
  const tableName = item?.tableName ?? fallback;
  return [tableNo, tableName].filter(Boolean).join(" ");
}
