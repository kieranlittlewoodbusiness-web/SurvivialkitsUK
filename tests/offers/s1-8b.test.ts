/**
 * S1-8b (#11, follow-up to PR #12): Amazon Associates UK approved, listing-verified
 * products, L6 best-price/savings gate, and the ASIN-programme parse-time guard.
 * Only the fake tag TESTONLY-21 is used here.
 */
import { describe, expect, it } from 'vitest';
import { buildCatalogueComparisons, compareProduct, isProductVerified, toAffiliateDisplayOffer } from '../../src/lib/offers/affiliate';
import {
  assertCatalogueReferences,
  parseAffiliateProgrammesFile,
  parseCatalogueProduct,
  parseCatalogueProductsFile,
  parseVariant,
  parseVariantsFile,
} from '../../src/lib/offers/schema';
import { affiliateProgrammes, allOffers, allProducts, catalogueOffers, catalogueProducts, kitOffers, kitVariants } from '../../src/lib/offers/data';
import rawProducts from '../../src/data/catalogue/products.json';
import rawVariants from '../../src/data/kits/variants.json';
import rawProgrammes from '../../src/data/affiliate/programmes.json';
import type { AffiliateProgrammeRecord, CatalogueProduct, Offer } from '../../src/lib/offers/types';
import { offer, variant } from './fixtures';

const FAKE_TAG = 'TESTONLY-21';
const NOW = '2026-11-15T12:00:00+00:00';

/** The 9 ASINs that matched title, brand, model and pack contents on 15 Nov 2026. */
const EXPECTED_VERIFIED = [
  'B0896Q8JXD',
  'B00L7S9LU4',
  'B005AQK6V2',
  'B09VBFQNKK',
  'B0987MCGXT',
  'B0CZ9LH53B',
  'B0CSSRD4NT',
  'B0DCZ82MGG',
  'B001FIQ7XU',
].sort();

const run = (env: Record<string, string | undefined>, products = allProducts) =>
  buildCatalogueComparisons(products, allOffers, { now: NOW, programmes: affiliateProgrammes, buildEnv: env }).comparisons.flatMap((c) => c.offers);

