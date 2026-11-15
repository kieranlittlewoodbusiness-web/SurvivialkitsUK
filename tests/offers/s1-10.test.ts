/**
 * S1-10 (#11): three Amazon options per category. Category split and new categories, CATEGORY_LABELS,
 * display_name / display_rank / image_* product fields, groupComparisonsByCategory, and a
 * production-link probe with a FAKE tag (counts only).
 */
import { describe, expect, it } from 'vitest';
import {
  buildCatalogueComparisons,
  groupComparisonsByCategory,
  isProductVerified,
  isShortlistable,
} from '../../src/lib/offers/affiliate';
import {
  ALLOWED_IMAGE_HOSTS,
  DISPLAY_NAME_MAX_LENGTH,
  isAllowedImageUrl,
  migrateLegacyProductCategory,
  parseCatalogueProduct,
  parseCatalogueProductsFile,
  parseOffer,
  validateDisplayName,
} from '../../src/lib/offers/schema';
import { affiliateProgrammes, allOffers, allProducts, catalogueOffers, catalogueProducts } from '../../src/lib/offers/data';
import rawProducts from '../../src/data/catalogue/products.json';
import { THERMAL_SIZE_CHILDREN, VERIFIED_ASINS, VERIFIED_BY_CATEGORY, VERIFIED_COUNT } from './verifiedSet';
import rawOffers from '../../src/data/catalogue/offers.json';
import {
  CATEGORY_LABELS,
  LEGACY_CATEGORY_WIND_UP_TORCH_RADIO,
  PRODUCT_CATEGORIES,
  type AffiliateDisplayOffer,
  type CatalogueComparison,
  type CatalogueProduct,
  type ProductCategory,
  type PublicProductSummary,
} from '../../src/lib/offers/types';

const T = '2026-11-14T20:00:00+00:00';
const NOW = '2026-11-15T12:00:00+00:00';
const FAKE_TAG = 'FAKETESTONLY-21';

function src(asin: string) {
  return { name: 'TEST', url: `https://www.amazon.co.uk/dp/${asin}` };
}

function evidence(asin: string, category: string) {
  const sized = category === 'thermal_clothing' || category === 'hi_vis';
  return {
    method: 'public_listing' as const,
    source_url: `https://www.amazon.co.uk/dp/${asin}`,
    checked_on: '2026-11-15',
    outcome: 'verified' as const,
    checks_matched: (sized ? ['title', 'brand', 'model', 'pack_contents', 'size'] : ['title', 'brand', 'model', 'pack_contents']) as (
      | 'title'
      | 'brand'
      | 'model'
      | 'pack_contents'
      | 'size'
    )[],
    note: 'TEST',
  };
}

function raw(over: Record<string, unknown> = {}): Record<string, unknown> {
  const asin = (over.asin_uk as string | undefined) ?? 'B0CZ9LH53B';
  const category = (over.category as string | undefined) ?? 'power_bank';
  const base: Record<string, unknown> = {
    schema_version: 2,
    variant_id: 'p-1',
    category,
    product_name: 'Anker Zolo Power Bank, 20,000mAh 30W Portable Charger with Built-in USB-C',
    brand: 'Anker',
    asin_uk: asin,
    gtin: null,
    mpn: 'A1689011',
    model_code: 'A1689',
    pack_quantity: null,
    specs: {},
    source: src(asin),
    captured_at: T,
    verification: 'verified',
    display_name: 'Anker Zolo 20,000mAh power bank',
    notes: [],
    ...over,
  };
  if (base.verification === 'verified' && !('verification_evidence' in over)) base.verification_evidence = evidence(asin, category);
  return base;
}

/* ---------- categories ---------- */

