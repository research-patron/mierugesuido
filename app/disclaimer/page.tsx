import type { Metadata } from "next";
import { DisclaimerBox } from "@/components/DisclaimerBox";
import { accountingExplanation, detailDisclaimer, footerDisclaimer, operatingRatioExplanation } from "@/lib/copy";
import { createPageMetadata } from "@/lib/siteMetadata";

export const metadata: Metadata = createPageMetadata({
  title: "免責事項",
  description: "本サイトに掲載する下水道使用料、経費回収率、会計指標、単純試算の前提と利用上の注意事項を説明します。",
  path: "/disclaimer"
});

export default function DisclaimerPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-ink">ご利用にあたって</h1>
      <DisclaimerBox>{footerDisclaimer}</DisclaimerBox>
      <section className="rounded-md border border-line bg-white p-5">
        <h2 className="text-xl font-bold text-ink">試算とグラフについて</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{detailDisclaimer}</p>
      </section>
      <section className="rounded-md border border-line bg-white p-5">
        <h2 className="text-xl font-bold text-ink">会計収支と使用料水準</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{accountingExplanation}</p>
      </section>
      <section className="rounded-md border border-line bg-white p-5">
        <h2 className="text-xl font-bold text-ink">営業収支比率（簡易）の位置づけ</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{operatingRatioExplanation} 本サイトの営業収支比率は、受託工事収益・費用等を控除しない簡易比率です。</p>
      </section>
      <section className="rounded-md border border-line bg-white p-5">
        <h2 className="text-xl font-bold text-ink">データの対象と表示</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">法非適用事業は料金指標のみの参考比較です。流域下水道は家庭料金の比較対象から除きます。組合事業は組合全体を1事業とし、市町村に配分しません。目的別・性質別の費用と経費回収率の汚水処理費は集計範囲が異なります。</p>
        <p className="mt-3 text-sm leading-7 text-slate-600">資金不足は総務省の公表一覧と会計単位で照合します。「一覧に掲載なし」は0円を示す公表値ではなく、「未確認」とも区別しています。施行日の変更は過去の改定履歴です。</p>
      </section>
    </div>
  );
}
