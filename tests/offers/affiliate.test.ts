/**
 * S1-8 (#11): affiliate-only render rule, exact identity, Amazon price rule,
 * category spec validation and v1 compatibility.
 */
import { describe, expect, it } from 'vitest';
import {
  TRACKING_ID_PATTERN,
  amazonUkAffiliateUrl,
  isPriceDisplayAllowed,
  isProductVerified,
  buildCatalogueComparisons,
  compareProduct,
  matchOfferToProduct,
  resolveAffiliateLink,
  toAffiliateDisplayOffer,
} from '../../src/lib/offers/affiliate';
import {
  assertCatalogueReferences,
  isAmazonHost,
  isAmazonOffer,
  isAmazonUkHost,
  isValidGtin,
  parseAffiliateProgramme,
  parseAffiliateProgrammesFile,
  parseCatalogueProduct,
  parseCatalogueProductsFile,
  parseOffer,
  parseOffersFile,
  parseVariant,
} from '../../src/lib/offers/schema';
import {
  affiliateProgrammes,
  allOffers,
  allProducts,
  catalogueOffers,
  catalogueProducts,
  kitOffers,
} from '../../src/lib/offers/data';
import { NO_LINK_TEXT_EXACT_PRODUCT, NO_LINK_TEXT_PRODUCT_UNVERIFIED, type AffiliateProgrammeRecord, type CatalogueProduct, type Offer } from '../../src/lib/offers/types';
import { NOW, offer as v1Offer, variant as v1Variant } from './fixtures';

const T = '2026-11-14T20:00:00+00:00';
const ASIN = 'B0CZ9LH53B';
const TAG = 'TESTONLY-21';
const src = { name: 'TEST', url: `https://www.amazon.co.uk/dp/${ASIN}` };

function programme(over: Partial<AffiliateProgrammeRecord> = {}): AffiliateProgrammeRecord {
  return {
    programme_id: 'amazon-associates-uk',
    name: 'Amazon Associates UK',
    network: 'amazon-associates',
    status: 'approved',
    status_updated_on: '2026-11-01',
    approved_on: '2026-11-01',
    tracking_id_env: 'AMAZON_ASSOCIATES_UK_TAG',
    link_mode: 'derive_from_asin',
    allowed_hosts: ['www.amazon.co.uk'],
    disclosure_text: 'As an Amazon Associate I earn from qualifying purchases.',
    price_display: 'api_only',
    max_price_age_hours: 24,
    terms_url: 'https://affiliate-program.amazon.co.uk/help/operating/policies',
    notes: [],
    ...over,
  };
}

/** S1-8b: verified records carry verification_evidence (schema rule); fixtures add it unless overridden. */
function evidenceFor(asin: string | null, category: string) {
  return {
    method: 'public_listing' as const,
    source_url: `https://www.amazon.co.uk/dp/${asin}`,
    checked_on: '2026-11-15',
    outcome: 'verified' as const,
    checks_matched: (category === 'thermal_clothing'
      ? ['title', 'brand', 'model', 'pack_contents', 'size']
      : ['title', 'brand', 'model', 'pack_contents']) as ('title' | 'brand' | 'model' | 'pack_contents' | 'size')[],
    note: 'TEST',
  };
}

function product(over: Partial<CatalogueProduct> = {}): CatalogueProduct {
  const base = productRaw(over);
  if (base.verification === 'verified' && !('verification_evidence' in over)) {
    return { ...base, verification_evidence: evidenceFor(base.asin_uk, base.category) } as CatalogueProduct;
  }
  return base;
}

function productRaw(over: Partial<CatalogueProduct> = {}): CatalogueProduct {
  return {
    schema_version: 2,
    variant_id: 'pb-1',
    category: 'power_bank',
    product_name: 'TEST power bank',
    brand: 'TEST',
    asin_uk: ASIN,
    gtin: null,
    mpn: 'A1689011',
    model_code: 'A1689',
    pack_quantity: null,
    specs: { capacity_mah: { value: 20000, source: src, captured_at: T } },
    source: src,
    captured_at: T,
    verification: 'verified', // link-path tests need a verified product; unverified is tested explicitly (M2)
    notes: [],
    ...over,
  } as CatalogueProduct;
}

let n = 0;
function amazonOffer(over: Partial<Offer> = {}): Offer {
  n += 1;
  return {
    ...v1Offer(),
    schema_version: 2,
    offer_id: `amz-${n}`,
    variant_id: 'pb-1',
    kit_id: 'pb-1',
    category: 'power_bank',
    retailer: 'Amazon UK',
    asin: ASIN,
    asin_marketplace: 'amazon.co.uk',
    mpn: 'A1689011',
    gtin: null,
    price_gbp_inc_vat: null,
    price_verified: false,
    price_origin: 'none',
    delivery_cost_gbp: null,
    delivery_verified: false,
    product_url: `https://www.amazon.co.uk/dp/${ASIN}`,
    affiliate_url: '',
    affiliate_programme: null,
    affiliate_programme_id: 'amazon-associates-uk',
    source: { name: 'TEST', url: `https://www.amazon.co.uk/dp/${ASIN}`, type: 'retailer_page_manual' },
    captured_at: T,
    last_checked: T,
    next_check_due: '2026-11-21T20:00:00+00:00',
    internal: { commission_rate: 0.03, commission_rate_source: 'TEST' },
    ...over,
  };
}

/** A non-Amazon retailer row (no ASIN, no amazon.co.uk URLs, retailer name without "amazon"). */
function shopOffer(over: Partial<Offer> = {}): Offer {
  return amazonOffer({
    retailer: 'Example Shop',
    asin: null,
    asin_marketplace: null,
    product_url: 'https://shop.example/p/1',
    source: { name: 'TEST', url: 'https://shop.example/p/1', type: 'retailer_page_manual' },
    affiliate_programme_id: null,
    ...over,
  });
}