describe('S1-10 categories', () => {
  it('splits wind_up_torch_radio into torch and radio and adds batteries, hi_vis, jump_leads, warning_triangle', () => {
    expect(PRODUCT_CATEGORIES).toEqual([
      'kit',
      'emergency_water',
      'first_aid_kit',
      'torch',
      'radio',
      'power_bank',
      'batteries',
      'emergency_blanket',
      'thermal_clothing',
      'hi_vis',
      'jump_leads',
      'warning_triangle',
    ]);
    expect(PRODUCT_CATEGORIES).not.toContain(LEGACY_CATEGORY_WIND_UP_TORCH_RADIO);
  });

  it('has a plain-English label for every category and nothing else', () => {
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual([...PRODUCT_CATEGORIES].sort());
    for (const c of PRODUCT_CATEGORIES) {
      expect(CATEGORY_LABELS[c]).toMatch(/^[A-Z][a-z -]+$/);
      expect(CATEGORY_LABELS[c]).not.toMatch(/_/);
    }
  });

  it.each([
    ['batteries', { size: 'AA', chemistry: 'alkaline', pack_count: 12 }],
    ['hi_vis', { standard: 'EN ISO 20471 Class 2', size_label: 'XL', pack_count: 1 }],
    ['jump_leads', { length_m: 3.5, max_current_a: 400, cable_gauge_mm2: 16 }],
    ['warning_triangle', { e_marked: true, ece_r27: true, pack_count: 1 }],
    ['torch', { device_type: 'torch', power_sources: ['aa'], lumens: 300 }],
    ['radio', { device_type: 'torch_radio', radio_bands: ['AM', 'FM'] }],
  ] as const)('accepts sourced %s specs', (category, values) => {
    const specs = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v, source: src('B0CZ9LH53B'), captured_at: T }]));
    expect(() => parseCatalogueProduct(raw({ category, specs }))).not.toThrow();
  });

  it('rejects unknown or mistyped specs in the new categories', () => {
    const s = (v: unknown) => ({ value: v, source: src('B0CZ9LH53B'), captured_at: T });
    expect(() => parseCatalogueProduct(raw({ category: 'batteries', specs: { size: s('AAAA') } }))).toThrow();
    expect(() => parseCatalogueProduct(raw({ category: 'jump_leads', specs: { length_m: s(-1) } }))).toThrow();
    expect(() => parseCatalogueProduct(raw({ category: 'warning_triangle', specs: { e_marked: s('yes') } }))).toThrow();
    expect(() => parseCatalogueProduct(raw({ category: 'hi_vis', specs: { colour: s('yellow') } }))).toThrow();
  });

  it('a verified warning_triangle needs e_marked or ece_r27 === true on the listing', () => {
    const s = (v: unknown) => ({ value: v, source: src('B0CZ9LH53B'), captured_at: T });
    const tri = (specs: Record<string, unknown>, verification = 'verified') => raw({ category: 'warning_triangle', specs, verification });
    expect(() => parseCatalogueProduct(tri({}))).toThrow(/e_marked or ece_r27/);
    expect(() => parseCatalogueProduct(tri({ e_marked: s(false), ece_r27: s(false) }))).toThrow(/e_marked or ece_r27/);
    expect(() => parseCatalogueProduct(tri({ e_marked: s(true) }))).not.toThrow();
    expect(() => parseCatalogueProduct(tri({ ece_r27: s(true) }))).not.toThrow();
    expect(() => parseCatalogueProduct(tri({}, 'unverified'))).not.toThrow();
    // Belt and braces on the record gate too.
    expect(isProductVerified(tri({ e_marked: s(true) }) as unknown as CatalogueProduct)).toBe(true);
    expect(isProductVerified(tri({ e_marked: s(false) }) as unknown as CatalogueProduct)).toBe(false);
  });

  it('a verified hi_vis needs one exact size (size_label and the size check), like thermals', () => {
    const s = (v: unknown) => ({ value: v, source: src('B0CZ9LH53B'), captured_at: T });
    expect(() => parseCatalogueProduct(raw({ category: 'hi_vis', specs: {} }))).toThrow(/size_label/);
    expect(() =>
      parseCatalogueProduct(raw({ category: 'hi_vis', specs: { size_label: s('XL') }, verification_evidence: evidence('B0CZ9LH53B', 'power_bank') })),
    ).toThrow(/size/);
    expect(() => parseCatalogueProduct(raw({ category: 'hi_vis', specs: { size_label: s('XL') } }))).not.toThrow();
  });
});

