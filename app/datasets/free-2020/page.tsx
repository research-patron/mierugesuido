import Link from "next/link";
import { createPageMetadata } from "@/lib/siteMetadata";
import { freeSurveyReady,freeSurveyQuestions } from "@/lib/freeDatasetSurvey";
import survey from "@/config/free-dataset-survey.json";
import edition from "@/data/static/free-2020-catalog.json";
export const metadata={...createPageMetadata({title:"2020年度の無料CSV",description:"2020年度の全国・公共下水道の基本指標と費用内訳を収録した無料CSV。収録範囲と、データのご要望アンケート後の取得方法をご案内します。",path:"/datasets/free-2020"}),robots:{index:false,follow:true}};
export default function Free2020Page(){const ready=freeSurveyReady(survey);
 return <div className="mx-auto max-w-[1000px] space-y-8 px-5 py-8 sm:px-8">
 <Link href="/datasets" className="text-teal underline">データ販売へ</Link>
 <header className="space-y-3"><p className="font-bold text-teal">無料・会員登録不要</p><h1 className="text-2xl font-black leading-relaxed sm:text-3xl">アンケートに回答して無料CSVを受け取る</h1><p className="leading-8">全国の基本指標と費用内訳を、県内比較や散布図を作れるCSVにまとめました。今後ほしいデータについて、短いアンケートへのご協力をお願いします。</p></header>
 <section className="space-y-4" aria-labelledby="survey-heading"><h2 id="survey-heading" className="text-xl font-bold">ご回答後にダウンロードできます</h2><p className="leading-8">必須は「今後ほしいデータ」の1問だけです。回答の送信後、Googleフォームの完了画面にダウンロードページのリンクを表示します。</p><ol className="list-decimal space-y-2 pl-5 leading-7">{freeSurveyQuestions.map(q=><li key={q.title}>{q.title}{q.required?"〈必須〉":""}</li>)}</ol><p className="text-sm leading-7">氏名・メールアドレスは収集しません。回答はGoogleフォームに保存し、運営者が商品企画のために集計します。回答内容・集計結果は一般公開しません。自由記述に個人情報や勤務先の機密情報を入力しないでください。</p>
 {ready?<a className="button-primary" href={survey.responderUrl!} rel="noreferrer">アンケートに回答して無料CSVを受け取る（Googleフォーム）</a>:<p role="status" className="rounded-md bg-panel p-4 leading-7">CSVは準備済みです。アンケートの公開・動作確認が完了してから、ここに回答用リンクを表示します。</p>}
 <p className="text-sm leading-7 text-slate-600">回答後のリンクが開かない場合は、フォームの完了画面を閉じずに再度お試しください。サイト側で回答内容を受け取ったり、回答済みと判定したりする処理はありません。</p></section>
 <section className="space-y-4 rounded-md border border-line p-5"><h2 className="text-xl font-bold">無料CSVに入っているもの</h2><p><strong className="text-2xl">{edition.rowCount.toLocaleString("ja-JP")}</strong> 事業会計・{edition.columnCount}列</p><ul className="list-disc space-y-2 pl-5 leading-7"><li>自治体・運営団体、会計区分、人口、水量、家庭用20m³月額、使用料収入、経費回収率など</li><li>維持管理費・資本費、管渠費・処理場費、減価償却費・動力費などの年額と1m³当たり費用</li><li>費用構成比、県内中央値、中央値との差、費目ごとの比較件数・欠損状態</li><li>計算に使った原値、指標の計算式、公式Excelへのリンク、出典対応、散布図の作成手順</li></ul><p className="text-sm leading-7">決算年度は2020年度（令和2年度）、原資料のカタログ年は2021年です。法適用{edition.legalCount}・法非適用{edition.nonLegalCount}。共同会計は団体コード単位で1回だけ収録し、市町村別に配賦しません。</p><p className="text-sm leading-7">費用比較は同県・同年度の公共下水道の法適用事業が対象です。欠損は空欄、0は実際の0。現在の画面の2024年度・公共下水道と特環を含む比較や、2024年度の販売予定商品とは範囲が異なります。</p></section>
 <Link href="/municipalities" className="inline-flex min-h-11 items-center text-teal underline">無料の料金検索・経営比較へ →</Link>
 </div>;
}
