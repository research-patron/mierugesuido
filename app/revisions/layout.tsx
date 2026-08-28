import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/siteMetadata";

export const metadata: Metadata = createPageMetadata({
  title: "下水道使用料の施行年月日変更一覧",
  description: "総務省の地方公営企業決算状況調査第33表をもとに、R5からR6で現行使用料施行年月日が変わった下水道事業を確認できます。",
  path: "/revisions"
});

export default function RevisionsLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
