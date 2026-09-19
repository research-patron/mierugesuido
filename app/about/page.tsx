import type { Metadata } from "next";
import { formulaCopy, siteName } from "@/lib/copy";
import { createPageMetadata } from "@/lib/siteMetadata";

export const metadata: Metadata = createPageMetadata({
  title: "サイトについて",
  description: `${siteName}の目的、掲載する下水道事業データと主な計算式について説明します。`,
  path: "/about"
});

export default function AboutPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-ink">{siteName}について</h1>
      <p className="text-sm leading-7 text-slate-600">
        全国の下水道使用料と経営状況を、自治体・事業ごとに比べられるサイトです。総務省・e-Statの公表データをもとに、家庭の月額料金、費用の内訳、5年間の推移をグラフで紹介しています。
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
