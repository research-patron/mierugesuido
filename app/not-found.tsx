import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "ページが見つかりません",
  description: "指定されたページは見つかりませんでした。自治体検索または全国マップから目的の情報を探せます。",
  alternates: {
    canonical: null
  },
  openGraph: null,
  twitter: null,
  robots: {
    index: false,
    follow: false
  }
};

export default function NotFound() {
  return (
    <div className="water-band min-h-[60vh] border-b border-line">
      <section className="mx-auto grid max-w-3xl justify-items-start gap-5 px-6 py-16 sm:py-24">
        <p className="text-sm font-black tracking-[0.18em] text-teal">404 NOT FOUND</p>
        <h1 className="text-3xl font-black leading-tight text-ink sm:text-4xl">ページが見つかりません</h1>
        <p className="max-w-2xl text-sm font-medium leading-7 text-slate-700">
          URLが変更されたか、ページが公開されていない可能性があります。自治体検索または全国マップから目的の情報を探してください。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/municipalities" className="button-primary">
            <Search size={17} aria-hidden="true" />
            自治体を検索
          </Link>
          <Link href="/map" className="button-secondary">
            <MapPin size={17} aria-hidden="true" />
            全国マップを見る
          </Link>
          <Link href="/" className="button-secondary">ホームへ戻る</Link>
        </div>
      </section>
    </div>
  );
}
