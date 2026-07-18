import { RankingNav } from "@/components/RankingNav";
import { RankingComparison } from "@/components/RankingComparison";
import { RankingTable } from "@/components/RankingTable";
import { getRankings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const items = await getRankings("expense-recovery-low", 30);

  return (
    <div>
      <section className="water-band border-b border-line">
        <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-black text-ink sm:text-4xl">ランキング・比較</h1>
            <p className="mt-2 max-w-4xl text-sm font-medium leading-7 text-slate-700">
              経費回収率、100%相当の増収率、使用料単価、汚水処理原価、基準外繰入金から自治体・運営団体の事業別に比較します。
            </p>
            <p className="mt-1 text-xs font-bold leading-6 text-slate-600">法非適用事業は、総務省調査の共通定義による料金指標だけを参考比較します。</p>
          </div>
          <RankingNav current="expense-recovery-low" />
        </div>
      </section>
      <section className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <RankingComparison items={items} type="expense-recovery-low" />
        <RankingTable items={items} type="expense-recovery-low" />
      </section>
    </div>
  );
}
