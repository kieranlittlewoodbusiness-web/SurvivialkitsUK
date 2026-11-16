#!/usr/bin/env node
/**
 * S1-10 production verification. Builds a production site into .verify-dist with a DUMMY
 * Associates tag (never the real one), then runs the link check (expected affiliate count
 * derived from the verified set, capped at 3 per category) and the content check with
 * production rules (no noindex, robots.txt allows crawling). S1-10b (CR L1): the exact set of ASINs
 * behind tagged affiliate links must equal the ASINs in VERIFIED_BY_CATEGORY (tests/offers/verifiedSet.ts),
 * each linked once; a matching count alone is not enough. Render-gated categories (RENDER_GATED_CATEGORIES,
 * CR M1) are subtracted in code by derive-affiliate-count.ts. Rainwater guard (CR M1): whenever any
 * rainwater card/section renders, the compare page must show RAINWATER_DRINKING_WATER_NOTE. Usage:
 *   npm run verify:dist [-- --expect-affiliate N]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { checkComparePage, readCompareHtml } from './lib/s1-10-card-rules.mjs';
import { affiliateAsins, checkRainwaterNote, compareAsinSets } from './lib/dist-checks.mjs';

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

function derive(extra = []) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/derive-affiliate-count.ts', ...extra], {
    env,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || 'derive-affiliate-count failed');
    process.exit(r.status ?? 1);
  }
  return (r.stdout || '').trim();
}

function derivedAsins() {
  const out = derive(['--asins']);
  let list;
  try {
    list = JSON.parse(out);
  } catch {
    list = null;
  }
  if (!Array.isArray(list) || !list.every((a) => typeof a === 'string' && /^[A-Z0-9]{10}$/.test(a))) {
    console.error('derive-affiliate-count --asins did not print a JSON array of ASINs');
    process.exit(1);
  }
  return list;
}

function derivedExpect() {
  const n = derive();
  if (!/^\d+$/.test(n)) {
    console.error('derive-affiliate-count did not print a number');
    process.exit(1);
  }
  return Number(n);
}

const expect = ei >= 0 ? Number(args[ei + 1]) : derivedExpect();
if (!Number.isInteger(expect) || expect < 0) {
  console.error('expected affiliate count is not a valid integer');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
run('npx', ['astro', 'build', '--outDir', OUT]);
run('node', ['scripts/check-outbound-links.mjs', OUT, '--expect-affiliate', String(expect)]);
run('node', ['scripts/check-content.mjs', OUT, '--production']);

// S1-10b (CR L1): the exact ASIN set, not just the count.
const expectedAsins = derivedAsins();
const built = affiliateAsins(OUT);
const set = compareAsinSets(built.asins, expectedAsins);
const repeated = [...built.counts].filter(([, n]) => n !== 1).map(([a, n]) => `${a} x${n}`);
if (!set.ok || repeated.length || new Set(expectedAsins).size !== expectedAsins.length) {
  console.error(`FAIL: affiliate ASIN set does not match verifiedSet.ts (built ${built.asins.length}, expected ${expectedAsins.length})`);
  if (set.missing.length) console.error(`  missing from dist: ${set.missing.join(', ')}`);
  if (set.extra.length) console.error(`  not in verifiedSet: ${set.extra.join(', ')}`);
  if (repeated.length) console.error(`  linked more than once: ${repeated.join(', ')}`);
  process.exit(1);
}
console.log(`PASS: affiliate ASIN set equals verifiedSet.ts exactly (${expectedAsins.length} ASINs, each linked once).`);

const html = readCompareHtml(OUT);

// S1-10b (CR M1): rainwater content may only render together with the exact drinking-water note.
let rw;
try {
  rw = JSON.parse(derive(['--rainwater']));
} catch {
  rw = null;
}
if (!rw || !Array.isArray(rw.asins) || typeof rw.note !== 'string' || !rw.note) {
  console.error('derive-affiliate-count --rainwater did not print { asins, note }');
  process.exit(1);
}
const guard = checkRainwaterNote(html, rw);
if (!guard.ok) {
  console.error(`FAIL: rainwater guard: ${guard.reason}`);
  process.exit(1);
}
console.log(`PASS: rainwater guard: ${guard.reason} (${guard.rainwater} rainwater signals on the compare page).`);
const rules = checkComparePage(html, {
  expectedButtons: expect,
  maxPerCategory: 3,
  expectNoImages: true,
});
if (rules.failures.length) {
  console.error(`FAIL: ${rules.failures.length} S1-10 card rule(s)`);
  for (const f of rules.failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`verify:dist PASS (production build in ${OUT}, dummy tag, ${expect} affiliate links).`);