const withTag = { AMAZON_ASSOCIATES_UK_TAG: TAG };
const opts = (over: object = {}) => ({ now: NOW, programmes: [programme()], buildEnv: withTag, ...over });

describe('render rule: link only for an approved affiliate link', () => {
  it('approved programme + tag at build => https www.amazon.co.uk/dp/ASIN?tag= link with sponsored rel and disclosure', () => {
    const d = toAffiliateDisplayOffer(amazonOffer(), product(), opts());
    expect(d.link_url).toBe(`https://www.amazon.co.uk/dp/${ASIN}?tag=${TAG}`);
    const u = new URL(d.link_url!);
    expect(u.protocol).toBe('https:');
    expect(u.hostname).toBe('www.amazon.co.uk');
    expect(u.pathname).toBe(`/dp/${ASIN}`);
    expect(u.searchParams.get('tag')).toBe(TAG);
    expect(d.link_rel).toBe('sponsored nofollow');
    expect(d.is_affiliate_link).toBe(true);
    expect(d.no_link_reason).toBeNull();
    expect(d.no_link_text).toBeNull();
    expect(d.disclosure_text).toBe('As an Amazon Associate I earn from qualifying purchases.');
    expect(d.labels).not.toContain('no_affiliate_link');
  });

  it('no tag in the build env => no link (tracking_id_missing)', () => {
    for (const env of [{}, { AMAZON_ASSOCIATES_UK_TAG: '' }, { AMAZON_ASSOCIATES_UK_TAG: '  ' }]) {
      const d = toAffiliateDisplayOffer(amazonOffer(), product(), opts({ buildEnv: env }));
      expect(d.link_url).toBeNull();
      expect(d.no_link_reason).toBe('tracking_id_missing');
      expect(d.labels).toContain('no_affiliate_link');
      expect(d.no_link_text).toMatch(/approved affiliate programmes/);
    }
  });

  it.each([
    ['pending', 'programme_pending'],
    ['rejected', 'programme_rejected'],
    ['suspended', 'programme_suspended'],
  ] as const)('%s programme => no link even with a tag', (status, reason) => {
    const p = programme({ status, approved_on: status === 'suspended' ? '2026-11-01' : null });
    const d = toAffiliateDisplayOffer(amazonOffer(), product(), opts({ programmes: [p] }));
    expect(d.link_url).toBeNull();
    expect(d.no_link_reason).toBe(reason);
  });

  it('approval dated after the capture => no link', () => {
    const p = programme({ approved_on: '2026-11-20', status_updated_on: '2026-11-20' });
    expect(toAffiliateDisplayOffer(amazonOffer(), product(), opts({ programmes: [p] })).no_link_reason).toBe('programme_pending');
  });

  it('no programme reference or unknown programme => no link', () => {
    expect(toAffiliateDisplayOffer(amazonOffer({ affiliate_programme_id: null }), product(), opts()).no_link_reason).toBe('no_programme');
    expect(toAffiliateDisplayOffer(amazonOffer(), product(), opts({ programmes: [] })).no_link_reason).toBe('no_programme');
  });

  it('mismatched product => no link (ASIN, variant, model_match)', () => {
    const wrongAsin = toAffiliateDisplayOffer(amazonOffer({ asin: 'B0CSSRD4NT' }), product(), opts());
    expect(wrongAsin.link_url).toBeNull();
    expect(wrongAsin.no_link_reason).toBe('exact_product_not_confirmed');
    expect(wrongAsin.no_link_text).toMatch(/exact product/);
    expect(wrongAsin.labels).toContain('model_unconfirmed');
    const unconfirmed = toAffiliateDisplayOffer(amazonOffer({ model_match_confirmed: false }), product(), opts());
    expect(unconfirmed.link_url).toBeNull();
    const otherVariant = toAffiliateDisplayOffer(amazonOffer({ variant_id: 'pb-2' }), product(), opts());
    expect(otherVariant.link_url).toBeNull();
  });

  it('never falls back to product_url, and exposes no plain retailer URL', () => {
    const d = toAffiliateDisplayOffer(amazonOffer(), product(), opts({ buildEnv: {} }));
    expect(d.link_url).toBeNull();
    expect(d).not.toHaveProperty('product_url');
    expect(d.source).toEqual({ name: 'TEST' });
    const json = JSON.stringify(d);
    expect(json).not.toContain('amazon.co.uk/dp');
    expect(json).not.toContain('commission');
  });

  it('stored_exact_url programmes: approved https URL on an allowed host only', () => {
    const awin = programme({
      programme_id: 'example-awin', network: 'awin', link_mode: 'stored_exact_url', tracking_id_env: null,
      allowed_hosts: ['www.awin1.com'], price_display: 'timestamped_capture', disclosure_text: 'Affiliate link.',
    });
    const kit = v1Variant({ verification: 'verified' });
    const base = { ...v1Offer(), schema_version: 2 as const, affiliate_programme: null, affiliate_programme_id: 'example-awin', price_origin: 'manual_capture' as const };
    const ok = toAffiliateDisplayOffer({ ...base, affiliate_url: 'https://www.awin1.com/cread.php?x=1' }, kit, opts({ programmes: [awin] }));
    expect(ok.link_url).toBe('https://www.awin1.com/cread.php?x=1');
    expect(toAffiliateDisplayOffer({ ...base, affiliate_url: 'http://www.awin1.com/x' }, kit, opts({ programmes: [awin] })).no_link_reason).toBe('not_https');
    expect(toAffiliateDisplayOffer({ ...base, affiliate_url: 'https://evil.example/x' }, kit, opts({ programmes: [awin] })).no_link_reason).toBe('host_not_allowed');
    expect(toAffiliateDisplayOffer({ ...base, affiliate_url: '' }, kit, opts({ programmes: [awin] })).no_link_reason).toBe('no_affiliate_url');
  });

  it('resolveAffiliateLink refuses unmatched products before looking at the programme', () => {
    expect(resolveAffiliateLink(amazonOffer(), false, [programme()], withTag).no_link_reason).toBe('exact_product_not_confirmed');
    expect(amazonUkAffiliateUrl('B0CZ9LH53B', 'a b')).toBe('https://www.amazon.co.uk/dp/B0CZ9LH53B?tag=a%20b');
  });

  it('comparison disclosures list only programmes whose links rendered', () => {
    const p = product();
    expect(compareProduct(p, [amazonOffer()], opts()).disclosures).toEqual(['As an Amazon Associate I earn from qualifying purchases.']);
    expect(compareProduct(p, [amazonOffer()], opts({ buildEnv: {} })).disclosures).toEqual([]);
  });
});

