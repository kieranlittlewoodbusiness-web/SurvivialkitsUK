import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { affiliateAsins, affiliateAsinsByPage, checkAffiliatePlacement, checkRainwaterNote, COMPARE_PAGE_FILE, HOME_PAGE_FILE, compareAsinSets, checkContent, checkLinks, DEFAULT_BANNED, orphanAdBadges, headersPatternMatches, parseHeadersFile, checkStarRuleSecurityHeaders, REQUIRED_PERMISSIONS_POLICY } from './lib/dist-checks.mjs';
import { checkComparePage, checkHomePage, checkRainwaterNotes, extractCards, extractSections, modelNumberTokens, readCompareHtml, readHomeHtml } from './lib/s1-10-card-rules.mjs';
import { VERIFIED_BY_CATEGORY } from '../tests/offers/verifiedSet.ts';
import { RAINWATER_DRINKING_WATER_NOTE, RENDER_GATED_CATEGORIES } from '../src/lib/offers/types.ts';

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

const PAGES_DEV_NOINDEX =
  'https://uksurvivalkits.pages.dev/*\n  X-Robots-Tag: noindex\n\nhttps://:version.uksurvivalkits.pages.dev/*\n  X-Robots-Tag: noindex\n';
const STAR_SECURITY =
  '/*\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()\n';

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
  it('production: fails when /* omits X-Frame-Options or Permissions-Policy', () => {
    const r = checkContent(
      site({
        'index.html': page('<p>x</p>'),
        'robots.txt': 'User-agent: *\nAllow: /\n',
        '_headers': PAGES_DEV_NOINDEX,
      }),
      { production: true },
    );
    const reasons = r.failures.map((f) => `${f.file}: ${f.reason}`);
    expect(reasons).toContain('_headers: /* rule is missing');
    const partial = checkContent(
      site({
        'index.html': page('<p>x</p>'),
        'robots.txt': 'User-agent: *\nAllow: /\n',
        '_headers': `/*\n  X-Content-Type-Options: nosniff\n\n${PAGES_DEV_NOINDEX}`,
      }),
      { production: true },
    );
    const partialReasons = partial.failures.map((f) => `${f.file}: ${f.reason}`);
    expect(partialReasons).toContain('_headers: /* must send X-Frame-Options: DENY (or SAMEORIGIN)');
    expect(partialReasons).toContain('_headers: /* must send Permissions-Policy');
  });
  it('production: passes an indexable site with robots.txt Allow, /* security headers and pages.dev-only noindex headers', () => {
    const r = checkContent(
      site({
        'index.html': page('<p>x</p>'),
        'robots.txt': 'User-agent: *\nAllow: /\n',
        '_headers': `${STAR_SECURITY}\n${PAGES_DEV_NOINDEX}`,
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
        '_headers': `${STAR_SECURITY}\n${PAGES_DEV_NOINDEX}`,
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
/** S1-10b (CR M1): render-gated categories stay verified but are not expected in dist. */
const RENDERED_BY_CATEGORY = Object.fromEntries(
  Object.entries(VERIFIED_BY_CATEGORY).filter(([cat]) => !RENDER_GATED_CATEGORIES.includes(cat)),
); // same derivation as verifiedSet.ts RENDERED_BY_CATEGORY
const expectedCategories = Object.entries(RENDERED_BY_CATEGORY)
  .filter(([cat, asins]) => cat !== 'kit' && asins.length > 0)
  .map(([cat]) => cat);
const expectedCompare = expectedCategories.reduce(
  (n, cat) => n + Math.min(RENDERED_BY_CATEGORY[cat].length, PER_CATEGORY),
  0,
);
// S1-11: the homepage adds one top-pick button per compare category.
const expectedHome = expectedCategories.length;
const expectedAffiliate = expectedCompare + expectedHome;
const RAINWATER_ASINS = VERIFIED_BY_CATEGORY.rainwater_storage ?? [];

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
    // S1-10b (CR L1): exact ASIN set, not just the count.
    expect(log).toMatch(new RegExp(`affiliate ASIN set equals verifiedSet\\.ts exactly \\(${expectedCompare} ASINs, each linked once on the compare page; ${expectedHome} homepage top picks`));
    expect(r.status).toBe(0);
    expect(affiliateAsins(out).asins).toEqual(Object.values(RENDERED_BY_CATEGORY).flatMap((a) => a.slice(0, PER_CATEGORY)).sort());
    // S1-10b (CR M1): rainwater guard ran; while gated, no rainwater ASIN anywhere in dist and no rainwater section.
    expect(log).toMatch(/PASS: rainwater guard: /);
    if (RENDER_GATED_CATEGORIES.includes('rainwater_storage')) {
      const all = fs.readdirSync(out, { recursive: true }).filter((f) => String(f).endsWith('.html')).map((f) => fs.readFileSync(path.join(out, String(f)), 'utf8')).join('\n');
      for (const a of RAINWATER_ASINS) expect(all.includes(a), a).toBe(false);
      const cmp = readCompareHtml(out);
      expect(cmp).not.toMatch(/data-category="rainwater_storage"/);
      expect(cmp).not.toMatch(/Rainwater storage/);
      expect(checkRainwaterNote(cmp, { asins: RAINWATER_ASINS, note: RAINWATER_DRINKING_WATER_NOTE }).rainwater).toBe(0);
    } else if (RAINWATER_ASINS.length > 0) {
      // Un-gated (S1-10b-web): the section and every rainwater card carry the note.
      expect(log).toMatch(/PASS: rainwater drinking-water note on the rainwater section and every rainwater card/);
    }
    const realTag = process.env.AMAZON_ASSOCIATES_UK_TAG;
    if (realTag) expect(log.includes(realTag)).toBe(false);
    const compare = readCompareHtml(out);
    expect(compare.match(/data-affiliate="amazon"/g)).toHaveLength(expectedCompare);
    if (realTag) expect(compare.includes(realTag)).toBe(false);
    const home = readHomeHtml(out);
    expect(home.match(/data-affiliate="amazon"/g)).toHaveLength(expectedHome);
    if (realTag) expect(home.includes(realTag)).toBe(false);
    const homeRules = checkHomePage(home, { expectedButtons: expectedHome, expectedCategories, compareHtml: compare, rainwaterNote: RAINWATER_DRINKING_WATER_NOTE });
    expect(homeRules.failures).toEqual([]);
    expect(homeRules.picks).toHaveLength(expectedCategories.length);
    const rules = checkComparePage(compare, {
      expectedButtons: expectedCompare,
      expectedCategories,
      maxPerCategory: PER_CATEGORY,
      expectNoImages: true,
      rainwaterNote: RAINWATER_DRINKING_WATER_NOTE,
    });
    expect(rules.failures).toEqual([]);
    expect(rules.rainwaterCards).toBe(Math.min(RENDERED_BY_CATEGORY.rainwater_storage?.length ?? 0, PER_CATEGORY));
    const headersText = fs.readFileSync(path.join(out, '_headers'), 'utf8');
    const headerRules = parseHeadersFile(headersText);
    expect(headersText).toContain('https://uksurvivalkits.pages.dev/*');
    expect(headersText).toContain('https://:version.uksurvivalkits.pages.dev/*');
    expect(checkStarRuleSecurityHeaders(headerRules)).toEqual([]);
    expect(REQUIRED_PERMISSIONS_POLICY.length).toBeGreaterThan(0);
    for (const [cat, asins] of Object.entries(RENDERED_BY_CATEGORY)) {
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
  it('requires DENY or SAMEORIGIN on /* and the restrictive Permissions-Policy tokens', () => {
    expect(checkStarRuleSecurityHeaders(parseHeadersFile(PAGES_DEV_NOINDEX))).toEqual([
      { file: '_headers', reason: '/* rule is missing' },
    ]);
    expect(
      checkStarRuleSecurityHeaders(parseHeadersFile('/*\n  X-Frame-Options: ALLOWALL\n')).map((f) => f.reason),
    ).toEqual([
      '/* must send X-Frame-Options: DENY (or SAMEORIGIN)',
      '/* must send Permissions-Policy',
    ]);
    expect(checkStarRuleSecurityHeaders(parseHeadersFile(STAR_SECURITY))).toEqual([]);
  });
  it('reads security and noindex rules from public/_headers', () => {
    const source = fs.readFileSync(path.resolve(new URL('..', import.meta.url).pathname, 'public/_headers'), 'utf8');
    const rules = parseHeadersFile(source);
    expect(checkStarRuleSecurityHeaders(rules)).toEqual([]);
    const xfo = rules.find((r) => r.pattern === '/*').headers.find((h) => /^X-Frame-Options$/i.test(h.name));
    expect(xfo.value).toBe('DENY');
    const policy = rules.find((r) => r.pattern === '/*').headers.find((h) => /^Permissions-Policy$/i.test(h.name)).value;
    for (const token of REQUIRED_PERMISSIONS_POLICY) expect(policy).toContain(token);
    expect(policy).not.toMatch(/interest-cohort/i);
    expect(headersPatternMatches('https://uksurvivalkits.pages.dev/*', 'https://uksurvivalkits.pages.dev/')).toBe(true);
    const noindexUrls = [
      'https://uksurvivalkits.pages.dev/',
      'https://preview-sha.uksurvivalkits.pages.dev/',
    ];
    for (const url of noindexUrls) {
      expect(
        rules.some(
          (r) =>
            r.headers.some((h) => /^X-Robots-Tag$/i.test(h.name) && /noindex/i.test(h.value)) &&
            headersPatternMatches(r.pattern, url),
        ),
      ).toBe(true);
    }
    expect(
      rules.some(
        (r) =>
          r.headers.some((h) => /^X-Robots-Tag$/i.test(h.name) && /noindex/i.test(h.value)) &&
          headersPatternMatches(r.pattern, 'https://uksurvivalkits.uk/'),
      ),
    ).toBe(false);
  });
});

describe('S1-10b (CR L1): exact affiliate ASIN set', () => {
  const dist = (pages) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'asin-set-'));
    pages.forEach((html, i) => fs.writeFileSync(path.join(d, `p${i}.html`), html));
    return d;
  };
  const a = (asin) => `<a href="https://www.amazon.co.uk/dp/${asin}?tag=TESTONLY-21" rel="sponsored nofollow">x</a>`;

  it('collects tagged dp ASINs across pages and ignores untagged or other links', () => {
    const d = dist([a('B000000001') + a('B000000002'), a('B000000002') + '<a href="https://www.amazon.co.uk/dp/B000000003">plain</a>']);
    const r = affiliateAsins(d);
    expect(r.asins).toEqual(['B000000001', 'B000000002']);
    expect(r.counts.get('B000000002')).toBe(2);
  });

  it('same count but a different ASIN fails; identical sets pass', () => {
    expect(compareAsinSets(['A000000001', 'A000000002'], ['A000000001', 'A000000003'])).toEqual({ ok: false, missing: ['A000000003'], extra: ['A000000002'] });
    expect(compareAsinSets(['A000000002', 'A000000001'], ['A000000001', 'A000000002']).ok).toBe(true);
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

describe('S1-10b: A3 paper sizes, link placement rule, rainwater note, buy-button names', () => {
  it('modelNumberTokens allows ISO paper sizes A0 to A10 but still flags model codes', () => {
    expect(modelNumberTokens('OverBoard A3 waterproof pouch, Size A4, A0 or A10')).toEqual([]);
    expect(modelNumberTokens('Pouch A11 T42 XT500')).toEqual(['A11', 'T42', 'XT500']);
  });

  // Derived from verifiedSet, the same way verify:dist does it.
  const byCategory = Object.fromEntries(expectedCategories.map((c) => [c, RENDERED_BY_CATEGORY[c].slice(0, PER_CATEGORY)]));
  const topPicks = Object.fromEntries(expectedCategories.map((c) => [c, RENDERED_BY_CATEGORY[c][0]]));
  const counts = (list) => list.reduce((m, a) => m.set(a, (m.get(a) ?? 0) + 1), new Map());
  const pages = (compareList, homeList, extra = {}) => {
    const m = new Map([[COMPARE_PAGE_FILE, counts(compareList)]]);
    if (homeList.length) m.set(HOME_PAGE_FILE, counts(homeList));
    for (const [f, l] of Object.entries(extra)) m.set(f, counts(l));
    return m;
  };
  const compareAll = Object.values(byCategory).flat();
  const homeAll = Object.values(topPicks);

  it('passes with no homepage links (pre-S1-11) and with one top pick per category (S1-11)', () => {
    expect(checkAffiliatePlacement(pages(compareAll, []), { byCategory, topPicks })).toMatchObject({ ok: true, homeLinks: 0, compareLinks: compareAll.length });
    expect(checkAffiliatePlacement(pages(compareAll, homeAll), { byCategory, topPicks })).toMatchObject({ ok: true, homeLinks: expectedCategories.length });
  });
  it('fails a duplicate on the compare page', () => {
    const r = checkAffiliatePlacement(pages([...compareAll, compareAll[0]], homeAll), { byCategory, topPicks });
    expect(r.ok).toBe(false);
    expect(r.failures.join('\n')).toMatch(new RegExp(`compare page: ${compareAll[0]} linked 2 times`));
  });
  it('fails a non-top pick on the homepage', () => {
    const cat = expectedCategories.find((c) => byCategory[c].length > 1);
    const second = byCategory[cat][1];
    const r = checkAffiliatePlacement(pages(compareAll, [...homeAll.filter((a) => a !== topPicks[cat]), second]), { byCategory, topPicks });
    expect(r.ok).toBe(false);
    expect(r.failures.join('\n')).toMatch(new RegExp(`homepage: ${second} is not the top-ranked verified pick`));
  });
  it('fails a duplicated homepage link, a missing compare ASIN and links on other pages', () => {
    const r = checkAffiliatePlacement(pages(compareAll.slice(1), [...homeAll, homeAll[0]], { 'gear/torches/index.html': [compareAll[1]] }), { byCategory, topPicks });
    const text = r.failures.join('\n');
    expect(text).toMatch(new RegExp(`homepage: ${homeAll[0]} linked 2 times`));
    expect(text).toMatch(new RegExp(`compare page: missing ${compareAll[0]}`));
    expect(text).toMatch(/gear\/torches\/index\.html: affiliate links are only allowed/);
  });
  it('affiliateAsinsByPage reads per-page counts from a dist folder', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'placement-'));
    fs.mkdirSync(path.join(d, 'compare/72-hour-emergency-kits'), { recursive: true });
    const a = (asin) => `<a href="https://www.amazon.co.uk/dp/${asin}?tag=verifydist-21" rel="sponsored nofollow">x</a>`;
    fs.writeFileSync(path.join(d, COMPARE_PAGE_FILE), compareAll.map(a).join(''));
    fs.writeFileSync(path.join(d, HOME_PAGE_FILE), homeAll.map(a).join(''));
    fs.writeFileSync(path.join(d, 'about.html'), '<a href="https://www.amazon.co.uk/dp/B000000001">untagged</a>');
    const byPage = affiliateAsinsByPage(d);
    expect([...byPage.keys()].sort()).toEqual([COMPARE_PAGE_FILE, HOME_PAGE_FILE].sort());
    expect(checkAffiliatePlacement(byPage, { byCategory, topPicks }).ok).toBe(true);
    fs.rmSync(d, { recursive: true, force: true });
  });

  const NOTE = 'Rainwater note from the data.';
  const note = (t = NOTE) => `<p class="notice notice--info" data-safety-note="drinking-water">${t}</p>`;
  const rcard = (id, withNote = true) => `<article class="pcard" id="${id}" data-category="rainwater_storage"><h3>Water butt</h3>${withNote ? note() : ''}</article>`;
  const rsection = (sectionNote, cards) =>
    `<section class="cat-section" id="rainwater" data-category="rainwater_storage"><h2>Rainwater storage</h2>${sectionNote ? note() : ''}<div class="pgrid">${cards}</div></section>`;

  it('rainwater: passes with the section note and a note on every card', () => {
    const r = checkRainwaterNotes(extractSections(rsection(true, rcard('a') + rcard('b'))), extractCards(rsection(true, rcard('a') + rcard('b'))), NOTE);
    expect(r).toEqual({ failures: [], rainwaterCards: 2 });
  });
  it('rainwater: fails a section without its note, a card without its note, and different wording', () => {
    const h1 = rsection(false, rcard('a'));
    expect(checkRainwaterNotes(extractSections(h1), extractCards(h1), NOTE).failures).toEqual(['rainwater section has no section-level drinking-water note']);
    const h2 = rsection(true, rcard('a') + rcard('b', false));
    expect(checkRainwaterNotes(extractSections(h2), extractCards(h2), NOTE).failures).toEqual(['rainwater card b has no drinking-water note']);
    const h3 = rsection(true, rcard('a'));
    expect(checkRainwaterNotes(extractSections(h3), extractCards(h3), 'Different wording.').failures).toHaveLength(2);
  });
  it('rainwater: checkComparePage applies the rule when given the note', () => {
    const html = `<html><body>${rsection(true, rcard('a', false))}<footer><p data-testid="amazon-disclosure">As an Amazon Associate I earn from qualifying purchases.</p></footer></body></html>`;
    const r = checkComparePage(html, { expectedButtons: 0, rainwaterNote: NOTE });
    expect(r.failures).toContain('rainwater card a has no drinking-water note');
  });

  const LINK = 'https://www.amazon.co.uk/dp/B075F3FBTB?tag=verifydist-21';
  const homePick = (btn, extra = '') =>
    `<html><body><a class="btn btn--cta btn--lg" href="/compare/72-hour-emergency-kits/" data-cta="get-prepared">Get prepared here</a>` +
    `<li><article class="pick" data-category="rainwater_storage"><a class="pick__cat" href="/compare/72-hour-emergency-kits/#rainwater"><span>Rainwater</span></a><p class="pick__name">Water butt</p>${extra}` +
    `<p class="pick__cta"><span class="badge badge--ad">Ad</span>${btn}</p></article></li>` +
    `<footer><p data-testid="amazon-disclosure">As an Amazon Associate I earn from qualifying purchases.</p></footer></body></html>`;
  const opts = { expectedButtons: 1, expectedCategories: ['rainwater_storage'], rainwaterNote: NOTE };

  it('home: fails "Buy on Amazon : name" (CR N1) and passes "Buy on Amazon: name"', () => {
    const bad = `<a class="btn pick__btn" href="${LINK}" rel="sponsored nofollow noopener" data-affiliate="amazon">Buy on Amazon<span class="visually-hidden">: Water butt</span></a>`;
    expect(checkHomePage(homePick(bad, note()), opts).failures.join('\n')).toMatch(/space before punctuation: "Buy on Amazon : Water butt"/);
    const good = `<a class="btn pick__btn" href="${LINK}" rel="sponsored nofollow noopener" data-affiliate="amazon" aria-label="Buy on Amazon: Water butt (affiliate link)">Buy on Amazon</a>`;
    expect(checkHomePage(homePick(good, note()), opts).failures).toEqual([]);
  });
  it('home: fails a rainwater pick without its note', () => {
    const good = `<a class="btn pick__btn" href="${LINK}" rel="sponsored nofollow noopener" data-affiliate="amazon" aria-label="Buy on Amazon: Water butt (affiliate link)">Buy on Amazon</a>`;
    expect(checkHomePage(homePick(good), opts).failures).toContain('rainwater homepage pick has no drinking-water note');
  });
});

describe('S1-10b (CR M1): rainwater drinking-water note guard', () => {
  const opts = { asins: ['B00ZUTJAHA'], note: RAINWATER_DRINKING_WATER_NOTE };
  const section = (inner) => `<section class="cat-section" id="rainwater" data-category="rainwater_storage"><h2>Rainwater storage</h2>${inner}</section>`;
  it('no rainwater content => passes with 0 signals', () => {
    expect(checkRainwaterNote('<section data-category="flask"></section>', opts)).toMatchObject({ ok: true, rainwater: 0 });
  });
  it('a rainwater section or card without the exact note fails (forces the Web follow-up to render it)', () => {
    expect(checkRainwaterNote(section('<a href="https://www.amazon.co.uk/dp/B00ZUTJAHA?tag=TESTONLY-21">x</a>'), opts).ok).toBe(false);
    expect(checkRainwaterNote('<div data-asin="B00ZUTJAHA">card</div>', opts).ok).toBe(false);
    expect(checkRainwaterNote(section('<p>Do not drink rainwater.</p>'), opts).ok).toBe(false);
  });
  it('the exact note as text (entities and line breaks allowed) passes', () => {
    const p = `<p>${RAINWATER_DRINKING_WATER_NOTE.replace(':', '&#58;').replace('Use it', 'Use\n  it')}</p>`;
    expect(checkRainwaterNote(section(p), opts)).toMatchObject({ ok: true });
  });
});
