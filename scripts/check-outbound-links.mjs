#!/usr/bin/env node
/**
 * S1-7 outbound link check. Scans built HTML (default ./dist) for every external URL in
 * href/src/action/srcset attributes and fails when:
 * - the host is not an own host, an allowlisted citation host or the affiliate host;
 * - an affiliate (Amazon) link is not https://www.amazon.co.uk/dp/<ASIN>?tag=<id>-21, or its
 *   rel does not contain every required token (e.g. "sponsored").
 * Allowlist: config/outbound-allowlist.json. Tracking ids are redacted in the output.
 * Usage: node scripts/check-outbound-links.mjs [distDir] [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const jsonIdx = args.indexOf('--json');
const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;
const dist = path.resolve(args.find((a, i) => !a.startsWith('--') && (jsonIdx < 0 || i !== jsonIdx + 1)) ?? 'dist');
const cfg = JSON.parse(fs.readFileSync(new URL('../config/outbound-allowlist.json', import.meta.url), 'utf8'));
const own = new Set(cfg.own_hosts);
const citations = new Set(cfg.citation_hosts);
const aff = cfg.affiliate;
const affHosts = new Set(aff.hosts);
const pathRe = new RegExp(aff.path_pattern);
const tagRe = new RegExp(aff.tag_pattern);

if (!fs.existsSync(dist)) {
  console.error(`check:links: ${dist} not found. Run a build first.`);
  process.exit(2);
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) files.push(p);
  }
})(dist);

const redact = (u) => u.replace(/([?&]tag=)[^&#"]+/g, '$1[REDACTED]');
const tagRx = /<(a|link|script|img|iframe|source|form|area)\b([^>]*)>/gi;
const attrRx = /\b(href|src|action|srcset)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const relRx = /\brel\s*=\s*("([^"]*)"|'([^']*)')/i;

const failures = [];
const counts = { files: files.length, external: 0, citation: 0, affiliate: 0 };
const hosts = {};

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(dist, file);
  for (const m of html.matchAll(tagRx)) {
    const [, tag, attrs] = m;
    const relTokens = ((attrs.match(relRx) || [])[2] ?? (attrs.match(relRx) || [])[3] ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    for (const a of attrs.matchAll(attrRx)) {
      const raw = (a[3] ?? a[4] ?? '').trim();
      const values = a[1].toLowerCase() === 'srcset' ? raw.split(',').map((s) => s.trim().split(/\s+/)[0]) : [raw];
      for (const v of values) {
        if (!/^(https?:)?\/\//i.test(v)) continue;
        let url;
        try {
          url = new URL(v.startsWith('//') ? `https:${v}` : v);
        } catch {
          failures.push({ file: rel, url: redact(v), reason: 'unparseable URL' });
          continue;
        }
        if (own.has(url.hostname)) continue;
        counts.external++;
        hosts[url.hostname] = (hosts[url.hostname] ?? 0) + 1;
        if (citations.has(url.hostname)) {
          counts.citation++;
          if (url.protocol !== 'https:') failures.push({ file: rel, url: v, reason: 'citation link is not https' });
          continue;
        }
        if (affHosts.has(url.hostname)) {
          counts.affiliate++;
          const problems = [];
          if (url.protocol !== 'https:') problems.push('not https');
          if (tag.toLowerCase() !== 'a') problems.push(`affiliate URL in <${tag}>`);
          if (!pathRe.test(url.pathname)) problems.push(`path ${url.pathname} is not /dp/<ASIN>`);
          for (const q of aff.required_query) if (!url.searchParams.get(q)) problems.push(`missing ?${q}=`);
          const t = url.searchParams.get('tag');
          if (t && !tagRe.test(t)) problems.push('malformed tag');
          if ([...url.searchParams.keys()].some((k) => !aff.required_query.includes(k))) problems.push('unexpected query parameters');
          for (const r of aff.required_rel) if (!relTokens.includes(r)) problems.push(`rel missing "${r}"`);
          if (problems.length) failures.push({ file: rel, url: redact(v), reason: problems.join('; ') });
          continue;
        }
        failures.push({ file: rel, url: redact(v), reason: `host ${url.hostname} is not allowlisted` });
      }
    }
  }
}

const report = { dist, ...counts, hosts, failures };
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
console.log(`check:links scanned ${counts.files} HTML files in ${dist}`);
console.log(`external links: ${counts.external} (citations ${counts.citation}, affiliate ${counts.affiliate})`);
for (const [h, n] of Object.entries(hosts).sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${h}`);
if (failures.length) {
  console.error(`FAIL: ${failures.length} problem(s)`);
  for (const f of failures.slice(0, 50)) console.error(`  ${f.file}: ${f.url} -> ${f.reason}`);
  process.exit(1);
}
console.log('PASS: 0 non-allowlisted hosts, every affiliate link is a tagged amazon.co.uk/dp link with rel "sponsored".');
