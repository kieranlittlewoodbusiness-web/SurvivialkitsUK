#!/usr/bin/env node
/**
 * WEB-ADS-1..3 browser check against a local build made with DUMMY IDs, e.g.
 *   SITE_ENV=production AMAZON_ASSOCIATES_UK_TAG=verifydist-21 PUBLIC_GA4_ID=G-TEST000000 \
 *   PUBLIC_GOOGLE_ADS_ID=AW-000000000 PUBLIC_META_PIXEL_ID=000000000000000 npx astro build --outDir /tmp/e2e-dist
 *   node tests/e2e/consent.e2e.mjs --dist /tmp/e2e-dist [--browser chromium|webkit] [--shots DIR]
 * SITE_ENV=production is required: without it tracking stays off and the banner check fails.
 * Every request to a Google/Meta tag host (and to Amazon) is intercepted and aborted, so nothing
 * leaves the machine. Logs never print affiliate URLs or the tag. Exit code 1 on any failed check.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const DIST = path.resolve(opt('--dist', 'dist'));
const BROWSER = opt('--browser', 'chromium');
const SHOTS = opt('--shots', '');
const PAGE = '/compare/72-hour-emergency-kits/';
const BLOCK = /(^|\.)(googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net|facebook\.net|facebook\.com)$/;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://localhost:${server.address().port}`;

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} [${BROWSER}] ${name}${detail ? ` (${detail})` : ''}`); };
const engine = BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch();

async function fresh(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport });
  const hits = [];
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (BLOCK.test(u.hostname)) { hits.push(u.hostname + u.pathname); return route.abort(); }
    if (/(^|\.)amazon\./.test(u.hostname)) return route.fulfill({ status: 204 }); // 204: the browser stays on the page, nothing leaves the box
    if (u.origin !== ORIGIN) return route.abort();
    return route.continue();
  });
  const page = await ctx.newPage();
  const trackCookies = async () => (await ctx.cookies()).filter((c) => /^(_ga|_gcl|_fbp|_fbc)/.test(c.name)).map((c) => c.name);
  return { ctx, page, hits, trackCookies };
}
const dl = (page) => page.evaluate(() => (window.dataLayer || []).map((a) => Array.from(a)));
const clicks = async (page) => (await dl(page)).filter((e) => e[0] === 'event' && e[1] === 'affiliate_click');

try {
  // 1. Before interaction.
  {
    const { ctx, page, hits, trackCookies } = await fresh();
    await page.goto(ORIGIN + PAGE, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    check('banner visible on first visit', await page.locator('#uksk-consent').isVisible());
    check('zero tag requests before interaction', hits.length === 0, `${hits.length}`);
    check('no _ga/_gcl/_fbp cookies before interaction', (await trackCookies()).length === 0);
    const first = (await dl(page))[0];
    check('first dataLayer entry is consent default, all denied', JSON.stringify(first) === JSON.stringify(['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500 }]));
    check('page still scrollable/readable with banner (no wall)', await page.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden' && !document.querySelector('[inert]')));

    // keyboard: reach the banner from the top of the page
    let reached = -1;
    for (let i = 1; i <= 6; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.getAttribute('data-consent') === 'accept')) { reached = i; break; }
    }
    check('Accept all reachable by keyboard from page start', reached > 0, `Tab x${reached}`);
    await page.keyboard.press('Tab'); // Reject all
    const onReject = await page.evaluate(() => document.activeElement?.getAttribute('data-consent'));
    await page.keyboard.press('Tab'); // Manage
    await page.keyboard.press('Enter');
    check('Manage opens with keyboard (aria-expanded=true)', onReject === 'reject' && (await page.getAttribute('[data-consent="manage"]', 'aria-expanded')) === 'true');
    check('toggles not pre-ticked', !(await page.isChecked('input[name="analytics"]')) && !(await page.isChecked('input[name="advertising"]')));

    // axe with the banner and Manage panel open
    const axeBanner = await new AxeBuilder({ page }).include('#uksk-consent').analyze();
    const axePage = await new AxeBuilder({ page }).analyze();
    const serious = (r) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check('axe: banner 0 serious/critical', serious(axeBanner).length === 0, serious(axeBanner).map((v) => v.id).join(',') || 'none');
    check('axe: full page (banner open) 0 serious/critical', serious(axePage).length === 0, serious(axePage).map((v) => `${v.id}x${v.nodes.length}`).join(',') || 'none');
    console.log(`INFO [${BROWSER}] axe full page all violations: ${axePage.violations.map((v) => `${v.id}(${v.impact})x${v.nodes.length}`).join(', ') || 'none'}`);
    await ctx.close();
  }

  // 2. Reject all (keyboard).
  {
    const { ctx, page, hits, trackCookies } = await fresh();
    await page.goto(ORIGIN + PAGE);
    await page.focus('[data-consent="reject"]');
    await page.keyboard.press('Enter');
    check('after Reject all by keyboard: focus moves to #main, not <body>', (await page.evaluate(() => document.activeElement?.id)) === 'main');
    await page.waitForTimeout(800);
    const a = page.locator('a[rel~="sponsored"]').first();
    await a.click({ noWaitAfter: true }).catch(() => {});
    await page.waitForTimeout(300);
    check('after Reject all: banner hidden', !(await page.locator('#uksk-consent').isVisible()));
    check('after Reject all: zero tag requests', hits.length === 0, `${hits.length}`);
    check('after Reject all: no tracking cookies', (await trackCookies()).length === 0);
    await page.reload();
    await page.waitForTimeout(500);
    check('after Reject all + reload: banner stays hidden, still zero requests', !(await page.locator('#uksk-consent').isVisible()) && hits.length === 0);
    await ctx.close();
  }

  // 3. Accept all, affiliate_click, withdrawal.
  {
    const { ctx, page, hits } = await fresh();
    await page.goto(ORIGIN + PAGE);
    await page.click('[data-consent="accept"]');
    await page.waitForTimeout(800);
    check('after Accept all: gtag.js requested', hits.some((h) => h.includes('googletagmanager.com/gtag/js')));
    check('after Accept all: fbevents.js requested', hits.some((h) => h.includes('facebook.net') && h.includes('fbevents')));
    const href = await page.evaluate(() => location.href);
    const link = page.locator('.pcard a[rel~="sponsored"]').first();
    await link.click({ noWaitAfter: true });
    await page.waitForTimeout(300);
    let ev = await clicks(page);
    check('affiliate click does not leave the page (204 stub)', page.url() === href);
    check('left click: one affiliate_click', ev.length === 1);
    const p = ev[0]?.[2] ?? {};
    check('payload has link_domain/asin/product_category/placement/page_path + beacon',
      p.link_domain === 'www.amazon.co.uk' && /^[A-Z0-9]{10}$/.test(p.asin) && !!p.product_category && p.placement === 'card' && p.page_path === PAGE && p.transport_type === 'beacon',
      `domain=${p.link_domain} asin=${p.asin ? 'ok' : 'missing'} cat=${p.product_category} placement=${p.placement} path=${p.page_path}`);
    const fbAc = await page.evaluate(() => (window.fbq?.queue || []).map((a) => Array.from(a)).filter((e) => e[1] === 'AffiliateClick').length);
    check('Pixel AffiliateClick queued once', fbAc === 1);
    // middle click and Enter
    await link.click({ button: 'middle', noWaitAfter: true }).catch(() => {});
    await page.waitForTimeout(300);
    for (const pg of ctx.pages()) if (pg !== page) await pg.close();
    ev = await clicks(page);
    check('middle click (auxclick): exactly one more', ev.length === 2, `${ev.length}`);
    await link.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    ev = await clicks(page);
    check('keyboard Enter: exactly one more', ev.length === 3, `${ev.length}`);

    // withdrawal (CR M2): denied update + cookie deletion, then the script reloads the page itself
    await page.evaluate(() => {
      window.__beforeWithdraw = 1;
      document.cookie = '_ga=GA1.1.1; path=/'; document.cookie = '_gcl_au=1.1.1; path=/'; document.cookie = '_fbp=fb.1.1.1; path=/';
      // Record what the page looked like at unload, i.e. after apply() and just before the reload.
      addEventListener('pagehide', () => {
        const last = (window.dataLayer || []).map((a) => Array.from(a)).filter((e) => e[0] === 'consent').at(-1);
        sessionStorage.setItem('__atUnload', JSON.stringify({ last: last?.[2] ?? null, cookie: document.cookie }));
      });
    });
    await page.click('[data-consent-open]');
    check('Cookie settings reopens panel with choices ticked', (await page.locator('#uksk-consent-manage').isVisible()) && (await page.isChecked('input[name="analytics"]')) && (await page.isChecked('input[name="advertising"]')));
    await page.uncheck('input[name="analytics"]');
    await page.uncheck('input[name="advertising"]');
    const reloaded = page.waitForEvent('load', { timeout: 10000 }).then(() => true, () => false);
    await page.click('#uksk-consent-manage button[type="submit"]', { noWaitAfter: true });
    check('withdrawal: page reloads by itself', await reloaded);
    await page.waitForTimeout(500);
    const hitsAfterReload = hits.length;
    check('withdrawal: same URL, fresh page (no pre-withdrawal state)', page.url() === href && (await page.evaluate(() => window.__beforeWithdraw)) === undefined);
    const atUnload = JSON.parse((await page.evaluate(() => sessionStorage.getItem('__atUnload'))) || '{}');
    check('withdrawal: consent update all denied before the reload', JSON.stringify(atUnload.last) === JSON.stringify({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }));
    check('withdrawal: _ga/_gcl/_fbp deleted before the reload', typeof atUnload.cookie === 'string' && !/(^|;\s*)(_ga|_gcl|_fbp)/.test(atUnload.cookie));
    check('withdrawal: _ga/_gcl/_fbp absent after the reload', (await page.evaluate(() => document.cookie)).split(';').filter((c) => /^\s*(_ga|_gcl|_fbp)/.test(c)).length === 0);
    const scriptsLeft = await page.evaluate(() => [...document.querySelectorAll('script[src]')].map((s) => s.src).filter((s) => /googletagmanager|fbevents|facebook\.net/.test(s)).length);
    check('withdrawal: no gtag.js or fbevents.js script in the reloaded page', scriptsLeft === 0, `${scriptsLeft}`);
    check('withdrawal: no fbq and only the consent default + stored denied update in dataLayer', await page.evaluate(() => !window.fbq && (window.dataLayer || []).every((a) => a[0] === 'consent')));
    check('withdrawal: banner stays hidden after the reload', !(await page.locator('#uksk-consent').isVisible()));
    await page.locator('.pcard a[rel~="sponsored"]').first().click({ noWaitAfter: true });
    await page.locator('.pcard a[rel~="sponsored"]').first().click({ button: 'middle', noWaitAfter: true }).catch(() => {});
    await page.waitForTimeout(600);
    for (const pg of ctx.pages()) if (pg !== page) await pg.close();
    check('withdrawal: no affiliate_click after the reload', (await clicks(page)).length === 0);
    check('withdrawal: no further tag requests after the reload', hits.length === hitsAfterReload, `${hits.length - hitsAfterReload}`);
    await ctx.close();
  }

  // 4. Analytics only.
  {
    const { ctx, page, hits } = await fresh();
    await page.goto(ORIGIN + PAGE);
    await page.click('[data-consent="manage"]');
    await page.check('input[name="analytics"]');
    await page.click('#uksk-consent-manage button[type="submit"]');
    await page.waitForTimeout(800);
    check('analytics only: gtag.js requested', hits.some((h) => h.includes('googletagmanager.com')));
    check('analytics only: no facebook.net request', !hits.some((h) => h.includes('facebook')));
    await page.reload();
    await page.waitForTimeout(800);
    check('analytics only + reload: still no facebook.net request', !hits.some((h) => h.includes('facebook')));
    await ctx.close();
  }

  // 5. CLS with the banner, screenshots.
  for (const [label, vp] of [['320', { width: 320, height: 640 }], ['390', { width: 390, height: 844 }], ['768', { width: 768, height: 1024 }], ['desktop', { width: 1280, height: 800 }]]) {
    const { ctx, page } = await fresh(vp);
    await page.addInitScript(() => {
      window.__cls = 0;
      if (!(PerformanceObserver.supportedEntryTypes || []).includes('layout-shift')) { window.__cls = null; return; }
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { window.__cls = null; }
    });
    await page.goto(ORIGIN + PAGE, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const cls = await page.evaluate(() => window.__cls);
    if (cls === null) console.log(`INFO [${BROWSER}] CLS ${label}: layout-shift API not supported (NOT RUN)`);
    else check(`CLS at ${label} <= 0.02 with banner`, cls <= 0.02, cls.toFixed(4));
    const box = await page.locator('#uksk-consent').boundingBox();
    check(`banner fits viewport at ${label}`, !!box && box.width <= vp.width + 0.5 && box.height <= vp.height * 0.86, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'none');
    const tap = await page.$$eval('#uksk-consent button', (bs) => Math.min(...bs.filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().height)));
    check(`banner buttons >= 44px tall at ${label}`, tap >= 44, `${tap}`);
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `${BROWSER}-${label}-banner.png`) });
      await page.click('[data-consent="manage"]');
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(SHOTS, `${BROWSER}-${label}-manage.png`) });
    }
    await ctx.close();
  }
  // privacy cookie table screenshot
  if (SHOTS) {
    const { ctx, page } = await fresh({ width: 390, height: 844 });
    await page.goto(ORIGIN + '/privacy/');
    await page.click('[data-consent="reject"]');
    await page.locator('#cookies').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, `${BROWSER}-390-privacy-cookies.png`), fullPage: true });
    const axe = await new AxeBuilder({ page }).analyze();
    const s = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check('axe: privacy page with cookie table 0 serious/critical', s.length === 0, s.map((v) => v.id).join(',') || 'none');
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n[${BROWSER}] ${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
