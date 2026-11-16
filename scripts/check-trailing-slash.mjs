#!/usr/bin/env node
/**
 * SEO-2 check over built HTML and sitemaps: every canonical, og:url, sitemap <loc> and internal
 * <a href> must be a URL Cloudflare Pages serves with a 200 (no 308 trailing-slash hop, no 404),
 * and every sitemap <url> must carry a <lastmod>. Rules: scripts/lib/trailing-slash.mjs.
 * Usage: node scripts/check-trailing-slash.mjs [distDir] [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkTrailingSlash } from './lib/trailing-slash.mjs';

const args = process.argv.slice(2);
const ji = args.indexOf('--json');
const dist = path.resolve(args.find((a, i) => !a.startsWith('--') && (ji < 0 || i !== ji + 1)) ?? 'dist');
if (!fs.existsSync(dist)) {
  console.error(`check:slash: ${dist} not found. Run a build first.`);
  process.exit(2);
}
const r = checkTrailingSlash(dist);
if (ji >= 0) fs.writeFileSync(args[ji + 1], JSON.stringify(r, null, 2));
console.log(
  `check:slash scanned ${r.htmlFiles} HTML files: ${r.internalLinks} internal links, ${r.headUrls} canonical/og:url values, ${r.sitemapUrls} sitemap URLs (${r.lastmods} with <lastmod>)`,
);
if (r.failures.length) {
  console.error(`FAIL: ${r.failures.length} problem(s)`);
  for (const f of r.failures.slice(0, 80)) console.error(`  ${f.file}: ${f.reason}`);
  if (r.failures.length > 80) console.error(`  ... and ${r.failures.length - 80} more`);
  process.exit(1);
}
console.log('PASS: 0 redirecting or broken internal links, canonicals, og:urls or sitemap URLs; every sitemap URL has <lastmod> and matches its page canonical.');