describe('S1-10 category migration (wind_up_torch_radio)', () => {
  it('the repo data no longer uses the legacy slug', () => {
    expect(JSON.stringify(rawProducts)).not.toContain(LEGACY_CATEGORY_WIND_UP_TORCH_RADIO);
    expect(JSON.stringify(rawOffers)).not.toContain(LEGACY_CATEGORY_WIND_UP_TORCH_RADIO);
  });

  it('migrated the three wind-up torch radios to radio, data otherwise preserved', () => {
    const migrated = ['B08V17BPBC', 'B0987MCGXT', 'B09VBFQNKK'];
    const torchRadios = catalogueProducts.filter((p) => (p.specs as { device_type?: { value: string } }).device_type?.value === 'torch_radio');
    expect(torchRadios.map((p) => p.asin_uk).sort()).toEqual(migrated);
    for (const p of torchRadios) expect(p.category).toBe('radio');
    for (const a of migrated) expect(catalogueOffers.find((o) => o.asin === a)!.category).toBe('radio');
    // Devices whose device_type is 'torch' all sit in torch (incl. the PR #17 Energizers ported from the old slug).
    for (const p of catalogueProducts.filter((x) => (x.specs as { device_type?: { value: string } }).device_type?.value === 'torch')) expect(p.category).toBe('torch');
  });

  it('legacy product rows still parse and migrate by device_type', () => {
    const legacy = (device?: string) => {
      const r = raw({ verification: 'unverified', display_name: null, category: LEGACY_CATEGORY_WIND_UP_TORCH_RADIO });
      r.specs = device ? { device_type: { value: device, source: src('B0CZ9LH53B'), captured_at: T } } : {};
      return r;
    };
    expect(parseCatalogueProduct(legacy('torch')).category).toBe('torch');
    expect(parseCatalogueProduct(legacy('radio')).category).toBe('radio');
    expect(parseCatalogueProduct(legacy('torch_radio')).category).toBe('radio');
    expect(parseCatalogueProduct(legacy()).category).toBe('radio');
    expect(migrateLegacyProductCategory({ category: 'power_bank' })).toEqual({ category: 'power_bank' });
  });

  it('the pre-migration products file still parses, with identical records apart from category', () => {
    const legacyFile = JSON.parse(JSON.stringify(rawProducts).replaceAll('"category":"radio"', `"category":"${LEGACY_CATEGORY_WIND_UP_TORCH_RADIO}"`));
    const parsed = parseCatalogueProductsFile(legacyFile, { now: NOW });
    expect(parsed.products).toEqual(catalogueProducts);
  });

  it('legacy offer rows still parse (category becomes radio)', () => {
    const o = (rawOffers as { offers: Record<string, unknown>[] }).offers.find((r) => r.category === 'radio')!;
    expect(parseOffer({ ...o, category: LEGACY_CATEGORY_WIND_UP_TORCH_RADIO }, { now: NOW }).category).toBe('radio');
  });
});

/* ---------- display_name ---------- */

