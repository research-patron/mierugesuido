"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { QuerySync } from "@/components/QuerySync";
import { RankingNav } from "@/components/RankingNav";
import { RankingTable } from "@/components/RankingTable";
import { RankingComparison } from "@/components/RankingComparison";
import { comparisonHref, orderRankingRows, selectComparisonRows } from "@/lib/comparison";
import { BUSINESS_CODE_LABELS, accountingTypeLabel } from "@/lib/businessDisplay";
import { countRankingPopulation, type RankingCoverage } from "@/lib/rankingCoverage";
import type { RankingType } from "@/lib/rankings";

export function RankingExplorer({ type, items, home, coverage }: { type: RankingType; items: any[]; home: any; coverage: RankingCoverage }) {
  const [query, setQuery] = useState("");
  const params = useMemo(() => new URLSearchParams(query), [query]);
  const municipalMode = params.get("rowUnit") === "municipality";
  const category = params.get("businessType") || "17/1";
  const source = municipalMode
    ? home.mapScopes[category === "17/4" ? "tokkan" : "public"].mapMunicipalities
    : items;
  const selected = orderRankingRows(selectComparisonRows(source, params, home.overview.latestYear), type);
  const year = params.get("fiscalYear") || home.overview.latestYear;
  const comparison = new URLSearchParams(params);
  comparison.set("fiscalYear", String(year));
  const linked = selected.map(item => ({ ...item, comparisonQuery: comparison.toString() }));
  return <>
    <QuerySync onChange={setQuery} />
    <RankingNav current={type} comparisonQuery={comparison.toString()} />
    <section className="panel p-4 text-sm leading-7" aria-label="ランキングの比較条件">
      <p>{year}年度決算 ／ {params.get("prefecture") || "全国"} ／ {params.get("businessType") ? BUSINESS_CODE_LABELS[category] || category : municipalMode ? "公共下水道" : "全事業区分（流域下水道を除く）"} ／ {params.get("accountingType") ? accountingTypeLabel(params.get("accountingType")) : "法適用・法非適用（参考）"}</p>
      <p>{municipalMode ? `自治体ごとの代表1事業。有効値 ${selected.length} 自治体／条件に合う収録 ${selectComparisonRows(source, params, home.overview.latestYear).length} 自治体。トップと同じ集計です。` : `自治体・運営団体の事業別。有効値の比較母数 ${countRankingPopulation(coverage, params).toLocaleString("ja-JP")} 事業。全国先頭 ${items.length} 事業の公開抜粋から、条件に合う ${selected.length} 事業を表示しています。`}</p>
      <p className="text-xs text-slate-600">ランキング入力版：{(municipalMode ? home.comparisonVersion : coverage.populationSha256).slice(0, 12)}。{municipalMode ? "自治体代表値の比較です。組合等の会計は事業別ランキングで比較できます。" : "組合等の共同会計は運営団体の事業として1回集計し、構成自治体に配賦しません。"}</p>
      <p>欠損・算定不可は順位対象外。保存値で順位を決め、同値は同順位（1、2、2、4）。表示の丸めは順位に使いません。</p>
      <p>自動チェックは欠損・分母・外れ値等の検出です。原資料との全件照合や自治体公式発表の確認を意味しません。<Link className="text-teal underline" href="/data-sources">定義・出典</Link></p>
      <div className="mt-2 flex flex-wrap gap-4">
        {municipalMode ? <Link className="text-teal underline" href={`/rankings/${type}`}>条件を変更：全事業区分の事業別ランキングへ</Link> : <Link className="text-teal underline" href={comparisonHref(`/rankings/${type}`, { rowUnit: "municipality", businessType: "17/1", fiscalYear: String(home.overview.latestYear) })}>条件を変更：公共下水道の自治体比較へ</Link>}
        <Link className="text-teal underline" href={comparisonHref("/municipalities", comparison)}>{municipalMode ? "同じ年度・事業条件で自治体を探す" : "比較単位を変更：自治体ごとの代表事業を探す"}</Link>
      </div>
    </section>
    <RankingComparison items={linked} type={type} />
    <RankingTable items={linked} type={type} />
  </>;
}
