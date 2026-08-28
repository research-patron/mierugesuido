import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const outRoot = path.join(projectRoot, "out");
const publicRoot = path.join(projectRoot, "public");
const manifest = readJson(path.join(projectRoot, "data/static/manifest.json"));
const siteOrigin = normalizeOrigin(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://mierugesuido.pages.dev"
);
const siteName = "まる見え！全国の下水道使用料";
const expectedSocialImage = `${siteOrigin}/opengraph-image.png`;

const staticRoutes = [
  "/",
  "/map",
  "/municipalities",
  "/rankings",
  "/revisions",
  "/data-sources",
  "/about",
  "/disclaimer"
];

const publicRoutes = [
  ...staticRoutes,
  ...manifest.prefectureCodes.map((code) => `/map/${code}`),
  ...manifest.rankingTypes.map((type) => `/rankings/${type}`),
  ...manifest.municipalityCodes.map((code) => `/municipalities/${code}`)
];
const expectedUrls = new Set(publicRoutes.map(absoluteRouteUrl));
const routeByTitle = new Map();
const routeByDescription = new Map();
const routeByCanonical = new Map();

for (const route of publicRoutes) {
  const html = readFileSync(routeOutputPath(route), "utf8");
  const head = extractHead(html, route);
  const expectedUrl = absoluteRouteUrl(route);
  const title = firstMatch(head, /<title>([^<]+)<\/title>/);
  const description = firstMatch(head, /<meta name="description" content="([^"]+)"/);
  const canonical = firstMatch(head, /<link rel="canonical" href="([^"]+)"/);
  const ogUrl = firstMatch(head, /<meta property="og:url" content="([^"]+)"/);
  const ogTitle = firstMatch(head, /<meta property="og:title" content="([^"]+)"/);
  const ogDescription = firstMatch(head, /<meta property="og:description" content="([^"]+)"/);
  const twitterTitle = firstMatch(head, /<meta name="twitter:title" content="([^"]+)"/);
  const twitterDescription = firstMatch(head, /<meta name="twitter:description" content="([^"]+)"/);

  assertNoThirdPartyRuntimeResources(html, route);
  assert(/<html lang="ja"/.test(html), `${route}: Japanese document language is missing`);
  assert(title?.includes(siteName), `${route}: title does not include the site name`);
  assert(description && description.length >= 30, `${route}: description is missing or too short`);
  assert(description.length <= 160, `${route}: description is longer than 160 characters`);
  assert(/[ぁ-んァ-ン一-龯]/.test(description), `${route}: Japanese description is missing`);
  assert(canonical === expectedUrl, `${route}: canonical URL mismatch (${canonical})`);
  assert(ogUrl === expectedUrl, `${route}: Open Graph URL mismatch (${ogUrl})`);
  assert(ogTitle === title, `${route}: Open Graph title does not match the page title`);
  assert(ogDescription === description, `${route}: Open Graph description does not match the page description`);
  assert(twitterTitle === title, `${route}: Twitter title does not match the page title`);
  assert(twitterDescription === description, `${route}: Twitter description does not match the page description`);
  assert(/<meta property="og:type" content="website"/.test(head), `${route}: Open Graph type mismatch`);
  assert(/<meta property="og:locale" content="ja_JP"/.test(head), `${route}: Open Graph locale mismatch`);
  assert(firstMatch(head, /<meta property="og:image" content="([^"]+)"/) === expectedSocialImage, `${route}: Open Graph image URL mismatch`);
  assert(firstMatch(head, /<meta name="twitter:image" content="([^"]+)"/) === expectedSocialImage, `${route}: Twitter image URL mismatch`);
  assert(/<meta name="twitter:card" content="summary_large_image"/.test(head), `${route}: Twitter card type mismatch`);
  assert(/<meta property="og:image:width" content="1200"/.test(head), `${route}: Open Graph image width mismatch`);
  assert(/<meta property="og:image:height" content="630"/.test(head), `${route}: Open Graph image height mismatch`);
  assert(/<meta property="og:image:type" content="image\/png"/.test(head), `${route}: Open Graph image type mismatch`);
  assert(/<meta name="twitter:image:width" content="1200"/.test(head), `${route}: Twitter image width mismatch`);
  assert(/<meta name="twitter:image:height" content="630"/.test(head), `${route}: Twitter image height mismatch`);
  assert(/<meta name="twitter:image:type" content="image\/png"/.test(head), `${route}: Twitter image type mismatch`);
  assertUnique(routeByTitle, title, route, "title");
  assertUnique(routeByDescription, description, route, "description");
  assertUnique(routeByCanonical, canonical, route, "canonical URL");
  assert(/<meta property="og:image:alt" content="[^"]+"/.test(head), `${route}: Open Graph image alt is missing`);
  assert(/<meta name="twitter:image:alt" content="[^"]+"/.test(head), `${route}: Twitter image alt is missing`);
  assert(/<link rel="manifest" href="\/manifest\.webmanifest"/.test(head), `${route}: manifest link is missing`);
  assert(/<link rel="icon"/.test(head), `${route}: icon link is missing`);
  assert(/<link rel="apple-touch-icon"/.test(head), `${route}: Apple touch icon link is missing`);
  assert(!/fonts\.(?:googleapis|gstatic)\.com/i.test(html), `${route}: external font request found`);
}

