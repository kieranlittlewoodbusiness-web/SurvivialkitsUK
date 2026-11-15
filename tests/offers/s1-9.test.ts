/**
 * S1-9: Amazon UK products for the site's checklist items (data only; Web wires the UI later).
 * Only the fake tag TESTONLY-21 is used here.
 */
import { describe, expect, it } from 'vitest';
import { buildCatalogueComparisons, isProductVerified } from '../../src/lib/offers/affiliate';
import { parseOffersFile, parseCatalogueProductsFile } from '../../src/lib/offers/schema';
import { affiliateProgrammes, allOffers, allProducts, catalogueOffers, catalogueProducts } from '../../src/lib/offers/data';
import rawProducts from '../../src/data/catalogue/products.json';
import rawOffers from '../../src/data/catalogue/offers.json';
import { ALL_VERIFIED, S1_8B_VERIFIED, S1_9_NEW_UNVERIFIED, S1_9_NEW_VERIFIED } from './verified-set';

const FAKE_TAG = 'TESTONLY-21';
const NOW = '2026-11-15T12:00:00+00:00';
const run = (env: Record<string, string | undefined>) =>
  buildCatalogueComparisons(allProducts, allOffers, { now: NOW, programmes: affiliateProgrammes, buildEnv: env }).comparisons.flatMap((c) => c.offers);
const linkCount = (env: Record<string, string | undefined>) => run(env).filter((o) => o.link_url !== null).length;
const NEW = [...S1_9_NEW_VERIFIED, ...S1_9_NEW_UNVERIFIED];