describe('S1-10 display_name validator', () => {
  const anker = { brand: 'Anker', model_code: 'A1689', mpn: 'A1689011' };
  const ugreen = { brand: 'UGREEN', model_code: 'PB312', manufacturer_sku: '25683', listing_mpn: 'TSADF7G5634' };

  it.each([
    ['Anker 10,000mAh power bank', anker],
    ['Anker Zolo 20,000mAh power bank', anker],
    ['UGREEN Nexode 20,000mAh power bank', ugreen],
    ['Wallace Cameron workplace first aid kit (medium)', { brand: 'Wallace Cameron' }],
    ['St John Ambulance vehicle first aid kit (medium)', { brand: 'St John Ambulance', model_code: 'F30801' }],
    ['Cano still spring water cans (12 x 500ml)', { brand: 'Cano', model_code: 'STXO500' }],
    ['ROCAM wind-up DAB radio with torch', { brand: 'ROCAM', model_code: 'CR1009PRO DAB' }],
    ['PRUNUS wind-up solar AM/FM radio', { brand: 'PRUNUS', model_code: 'J-369' }],
    ['Duracell Plus AA batteries (12-pack)', { brand: 'Duracell' }],
    ['Ring 3.5m 400A jump leads', { brand: 'Ring' }],
    ['E-marked warning triangle', { brand: 'Generic' }],
    ['SOLARBABY wind-up radio', { brand: 'SOLARBABY', model_code: 'Radio' }],
  ])('accepts %j', (name, id) => {
    expect(validateDisplayName(name, id)).toEqual([]);
  });

  it.each([
    ['St John Ambulance BS 8599-2:2014 vehicle first aid kit', 'standards'],
    ['Reliance Medical BS8599-1 workplace kit', 'standards'],
    ['Hi-vis vest EN 20471 class 2', 'standards'],
    ['Hi-vis vest en471', 'standards'],
    ['Hi-vis vest ISO 20471', 'standards'],
    ['UGREEN PB312 power bank', 'model/part'],
    ['Energizer ESFH21 torch', 'model/part'],
    ['PRUNUS J-369 radio', 'model/part'],
    ['UGREEN power bank 25683', 'SKU'],
    ['UGREEN power bank tsadf7g5634', 'model/part'],
    ['Anker A1689 power bank', 'model/part'],
    ['EMERGENCY SURVIVAL foil blanket', 'ALL-CAPS'],
    ['Foil blanket NEW HOT UK', 'ALL-CAPS'],
    ['ANKER POWER BANK', 'capitals'],
    ['Anker power bank | 20,000mAh', 'separators'],
    ['Heatwave® thermal top', 'separators'],
    [`Anker ${'very '.repeat(12)}long power bank`, `${DISPLAY_NAME_MAX_LENGTH} characters`],
    [' Anker power bank', 'leading/trailing'],
  ])('rejects %j (%s)', (name, why) => {
    const issues = validateDisplayName(name, name.startsWith('UGREEN') ? ugreen : anker);
    expect(issues.join(' | ')).toContain(why);
  });

  it("rejects the product's own model / mpn / SKU / listing_mpn tokens", () => {
    expect(validateDisplayName('Anker a1689011 bank', anker).join()).toMatch(/own model/);
    expect(validateDisplayName('UGREEN pb312 bank', ugreen).join()).toMatch(/own model/);
    expect(validateDisplayName('UGREEN 25683 bank', ugreen).join()).toMatch(/own model/);
  });

  it('is enforced at parse time and required when verified', () => {
    expect(() => parseCatalogueProduct(raw())).not.toThrow();
    expect(() => parseCatalogueProduct(raw({ display_name: undefined }))).toThrow(/display_name/);
    expect(() => parseCatalogueProduct(raw({ display_name: null }))).toThrow(/display_name/);
    expect(() => parseCatalogueProduct(raw({ display_name: 'Anker A1689 power bank' }))).toThrow(/display_name/);
    expect(() => parseCatalogueProduct(raw({ display_name: 'First aid kit BS 8599-1' }))).toThrow(/standards/);
    // Unverified products may omit it, but a supplied one is still validated.
    expect(() => parseCatalogueProduct(raw({ verification: 'unverified', display_name: undefined }))).not.toThrow();
    expect(() => parseCatalogueProduct(raw({ verification: 'unverified', display_name: 'Anker A1689 power bank' }))).toThrow(/display_name/);
  });

  it('every verified product in the data has a valid display_name; product_name keeps the full title', () => {
    const verified = catalogueProducts.filter((p) => p.verification === 'verified');
    expect(verified).toHaveLength(VERIFIED_COUNT);
    for (const p of verified) {
      expect(p.display_name).toBeTruthy();
      expect(validateDisplayName(p.display_name!, p)).toEqual([]);
      expect(p.display_name).not.toMatch(/\bBS\s?\d|\bEN\s?\d|ISO\s?\d/);
      expect(p.product_name.length).toBeGreaterThan(0);
    }
  });
});

/* ---------- images ---------- */

