/**
 * S1-8 (#11): affiliate-only render rule, exact identity, Amazon price rule,
 * category spec validation and v1 compatibility.
 */
import { describe, expect, it } from 'vitest';
import {
  amazonUkAffiliateUrl,
  buildCatalogueComparisons,
  compareProduct,
  matchOfferToProduct,
  resolveAffiliateLink,
  toAffiliateDisplayOffer,
} from '../../src/lib/offers/affiliate';
import {
  assertCatalogueReferences,
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
import type { AffiliateProgrammeRecord, CatalogueProduct, Offer } from '../../src/lib/offers/types';
import { NOW, offer as v1Offer, variant as v1Variant } from './fixtures';

const T = '2026-11-14T20:00:00+00:00';
const ASIN = 'B0CZ9LH53B';
const TAG = 'example-21';
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

function product(over: Partial<CatalogueProduct> = {}): CatalogueProduct {
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
    verification: 'unverified',
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
    for (const env of [{}, { AMAZON_ASSOCIATES_UK_TAG: '' }, { AMAZON_ASSOCIATES_UK_TAG: '  ' }, { AMAZON_ASSOCIATES_UK_TAG: 'bad tag/x' }]) {
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
    expect(wrongAsin.no_link_reason).toBe('product_not_matched');
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
    const kit = v1Variant();
    const base = { ...v1Offer(), schema_version: 2 as const, affiliate_programme: null, affiliate_programme_id: 'example-awin', price_origin: 'manual_capture' as const };
    const ok = toAffiliateDisplayOffer({ ...base, affiliate_url: 'https://www.awin1.com/cread.php?x=1' }, kit, opts({ programmes: [awin] }));
    expect(ok.link_url).toBe('https://www.awin1.com/cread.php?x=1');
    expect(toAffiliateDisplayOffer({ ...base, affiliate_url: 'http://www.awin1.com/x' }, kit, opts({ programmes: [awin] })).no_link_reason).toBe('not_https');
    expect(toAffiliateDisplayOffer({ ...base, affiliate_url: 'https://evil.example/x' }, kit, opts({ programmes: [awin] })).no_link_reason).toBe('host_not_allowed');
    expect(toAffiliateDisplayOffer({ ...base, affiliate_url: '' }, kit, opts({ programmes: [awin] })).no_link_reason).toBe('no_affiliate_url');
  });

  it('resolveAffiliateLink refuses unmatched products before looking at the programme', () => {
    expect(resolveAffiliateLink(amazonOffer(), false, [programme()], withTag).no_link_reason).toBe('product_not_matched');
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
    const shop = amazonOffer({ retailer: 'Example Shop', asin: null, asin_marketplace: null, mpn: null });
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

  it('v1 kit offers in the new path show the price state but no button (no programme)', () => {
    const d = toAffiliateDisplayOffer(v1Offer(), v1Variant(), opts());
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
  it('Amazon Associates UK is pending with only an env var name; EVAQ8 has no programme', () => {
    expect(affiliateProgrammes.map((p) => [p.programme_id, p.status, p.approved_on, p.tracking_id_env])).toEqual([
      ['amazon-associates-uk', 'pending', null, 'AMAZON_ASSOCIATES_UK_TAG'],
    ]);
  });

  it('the S1-1 manual Amazon price (£137) is nulled', () => {
    const amz = kitOffers.find((o) => o.retailer === 'Amazon UK')!;
    expect(amz.price_gbp_inc_vat).toBeNull();
    expect(amz.availability_text).toBeNull();
  });

  it('catalogue: real ASIN format, unverified, no prices, Amazon programme reference, no stored affiliate URL', () => {
    expect(catalogueProducts.length).toBeGreaterThan(0);
    for (const p of catalogueProducts) {
      expect(p.verification).toBe('unverified');
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

  it('with the tag unset and the programme pending, nothing renders a link and no price shows', () => {
    const { comparisons } = buildCatalogueComparisons(allProducts, allOffers, { now: '2026-11-15T12:00:00+00:00', programmes: affiliateProgrammes, buildEnv: {} });
    const offers = comparisons.flatMap((c) => c.offers);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.link_url === null)).toBe(true);
    expect(offers.filter((o) => o.retailer === 'Amazon UK').every((o) => o.price_gbp_inc_vat === null && !o.price_display_allowed)).toBe(true);
    expect(comparisons.every((c) => c.disclosures.length === 0)).toBe(true);
    // Even with a tag set, a pending programme renders no link.
    const tagged = buildCatalogueComparisons(allProducts, allOffers, { now: '2026-11-15T12:00:00+00:00', programmes: affiliateProgrammes, buildEnv: withTag });
    expect(tagged.comparisons.flatMap((c) => c.offers).every((o) => o.no_link_reason !== null)).toBe(true);
  });

  it('every seeded category except kits is covered by the catalogue', () => {
    const cats = new Set(catalogueProducts.map((p) => p.category));
    expect([...cats].sort()).toEqual(['emergency_blanket', 'emergency_water', 'first_aid_kit', 'power_bank', 'thermal_clothing', 'wind_up_torch_radio']);
  });
});
