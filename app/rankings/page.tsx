import { RankingNav } from "@/components/RankingNav";
import { RankingComparison } from "@/components/RankingComparison";
import { RankingTable } from "@/components/RankingTable";
import { defaultRankingType } from "@/lib/rankings";
import { getStaticRankings } from "@/lib/staticData";

export default async function RankingsPage() {
  const items = (await getStaticRankings(defaultRankingType)).slice(0, 30);

  return (
    <div>
      <section className="water-band border-b border-line">
        <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-black text-ink sm:text-4xl">ランキング・比較</h1>
            <p className="mt-2 max-w-4xl text-sm font-medium leading-7 text-slate-700">
              経費回収率、使用料単価、汚水処理原価、基準外繰入金額を、自治体・運営団体の事業別に比較します。下の比較ビューから、見たい指標と並び順をすぐに切り替えられます。
            </p>
            <p className="mt-1 text-xs font-bold leading-6 text-slate-600">全国単純比較であり、類似団体区分や事業規模の差を調整した評価ではありません。法非適用事業は、総務省調査の共通定義による料金指標だけを参考比較します。</p>
          </div>
          <RankingNav current={defaultRankingType} />
        </div>
      </section>
      <section className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <RankingComparison items={items} type={defaultRankingType} />
        <RankingTable items={items} type={defaultRankingType} />
      </section>
    </div>
  );
}
