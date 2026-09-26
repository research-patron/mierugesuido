import { getDatasetCatalog } from "@/lib/datasetCatalog";
import type { MetadataRoute } from "next";
import { getStaticManifest } from "@/lib/staticData";
import { absoluteSiteUrl } from "@/lib/siteMetadata";

export const dynamic = "force-static";

const staticRoutes = [
  { path: "/", changeFrequency: "monthly", priority: 1 },
  { path: "/map", changeFrequency: "monthly", priority: 0.9 },
  { path: "/municipalities", changeFrequency: "monthly", priority: 0.9 },
  { path: "/rankings", changeFrequency: "monthly", priority: 0.8 },
  { path: "/revisions", changeFrequency: "yearly", priority: 0.8 },
  { path: "/data-sources", changeFrequency: "yearly", priority: 0.6 },
  { path: "/datasets", changeFrequency: "monthly", priority: 0.6 },
  { path: "/about", changeFrequency: "yearly", priority: 0.4 },
  { path: "/disclaimer", changeFrequency: "yearly", priority: 0.3 }
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const manifest = await getStaticManifest();
  const catalog=await getDatasetCatalog();
  return [
    ...catalog.filter(entry=>entry.purchasable).map(({product})=>({url:absoluteSiteUrl(`/datasets/${product.slug}`),changeFrequency:"yearly" as const,priority:0.5})),
    ...staticRoutes.map((route) => ({
      url: absoluteSiteUrl(route.path),
      changeFrequency: route.changeFrequency,
      priority: route.priority
    })),
    ...manifest.prefectureCodes.map((prefectureCode) => ({
      url: absoluteSiteUrl(`/map/${prefectureCode}`),
      changeFrequency: "yearly" as const,
      priority: 0.7
    })),
    ...manifest.rankingTypes.map((type) => ({
      url: absoluteSiteUrl(`/rankings/${type}`),
      changeFrequency: "yearly" as const,
      priority: 0.7
    })),
    ...manifest.municipalityCodes.map((municipalityCode) => ({
      url: absoluteSiteUrl(`/municipalities/${municipalityCode}`),
      changeFrequency: "yearly" as const,
      priority: 0.6
    }))
  ];
}
