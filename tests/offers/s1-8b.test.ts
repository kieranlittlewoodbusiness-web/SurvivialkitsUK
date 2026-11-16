/**
 * S1-8b (#11, follow-up to PR #12): Amazon Associates UK approved, listing-verified
 * products, L6 best-price/savings gate, and the ASIN-programme parse-time guard.
 * Only the fake tag TESTONLY-21 is used here.
 */
import { describe, expect, it } from 'vitest';
import { buildCatalogueComparisons, compareProduct, isProductionLinkBuild, isProductVerified, resolveAffiliateLink, toAffiliateDisplayOffer } from '../../src/lib/offers/affiliate';
import {
  assertCatalogueReferences,
  parseAffiliateProgrammesFile,
  parseCatalogueProduct,
  parseCatalogueProductsFile,
  parseVariant,
  parseVariantsFile,
  requiredVerificationChecks,
} from '../../src/lib/offers/schema';
import { affiliateProgrammes, allOffers, allProducts, catalogueOffers, catalogueProducts, kitOffers, kitVariants } from '../../src/lib/offers/data';
import rawProducts from '../../src/data/catalogue/products.json';
import rawVariants from '../../src/data/kits/variants.json';
import rawProgrammes from '../../src/data/affiliate/programmes.json';
import type { AffiliateProgrammeRecord, CatalogueProduct, Offer } from '../../src/lib/offers/types';
import { offer, variant } from './fixtures';
import { KNOWN_UNVERIFIED, RENDERED_ASINS, TEST_BUYABILITY, RENDERED_COUNT, VERIFIED_ASINS, VERIFIED_COUNT } from './verifiedSet';

const FAKE_TAG = 'TESTONLY-21';
const NOW = '2026-11-15T12:00:00+00:00';
/** S1-10b categories (evidence checked 16 Nov 2026). */
const S1_10B_CATEGORIES: string[] = ['water_container', 'rainwater_storage', 'gravity_filter', 'flask', 'tin_opener', 'electric_lighter', 'two_way_radio', 'multi_tool', 'sleeping_bag', 'hygiene', 'baby_care', 'document_pouch', 'home_kit', 'grab_bag_kit'];

/** S1-10: the verified set lives in one place (tests/offers/verifiedSet.ts). */
const EXPECTED_VERIFIED = [...VERIFIED_ASINS];
/** S1-10b (CR M1): rendered output = verified minus render-gated categories. */
const EXPECTED_RENDERED = [...RENDERED_ASINS];

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
  it('exactly the verified-set products are verified; Datrex, Mayday, AA, PR #17 Energizers and ambiguous rows are not', () => {
    const verified = catalogueProducts.filter((p) => p.verification === 'verified').map((p) => p.asin_uk!).sort();
    expect(verified).toEqual(EXPECTED_VERIFIED);
    for (const asin of KNOWN_UNVERIFIED) {
      const p = catalogueProducts.find((x) => x.asin_uk === asin)!;
      expect(p.verification).toBe('unverified');
      expect(p.verification_evidence?.outcome).toBe('not_verified');
      expect(p.verification_evidence?.note.length).toBeGreaterThan(20);
    }
  });

  it('every record carries tagless evidence dated 2026-11-15 (S1-10b: 2026-11-16), with no price or image stored', () => {
    for (const p of catalogueProducts) {
      const ev = p.verification_evidence!;
      expect(ev.method).toBe('public_listing');
      // S1-10b: Duronic radio B002XNGTOI was added 16 Nov (QA #24 replacement).
      expect(ev.checked_on).toBe(S1_10B_CATEGORIES.includes(p.category) || p.asin_uk === 'B002XNGTOI' ? '2026-11-16' : '2026-11-15');
      expect(ev.source_url).toBe(`https://www.amazon.co.uk/dp/${p.asin_uk}`);
      expect(new URL(ev.source_url).search).toBe('');
      if (p.verification === 'verified') expect([...ev.checks_matched].sort()).toEqual([...requiredVerificationChecks(p.category)].sort());
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
    const sized = { ...th, verification: 'verified', display_name: 'Heatwave thermal top (medium)', specs: { ...th.specs, size_label: { value: 'M', source: src, captured_at: th.captured_at } } };
    const ev = { ...th.verification_evidence!, outcome: 'verified', checks_matched: ['title', 'brand', 'model', 'pack_contents'], buyability: TEST_BUYABILITY };
    expect(() => parseCatalogueProduct({ ...sized, verification_evidence: ev })).toThrow(/size/);
    expect(() => parseCatalogueProduct({ ...sized, verification_evidence: { ...ev, checks_matched: [...ev.checks_matched, 'size'] } })).not.toThrow();
  });
  it('kits: verified needs evidence for the kit\'s own asin_uk', () => {
    expect(() => parseVariant(variant({ verification: 'verified' }))).toThrow(/verification_evidence/);
    const ev = { method: 'public_listing' as const, source_url: 'https://www.amazon.co.uk/dp/B075LHXZ55', checked_on: '2026-11-15', outcome: 'verified' as const, checks_matched: ['title', 'brand', 'model', 'pack_contents'] as ('title' | 'brand' | 'model' | 'pack_contents')[], note: 'TEST', buyability: TEST_BUYABILITY };
    expect(() => parseVariant(variant({ verification: 'verified', verification_evidence: ev }))).toThrow(/asin_uk/);
    expect(() => parseVariant(variant({ verification: 'verified', asin_uk: 'B075LHXZ55', verification_evidence: ev }))).not.toThrow();
  });
});