const notFoundHtml = readFileSync(path.join(outRoot, "404.html"), "utf8");
const notFoundHead = extractHead(notFoundHtml, "/404.html");
const notFoundRobots = [...notFoundHead.matchAll(/<meta name="robots" content="([^"]+)"/g)]
  .map((match) => match[1])
  .join(", ");
assert(notFoundHtml.includes("ページが見つかりません"), "404 page is not branded");
assert(notFoundRobots.includes("noindex"), "404 page is not noindex");
assert(notFoundRobots.includes("nofollow"), "404 page is not nofollow");
assert(!/<link rel="canonical"/.test(notFoundHead), "404 page must not publish a canonical URL");
assert(!/<meta property="og:/.test(notFoundHead), "404 page must not publish Open Graph metadata");
assert(!/<meta name="twitter:/.test(notFoundHead), "404 page must not publish Twitter metadata");

const robots = readFileSync(path.join(outRoot, "robots.txt"), "utf8");
assert(robots.includes("User-Agent: *\nAllow: /"), "robots.txt does not allow public crawling");
assert(robots.includes(`Host: ${siteOrigin}`), "robots.txt host mismatch");
assert(robots.includes(`Sitemap: ${siteOrigin}/sitemap.xml`), "robots.txt sitemap mismatch");

const sitemapXml = readFileSync(path.join(outRoot, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert(sitemapUrls.length === expectedUrls.size, "sitemap route count mismatch");
assert(new Set(sitemapUrls).size === sitemapUrls.length, "sitemap contains duplicate URLs");
assert(sitemapUrls.every((url) => expectedUrls.has(url)), "sitemap contains an unexpected URL");
assert([...expectedUrls].every((url) => sitemapUrls.includes(url)), "sitemap is missing a public URL");
assert(sitemapUrls.every((url) => !url.includes("?")), "sitemap must not contain query URLs");
assert(!/transfer-dependency|non-standard/i.test(sitemapXml), "sitemap contains a retired ranking route");

const webManifest = readJson(path.join(outRoot, "manifest.webmanifest"));
assert(webManifest.name === siteName, "web manifest name mismatch");
assert(webManifest.start_url === "/" && webManifest.scope === "/", "web manifest scope mismatch");
assert(webManifest.display === "standalone", "web manifest is not installable");
assert(webManifest.icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any"), "192px app icon is missing");
assert(webManifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"), "512px app icon is missing");
assert(webManifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"), "maskable app icon is missing");

assertPng(path.join(outRoot, "icon.png"), 512, 512);
assertPng(path.join(outRoot, "apple-icon.png"), 180, 180);
assertPng(path.join(outRoot, "opengraph-image.png"), 1200, 630);
assertPng(path.join(outRoot, "icons/icon-192.png"), 192, 192);
assertPng(path.join(outRoot, "icons/icon-512.png"), 512, 512);
assertPng(path.join(outRoot, "icons/icon-maskable-512.png"), 512, 512);
assertFavicon(path.join(outRoot, "favicon.ico"));

const sourceHeaders = readFileSync(path.join(publicRoot, "_headers"), "utf8");
const outputHeaders = readFileSync(path.join(outRoot, "_headers"), "utf8");
assert(outputHeaders === sourceHeaders, "Cloudflare _headers was not copied exactly");
for (const required of [
  "Content-Security-Policy: default-src 'self'",
  "Strict-Transport-Security: max-age=31536000",
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY"
]) {
  assert(outputHeaders.includes(required), `Cloudflare _headers is missing ${required}`);
}

for (const file of listFiles(path.join(outRoot, "_next/static"))) {
  if (!/\.(?:css|js)$/.test(file)) continue;
  const content = readFileSync(file, "utf8");
  assert(!/fonts\.(?:googleapis|gstatic)\.com/i.test(content), `${file}: external font request found`);
  if (file.endsWith(".css")) {
    assert(!/url\(\s*["']?https?:\/\//i.test(content), `${file}: third-party CSS asset request found`);
  }
}

process.stdout.write(
  `publication output verified: ${publicRoutes.length} routes, ${sitemapUrls.length} sitemap URLs, 6 PNG assets, favicon, 404, robots, manifest, headers\n`
);

function routeOutputPath(route) {
  return route === "/"
    ? path.join(outRoot, "index.html")
    : path.join(outRoot, route.slice(1), "index.html");
}

function absoluteRouteUrl(route) {
  return route === "/" ? `${siteOrigin}/` : `${siteOrigin}${route}/`;
}

function extractHead(html, label) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1];
  assert(head, `${label}: head element is missing`);
  return head;
}

function firstMatch(value, pattern) {
  return value.match(pattern)?.[1] ?? null;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function normalizeOrigin(value) {
  const url = new URL(value);
  assert(url.protocol === "https:", "NEXT_PUBLIC_SITE_URL must use https");
  return url.origin;
}

function assertPng(file, expectedWidth, expectedHeight) {
  const bytes = readFileSync(file);
  const signature = bytes.subarray(0, 8).toString("hex");
  assert(signature === "89504e470d0a1a0a", `${file}: invalid PNG signature`);
  assert(bytes.readUInt32BE(16) === expectedWidth, `${file}: PNG width mismatch`);
  assert(bytes.readUInt32BE(20) === expectedHeight, `${file}: PNG height mismatch`);
}

function assertFavicon(file) {
  const bytes = readFileSync(file);
  assert(bytes.readUInt16LE(0) === 0 && bytes.readUInt16LE(2) === 1, "favicon.ico: invalid ICO header");
  const count = bytes.readUInt16LE(4);
  const sizes = new Set();
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    const width = bytes[offset] || 256;
    const height = bytes[offset + 1] || 256;
    sizes.add(`${width}x${height}`);
  }
  for (const size of ["16x16", "32x32", "48x48"]) {
    assert(sizes.has(size), `favicon.ico: ${size} image is missing`);
  }
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
}

function assertNoThirdPartyRuntimeResources(html, route) {
  const resourceAttributes = [
    ...html.matchAll(/<(?:script|img|iframe|source)\b[^>]*\b(?:src|srcset)="([^"]+)"/gi)
  ].map((match) => match[1]);

  for (const value of resourceAttributes) {
    for (const match of value.matchAll(/https?:\/\/[^\s,]+/gi)) {
      assert(new URL(match[0]).origin === siteOrigin, `${route}: third-party runtime resource found`);
    }
  }

  for (const match of html.matchAll(/<link\b([^>]+)>/gi)) {
    const attributes = match[1];
    const rel = firstMatch(attributes, /\brel="([^"]+)"/i);
    const href = firstMatch(attributes, /\bhref="([^"]+)"/i);
    if (!rel || !href || !/^(?:https?:)?\/\//i.test(href)) continue;
    if (!/(?:^|\s)(?:stylesheet|preload|modulepreload|icon|apple-touch-icon|manifest)(?:\s|$)/i.test(rel)) continue;
    assert(new URL(href, siteOrigin).origin === siteOrigin, `${route}: third-party runtime link found`);
  }
}

function assertUnique(index, value, route, label) {
  const previousRoute = index.get(value);
  assert(!previousRoute, `${route}: duplicate ${label} also used by ${previousRoute}`);
  index.set(value, route);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
