import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RankingExplorer } from "@/components/RankingExplorer";
import { isRankingType, rankingLabels, rankingSelection } from "@/lib/rankings";
import { getStaticManifest, getStaticRankings, getStaticHomeData, getStaticRankingCoverage } from "@/lib/staticData";
import { createPageMetadata } from "@/lib/siteMetadata";

export async function generateStaticParams() {
  const manifest = await getStaticManifest();
  return manifest.rankingTypes.map((type) => ({ type }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type } = await params;
  if (!isRankingType(type)) notFound();
  const { metric } = rankingSelection(type);
  return createPageMetadata({
    title: rankingLabels[type],
    description: `${metric.description} 全国の下水道事業を「${rankingLabels[type]}」で確認できます。`,
    path: `/rankings/${type}`
  });
}

export default async function RankingTypePage({
  params
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (!isRankingType(type)) notFound();
  const rankingType = type;
  const { metric } = rankingSelection(rankingType);
  const items = await getStaticRankings(rankingType);

  return (
    <div>
      <section className="water-band border-b border-line">
        <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-black text-ink sm:text-4xl">{rankingLabels[rankingType]}</h1>
            <p className="mt-2 max-w-4xl text-sm font-medium leading-7 text-slate-700">
              {metric.description} 自治体・運営団体名を選ぶと「このまちの診断」を開きます。
            </p>
            <p className="mt-1 max-w-4xl text-xs font-bold leading-6 text-slate-600">
              対象年度の公表値を全国で比較。法非適用事業は料金指標の参考比較です。
            </p>
          </div>

        </div>
      </section>
      <section className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <RankingExplorer items={items} type={rankingType} home={await getStaticHomeData()} coverage={await getStaticRankingCoverage(rankingType)} />
      </section>
    </div>
  );
}