describe('S1-10 image fields', () => {
  const img = 'https://m.media-amazon.com/images/I/41abcDEF12L._SL160_.jpg';

  it('allows only https m.media-amazon.com, with no query string or fragment', () => {
    expect(ALLOWED_IMAGE_HOSTS).toEqual(['m.media-amazon.com']);
    expect(isAllowedImageUrl(img)).toBe(true);
    for (const bad of [
      'http://m.media-amazon.com/images/I/x.jpg',
      'https://images-eu.ssl-images-amazon.com/images/I/x.jpg',
      'https://ws-eu.amazon-adsystem.com/widgets/q?ASIN=B0CZ9LH53B',
      'https://m.media-amazon.com.evil.example/x.jpg',
      'https://evil.example/m.media-amazon.com/x.jpg',
      'https://m.media-amazon.com/images/I/x.jpg?tag=x-21',
      'https://m.media-amazon.com/images/I/x.jpg#x',
      'https://user@m.media-amazon.com/images/I/x.jpg',
      'https://m.media-amazon.com:8443/images/I/x.jpg',
      'not a url',
    ]) {
      expect(isAllowedImageUrl(bad), bad).toBe(false);
    }
  });

  it('parse: image_url needs an allowed host and image_source paapi; null url means all image fields null', () => {
    expect(() => parseCatalogueProduct(raw({ image_url: img, image_source: 'paapi', image_width: 160, image_height: 160 }))).not.toThrow();
    expect(() => parseCatalogueProduct(raw({ image_url: img, image_source: null }))).toThrow(/image_source/);
    expect(() => parseCatalogueProduct(raw({ image_url: img, image_source: 'sitestripe' }))).toThrow();
    expect(() => parseCatalogueProduct(raw({ image_url: 'https://images-eu.ssl-images-amazon.com/images/I/x.jpg', image_source: 'paapi' }))).toThrow(/image_url/);
    expect(() => parseCatalogueProduct(raw({ image_url: null, image_source: 'paapi' }))).toThrow(/image_source/);
    expect(() => parseCatalogueProduct(raw({ image_url: null, image_width: 160 }))).toThrow(/image_width/);
    expect(() => parseCatalogueProduct(raw({ image_url: img, image_source: 'paapi', image_width: 0 }))).toThrow();
    expect(() => parseCatalogueProduct(raw({ image_url: img, image_source: 'paapi', image_height: 1.5 }))).toThrow();
    expect(() => parseCatalogueProduct(raw({ image_url: null, image_width: null, image_height: null, image_source: null }))).not.toThrow();
  });

  it('stores no images: every image field in the data is absent or null', () => {
    for (const p of catalogueProducts) {
      expect(p.image_url ?? null).toBeNull();
      expect(p.image_width ?? null).toBeNull();
      expect(p.image_height ?? null).toBeNull();
      expect(p.image_source ?? null).toBeNull();
    }
  });

  it('display_rank is an integer 1-3', () => {
    for (const r of [1, 2, 3, null]) expect(() => parseCatalogueProduct(raw({ display_rank: r }))).not.toThrow();
    for (const r of [0, 4, 1.5, '1']) expect(() => parseCatalogueProduct(raw({ display_rank: r }))).toThrow();
  });
});

/* ---------- groupComparisonsByCategory ---------- */

function summary(over: Partial<PublicProductSummary> = {}): PublicProductSummary {
  return {
    variant_id: 'v',
    category: 'power_bank',
    product_name: 'P',
    brand: 'B',
    asin_uk: null,
    gtin: null,
    mpn: null,
    model_code: null,
    pack_quantity: null,
    verification: 'verified',
    specs: {},
    source_name: 'TEST',
    captured_at: T,
    display_name: 'Test product',
    display_rank: null,
    image_url: null,
    image_width: null,
    image_height: null,
    image_source: null,
    ...over,
  };
}

function cmp(id: string, category: ProductCategory, over: Partial<PublicProductSummary> = {}, modelMatch = true): CatalogueComparison {
  return {
    variant_id: id,
    category,
    product: summary({ variant_id: id, category, ...over }),
    offers: [{ offer_id: `${id}-o`, variant_id: id, model_match_confirmed: modelMatch } as AffiliateDisplayOffer],
    excluded: [],
    best_price_offer_id: null,
    same_capture_window: true,
    savings: null,
    disclosures: [],
  };
}

const ids = (g: ReturnType<typeof groupComparisonsByCategory>) => g.map((x) => [x.category, x.comparisons.map((c) => c.variant_id)]);