describe('S1-9 catalogue additions', () => {
  it('the committed files still parse', () => {
    expect(() => parseCatalogueProductsFile(rawProducts, { now: NOW })).not.toThrow();
    expect(() => parseOffersFile(rawOffers)).not.toThrow();
  });

  it('the S1-8b 9 are untouched and still verified; the S1-9 verified/unverified sets are as recorded', () => {
    const verified = catalogueProducts.filter((p) => p.verification === 'verified').map((p) => p.asin_uk!).sort();
    expect(verified).toEqual(ALL_VERIFIED);
    expect(verified).toHaveLength(S1_8B_VERIFIED.length + S1_9_NEW_VERIFIED.length);
    for (const a of S1_9_NEW_UNVERIFIED) {
      const p = catalogueProducts.find((x) => x.asin_uk === a)!;
      expect(p.verification).toBe('unverified');
      expect(p.verification_evidence?.outcome).toBe('not_verified');
      expect(p.verification_evidence?.note.length).toBeGreaterThan(20);
    }
  });

  it.each(NEW)('%s: tagless dated evidence with the verbatim listing title, and exactly one identity-only Amazon offer', (asin) => {
    const p = catalogueProducts.find((x) => x.asin_uk === asin)!;
    expect(p).toBeDefined();
    const ev = p.verification_evidence!;
    expect(ev.method).toBe('public_listing');
    expect(ev.source_url).toBe(`https://www.amazon.co.uk/dp/${asin}`);
    expect(ev.checked_on).toBe('2026-11-15');
    expect(ev.note).toContain(`Amazon listing title (verbatim, 15 Nov 2026): "${p.product_name}"`);
    if (p.verification === 'verified') expect([...ev.checks_matched].sort()).toEqual(['brand', 'model', 'pack_contents', 'title']);

    const offers = catalogueOffers.filter((o) => o.variant_id === p.variant_id);
    expect(offers).toHaveLength(1);
    const o = offers[0];
    expect(o.retailer).toBe('Amazon UK');
    expect(o.asin).toBe(asin);
    expect(o.asin_marketplace).toBe('amazon.co.uk');
    expect(o.product_url).toBe(`https://www.amazon.co.uk/dp/${asin}`);
    expect(o.affiliate_url).toBe('');
    expect(o.affiliate_programme_id).toBe('amazon-associates-uk');
    expect(o.model_match_confirmed).toBe(p.verification === 'verified');
    expect(o.mpn).toBe(p.mpn);
    expect(o.gtin).toBe(p.gtin);
    // Identity only: no price, delivery, availability or was-price stored.
    expect(o.price_gbp_inc_vat).toBeNull();
    expect(o.price_gbp_ex_vat).toBeNull();
    expect(o.price_verified).toBe(false);
    expect(o.price_origin).toBe('none');
    expect(o.delivery_cost_gbp).toBeNull();
    expect(o.delivery_text_verbatim).toBeNull();
    expect(o.availability_text).toBeNull();
    expect(o.was_price_gbp).toBeNull();
    expect(o.screenshot_path).toBeNull();
  });

  it('every verified catalogue product has evidence and an identity-only, model-matched Amazon offer', () => {
    for (const p of catalogueProducts.filter((x) => x.verification === 'verified')) {
      expect(isProductVerified(p)).toBe(true);
      expect(p.verification_evidence?.outcome).toBe('verified');
      const o = catalogueOffers.find((x) => x.variant_id === p.variant_id && x.retailer === 'Amazon UK');
      expect(o, p.asin_uk!).toBeDefined();
      expect(o!.asin).toBe(p.asin_uk);
      expect(o!.model_match_confirmed).toBe(true);
      expect(o!.price_gbp_inc_vat).toBeNull();
      expect(o!.price_origin).toBe('none');
    }
  });

  it('new torches sit in wind_up_torch_radio as device_type torch (no new category)', () => {
    for (const a of S1_9_NEW_VERIFIED) {
      const p = catalogueProducts.find((x) => x.asin_uk === a)!;
      expect(p.category).toBe('wind_up_torch_radio');
      expect(p.category === 'wind_up_torch_radio' && p.specs.device_type?.value).toBe('torch');
    }
  });

  it('no tag, price or image is committed in the catalogue files', () => {
    for (const raw of [rawProducts, rawOffers]) {
      const text = JSON.stringify(raw);
      expect(text).not.toMatch(/tag=/);
      expect(text).not.toMatch(/[A-Za-z0-9]-21\b/);
      expect(text).not.toMatch(/£\s?\d/);
      expect(text).not.toMatch(/\.(jpe?g|png|webp|gif)\b/i);
      expect(text).not.toMatch(/media-amazon\.com|images-amazon\.com|ssl-images/i);
    }
  });
});

describe('S1-9 link counts (fake tag only)', () => {
  it(`fake tag + SITE_ENV=production => 9 + ${S1_9_NEW_VERIFIED.length} new verified = ${ALL_VERIFIED.length} links, exactly the verified ASINs`, () => {
    const linked = run({ SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG }).filter((o) => o.link_url !== null);
    expect(linked).toHaveLength(9 + S1_9_NEW_VERIFIED.length);
    expect(linked.map((o) => new URL(o.link_url!).pathname.replace('/dp/', '')).sort()).toEqual(ALL_VERIFIED);
    for (const o of linked) {
      const u = new URL(o.link_url!);
      expect(u.origin).toBe('https://www.amazon.co.uk');
      expect([...u.searchParams.keys()]).toEqual(['tag']);
      expect(o.link_rel).toBe('sponsored nofollow');
    }
    for (const a of S1_9_NEW_UNVERIFIED) expect(linked.some((o) => o.link_url!.includes(a))).toBe(false);
  });
  it('tag unset (production) => 0 links', () => {
    expect(linkCount({ SITE_ENV: 'production' })).toBe(0);
  });
  it('fake tag + SITE_ENV=preview or unset => 0 links', () => {
    expect(linkCount({ SITE_ENV: 'preview', AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG })).toBe(0);
    expect(linkCount({ AMAZON_ASSOCIATES_UK_TAG: FAKE_TAG })).toBe(0);
  });
});