describe('programmes.json: Amazon Associates UK approved', () => {
  it('approved on 2026-11-15 with full acceptance noted, env var name only, no tag value anywhere', () => {
    const amz = affiliateProgrammes.find((p) => p.programme_id === 'amazon-associates-uk')!;
    expect(amz.status).toBe('approved');
    expect(amz.approved_on).toBe('2026-11-15');
    expect(amz.status_updated_on).toBe('2026-11-15');
    expect(amz.tracking_id_env).toBe('AMAZON_ASSOCIATES_UK_TAG');
    expect(amz.notes.join(' ')).toMatch(/full acceptance/);
    expect(amz.notes.join(' ')).toMatch(/Kieran's reading of Associates Central/);
    // No tracking-id-shaped value (…-21) and no tag= query is committed in the file.
    const text = JSON.stringify(rawProgrammes);
    expect(text).not.toMatch(/[A-Za-z0-9]-21\b/);
    expect(text).not.toMatch(/tag=/);
    expect(() => parseAffiliateProgrammesFile(rawProgrammes)).not.toThrow();
  });
});

describe('verification pass (public amazon.co.uk listings, 15 Nov 2026)', () => {
  it('exactly the 9 listing-matched products are verified; thermals, Datrex and ambiguous rows are not', () => {
    const verified = catalogueProducts.filter((p) => p.verification === 'verified').map((p) => p.asin_uk!).sort();
    expect(verified).toEqual(EXPECTED_VERIFIED);
    for (const asin of ['B01IFCIYXE', 'B0134DAXJ2', 'B005JRULU8', 'B08V17BPBC', 'B0CMPZJS97', 'B01LX282CT', 'B01LYD385A']) {
      const p = catalogueProducts.find((x) => x.asin_uk === asin)!;
      expect(p.verification).toBe('unverified');
      expect(p.verification_evidence?.outcome).toBe('not_verified');
      expect(p.verification_evidence?.note.length).toBeGreaterThan(20);
    }
  });

  it('every record carries tagless evidence dated 2026-11-15, with no price or image stored', () => {
    for (const p of catalogueProducts) {
      const ev = p.verification_evidence!;
      expect(ev.method).toBe('public_listing');
      expect(ev.checked_on).toBe('2026-11-15');
      expect(ev.source_url).toBe(`https://www.amazon.co.uk/dp/${p.asin_uk}`);
      expect(new URL(ev.source_url).search).toBe('');
      if (p.verification === 'verified') expect([...ev.checks_matched].sort()).toEqual(['brand', 'model', 'pack_contents', 'title']);
    }
    const text = JSON.stringify(rawProducts);
    expect(text).not.toMatch(/tag=/);
    expect(text).not.toMatch(/\.(jpe?g|png|webp|gif)\b/i);
    expect(text).not.toMatch(/media-amazon\.com|images-amazon\.com|ssl-images/i);
    expect(text).not.toMatch(/£\s?\d/);
    expect(() => parseCatalogueProductsFile(rawProducts)).not.toThrow();
  });

  it('kit E182P: Amazon listing is model E138, so the kit stays unverified and the Amazon row stays unmatched', () => {
    const kit = kitVariants.find((k) => k.variant_id === 'evaq8-e182p')!;
    expect(kit.verification).toBe('unverified');
    expect(kit.verification_evidence?.outcome).toBe('not_verified');
    expect(kit.verification_evidence?.note).toMatch(/E138/);
    expect(isProductVerified(kit)).toBe(false);
    const amz = kitOffers.find((o) => o.retailer === 'Amazon UK')!;
    expect(amz.model_match_confirmed).toBe(false);
    expect(() => parseVariantsFile(rawVariants)).not.toThrow();
  });

  it('every model_match_confirmed=false offer belongs to an unverified product', () => {
    for (const o of [...catalogueOffers, ...kitOffers].filter((x) => !x.model_match_confirmed)) {
      const p = allProducts.find((x) => x.variant_id === o.variant_id)!;
      expect(isProductVerified(p)).toBe(false);
    }
  });
});

describe('verification_evidence schema', () => {
  const base = catalogueProducts.find((p) => p.asin_uk === 'B0CZ9LH53B')! as CatalogueProduct;
  it('verified without evidence is rejected', () => {
    expect(() => parseCatalogueProduct({ ...base, verification_evidence: undefined })).toThrow(/verification_evidence/);
  });
  it('a tagged or non-dp source_url is rejected', () => {
    for (const url of [
      `https://www.amazon.co.uk/dp/B0CZ9LH53B?tag=${FAKE_TAG}`,
      'https://www.amazon.co.uk/dp/B0CZ9LH53B#x',
      'http://www.amazon.co.uk/dp/B0CZ9LH53B',
      'https://www.amazon.com/dp/B0CZ9LH53B',
      'https://www.amazon.co.uk/gp/product/B0CZ9LH53B',
    ]) {
      expect(() => parseCatalogueProduct({ ...base, verification_evidence: { ...base.verification_evidence!, source_url: url } })).toThrow();
    }
  });
  it('verified evidence must name every required check and this record\'s ASIN', () => {
    expect(() => parseCatalogueProduct({ ...base, verification_evidence: { ...base.verification_evidence!, checks_matched: ['title', 'brand', 'model'] } })).toThrow(/pack_contents/);
    expect(() => parseCatalogueProduct({ ...base, verification_evidence: { ...base.verification_evidence!, source_url: 'https://www.amazon.co.uk/dp/B0CSSRD4NT' } })).toThrow(/asin_uk/);
  });
  it('outcome must agree with verification', () => {
    expect(() => parseCatalogueProduct({ ...base, verification_evidence: { ...base.verification_evidence!, outcome: 'not_verified' } })).toThrow(/outcome/);
    expect(() => parseCatalogueProduct({ ...base, verification: 'unverified' })).toThrow(/outcome/);
  });
  it('a verified thermal also needs the size check (and size_label)', () => {
    const th = catalogueProducts.find((p) => p.category === 'thermal_clothing')! as CatalogueProduct;
    const src = { name: 'TEST', url: `https://www.amazon.co.uk/dp/${th.asin_uk}` };
    const sized = { ...th, verification: 'verified', specs: { ...th.specs, size_label: { value: 'M', source: src, captured_at: th.captured_at } } };
    const ev = { ...th.verification_evidence!, outcome: 'verified', checks_matched: ['title', 'brand', 'model', 'pack_contents'] };
    expect(() => parseCatalogueProduct({ ...sized, verification_evidence: ev })).toThrow(/size/);
    expect(() => parseCatalogueProduct({ ...sized, verification_evidence: { ...ev, checks_matched: [...ev.checks_matched, 'size'] } })).not.toThrow();
  });
  it('kits: verified needs evidence for the kit\'s own asin_uk', () => {
    expect(() => parseVariant(variant({ verification: 'verified' }))).toThrow(/verification_evidence/);
    const ev = { method: 'public_listing' as const, source_url: 'https://www.amazon.co.uk/dp/B075LHXZ55', checked_on: '2026-11-15', outcome: 'verified' as const, checks_matched: ['title', 'brand', 'model', 'pack_contents'] as ('title' | 'brand' | 'model' | 'pack_contents')[], note: 'TEST' };
    expect(() => parseVariant(variant({ verification: 'verified', verification_evidence: ev }))).toThrow(/asin_uk/);
    expect(() => parseVariant(variant({ verification: 'verified', asin_uk: 'B075LHXZ55', verification_evidence: ev }))).not.toThrow();
  });
});

describe('seed link counts with the committed (approved) programme', () => {
  it('fake tag set => exactly 9 sponsored nofollow amazon.co.uk/dp links, one per verified model-matched product', () => {
    const linked = run({ AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }).filter((o) => o.link_url !== null);
    expect(linked).toHaveLength(EXPECTED_VERIFIED.length);
    const asins = linked.map((o) => new URL(o.link_url!).pathname.replace('/dp/', '')).sort();
    expect(asins).toEqual(EXPECTED_VERIFIED);
    for (const o of linked) {
      const u = new URL(o.link_url!);
      expect(u.origin).toBe('https://www.amazon.co.uk');
      expect([...u.searchParams.keys()]).toEqual(['tag']);
      expect(u.searchParams.get('tag')).toBe(FAKE_TAG);
      expect(o.link_rel).toBe('sponsored nofollow');
      expect(o.model_match_confirmed).toBe(true);
      expect(o.disclosure_text).toBe('As an Amazon Associate I earn from qualifying purchases.');
      expect(o.price_gbp_inc_vat).toBeNull(); // no API access: no Amazon prices
      expect(isProductVerified(allProducts.find((p) => p.variant_id === o.variant_id)!)).toBe(true);
    }
  });
  it('every other row has a reason: product_unverified or exact_product_not_confirmed', () => {
    const rest = run({ AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }).filter((o) => o.link_url === null);
    expect(rest.map((o) => o.no_link_reason).every((r) => r === 'product_unverified' || r === 'exact_product_not_confirmed')).toBe(true);
  });
  it('tag unset, empty or malformed => 0 links', () => {
    for (const env of [{}, { AMAZON_ASSOCIATES_UK_TAG: '' }, { AMAZON_ASSOCIATES_UK_TAG: 'TESTONLY' }]) {
      expect(run(env).filter((o) => o.link_url !== null)).toHaveLength(0);
    }
  });
});

/* ---------- L6: best price and savings need a verified product ---------- */

describe('L6: unverified products never get is_best_price or savings', () => {
  const pair = (): Offer[] => [
    offer({ retailer: 'Shop A', price_gbp_inc_vat: 100, delivery_cost_gbp: 5 }),
    offer({ retailer: 'Shop B', price_gbp_inc_vat: 110, delivery_cost_gbp: 5 }),
  ];
  it('unverified kit with two verified same-day prices: not eligible, no best price, no savings', () => {
    const c = compareProduct(variant(), pair(), { now: '2026-11-14T23:30:00+00:00', programmes: [] });
    expect(c.offers).toHaveLength(2);
    expect(c.offers.every((o) => o.eligible_for_best_price === false && o.is_best_price === false)).toBe(true);
    expect(c.best_price_offer_id).toBeNull();
    expect(c.savings).toBeNull();
  });
  it('the same pair on a verified kit gets a best price and savings', () => {
    const c = compareProduct(variant({ verification: 'verified' }), pair(), { now: '2026-11-14T23:30:00+00:00', programmes: [] });
    expect(c.best_price_offer_id).not.toBeNull();
    expect(c.savings).not.toBeNull();
    expect(c.offers.filter((o) => o.is_best_price)).toHaveLength(1);
  });
  it('toAffiliateDisplayOffer: eligibility follows isProductVerified', () => {
    const o = offer();
    expect(toAffiliateDisplayOffer(o, variant(), { now: '2026-11-14T23:30:00+00:00', programmes: [] }).eligible_for_best_price).toBe(false);
    expect(toAffiliateDisplayOffer(o, variant({ verification: 'verified' }), { now: '2026-11-14T23:30:00+00:00', programmes: [] }).eligible_for_best_price).toBe(true);
  });
});

/* ---------- Optional hardening: ASIN-derived programme only on Amazon offers ---------- */

describe('parse time: a non-Amazon offer cannot reference the ASIN-derived (Amazon) programme', () => {
  const programme = (over: Partial<AffiliateProgrammeRecord> = {}): AffiliateProgrammeRecord => ({
    ...affiliateProgrammes.find((p) => p.programme_id === 'amazon-associates-uk')!,
    ...over,
  });
  const shop = (over: Partial<Offer> = {}) => offer({ schema_version: 2, price_origin: 'manual_capture', retailer: 'Example Shop', affiliate_programme_id: 'amazon-associates-uk', ...over });
  it('throws for a non-Amazon row pointing at derive_from_asin', () => {
    expect(() => assertCatalogueReferences([shop()], [programme()])).toThrow(/non-Amazon offer references ASIN-derived programme/);
  });
  it('Amazon rows and stored_exact_url programmes are unaffected; the committed seed loads', () => {
    expect(() => assertCatalogueReferences(catalogueOffers, affiliateProgrammes)).not.toThrow();
    expect(() =>
      assertCatalogueReferences([shop({ affiliate_programme_id: 'shop-direct' })], [programme({ programme_id: 'shop-direct', link_mode: 'stored_exact_url', tracking_id_env: null, allowed_hosts: ['example.test'] })]),
    ).not.toThrow();
  });
});