describe('S1-10 groupComparisonsByCategory', () => {
  it('gate: verified + isProductVerified + a model-confirmed offer', () => {
    const out = groupComparisonsByCategory([
      cmp('ok', 'power_bank'),
      cmp('unverified', 'power_bank', { verification: 'unverified' }),
      cmp('no-match', 'power_bank', {}, false),
      { ...cmp('no-offers', 'power_bank'), offers: [] },
      cmp('thermal-nosize', 'thermal_clothing'),
      cmp('thermal-sized', 'thermal_clothing', { specs: { size_label: 'M' } }),
      cmp('tri-not-emarked', 'warning_triangle', { specs: { e_marked: false } }),
      cmp('tri-emarked', 'warning_triangle', { specs: { ece_r27: true } }),
      cmp('hivis-nosize', 'hi_vis'),
    ]);
    expect(ids(out)).toEqual([
      ['power_bank', ['ok']],
      ['thermal_clothing', ['thermal-sized']],
      ['warning_triangle', ['tri-emarked']],
    ]);
    expect(isShortlistable(cmp('x', 'power_bank', {}, false))).toBe(false);
  });

  it('sorts by display_rank, ranked before unranked, ties in source order', () => {
    const out = groupComparisonsByCategory([
      cmp('a-unranked', 'radio'),
      cmp('b-rank2', 'radio', { display_rank: 2 }),
      cmp('c-rank1', 'radio', { display_rank: 1 }),
      cmp('d-rank2', 'radio', { display_rank: 2 }),
    ], { perCategory: 4 });
    expect(ids(out)).toEqual([['radio', ['c-rank1', 'b-rank2', 'd-rank2', 'a-unranked']]]);
  });

  it('caps at perCategory (default 3)', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((x) => cmp(x, 'batteries'));
    expect(ids(groupComparisonsByCategory(many))).toEqual([['batteries', ['a', 'b', 'c']]]);
    expect(ids(groupComparisonsByCategory(many, { perCategory: 1 }))).toEqual([['batteries', ['a']]]);
    expect(() => groupComparisonsByCategory(many, { perCategory: 0 })).toThrow(RangeError);
  });

  it('drops empty categories and follows PRODUCT_CATEGORIES order, with labels', () => {
    const out = groupComparisonsByCategory([
      cmp('w', 'warning_triangle', { specs: { e_marked: true } }),
      cmp('t', 'torch'),
      cmp('x', 'emergency_water'),
      cmp('u', 'jump_leads', { verification: 'unverified' }),
    ]);
    expect(out.map((g) => g.category)).toEqual(['emergency_water', 'torch', 'warning_triangle']);
    expect(out.map((g) => g.category_label)).toEqual([CATEGORY_LABELS.emergency_water, CATEGORY_LABELS.torch, CATEGORY_LABELS.warning_triangle]);
    expect(groupComparisonsByCategory([])).toEqual([]);
  });

  it('accepts buildCatalogueComparisons() output directly; real data -> the verified set, in rank order', () => {
    const built = buildCatalogueComparisons(allProducts, allOffers, { now: NOW, programmes: affiliateProgrammes, buildEnv: {} });
    const out = groupComparisonsByCategory(built, { perCategory: 3 });
    expect(out).toEqual(groupComparisonsByCategory(built.comparisons, { perCategory: 3 }));
    const expected = PRODUCT_CATEGORIES.filter((c) => VERIFIED_BY_CATEGORY[c]?.length).map((c) => [c, [...VERIFIED_BY_CATEGORY[c]!]]);
    expect(out.map((g) => [g.category, g.comparisons.map((c) => c.product.asin_uk)])).toEqual(expected);
    for (const g of out) {
      for (const c of g.comparisons) {
        expect(c.product.display_name).toBeTruthy();
        expect(c.product).toHaveProperty('display_rank');
        expect(c.product.image_url).toBeNull();
        expect(c.product.image_width).toBeNull();
        expect(c.product.image_height).toBeNull();
        expect(c.product.image_source).toBeNull();
      }
    }
  });
});

/* ---------- production probe (FAKE tag, counts only) ---------- */

