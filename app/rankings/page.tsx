import type { Metadata } from "next";
import { RankingExplorer } from "@/components/RankingExplorer";
import { defaultRankingType } from "@/lib/rankings";
import { getStaticRankings, getStaticHomeData, getStaticRankingCoverage } from "@/lib/staticData";
import { createPageMetadata } from "@/lib/siteMetadata";

export const metadata: Metadata = createPageMetadata({
  title: "下水道使用料ランキング・比較",
  description: "全国の下水道事業を、経費回収率、使用料単価、汚水処理原価の高い順・低い順で比較できるランキングです。",
  path: "/rankings"
});

export default async function RankingsPage() {
  const items = await getStaticRankings(defaultRankingType);

  return (
    <div>
      <section className="water-band border-b border-line">
        <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-black text-ink sm:text-4xl">ランキング・比較</h1>
            <p className="mt-2 max-w-4xl text-sm font-medium leading-7 text-slate-700">
              経費回収率、使用料単価、汚水処理原価を、自治体・運営団体の事業別に比較します。自治体・運営団体名を選ぶと「このまちの診断」を開きます。
            </p>
            <p className="mt-1 text-xs font-bold leading-6 text-slate-600">対象年度の公表値を全国で比較。法非適用事業は料金指標の参考比較です。</p>
          </div>

        </div>
      </section>
      <section className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <RankingExplorer items={items} type={defaultRankingType} home={await getStaticHomeData()} coverage={await getStaticRankingCoverage(defaultRankingType)} />
      </section>
    </div>
  );
}
