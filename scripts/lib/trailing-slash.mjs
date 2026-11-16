/**
 * SEO-2 trailing-slash check over a built `dist`. Separate from dist-checks.mjs on purpose
 * (other PRs edit that file).
 *
 * Models how Cloudflare Pages serves a static `build.format: 'directory'` site:
 *   /x/   + x/index.html  -> 200        /x    + x/index.html -> 308 /x/
 *   /x    + file x         -> 200        /x/index.html       -> 308 /x/
 *   /x.html (file)        -> 308 /x     /x    + x.html       -> 200 (e.g. /404)
 *   anything else         -> 404
 *
 * Fails when any canonical, og:url, sitemap <loc> or internal <a href> would not get a 200 (a
 * 308 hop or a 404), when a page's canonical or og:url is not its own URL, when a sitemap <loc>
 * differs from the canonical and og:url of the page it serves, or when a sitemap <url> has no
 * valid <lastmod>.
 */
import fs from 'node:fs';
import path from 'node:path';

export const CANONICAL_ORIGIN = 'https://uksurvivalkits.uk';

const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

/** Status Cloudflare Pages would return for `pathname` (no query/hash) in `dist`. */
export function servedStatus(dist, pathname) {
  let p;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return { status: 404 };
  }
  const abs = path.join(dist, p);
  if (!path.resolve(abs).startsWith(path.resolve(dist))) return { status: 404 };
  if (p.endsWith('/index.html') && isFile(abs)) return { status: 308, location: p.slice(0, -'index.html'.length) };
  if (p.endsWith('.html') && isFile(abs)) return { status: 308, location: p.slice(0, -'.html'.length) };
  if (p.endsWith('/')) {
    if (isFile(path.join(abs, 'index.html'))) return { status: 200, file: path.join(abs, 'index.html') };
    if (p !== '/' && isFile(`${abs.replace(/\/$/, '')}.html`)) return { status: 308, location: p.replace(/\/$/, '') };
    return { status: 404 };
  }
  if (isFile(abs)) return { status: 200, file: abs };
  if (isFile(path.join(abs, 'index.html'))) return { status: 308, location: `${p}/` };
  if (isFile(`${abs}.html`)) return { status: 200, file: `${abs}.html` };
  return { status: 404 };
}

/** URL path a built HTML file is served at (`about/index.html` -> `/about/`, `404.html` -> `/404`). */
export function pagePath(rel) {
  const r = rel.split(path.sep).join('/');
  if (r === 'index.html') return '/';
  if (r.endsWith('/index.html')) return `/${r.slice(0, -'index.html'.length)}`;
  return `/${r.replace(/\.html$/, '')}`;
}

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p));
  }
  return out;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"');
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? decode(m[1] ?? m[2] ?? m[3]) : null;
};
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => m[0]);

