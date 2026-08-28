import type { MetadataRoute } from "next";
import { absoluteAssetUrl, siteOrigin } from "@/lib/siteMetadata";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    sitemap: absoluteAssetUrl("/sitemap.xml"),
    host: siteOrigin
  };
}
