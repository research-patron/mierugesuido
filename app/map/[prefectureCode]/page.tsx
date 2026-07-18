import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, Gauge, PieChart, Users } from "lucide-react";
import { PrefectureMapExplorer } from "@/components/PrefectureMapExplorer";
import { StatCard } from "@/components/StatCard";
import { getPrefectureMapData } from "@/lib/data";
import { formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PrefectureMapPage({
  params
}: {
  params: Promise<{ prefectureCode: string }>;
}) {
  const { prefectureCode } = await params;
  const data = await getPrefectureMapData(prefectureCode);
  if (!data.prefecture) notFound();

  const targetMunicipalities = data.municipalities;
  const targetCount = targetMunicipalities.length;
  const recoveryRates = targetMunicipalities
    .map((item) => item.expenseRecoveryRate)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const averageExpenseRecoveryRate = recoveryRates.length > 0
    ? recoveryRates.reduce((sum, value) => sum + value, 0) / recoveryRates.length
    : null;
  const below100Count = recoveryRates.filter((value) => value < 100).length;
  const below100Rate = recoveryRates.length > 0 ? (below100Count / recoveryRates.length) * 100 : null;
  const revisionCount = targetMunicipalities.filter((item) => item.hasRevisionEvent).length;

  return (
    <div className="map-page">
      <section className="water-band map-page-hero border-b border-line">
        <div className="map-page-hero-inner mx-auto grid max-w-[1491px] gap-3 px-4 py-3 sm:px-6 lg:px-7">
          <div className="map-page-heading flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black text-teal">
                <Link href="/">ホーム</Link> ＞ <Link href="/map">全国マップ</Link> ＞ {data.prefecture.name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black leading-tight text-ink sm:text-3xl">
                  {data.prefecture.name}の下水道経費回収率マップ
                </h1>
                <span className="rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-black text-teal">流域下水道を除く</span>
              </div>
            </div>
            <Link href="/map" className="button-secondary">
              都道府県を変更
            </Link>
          </div>
          <div className="map-page-kpi-grid grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard icon={Users} label="対象市区町村数" value={targetCount.toLocaleString("ja-JP")} unit="市区町村" sub="表示対象の市区町村" tone="teal" />
            <StatCard icon={Gauge} label="平均経費回収率" value={formatPercent(averageExpenseRecoveryRate).replace("%", "")} unit={averageExpenseRecoveryRate == null ? undefined : "%"} sub={recoveryRates.length > 0 ? `${recoveryRates.length.toLocaleString("ja-JP")}市区町村の有効値` : "データ未取込"} tone="violet" />
            <StatCard icon={PieChart} label="経費回収率100%未満の割合" value={formatPercent(below100Rate).replace("%", "")} unit={below100Rate == null ? undefined : "%"} sub={recoveryRates.length > 0 ? `${below100Count.toLocaleString("ja-JP")} / ${recoveryRates.length.toLocaleString("ja-JP")}市区町村` : "データ未取込"} tone="red" />
            <StatCard icon={Bell} label="公式改定情報あり" value={revisionCount.toLocaleString("ja-JP")} unit="市区町村" sub={targetCount ? `全体の${formatPercent((revisionCount / targetCount) * 100)}` : "データ未取込"} tone="amber" />
          </div>
        </div>
      </section>
      <section className="map-page-atlas-section mx-auto max-w-[1491px] px-4 py-3 sm:px-6 lg:px-7">
        <PrefectureMapExplorer
          prefectureCode={data.prefecture.code}
          summaries={data.summaries}
          municipalities={data.municipalities}
        />
      </section>
    </div>
  );
}