describe('exact identity rule', () => {
  it('Amazon offers join only on equal ASIN (no GTIN fallback)', () => {
    const p = product({ asin_uk: null, gtin: '5060176880023' });
    expect(matchOfferToProduct(amazonOffer({ gtin: '5060176880023' }), p)).toBe('asin_mismatch');
    expect(matchOfferToProduct(amazonOffer(), product())).toBeNull();
  });

  it('non-Amazon offers join only on equal GTIN', () => {
    const p = product({ gtin: '5060176880023' });
    const shop = shopOffer({ mpn: null });
    expect(matchOfferToProduct({ ...shop, gtin: '5060176880023' }, p)).toBeNull();
    expect(matchOfferToProduct({ ...shop, gtin: '5060176880030' }, p)).toBe('gtin_mismatch');
    expect(matchOfferToProduct({ ...shop, gtin: null }, product({ gtin: null }))).toBe('no_exact_identity');
  });

  it('kits keep the S1-1 MPN rule for non-Amazon retailers', () => {
    expect(matchOfferToProduct(v1Offer(), v1Variant())).toBeNull();
    expect(matchOfferToProduct(v1Offer({ mpn: 'E184P' }), v1Variant())).toBe('identifier_mismatch');
  });
});

describe('placeholder ASINs are rejected', () => {
  it.each(['ASIN_TBD', 'b0cz9lh53b', 'B0CZ9LH53', ''])('rejects %j', (bad) => {
    expect(() => parseCatalogueProduct(product({ asin_uk: bad }))).toThrow();
    expect(() => parseOffer(amazonOffer({ asin: bad }), { now: NOW })).toThrow();
  });

  it('a catalogue product needs asin_uk or gtin', () => {
    expect(() => parseCatalogueProduct(product({ asin_uk: null, gtin: null }))).toThrow(/exact identity/);
  });
});

describe('Amazon price rule', () => {
  it('a manual Amazon price is never displayed', () => {
    const o = amazonOffer({ schema_version: 1, affiliate_programme_id: undefined, price_origin: undefined, price_gbp_inc_vat: 137, price_verified: true, delivery_cost_gbp: 0, delivery_verified: true, availability_text: 'In stock' });
    const d = toAffiliateDisplayOffer(o, product(), opts());
    expect(d.price_display_allowed).toBe(false);
    expect(d.price_gbp_inc_vat).toBeNull();
    expect(d.delivered_total_gbp).toBeNull();
    expect(d.availability_text).toBeNull();
    expect(d.price_disclaimer).toBeNull();
    expect(d.labels).toContain('price_not_displayable');
    expect(d.eligible_for_best_price).toBe(false);
  });

  it('v2 schema rejects an Amazon price unless it came from the Amazon product API', () => {
    expect(() => parseOffer(amazonOffer({ price_gbp_inc_vat: 20, price_origin: 'manual_capture' }), { now: NOW })).toThrow(/Amazon product API/);
    expect(() => parseOffer(amazonOffer({ affiliate_url: 'https://www.amazon.co.uk/dp/X?tag=y' }), { now: NOW })).toThrow();
    expect(() => parseOffer(amazonOffer(), { now: NOW })).not.toThrow();
  });

  it('an API price within 24h is shown with timestamp and Amazon disclaimer; older is hidden', () => {
    const api = amazonOffer({ price_gbp_inc_vat: 25.99, price_origin: 'amazon_product_api', captured_at: '2026-11-14T22:00:00+00:00', last_checked: '2026-11-14T22:00:00+00:00' });
    const d = toAffiliateDisplayOffer(api, product(), opts());
    expect(d.price_display_allowed).toBe(true);
    expect(d.price_gbp_inc_vat).toBe(25.99);
    expect(d.price_disclaimer).toBe('Price at Amazon UK on 14 November 2026, 22:00 UK time. Prices change.');
    expect(d.retailer_price_disclaimer).toMatch(/accurate as of the date\/time indicated/);
    const old = toAffiliateDisplayOffer(api, product(), opts({ now: '2026-11-15T23:00:00+00:00' }));
    expect(old.price_display_allowed).toBe(false);
    expect(old.price_gbp_inc_vat).toBeNull();
  });
});

