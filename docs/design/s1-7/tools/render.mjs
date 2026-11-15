import { chromium } from '/workspace/s1-2-tools/node_modules/playwright/index.mjs';
import { AxeBuilder } from '/workspace/s1-2-tools/node_modules/@axe-core/playwright/dist/index.mjs';
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:8717/';
const OUT = '/workspace/s1-7-design/';
const pages = ['home-mock', 'compare-mock', 'components'];
const widths = [320, 375, 390, 768, 1280];
const shots = { 'home-mock': [375, 1280], 'compare-mock': [375, 1280], components: [375, 1280] };
const browser = await chromium.launch();
const report = { browser: `Chromium ${browser.version()}`, results: [] };
for (const p of pages) for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w >= 768 ? 900 : 760 }, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 768, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + p + '.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const over = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > de.clientWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.topic-rail'); }).slice(0, 5).map((e) => e.className || e.tagName);
    const small = [...document.querySelectorAll('a, button, summary')].filter((e) => {
      if (e.closest('p, .price__fine, .meta, .offer .meta') && !e.classList.contains('btn')) return false; // inline text links (WCAG 2.5.8 inline exception)
      if (e.classList.contains('skip-link')) return false;
      if (e.closest('.story__title')) return false; // whole card is the target via ::after (measured separately)
      const r = e.getBoundingClientRect(); if (!r.width) return false; return r.height < 44 - 0.5;
    }).map((e) => `${e.tagName}.${e.className}:${Math.round(e.getBoundingClientRect().height)}px "${e.textContent.trim().slice(0, 30)}"`);
    const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
    return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, overflowing: over, smallTargets: small, fontsLoaded: [...new Set(fonts)] };
  });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const r = { page: p, width: w, hOverflow: m.scrollWidth > m.clientWidth, ...m, axeViolations: axe.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target })) };
  report.results.push(r);
  console.log(`${p}@${w}: overflow=${r.hOverflow} (${m.scrollWidth}/${m.clientWidth}) small=${m.smallTargets.length} axe=${r.axeViolations.length} ${r.axeViolations.map((v) => v.id + 'x' + v.n).join(',')} fonts=${m.fontsLoaded}`);
  if (m.smallTargets.length) console.log('  small:', m.smallTargets.slice(0, 6).join(' | '));
  if (m.overflowing.length) console.log('  over:', m.overflowing.join(' | '));
  if (shots[p].includes(w)) await page.screenshot({ path: `${OUT}${p}-${w}.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(OUT + 'qa-report.json', JSON.stringify(report, null, 2));
