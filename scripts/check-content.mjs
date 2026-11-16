#!/usr/bin/env node
/**
 * S1-7 content check over built HTML. Rules: scripts/lib/dist-checks.mjs (checkContent).
 * Usage: node scripts/check-content.mjs [distDir] [--production] [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkContent } from './lib/dist-checks.mjs';

const args = process.argv.slice(2);
const ji = args.indexOf('--json');
const dist = path.resolve(args.find((a, i) => !a.startsWith('--') && (ji < 0 || i !== ji + 1)) ?? 'dist');
if (!fs.existsSync(dist)) { console.error(`check:content: ${dist} not found. Run a build first.`); process.exit(2); }
const r = checkContent(dist, { production: args.includes('--production') });
if (ji >= 0) fs.writeFileSync(args[ji + 1], JSON.stringify(r, null, 2));
console.log(`check:content scanned ${r.files} HTML files in ${path.relative(process.cwd(), dist) || '.'}${r.production ? ' (production rules)' : ''}`);
console.log(`banned-string hits: ${Object.values(r.hits).reduce((a, b) => a + b, 0)} (${Object.keys(r.hits).length} terms); Ad badges: ${r.adBadges}`);
if (r.site.robotsTxt) console.log(`robots.txt: ${r.site.robotsTxt}`);
if (r.failures.length) {
  console.error(`FAIL: ${r.failures.length} problem(s)`);
  for (const f of r.failures.slice(0, 60)) console.error(`  ${f.file}: ${f.reason}`);
  process.exit(1);
}
console.log(`PASS: 0 banned strings, every Ad badge has a sponsored link in its card, one robots meta per page, indexable titles <=60 and unique metas 120–160 characters${r.production ? ', no noindex outside 404, robots.txt allows crawling, pages.dev-only noindex headers' : ''}.`);
