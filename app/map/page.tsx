import Link from "next/link";
import { Bell, CalendarDays, CircleHelp, PieChart, Users } from "lucide-react";
import { JapanMapSelector } from "@/components/JapanMapSelector";
import { StatCard } from "@/components/StatCard";
import { formatPercent, formatSettlementFiscalLabel } from "@/lib/format";
import { getStaticHomeData } from "@/lib/staticData";

export default async function MapPage() {
  const { overview, mapMunicipalities: municipalities, prefectureSummaries: summaries, mapScopes, defaultMapScope, yearbookFeeChangeSummary } = await getStaticHomeData();
  const latestFiscalLong = formatSettlementFiscalLabel({
    surveyYear: overview.latestYear,
    fiscalYearLabel: overview.latestFiscalYearLabel,
    style: "long"
  });
  const reiwaMatch = latestFiscalLong.match(/令和(\d+)年度/);
  const latestFiscalWesternYear = reiwaMatch ? Number(reiwaMatch[1]) + 2018 : null;

  return (
    <div className="map-page">
      <section className="water-band map-page-hero border-b border-line">
        <div className="map-page-hero-inner mx-auto grid max-w-[1491px] gap-3 px-4 py-3 sm:px-6 lg:px-7">
          <div className="map-page-heading flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black text-teal">ホーム ＞ 全国マップ</div>
              <h1 className="mt-1 text-2xl font-black leading-tight text-ink sm:text-3xl">全国下水道経費回収率マップ</h1>
              <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-700">
                公共下水道と特定環境保全公共下水道を切り替え、選択した区分の自治体値を都道府県ごとに単純平均して比較します。使用料単価は地域性があるため、全国地図の色分けには使用しません。
              </p>
            </div>
            <Link href="/data-sources" className="button-secondary">
              <CircleHelp size={16} />
              データの見方
            </Link>
          </div>
          <div className="map-page-kpi-grid grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard icon={Users} label="公共下水道の収録自治体数" value={overview.municipalityCount.toLocaleString("ja-JP")} unit="自治体" sub={latestFiscalWesternYear ? `${latestFiscalWesternYear}年度決算を収録` : `${latestFiscalLong}決算を収録`} tone="teal" />
            <StatCard icon={CalendarDays} label="最新年度" value={latestFiscalWesternYear ? String(latestFiscalWesternYear) : latestFiscalLong} unit={latestFiscalWesternYear ? "年度" : undefined} sub="総務省決算状況調査" tone="blue" />
            <StatCard icon={PieChart} label="公共下水道：100%未満の割合" value={formatPercent(overview.below100Rate).replace("%", "")} unit={overview.below100Rate == null ? undefined : "%"} sub={overview.averageExpenseRecoveryRate == null ? "平均値なし" : `自治体値の単純平均 ${formatPercent(overview.averageExpenseRecoveryRate)}`} tone="violet" />
            <StatCard icon={Bell} label="R6 当年度改定の記載" value={(yearbookFeeChangeSummary?.counts?.supported?.municipalityCount ?? 0).toLocaleString("ja-JP")} unit="団体" sub="第33表の施行日と関連項目を照合" tone="amber" />
          </div>
        </div>
      </section>
      <section className="map-page-atlas-section mx-auto max-w-[1491px] px-4 py-3 sm:px-6 lg:px-7">
        <JapanMapSelector summaries={summaries} municipalities={municipalities} overview={overview} variant="atlas" mapScopes={mapScopes} initialScope={defaultMapScope} />
      </section>
    </div>
  );
}
