#!/usr/bin/env node
/**
 * S1-10 / S1-10b / S1-11 production verification. Builds a production site into .verify-dist with a
 * DUMMY Associates tag (never the real one), then runs:
 * - the link check: expected affiliate count derived from tests/offers/verifiedSet.ts (compare page
 *   capped at 3 per category, plus one homepage top pick per category);
 * - the content check with production rules (no noindex, robots.txt allows crawling, #23 headers);
 * - S1-10b (CR L1, K55 ruling): the exact ASIN set. Every expected ASIN is linked exactly once on the
 *   compare page; the homepage may add at most one link per category, and only to that category's
 *   first-ranked verified product; no other page has affiliate links;
 * - the compare-page and homepage card rules, including the rainwater drinking-water note (CR M1):
 *   the rainwater section and every rainwater card must show the note from the product data.
 * Usage:
 *   npm run verify:dist [-- --expect-affiliate N]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { checkComparePage, checkHomePage, readCompareHtml, readHomeHtml, rainwaterNoteFromData } from './lib/s1-10-card-rules.mjs';
import { affiliateAsins, affiliateAsinsByPage, checkAffiliatePlacement, compareAsinSets } from './lib/dist-checks.mjs';

const OUT = process.env.VERIFY_OUT_DIR || '.verify-dist';
const DUMMY_TAG = 'verifydist-21';
const args = process.argv.slice(2);
const ei = args.indexOf('--expect-affiliate');
const env = { ...process.env, SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: DUMMY_TAG };
for (const k of ['CF_PAGES', 'CF_PAGES_BRANCH', 'CF_PAGES_URL']) delete env[k];
const run = (cmd, a) => {
  const r = spawnSync(cmd, a, { env, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  return r;
};

function derivedExpect() {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/derive-affiliate-count.ts', '--json'], {
    env,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || 'derive-affiliate-count failed');
    process.exit(r.status ?? 1);
  }
  let parsed;
  try {
    parsed = JSON.parse((r.stdout || '').trim());
  } catch {
    console.error('derive-affiliate-count did not print JSON');
    process.exit(1);
  }
  for (const k of ['compare', 'home', 'total']) {
    if (!Number.isInteger(parsed[k]) || parsed[k] < 0) {
      console.error(`derive-affiliate-count: ${k} is not a valid integer`);
      process.exit(1);
    }
  }
  const asinOk = (a) => typeof a === 'string' && /^[A-Z0-9]{10}$/.test(a);
  if (!parsed.byCategory || !Object.values(parsed.byCategory).every((l) => Array.isArray(l) && l.every(asinOk))) {
    console.error('derive-affiliate-count: byCategory is not a map of ASIN lists');
    process.exit(1);
  }
  if (!parsed.topPicks || !Object.values(parsed.topPicks).every(asinOk)) {
    console.error('derive-affiliate-count: topPicks is not a map of ASINs');
    process.exit(1);
  }
  return parsed;
}

const derived = derivedExpect();
const expect = ei >= 0 ? Number(args[ei + 1]) : derived.total;
if (!Number.isInteger(expect) || expect < 0) {
  console.error('expected affiliate count is not a valid integer');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
run('npx', ['astro', 'build', '--outDir', OUT]);
run('node', ['scripts/check-outbound-links.mjs', OUT, '--expect-affiliate', String(expect)]);
run('node', ['scripts/check-content.mjs', OUT, '--production']);

// S1-10b (CR L1 + K55 ruling): the exact ASIN set and where each ASIN may appear.
const expectedAsins = Object.values(derived.byCategory).flat();
const built = affiliateAsins(OUT);
const set = compareAsinSets(built.asins, expectedAsins);
const placement = checkAffiliatePlacement(affiliateAsinsByPage(OUT), derived);
if (!set.ok || !placement.ok) {
  console.error(`FAIL: affiliate ASINs do not match verifiedSet.ts (built ${built.asins.length}, expected ${expectedAsins.length})`);
  if (set.missing.length) console.error(`  missing from dist: ${set.missing.join(', ')}`);
  if (set.extra.length) console.error(`  not in verifiedSet: ${set.extra.join(', ')}`);
  for (const f of placement.failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(
  `PASS: affiliate ASIN set equals verifiedSet.ts exactly (${expectedAsins.length} ASINs, each linked once on the compare page; ` +
    `${placement.homeLinks} homepage top picks, each its category's first-ranked product, at most once).`,
);

const rainwaterNote = rainwaterNoteFromData();
const html = readCompareHtml(OUT);
const rules = checkComparePage(html, {
  expectedButtons: derived.compare,
  expectedCategories: derived.categories,
  maxPerCategory: 3,
  expectNoImages: true,
  rainwaterNote,
});
const home = checkHomePage(readHomeHtml(OUT), {
  expectedButtons: derived.home,
  expectedCategories: derived.categories,
  compareHtml: html,
  rainwaterNote,
});
const failures = [...rules.failures, ...home.failures.map((f) => `home: ${f}`)];
if (failures.length) {
  console.error(`FAIL: ${failures.length} S1-10/S1-11 card rule(s)`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`PASS: rainwater drinking-water note on the rainwater section and every rainwater card (${rules.rainwaterCards} cards).`);
console.log(`verify:dist PASS (production build in ${OUT}, dummy tag, ${expect} affiliate links: compare ${derived.compare}, home ${derived.home}).`);
