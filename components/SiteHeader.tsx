"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CircleHelp, Home, MapPin, Search, Trophy } from "lucide-react";
import clsx from "clsx";
import { siteName } from "@/lib/copy";

const navItems = [
  { href: "/", label: "ホーム", icon: Home, exact: true },
  { href: "/map", label: "全国マップ", icon: MapPin },
  { href: "/municipalities", label: "自治体検索", icon: Search },
  { href: "/rankings", label: "ランキング", icon: Trophy },
  { href: "/revisions", label: "改定情報", icon: CalendarDays },
  { href: "/data-sources", label: "データの見方", icon: CircleHelp }
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header sticky top-0 z-40 border-b border-line/80 bg-white/96 backdrop-blur-xl">
      <div className="site-header-inner mx-auto flex max-w-[1491px] items-center justify-between gap-5 px-6">
        <Link href="/" className="site-brand flex min-w-0 items-center gap-4" aria-label={`${siteName} ホーム`}>
          <SewerMark />
          <span className="site-brand-copy min-w-0">
            <span className="site-title block truncate">{siteName}</span>
            <span className="site-subtitle block truncate">家庭用料金と経費回収率を都道府県・市区町村で比較</span>
          </span>
        </Link>

        <nav
          className="site-nav hidden items-stretch gap-1 text-[13px] font-black text-slate-700 lg:flex"
          aria-label="メインナビゲーション"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "group relative flex min-h-[76px] flex-col items-center justify-center gap-1.5 px-5 transition",
                  active ? "text-teal" : "text-ink hover:text-teal"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} className={clsx("site-nav-icon", active ? "text-teal" : "text-slate-700")} strokeWidth={active ? 2.5 : 1.9} fill={active && item.href === "/" ? "currentColor" : "none"} />
                <span>{item.label}</span>
                {active ? <span className="absolute inset-x-3 bottom-0 h-[4px] rounded-t bg-teal" /> : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <nav
        className="site-mobile-nav border-t border-line/70 bg-white text-slate-700 lg:hidden"
        aria-label="モバイル用メインナビゲーション"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "site-mobile-nav-link",
                active ? "bg-teal text-white" : "border border-line bg-white"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} strokeWidth={active ? 2.6 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function SewerMark() {
  return (
    <span className="site-logo" aria-hidden="true">
      <Image
        src="/images/sewer-brand-mark-v1.png"
        alt=""
        width={56}
        height={56}
        priority
        className="h-full w-full object-contain"
      />
    </span>
  );
}
