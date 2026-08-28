import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/staticData", () => ({
  getStaticManifest: async () => ({
    municipalityCodes: ["151009", "152021"],
    prefectureCodes: ["15"],
    rankingTypes: ["expense-recovery-low", "fee-unit-high"]
  })
}));

import manifest from "@/app/manifest";
import { metadata as notFoundMetadata } from "@/app/not-found";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  absoluteAssetUrl,
  absoluteSiteUrl,
  createPageMetadata,
  defaultSiteOrigin,
  siteDescription
} from "@/lib/siteMetadata";

describe("publication metadata", () => {
  const expectedOrigin = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteOrigin
  ).origin;

  it("defaults to Cloudflare Pages and keeps canonical trailing slashes", () => {
    expect(defaultSiteOrigin).toBe("https://mierugesuido.pages.dev");
    expect(absoluteSiteUrl("/")).toBe(`${expectedOrigin}/`);
    expect(absoluteSiteUrl("/map")).toBe(`${expectedOrigin}/map/`);
    expect(absoluteAssetUrl("/sitemap.xml")).toBe(`${expectedOrigin}/sitemap.xml`);
  });

  it("builds complete canonical and social metadata for a page", () => {
    const metadata = createPageMetadata({
      title: "全国マップ",
      description: "全国の比較地図です。",
      path: "/map"
    });

    expect(metadata.alternates?.canonical).toBe("/map/");
    expect(metadata.openGraph).toMatchObject({
      locale: "ja_JP",
      title: "全国マップ | まる見え！全国の下水道使用料",
      url: "/map/"
    });
    expect(metadata.openGraph).toMatchObject({
      images: [expect.objectContaining({ alt: expect.any(String), type: "image/png" })]
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [expect.objectContaining({ alt: expect.any(String), type: "image/png" })]
    });
  });

  it("publishes an exact robots sitemap URL", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: `${expectedOrigin}/sitemap.xml`,
      host: expectedOrigin
    });
  });

  it("keeps not-found pages out of canonical and social sharing metadata", () => {
    expect(notFoundMetadata.alternates).toEqual({ canonical: null });
    expect(notFoundMetadata.openGraph).toBeNull();
    expect(notFoundMetadata.twitter).toBeNull();
    expect(notFoundMetadata.robots).toEqual({ index: false, follow: false });
  });

  it("provides installable and maskable manifest icons", () => {
    const value = manifest();
    expect(value.description).toBe(siteDescription);
    expect(value.start_url).toBe("/");
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" })
    ]));
  });

  it("lists stable routes and excludes query and retired ranking variants", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain(`${expectedOrigin}/`);
    expect(urls).toContain(`${expectedOrigin}/map/15/`);
    expect(urls).toContain(`${expectedOrigin}/municipalities/151009/`);
    expect(urls).toContain(`${expectedOrigin}/rankings/fee-unit-high/`);
    expect(urls.some((url) => url.includes("?"))).toBe(false);
    expect(urls.some((url) => url.includes("transfer-dependency"))).toBe(false);
  });
});
