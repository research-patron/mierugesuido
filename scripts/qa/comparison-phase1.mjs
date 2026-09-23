import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.COMPARISON_BASE_URL || "http://127.0.0.1:3199";
const output = process.env.COMPARISON_QA_OUTPUT || "artifacts/comparison-phase1";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.COMPARISON_BROWSER_CHANNEL || "chrome" });
const results = [];
const pageErrors = [];
const settle = async page => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(350); };
async function check(name, action) {
  try { await action(); results.push({ name, passed: true }); console.log("PASS", name); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.error("FAIL", name, error.message); }
  await fs.writeFile(path.join(output, "results.json"), JSON.stringify({ browser: browser.version(), results, pageErrors }, null, 2));
}
try {
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  await check("initial HTML without JavaScript", async () => {
    const page = await noJs.newPage();
    for (const [url, markers] of [
      ["/", ["自分のまちの下水道使用料を調べる", "1,168", "2024"]],
      ["/municipalities/", ["札幌市", "経費回収率", "2024年度決算"]],
      ["/municipalities/011002/", ["札幌市", "1,397円", "R6", "第33表"]],
      ["/rankings/expense-recovery-low/", ["3,470", "2024年度決算", "自動チェック", "出典"]],
      ["/revisions/", ["使用料施行年月日の変更一覧", "109", "138", "R5"]],
      ["/data-sources/", ["カタログ年", "取得記録", "検証・公開反映", "2024"]]
    ]) {
      const response = await page.goto(base + url);
      assert.equal(response.status(), 200);
      assert.equal(await page.locator("head title").count(), 1);
      assert.equal(await page.locator('head link[rel="canonical"]').count(), 1);
      const text = await page.locator("body").innerText();
      for (const marker of markers) assert(text.includes(marker), `${url}: ${marker}`);
      assert(await page.locator('a[href="/data-sources/"]').count() > 0 || url.includes("data-sources"));
    }
    await page.close();
  });
  await noJs.close();

  for (const width of [1491, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1491 ? 1055 : 844 }, hasTouch: width === 390 });
    page.on("pageerror", error => pageErrors.push(error.message));
    await check(`screens and overflow ${width}`, async () => {
      for (const [name, url] of [["home", "/"], ["search", "/municipalities/"], ["detail", "/municipalities/151009/"], ["ranking", "/rankings/expense-recovery-low/"], ["tokyo", "/map/13/?businessType=17%2F1&fiscalYear=2024"], ["sources", "/data-sources/"]]) {
        await page.goto(base + url); await settle(page);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: horizontal overflow`);
        await page.screenshot({ path: path.join(output, `${name}-${width}.png`) });
      }
    });
    await check(`scope navigation, reload and back ${width}`, async () => {
      await page.goto(base + "/"); await settle(page);
      const control = page.getByRole("radio", { name: "特定環境保全公共下水道", exact: true });
      if (width === 390) await control.tap(); else await control.click();
      await page.waitForURL(/businessType=17%2F4/);
      const more = page.locator(".home-ranking-panel").getByRole("link", { name: "もっと見る →" });
      await more.click(); await page.waitForURL(/rankings\/expense-recovery-low/); await settle(page);
      assert.equal(new URL(page.url()).searchParams.get("businessType"), "17/4");
      assert.equal(new URL(page.url()).searchParams.get("fiscalYear"), "2024");
      assert((await page.getByLabel("ランキングの比較条件").innerText()).includes("714 自治体"));
      await page.getByRole("link", { name: "同じ年度・事業条件で自治体を探す" }).click(); await settle(page);
      assert((await page.locator(".search-summary-panel").innerText()).includes("714"));
      await page.reload(); await settle(page);
      assert.equal(new URL(page.url()).searchParams.get("businessType"), "17/4");
      await page.goBack(); await settle(page);
      assert(page.url().includes("expense-recovery-low"));
    });
    await check(`direct business URL and intentional switch ${width}`, async () => {
      await page.goto(base + "/municipalities/151009/?business=17-4-000&view=finance&fiscalYear=2024&businessType=17%2F4");
      await settle(page);
      const select = page.getByLabel("選択中の決算事業");
      assert.equal(await select.inputValue(), "17-4-000");
      const canonical = new URL(await page.locator('link[rel="canonical"]').getAttribute("href"));
      assert.equal(canonical.searchParams.get("business"), "17-4-000");
      assert.equal(canonical.searchParams.get("fiscalYear"), "2024");
      assert.equal(await page.locator("head title").count(), 1);
      assert((await page.title()).includes("特定環境保全公共下水道"));
      await select.selectOption("17-1-000"); await settle(page);
      assert.equal(new URL(page.url()).searchParams.get("view"), "finance");
      assert.equal(new URL(page.url()).searchParams.get("businessType"), "17/1");
      assert.equal(new URL(page.url()).searchParams.get("fiscalYear"), "2024");
      await page.goBack(); await settle(page);
      assert.equal(await select.inputValue(), "17-4-000");
    });
    await check(`empty and absent year ${width}`, async () => {
      await page.goto(base + "/municipalities/?q=存在しない自治体XYZ&fiscalYear=2024"); await settle(page);
      assert((await page.locator("body").innerText()).includes("条件に一致する自治体がありません"));
      await page.goto(base + "/municipalities/151009/?fiscalYear=2099"); await settle(page);
      const text = await page.locator("body").innerText();
      assert(text.includes("過年度では補完していません"));
      assert(!text.includes("3,047円"));
    });
    await page.close();
  }

  const page = await browser.newPage();
  page.on("pageerror", error => pageErrors.push(error.message));
  await check("keyboard map to prefecture keeps business and accounting", async () => {
    await page.goto(base + "/?businessType=17%2F4&accountingType=legal_applied&fiscalYear=2024");
    const tokyo = page.locator('[data-map-region-code="13"]').first();
    await tokyo.waitFor(); await tokyo.focus(); await tokyo.press("Enter");
    await page.waitForURL(/map\/13/); await settle(page);
    const params = new URL(page.url()).searchParams;
    assert.equal(params.get("businessType"), "17/4");
    assert.equal(params.get("accountingType"), "legal_applied");
    assert.equal(params.get("fiscalYear"), "2024");
    assert((await page.locator("body").innerText()).includes("特定環境保全公共下水道"));
  });
  await check("peer failure and retry", async () => {
    await page.route("**/data/static/citizen-peers/**", route => route.fulfill({ status: 503, body: "unavailable" }));
    await page.goto(base + "/municipalities/151009/");
    await page.getByRole("alert").filter({ hasText: "県内比較データ" }).waitFor();
    assert((await page.locator("body").innerText()).includes("3,047円"));
    await page.unroute("**/data/static/citizen-peers/**");
    await page.getByRole("button", { name: "再試行", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "県内比較データ" }).waitFor({ state: "hidden" });
    await page.getByText(/県内中央値/).first().waitFor();
  });
  await check("suggestion failure, retry and keyboard Japanese input", async () => {
    await page.route("**/data/static/search-index.json", route => route.fulfill({ status: 503, body: "unavailable" }));
    await page.goto(base + "/");
    const input = page.getByRole("textbox", { name: "自治体名を検索" });
    await input.focus(); await page.keyboard.insertText("新潟");
    await page.getByRole("alert").filter({ hasText: "検索候補" }).waitFor();
    await page.unroute("**/data/static/search-index.json");
    await page.getByRole("button", { name: "再試行", exact: true }).click();
    await input.focus();
    await page.locator(".search-suggestions").getByRole("link", { name: /新潟市/ }).waitFor();
    await input.press("Enter"); await page.waitForURL(/municipalities\/?\?q=/); await settle(page);
    assert((await page.locator("body").innerText()).includes("新潟市"));
  });
  await check("official data failure and retry", async () => {
    await page.route("**/data/static/yearbook/151009.json", route => route.fulfill({ status: 503, body: "unavailable" }));
    await page.goto(base + "/municipalities/151009/?view=yearbook&business=17-1-000");
    await page.getByRole("alert").filter({ hasText: "個表" }).waitFor();
    await page.unroute("**/data/static/yearbook/151009.json");
    await page.getByRole("button", { name: "再試行", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "個表" }).waitFor({ state: "hidden" });
    await settle(page);
    assert(!(await page.locator("body").innerText()).includes("抜粋を読み込んでいます"));
  });
  await check("map failure, retry and available free search", async () => {
    await page.route("**/gis/mlit-n03-simplified.json", route => route.fulfill({ status: 503, body: "unavailable" }));
    await page.goto(base + "/");
    await page.getByRole("alert").filter({ hasText: "地図を読み込めません" }).waitFor();
    assert(await page.getByRole("textbox", { name: "自治体名を検索" }).isVisible());
    await page.unroute("**/gis/mlit-n03-simplified.json");
    await page.getByRole("button", { name: "再試行", exact: true }).click();
    await page.locator(".gis-map-surface svg").first().waitFor();
  });
  await page.close();
  await check("no runtime errors", async () => assert.deepEqual(pageErrors, []));
} finally { await browser.close(); }
if (results.some(result => !result.passed)) process.exitCode = 1;
