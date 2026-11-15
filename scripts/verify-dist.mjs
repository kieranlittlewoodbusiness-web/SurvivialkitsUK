#!/usr/bin/env node
/**
 * S1-10 production verification. Builds a production site into .verify-dist with a DUMMY
 * Associates tag (never the real one), then runs the link check (expected affiliate count
 * derived from the verified set, capped at 3 per category) and the content check with
 * production rules (no noindex, robots.txt allows crawling). Usage:
 *   npm run verify:dist [-- --expect-affiliate N]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { checkComparePage, readCompareHtml } from './lib/s1-10-card-rules.mjs';

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
  const r = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/derive-affiliate-count.ts'], {
    env,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || 'derive-affiliate-count failed');
    process.exit(r.status ?? 1);
  }
  const n = (r.stdout || '').trim();
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

const html = readCompareHtml(OUT);
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
