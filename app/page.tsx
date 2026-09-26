import Link from "next/link";
import { Bell, CalendarDays, PieChart, Users } from "lucide-react";
import { MunicipalitySearch } from "@/components/MunicipalitySearch";
import { JapanMapSelector } from "@/components/JapanMapSelector";
import { StatCard } from "@/components/StatCard";
import { formatPercent, formatSettlementFiscalLabel } from "@/lib/format";
import { getStaticHomeData } from "@/lib/staticData";

export default async function HomePage() {
  const { overview: data, mapMunicipalities, prefectureSummaries, mapScopes, defaultMapScope, yearbookFeeChangeSummary, prefectures } = await getStaticHomeData();
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
      <section className="mx-auto grid max-w-[1491px] gap-4 px-7 py-6">
        <h1 className="text-2xl font-black text-ink sm:text-3xl">自分のまちの下水道使用料を調べる</h1>
        <p className="text-sm leading-7 text-slate-700">一般家庭用20m³／月の料金を、自治体・事業別に確認できます。決算資料の収録額で、現在の請求額とは異なる場合があります。</p>
        <MunicipalitySearch prefectures={prefectures} />
        <div className="flex flex-wrap gap-4 text-sm font-bold text-teal">
          <Link href="/municipalities?intent=household">家庭用料金を探す →</Link>
          <a href="#national-map">下水道事業の経営状況を比べる ↓</a>
          <Link href="/data-sources">年度・指標・出典の見方</Link>
        </div>
      </section>
      <section className="home-kpi-zone" aria-labelledby="management-heading">
        <div className="mx-auto max-w-[1491px] px-7 py-6">
          <h2 id="management-heading" className="mb-5 text-2xl font-black text-ink sm:text-3xl">自分のまちの下水道経営状況を見る</h2>
          <div className="home-kpi-cards grid gap-5 lg:grid-cols-4">
            <StatCard icon={Users} label="公共下水道の収録自治体数" value={data.municipalityCount.toLocaleString("ja-JP")} unit="自治体" sub={latestFiscalWesternYear ? `${latestFiscalWesternYear}年度決算を収録` : `${latestFiscal}決算を収録`} tone="teal" />
            <StatCard icon={CalendarDays} label="本サイト収録の最新決算年度" value={latestFiscalWesternYear ? String(latestFiscalWesternYear) : latestFiscalLong} unit={latestFiscalWesternYear ? "年度" : undefined} sub="総務省決算状況調査" tone="blue" />
            <StatCard icon={PieChart} label="公共下水道：100%未満の割合" value={formatPercent(data.below100Rate).replace("%", "")} unit={data.below100Rate == null ? undefined : "%"} sub={data.averageExpenseRecoveryRate == null ? "平均値なし" : `自治体値の単純集計・平均 ${formatPercent(data.averageExpenseRecoveryRate)}`} tone="violet" />
            <Link
              href="/revisions"
              className="home-revision-kpi-link"
              aria-label={`施行年月日の変更一覧を見る（R5からR6で現行使用料施行年月日が変わった${yearbookFeeChangeSummary?.changedMunicipalityCount ?? "未確認"}団体）`}
            >
              <StatCard
                icon={Bell}
                label="施行年月日が変わった団体"
                value={(yearbookFeeChangeSummary?.changedMunicipalityCount ?? "未確認").toLocaleString("ja-JP")}
                unit="団体"
                sub={`R5→R6の変更一覧・${(yearbookFeeChangeSummary?.changedBusinessCount ?? "未確認").toLocaleString("ja-JP")}事業 →`}
                tone="amber"
              />
            </Link>
          </div>
        </div>
      </section>

      <section id="national-map" className="mx-auto max-w-[1491px] scroll-mt-24 px-7 py-5">
        <JapanMapSelector summaries={prefectureSummaries} municipalities={mapMunicipalities} overview={data} mapScopes={mapScopes} initialScope={defaultMapScope} />
      </section>
      <section className="mx-auto max-w-[1491px] border-t border-line px-7 py-8">
        <h2 className="text-xl font-black">調査・資料作成に使う方へ</h2>
        <p className="mt-3 text-sm leading-7">条件をそろえたCSV、列定義、出典対応をまとめた資料セットを準備しています。無料の検索・比較は引き続き利用できます。</p>
        <Link className="mt-3 inline-flex min-h-11 items-center font-bold text-teal underline" href="/datasets">販売用データと無料見本を見る →</Link>
      </section>
    </div>
  );
}