describe('category spec validation', () => {
  it('accepts sourced, category-appropriate specs', () => {
    expect(() => parseCatalogueProduct(product())).not.toThrow();
    expect(() =>
      parseCatalogueProduct(product({ category: 'emergency_water', specs: { total_litres: { value: 3, source: src, captured_at: T }, shelf_life_years: { value: 5, source: src, captured_at: T } } } as Partial<CatalogueProduct>)),
    ).not.toThrow();
  });

  it('rejects a spec from another category, an unsourced value and a wrong type', () => {
    expect(() => parseCatalogueProduct(product({ specs: { lumens: { value: 100, source: src, captured_at: T } } } as Partial<CatalogueProduct>))).toThrow();
    expect(() => parseCatalogueProduct(product({ specs: { capacity_mah: 20000 } } as unknown as Partial<CatalogueProduct>))).toThrow();
    expect(() => parseCatalogueProduct(product({ specs: { capacity_mah: { value: '20000', source: src, captured_at: T } } } as unknown as Partial<CatalogueProduct>))).toThrow();
    expect(() => parseCatalogueProduct(product({ specs: { capacity_mah: { value: 20000, source: src, captured_at: '2026-11-14T20:00:00' } } } as Partial<CatalogueProduct>))).toThrow();
    expect(() => parseCatalogueProduct({ ...product(), category: 'kit' })).toThrow();
  });

  it('rejects duplicate products in a file', () => {
    const f = { schema_version: 2, status: 'unverified-seed', data_source_needed: [], products: [product(), product({ variant_id: 'pb-2' })] };
    expect(() => parseCatalogueProductsFile(f)).toThrow(/Duplicate asin_uk/);
  });
});

describe('affiliate programme records', () => {
  it('stores an env var NAME, never a tag value; approved needs approved_on', () => {
    expect(() => parseAffiliateProgramme(programme())).not.toThrow();
    expect(() => parseAffiliateProgramme(programme({ tracking_id_env: 'example-21' }))).toThrow(/env var name/);
    expect(() => parseAffiliateProgramme(programme({ approved_on: null }))).toThrow(/approved_on/);
    expect(() => parseAffiliateProgramme(programme({ status: 'pending' }))).toThrow(/approved_on must be null/);
    expect(() => parseAffiliateProgrammesFile({ schema_version: 2, programmes: [programme(), programme()] })).toThrow(/Duplicate programme_id/);
  });

  it('cross-file: unknown programme or stored URL on a non-approved programme is rejected', () => {
    expect(() => assertCatalogueReferences([amazonOffer({ affiliate_programme_id: 'nope' })], [programme()])).toThrow(/unknown affiliate_programme_id/);
    expect(() => assertCatalogueReferences([amazonOffer({ affiliate_url: 'https://x.test' })], [programme({ status: 'pending', approved_on: null })])).toThrow();
  });
});

describe('v1 compatibility', () => {
  it('S1-1 v1 rows and variants still parse unchanged', () => {
    expect(() => parseVariant(v1Variant())).not.toThrow();
    expect(() => parseOffer(v1Offer(), { now: NOW })).not.toThrow();
    expect(() => parseOffersFile({ schema_version: 1, status: 'unverified-seed', data_source_needed: [], offers: [v1Offer({ offer_id: 'only' })] }, { now: NOW })).not.toThrow();
  });

  it('v1 kit offers in the new path show the price state but no button (unverified kit; no programme)', () => {
    expect(toAffiliateDisplayOffer(v1Offer(), v1Variant(), opts()).no_link_reason).toBe('product_unverified');
    const d = toAffiliateDisplayOffer(v1Offer(), v1Variant({ verification: 'verified' }), opts());
    expect(d.category).toBe('kit');
    expect(d.price_gbp_inc_vat).toBe(100);
    expect(d.price_display_allowed).toBe(true);
    expect(d.link_url).toBeNull();
    expect(d.no_link_reason).toBe('no_programme');
    expect(d.total_per_person_gbp).toBe(26.25);
  });

  it('a v1 affiliate_programme (legacy) does not produce a link in the new path', () => {
    const legacy = v1Offer({ affiliate_url: 'https://aff.example.test/x', affiliate_programme: { name: 'X', approved_on: '2026-11-01' } });
    expect(toAffiliateDisplayOffer(legacy, v1Variant(), opts()).link_url).toBeNull();
  });
});

describe('seed data (src/data)', () => {
  it('Amazon Associates UK is approved (S1-8b) with only an env var name; EVAQ8 has no programme', () => {
    expect(affiliateProgrammes.map((p) => [p.programme_id, p.status, p.approved_on, p.tracking_id_env])).toEqual([
      ['amazon-associates-uk', 'approved', '2026-11-15', 'AMAZON_ASSOCIATES_UK_TAG'],
    ]);
  });

  it('the S1-1 manual Amazon price (£137) is nulled', () => {
    const amz = kitOffers.find((o) => o.retailer === 'Amazon UK')!;
    expect(amz.price_gbp_inc_vat).toBeNull();
    expect(amz.availability_text).toBeNull();
  });

  it('catalogue: real ASIN format, verification evidence on every row, no prices, Amazon programme reference, no stored affiliate URL', () => {
    expect(catalogueProducts.length).toBeGreaterThan(0);
    for (const p of catalogueProducts) {
      expect(p.verification_evidence?.outcome).toBe(p.verification === 'verified' ? 'verified' : 'not_verified');
      expect(p.verification_evidence?.source_url).toBe(`https://www.amazon.co.uk/dp/${p.asin_uk}`);
      expect(p.asin_uk).toMatch(/^[A-Z0-9]{10}$/);
      expect(p.source.url).toBe(`https://www.amazon.co.uk/dp/${p.asin_uk}`);
    }
    for (const o of catalogueOffers) {
      expect(o.price_gbp_inc_vat).toBeNull();
      expect(o.price_origin).toBe('none');
      expect(o.affiliate_url).toBe('');
      expect(o.affiliate_programme_id).toBe('amazon-associates-uk');
      expect(o.product_url).not.toContain('tag=');
    }
  });

  it('with the tag unset, nothing renders a link and no price shows (programme approved)', () => {
    const { comparisons } = buildCatalogueComparisons(allProducts, allOffers, { now: '2026-11-15T12:00:00+00:00', programmes: affiliateProgrammes, buildEnv: {} });
    const offers = comparisons.flatMap((c) => c.offers);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.link_url === null)).toBe(true);
    expect(offers.filter((o) => o.retailer === 'Amazon UK').every((o) => o.price_gbp_inc_vat === null && !o.price_display_allowed)).toBe(true);
    expect(comparisons.every((c) => c.disclosures.length === 0)).toBe(true);
    // With a pending programme (in memory), even a tag set renders no link.
    const pendingProgrammes = affiliateProgrammes.map((p) => ({ ...p, status: 'pending' as const, approved_on: null }));
    const tagged = buildCatalogueComparisons(allProducts, allOffers, { now: '2026-11-15T12:00:00+00:00', programmes: pendingProgrammes, buildEnv: withTag });
    expect(tagged.comparisons.flatMap((c) => c.offers).every((o) => o.no_link_reason !== null)).toBe(true);
  });

  it('every seeded category except kits is covered by the catalogue', () => {
    const cats = new Set(catalogueProducts.map((p) => p.category));
    expect([...cats].sort()).toEqual(['emergency_blanket', 'emergency_water', 'first_aid_kit', 'power_bank', 'thermal_clothing', 'wind_up_torch_radio']);
  });
});

