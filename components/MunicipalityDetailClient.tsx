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
import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import { accountingTypeLabel, businessCategoryCode, displayBusinessName } from "@/lib/businessDisplay";
import { detailDisclaimer, formulaCopy } from "@/lib/copy";
import { getFieldDefinition } from "@/lib/fieldDefinitions";
import { unitLabels } from "@/lib/fieldLabels";
import { calculateRequiredHouseholdFee20m3 } from "@/lib/calculations";
import {
  formatMoneyThousandYen,
  formatSettlementFiscalLabel,
  formatYenPerM3
} from "@/lib/format";
import styles from "@/app/municipalities/[municipalityCode]/page.module.css";

type DetailView = "fees" | "finance" | "prefecture";
type MunicipalityDetail = any;
type DetailBusiness = MunicipalityDetail["businesses"][number];
type DetailAnnual = DetailBusiness["annualFinancials"][number];

type BusinessGroup = {
  key: string;
  businesses: DetailBusiness[];
  latestBusiness: DetailBusiness;
  latest: DetailAnnual;
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
  const diagnosis = sanitizeAmbiguousDiagnosis(latest.diagnosisResult, qualityFlags);
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
                    <span className={styles.businessOptionMark} aria-hidden="true" />
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
          >
            <ChartNoAxesCombined size={18} aria-hidden="true" />
            料金と経費回収率
          </Link>
          <Link
            href={detailHref(municipalityCode, selectedGroup.key, "finance")}
            className={view === "finance" ? styles.activeTab : undefined}
            aria-current={view === "finance" ? "page" : undefined}
          >
            <FileChartColumnIncreasing size={18} aria-hidden="true" />
            {financeTabLabel}
          </Link>
          <Link
            href={detailHref(municipalityCode, selectedGroup.key, "prefecture")}
            className={view === "prefecture" ? styles.activeTab : undefined}
            aria-current={view === "prefecture" ? "page" : undefined}
          >
            <MapPinned size={18} aria-hidden="true" />
            {localComparisonLabel}
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
              <span><Database size={18} aria-hidden="true" /></span>
              <div><strong>データ根拠</strong><small>{evidenceEntries.length}項目の原表トレース</small></div>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <EvidenceContent entries={evidenceEntries} />
          </details>

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
    const diagnosis = sanitizeAmbiguousDiagnosis(
      annual?.diagnosisResult ?? null,
      parseStringArray(annual?.flagsJson)
    );
    return {
      year,
      fiscalYearLabel: annual?.fiscalYearLabel ?? `R${year - 2018}`,
      accountingType: annual?.accountingType ?? null,
      expenseRecoveryRate: diagnosis?.expenseRecoveryRate ?? null,
      householdFee20m3Yen: positiveFiniteOrNull(annual?.householdFee20m3Yen),
      feeUnitPriceYenPerM3: diagnosis?.feeUnitPriceYenPerM3 ?? null,
      treatmentCostYenPerM3: diagnosis?.treatmentCostYenPerM3 ?? null,
      annualBillableVolume: annual?.annualBillableVolume ?? null,
      generalAccountTransfer: annual?.generalAccountTransfer ?? null
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
  return value === "finance" || value === "prefecture" ? value : "fees";
}

function prefectureComparisonLabel(prefectureName: string) {
  if (prefectureName === "北海道") return "道内市町村";
  if (prefectureName === "東京都") return "都内市区町村";
  if (prefectureName === "大阪府" || prefectureName === "京都府") return "府内市町村";
  return "県内市町村";
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
  const referenceFee = calculateRequiredHouseholdFee20m3(currentFee, recoveryRate);
  const hasShortfall = recoveryRate != null && recoveryRate < 100;
  const canEstimateReference = currentFee != null && recoveryRate != null && recoveryRate > 0;
  const needsIncrease = canEstimateReference && recoveryRate < 100;
  const difference = currentFee != null && referenceFee != null ? referenceFee - currentFee : null;
  const opex = finiteOrNull(annual.opexComponent);
  const capital = finiteOrNull(annual.capitalCostComponent);
  const treatment = finiteOrNull(annual.wastewaterTreatmentCost);
  const componentsReady = opex != null && capital != null && treatment != null;
  const componentsReconciled = componentsReady && Math.abs(opex + capital - treatment) < 0.5;

  return (
    <section className={styles.feeDecision} aria-labelledby="fee-decision-heading">
      <div className={styles.feeDecisionHeading}>
        <div>
          <span>{fiscal} 料金表 × 決算</span>
          <h2 id="fee-decision-heading">一般家庭用20m³月額と経費回収率</h2>
          <p>料金表上の月額と、決算から算定する経費回収率を分けて確認します。</p>
        </div>
        <span className={hasShortfall ? styles.feeDecisionWarning : styles.feeDecisionReady}>
          <ShieldCheck size={15} aria-hidden="true" />
          {recoveryRate == null ? "判定不可" : hasShortfall ? "経費回収率100%未満" : "経費回収率100%以上"}
        </span>
      </div>

      <div className={styles.feeEquation} aria-label="現在の一般家庭用20立方メートル月額と経費回収率100パーセント相当の参考額">
        <FeeEquationCard
          label={`${fiscal}の料金表`}
          title="一般家庭用20m³／月"
          value={currentFee == null ? "未取得" : `${Math.round(currentFee).toLocaleString("ja-JP")}円`}
          note="税込。総務省33表の料金表上の金額"
        />
        <ArrowRight className={styles.feeEquationArrow} size={22} aria-hidden="true" />
        <FeeEquationCard
          label="R6決算からの参考額"
          title="経費回収率100%相当の月額"
          value={!canEstimateReference
            ? "算定不可"
            : needsIncrease && referenceFee != null
              ? `約${referenceFee.toLocaleString("ja-JP")}円`
              : "追加試算なし"}
          note={needsIncrease && difference != null
            ? `現在より月額＋${Math.max(0, difference).toLocaleString("ja-JP")}円の単純試算`
            : !canEstimateReference
              ? "経費回収率が0%以下、または一般家庭用20m³月額が未取得"
              : "経費回収率が100%以上のため、引下げ額は試算しません"}
          emphasized
        />
        <ArrowRight className={styles.feeEquationArrow} size={22} aria-hidden="true" />
        <FeeEquationCard
          label="差"
          title="100%相当額との差"
          value={!canEstimateReference
            ? "算定不可"
            : needsIncrease && difference != null
              ? `＋${Math.max(0, difference).toLocaleString("ja-JP")}円／月`
              : "追加試算なし"}
          note="料金体系を同じ割合で変える単純試算"
          verdict
        />
      </div>

      <div className={styles.costBoundary}>
        <div className={styles.costBoundaryHeading}>
          <div>
            <span>経費回収率の対象費用</span>
            <h3>汚水処理費（公費負担分等を除く）</h3>
          </div>
          <strong>{treatment == null ? "未取得" : formatMoneyThousandYen(treatment)}</strong>
        </div>
        {componentsReconciled ? (
          <div className={styles.costFormula} aria-label={`維持管理費分${formatMoneyThousandYen(opex)}プラス資本費分${formatMoneyThousandYen(capital)}イコール汚水処理費${formatMoneyThousandYen(treatment)}`}>
            <CostTerm label="維持管理費分" value={formatMoneyThousandYen(opex)} />
            <span aria-hidden="true">＋</span>
            <CostTerm label="資本費分" value={formatMoneyThousandYen(capital)} />
            <span aria-hidden="true">＝</span>
            <CostTerm label="汚水処理費" value={formatMoneyThousandYen(treatment)} result />
          </div>
        ) : (
          <p className={styles.costUnavailable}>内訳が未取得または合計と一致しないため、確認できた合計だけを表示しています。</p>
        )}
        <div className={styles.costBoundaryNote}>
          <strong>営業費用と、経費回収率の対象となる汚水処理費は同じ範囲ではありません。</strong>
          <p>雨水処理などの公費負担分を除き、汚水に係る維持管理費と資本費を総務省基準で整理した額です。営業費用には含まれない企業債利息等が資本費に入る場合もあります。</p>
        </div>
      </div>

      <details className={styles.feeAssumptions}>
        <summary>100%相当額の前提と、2つの「単価」の違い</summary>
        <div>
          <p><strong>一般家庭用20m³月額</strong>は料金表上の税込月額、<strong>使用料単価</strong>は全利用者の年間使用料収入÷年間有収水量による実績平均です。</p>
          <p>参考額は、費用・有収水量・税率が変わらず、基本料金と従量料金を同じ割合で改定すると仮定した単純試算です。自治体が決定した改定額ではなく、将来更新費や人口減少も織り込んでいません。</p>
        </div>
      </details>
    </section>
  );
}

function FeeEquationCard({
  label,
  title,
  value,
  note,
  emphasized = false,
  verdict = false
}: {
  label: string;
  title: string;
  value: string;
  note: string;
  emphasized?: boolean;
  verdict?: boolean;
}) {
  return (
    <article className={`${styles.feeEquationCard} ${emphasized ? styles.feeEquationCardEmphasis : ""} ${verdict ? styles.feeEquationCardVerdict : ""}`}>
      <span>{label}</span>
      <h3>{title}</h3>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function CostTerm({ label, value, result = false }: { label: string; value: string; result?: boolean }) {
  return <div className={result ? styles.costTermResult : undefined}><span>{label}</span><strong>{value}</strong></div>;
}

function finiteOrNull(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? null : value;
}

function positiveFiniteOrNull(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) || value <= 0 ? null : value;
}

function EvidenceContent({ entries }: { entries: Array<[string, any]> }) {
  if (entries.length === 0) return <p className={styles.emptySupport}>表示できる根拠データは未登録です。</p>;
  return (
    <div className={styles.evidenceScroll}>
      <table>
        <thead><tr><th>項目</th><th>値</th><th>出典表</th><th>原資料</th></tr></thead>
        <tbody>
          {entries.map(([field, item]) => {
            const definition = getFieldDefinition(field);
            return (
              <tr key={field}>
                <td><strong>{definition.label}</strong><small>{definition.meaning}</small></td>
                <td>{formatTraceValue(item?.value)} {unitLabels[item?.unit] ?? item?.unit ?? definition.unit}</td>
                <td>{sourceTableLabel(item, definition.sourceTable)}</td>
                <td>{item?.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">原資料 <ExternalLink size={12} /></a> : "未登録"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