/** Canonical hrefs, og:url contents and <a href> values of one HTML document. */
export function extract(html) {
  return {
    canonicals: tags(html, 'link').filter((t) => /\srel\s*=\s*["']?canonical\b/i.test(t)).map((t) => attr(t, 'href')),
    ogUrls: tags(html, 'meta').filter((t) => /\sproperty\s*=\s*["']?og:url\b/i.test(t)).map((t) => attr(t, 'content')),
    hrefs: tags(html, 'a').map((t) => attr(t, 'href')).filter((h) => h !== null),
  };
}

/** Internal target path for an href on `fromPath`, or null if external / not a page request. */
export function internalPath(href, fromPath, origin = CANONICAL_ORIGIN) {
  const h = href.trim();
  if (h === '' || h.startsWith('#') || /^(mailto|tel|javascript|data|sms):/i.test(h)) return null;
  let u;
  try {
    u = new URL(h, origin + fromPath);
  } catch {
    return null;
  }
  if (u.origin !== origin) return null;
  return u.pathname;
}

const LASTMOD = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/;

export function checkTrailingSlash(dist, { origin = CANONICAL_ORIGIN } = {}) {
  const failures = [];
  const fail = (file, reason) => failures.push({ file, reason });
  const files = walk(dist);
  const htmlFiles = files.filter((f) => f.endsWith('.html')).sort();
  const pages = new Map(); // served path -> { canonical, ogUrl }
  let internalLinks = 0;
  let headUrls = 0;

  const resolveAbs = (file, kind, value) => {
    let u;
    try {
      u = new URL(value);
    } catch {
      fail(file, `${kind} is not an absolute URL: ${value}`);
      return null;
    }
    if (u.origin !== origin) {
      fail(file, `${kind} is not on ${origin}: ${value}`);
      return null;
    }
    const s = servedStatus(dist, u.pathname);
    if (s.status !== 200) fail(file, `${kind} ${value} would get ${s.status}${s.location ? ` -> ${s.location}` : ''}`);
    return u.pathname;
  };

  for (const rel of htmlFiles) {
    const file = rel.split(path.sep).join('/');
    const self = pagePath(rel);
    const { canonicals, ogUrls, hrefs } = extract(fs.readFileSync(path.join(dist, rel), 'utf8'));
    const is404 = self === '/404';
    if (canonicals.length !== 1) fail(file, `expected 1 canonical, found ${canonicals.length}`);
    if (ogUrls.length !== 1) fail(file, `expected 1 og:url, found ${ogUrls.length}`);
    for (const [kind, list] of [['canonical', canonicals], ['og:url', ogUrls]]) {
      for (const v of list) {
        headUrls++;
        const p = resolveAbs(file, kind, v);
        if (p !== null && !is404 && p !== self) fail(file, `${kind} ${v} is not this page's URL (${origin}${self})`);
      }
    }
    pages.set(self, { canonical: canonicals[0], ogUrl: ogUrls[0] });
    for (const h of hrefs) {
      const t = internalPath(h, self, origin);
      if (t === null) continue;
      internalLinks++;
      const s = servedStatus(dist, t);
      if (s.status !== 200) fail(file, `internal link "${h}" would get ${s.status}${s.location ? ` -> ${s.location}` : ''}`);
    }
  }

  const sitemapFiles = files.filter((f) => /^sitemap.*\.xml$/.test(f)).sort();
  let sitemapUrls = 0;
  let lastmods = 0;
  if (!sitemapFiles.includes('sitemap-index.xml')) fail('sitemap-index.xml', 'missing');
  for (const sm of sitemapFiles) {
    const xml = fs.readFileSync(path.join(dist, sm), 'utf8');
    const isIndex = /<sitemapindex\b/.test(xml);
    for (const block of xml.match(isIndex ? /<sitemap>[\s\S]*?<\/sitemap>/g : /<url>[\s\S]*?<\/url>/g) ?? []) {
      const loc = /<loc>([^<]*)<\/loc>/.exec(block)?.[1]?.trim();
      if (!loc) {
        fail(sm, 'entry without <loc>');
        continue;
      }
      const p = resolveAbs(sm, 'sitemap loc', decode(loc));
      if (isIndex) continue;
      sitemapUrls++;
      const lm = /<lastmod>([^<]*)<\/lastmod>/.exec(block)?.[1]?.trim();
      if (!lm) fail(sm, `sitemap loc ${loc} has no <lastmod>`);
      else if (!LASTMOD.test(lm) || Number.isNaN(new Date(lm).valueOf())) fail(sm, `sitemap loc ${loc} has an invalid <lastmod> "${lm}"`);
      else lastmods++;
      if (p === null) continue;
      const page = pages.get(p);
      if (!page) continue;
      if (page.canonical !== loc) fail(sm, `sitemap loc ${loc} differs from that page's canonical ${page.canonical}`);
      if (page.ogUrl !== loc) fail(sm, `sitemap loc ${loc} differs from that page's og:url ${page.ogUrl}`);
    }
  }
  return { htmlFiles: htmlFiles.length, internalLinks, headUrls, sitemapUrls, lastmods, failures };
}
