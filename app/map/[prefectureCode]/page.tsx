import { PrefectureComparisonPage } from "@/components/PrefectureComparisonPage";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStaticManifest, getStaticPrefectureMapData, getStaticHomeData, getStaticMunicipalityFeeRevisionIndex } from "@/lib/staticData";
import { createPageMetadata } from "@/lib/siteMetadata";

export async function generateStaticParams() {
  const manifest = await getStaticManifest();
  return manifest.prefectureCodes.map((prefectureCode) => ({ prefectureCode }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ prefectureCode: string }>;
}): Promise<Metadata> {
  const { prefectureCode } = await params;
  const data = await getStaticPrefectureMapData(prefectureCode);
  if (!data.prefecture) notFound();

  const title = `${data.prefecture.name}の下水道経費回収率マップ`;
  return createPageMetadata({
    title,
    description: `${data.prefecture.name}の自治体別に、下水道の経費回収率、使用料単価、汚水処理原価を地図と一覧で比較できます。`,
    path: `/map/${prefectureCode}`
  });
}

export default async function PrefectureMapPage({
  params
}: {
  params: Promise<{ prefectureCode: string }>;
}) {
  const { prefectureCode } = await params;
  const data = await getStaticPrefectureMapData(prefectureCode);
  if (!data.prefecture) notFound();

  return <PrefectureComparisonPage data={data} home={await getStaticHomeData()} revisions={await getStaticMunicipalityFeeRevisionIndex()} />;
}
