import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, firefox, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.MAP_BROWSER || 'chromium';
const base = process.env.MAP_BASE_URL || 'http://127.0.0.1:3123';
const output = process.env.MAP_QA_OUTPUT || 'artifacts/map-p0';
await fs.mkdir(output, { recursive: true });
const browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true, ...(engine === 'chromium' && process.env.MAP_BROWSER_CHANNEL ? { channel: process.env.MAP_BROWSER_CHANNEL } : {}) });
const results = [{ name: "environment", passed: true, engine, browserVersion: browser.version(), platform: process.platform, realHardware: false }];
const failures = [];
const surface = page => page.locator('[data-map-zoom]');
const finder = page => page.getByLabel('自治体名から地図上の位置を探す', { exact: true });
async function settle(page) {
  await page.locator('[data-municipality-region]').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await surface(page).scrollIntoViewIfNeeded();
}
async function checkpoint(name, work) {
  try { const details = await work(); results.push({ name, passed: true, ...details }); console.log('PASS', name); }
  catch (error) { failures.push(name); results.push({ name, passed: false, error: error.stack }); console.error('FAIL', name, error.message);
    const lastPage = browser.contexts().at(-1)?.pages().at(-1);
    if (lastPage) { results.at(-1).url = lastPage.url(); await lastPage.screenshot({ path: path.join(output, `failure-${name.replace(/[^a-z0-9]/gi, '-')}.png`) }).catch(() => {}); } }
  await fs.writeFile(path.join(output, `results-${engine}.json`), JSON.stringify(results, null, 2));
}
// Inspect the displayed polygon and actual hit-test stack. Never use bbox
// centers without checking fill, force clicks, JS click(), or dispatchEvent().
async function pointInside(page, code, attempt = 0) {
  if (attempt === 0) await surface(page).scrollIntoViewIfNeeded();
  else await page.locator(`[data-municipality-region="${code}"] path`).scrollIntoViewIfNeeded();
  const point = await page.locator(`[data-municipality-region="${code}"] path`).evaluate(el => {
    const matrix = el.getScreenCTM();
    if (!matrix) return null;
    const inverse = matrix.inverse();
    const r = el.getBoundingClientRect(), clip = el.ownerSVGElement.getBoundingClientRect();
    const left = Math.max(r.left, clip.left + 2, 1), right = Math.min(r.right, clip.right - 2, innerWidth - 1);
    const top = Math.max(r.top, clip.top + 2, 78), bottom = Math.min(r.bottom, clip.bottom - 2, innerHeight - 1);
    const step = Math.max(1, Math.min(right - left, bottom - top) / 24);
    const candidates = [];
    for (let y = top + step / 2; y < bottom; y += step) for (let x = left + step / 2; x < right; x += step) {
      const local = new DOMPoint(x, y).matrixTransform(inverse);
      if (!el.isPointInFill(local) || document.elementFromPoint(x, y) !== el) continue;
      let clearance = 0;
      for (const radius of [1, 2, 4, 8, 12]) {
        if ([[radius, 0], [-radius, 0], [0, radius], [0, -radius]].every(([dx, dy]) => el.isPointInFill(new DOMPoint(x + dx, y + dy).matrixTransform(inverse)))) clearance = radius;
        else break;
      }
      candidates.push({ x, y, clearance });
    }
    return candidates.sort((a, b) => b.clearance - a.clearance)[0] ?? null;
  });
  if (!point && attempt === 0) return pointInside(page, code, 1);
  assert(point, `No visible, unobstructed fill point for ${code}`);
  return point;
}
async function activate(page, code, touch = false) {
  const p = await pointInside(page, code);
  if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
  return p;
}
async function verifyDetail(page, code, touch) {
  const data = JSON.parse(await fs.readFile(`data/static/prefectures/${code.slice(0, 2)}.json`, 'utf8'));
  const m = data.municipalities.find(m => m.municipalityCode?.slice(0, 5) === code);
  assert(m, `No verified business for fixture ${code}`);
  const needsConfirmation = await surface(page).getAttribute('data-tap-confirmation') === 'true';
  const point = await activate(page, code, touch);
  if (needsConfirmation) {
    const selected = page.locator('[aria-live="polite"][aria-atomic="true"]');
    await selected.waitFor();
    assert((await selected.innerText()).includes(m.municipalityName), `Selected mismatch ${m.municipalityName}: ${await selected.innerText()}`);
    await selected.getByRole('link').click();
  }
  await page.waitForFunction(pathname => location.pathname === pathname, `/municipalities/${m.municipalityCode}/`);
  assert.equal(new URL(page.url()).searchParams.get('business'), m.businessKey);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.getByRole('heading', { level: 1 }).filter({ hasText: m.municipalityName }).waitFor();
  return { municipality: m.municipalityName, business: m.businessKey, point };
}
async function reset(page) { await page.getByRole('button', { name: '表示中の地域に合わせる', exact: true }).click(); await settle(page); }
async function shapeSizes(page) {
  return page.locator('[data-map-zoom]').evaluate(el => {
    const s = el.querySelector('svg');
    return { viewBox: s.getAttribute('viewBox'), features: ['13201', '13202', '13219'].map(code => {
      const p = el.querySelector(`[data-municipality-region="${code}"] path`), r = p?.getBoundingClientRect();
      return { code, width: r?.width ?? 0, height: r?.height ?? 0 };
    }) };
  });
}
try {
  for (const width of (process.env.MAP_PHASE && process.env.MAP_PHASE !== 'tokyo' ? [] : [1491, 390, 360, 768])) {
    const touch = width < 768;
    const page = await browser.newPage({ viewport: { width, height: width === 1491 ? 1055 : width === 768 ? 1024 : 844 }, hasTouch: touch });
    await checkpoint(`Tokyo initial usable scale ${width}`, async () => {
      await page.goto(`${base}/map/13/`); await settle(page);
      const sizes = await shapeSizes(page);
      await page.screenshot({ path: path.join(output, `after-tokyo-${width}.png`) });
      assert(sizes.features[0].width >= (width < 768 ? 60 : 150), `Hachioji too small: ${sizes.features[0].width}px`);
      assert(sizes.features[1].width >= (width < 768 ? 22 : 55), `Tachikawa too small: ${sizes.features[1].width}px`);
      assert(await pointInside(page, '13219'));
      return sizes;
    });
    if (process.env.MAP_REGRESSION_ONLY === '1') { await page.close(); continue; }
    for (const code of ['13201', '13202', '13219']) await checkpoint(`Tokyo shape to matching business ${width} ${code}`, async () => {
      await page.goto(`${base}/map/13/`); await settle(page); return verifyDetail(page, code, touch);
    });
    await checkpoint(`Tokyo four entry routes ${width}`, async () => {
      await page.goto(`${base}/map/`);
      // National SVG itself is navigated by real pointer input (not its list).
      const target = page.locator('svg [data-map-region-code="13"] path').first();
      await target.click();
      if (width < 768) await page.getByRole('region', { name: '都道府県の選択確認' }).getByRole('link').click();
      await page.waitForURL('**/map/13/'); await settle(page);
      const states = [await shapeSizes(page)];
      await page.reload(); await settle(page); states.push(await shapeSizes(page));
      await page.getByRole('link', { name: '都道府県を変更', exact: true }).click(); await page.waitForURL('**/map/');
      await page.goBack(); await page.waitForURL('**/map/13/'); await settle(page); states.push(await shapeSizes(page));
      assert(states.every(s => s.features[0].width >= (width < 768 ? 60 : 150)));
      return { states };
    });
    await checkpoint(`Tokyo islands and unchanged statistics CSV ${width}`, async () => {
      await page.goto(`${base}/map/13/`); await settle(page);
      const kpi = await page.locator('.map-page-kpi-grid').innerText();
      const table = await page.locator('table').innerText();
      const csv = page.getByRole('link', { name: /CSVでダウンロード/ }); const href = await csv.getAttribute('href');
      const content = await (await page.request.get(base + href)).body();
      const codes = await page.locator('[data-island-municipality]').evaluateAll(es => es.map(e => e.dataset.islandMunicipality));
      assert.equal(codes.length, 9); assert.equal(new Set(codes).size, 9);
      assert.equal(await page.getByRole('button', { name: '都道府県全域', exact: true }).count(), 0);
      assert.equal(await page.locator('[data-island-municipality] button').count(), 0);
      const finderCodes = await finder(page).locator('option').evaluateAll(es => es.map(e => e.value));
      for (const code of codes) {
        assert(!finderCodes.includes(code));
        assert.equal(await page.locator(`[data-municipality-region="${code}"]`).count(), 0);
      }
      await page.getByRole('button', { name: '拡大', exact: true }).click(); await reset(page);
      assert.equal(await page.locator('.map-page-kpi-grid').innerText(), kpi);
      assert.equal(await page.locator('table').innerText(), table);
      assert.equal(await csv.getAttribute('href'), href);
      assert.deepEqual(await (await page.request.get(base + href)).body(), content);
      await page.getByRole('region', { name: /離島の市町村/ }).screenshot({ path: path.join(output, `after-islands-${width}.png`) });
      const link = page.locator('[data-island-municipality="13363"] a');
      if (touch) await link.tap(); else await link.click();
      await page.waitForURL('**/municipalities/133639/**');
      assert.equal(new URL(page.url()).searchParams.get('business'), '17-4-000');
      return { islands: codes.length, csvBytes: content.length };
    });
    await checkpoint(`Tokyo missing data and keyboard island selection ${width}`, async () => {
      await page.goto(`${base}/map/13/`); await settle(page);
      await activate(page, '13101', touch);
      await page.getByText('この地域の独立した事業データは未収録です。').waitFor();
      assert(new URL(page.url()).pathname === '/map/13/');
      const codes = await finder(page).locator('option').evaluateAll(es => es.map(e => e.value));
      await finder(page).focus(); await page.keyboard.press('Home');
      for (let i = 0; i < codes.indexOf('13202'); i++) await page.keyboard.press('ArrowDown');
      assert.equal(await finder(page).inputValue(), '13202');
      assert.equal(await surface(page).getAttribute('data-map-region'), 'main');
      await page.locator('[data-island-municipality="13363"] a').focus(); await page.keyboard.press('Enter');
      await page.waitForURL('**/municipalities/133639/**');
    });
    await page.close();
  }
  if (process.env.MAP_REGRESSION_ONLY !== '1') {
    for (const width of (!process.env.MAP_PHASE || process.env.MAP_PHASE === 'focus' ? [1491, 390] : [])) {
      const touch = width < 768;
      const page = await browser.newPage({ viewport: { width, height: touch ? 844 : 1055 }, hasTouch: touch });
      for (const [pref, main, island] of [['13','13201','13363'],['46','46201','46222'],['47','47201','47207'],['42','42201','42209'],['15','15100','15224'],['32','32201','32528'],['01','01202','01517'],['11','11201',null],['20','20201',null]].filter(([code]) => !process.env.MAP_PREFECTURES || process.env.MAP_PREFECTURES.split(',').includes(code))) {
        await checkpoint(`focus operations ${pref} ${width}`, async () => {
          await page.setViewportSize({ width, height: touch ? 844 : 1055 });
          await page.goto(`${base}/map/${pref}/`); await settle(page);
          await page.screenshot({ path: path.join(output, `prefecture-${pref}-${width}.png`) });
          const entry = await verifyDetail(page, main, touch);
          await page.goto(`${base}/map/${pref}/`); await settle(page);
          await page.getByRole('button', { name: '拡大', exact: true }).click();
          await page.getByRole('button', { name: '拡大', exact: true }).click();
          await settle(page);
          const start = await surface(page).locator(':scope > svg').getAttribute('viewBox');
          const rect = await surface(page).boundingBox(); const x = rect.x + rect.width / 2, y = Math.min(rect.y + rect.height / 2, 650);
          if (touch && engine === 'chromium') {
            const cdp = await page.context().newCDPSession(page);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 5, y: y + i * 3 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
          } else { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 30, y + 18, { steps: 6 }); await page.mouse.up(); }
          assert.equal(new URL(page.url()).pathname, `/map/${pref}/`);
          assert.notEqual(await surface(page).locator(':scope > svg').getAttribute('viewBox'), start);
          // Verify coordinates at the actual zoomed/panned state, choosing an
          // available visible polygon instead of forcing an offscreen fixture.
          const codes = await page.locator('[data-municipality-region]').evaluateAll(es => es.map(e => e.dataset.municipalityRegion));
          let visibleCode;
          const data = JSON.parse(await fs.readFile(`data/static/prefectures/${pref}.json`, 'utf8'));
          for (const code of codes) {
            if (!data.municipalities.some(m => m.municipalityCode?.slice(0, 5) === code)) continue;
            try { await pointInside(page, code); visibleCode = code; break; } catch {}
          }
          assert(visibleCode); const afterPan = await verifyDetail(page, visibleCode, touch);
          await page.goto(`${base}/map/${pref}/`); await settle(page);
          await page.getByRole('button', { name: '拡大', exact: true }).click();
          await page.getByRole('button', { name: '縮小', exact: true }).click();
          await reset(page); assert.equal(await surface(page).getAttribute('data-map-zoom'), '1.00');
          await page.setViewportSize({ width: touch ? 844 : 768, height: touch ? 390 : 1024 }); await settle(page); await reset(page);
          assert(await pointInside(page, main));
          await verifyDetail(page, main, touch);
          await page.goto(`${base}/map/${pref}/`); await settle(page);
          await page.setViewportSize({ width, height: touch ? 844 : 1055 }); await settle(page);
          await verifyDetail(page, main, touch);
          return { entry, afterPan, island, touchDrag: touch && engine === 'chromium' };
        });
        if (island) await checkpoint(`island list direct access ${pref} ${width}`, async () => {
          await page.setViewportSize({ width, height: touch ? 844 : 1055 });
          await page.goto(`${base}/map/${pref}/`); await settle(page);
          const items = page.locator('[data-island-municipality]');
          const expected = { '01': 4, '13': 9, '15': 2, '32': 4, '42': 5, '46': 18, '47': 14 }[pref];
          assert.equal(await items.count(), expected);
          const codes = await items.evaluateAll(es => es.map(e => e.dataset.islandMunicipality));
          assert.equal(new Set(codes).size, expected);
          for (let i = 0; i < expected; i++) assert(await items.nth(i).isVisible());
          assert.equal(await page.getByLabel('地図の表示地域', { exact: true }).count(), 0);
          assert.equal(await page.getByRole('button', { name: '都道府県全域', exact: true }).count(), 0);
          assert.equal(await items.locator('button').count(), 0);
          for (const code of codes) assert.equal(await page.locator(`[data-municipality-region="${code}"]`).count(), 0);
          const data = JSON.parse(await fs.readFile(`data/static/prefectures/${pref}.json`, 'utf8'));
          const municipality = data.municipalities.find(m => m.municipalityCode?.slice(0, 5) === island);
          const link = page.locator(`[data-island-municipality="${island}"] a`);
          if (touch) await link.tap(); else { await link.focus(); await page.keyboard.press('Enter'); }
          await page.waitForFunction(code => location.pathname === `/municipalities/${code}/`, municipality.municipalityCode);
          assert.equal(new URL(page.url()).searchParams.get('business'), municipality.businessKey);
          await page.getByRole('heading', { level: 1 }).filter({ hasText: municipality.municipalityName }).waitFor();
          return { count: expected, municipality: municipality.municipalityName, input: touch ? 'tap' : 'keyboard' };
        });
      }
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: Number(process.env.MAP_RENDER_WIDTH || 390), height: process.env.MAP_RENDER_WIDTH === '1491' ? 1055 : 844 } });
    for (let i = 1; i <= (!process.env.MAP_PHASE || process.env.MAP_PHASE === "render" ? 47 : 0); i++) {
      const code = String(i).padStart(2, '0');
      await checkpoint(`47-prefecture render ${code}`, async () => {
        await page.goto(`${base}/map/${code}/`); await settle(page);
        const result = await surface(page).evaluate(el => {
          const svg = el.querySelector('svg'), r = svg.getBoundingClientRect();
          const paths = [...el.querySelectorAll('[data-municipality-region] path')];
          const boxes = paths.map(p => p.getBoundingClientRect());
          return { viewBox: svg.getAttribute('viewBox'), paths: paths.length, largestWidth: Math.max(...boxes.map(b => b.width)), largestHeight: Math.max(...boxes.map(b => b.height)), visiblePaths: boxes.filter(b => b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom && b.width > 0 && b.height > 0).length, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert(result.visiblePaths > 0); assert(!result.overflow); assert(!/NaN|Infinity/.test(result.viewBox));
        assert(Math.max(result.largestWidth, result.largestHeight) > 30, 'Main geography extremely small');
        return result;
      });
    }
    await checkpoint('GIS load failure retains municipality route', async () => {
      await page.route('**/gis/municipalities/13.json', route => route.abort());
      await page.goto(`${base}/map/13/`); await page.getByText('地図を読み込めませんでした').waitFor();
      assert(await page.locator('table a[href*="/municipalities/"]').count() > 0);
    });
    await page.unroute('**/gis/municipalities/13.json');
    await checkpoint('GIS empty data retains municipality route', async () => {
      await page.route('**/gis/municipalities/13.json', route => route.fulfill({ json: { prefectureCode: '13', features: [], viewBox: { width: 1000, height: 760 } } }));
      await page.goto(`${base}/map/13/`); await page.getByText('地図を読み込めませんでした').waitFor();
      assert(await page.locator('table a[href*="/municipalities/"]').count() > 0);
    });
    await page.unroute('**/gis/municipalities/13.json');
    await checkpoint('Hidden surface and browser tab restore', async () => {
      await page.goto(`${base}/map/13/`); await settle(page);
      await surface(page).evaluate(el => { el.style.display = 'none'; });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await surface(page).evaluate(el => { el.style.removeProperty('display'); });
      const other = await browser.newPage(); await other.goto('about:blank'); await other.bringToFront();
      await page.bringToFront(); await other.close(); await settle(page);
      await verifyDetail(page, '13201', false);
    });
    await page.close();
  }
} finally { await browser.close(); }
assert.equal(failures.length, 0, failures.join('\n'));
