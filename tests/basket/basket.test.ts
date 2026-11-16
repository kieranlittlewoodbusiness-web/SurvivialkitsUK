/**
 * S1-12 baskets. Fake tags only; the real AMAZON_ASSOCIATES_UK_TAG is never read here
 * (run with `env -u AMAZON_ASSOCIATES_UK_TAG`).
 */
import { describe, expect, it } from 'vitest';
import {
  AMAZON_UK_CART_ADD_URL,
  BASKET_EXCLUDED_ASINS,
  BASKET_LINK_REL,
  MAX_BASKET_URL_LENGTH,
  STARTER_KIT,
  basketLink,
  basketTag,
  buildCartAddUrl,
  homeBasketAsins,
  homeBasketLink,
  parseStarterKitFile,
  starterKitAsins,
  starterKitBasketLink,
} from '../../src/lib/basket';
import { homeThemes, topPickLink } from '../../src/components/home/homeView';
import { loadCatalogue } from '../../src/components/catalogue/catalogueView';
import raw from '../../src/data/starter-kit/starterKit.json';

const FAKE_TAG = 'FAKETESTONLY-21';
const NOW = new Date('2026-11-16T17:00:00Z');
const PROD = { SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG };
const NON_PROD: Record<string, Record<string, string>> = {
  preview: { SITE_ENV: 'preview', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG },
  dev: { AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG },
  'cf-branch-preview': { SITE_ENV: 'production', CF_PAGES: '1', CF_PAGES_BRANCH: 's1-12-starter-kit', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG },
  'production-no-tag': { SITE_ENV: 'production' },
  'production-bad-tag': { SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: 'not-a-uk-tag' },
};
const params = (url: string) => new URL(url).searchParams;
const numberedAsins = (url: string) => {
  const p = params(url);
  const out: string[] = [];
  for (let i = 1; p.has(`ASIN.${i}`); i++) out.push(p.get(`ASIN.${i}`)!);
  return out;
};

describe('buildCartAddUrl (pure)', () => {
  it('numbers ASINs 1..n with Quantity 1 and no tag when none is given', () => {
    const url = buildCartAddUrl(['B07L142XSN', 'B06XYH6966']);
    expect(url).toBe(`${AMAZON_UK_CART_ADD_URL}?ASIN.1=B07L142XSN&Quantity.1=1&ASIN.2=B06XYH6966&Quantity.2=1`);
    expect(url).not.toContain('AssociateTag');
  });
  it('appends AssociateTag only when a valid tag is passed', () => {
    expect(params(buildCartAddUrl(['B07L142XSN'], FAKE_TAG)).get('AssociateTag')).toBe(FAKE_TAG);
    expect(() => buildCartAddUrl(['B07L142XSN'], 'bad')).toThrow(/AssociateTag/);
  });
  it('rejects duplicates, malformed ASINs and an empty basket', () => {
    expect(() => buildCartAddUrl(['B07L142XSN', 'B07L142XSN'])).toThrow(/duplicate/);
    expect(() => buildCartAddUrl(['b07l142xsn'])).toThrow(/invalid ASIN/);
    expect(() => buildCartAddUrl([])).toThrow();
  });
  it('refuses URLs over the length cap', () => {
    const many = Array.from({ length: 60 }, (_, i) => `B${String(i).padStart(9, '0')}`);
    expect(() => buildCartAddUrl(many, FAKE_TAG)).toThrow(/too long/);
  });
});

describe('production gate', () => {
  it('tags only in a production link build', () => {
    expect(basketTag(PROD)).toBe(FAKE_TAG);
    const link = basketLink(['B07L142XSN'], PROD)!;
    expect(params(link.url).get('AssociateTag')).toBe(FAKE_TAG);
    expect(link.rel).toBe('sponsored nofollow noopener');
    expect(link.target).toBe('_blank');
    expect(link.disclosure_text).toMatch(/Amazon Associate/);
  });
  for (const [name, env] of Object.entries(NON_PROD)) {
    it(`${name}: no tag and no basket link`, () => {
      expect(basketTag(env)).toBeNull();
      expect(basketLink(['B07L142XSN'], env)).toBeNull();
      expect(starterKitBasketLink(env)).toBeNull();
    });
  }
  it('rel is "sponsored nofollow noopener" (same as the product buttons)', () => expect(BASKET_LINK_REL).toBe('sponsored nofollow noopener'));
});