describe('S1-10 production-link probe (fake tag)', () => {
  const linkCount = (env: Record<string, string | undefined>) => {
    const built = buildCatalogueComparisons(allProducts, allOffers, { now: NOW, programmes: affiliateProgrammes, buildEnv: env });
    const grouped = groupComparisonsByCategory(built);
    const all = built.comparisons.flatMap((c) => c.offers).filter((o) => o.link_url !== null);
    const shown = grouped.flatMap((g) => g.comparisons).flatMap((c) => c.offers).filter((o) => o.link_url !== null);
    return {
      all: all.length,
      shown: shown.length,
      sponsored: shown.filter((o) => o.link_rel === 'sponsored nofollow').length,
      tagged: shown.filter((o) => (o.link_url ?? '').endsWith(`?tag=${FAKE_TAG}`)).length,
      dp: shown.filter((o) => (o.link_url ?? '').startsWith('https://www.amazon.co.uk/dp/')).length,
    };
  };

  it('production: exactly VERIFIED_COUNT links, all sponsored nofollow amazon.co.uk/dp with the tag', () => {
    const n = VERIFIED_COUNT;
    expect(n).toBe(30);
    expect(linkCount({ SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG })).toEqual({ all: n, shown: n, sponsored: n, tagged: n, dp: n });
  });

  it.each([
    ['no SITE_ENV', { AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }],
    ['SITE_ENV=preview', { SITE_ENV: 'preview', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }],
    ['Cloudflare branch preview', { SITE_ENV: 'production', CF_PAGES: '1', CF_PAGES_BRANCH: 's1-10-three-per-category', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }],
    ['production without a tag', { SITE_ENV: 'production' }],
  ])('%s: 0 links', (_k, env) => {
    expect(linkCount(env)).toEqual({ all: 0, shown: 0, sponsored: 0, tagged: 0, dp: 0 });
  });
});

/* ---------- verified-set invariants ---------- */

describe('S1-10 verified-set invariants (committed data)', () => {
  const verified = catalogueProducts.filter((p) => p.verification === 'verified');

  it('the verified set equals tests/offers/verifiedSet.ts', () => {
    expect(verified.map((p) => p.asin_uk!).sort()).toEqual([...VERIFIED_ASINS]);
    for (const [cat, asins] of Object.entries(VERIFIED_BY_CATEGORY)) {
      const inCat = verified.filter((p) => p.category === cat).sort((a, b) => a.display_rank! - b.display_rank!);
      expect(inCat.map((p) => p.asin_uk)).toEqual([...asins!]);
    }
  });

  it('every verified product: display_name, display_rank 1-3 unique per category, at most 3 per category, images null, model-confirmed offer', () => {
    const byCat = new Map<string, CatalogueProduct[]>();
    for (const p of verified) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
    for (const [cat, list] of byCat) {
      expect(list.length, cat).toBeLessThanOrEqual(3);
      const ranks = list.map((p) => p.display_rank);
      expect(new Set(ranks).size, cat).toBe(ranks.length);
      for (const r of ranks) expect([1, 2, 3]).toContain(r);
    }
    for (const p of verified) {
      expect(p.display_name, p.asin_uk!).toBeTruthy();
      expect(validateDisplayName(p.display_name!, p)).toEqual([]);
      expect(p.image_url).toBeNull();
      expect(p.image_width).toBeNull();
      expect(p.image_height).toBeNull();
      expect(p.image_source).toBeNull();
      const offers = catalogueOffers.filter((o) => o.variant_id === p.variant_id);
      expect(offers.length, p.asin_uk!).toBeGreaterThan(0);
      expect(offers.some((o) => o.model_match_confirmed === true && o.asin === p.asin_uk), p.asin_uk!).toBe(true);
      for (const o of offers) {
        expect(o.price_gbp_inc_vat).toBeNull();
        expect(o.price_origin).toBe('none');
        expect(o.affiliate_url).toBe('');
      }
      expect(p.verification_evidence!.checked_on).toBe('2026-11-15');
      expect(p.verification_evidence!.canonical_asin).toBe(p.size_child_of ?? p.asin_uk);
    }
  });

  it('unverified records carry no display_rank, so they never take a slot', () => {
    for (const p of catalogueProducts.filter((x) => x.verification !== 'verified')) expect(p.display_rank ?? null).toBeNull();
  });

  it('the PR #17 Energizers are preserved as unverified torches (not currently purchasable)', () => {
    for (const a of ['B01F1LUW6Y', 'B00SBD0WL0']) {
      const p = catalogueProducts.find((x) => x.asin_uk === a)!;
      expect(p.category).toBe('torch');
      expect(p.verification).toBe('unverified');
      expect(p.verification_evidence!.note).toMatch(/not currently purchasable on 2026-11-15/);
    }
  });

  it('thermal size children point at their parent canonical', () => {
    for (const [child, parent] of Object.entries(THERMAL_SIZE_CHILDREN)) {
      const p = catalogueProducts.find((x) => x.asin_uk === child)!;
      expect(p.category).toBe('thermal_clothing');
      expect(p.size_child_of).toBe(parent);
      expect(p.verification_evidence!.canonical_asin).toBe(parent);
      expect((p.specs as { size_label?: { value: string } }).size_label?.value).toBeTruthy();
      expect(p.display_name).toMatch(/\((men's|women's), [A-Z0-9-]+\)$/);
    }
  });
});

