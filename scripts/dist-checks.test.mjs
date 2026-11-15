import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkContent, checkLinks, DEFAULT_BANNED, orphanAdBadges, headersPatternMatches, parseHeadersFile } from './lib/dist-checks.mjs';

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
    const r = checkLinks(site({ 'index.html': page(card('sponsored nofollow')) }), cfg, { expectAffiliate: 9 });
    expect(r.failures.map((f) => f.reason)).toContain('expected 9 affiliate links, found 1');
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

describe('verify:dist (production build with a dummy tag)', () => {
  it('builds production and passes links (9 affiliate, sponsored + nofollow) and content (indexable) checks', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-dist-'));
    const r = spawnSync('node', ['scripts/verify-dist.mjs'], {
      cwd: path.resolve(new URL('..', import.meta.url).pathname),
      env: { ...process.env, VERIFY_OUT_DIR: out },
      encoding: 'utf8',
    });
    const log = `${r.stdout}\n${r.stderr}`;
    expect(log).toMatch(/affiliate 9\)/);
    expect(log).toMatch(/exactly 9 affiliate links/);
    expect(log).toMatch(/robots\.txt allows crawling/);
    expect(r.status).toBe(0);
    const realTag = process.env.AMAZON_ASSOCIATES_UK_TAG;
    if (realTag) expect(log.includes(realTag)).toBe(false);
    const compare = fs.readFileSync(path.join(out, 'compare/72-hour-emergency-kits/index.html'), 'utf8');
    expect(compare.match(/data-affiliate="amazon"/g)).toHaveLength(9);
    if (realTag) expect(compare.includes(realTag)).toBe(false);
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
