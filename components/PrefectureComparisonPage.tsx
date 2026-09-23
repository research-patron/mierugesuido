"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Gauge, PieChart, Users } from "lucide-react";
import { PrefectureMapExplorer } from "@/components/PrefectureMapExplorer";
import { StatCard } from "@/components/StatCard";
import { QuerySync } from "@/components/QuerySync";
import { comparisonHref, selectComparisonRows } from "@/lib/comparison";
import { accountingTypeLabel } from "@/lib/businessDisplay";
import { formatPercent } from "@/lib/format";

export function PrefectureComparisonPage({ data, home, revisions }: { data: any; home: any; revisions: Record<string, any> }) {
  const [query, setQuery] = useState("");
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const category = params.get("businessType");
  const scope = category === "17/1" ? home.mapScopes.public : category === "17/4" ? home.mapScopes.tokkan : null;
  const source = scope ? scope.mapMunicipalities.filter((row: any) => row.prefectureName === data.prefecture.name) : data.municipalities;
  const targetMunicipalities = selectComparisonRows(source, params, home.overview.latestYear);
  const context = new URLSearchParams(params);
  context.set("fiscalYear", String(params.get("fiscalYear") || home.overview.latestYear));
  context.set("prefecture", data.prefecture.name);
  const targetCount = targetMunicipalities.length;
  const recoveryRates = targetMunicipalities
    .map((item: any) => item.expenseRecoveryRate)
    .filter((value: any): value is number => value != null && Number.isFinite(value));
  const averageExpenseRecoveryRate = recoveryRates.length > 0
    ? recoveryRates.reduce((sum: number, value: number) => sum + value, 0) / recoveryRates.length
    : null;
  const below100Count = recoveryRates.filter((value: number) => value < 100).length;
  const below100Rate = recoveryRates.length > 0 ? (below100Count / recoveryRates.length) * 100 : null;
  const revisionCount = targetMunicipalities.filter((item: any) => revisions[item.municipalityCode]?.status === "changed").length;
  const revisionUnknownCount = targetMunicipalities.filter((item: any) => !revisions[item.municipalityCode] || revisions[item.municipalityCode]?.status === "unavailable").length;

  return (
    <div className="map-page">
      <QuerySync onChange={setQuery} />
      <section className="water-band map-page-hero border-b border-line">
        <div className="map-page-hero-inner mx-auto grid max-w-[1491px] gap-3 px-4 py-3 sm:px-6 lg:px-7">
          <div className="map-page-heading flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black text-teal">
                <Link href="/">ホーム</Link> ＞ <Link href={comparisonHref("/map", params)}>全国マップ</Link> ＞ {data.prefecture.name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black leading-tight text-ink sm:text-3xl">
                  {data.prefecture.name}の下水道経費回収率マップ
                </h1>
                <span className="rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-black text-teal">流域下水道を除く</span>
              </div>
            </div>
            <Link href={comparisonHref("/map", params)} className="button-secondary">
              都道府県を変更
            </Link>
          </div>
          <p className="text-xs leading-6 text-slate-600">{context.get("fiscalYear")}年度決算・{scope?.label || "流域下水道を除く代表事業（区分混合）"}・{params.get("accountingType") ? accountingTypeLabel(params.get("accountingType")) : "法適用／法非適用（参考）"}。自治体ごとの代表1事業。平均は有効値の単純平均です。<Link href="/data-sources" className="text-teal underline">出典・比較条件</Link></p>
          <div className="map-page-kpi-grid grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard icon={Users} label="対象自治体数" value={targetCount.toLocaleString("ja-JP")} unit="自治体" sub="都道府県全体の比較対象" tone="teal" />
            <StatCard icon={Gauge} label="平均経費回収率" value={formatPercent(averageExpenseRecoveryRate).replace("%", "")} unit={averageExpenseRecoveryRate == null ? undefined : "%"} sub={recoveryRates.length > 0 ? `${recoveryRates.length.toLocaleString("ja-JP")}自治体の有効値` : "データ未取込"} tone="violet" />
            <StatCard icon={PieChart} label="経費回収率100%未満の割合" value={formatPercent(below100Rate).replace("%", "")} unit={below100Rate == null ? undefined : "%"} sub={recoveryRates.length > 0 ? `${below100Count.toLocaleString("ja-JP")} / ${recoveryRates.length.toLocaleString("ja-JP")}自治体` : "データ未取込"} tone="red" />
            <StatCard icon={Bell} label="R5→R6 施行年月日の変更" value={revisionCount.toLocaleString("ja-JP")} unit="自治体" sub={`第33表の比較・未確認等 ${revisionUnknownCount} 自治体。値上げの判定ではありません`} tone="amber" />
          </div>
        </div>
      </section>
      <section className="map-page-atlas-section mx-auto max-w-[1491px] px-4 py-3 sm:px-6 lg:px-7">
        <PrefectureMapExplorer
          prefectureCode={data.prefecture.code}
          summaries={data.summaries}
          municipalities={targetMunicipalities.map((item: any) => ({ ...item, comparisonQuery: context.toString() }))}
        />
      </section>
    </div>
  );
}
