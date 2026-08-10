import Link from "next/link";
import { Bell, CalendarDays, PieChart, Users } from "lucide-react";
import { JapanMapSelector } from "@/components/JapanMapSelector";
import { StatCard } from "@/components/StatCard";
import { formatPercent, formatSettlementFiscalLabel } from "@/lib/format";
import { getStaticHomeData } from "@/lib/staticData";

export default async function HomePage() {
  const { overview: data, mapMunicipalities, prefectureSummaries, mapScopes, defaultMapScope, yearbookFeeChangeSummary } = await getStaticHomeData();
  const latestFiscal = formatSettlementFiscalLabel({
    surveyYear: data.latestYear,
    fiscalYearLabel: data.latestFiscalYearLabel
  });
  const latestFiscalLong = formatSettlementFiscalLabel({
    surveyYear: data.latestYear,
    fiscalYearLabel: data.latestFiscalYearLabel,
    style: "long"
  });
  const latestFiscalWesternYear = latestFiscalLong.match(/令和(\d+)年度/)?.[1]
    ? Number(latestFiscalLong.match(/令和(\d+)年度/)?.[1]) + 2018
    : null;

  return (
    <div className="home-dashboard">
      <section className="home-kpi-zone">
        <div className="mx-auto max-w-[1491px] px-7 py-6">
          <div className="home-kpi-cards grid gap-5 lg:grid-cols-4">
            <StatCard icon={Users} label="公共下水道の収録自治体数" value={data.municipalityCount.toLocaleString("ja-JP")} unit="自治体" sub={latestFiscalWesternYear ? `${latestFiscalWesternYear}年度決算を収録` : `${latestFiscal}決算を収録`} tone="teal" />
            <StatCard icon={CalendarDays} label="最新年度" value={latestFiscalWesternYear ? String(latestFiscalWesternYear) : latestFiscalLong} unit={latestFiscalWesternYear ? "年度" : undefined} sub="総務省決算状況調査" tone="blue" />
            <StatCard icon={PieChart} label="公共下水道：100%未満の割合" value={formatPercent(data.below100Rate).replace("%", "")} unit={data.below100Rate == null ? undefined : "%"} sub={data.averageExpenseRecoveryRate == null ? "平均値なし" : `自治体値の単純集計・平均 ${formatPercent(data.averageExpenseRecoveryRate)}`} tone="violet" />
            <Link
              href="/revisions"
              className="home-revision-kpi-link"
              aria-label={`施行年月日の変更一覧を見る（R5からR6で現行使用料施行年月日が変わった${yearbookFeeChangeSummary?.changedMunicipalityCount ?? 0}団体）`}
            >
              <StatCard
                icon={Bell}
                label="施行年月日が変わった団体"
                value={(yearbookFeeChangeSummary?.changedMunicipalityCount ?? 0).toLocaleString("ja-JP")}
                unit="団体"
                sub={`R5→R6の変更一覧・${(yearbookFeeChangeSummary?.changedBusinessCount ?? 0).toLocaleString("ja-JP")}事業 →`}
                tone="amber"
              />
            </Link>
          </div>
        </div>
      </section>

      <section id="national-map" className="mx-auto max-w-[1491px] scroll-mt-24 px-7 py-5">
        <JapanMapSelector summaries={prefectureSummaries} municipalities={mapMunicipalities} overview={data} mapScopes={mapScopes} initialScope={defaultMapScope} />
      </section>
    </div>
  );
}