describe('starter kit basket', () => {
  const asins = starterKitAsins();
  it('data parses, covers Kieran\u2019s 17 positions (items + gaps), stores no prices or images', () => {
    expect(STARTER_KIT.items.length + STARTER_KIT.gaps.length).toBe(17);
    expect(JSON.stringify(raw)).not.toMatch(/£|"price/i);
    for (const i of STARTER_KIT.items) expect([i.image_url, i.image_width, i.image_height, i.image_source]).toEqual([null, null, null, null]);
  });
  it('every item has passing buyability evidence and a recorded seller', () => {
    for (const i of STARTER_KIT.items) {
      expect(i.buyability).toMatchObject({ featured_offer: true, in_stock: true, add_to_basket: true, outcome: 'pass' });
      expect(i.buyability.seller_rating_note.length).toBeGreaterThan(0);
    }
  });
  it('has every starter ASIN exactly once, numbered 1..n in list order', () => {
    const url = starterKitBasketLink(PROD)!.url;
    expect(numberedAsins(url)).toEqual(asins);
    for (const a of asins) expect(url.split(`=${a}&`).length - 1).toBe(1);
    for (let i = 1; i <= asins.length; i++) expect(params(url).get(`Quantity.${i}`)).toBe('1');
    expect(new Set(asins).size).toBe(asins.length);
  });
  it('excludes the s1-10c (#28) removals', () => {
    for (const a of BASKET_EXCLUDED_ASINS) expect(asins).not.toContain(a);
  });
  it('schema rejects a duplicate, an excluded ASIN and a missing position', () => {
    const clone = () => JSON.parse(JSON.stringify(raw));
    const dup = clone(); dup.items[1].asin = dup.items[0].asin;
    expect(() => parseStarterKitFile(dup)).toThrow();
    const excl = clone(); excl.items[0].asin = BASKET_EXCLUDED_ASINS[0];
    expect(() => parseStarterKitFile(excl)).toThrow();
    const missing = clone(); missing.items.pop();
    expect(() => parseStarterKitFile(missing)).toThrow();
  });
  it('URL length is sane', () => {
    expect(starterKitBasketLink(PROD)!.url.length).toBeLessThanOrEqual(MAX_BASKET_URL_LENGTH);
  });
});

describe('s1-10c exclusions', () => {
  it('match hotfix #28 removals exactly', () => {
    expect([...BASKET_EXCLUDED_ASINS].sort()).toEqual(
      ['B09VBFQNKK', 'B0987MCGXT', 'B0DFVRT79C', 'B0CSSRD4NT', 'B0DCZ82MGG', 'B005AQK6V2', 'B013P5S1KC', 'B0896Q8JXD', 'B001FIQ7XU', 'B09SZB8Y4R', 'B002XNGTOI'].sort(),
    );
  });
});

describe('home picks basket (derived from homeView)', () => {
  it('equals the homepage top picks that get a buy link, in homepage order', async () => {
    const themes = homeThemes(await loadCatalogue(PROD, NOW));
    const expected = themes
      .flatMap((t) => t.picks)
      .map((p) => topPickLink(p.card)?.href)
      .filter((h): h is string => !!h)
      .map((h) => /\/dp\/([A-Z0-9]{10})\?/.exec(h)![1]!)
      .filter((a) => !BASKET_EXCLUDED_ASINS.includes(a));
    // Main today: 11 home picks; 3 are #28 removals (Philips radio, Cano 500ml, HypaGuard) and are dropped until #28 lands.
    expect(expected).toHaveLength(8);
    expect(homeBasketAsins(themes)).toEqual(expected);
    const link = homeBasketLink(themes, PROD)!;
    expect(numberedAsins(link.url)).toEqual(expected);
    expect(new Set(expected).size).toBe(expected.length);
    expect(link.url.length).toBeLessThanOrEqual(MAX_BASKET_URL_LENGTH);
    expect(link.rel).toBe('sponsored nofollow noopener');
    for (const a of BASKET_EXCLUDED_ASINS) expect(link.asins).not.toContain(a);
  });
  it('is null in preview (top picks have no links there)', async () => {
    const themes = homeThemes(await loadCatalogue(NON_PROD.preview!, NOW));
    expect(homeBasketAsins(themes)).toEqual([]);
    expect(homeBasketLink(themes, NON_PROD.preview!)).toBeNull();
  });
});
