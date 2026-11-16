import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkContent, checkLinks, DEFAULT_BANNED, orphanAdBadges, headersPatternMatches, parseHeadersFile } from './lib/dist-checks.mjs';
import { checkComparePage, checkHomePage, readCompareHtml, readHomeHtml } from './lib/s1-10-card-rules.mjs';
import { VERIFIED_BY_CATEGORY } from '../tests/offers/verifiedSet.ts';

const cfg = JSON.parse(fs.readFileSync(new URL('../config/outbound-allowlist.json', import.meta.url), 'utf8'));
const ROBOTS = '<meta name="robots" content="index, follow">';
const page = (body, robots = ROBOTS) => `<!doctype html><html><head>${robots}</head><body>${body}</body></html>`;
function site(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'distcheck-'));
  for (const [rel, html] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
    fs.writeFileSync(path.join(d, rel), html);
  }
  return d;
}
const DP = 'https://www.amazon.co.uk/dp/B0CZ9LH53B?tag=example-21';
const card = (rel, badge = true) =>
  `<article class="pcard"><h3>Item</h3>${badge ? '<span class="badge badge--ad">Ad</span>' : ''}<a class="btn" href="${DP}" rel="${rel}">Check on Amazon</a></article>`;

describe('checkLinks', () => {
  it('requires both "sponsored" and "nofollow" on affiliate links', () => {
    expect(cfg.affiliate.required_rel).toEqual(expect.arrayContaining(['sponsored', 'nofollow']));
    const bad = checkLinks(site({ 'index.html': page(card('sponsored noopener')) }), cfg);
    expect(bad.failures.map((f) => f.reason).join()).toMatch(/rel missing "nofollow"/);
    const good = checkLinks(site({ 'index.html': page(card('sponsored nofollow noopener')) }), cfg);
    expect(good.failures).toEqual([]);
    expect(good.affiliate).toBe(1);
  });
  it('fails non-allowlisted hosts, tagless dp links and http citations, and redacts tags', () => {
    const r = checkLinks(
      site({
        'index.html': page(
          '<a href="https://evaq8.co.uk/x">x</a><a rel="sponsored nofollow" href="https://www.amazon.co.uk/dp/B0CZ9LH53B">t</a><a href="http://www.gov.uk/x">g</a><a href="https://www.amazon.co.uk/dp/B0CZ9LH53B?tag=secret-21">n</a>',
        ),
      }),
      cfg,
    );
    const reasons = r.failures.map((f) => f.reason).join('\n');
    expect(reasons).toMatch(/evaq8\.co\.uk is not allowlisted/);
    expect(reasons).toMatch(/missing \?tag=/);
    expect(reasons).toMatch(/citation link is not https/);
    expect(JSON.stringify(r)).not.toContain('secret-21');
  });
  it('fails when the affiliate count is not the expected number', () => {
    const r = checkLinks(site({ 'index.html': page(card('sponsored nofollow')) }), cfg, { expectAffiliate: 4 });
    expect(r.failures.map((f) => f.reason)).toContain('expected 4 affiliate links, found 1');
  });
  it('allows https product images only on m.media-amazon.com in <img> or <source>', () => {
    const img = '<img src="https://m.media-amazon.com/images/I/example.jpg" width="160" height="160" alt="x">';
    const good = checkLinks(site({ 'index.html': page(img) }), cfg);
    expect(good.failures).toEqual([]);
    const badHost = checkLinks(site({ 'index.html': page('<img src="https://images-eu.ssl-images-amazon.com/images/I/x.jpg" alt="x">') }), cfg);
    expect(badHost.failures.map((f) => f.reason).join()).toMatch(/is not allowlisted/);
    const badTag = checkLinks(site({ 'index.html': page('<a href="https://m.media-amazon.com/images/I/example.jpg">x</a>') }), cfg);
    expect(badTag.failures.map((f) => f.reason).join()).toMatch(/image host in <a>/);
  });
});

