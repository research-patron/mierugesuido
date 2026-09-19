import type { Metadata, Viewport } from "next";
import { Kiwi_Maru } from "next/font/google";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";
import "./ui-fidelity.css";
import { siteName } from "@/lib/copy";
import { createPageMetadata, siteDescription, siteUrl } from "@/lib/siteMetadata";

const kiwiMaru = Kiwi_Maru({
  weight: ["400", "500"],
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  variable: "--font-kiwi-maru"
});

export const metadata: Metadata = {
  ...createPageMetadata({
    description: siteDescription,
    path: "/"
  }),
  metadataBase: siteUrl,
  applicationName: siteName,
  title: {
    default: siteName,
    template: `%s | ${siteName}`
  },
  manifest: "/manifest.webmanifest",
  category: "public data",
  formatDetection: {
    telephone: false,
    address: false,
    email: false
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  }
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#0b9aa3"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" data-scroll-behavior="smooth" className={kiwiMaru.variable}>
      <body>
        <a href="#main-content" className="skip-link">本文へ移動</a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="site-footer border-t border-line bg-white">
          <div className="mx-auto grid max-w-[1491px] gap-3 px-9 py-3 text-[11px] font-bold leading-5 text-slate-600 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-8">
            <div>
              <p>{siteName}</p>
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
          </div>
        </footer>
      </body>
    </html>
  );
}
