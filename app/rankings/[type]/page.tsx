import { notFound } from "next/navigation";
import { RankingNav } from "@/components/RankingNav";
import { RankingComparison } from "@/components/RankingComparison";
import { RankingTable } from "@/components/RankingTable";
import { rankingLabels, type RankingType } from "@/lib/rankings";
import { getStaticManifest, getStaticRankings } from "@/lib/staticData";

export async function generateStaticParams() {
  const manifest = await getStaticManifest();
  return manifest.rankingTypes.map((type) => ({ type }));
}

export default async function RankingTypePage({
  params
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (!(type in rankingLabels)) notFound();
  const rankingType = type as RankingType;
  const items = await getStaticRankings(rankingType);

  return (
    <div>
      <section className="water-band border-b border-line">
        <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-black text-ink sm:text-4xl">{rankingLabels[rankingType]}</h1>
            <p className="mt-2 max-w-4xl text-sm font-medium leading-7 text-slate-700">
              異常値フラグがあるデータは注記対象です。分母欠損により算定できないデータはランキングから除外します。
            </p>
            <p className="mt-1 max-w-4xl text-xs font-bold leading-6 text-slate-600">
              {rankingType === "transfer-dependency-high"
                ? "基準外繰入金の比較は法適用事業に限定します。"
                : "法非適用事業は、総務省調査の共通定義による料金指標だけを参考比較します。"}
            </p>
          </div>
          <RankingNav current={rankingType} />
        </div>
      </section>
      <section className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <RankingComparison items={items} type={rankingType} />
        <RankingTable items={items} type={rankingType} />
      </section>
    </div>
  );
}
