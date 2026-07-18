import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";
import "./ui-fidelity.css";
import { footerDisclaimer, siteName } from "@/lib/copy";

export const metadata: Metadata = {
  title: siteName,
  description: "総務省/e-Statの地方公営企業決算状況調査をもとに、自治体別の家庭用料金と経費回収率を比較・可視化します。"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" data-scroll-behavior="smooth">
      <body>
        <a href="#main-content" className="skip-link">本文へ移動</a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="site-footer border-t border-line bg-white">
          <div className="mx-auto grid max-w-[1491px] gap-3 px-9 py-3 text-[11px] font-bold leading-5 text-slate-600 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-8">
            <div>
              <p>※ 経費回収率 = 使用料収入 ÷ 汚水処理費（公費負担分を除く）× 100</p>
              <p>※ 法非適用事業は料金指標のみ参考比較し、損益・貸借の図示対象から除外します。</p>
              <p>※ 流域下水道は、市町村が一般家庭から徴収する下水道使用料を直接設定する事業とは役割が異なるため、同列の使用料比較から除外します。</p>
            </div>
            <div className="flex flex-col gap-1 md:items-end">
              <p>データ出典：総務省「地方公営企業決算状況調査（下水道事業）」等</p>
              <nav className="flex flex-wrap items-center gap-4 font-black text-ink" aria-label="フッターナビゲーション">
                <Link href="/data-sources">データの見方</Link>
                <span className="h-4 w-px bg-line" aria-hidden="true" />
                <Link href="/disclaimer">免責事項</Link>
                <span className="h-4 w-px bg-line" aria-hidden="true" />
                <Link href="/about">サイトについて</Link>
              </nav>
            </div>
            <p className="sr-only">{footerDisclaimer}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