/* ---------- PR #12 review round 1 (M1, L1-L4, info) ---------- */

const GTIN = '5060176883963';

describe('M1: Amazon detection fails closed', () => {
  it.each([
    ['retailer "Amazon", no marketplace, manual price', { retailer: 'Amazon', asin_marketplace: null, gtin: GTIN }],
    ['retailer "Amazon.co.uk", no marketplace, manual price, ASIN set', { retailer: 'Amazon.co.uk', asin_marketplace: null }],
    ['retailer "amazon uk" lower case', { retailer: 'amazon uk', asin_marketplace: null }],
  ] as const)('parse rejects %s', (_k, over) => {
    const row = amazonOffer({ ...over, price_gbp_inc_vat: 30, price_origin: 'manual_capture', affiliate_programme_id: null });
    expect(() => parseOffer(row, { now: NOW })).toThrow(/asin_marketplace|Amazon/);
  });

  it('reviewer repro: retailer "Amazon"/"Amazon.co.uk" with a manual price is hidden at runtime', () => {
    for (const over of [
      { retailer: 'Amazon', asin_marketplace: null, gtin: GTIN },
      { retailer: 'Amazon.co.uk', asin_marketplace: null },
    ]) {
      const row = amazonOffer({ ...over, price_gbp_inc_vat: 30, price_origin: 'manual_capture', affiliate_programme_id: null });
      const d = toAffiliateDisplayOffer(row, product({ gtin: over.gtin ?? null }), opts());
      expect(d.price_gbp_inc_vat).toBeNull();
      expect(d.price_display_allowed).toBe(false);
      expect(d.labels).toContain('price_not_displayable');
    }
  });

  it('detects Amazon by ASIN, product_url host or source host even with a neutral retailer name', () => {
    const neutral = { retailer: 'Example Shop', asin_marketplace: null, price_gbp_inc_vat: 30, price_origin: 'manual_capture' as const, affiliate_programme_id: null };
    const byAsin = amazonOffer({ ...neutral, product_url: 'https://shop.example/p', source: { name: 'T', url: 'https://shop.example/p', type: 'retailer_page_manual' } });
    const byProductHost = amazonOffer({ ...neutral, asin: null, gtin: GTIN, product_url: 'https://amazon.co.uk/dp/B0CZ9LH53B', source: { name: 'T', url: 'https://shop.example/p', type: 'retailer_page_manual' } });
    const bySourceHost = amazonOffer({ ...neutral, asin: null, gtin: GTIN, product_url: 'https://shop.example/p', source: { name: 'T', url: 'https://smile.amazon.co.uk/x', type: 'retailer_page_manual' } });
    for (const row of [byAsin, byProductHost, bySourceHost]) {
      expect(isAmazonOffer(row)).toBe(true);
      expect(() => parseOffer(row, { now: NOW })).toThrow();
      expect(isPriceDisplayAllowed(row, [], NOW)).toBe(false);
    }
    expect(isAmazonOffer(shopOffer())).toBe(false);
    expect(isAmazonOffer({ ...shopOffer(), product_url: 'https://notamazon.co.uk.evil.example/p' })).toBe(false);
  });

  it('once detected, every Amazon rule applies (ASIN required and valid, affiliate_url empty, API-only price)', () => {
    const base = { asin_marketplace: 'amazon.co.uk' as const };
    expect(() => parseOffer(amazonOffer({ ...base, retailer: 'Amazon', asin: null, gtin: GTIN }), { now: NOW })).toThrow(/ASIN/);
    expect(() => parseOffer(amazonOffer({ ...base, retailer: 'Amazon', asin: 'b0cz9lh53b' }), { now: NOW })).toThrow();
    expect(() => parseOffer(amazonOffer({ ...base, retailer: 'Amazon', affiliate_url: `https://www.amazon.co.uk/dp/${ASIN}?tag=someoneelse-21` }), { now: NOW })).toThrow(/affiliate_url/);
    expect(() => parseOffer(amazonOffer({ ...base, retailer: 'Amazon', price_gbp_inc_vat: 30, price_origin: 'manual_capture' }), { now: NOW })).toThrow(/API/);
    expect(() => parseOffer(amazonOffer({ retailer: 'Amazon', asin_marketplace: null }), { now: NOW })).toThrow(/asin_marketplace/);
    expect(() => parseOffer(amazonOffer({ retailer: 'Amazon' }), { now: NOW })).not.toThrow();
  });

  it('non-Amazon rows are unaffected', () => {
    expect(() => parseOffer(shopOffer({ gtin: GTIN, price_gbp_inc_vat: 20, price_origin: 'manual_capture' }), { now: NOW })).not.toThrow();
    const d = toAffiliateDisplayOffer(shopOffer({ gtin: GTIN, price_gbp_inc_vat: 20, price_origin: 'manual_capture' }), product({ gtin: GTIN }), opts());
    expect(d.price_gbp_inc_vat).toBe(20);
    expect(d.no_link_reason).toBe('no_programme');
  });
});

