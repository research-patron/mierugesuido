"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Filter,
  LayoutGrid,
  Table2,
  Users
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { MunicipalityTable } from "@/components/MunicipalityTable";
import { MunicipalitySearchFilterPanel } from "@/components/MunicipalitySearchFilters";
import { StatCard } from "@/components/StatCard";
import { accountingTypeLabel, displayBusinessName, matchesBusinessCategory } from "@/lib/businessDisplay";
import { formatPercent, formatRevisionRate, formatYenPerM3 } from "@/lib/format";
import { municipalityDetailHref } from "@/lib/municipalityLinks";

type ViewMode = "table" | "card";

type StaticMunicipalityDataset = {
  items: any[];
  overview: any;
  prefectures: string[];
};

const emptyOverview = {
  averageExpenseRecoveryRate: null,
  averageFeeUnitPriceYenPerM3: null,
  revisionEventCount: 0
};

export default function MunicipalitiesPage() {
  return <Suspense fallback={<div className="mx-auto max-w-[1491px] px-9 py-12 text-sm font-bold text-muted">検索データを読み込んでいます…</div>}><MunicipalitiesContent /></Suspense>;
}

function MunicipalitiesContent() {
  const searchParams = useSearchParams();
  const [dataset, setDataset] = useState<StaticMunicipalityDataset>({ items: [], overview: emptyOverview, prefectures: [] });
  useEffect(() => {
    let cancelled = false;
    fetch("/data/static/municipalities.json")
      .then((response) => {
        if (!response.ok) throw new Error("Municipality data unavailable");
        return response.json();
      })
      .then((json) => { if (!cancelled) setDataset(json); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const q = searchParams.get("q") ?? "";
  const prefecture = searchParams.get("prefecture") ?? "";
  const label = searchParams.get("label") ?? "";
  const sort = searchParams.get("sort") || "latest";
  const view: ViewMode = searchParams.get("view") === "card" ? "card" : "table";
  const accountingType = searchParams.get("accountingType") ?? "";
  const businessType = searchParams.get("businessType") ?? "";
  const hasRevisionEventParam = searchParams.get("hasRevisionEvent") ?? "";
  const requestedPage = Number(searchParams.get("page") || 1);
  const requestedLimit = Number(searchParams.get("limit") || 10);
  const hasRevisionEvent = parseBoolean(hasRevisionEventParam);
  const limit = [10, 20, 50].includes(requestedLimit) ? requestedLimit : 10;
  const filteredItems = useMemo(() => filterMunicipalities(dataset.items, {
    q,
    prefecture,
    label,
    sort,
    accountingType,
    businessType,
    hasRevisionEvent
  }), [accountingType, businessType, dataset.items, hasRevisionEvent, label, prefecture, q, sort]);
  const totalPagesForRequest = Math.max(Math.ceil(filteredItems.length / limit), 1);
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), totalPagesForRequest);
  const data = {
    items: filteredItems.slice((page - 1) * limit, page * limit),
    total: filteredItems.length,
    page,
    limit
  };
  const prefectures = dataset.prefectures;
  const overview = dataset.overview;
  const totalPages = Math.max(Math.ceil(data.total / data.limit), 1);
  const visibleFrom = data.total === 0 ? 0 : (data.page - 1) * data.limit + 1;
  const visibleTo = data.total === 0 ? 0 : (data.page - 1) * data.limit + data.items.length;

  return (
    <div className="municipality-search-page">
      <section className="mx-auto grid max-w-[1491px] gap-5 px-9 py-7">
        <div className="search-page-heading">
          <h1>自治体検索</h1>
          <p>条件を指定して、自治体の下水道使用料や経営指標を検索できます。複数事業がある場合は詳細画面で表示事業を切り替えられます。</p>
        </div>

        <MunicipalitySearchFilterPanel
          prefectures={prefectures}
          q={q}
          prefecture={prefecture}
          businessType={businessType}
          accountingType={accountingType}
          label={label}
          hasRevisionEvent={hasRevisionEventParam}
          sort={sort}
          limit={limit}
          view={view}
        />

        <div className="search-summary-panel">
          <div className="search-kpi-rail grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="検索結果" value={data.total.toLocaleString("ja-JP")} unit="自治体" sub="流域下水道を除く比較対象" tone="teal" />
            <StatCard icon={Filter} label="サイト内平均：経費回収率" value={formatPercent(overview.averageExpenseRecoveryRate).replace("%", "")} unit={overview.averageExpenseRecoveryRate == null ? undefined : "%"} sub="表示事業値の単純平均・公式全国平均ではない" tone="violet" />
            <StatCard icon={CircleDollarSign} label="サイト内平均：使用料単価" value={formatYenPerM3(overview.averageFeeUnitPriceYenPerM3).replace("円/m³", "")} unit={overview.averageFeeUnitPriceYenPerM3 == null ? undefined : "円/m³"} sub="法非適用を含む参考値・検索条件に非連動" tone="blue" />
            <StatCard icon={Bell} label="公式改定情報の登録" value={overview.revisionEventCount.toLocaleString("ja-JP")} unit="自治体" sub="公式公表情報・検索条件に非連動" tone="amber" />
          </div>
          <p className="mt-3 text-xs font-bold leading-6 text-slate-600">
            一覧は自治体ごと1件です。複数事業がある場合、最新年度のうち診断上の注意度が最も高い事業を表示します。自治体全体の合算値ではありません。
          </p>
          <div className="view-toggle" aria-label="表示形式">
            <Link
              href={municipalityHref({ q, prefecture, label, accountingType, businessType, hasRevisionEvent: hasRevisionEventParam, sort, limit: data.limit, view: "table", page: 1 })}
              className={view === "table" ? "is-active" : undefined}
              aria-current={view === "table" ? "true" : undefined}
            >
              <Table2 size={18} />
              テーブル
            </Link>
            <Link
              href={municipalityHref({ q, prefecture, label, accountingType, businessType, hasRevisionEvent: hasRevisionEventParam, sort, limit: data.limit, view: "card", page: 1 })}
              className={view === "card" ? "is-active" : undefined}
              aria-current={view === "card" ? "true" : undefined}
            >
              <LayoutGrid size={17} />
              カード
            </Link>
          </div>
        </div>
      </section>

      <section className="search-results-section mx-auto grid max-w-[1491px] gap-4 px-9 pb-6">
        {view === "card" ? <MunicipalityCardGrid items={data.items} /> : <MunicipalityTable items={data.items} />}
        <PaginationControls
          page={data.page}
          totalPages={totalPages}
          visibleFrom={visibleFrom}
          visibleTo={visibleTo}
          total={data.total}
          filters={{ q, prefecture, label, accountingType, businessType, hasRevisionEvent: hasRevisionEventParam, sort, limit: data.limit, view }}
        />
      </section>
    </div>
  );
}

type MunicipalityFilters = {
  q?: string;
  prefecture?: string;
  label?: string;
  accountingType?: string;
  businessType?: string;
  hasRevisionEvent?: string;
  sort?: string;
  limit?: number;
  view?: ViewMode;
};

function MunicipalityCardGrid({ items }: { items: any[] }) {
  if (items.length === 0) {
    return <div className="panel p-6 text-sm font-bold text-muted">条件に一致する自治体がありません。</div>;
  }

  return (
    <div className="municipality-card-grid">
      {items.map((item) => (
        <Link key={`${item.municipalityCode}-search-card`} href={municipalityDetailHref(item.municipalityCode, item.businessKey)} className="municipality-result-card">
          <div className="municipality-result-card-head">
            <div>
              <div className="municipality-result-prefecture">{item.prefectureName}</div>
              <h2>{item.municipalityName}</h2>
            </div>
            <ChevronRight size={20} />
          </div>
          <div className="municipality-result-business">
            {item.businessType ? displayBusinessName(item) : "未取込"}
            <span>{accountingTypeLabel(item.accountingType)}{item.accountingType === "non_legal_applied" ? "・料金指標は参考" : ""}{item.businessCount > 1 ? "・複数事業あり" : ""}{item.flags?.length ? `・データ要確認（${item.flags.length}）` : ""}</span>
          </div>
          <div className="municipality-result-metrics">
            <CardMetric label="経費回収率" value={formatPercent(item.diagnosis?.expenseRecoveryRate)} />
            <CardMetric label="使用料単価" value={formatYenPerM3(item.diagnosis?.feeUnitPriceYenPerM3)} />
            <CardMetric label="汚水処理原価" value={formatYenPerM3(item.diagnosis?.treatmentCostYenPerM3)} />
            <CardMetric label="100%相当の増収率" value={formatRevisionRate(item.diagnosis?.requiredRevisionRateTo100)} />
          </div>
          <div className="municipality-result-badges">
            <span><span className="sr-only">診断: </span><Badge>{item.diagnosis?.feeAdequacyLabel ?? "判定不可"}</Badge></span>
            <span><span className="sr-only">公式改定情報: </span><Badge>{item.hasRevisionEvent ? "登録あり" : "未登録"}</Badge></span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  visibleFrom,
  visibleTo,
  total,
  filters
}: {
  page: number;
  totalPages: number;
  visibleFrom: number;
  visibleTo: number;
  total: number;
  filters: MunicipalityFilters;
}) {
  const pages = pageWindow(page, totalPages);
  const prevPage = Math.max(page - 1, 1);
  const nextPage = Math.min(page + 1, totalPages);

  return (
    <nav className="pagination-bar" aria-label="検索結果ページ">
      <span>{total.toLocaleString("ja-JP")}件中 {visibleFrom.toLocaleString("ja-JP")}〜{visibleTo.toLocaleString("ja-JP")}件を表示</span>
      <div className="pagination-list">
        <PaginationArrow href={municipalityHref({ ...filters, page: 1 })} disabled={page <= 1} label="最初のページ">
          <ChevronsLeft size={17} />
        </PaginationArrow>
        <PaginationArrow href={municipalityHref({ ...filters, page: prevPage })} disabled={page <= 1} label="前のページ">
          <ChevronLeft size={17} />
        </PaginationArrow>
        {pages.map((item, index) => (
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
          ) : (
            <Link
              key={item}
              href={municipalityHref({ ...filters, page: item })}
              className={item === page ? "pagination-link pagination-link--active" : "pagination-link"}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </Link>
          )
        ))}
        <PaginationArrow href={municipalityHref({ ...filters, page: nextPage })} disabled={page >= totalPages} label="次のページ">
          <ChevronRight size={17} />
        </PaginationArrow>
        <PaginationArrow href={municipalityHref({ ...filters, page: totalPages })} disabled={page >= totalPages} label="最後のページ">
          <ChevronsRight size={17} />
        </PaginationArrow>
      </div>
      <div className="page-size-control">
        <span>表示件数</span>
        <details className="page-size-menu">
          <summary>
            {(filters.limit ?? 10).toLocaleString("ja-JP")}件
            <ChevronDown size={15} />
          </summary>
          <div>
            {[10, 20, 50].map((size) => (
              <Link key={size} href={municipalityHref({ ...filters, limit: size, page: 1 })}>
                {size.toLocaleString("ja-JP")}件
              </Link>
            ))}
          </div>
        </details>
      </div>
    </nav>
  );
}

function PaginationArrow({
  href,
  disabled,
  label,
  children
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="pagination-link pagination-link--disabled" aria-disabled="true" aria-label={label}>{children}</span>;
  }
  return <Link href={href} className="pagination-link" aria-label={label}>{children}</Link>;
}

function municipalityHref({
  q,
  prefecture,
  label,
  accountingType,
  businessType,
  hasRevisionEvent,
  limit,
  sort,
  view,
  page
}: MunicipalityFilters & { page?: number }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (prefecture) params.set("prefecture", prefecture);
  if (label) params.set("label", label);
  if (accountingType) params.set("accountingType", accountingType);
  if (businessType) params.set("businessType", businessType);
  if (hasRevisionEvent) params.set("hasRevisionEvent", hasRevisionEvent);
  if (sort && sort !== "latest") params.set("sort", sort);
  if (limit && limit !== 10) params.set("limit", String(limit));
  if (view && view !== "table") params.set("view", view);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/municipalities${query ? `?${query}` : ""}`;
}

function pageWindow(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  if (page >= totalPages - 3) return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "ellipsis", page - 2, page - 1, page, page + 1, page + 2, "ellipsis", totalPages];
}

function parseBoolean(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function filterMunicipalities(items: any[], filters: {
  q: string;
  prefecture: string;
  label: string;
  sort: string;
  accountingType: string;
  businessType: string;
  hasRevisionEvent?: boolean;
}) {
  const needle = normalizeSearchText(filters.q);
  return items
    .filter((item) => !needle || [
      item.municipalityName,
      item.municipalityNameKana,
      item.prefectureName,
      item.municipalityCode
    ].some((value) => normalizeSearchText(value ?? "").includes(needle)))
    .filter((item) => !filters.prefecture || item.prefectureName === filters.prefecture)
    .filter((item) => !filters.label || item.diagnosis?.feeAdequacyLabel === filters.label)
    .filter((item) => !filters.accountingType || item.accountingType === filters.accountingType)
    .filter((item) => matchesBusinessCategory(item, filters.businessType))
    .filter((item) => filters.hasRevisionEvent == null || item.hasRevisionEvent === filters.hasRevisionEvent)
    .sort((a, b) => sortMunicipalityRows(a, b, filters.sort));
}

function sortMunicipalityRows(a: any, b: any, sort: string) {
  if (sort === "expense-recovery-high") return nullsLast(a.diagnosis?.expenseRecoveryRate, b.diagnosis?.expenseRecoveryRate, "desc");
  if (sort === "expense-recovery-low") return nullsLast(a.diagnosis?.expenseRecoveryRate, b.diagnosis?.expenseRecoveryRate, "asc");
  if (sort === "required-revision-high") return nullsLast(a.diagnosis?.requiredRevisionRateTo100, b.diagnosis?.requiredRevisionRateTo100, "desc");
  if (sort === "fee-unit-low") return nullsLast(a.diagnosis?.feeUnitPriceYenPerM3, b.diagnosis?.feeUnitPriceYenPerM3, "asc");
  if (sort === "municipality-code") return (a.municipalityCode ?? "").localeCompare(b.municipalityCode ?? "", "ja");
  return (b.latestYear ?? 0) - (a.latestYear ?? 0)
    || (a.municipalityCode ?? "").localeCompare(b.municipalityCode ?? "", "ja");
}

function nullsLast(a: number | null | undefined, b: number | null | undefined, direction: "asc" | "desc") {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("ja");
}
