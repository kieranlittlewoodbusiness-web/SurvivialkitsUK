import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkTrailingSlash, servedStatus, pagePath, internalPath } from './lib/trailing-slash.mjs';

const O = 'https://uksurvivalkits.uk';
const head = (p, { canonical = `${O}${p}`, og = `${O}${p}` } = {}) =>
  `<link rel="canonical" href="${canonical}"><meta property="og:url" content="${og}">`;
const doc = (p, body = '', opts) => `<!doctype html><html><head>${head(p, opts)}</head><body>${body}</body></html>`;
const urlset = (entries) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries
    .map(([loc, lastmod]) => `<url><loc>${loc}</loc>${lastmod === null ? '' : `<lastmod>${lastmod ?? '2026-11-14T00:00:00.000Z'}</lastmod>`}</url>`)
    .join('')}</urlset>`;
const INDEX = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${O}/sitemap-0.xml</loc></sitemap></sitemapindex>`;

const NAV = '<a href="/">Home</a><a href="/about/">About</a><a href="/gear/torches/">Torches</a>';
/** A good site; `over` replaces or removes (null) individual files. */
function site(over = {}) {
  const files = {
    'index.html': doc('/', `${NAV}<a href="#main">Skip</a><a href="/compare/kits/#torches">Torches</a><a href="/sitemap-index.xml">Sitemap</a><a href="/favicon.ico">i</a><a href="mailto:a@b.uk">Mail</a><a href="https://www.amazon.co.uk/dp/B0000000?tag=x-21">Buy</a><a href="${O}/about/?ref=x">Abs</a>`),
    'about/index.html': doc('/about/', `${NAV}<a href="../gear/torches/">Relative</a>`),
    'gear/torches/index.html': doc('/gear/torches/', NAV),
    'compare/kits/index.html': doc('/compare/kits/', NAV),
    '404.html': doc('/404', NAV),
    'favicon.ico': 'x',
    'sitemap-index.xml': INDEX,
    'sitemap-0.xml': urlset([[`${O}/`], [`${O}/about/`], [`${O}/gear/torches/`], [`${O}/compare/kits/`]]),
    ...over,
  };
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'slashcheck-'));
  for (const [rel, body] of Object.entries(files)) {
    if (body === null) continue;
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
    fs.writeFileSync(path.join(d, rel), body);
  }
  return d;
}
const reasons = (d) => checkTrailingSlash(d).failures.map((f) => `${f.file}: ${f.reason}`);

describe('servedStatus (Cloudflare Pages model)', () => {
  const d = site();
  it.each([
    ['/', 200],
    ['/about/', 200],
    ['/about', 308, '/about/'],
    ['/about/index.html', 308, '/about/'],
    ['/404', 200],
    ['/404.html', 308, '/404'],
    ['/favicon.ico', 200],
    ['/nope', 404],
    ['/nope/', 404],
  ])('%s -> %i', (p, status, location) => {
    const s = servedStatus(d, p);
    expect(s.status).toBe(status);
    if (location) expect(s.location).toBe(location);
  });
  it('maps files to served paths and resolves only same-origin page links', () => {
    expect(pagePath('index.html')).toBe('/');
    expect(pagePath(path.join('gear', 'torches', 'index.html'))).toBe('/gear/torches/');
    expect(pagePath('404.html')).toBe('/404');
    expect(internalPath('#x', '/')).toBeNull();
    expect(internalPath('mailto:a@b.uk', '/')).toBeNull();
    expect(internalPath('https://example.com/a', '/')).toBeNull();
    expect(internalPath('../b/', '/a/c/')).toBe('/a/b/');
    expect(internalPath(`${O}/x/?q=1#h`, '/')).toBe('/x/');
  });
});