describe('L1: Amazon price age uses the older timestamp and rejects future timestamps', () => {
  const api = (captured_at: string, last_checked: string) =>
    amazonOffer({ price_gbp_inc_vat: 30, price_origin: 'amazon_product_api', price_verified: true, captured_at, last_checked });
  it.each([
    ['fresh', T, T, true],
    ['24h+ old', '2026-11-13T00:00:00+00:00', '2026-11-13T00:00:00+00:00', false],
    ['old captured, fresh last_checked', '2026-11-13T00:00:00+00:00', T, false],
    ['fresh captured, old last_checked', T, '2026-11-13T00:00:00+00:00', false],
    ['future captured (+2h)', '2026-11-15T01:30:00+00:00', '2026-11-15T01:30:00+00:00', false],
    ['future last_checked only', T, '2026-11-16T00:00:00+00:00', false],
    ['far future (+1y)', '2027-11-16T00:00:00+00:00', '2027-11-16T00:00:00+00:00', false],
  ] as const)('%s => displayable %s', (_k, c, l, ok) => {
    expect(isPriceDisplayAllowed(api(c, l), [programme()], NOW)).toBe(ok);
    const d = toAffiliateDisplayOffer(api(c, l), product(), opts());
    expect(d.price_display_allowed).toBe(ok);
    expect(d.price_gbp_inc_vat).toBe(ok ? 30 : null);
  });

  it('parse rejects future-dated and out-of-order timestamps', () => {
    expect(() => parseOffer(api('2027-11-16T00:00:00+00:00', '2027-11-16T00:00:00+00:00'), { now: NOW })).toThrow();
    expect(() => parseOffer(api(T, '2026-11-13T00:00:00+00:00'), { now: NOW })).toThrow();
  });
});

describe('L2: GTIN check digit and length', () => {
  it.each(['5060176883963', '4006381333931', '5060176880023', '5060176886667', '96385074', '036000291452', '15060176883960'])('accepts %s', (g) => {
    expect(isValidGtin(g)).toBe(true);
    expect(() => parseCatalogueProduct(product({ gtin: g }))).not.toThrow();
  });
  it.each(['5060176883964', '123456789', '1234567890', '12345678901', '40063813', '00000000', '0000000000000', '506017688396a', ''])('rejects %j', (g) => {
    expect(isValidGtin(g)).toBe(false);
    expect(() => parseCatalogueProduct(product({ gtin: g }))).toThrow();
    expect(() => parseOffer(shopOffer({ gtin: g }), { now: NOW })).toThrow();
  });
  it('seeded GTINs still pass (kit variant E182P and kit offers)', () => {
    expect(() => parseVariant(v1Variant({ gtin: GTIN }))).not.toThrow();
    expect(kitOffers.some((o) => o.gtin === GTIN)).toBe(true);
    expect(() => parseVariant(v1Variant({ gtin: '5060176883964' }))).toThrow();
  });
});

describe('L3: UK tracking id must end in -21', () => {
  it.each(['x', 'probe-20', 'TESTONLY', 'TESTONLY-22', '-21', 'bad tag-21', 'a?b=c-21', 'x&y-21', '\u00e9-21', 'a'.repeat(70) + '-21'])(
    'tag %j => no link, tracking_id_invalid',
    (tag) => {
      const d = toAffiliateDisplayOffer(amazonOffer(), product(), opts({ buildEnv: { AMAZON_ASSOCIATES_UK_TAG: tag } }));
      expect(d.link_url).toBeNull();
      expect(d.no_link_reason).toBe('tracking_id_invalid');
      expect(d.labels).toContain('no_affiliate_link');
      expect(d.disclosure_text).toBeNull();
    },
  );
  it('valid -21 tags (trimmed) produce a link', () => {
    for (const tag of ['TESTONLY-21', ' TESTONLY-21 ', 'a-b-c-21']) {
      const d = toAffiliateDisplayOffer(amazonOffer(), product(), opts({ buildEnv: { AMAZON_ASSOCIATES_UK_TAG: tag } }));
      expect(d.link_url).toBe(`https://www.amazon.co.uk/dp/${ASIN}?tag=${tag.trim()}`);
    }
    expect(TRACKING_ID_PATTERN.test('TESTONLY-21')).toBe(true);
  });
});

describe('L4: Amazon URLs are always built from the ASIN', () => {
  const stored = programme({ link_mode: 'stored_exact_url' });
  const thirdParty = `https://www.amazon.co.uk/dp/${ASIN}?tag=someoneelse-21`;
  it('stored_exact_url programme: a stored Amazon URL (other tag) is ignored', () => {
    const d = toAffiliateDisplayOffer(amazonOffer({ affiliate_url: thirdParty }), product(), opts({ programmes: [stored] }));
    expect(d.link_url).toBe(`https://www.amazon.co.uk/dp/${ASIN}?tag=${TAG}`);
    expect(d.link_url).not.toContain('someoneelse');
  });
  it('derive mode ignores a stored URL too', () => {
    const d = toAffiliateDisplayOffer(amazonOffer({ affiliate_url: thirdParty }), product(), opts());
    expect(d.link_url).toBe(`https://www.amazon.co.uk/dp/${ASIN}?tag=${TAG}`);
  });
  it('stored programme with no tag env => no link (never the stored URL)', () => {
    const d = toAffiliateDisplayOffer(amazonOffer({ affiliate_url: thirdParty }), product(), opts({ programmes: [programme({ link_mode: 'stored_exact_url', tracking_id_env: null })] }));
    expect(d.link_url).toBeNull();
    expect(d.no_link_reason).toBe('tracking_id_missing');
  });
  it('a derive_from_asin programme on a non-Amazon offer reports no_programme (not a product mismatch)', () => {
    const d = toAffiliateDisplayOffer(shopOffer({ gtin: GTIN, affiliate_programme_id: 'amazon-associates-uk' }), product({ gtin: GTIN }), opts());
    expect(d.model_match_confirmed).toBe(true);
    expect(d.link_url).toBeNull();
    expect(d.no_link_reason).toBe('no_programme');
    expect(d.no_link_text).toMatch(/approved affiliate programmes/);
  });
});