describe('checkContent', () => {
  it('passes a clean page', () => {
    expect(checkContent(site({ 'index.html': page(`<p>Plain guidance.</p>${card('sponsored nofollow')}`) })).failures).toEqual([]);
  });
  it.each(DEFAULT_BANNED)('fails on banned string "%s" in any case', (term) => {
    const r = checkContent(site({ 'index.html': page(`<p>Some ${term.toUpperCase()} text</p>`) }));
    expect(r.failures.some((f) => f.reason.includes(`"${term}"`))).toBe(true);
  });
  it('covers the review-requested terms', () => {
    for (const t of ['not live yet', 'editorial review', 'do not publish', 'unsupported safety claim', 'unverified specification', 'coming soon', 'household brief', 'evaq8', 't-minus', 'prepared britain', 'decathlon', 'go outdoors', 'argos', 'millets']) {
      expect(DEFAULT_BANNED).toContain(t);
    }
  });
  it('decodes entities before matching', () => {
    const r = checkContent(site({ 'index.html': page('<p>Not&#32;live yet</p>') }));
    expect(r.failures.length).toBe(1);
  });
  it('fails an Ad badge with no sponsored link in the same card', () => {
    expect(orphanAdBadges(page('<article class="product-card"><span class="badge badge--ad">Ad</span><p>Links not here</p></article>'))).toHaveLength(1);
    expect(orphanAdBadges(page(card('sponsored nofollow')))).toEqual([]);
    expect(orphanAdBadges(page('<p><span class="badge badge--ad">Ad</span></p>'))).toHaveLength(1);
    expect(orphanAdBadges(page('<li><span class="badge badge--ad" data-badge-legend>Ad</span> legend</li>'))).toEqual([]);
    // A sponsored link in a different card does not cover the badge.
    expect(orphanAdBadges(page(`<article><span class="badge badge--ad">Ad</span></article>${card('sponsored nofollow', false)}`))).toHaveLength(1);
  });
  it('requires exactly one robots meta per page', () => {
    const r = checkContent(site({ 'index.html': page('<p>x</p>', ROBOTS + ROBOTS) }));
    expect(r.failures.map((f) => f.reason)).toContain('expected exactly 1 robots meta, found 2');
  });
  it('production: fails noindex pages (except 404), robots.txt Disallow and a catch-all noindex header', () => {
    const noindex = '<meta name="robots" content="noindex, nofollow">';
    const r = checkContent(
      site({
        'index.html': page('<p>x</p>', noindex),
        '404.html': page('<p>missing</p>', noindex),
        'robots.txt': 'User-agent: *\nDisallow: /\n',
        '_headers': '/*\n  X-Robots-Tag: noindex\n\nhttps://uksurvivalkits.pages.dev/*\n  X-Robots-Tag: noindex\n',
      }),
      { production: true },
    );
    const reasons = r.failures.map((f) => `${f.file}: ${f.reason}`);
    expect(reasons).toContain('index.html: production page is noindex');
    expect(reasons.some((x) => x.startsWith('404.html'))).toBe(false);
    expect(reasons).toContain('robots.txt: does not contain "Allow: /"');
    expect(reasons).toContain('robots.txt: contains "Disallow: /"');
    expect(reasons).toContain('_headers: X-Robots-Tag noindex applies to "/*", which can match the production host');
    expect(reasons.some((x) => x.includes('noindex must not apply to https://uksurvivalkits.uk/'))).toBe(true);
  });
  it('production: fails when preview pages.dev aliases are not noindexed', () => {
    const r = checkContent(
      site({
        'index.html': page('<p>x</p>'),
        'robots.txt': 'User-agent: *\nAllow: /\n',
        '_headers': 'https://uksurvivalkits.pages.dev/*\n  X-Robots-Tag: noindex\n',
      }),
      { production: true },
    );
    const reasons = r.failures.map((f) => `${f.file}: ${f.reason}`);
    expect(reasons).toContain('_headers: X-Robots-Tag noindex does not apply to https://preview-sha.uksurvivalkits.pages.dev/');
    expect(reasons.some((x) => x.includes('noindex must not apply to https://uksurvivalkits.uk/'))).toBe(false);
  });
  it('production: fails when _headers is missing', () => {
    const r = checkContent(
      site({
        'index.html': page('<p>x</p>'),
        'robots.txt': 'User-agent: *\nAllow: /\n',
      }),
      { production: true },
    );
    expect(r.failures.map((f) => `${f.file}: ${f.reason}`)).toContain('_headers: missing');
  });
  it('production: passes an indexable site with robots.txt Allow and pages.dev-only noindex headers', () => {
    const r = checkContent(
      site({
        'index.html': page('<p>x</p>'),
        'robots.txt': 'User-agent: *\nAllow: /\n',
        '_headers': 'https://uksurvivalkits.pages.dev/*\n  X-Robots-Tag: noindex\n\nhttps://:version.uksurvivalkits.pages.dev/*\n  X-Robots-Tag: noindex\n',
      }),
      { production: true },
    );
    expect(r.failures).toEqual([]);
  });
  it('production: fails canonical, og:url or sitemap URLs on www or pages.dev', () => {
    const r = checkContent(
      site({
        'index.html': page('<p>x</p>').replace(
          '</head>',
          '<link rel="canonical" href="https://www.uksurvivalkits.uk/"><meta property="og:url" content="https://uksurvivalkits.pages.dev/"></head>',
        ),
        'robots.txt': 'User-agent: *\nAllow: /\n',
        '_headers': 'https://uksurvivalkits.pages.dev/*\n  X-Robots-Tag: noindex\n\nhttps://:version.uksurvivalkits.pages.dev/*\n  X-Robots-Tag: noindex\n',
        'sitemap-0.xml': '<?xml version="1.0"?><urlset><url><loc>https://www.uksurvivalkits.uk/start-here</loc></url></urlset>',
      }),
      { production: true },
    );
    const reasons = r.failures.map((f) => `${f.file}: ${f.reason}`);
    expect(reasons.some((x) => x.includes('canonical') && x.includes('www.uksurvivalkits.uk'))).toBe(true);
    expect(reasons.some((x) => x.includes('og:url') && x.includes('pages.dev'))).toBe(true);
    expect(reasons.some((x) => x.includes('sitemap loc') && x.includes('www.uksurvivalkits.uk'))).toBe(true);
  });
});

