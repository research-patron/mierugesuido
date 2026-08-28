import type { Metadata } from "next";
import { siteName } from "@/lib/copy";

export const defaultSiteOrigin = "https://mierugesuido.pages.dev";
export const siteOrigin = normalizeSiteOrigin(
  process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteOrigin
);
export const siteUrl = new URL(siteOrigin);

export const siteDescription =
  "総務省・e-Statの地方公営企業決算状況調査をもとに、全国の自治体別に一般家庭用下水道使用料、使用料単価、汚水処理原価、経費回収率を検索・比較できるサイトです。";

export const socialImage = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: `${siteName} — 全国の下水道使用料を診断・比較`
} as const;

type PageMetadataOptions = {
  title?: string;
  description: string;
  path: string;
};

export function createPageMetadata({
  title,
  description,
  path
}: PageMetadataOptions): Metadata {
  const canonicalPath = normalizeCanonicalPath(path);
  const socialTitle = title ? `${title} | ${siteName}` : siteName;

  return {
    title: title ?? siteName,
    description,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      type: "website",
      locale: "ja_JP",
      url: canonicalPath,
      siteName,
      title: socialTitle,
      description,
      images: [socialImage]
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [socialImage]
    }
  };
}

export function absoluteSiteUrl(path: string): string {
  return new URL(normalizeCanonicalPath(path), siteUrl).toString();
}

export function absoluteAssetUrl(path: string): string {
  const pathname = path.startsWith("/") ? path : `/${path}`;
  return new URL(pathname, siteUrl).toString();
}

function normalizeCanonicalPath(path: string): string {
  const pathname = path.startsWith("/") ? path : `/${path}`;
  if (pathname === "/") return pathname;
  return `${pathname.replace(/\/+$/, "")}/`;
}

function normalizeSiteOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use https");
  }
  return url.origin;
}
