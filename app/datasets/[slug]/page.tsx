import Link from "next/link";
import { notFound } from "next/navigation";
import { getDatasetCatalog } from "@/lib/datasetCatalog";
import { createPageMetadata } from "@/lib/siteMetadata";
import { datasetColumns,datasetMetrics } from "@/lib/datasetEdition";
import { purchaseBlockers,safeHttpsUrl } from "@/lib/datasetProduct";
import { DataViewEvent,DatasetDownload,NotePurchaseLink } from "@/components/DatasetActions";

export async function generateStaticParams(){return(await getDatasetCatalog()).map(({product})=>({slug:product.slug}));}
async function getEntry(slug:string){return(await getDatasetCatalog()).find(({product})=>product.slug===slug);}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){
 const entry=await getEntry((await params).slug);if(!entry)return {};
 return {...createPageMetadata({title:entry.product.title,description:`${entry.product.title}の対象範囲、列定義、出典、無料見本と提供条件を案内します。画面と同じ比較条件の固定版を確認できます。`,path:`/datasets/${entry.product.slug}`}),robots:{index:entry.purchasable,follow:true}};
}
export default async function DatasetPage({params}:{params:Promise<{slug:string}>}){
 const entry=await getEntry((await params).slug);if(!entry)notFound();
 const {product,edition,purchasable}=entry;
 const conditions=purchaseBlockers(product,edition?.dataVersion??"",Boolean(edition?.filesReady));
 const sampleBase=`/samples/${product.slug}`;
 return <div className="mx-auto max-w-[1100px] space-y-8 px-5 py-8 sm:px-8">
  <Link href="/datasets" className="text-sm text-teal underline">データ販売・無料見本へ</Link>
  <header className="space-y-3"><p className="text-sm font-bold text-teal">{product.status==="retired"?"販売終了":purchasable?"販売中":"無料見本・販売準備中"}</p><h1 className="text-2xl font-black leading-relaxed sm:text-3xl">{product.title}</h1><p className="leading-8">自治体比較や資料作成のために、対象条件をそろえた一覧と根拠をまとめて確認したい方へ。ファイルの結合、列の確認、出典の整理に使える資料セットです。</p></header>
  {!edition?.filesReady ? <p role="status">{edition?.error??"見本の生成・検証待ちです。"}</p> : <>
   <section className="rounded-md border border-line p-5" aria-label="商品の対象条件"><h2 className="text-xl font-black">対象と収録内容</h2><p className="mt-3 leading-8">{edition.conditions}</p><div className="mt-4 grid grid-cols-2 gap-5 border-y border-line py-4"><p><strong className="text-2xl">{edition.rowCount.toLocaleString("ja-JP")}</strong> 自治体</p><p><strong className="text-2xl">{edition.columnCount}</strong> 列</p></div><p className="mt-3 text-sm leading-7">流域下水道と組合等の独立した共同運営会計は対象外です。共同会計の財務額を自治体に配賦していません。家庭用料金の一覧ではありません。欠損は空欄のまま保持し、過年度で補完しません。</p><DataViewEvent name="view_item" properties={{productId:product.productId,dataVersion:edition.dataVersion,placement:"dataset"}} identity={product.productId}/></section>
   <section className="space-y-3"><h2 className="text-xl font-black">無料で使えるものと資料セットの違い</h2><p className="leading-8">無料画面では検索・地図・ランキング・事業別の推移を確認でき、従来の都道府県CSVも利用できます。この資料セットは、固定年度の一覧CSVに、列定義・出典対応・版と検証の記録を同梱します。会員登録は不要です。</p><ul className="list-disc space-y-1 pl-5 text-sm leading-7">{edition.files.map((file:any)=><li key={file.name}>{file.name}（{file.bytes.toLocaleString("ja-JP")} bytes）</li>)}</ul></section>
   <section className="space-y-4" id="sample"><h2 className="text-xl font-black">無料見本</h2><p className="leading-7">自治体コード順の先頭{edition.sampleCount}行です。全国を代表する標本ではありません。本体と同じデータ版・列定義・集計処理から生成しています。</p><div className="flex flex-wrap gap-3"><DatasetDownload productId={product.productId} fileType="csv" href={`${sampleBase}/sample.csv`}>見本CSVをダウンロード</DatasetDownload><DatasetDownload productId={product.productId} fileType="definitions" href={`${sampleBase}/columns.csv`}>列定義</DatasetDownload><DatasetDownload productId={product.productId} fileType="sources" href={`${sampleBase}/sources.csv`}>見本の出典対応</DatasetDownload><DatasetDownload productId={product.productId} fileType="readme" href={`${sampleBase}/README.md`}>読み方・注意点</DatasetDownload><DatasetDownload productId={product.productId} fileType="manifest" href={`${sampleBase}/manifest.json`}>版情報</DatasetDownload></div>
    <p className="text-xs text-slate-600 sm:hidden">表は横にスクロールできます。</p><div tabIndex={0} role="region" aria-label="無料見本の表（横スクロール）" className="overflow-x-auto rounded border border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"><table className="w-full min-w-[640px] text-sm"><caption className="sr-only">無料見本の経営指標</caption><thead><tr><th className="p-3 text-left">自治体</th>{datasetMetrics.map(metric=><th key={metric.id} className="p-3 text-right">{metric.label}（{metric.unit}）</th>)}</tr></thead><tbody>{edition.sampleRows.map((row:any)=><tr key={row.rowId} className="border-t border-line"><th className="p-3 text-left font-medium">{row.prefectureName} {row.municipalityName}</th>{datasetMetrics.map(metric=><td key={metric.id} className="p-3 text-right tabular-nums">{row[metric.id]??"未収録・算定不可"}</td>)}</tr>)}</tbody></table></div>
    <p className="text-xs leading-6 text-slate-600">UTF-8 BOM付きCSV。自治体コードは文字列列として取り込んでください。表計算ソフトで直接開くと先頭ゼロが消える場合があります。</p></section>
   <section className="space-y-3"><h2 className="text-xl font-black">指標・出典と検証の範囲</h2>{datasetMetrics.map(metric=><p className="text-sm leading-7" key={metric.id}><strong>{metric.label}</strong>：{datasetColumns.find(column=>column.id===metric.id)?.definition}。欠損 {edition.missingCounts[metric.id]} 行。</p>)}<p className="text-sm leading-7">同条件の画面と保存値を共有します。順位は保存精度で計算し、同値は1、2、2、4です。自動検証は識別子・年度・重複・有限値・比較条件の整合を確認します。原資料との全件手動照合は未実施です。出典URLが未収録の対応行は{edition.sourceMissingCount}件です。</p><p className="text-sm leading-7">総務省「地方公営企業決算状況調査」の公的データを加工しています。政府が本資料を作成・推奨したものではありません。<a className="text-teal underline" href="https://www.e-stat.go.jp/terms-of-use">原資料の利用条件</a>と編集物の提供条件は別です。</p><Link className="inline-flex min-h-11 items-center text-teal underline" href="/data-sources">指標の定義と公的出典を見る →</Link><p className="break-all text-xs leading-6 text-slate-600">データ版：{edition.dataVersion}<br/>生成日時：{edition.generatedAt}（サイト公開日時とは別）</p></section>
  </>}
  <section className="space-y-4 border-t border-line pt-6"><h2 className="text-xl font-black">提供・利用条件</h2><dl className="grid gap-3 text-sm leading-7">{[["価格",product.priceJpy==null?"未確定":`${product.priceJpy.toLocaleString("ja-JP")}円`],["提供方法",product.deliverySummary],["利用許諾",product.licenseSummary],["訂正対応",product.correctionPolicy],["新版・更新",product.newEditionPolicy],["返金等",product.refundSummary],["販売者",product.sellerName]].map(([label,value])=><div key={label} className="grid gap-1 border-b border-line pb-3 sm:grid-cols-[140px_1fr]"><dt className="font-bold">{label}</dt><dd>{value||"確認・設定待ち"}</dd></div>)}</dl>
   {safeHttpsUrl(product.contactUrl)?<a className="inline-flex min-h-11 items-center text-teal underline" href={product.contactUrl}>販売者への問い合わせ</a>:<p className="text-sm">商品・訂正の問い合わせ窓口は設定待ちです。</p>}
   {safeHttpsUrl(product.sellerDisclosureUrl)?<a className="ml-4 text-teal underline" href={product.sellerDisclosureUrl}>販売者・販売条件の表示</a>:null}
   {purchasable?<NotePurchaseLink productId={product.productId} href={product.noteUrl!}/>:<p role="status" className="rounded-md bg-panel p-4 text-sm leading-7">{product.status==="retired"?"この版の販売は終了しています。":"販売条件と提供の確認が完了していないため、現在は購入できません。無料見本をご利用ください。"}<span className="mt-2 block text-xs text-slate-600">{conditions.filter(item=>item!=="販売開始前または販売終了").join("／")}</span></p>}
  </section>
  <section className="space-y-3"><h2 className="text-xl font-black">訂正記録</h2>{product.corrections.length?product.corrections.map((item,index)=><p key={index} className="break-words text-sm leading-7">{item.date}・対象版 {item.dataVersion}：{item.description}</p>):<p className="text-sm">この版の訂正記録はありません。</p>}</section>
 </div>;
}
