import Link from "next/link";
import { createPageMetadata } from "@/lib/siteMetadata";
import freeEdition from "@/data/static/free-2020-catalog.json";
import { getDatasetCatalog } from "@/lib/datasetCatalog";
import survey from "@/config/free-dataset-survey.json";
import { freeSurveyEntryHref } from "@/lib/freeDatasetSurvey";
export const metadata=createPageMetadata({title:"データ販売・無料見本",description:"下水道事業の調査・資料作成に使う加工済みデータの販売予定商品と無料見本を案内します。無料の料金検索・経営比較は引き続き利用できます。",path:"/datasets"});
export default async function DatasetsPage(){
  const catalog=await getDatasetCatalog();
  return <div className="mx-auto max-w-[1100px] space-y-8 px-5 py-8 sm:px-8">
    <header className="space-y-3"><p className="text-sm font-bold text-teal">調査・資料作成に使う方へ</p><h1 className="text-3xl font-black">データ販売・無料見本</h1><p className="leading-8">比較条件をそろえたデータに、列定義・欠損情報・出典対応を添えた資料セットです。まず無料見本で内容を確認できます。</p></header>
    <section className="border-y border-line py-5 leading-8"><h2 className="text-xl font-bold">料金検索・経営比較は、これからも無料です</h2><p>公的な元データを独占する商品ではありません。無料画面・既存CSVはそのまま使えます。資料セットは、固定版の一括ファイルと説明資料をまとめて使いたい方向けです。</p><Link className="inline-flex min-h-11 items-center text-teal underline" href="/municipalities">無料の自治体検索へ →</Link></section>
    <section className="space-y-4 rounded-md border border-line p-5" aria-labelledby="free-data-heading"><p className="text-sm font-bold text-teal">2020年度・全国の公共下水道</p><h2 id="free-data-heading" className="text-xl font-black">費用内訳まで使える無料CSV</h2><p className="leading-8">{freeEdition.rowCount.toLocaleString("ja-JP")}事業会計の基本指標・費用内訳と県内中央値。ご自身で費目別の散布図や比較表を作れます。</p><a className="inline-flex min-h-11 items-center font-bold text-teal underline" href={freeSurveyEntryHref(survey)} rel="noreferrer">アンケートに回答して無料CSVを受け取る →</a><p className="text-sm leading-7">必須は1問。Googleフォームへの送信後にダウンロードを案内します。氏名・メールは収集せず、回答は商品企画に使い、一般公開しません。</p><p className="text-sm text-slate-600">下記の2024年度商品とは、年度・収録内容が異なる無料データです。</p></section>
    <section className="space-y-4" aria-label="資料一覧"><h2 className="text-xl font-black">2024年度の販売予定商品</h2>
      {catalog.length ? catalog.map(({product,edition,purchasable})=><article key={product.productId} className="rounded-md border border-line p-5"><p className="text-xs font-bold text-teal">{product.status==="retired"?"販売終了":purchasable?"販売中":"無料見本・販売準備中"}</p><h2 className="mt-2 text-xl font-black"><Link className="underline decoration-line underline-offset-4" href={`/datasets/${product.slug}`}>{product.title}</Link></h2><p className="mt-3 text-sm leading-7">{edition?.filesReady ? `${edition.rowCount.toLocaleString("ja-JP")}自治体・CSVと列定義、出典対応。見本は${edition.sampleCount}行。` : "この版の見本は検証中です。"}</p><Link className="mt-3 inline-flex min-h-11 items-center text-teal underline" href={`/datasets/${product.slug}`}>内容と無料見本を見る →</Link></article>) : <p>現在ご案内できる資料はありません。無料比較をご利用ください。</p>}
    </section>
    <p className="text-sm leading-7 text-slate-600">購入・決済・販売ファイルの提供はnoteを利用する予定です。価格・販売条件・提供方法を確認できる商品だけに購入リンクを表示します。</p>
  </div>;
}
