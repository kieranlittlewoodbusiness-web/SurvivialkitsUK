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
    const radios = catalogueProducts.filter((p) => p.category === 'radio');
    expect(radios.map((p) => p.asin_uk).sort()).toEqual(['B08V17BPBC', 'B0987MCGXT', 'B09VBFQNKK']);
    for (const p of radios) expect((p.specs as { device_type?: { value: string } }).device_type?.value).toBe('torch_radio');
    expect(catalogueProducts.filter((p) => p.category === 'torch')).toEqual([]);
    expect(catalogueOffers.filter((o) => o.category === 'radio').map((o) => o.asin).sort()).toEqual(['B08V17BPBC', 'B0987MCGXT', 'B09VBFQNKK']);
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
    expect(verified).toHaveLength(9);
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

  it('accepts buildCatalogueComparisons() output directly; real data -> 9 products in 5 categories', () => {
    const built = buildCatalogueComparisons(allProducts, allOffers, { now: NOW, programmes: affiliateProgrammes, buildEnv: {} });
    const out = groupComparisonsByCategory(built, { perCategory: 3 });
    expect(out).toEqual(groupComparisonsByCategory(built.comparisons, { perCategory: 3 }));
    expect(out.map((g) => [g.category, g.comparisons.length])).toEqual([
      ['emergency_water', 1],
      ['first_aid_kit', 2],
      ['radio', 2],
      ['power_bank', 3],
      ['emergency_blanket', 1],
    ]);
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

  it('production: exactly 9 links, all sponsored nofollow amazon.co.uk/dp with the tag', () => {
    expect(linkCount({ SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG })).toEqual({ all: 9, shown: 9, sponsored: 9, tagged: 9, dp: 9 });
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