const PER_CATEGORY = 3;
const expectedCategories = Object.entries(VERIFIED_BY_CATEGORY)
  .filter(([cat, asins]) => cat !== 'kit' && asins.length > 0)
  .map(([cat]) => cat);
const expectedCompare = expectedCategories.reduce(
  (n, cat) => n + Math.min(VERIFIED_BY_CATEGORY[cat].length, PER_CATEGORY),
  0,
);
// S1-11: the homepage adds one top-pick button per compare category.
const expectedHome = expectedCategories.length;
const expectedAffiliate = expectedCompare + expectedHome;

describe('verify:dist (production build with a dummy tag)', () => {
  it('builds production and passes links (derived affiliate count, sponsored + nofollow) and content (indexable) checks', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-dist-'));
    const r = spawnSync('node', ['scripts/verify-dist.mjs'], {
      cwd: path.resolve(new URL('..', import.meta.url).pathname),
      env: { ...process.env, VERIFY_OUT_DIR: out },
      encoding: 'utf8',
    });
    const log = `${r.stdout}\n${r.stderr}`;
    expect(log).toMatch(new RegExp(`affiliate ${expectedAffiliate}\\)`));
    expect(log).toMatch(new RegExp(`exactly ${expectedAffiliate} affiliate links`));
    expect(log).toMatch(/robots\.txt allows crawling/);
    expect(r.status).toBe(0);
    const realTag = process.env.AMAZON_ASSOCIATES_UK_TAG;
    if (realTag) expect(log.includes(realTag)).toBe(false);
    const compare = readCompareHtml(out);
    expect(compare.match(/data-affiliate="amazon"/g)).toHaveLength(expectedCompare);
    if (realTag) expect(compare.includes(realTag)).toBe(false);
    const home = readHomeHtml(out);
    expect(home.match(/data-affiliate="amazon"/g)).toHaveLength(expectedHome);
    if (realTag) expect(home.includes(realTag)).toBe(false);
    const homeRules = checkHomePage(home, { expectedButtons: expectedHome, expectedCategories, compareHtml: compare });
    expect(homeRules.failures).toEqual([]);
    expect(homeRules.picks).toHaveLength(expectedCategories.length);
    const rules = checkComparePage(compare, {
      expectedButtons: expectedCompare,
      expectedCategories,
      maxPerCategory: PER_CATEGORY,
      expectNoImages: true,
    });
    expect(rules.failures).toEqual([]);
    for (const [cat, asins] of Object.entries(VERIFIED_BY_CATEGORY)) {
      if (asins.length > 0 && asins.length < PER_CATEGORY) {
        expect(rules.sections.find((s) => s.category === cat)?.cards).toHaveLength(asins.length);
      }
    }
    fs.rmSync(out, { recursive: true, force: true });
  }, 180_000);
});

