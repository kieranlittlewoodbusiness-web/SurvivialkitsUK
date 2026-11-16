#!/usr/bin/env node
/**
 * SEO-6 check over built HTML. Rules: scripts/lib/jsonld-checks.mjs (checkJsonLd).
 * Usage: node scripts/check-jsonld.mjs [distDir] [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkJsonLd } from './lib/jsonld-checks.mjs';

const args = process.argv.slice(2);
const ji = args.indexOf('--json');
const dist = path.resolve(args.find((a, i) => !a.startsWith('--') && (ji < 0 || i !== ji + 1)) ?? 'dist');
if (!fs.existsSync(dist)) {
  console.error(`check:jsonld: ${dist} not found. Run a build first.`);
  process.exit(2);
}
const r = checkJsonLd(dist);
if (ji >= 0) fs.writeFileSync(args[ji + 1], JSON.stringify(r, null, 2));
console.log(`check:jsonld scanned ${r.files} HTML files in ${path.relative(process.cwd(), dist) || '.'}`);
if (r.failures.length) {
  console.error(`FAIL: ${r.failures.length} problem(s)`);
  for (const f of r.failures.slice(0, 80)) console.error(`  ${f.file}: ${f.reason}`);
  if (r.failures.length > 80) console.error(`  ... and ${r.failures.length - 80} more`);
  process.exit(1);
}
console.log('PASS: one JSON-LD @graph per indexable page, none on 404; no duplicate @id; no Product, Offer, price or Amazon URLs; absolute apex URLs; consistent with canonical, H1, meta and og:image.');