describe('info: thermal clothing and the renamed no_link_reason', () => {
  const thermal = (over: Partial<CatalogueProduct> = {}) =>
    product({ variant_id: 'th-1', category: 'thermal_clothing', specs: {}, verification: 'unverified', ...over } as Partial<CatalogueProduct>);
  it('verified thermal_clothing requires size_label; unverified may omit it', () => {
    expect(() => parseCatalogueProduct(thermal())).not.toThrow();
    expect(() => parseCatalogueProduct(thermal({ verification: 'verified' }))).toThrow(/size_label/);
    expect(() =>
      parseCatalogueProduct(thermal({ verification: 'verified', specs: { size_label: { value: 'M', source: src, captured_at: T } } } as Partial<CatalogueProduct>)),
    ).not.toThrow();
  });
  it('seeded thermals stay unverified and record the per-size ASIN requirement', () => {
    const th = catalogueProducts.filter((p) => p.category === 'thermal_clothing');
    expect(th).toHaveLength(2);
    for (const p of th) {
      expect(p.verification).toBe('unverified');
      expect(p.notes.join(' ')).toMatch(/own ASIN/);
    }
  });
  it('exact_product_not_confirmed has its own reader text', () => {
    const d = toAffiliateDisplayOffer(amazonOffer({ model_match_confirmed: false }), product(), opts());
    expect(d.no_link_reason).toBe('exact_product_not_confirmed');
    expect(d.no_link_text).toBe(NO_LINK_TEXT_EXACT_PRODUCT);
  });
  it('seed: with a fake tag set, no Amazon link renders while the programme is pending', () => {
    const pendingProgrammes = affiliateProgrammes.map((p) => ({ ...p, status: 'pending' as const, approved_on: null }));
    const r = buildCatalogueComparisons(allProducts, allOffers, { now: NOW, programmes: pendingProgrammes, buildEnv: withTag });
    const shown = r.comparisons.flatMap((c) => c.offers);
    expect(shown.filter((o) => o.link_url !== null)).toHaveLength(0);
    expect(shown.filter((o) => o.price_gbp_inc_vat !== null && o.retailer.match(/amazon/i))).toHaveLength(0);
  });
});

/* ---------- PR #12 review round 2 (M2, L5) ---------- */

describe('M2: links only for verified products', () => {
  const approvedProgrammes = () =>
    affiliateProgrammes.map((p) => ({ ...p, status: 'approved' as const, approved_on: '2026-11-15', status_updated_on: '2026-11-15' }));
  /** S1-8b: the committed seed now has verified rows; M2 is exercised on an all-unverified copy. */
  const allUnverified = allProducts.map((p) => ({ ...p, verification: 'unverified' as const, verification_evidence: undefined }));
  const seedRun = (products: typeof allProducts = allUnverified) =>
    buildCatalogueComparisons(products, allOffers, {
      now: '2026-11-15T12:00:00+00:00',
      programmes: approvedProgrammes(),
      buildEnv: { AMAZON_ASSOCIATES_UK_TAG: 'TESTONLY-21' },
    }).comparisons.flatMap((c) => c.offers);

  it('seed with every product set unverified + approved Amazon programme + TESTONLY-21 => 0 links', () => {
    expect(allUnverified.filter((p) => (p as { verification?: string }).verification === 'verified')).toHaveLength(0);
    const shown = seedRun();
    expect(shown.filter((o) => o.link_url !== null)).toHaveLength(0);
    const amazonRows = shown.filter((o) => o.retailer === 'Amazon UK');
    expect(amazonRows.length).toBeGreaterThan(0);
    for (const o of amazonRows) {
      expect(o.no_link_reason).toBe('product_unverified');
      expect(o.no_link_text).toBe(NO_LINK_TEXT_PRODUCT_UNVERIFIED);
    }
  });

  it('flipping exactly one (non-thermal) seed product to verified => exactly 1 link', () => {
    const target = 'amazon-uk-b0cz9lh53b';
    expect(allProducts.some((p) => p.variant_id === target)).toBe(true);
    const flipped = allUnverified.map((p) => (p.variant_id === target ? { ...p, verification: 'verified' as const } : p));
    // Committed record (verified, with evidence) parses; the in-memory flip has the evidence stripped.
    expect(() => parseCatalogueProduct(allProducts.find((p) => p.variant_id === target))).not.toThrow();
    const linked = seedRun(flipped).filter((o) => o.link_url !== null);
    expect(linked).toHaveLength(1);
    expect(linked[0]!.variant_id).toBe(target);
    expect(linked[0]!.link_url).toBe('https://www.amazon.co.uk/dp/B0CZ9LH53B?tag=TESTONLY-21');
    expect(linked[0]!.link_rel).toBe('sponsored nofollow');
  });

  it('a verified thermal needs size_label to link; unverified thermals never link', () => {
    const th = catalogueProducts.find((p) => p.category === 'thermal_clothing')!;
    const offer = catalogueOffers.find((o) => o.variant_id === th.variant_id)!;
    const programmesApproved = approvedProgrammes();
    const o = { now: '2026-11-15T12:00:00+00:00', programmes: programmesApproved, buildEnv: withTag };
    const fresh = offer; // seed capture (15 Nov 2026) is on/after approved_on
    expect(toAffiliateDisplayOffer(fresh, th, o).no_link_reason).toBe('product_unverified');
    const verifiedNoSize = { ...th, verification: 'verified' as const } as CatalogueProduct;
    expect(isProductVerified(verifiedNoSize)).toBe(false);
    expect(toAffiliateDisplayOffer(fresh, verifiedNoSize, o).no_link_reason).toBe('product_unverified');
    const verifiedSized = { ...th, verification: 'verified' as const, specs: { ...th.specs, size_label: { value: 'M', source: src, captured_at: T } } } as CatalogueProduct;
    expect(isProductVerified(verifiedSized)).toBe(true);
    expect(toAffiliateDisplayOffer(fresh, verifiedSized, o).link_url).toBe(`https://www.amazon.co.uk/dp/${th.asin_uk}?tag=${TAG}`);
  });

  it('unverified product, exact match: no link with product_unverified; mismatch still wins', () => {
    const d = toAffiliateDisplayOffer(amazonOffer(), product({ verification: 'unverified' }), opts());
    expect(d.link_url).toBeNull();
    expect(d.model_match_confirmed).toBe(true);
    expect(d.no_link_reason).toBe('product_unverified');
    expect(d.labels).toContain('no_affiliate_link');
    const m = toAffiliateDisplayOffer(amazonOffer({ asin: 'B0CSSRD4NT' }), product({ verification: 'unverified' }), opts());
    expect(m.no_link_reason).toBe('exact_product_not_confirmed');
  });

  it('resolveAffiliateLink fails closed when productVerified is omitted', () => {
    expect(resolveAffiliateLink(amazonOffer(), true, [programme()], withTag).no_link_reason).toBe('product_unverified');
    expect(resolveAffiliateLink(amazonOffer(), true, [programme()], withTag, true).link_url).not.toBeNull();
  });

  it('kits: absent verification = unverified', () => {
    expect(isProductVerified(v1Variant())).toBe(false);
    expect(isProductVerified(v1Variant({ verification: 'verified' }))).toBe(true);
  });
});