describe('pages.dev _headers patterns', () => {
  const alias = 'https://uksurvivalkits.pages.dev/*';
  const preview = 'https://:version.uksurvivalkits.pages.dev/*';
  it('matches the production pages.dev alias and preview subdomains only', () => {
    expect(headersPatternMatches(alias, 'https://uksurvivalkits.pages.dev/')).toBe(true);
    expect(headersPatternMatches(alias, 'https://uksurvivalkits.pages.dev/scenarios/leave-home-bag/')).toBe(true);
    expect(headersPatternMatches(alias, 'https://preview-sha.uksurvivalkits.pages.dev/')).toBe(false);
    expect(headersPatternMatches(preview, 'https://preview-sha.uksurvivalkits.pages.dev/')).toBe(true);
    expect(headersPatternMatches(preview, 'https://preview-sha.uksurvivalkits.pages.dev/scenarios/leave-home-bag/')).toBe(true);
    expect(headersPatternMatches(preview, 'https://uksurvivalkits.pages.dev/')).toBe(false);
    expect(headersPatternMatches(alias, 'https://uksurvivalkits.uk/')).toBe(false);
    expect(headersPatternMatches(preview, 'https://uksurvivalkits.uk/')).toBe(false);
    expect(headersPatternMatches(alias, 'https://www.uksurvivalkits.uk/')).toBe(false);
    expect(headersPatternMatches(preview, 'https://www.uksurvivalkits.uk/')).toBe(false);
  });
  it('parses the project _headers noindex rules', () => {
    const rules = parseHeadersFile(
      'https://uksurvivalkits.pages.dev/*\n  X-Robots-Tag: noindex\n\nhttps://:version.uksurvivalkits.pages.dev/*\n  X-Robots-Tag: noindex\n',
    );
    expect(rules).toHaveLength(2);
    expect(rules.map((r) => r.pattern)).toEqual([
      'https://uksurvivalkits.pages.dev/*',
      'https://:version.uksurvivalkits.pages.dev/*',
    ]);
  });
});

describe('S1-11 homepage rules (checkHomePage)', () => {
  const LINK = 'https://www.amazon.co.uk/dp/B075F3FBTB?tag=verifydist-21';
  const pick = (cat, { href = `/compare/72-hour-emergency-kits/#${cat}`, button = true, name = 'Plain torch' } = {}) =>
    `<li><article class="pick" data-category="${cat}"><a class="pick__cat" href="${href}"><span>${cat}</span></a><p class="pick__name">${name}</p>` +
    (button ? `<p class="pick__cta"><span class="badge badge--ad">Ad</span><a class="btn" href="${LINK}" rel="sponsored nofollow noopener" data-affiliate="amazon">Check ${name} on Amazon</a></p>` : '') +
    '</article></li>';
  const home = (body) =>
    `<html><body><a class="btn btn--cta btn--lg" href="/compare/72-hour-emergency-kits/" data-cta="get-prepared">Get prepared here</a>` +
    `<img class="hero__img" src="/images/hero-mobile-720.jpg" width="720" height="900" alt="" fetchpriority="high" loading="eager">` +
    `${body}<footer><p data-testid="amazon-disclosure">As an Amazon Associate I earn from qualifying purchases.</p></footer></body></html>`;
  const compare = '<section id="torch"></section><section id="radio"></section>';

  it('passes one sponsored top pick per category linking to compare anchors', () => {
    const r = checkHomePage(home(pick('torch') + pick('radio')), { expectedButtons: 2, expectedCategories: ['torch', 'radio'], compareHtml: compare });
    expect(r.failures).toEqual([]);
  });
  it('fails a missing category, a wrong count, a broken anchor and a model number', () => {
    const r = checkHomePage(home(pick('torch', { href: '/compare/72-hour-emergency-kits/#nope', name: 'Torch XT500' })), {
      expectedButtons: 2,
      expectedCategories: ['torch', 'radio'],
      compareHtml: compare,
    });
    const text = r.failures.join('\n');
    expect(text).toMatch(/expected 2 homepage affiliate buttons/);
    expect(text).toMatch(/missing homepage pick for category: radio/);
    expect(text).toMatch(/missing anchor/);
    expect(text).toMatch(/model\/SKU-like token "XT500"/);
  });
  it('fails "Compare kits", a lazy hero, a non-lazy content image and a second disclosure', () => {
    const html = home(pick('torch'))
      .replace('Get prepared here', 'Compare kits')
      .replace('loading="eager"', 'loading="lazy"')
      .replace('<footer>', '<img src="/images/grab-bags-900.jpg" width="900" height="600" alt="x"><p>As an Amazon Associate I earn from qualifying purchases.</p><footer>');
    const text = checkHomePage(html, { expectedButtons: 1, expectedCategories: ['torch'] }).failures.join('\n');
    expect(text).toMatch(/Get prepared here/);
    expect(text).toMatch(/Compare kits/);
    expect(text).toMatch(/hero image is lazy-loaded/);
    expect(text).toMatch(/grab-bags-900\.jpg is not lazy-loaded/);
    expect(text).toMatch(/exactly 1 disclosure line/);
  });
});