describe('seed link counts with the committed (approved) programme', () => {
  it('fake tag set => exactly one sponsored nofollow amazon.co.uk/dp link per verified model-matched product (amazon.co.uk/dp)', () => {
    const linked = run({ SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }).filter((o) => o.link_url !== null);
    expect(linked).toHaveLength(EXPECTED_RENDERED.length);
    const asins = linked.map((o) => new URL(o.link_url!).pathname.replace('/dp/', '')).sort();
    expect(asins).toEqual(EXPECTED_RENDERED);
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
    const rest = run({ SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }).filter((o) => o.link_url === null);
    expect(rest.map((o) => o.no_link_reason).every((r) => r === 'product_unverified' || r === 'exact_product_not_confirmed')).toBe(true);
  });
  it('tag unset, empty or malformed => 0 links', () => {
    for (const env of [{ SITE_ENV: 'production' }, { SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: '' }, { SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: 'TESTONLY' }]) {
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

/* ---------- PR #13 review M1: links only in production builds ---------- */

describe('M1: Amazon links only in a production build (SITE_ENV=production, not a Cloudflare preview)', () => {
  const T = { AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG };
  const count = (env: Record<string, string | undefined>) => run(env).filter((o) => o.link_url !== null).length;

  it('real seed + fake tag + SITE_ENV=production => exactly RENDERED_COUNT links', () => {
    expect(count({ ...T, SITE_ENV: 'production' })).toBe(RENDERED_COUNT);
  });
  it('real seed + fake tag + SITE_ENV=preview => 0 links', () => {
    expect(count({ ...T, SITE_ENV: 'preview' })).toBe(0);
  });
  it.each([
    ['SITE_ENV unset', { ...T }],
    ['SITE_ENV empty', { ...T, SITE_ENV: '' }],
    ['SITE_ENV=preview', { ...T, SITE_ENV: 'preview' }],
    ['SITE_ENV=bogus', { ...T, SITE_ENV: 'bogus' }],
    ['SITE_ENV=Production (wrong case)', { ...T, SITE_ENV: 'Production' }],
    ['CF preview branch + SITE_ENV=production', { ...T, SITE_ENV: 'production', CF_PAGES: '1', CF_PAGES_BRANCH: 'feature-x' }],
    ['CF preview branch, SITE_ENV unset', { ...T, CF_PAGES: '1', CF_PAGES_BRANCH: 'feature-x' }],
    ['CF branch main but PRODUCTION_BRANCH=release', { ...T, SITE_ENV: 'production', CF_PAGES: '1', CF_PAGES_BRANCH: 'main', PRODUCTION_BRANCH: 'release' }],
  ])('%s (fake tag set) => 0 links, reason non_production_build', (_k, env) => {
    expect(count(env)).toBe(0);
    const amazonMatched = run(env).filter((o) => o.retailer === 'Amazon UK' && o.no_link_reason !== 'product_unverified' && o.no_link_reason !== 'exact_product_not_confirmed');
    expect(amazonMatched).toHaveLength(RENDERED_COUNT);
    expect(amazonMatched.every((o) => o.no_link_reason === 'non_production_build' && o.disclosure_text === null)).toBe(true);
  });
  it.each([
    ['local production build', { ...T, SITE_ENV: 'production' }],
    ['CF production branch (main)', { ...T, SITE_ENV: 'production', CF_PAGES: '1', CF_PAGES_BRANCH: 'main' }],
    ['CF production branch via PRODUCTION_BRANCH', { ...T, SITE_ENV: 'production', CF_PAGES: '1', CF_PAGES_BRANCH: 'release', PRODUCTION_BRANCH: 'release' }],
  ])('%s + fake tag => RENDERED_COUNT links', (_k, env) => {
    expect(isProductionLinkBuild(env)).toBe(true);
    expect(count(env)).toBe(RENDERED_COUNT);
  });
  it('the build check runs before the tag is read (a preview with a malformed tag still says non_production_build)', () => {
    const r = run({ SITE_ENV: 'preview', AMAZON_ASSOCIATES_UK_TAG: 'TESTONLY' }).filter((o) => o.no_link_reason === 'non_production_build');
    expect(r).toHaveLength(RENDERED_COUNT);
  });
  it('isProductionLinkBuild never throws on a bogus SITE_ENV (fails closed)', () => {
    expect(() => isProductionLinkBuild({ SITE_ENV: 'bogus' })).not.toThrow();
    expect(isProductionLinkBuild({ SITE_ENV: 'bogus' })).toBe(false);
    expect(isProductionLinkBuild({})).toBe(false);
  });
  it('resolveAffiliateLink with only a tag (no SITE_ENV) gives no link', () => {
    const o = catalogueOffers.find((x) => x.asin === 'B0CZ9LH53B')!;
    expect(resolveAffiliateLink(o, true, affiliateProgrammes, { ...T }, true).no_link_reason).toBe('non_production_build');
    expect(resolveAffiliateLink(o, true, affiliateProgrammes, { ...T, SITE_ENV: 'production' }, true).link_url).not.toBeNull();
  });
});

/* ---------- PR #13 review L1: no future checked_on ---------- */

describe('L1: verification_evidence.checked_on cannot be in the future (Europe/London)', () => {
  const base = catalogueProducts.find((p) => p.asin_uk === 'B0CZ9LH53B')! as CatalogueProduct;
  const withDate = (d: string) => ({ ...base, verification_evidence: { ...base.verification_evidence!, checked_on: d } });
  it('rejects 2030-01-01 and tomorrow; accepts today and earlier', () => {
    const now = '2026-11-15T12:00:00+00:00';
    expect(() => parseCatalogueProduct(withDate('2030-01-01'), { now })).toThrow(/in the future/);
    expect(() => parseCatalogueProduct(withDate('2026-11-16'), { now })).toThrow(/in the future/);
    expect(() => parseCatalogueProduct(withDate('2026-11-15'), { now })).not.toThrow();
    expect(() => parseCatalogueProduct(withDate('2026-11-01'), { now })).not.toThrow();
  });
  it('uses the London calendar day (23:30 GMT on the 15th is still the 15th)', () => {
    expect(() => parseCatalogueProduct(withDate('2026-11-16'), { now: '2026-11-15T23:30:00+00:00' })).toThrow(/in the future/);
    expect(() => parseCatalogueProduct(withDate('2026-11-16'), { now: '2026-11-16T00:05:00+00:00' })).not.toThrow();
  });
  it('defaults to the real clock: 2030-01-01 is rejected with no injected now', () => {
    expect(() => parseCatalogueProduct(withDate('2030-01-01'))).toThrow(/in the future/);
  });
  it('applies to the products file, kit variants file and single kit variants', () => {
    const file = { ...(rawProducts as object), products: [withDate('2030-01-01')] };
    expect(() => parseCatalogueProductsFile(file, { now: NOW })).toThrow(/in the future/);
    const kit = (rawVariants as { variants: object[] }).variants[0] as { verification_evidence: object };
    const kitFuture = { ...kit, verification_evidence: { ...kit.verification_evidence, checked_on: '2030-01-01' } };
    expect(() => parseVariant(kitFuture, { now: NOW })).toThrow(/in the future/);
    expect(() => parseVariantsFile({ ...(rawVariants as object), variants: [kitFuture] }, { now: NOW })).toThrow(/in the future/);
    expect(() => parseVariantsFile(rawVariants, { now: NOW })).not.toThrow();
    expect(() => parseCatalogueProductsFile(rawProducts, { now: '2026-11-16T12:00:00+00:00' })).not.toThrow();
    expect(() => parseCatalogueProductsFile(rawProducts, { now: NOW })).toThrow(/2026-11-16 is in the future/);
  });
});

/* ---------- PM: UGREEN identity keys (PB312 + SKU 25683); TSADF7G5634 listing-only ---------- */

describe('UGREEN Nexode B0CSSRD4NT identity keys', () => {
  const ug = () => catalogueProducts.find((p) => p.asin_uk === 'B0CSSRD4NT')! as CatalogueProduct;
  it('model PB312 and SKU 25683 are the identity keys; TSADF7G5634 is listing_mpn only (not mpn)', () => {
    const p = ug();
    expect(p.model_code).toBe('PB312');
    expect(p.manufacturer_sku).toBe('25683');
    expect(p.listing_mpn).toBe('TSADF7G5634');
    expect(p.mpn).toBeNull();
    const o = catalogueOffers.find((x) => x.asin === 'B0CSSRD4NT')!;
    expect(o.mpn).toBeNull();
    expect(o.model_match_confirmed).toBe(true);
  });
  it('S1-10b QA #24: now unverified (Buy Box seller is HK-registered) and not linked; the verified set is derived', () => {
    expect(ug().verification).toBe('unverified');
    expect(ug().verification_evidence!.buyability).toMatchObject({ outcome: 'fail', seller_class: 'other' });
    expect(isProductVerified(ug())).toBe(false);
    expect(catalogueProducts.filter((p) => p.verification === 'verified')).toHaveLength(VERIFIED_COUNT);
    const linked = run({ SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }).filter((o) => o.link_url !== null);
    expect(linked).toHaveLength(RENDERED_COUNT);
    expect(linked.some((o) => o.variant_id === ug().variant_id)).toBe(false);
  });
  it('schema: listing_mpn may not double as an identity key; blank values are rejected; both fields optional', () => {
    const p = ug();
    expect(() => parseCatalogueProduct(p, { now: NOW })).not.toThrow();
    for (const key of ['mpn', 'manufacturer_sku', 'model_code'] as const) {
      expect(() => parseCatalogueProduct({ ...p, [key]: 'TSADF7G5634' }, { now: NOW })).toThrow(/listing_mpn/);
    }
    expect(() => parseCatalogueProduct({ ...p, manufacturer_sku: '  ' }, { now: NOW })).toThrow();
    expect(() => parseCatalogueProduct({ ...p, listing_mpn: '' }, { now: NOW })).toThrow();
    const { manufacturer_sku: _s, listing_mpn: _l, ...without } = p;
    expect(() => parseCatalogueProduct(without, { now: NOW })).not.toThrow();
  });
  it('a different offer MPN does not break the ASIN match once the product mpn is null (listing MPN is ignored for identity)', () => {
    const o = { ...catalogueOffers.find((x) => x.asin === 'B0CSSRD4NT')!, mpn: 'TSADF7G5634' };
    const verifiedCopy = { ...ug(), verification: 'verified' as const, verification_evidence: { ...ug().verification_evidence!, outcome: 'verified' as const, buyability: TEST_BUYABILITY } };
    const d = toAffiliateDisplayOffer(o, verifiedCopy, { now: NOW, programmes: affiliateProgrammes, buildEnv: { SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG } });
    expect(d.model_match_confirmed).toBe(true);
    expect(d.link_url).not.toBeNull();
  });
});
