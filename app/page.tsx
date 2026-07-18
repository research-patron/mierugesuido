import { Bell, CalendarDays, PieChart, Users } from "lucide-react";
import { JapanMapSelector } from "@/components/JapanMapSelector";
import { StatCard } from "@/components/StatCard";
import { getHomepageData, getMapMunicipalities, getPrefectureSummaries } from "@/lib/data";
import { formatPercent, formatSettlementFiscalLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const mapMunicipalities = await getMapMunicipalities();
  const [data, prefectureSummaries] = await Promise.all([
    getHomepageData(mapMunicipalities),
    getPrefectureSummaries(mapMunicipalities)
  ]);
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
            <StatCard icon={Users} label="収録自治体数" value={data.municipalityCount.toLocaleString("ja-JP")} unit="自治体" sub={latestFiscalWesternYear ? `${latestFiscalWesternYear}年度決算を収録` : `${latestFiscal}決算を収録`} tone="teal" />
            <StatCard icon={CalendarDays} label="最新年度" value={latestFiscalWesternYear ? String(latestFiscalWesternYear) : latestFiscalLong} unit={latestFiscalWesternYear ? "年度" : undefined} sub="総務省決算状況調査" tone="blue" />
            <StatCard icon={PieChart} label="経費回収率100%未満の割合" value={formatPercent(data.below100Rate).replace("%", "")} unit={data.below100Rate == null ? undefined : "%"} sub={data.averageExpenseRecoveryRate == null ? "平均値なし" : `表示事業値の単純集計・平均 ${formatPercent(data.averageExpenseRecoveryRate)}`} tone="violet" />
            <StatCard icon={Bell} label="公式改定情報あり" value={data.revisionEventCount.toLocaleString("ja-JP")} unit="自治体" sub="登録済みの公式公表情報" tone="amber" />
          </div>
        </div>
      </section>

      <section id="national-map" className="mx-auto max-w-[1491px] scroll-mt-24 px-7 py-5">
        <JapanMapSelector summaries={prefectureSummaries} municipalities={mapMunicipalities} overview={data} />
      </section>
    </div>
  );
}