describe('L5: every Amazon host is detected; only amazon.co.uk links', () => {
  const hosts = [
    'https://www.amazon.com/dp/B0CZ9LH53B',
    'https://amazon.com/dp/B0CZ9LH53B',
    'https://www.amazon.de/dp/B0CZ9LH53B',
    'https://www.amazon.fr/dp/B0CZ9LH53B',
    'https://www.amazon.co.jp/dp/B0CZ9LH53B',
    'https://www.amazon.com.au/dp/B0CZ9LH53B',
    'https://www.amazon.com.br/dp/B0CZ9LH53B',
    'https://www.amazon.ca/dp/B0CZ9LH53B',
    'https://smile.amazon.com/dp/B0CZ9LH53B',
    'https://amzn.to/abc123',
    'https://amzn.eu/d/abc123',
    'https://a.co/d/abc123',
    'https://www.amzn.to/abc123',
  ];
  it.each(hosts)('%s is Amazon (detected), not UK, and rejected at parse', (url) => {
    expect(isAmazonHost(url)).toBe(true);
    expect(isAmazonUkHost(url)).toBe(false);
    const neutral = shopOffer({ gtin: GTIN, product_url: url, price_gbp_inc_vat: 30, price_origin: 'manual_capture' });
    expect(isAmazonOffer(neutral)).toBe(true);
    expect(() => parseOffer(neutral, { now: NOW })).toThrow();
    // Even as a properly-formed UK Amazon row, a non-UK URL is rejected at parse...
    const ukRow = amazonOffer({ product_url: url });
    expect(() => parseOffer(ukRow, { now: NOW })).toThrow(/amazon\.co\.uk/);
    // ...and unlinkable at runtime with a clear reason; a manual price is never shown.
    expect(toAffiliateDisplayOffer(ukRow, product(), opts()).no_link_reason).toBe('marketplace_not_supported');
    expect(toAffiliateDisplayOffer(neutral, product({ gtin: GTIN }), opts()).price_gbp_inc_vat).toBeNull();
  });
  it('a non-UK Amazon source.url alone also blocks the link', () => {
    const row = amazonOffer({ source: { name: 'T', url: 'https://www.amazon.com/dp/B0CZ9LH53B', type: 'retailer_page_manual' } });
    expect(toAffiliateDisplayOffer(row, product(), opts()).no_link_reason).toBe('marketplace_not_supported');
  });
  it.each(['https://www.amazon.co.uk/dp/B0CZ9LH53B', 'https://amazon.co.uk/dp/B0CZ9LH53B', 'https://smile.amazon.co.uk/x'])('%s is the UK marketplace', (url) => {
    expect(isAmazonHost(url)).toBe(true);
    expect(isAmazonUkHost(url)).toBe(true);
    expect(() => parseOffer(amazonOffer({ product_url: url }), { now: NOW })).not.toThrow();
  });
  it.each(['https://shop.example/p', 'https://notamazon.com/x', 'https://amazonia.example/x', 'https://amazon.co.uk.evil.example/x', 'https://evila.co/x', 'https://myamzn.to/x'])(
    '%s is not Amazon',
    (url) => {
      expect(isAmazonHost(url)).toBe(false);
    },
  );
  it('only www.amazon.co.uk is an allowed link host in the seed programme', () => {
    expect(affiliateProgrammes.find((p) => p.programme_id === 'amazon-associates-uk')!.allowed_hosts).toEqual(['www.amazon.co.uk']);
  });
});
