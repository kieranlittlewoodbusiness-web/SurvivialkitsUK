#!/usr/bin/env node
/**
 * S1-7 outbound link check over built HTML. Rules: scripts/lib/dist-checks.mjs (checkLinks).
 * Allowlist: config/outbound-allowlist.json. Tracking ids are redacted in all output.
 * Usage: node scripts/check-outbound-links.mjs [distDir] [--expect-affiliate N] [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkLinks } from './lib/dist-checks.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const optIdx = new Set(['--json', '--expect-affiliate'].flatMap((n) => { const i = args.indexOf(n); return i >= 0 ? [i, i + 1] : []; }));
const dist = path.resolve(args.find((a, i) => !a.startsWith('--') && !optIdx.has(i)) ?? 'dist');
if (!fs.existsSync(dist)) { console.error(`check:links: ${dist} not found. Run a build first.`); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(new URL('../config/outbound-allowlist.json', import.meta.url), 'utf8'));
const exp = opt('--expect-affiliate');
const r = checkLinks(dist, cfg, { expectAffiliate: exp == null ? null : Number(exp) });
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(r, null, 2));
console.log(`check:links scanned ${r.files} HTML files in ${path.relative(process.cwd(), dist) || '.'}`);
console.log(`external links: ${r.external} (citations ${r.citation}, affiliate ${r.affiliate})`);
for (const [h, n] of Object.entries(r.hosts).sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${h}`);
if (r.failures.length) {
  console.error(`FAIL: ${r.failures.length} problem(s)`);
  for (const f of r.failures.slice(0, 50)) console.error(`  ${f.file}: ${f.url} -> ${f.reason}`);
  process.exit(1);
}
console.log(`PASS: 0 non-allowlisted hosts; affiliate links are tagged amazon.co.uk/dp links with rel ${cfg.affiliate.required_rel.map((t) => `"${t}"`).join(' + ')}${exp == null ? '' : `; exactly ${exp} affiliate links`}.`);