/* ---------- size_child_of (PM ruling, option b) ---------- */

describe('S1-10 size_child_of (thermal size children)', () => {
  const s = (v: unknown) => ({ value: v, source: src('B004KMGZG2'), captured_at: T });
  const child = (over: Record<string, unknown> = {}, ev: Record<string, unknown> = {}) =>
    raw({
      category: 'thermal_clothing',
      asin_uk: 'B004KMGZG2',
      model_code: 'TRU112',
      mpn: null,
      brand: 'Regatta',
      display_name: "Regatta thermal base layer top (men's, M)",
      size_child_of: 'B0DMT14LGZ',
      specs: { size_label: s('M') },
      verification_evidence: { ...evidence('B004KMGZG2', 'thermal_clothing'), canonical_asin: 'B0DMT14LGZ', ...ev },
      ...over,
    });

  it('a thermal size child verifies when canonical == size_child_of and size_label is set', () => {
    expect(() => parseCatalogueProduct(child())).not.toThrow();
    expect(isProductVerified(parseCatalogueProduct(child()))).toBe(true);
  });

  it('rejects a verified size child whose evidence does not record the parent canonical', () => {
    expect(() => parseCatalogueProduct(child({}, { canonical_asin: undefined }))).toThrow(/canonical_asin equal to size_child_of/);
    expect(() => parseCatalogueProduct(child({}, { canonical_asin: 'B004KMGZG2' }))).toThrow(/canonical_asin equal to size_child_of/);
    expect(() => parseCatalogueProduct(child({}, { canonical_asin: 'B0CKXG19WH' }))).toThrow(/canonical_asin equal to size_child_of/);
  });

  it('rejects a size child without size_label (verified or not)', () => {
    expect(() => parseCatalogueProduct(child({ specs: {} }))).toThrow(/size_label/);
    expect(() => parseCatalogueProduct(child({ specs: {}, verification: 'unverified', verification_evidence: undefined }))).toThrow(/size_label/);
  });

  it('rejects size_child_of equal to asin_uk, or not ASIN-shaped', () => {
    expect(() => parseCatalogueProduct(child({ size_child_of: 'B004KMGZG2' }, { canonical_asin: 'B004KMGZG2' }))).toThrow(/must differ/);
    expect(() => parseCatalogueProduct(child({ size_child_of: 'parent-tbd' }))).toThrow();
  });

  it.each(PRODUCT_CATEGORIES.filter((c) => c !== 'kit' && c !== 'thermal_clothing'))('rejects size_child_of on %s', (category) => {
    const r = raw({ category, size_child_of: 'B0DMT14LGZ', specs: {}, verification: 'unverified', display_name: null });
    expect(() => parseCatalogueProduct(r)).toThrow(/only allowed for thermal_clothing/);
  });

  it('every other category keeps canonical == asin_uk', () => {
    const pb = (canonical: string) => raw({ verification_evidence: { ...evidence('B0CZ9LH53B', 'power_bank'), canonical_asin: canonical } });
    expect(() => parseCatalogueProduct(pb('B0CZ9LH53B'))).not.toThrow();
    expect(() => parseCatalogueProduct(pb('B0DMT14LGZ'))).toThrow(/canonical_asin must equal asin_uk/);
    // A thermal without size_child_of is held to the same rule.
    const th = raw({ category: 'thermal_clothing', specs: { size_label: s('M') }, verification_evidence: { ...evidence('B0CZ9LH53B', 'thermal_clothing'), canonical_asin: 'B0DMT14LGZ' } });
    expect(() => parseCatalogueProduct(th)).toThrow(/canonical_asin must equal asin_uk/);
  });

  it('size_child_of is null-safe and optional', () => {
    expect(() => parseCatalogueProduct(raw({ size_child_of: null }))).not.toThrow();
    expect(() => parseCatalogueProduct(raw())).not.toThrow();
  });
});
