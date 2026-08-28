import type { Metadata } from "next";
import { siteName } from "@/lib/copy";
import { createPageMetadata } from "@/lib/siteMetadata";

const pageMetadata = createPageMetadata({
  title: "自治体検索",
  description: "自治体名、都道府県、事業区分などから、全国の下水道使用料、経費回収率、使用料単価を検索し、自治体別の診断を確認できます。",
  path: "/municipalities"
});

export const metadata: Metadata = {
  ...pageMetadata,
  title: {
    default: "自治体検索",
    template: `%s | ${siteName}`
  }
};

export default function MunicipalitiesLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
