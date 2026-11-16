/**
 * S1-10b: 14 more categories (issue #11 contract + Kieran 16 Nov 2026), Amazon kits as ordinary
 * catalogue products, rainwater storage with its drinking-water note, and the legacy kit / EVAQ8
 * data that must never render. Fake tag only; counts only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalogueComparisons, groupComparisonsByCategory, isLegacyKitRecord, isProductVerified } from '../../src/lib/offers/affiliate';
import { parseCatalogueProduct, validateDisplayName } from '../../src/lib/offers/schema';
import { affiliateProgrammes, allOffers, allProducts, catalogueProducts, kitVariants } from '../../src/lib/offers/data';
import {
  CATEGORY_LABELS,
  RENDER_GATED_CATEGORIES,
  KIT_CATEGORIES,
  PRODUCT_CATEGORIES,
  RAINWATER_DRINKING_WATER_NOTE,
  RENDERABLE_CATEGORIES,
  type CatalogueProduct,
} from '../../src/lib/offers/types';
import rawProducts from '../../src/data/catalogue/products.json';
import { KNOWN_UNVERIFIED, TEST_BUYABILITY, VERIFIED_BY_CATEGORY, VERIFIED_COUNT } from './verifiedSet';

const NOW = '2026-11-16T16:00:00+00:00';
const FAKE_TAG = 'TESTONLY-21';
const PROD = { SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG };
const NEW_CATEGORIES = [
  'water_container', 'rainwater_storage', 'gravity_filter', 'flask', 'tin_opener', 'electric_lighter', 'two_way_radio',
  'multi_tool', 'sleeping_bag', 'hygiene', 'baby_care', 'document_pouch', 'home_kit', 'grab_bag_kit',
] as const;
const build = (env: Record<string, string | undefined>, products = allProducts) =>
  buildCatalogueComparisons(products, allOffers, { now: NOW, programmes: affiliateProgrammes, buildEnv: env });
const raw = (asin: string) => JSON.parse(JSON.stringify((rawProducts as { products: CatalogueProduct[] }).products.find((p) => p.asin_uk === asin)));

describe('S1-10b categories', () => {
  it('adds the 14 categories with labels; groupComparisonsByCategory picks them up in PRODUCT_CATEGORIES order', () => {
    for (const c of NEW_CATEGORIES) {
      expect(PRODUCT_CATEGORIES).toContain(c);
      expect(CATEGORY_LABELS[c]).toMatch(/^[A-Z][a-z -]+$/);
    }
    expect(RENDERABLE_CATEGORIES).not.toContain('kit');
    // S1-10b-web un-gates rainwater_storage: Web renders the drinking-water note (section + every card).
    expect(RENDER_GATED_CATEGORIES).toEqual([]);
    expect(RENDERABLE_CATEGORIES).toContain('rainwater_storage');
    expect(KIT_CATEGORIES).toEqual(['home_kit', 'grab_bag_kit']);
    const groups = groupComparisonsByCategory(build(PROD));
    const order = groups.map((g) => g.category);
    expect(order).toEqual(RENDERABLE_CATEGORIES.filter((c) => (VERIFIED_BY_CATEGORY[c]?.length ?? 0) > 0));
    for (const g of groups) expect(g.comparisons.map((c) => c.product.asin_uk)).toEqual(VERIFIED_BY_CATEGORY[g.category]);
  });

  it('verified display names are plain (no standards codes or model numbers)', () => {
    for (const p of catalogueProducts.filter((x) => (NEW_CATEGORIES as readonly string[]).includes(x.category) && x.verification === 'verified')) {
      expect(validateDisplayName(p.display_name!, p), p.asin_uk!).toEqual([]);
      expect(p.display_name).not.toMatch(/PMR\s?446|\bT\d{2}\b|\bR27\b/i);
      expect(p.image_url ?? null).toBeNull();
    }
  });

  it('no prices, availability or images stored for the new records', () => {
    const text = JSON.stringify(rawProducts);
    expect(text).not.toMatch(/£\s?\d|media-amazon\.com|images-amazon\.com/i);
  });
});

describe('S1-10b kits (home_kit, grab_bag_kit)', () => {
  const kits = catalogueProducts.filter((p) => KIT_CATEGORIES.includes(p.category) && p.verification === 'verified');
  it('verified kits carry people, stated_contents, contains_blade and contains_food_water from the listing', () => {
    expect(kits.length).toBe((VERIFIED_BY_CATEGORY.home_kit?.length ?? 0) + (VERIFIED_BY_CATEGORY.grab_bag_kit?.length ?? 0));
    for (const k of kits) {
      const s = k.specs as Record<string, { value: unknown } | undefined>;
      expect(typeof s.people?.value).toBe('number');
      expect(Array.isArray(s.stated_contents?.value)).toBe(true);
      expect(typeof s.contains_blade?.value).toBe('boolean');
      expect(typeof s.contains_food_water?.value).toBe('boolean');
    }
  });
  it('contains_blade is true exactly where the stated contents list a knife (Web shows "Includes a knife")', () => {
    for (const k of kits) {
      const s = k.specs as { stated_contents: { value: string[] }; contains_blade: { value: boolean } };
      expect(s.contains_blade.value, k.asin_uk!).toBe(s.stated_contents.value.some((i) => /knife|blade/i.test(i)));
    }
  });
  it('the schema rejects a verified kit missing a required spec', () => {
    // Mayday is unverified (QA #24 buyability); make a verified copy to exercise the kit rule.
    const r = raw('B005GGMBI2');
    r.verification = 'verified';
    r.display_rank = 1;
    r.verification_evidence = { ...r.verification_evidence, outcome: 'verified', checks_matched: ['title', 'brand', 'model', 'pack_contents'], buyability: TEST_BUYABILITY };
    expect(() => parseCatalogueProduct(r)).not.toThrow();
    delete r.specs.contains_blade;
    expect(() => parseCatalogueProduct(r)).toThrow(/contains_blade/);
  });
});

describe('S1-10b rainwater_storage', () => {
  it('every verified water butt carries the fixed drinking-water note', () => {
    const rw = catalogueProducts.filter((p) => p.category === 'rainwater_storage' && p.verification === 'verified');
    expect(rw.length).toBe(VERIFIED_BY_CATEGORY.rainwater_storage?.length);
    for (const p of rw) {
      expect((p.specs as { drinking_water_note?: { value: string } }).drinking_water_note?.value).toBe(RAINWATER_DRINKING_WATER_NOTE);
      expect(p.notes.some((n) => /not drinking water/i.test(n))).toBe(true);
    }
  });
  it('the note matches the Prepare source exactly and gives no filter / treat / drinkable advice (CR M2)', () => {
    expect(RAINWATER_DRINKING_WATER_NOTE).toBe('Do not drink rainwater from a water butt: it can contain bacteria or disease. Use it to flush toilets or water plants.');
    for (const text of [RAINWATER_DRINKING_WATER_NOTE, ...catalogueProducts.filter((p) => p.category === 'rainwater_storage').flatMap((p) => p.notes)]) {
      expect(text).not.toMatch(/filter|treat|drinkable|purif/i);
    }
  });
  it('without the note a water butt neither parses as verified nor links', () => {
    const r = raw('B00ZUTJAHA');
    delete r.specs.drinking_water_note;
    expect(() => parseCatalogueProduct(r)).toThrow(/drinking_water_note/);
    expect(isProductVerified(r)).toBe(false);
  });
});

describe('S1-10b legacy kit / EVAQ8 data never renders', () => {
  it('the legacy data is still in the repo', () => {
    expect(kitVariants.length).toBeGreaterThan(0);
    expect(allProducts.some(isLegacyKitRecord)).toBe(true);
  });
  it.each([
    ['production', PROD],
    ['preview', { SITE_ENV: 'preview', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }],
    ['no env', {}],
  ])('%s: 0 kit / EVAQ8 items in buildCatalogueComparisons and groupComparisonsByCategory', (_n, env) => {
    // Even with every legacy kit forced to "verified", nothing legacy comes out.
    const forced = allProducts.map((p) => (isLegacyKitRecord(p) ? { ...p, verification: 'verified' as const } : p));
    const built = build(env, forced);
    const bad = (c: { category: string; product: { brand: string; variant_id: string } }) =>
      c.category === 'kit' || /evaq8/i.test(`${c.product.brand} ${c.product.variant_id}`);
    expect(built.comparisons.filter(bad)).toHaveLength(0);
    expect(built.unknown.filter((o) => /evaq8/i.test(o.variant_id))).toHaveLength(0);
    const grouped = groupComparisonsByCategory(built);
    expect(grouped.map((g) => g.category)).not.toContain('kit');
    expect(grouped.flatMap((g) => g.comparisons).filter(bad)).toHaveLength(0);
    expect(JSON.stringify(grouped)).not.toMatch(/evaq8/i);
  });
  it('no page or component reads src/data/kits or the legacy kit exports directly', () => {
    const root = path.resolve(__dirname, '../../src');
    const files: string[] = [];
    (function walk(d: string) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(astro|ts|tsx|js|mjs)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
      }
    })(path.join(root, 'pages'));
    (function walk(d: string) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(astro|ts|tsx|js|mjs)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
      }
    })(path.join(root, 'components'));
    const offenders = files.filter((f) => /data\/kits|kitVariants|kitOffers|allProducts|buildComparisons\(|variants\.json/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });
});

describe('S1-10b QA #24 buyability rule (every verified product)', () => {
  it('every verified record passed a Buy Box check on 16 Nov: featured offer, in stock, Add to Basket, Amazon or well-rated UK seller', () => {
    const verified = catalogueProducts.filter((p) => p.verification === 'verified');
    expect(verified).toHaveLength(VERIFIED_COUNT);
    for (const p of verified) {
      const b = p.verification_evidence!.buyability!;
      expect(b, p.asin_uk!).toBeDefined();
      expect(b.outcome, p.asin_uk!).toBe('pass');
      expect(b.featured_offer && b.in_stock && b.add_to_basket, p.asin_uk!).toBe(true);
      expect(['amazon', 'uk_seller_well_rated'], p.asin_uk!).toContain(b.seller_class);
      expect(b.seller_name, p.asin_uk!).toBeTruthy();
      expect(b.checked_at.startsWith('2026-11-16T'), p.asin_uk!).toBe(true);
      if (b.seller_class === 'uk_seller_well_rated') expect(b.seller_rating_note, p.asin_uk!).toMatch(/country GB|GB VAT/);
    }
  });
  it('every record unverified by the sweep keeps its data and records a failing check with the reason', () => {
    const swept = catalogueProducts.filter((p) => p.verification_evidence?.buyability?.outcome === 'fail');
    expect(swept.length).toBe(19);
    for (const p of swept) {
      expect(p.verification, p.asin_uk!).toBe('unverified');
      expect(p.display_rank ?? null).toBeNull();
      expect(p.verification_evidence!.buyability!.reason, p.asin_uk!).toBeTruthy();
      expect(KNOWN_UNVERIFIED, p.asin_uk!).toContain(p.asin_uk);
    }
    for (const a of ['B00CRE5ZQG', 'B0CMY1SQ3D', 'B07QFSVXZW']) expect(swept.map((p) => p.asin_uk), `QA D1-D3 ${a}`).toContain(a);
  });
  it('the schema rejects a verified product without a passing check', () => {
    const r = raw('B002XNGTOI');
    expect(() => parseCatalogueProduct(r)).not.toThrow();
    const without = JSON.parse(JSON.stringify(r));
    delete without.verification_evidence.buyability;
    expect(() => parseCatalogueProduct(without)).toThrow(/buyability/);
    for (const bad of [{ outcome: 'fail', reason: 'x' }, { in_stock: false }, { featured_offer: false }, { add_to_basket: false }, { seller_class: 'other' }]) {
      const c = JSON.parse(JSON.stringify(r));
      Object.assign(c.verification_evidence.buyability, bad);
      expect(() => parseCatalogueProduct(c), JSON.stringify(bad)).toThrow(/buyability/);
    }
  });
  it('kits: no kit met the 16 Nov kit criteria, so home_kit and grab_bag_kit are empty and the kit records stay as data', () => {
    expect(VERIFIED_BY_CATEGORY.home_kit).toEqual([]);
    expect(VERIFIED_BY_CATEGORY.grab_bag_kit).toEqual([]);
    for (const a of ['B00MCN9AJ0', 'B005GGMBI2', 'B09VTM8P2Z']) {
      expect(catalogueProducts.find((p) => p.asin_uk === a)!.verification, a).toBe('unverified');
      expect(KNOWN_UNVERIFIED, a).toContain(a);
    }
  });
});

describe('S1-10b display_name: ISO paper sizes', () => {
  it('allows A0 to A10 (same rule as Web PAPER_SIZE_TOKEN) but still rejects model-like tokens', () => {
    for (const n of ['OverBoard A3 waterproof document pouch', 'A4 document wallet', 'a10 notebook pouch', 'A0 map case']) expect(validateDisplayName(n), n).toEqual([]);
    for (const n of ['A11 document pouch', 'AB3 pouch', 'A3X pouch', 'OB1105 pouch']) expect(validateDisplayName(n).length, n).toBeGreaterThan(0);
  });
  it('the OverBoard pouch keeps its A3 size_label spec', () => {
    const p = catalogueProducts.find((x) => x.asin_uk === 'B07B19M6DB')!;
    expect((p.specs as { size_label?: { value: string } }).size_label?.value).toBe('A3');
  });
});

describe('S1-10b render gate (CR M1): rainwater_storage un-gated by S1-10b-web', () => {
  it('the verified water butts render, each carrying the exact drinking-water note in its public specs', () => {
    const rwAsins = VERIFIED_BY_CATEGORY.rainwater_storage!;
    expect(rwAsins.length).toBeGreaterThan(0);
    for (const a of rwAsins) expect(catalogueProducts.find((p) => p.asin_uk === a)!.verification).toBe('verified');
    for (const env of [PROD, {}]) {
      const grouped = groupComparisonsByCategory(build(env));
      const g = grouped.find((x) => x.category === 'rainwater_storage');
      expect(g?.comparisons.map((c) => c.product.asin_uk)).toEqual(rwAsins.slice(0, 3));
      for (const c of g!.comparisons) {
        expect((c.product.specs as { drinking_water_note?: string }).drinking_water_note).toBe(RAINWATER_DRINKING_WATER_NOTE);
      }
    }
  });
});

describe('S1-10b N1: Ready America 70510 not UK-sold', () => {
  it('is unverified with the reason recorded and takes no slot (home_kit 0)', () => {
    const p = catalogueProducts.find((x) => x.asin_uk === 'B00MCN9AJ0')!;
    expect(p.verification).toBe('unverified');
    expect(p.display_rank ?? null).toBeNull();
    expect(p.verification_evidence!.note).toMatch(/US business address/);
    expect(VERIFIED_BY_CATEGORY.home_kit).toEqual([]);
    expect(KNOWN_UNVERIFIED).toContain('B00MCN9AJ0');
  });
});

describe('S1-10b fake-tag library probe (counts only)', () => {
  const links = (env: Record<string, string | undefined>) =>
    groupComparisonsByCategory(build(env)).flatMap((g) => g.comparisons).flatMap((c) => c.offers).filter((o) => o.link_url !== null);
  const RENDERED = Object.entries(VERIFIED_BY_CATEGORY)
    .filter(([c]) => !(RENDER_GATED_CATEGORIES as readonly string[]).includes(c))
    .flatMap(([, a]) => a as readonly string[]);
  it('production = every verified, non-gated product, each linked once (derived; nothing gated after S1-10b-web)', () => {
    const l = links(PROD);
    expect(VERIFIED_COUNT).toBe(49); // 67 - 19 unverified by the QA #24 buyability sweep + 1 Duronic radio
    expect(RENDERED).toHaveLength(VERIFIED_COUNT);
    expect(l).toHaveLength(RENDERED.length);
    expect(new Set(l.map((o) => o.link_url)).size).toBe(RENDERED.length);
    const expected = RENDERED.map((a) => `https://www.amazon.co.uk/dp/${a}?tag=${FAKE_TAG}`).sort();
    expect(l.map((o) => o.link_url!).sort()).toEqual(expected);
  });
  it.each([
    ['no SITE_ENV', { AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }],
    ['SITE_ENV=preview', { SITE_ENV: 'preview', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }],
    ['Cloudflare branch preview', { ...PROD, CF_PAGES: '1', CF_PAGES_BRANCH: 's1-10b-more-categories' }],
    ['production without a tag', { SITE_ENV: 'production' }],
  ])('%s => 0 links', (_n, env) => {
    expect(links(env)).toHaveLength(0);
  });
  it('known-unverified records (incl. Simply B00MGM3K7A and the 16 Nov re-check failures) never link', () => {
    const l = links(PROD).map((o) => o.link_url!);
    for (const a of KNOWN_UNVERIFIED) expect(l.some((u) => u.includes(a))).toBe(false);
  });
});
