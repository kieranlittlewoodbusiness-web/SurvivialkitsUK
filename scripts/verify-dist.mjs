#!/usr/bin/env node
/**
 * S1-7 production verification. Builds a production site into .verify-dist with a DUMMY
 * Associates tag (never the real one), then runs the link check (exactly 9 affiliate links,
 * rel sponsored + nofollow) and the content check with production rules (no noindex,
 * robots.txt allows crawling). Usage: npm run verify:dist [-- --expect-affiliate N]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const OUT = process.env.VERIFY_OUT_DIR || '.verify-dist';
const DUMMY_TAG = 'verifydist-21';
const args = process.argv.slice(2);
const ei = args.indexOf('--expect-affiliate');
const expect = ei >= 0 ? args[ei + 1] : '9';
const env = { ...process.env, SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: DUMMY_TAG };
for (const k of ['CF_PAGES', 'CF_PAGES_BRANCH', 'CF_PAGES_URL']) delete env[k];
const run = (cmd, a) => {
  const r = spawnSync(cmd, a, { env, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
fs.rmSync(OUT, { recursive: true, force: true });
run('npx', ['astro', 'build', '--outDir', OUT]);
run('node', ['scripts/check-outbound-links.mjs', OUT, '--expect-affiliate', expect]);
run('node', ['scripts/check-content.mjs', OUT, '--production']);
console.log(`verify:dist PASS (production build in ${OUT}, dummy tag, ${expect} affiliate links).`);
