import { formulaCopy, siteName } from "@/lib/copy";

export default function AboutPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-ink">{siteName}について</h1>
      <p className="text-sm leading-7 text-slate-600">
        本サイトは、総務省/e-Statで公開される地方公営企業決算状況調査をもとに、下水道事業の使用料水準を自治体・事業別に確認するためのWebアプリです。会計上の収支と、汚水処理費に対する下水道使用料収入の割合を分けて表示します。
      </p>
      <section className="rounded-md border border-line bg-white p-5">
        <h2 className="text-xl font-bold text-ink">主な計算式</h2>
        <div className="mt-4 grid gap-3">
          {formulaCopy.map((item) => (
            <div key={item.title} className="rounded bg-panel p-3">
              <div className="font-bold text-ink">{item.title}</div>
              <div className="mt-1 text-sm text-slate-600">{item.formula}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