describe('checkTrailingSlash', () => {
  it('passes a site whose canonicals, og:urls, sitemap URLs and internal links all get a 200', () => {
    const r = checkTrailingSlash(site());
    expect(r.failures).toEqual([]);
    expect(r.sitemapUrls).toBe(4);
    expect(r.lastmods).toBe(4);
    expect(r.internalLinks).toBeGreaterThan(10);
  });

  // Mutation tests: each single regression must fail the check.
  it('fails an internal link without the trailing slash (308 hop)', () => {
    const r = reasons(site({ 'about/index.html': doc('/about/', '<a href="/gear/torches">Torches</a>') }));
    expect(r).toEqual(['about/index.html: internal link "/gear/torches" would get 308 -> /gear/torches/']);
  });
  it('fails a slash-less link in the 404 page and an absolute slash-less link', () => {
    const r = reasons(site({ '404.html': doc('/404', `<a href="/about">About</a><a href="${O}/gear/torches#x">T</a>`) }));
    expect(r).toHaveLength(2);
    expect(r.join('\n')).toMatch(/"\/about" would get 308/);
    expect(r.join('\n')).toMatch(/gear\/torches#x" would get 308/);
  });
  it('fails a link to a page that does not exist, and a link to /index.html', () => {
    const r = reasons(site({ 'about/index.html': doc('/about/', '<a href="/gone/">Gone</a><a href="/about/index.html">I</a>') }));
    expect(r.join('\n')).toMatch(/"\/gone\/" would get 404/);
    expect(r.join('\n')).toMatch(/"\/about\/index.html" would get 308 -> \/about\//);
  });
  it('fails a slash-less canonical (as under the old BaseHead) and a slash-less og:url', () => {
    const r = reasons(site({ 'about/index.html': doc('/about/', NAV, { canonical: `${O}/about`, og: `${O}/about` }) }));
    expect(r).toContain(`about/index.html: canonical ${O}/about would get 308 -> /about/`);
    expect(r).toContain(`about/index.html: og:url ${O}/about would get 308 -> /about/`);
    expect(r.some((x) => x.includes('differs from that page\'s canonical'))).toBe(true);
  });
  it('fails a canonical that is not the page itself, or not on the apex', () => {
    expect(reasons(site({ 'about/index.html': doc('/about/', NAV, { canonical: `${O}/gear/torches/` }) })).join('\n')).toMatch(
      /canonical .*gear\/torches\/ is not this page's URL/,
    );
    expect(reasons(site({ 'about/index.html': doc('/about/', NAV, { og: 'https://www.uksurvivalkits.uk/about/' }) })).join('\n')).toMatch(
      /og:url is not on https:\/\/uksurvivalkits.uk/,
    );
  });
  it('fails a page with no canonical or no og:url', () => {
    const r = reasons(site({ 'gear/torches/index.html': `<html><head></head><body>${NAV}</body></html>` }));
    expect(r).toContain('gear/torches/index.html: expected 1 canonical, found 0');
    expect(r).toContain('gear/torches/index.html: expected 1 og:url, found 0');
  });
  it('fails a slash-less sitemap loc (the old serialize()) even when the page agrees', () => {
    const r = reasons(
      site({
        'sitemap-0.xml': urlset([[`${O}/`], [`${O}/about`], [`${O}/gear/torches/`], [`${O}/compare/kits/`]]),
      }),
    );
    expect(r).toContain(`sitemap-0.xml: sitemap loc ${O}/about would get 308 -> /about/`);
  });
  it('fails a sitemap loc that 404s, and a sitemap URL without a valid <lastmod>', () => {
    const r = reasons(
      site({ 'sitemap-0.xml': urlset([[`${O}/`], [`${O}/gone/`], [`${O}/about/`, null], [`${O}/gear/torches/`, 'yesterday']]) }),
    );
    expect(r).toContain(`sitemap-0.xml: sitemap loc ${O}/gone/ would get 404`);
    expect(r).toContain(`sitemap-0.xml: sitemap loc ${O}/about/ has no <lastmod>`);
    expect(r).toContain(`sitemap-0.xml: sitemap loc ${O}/gear/torches/ has an invalid <lastmod> "yesterday"`);
  });
  it('fails a missing sitemap index and an index entry that does not resolve', () => {
    expect(reasons(site({ 'sitemap-index.xml': null }))).toContain('sitemap-index.xml: missing');
    const bad = INDEX.replace('sitemap-0.xml', 'sitemap-9.xml');
    expect(reasons(site({ 'sitemap-index.xml': bad })).join('\n')).toMatch(/sitemap-9.xml would get 404/);
  });

  it('CLI exits 0 on a good site and 1 on a regression', () => {
    const cli = path.resolve('scripts/check-trailing-slash.mjs');
    expect(spawnSync(process.execPath, [cli, site()], { encoding: 'utf8' }).status).toBe(0);
    const r = spawnSync(process.execPath, [cli, site({ 'index.html': doc('/', '<a href="/about">About</a>') })], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/internal link "\/about" would get 308/);
  });
});
