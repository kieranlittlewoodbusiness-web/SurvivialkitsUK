/**
 * S1-8c (#11): tagless preview_link_url for preview builds. Fake tag TESTONLY-21 only.
 */
import { describe, expect, it } from 'vitest';
import {
  amazonUkPreviewUrl,
  buildCatalogueComparisons,
  isPreviewLinkBuild,
  resolvePreviewLinkUrl,
  toAffiliateDisplayOffer,
} from '../../src/lib/offers/affiliate';
import { affiliateProgrammes, allOffers, allProducts, catalogueOffers, catalogueProducts, kitOffers, kitVariants } from '../../src/lib/offers/data';
import type { BuildEnv, CatalogueProduct, Offer } from '../../src/lib/offers/types';
import { offer as v1Offer, variant as v1Variant } from './fixtures';

const FAKE_TAG = 'TESTONLY-21';
const NOW = '2026-11-15T12:00:00+00:00';
const TAG_KEY = 'AMAZON_ASSOCIATES_UK_TAG';
const PREVIEW_RE = /^https:\/\/www\.amazon\.co\.uk\/dp\/[A-Z0-9]{10}$/;

/** Env spy: records every key read; optionally throws when the tag key is read. */
function spyEnv(values: BuildEnv, throwOnTag: boolean) {
  const reads: string[] = [];
  const env = new Proxy({ ...values } as BuildEnv, {
    get(target, key) {
      if (typeof key === 'string') {
        reads.push(key);
        if (throwOnTag && key === TAG_KEY) throw new Error('tag was read');
      }
      return Reflect.get(target, key);
    },
    has(target, key) {
      if (typeof key === 'string') {
        reads.push(`has:${key}`);
        if (throwOnTag && key === TAG_KEY) throw new Error('tag was probed');
      }
      return Reflect.has(target, key);
    },
    ownKeys() {
      throw new Error('env must not be enumerated');
    },
  });
  return { env, reads };
}

const run = (env: BuildEnv) =>
  buildCatalogueComparisons(allProducts, allOffers, { now: NOW, programmes: affiliateProgrammes, buildEnv: env }).comparisons.flatMap((c) => c.offers);

describe('real seed + SITE_ENV=preview (fake tag present)', () => {
  it('exactly 9 tagless preview URLs, link_url null for all, and the tag is never accessed', () => {
    const { env, reads } = spyEnv({ SITE_ENV: 'preview', [TAG_KEY]: FAKE_TAG }, true);
    const shown = run(env);
    const previews = shown.map((o) => o.preview_link_url).filter((u): u is string => u !== null && u !== undefined);
    expect(previews).toHaveLength(9);
    for (const u of previews) {
      expect(u).toMatch(PREVIEW_RE);
      expect(u).not.toContain('tag');
      expect(u).not.toContain('?');
    }
    expect(previews.filter((u) => u.includes('tag') || u.includes('?'))).toHaveLength(0);
    expect(shown.every((o) => o.link_url === null)).toBe(true);
    expect(reads.filter((k) => k.includes(TAG_KEY))).toHaveLength(0);
    expect(reads).toContain('SITE_ENV'); // positive control: the spy does observe reads
  });

  it('preview rows: rel kept for the button, still not an affiliate link, no disclosure, reason non_production_build', () => {
    const rows = run({ SITE_ENV: 'preview', [TAG_KEY]: FAKE_TAG }).filter((o) => o.preview_link_url);
    expect(rows).toHaveLength(9);
    for (const o of rows) {
      expect(o.link_rel).toBe('sponsored nofollow');
      expect(o.is_affiliate_link).toBe(false);
      expect(o.disclosure_text).toBeNull();
      expect(o.no_link_reason).toBe('non_production_build');
      expect(o.preview_link_url).toBe(`https://www.amazon.co.uk/dp/${allProducts.find((p) => p.variant_id === o.variant_id)!.asin_uk}`);
    }
    // Rows without a preview URL keep link_rel null.
    expect(run({ SITE_ENV: 'preview' }).filter((o) => !o.preview_link_url).every((o) => o.link_rel === null)).toBe(true);
  });

  it('the preview URLs are exactly the verified products (the same 9 that link in production)', () => {
    const prev = run({ SITE_ENV: 'preview' }).filter((o) => o.preview_link_url).map((o) => o.variant_id).sort();
    const prod = run({ SITE_ENV: 'production', [TAG_KEY]: FAKE_TAG }).filter((o) => o.link_url).map((o) => o.variant_id).sort();
    expect(prev).toEqual(prod);
    expect(prev).toEqual(catalogueProducts.filter((p) => p.verification === 'verified').map((p) => p.variant_id).sort());
  });
});

describe('production and other envs', () => {
  it('production + fake tag => 0 preview URLs and 9 link_urls (the tag IS read here: spy positive control)', () => {
    const { env, reads } = spyEnv({ SITE_ENV: 'production', [TAG_KEY]: FAKE_TAG }, false);
    const shown = run(env);
    expect(shown.filter((o) => o.preview_link_url)).toHaveLength(0);
    expect(shown.filter((o) => o.preview_link_url !== null)).toHaveLength(0);
    expect(shown.filter((o) => o.link_url !== null)).toHaveLength(9);
    expect(reads).toContain(TAG_KEY);
  });
  it.each([
    ['SITE_ENV unset', { [TAG_KEY]: FAKE_TAG }],
    ['SITE_ENV empty', { SITE_ENV: '', [TAG_KEY]: FAKE_TAG }],
    ['SITE_ENV=bogus', { SITE_ENV: 'bogus', [TAG_KEY]: FAKE_TAG }],
    ['SITE_ENV=Preview (wrong case)', { SITE_ENV: 'Preview', [TAG_KEY]: FAKE_TAG }],
    ['CF branch preview, SITE_ENV unset (strict: not a preview build)', { CF_PAGES: '1', CF_PAGES_BRANCH: 'feature-x', [TAG_KEY]: FAKE_TAG }],
    ['CF branch preview + SITE_ENV=production', { SITE_ENV: 'production', CF_PAGES: '1', CF_PAGES_BRANCH: 'feature-x', [TAG_KEY]: FAKE_TAG }],
  ])('%s => 0 preview URLs and 0 link_urls', (_k, env) => {
    const shown = run(env);
    expect(shown.filter((o) => o.preview_link_url)).toHaveLength(0);
    expect(shown.filter((o) => o.link_url)).toHaveLength(0);
  });
  it('isPreviewLinkBuild is strict', () => {
    expect(isPreviewLinkBuild({ SITE_ENV: 'preview' })).toBe(true);
    for (const env of [{}, { SITE_ENV: 'production' }, { SITE_ENV: 'Preview' }, { CF_PAGES: '1', CF_PAGES_BRANCH: 'x' }]) {
      expect(isPreviewLinkBuild(env)).toBe(false);
    }
  });
});

describe('null cases in a preview build', () => {
  const PREVIEW = { SITE_ENV: 'preview', [TAG_KEY]: FAKE_TAG };
  const o = { now: NOW, programmes: affiliateProgrammes, buildEnv: PREVIEW };
  const verified = catalogueProducts.find((p) => p.asin_uk === 'B0CZ9LH53B')! as CatalogueProduct;
  const vOffer = catalogueOffers.find((x) => x.asin === 'B0CZ9LH53B')!;

  it('control: a verified, matched Amazon UK offer gets the URL', () => {
    expect(toAffiliateDisplayOffer(vOffer, verified, o).preview_link_url).toBe('https://www.amazon.co.uk/dp/B0CZ9LH53B');
  });
  it('unverified product => null', () => {
    const d = toAffiliateDisplayOffer(vOffer, { ...verified, verification: 'unverified' } as CatalogueProduct, o);
    expect(d.preview_link_url).toBeNull();
    expect(d.link_rel).toBeNull();
    for (const p of catalogueProducts.filter((x) => x.verification !== 'verified')) {
      const off = catalogueOffers.find((x) => x.variant_id === p.variant_id)!;
      expect(toAffiliateDisplayOffer(off, p, o).preview_link_url).toBeNull();
    }
  });
  it('model_match_confirmed=false => null (seed Datrex and kit Amazon rows too)', () => {
    expect(toAffiliateDisplayOffer({ ...vOffer, model_match_confirmed: false }, verified, o).preview_link_url).toBeNull();
    const datrex = catalogueOffers.find((x) => x.asin === 'B0134DAXJ2')!;
    expect(toAffiliateDisplayOffer(datrex, catalogueProducts.find((p) => p.asin_uk === 'B0134DAXJ2')!, o).preview_link_url).toBeNull();
    const kitAmz = kitOffers.find((x) => x.retailer === 'Amazon UK')!;
    expect(toAffiliateDisplayOffer(kitAmz, { ...kitVariants[0]!, verification: 'verified' }, o).preview_link_url).toBeNull();
  });
  it('ASIN mismatch => null', () => {
    expect(toAffiliateDisplayOffer({ ...vOffer, asin: 'B0CSSRD4NT' }, verified, o).preview_link_url).toBeNull();
  });
  it('thermal marked verified without size_label => null; with size_label => URL', () => {
    const th = catalogueProducts.find((p) => p.category === 'thermal_clothing')! as CatalogueProduct;
    const thOffer = catalogueOffers.find((x) => x.variant_id === th.variant_id)!;
    expect(toAffiliateDisplayOffer(thOffer, { ...th, verification: 'verified' } as CatalogueProduct, o).preview_link_url).toBeNull();
    const src = { name: 'TEST', url: `https://www.amazon.co.uk/dp/${th.asin_uk}` };
    const sized = { ...th, verification: 'verified', specs: { ...th.specs, size_label: { value: 'M', source: src, captured_at: th.captured_at } } } as CatalogueProduct;
    expect(toAffiliateDisplayOffer(thOffer, sized, o).preview_link_url).toBe(`https://www.amazon.co.uk/dp/${th.asin_uk}`);
  });
  it('non-Amazon offers => null (shop row on a verified kit; EVAQ8 seed row)', () => {
    const shop = v1Offer({ schema_version: 2, price_origin: 'manual_capture', retailer: 'Example Shop', affiliate_programme_id: null });
    expect(toAffiliateDisplayOffer(shop, v1Variant({ verification: 'verified' }), o).preview_link_url).toBeNull();
    const evaq8 = kitOffers.find((x) => x.retailer === 'EVAQ8')!;
    expect(toAffiliateDisplayOffer(evaq8, { ...kitVariants[0]!, verification: 'verified' }, o).preview_link_url).toBeNull();
    // Even if a non-Amazon row wrongly references the Amazon programme at runtime.
    const wrong: Offer = { ...shop, affiliate_programme_id: 'amazon-associates-uk' };
    expect(resolvePreviewLinkUrl(wrong, true, affiliateProgrammes, PREVIEW, true)).toBeNull();
  });
  it('non-UK Amazon URL, pending programme, or no programme => null', () => {
    expect(toAffiliateDisplayOffer({ ...vOffer, source: { ...vOffer.source, url: 'https://www.amazon.com/dp/B0CZ9LH53B' } }, verified, o).preview_link_url).toBeNull();
    const pending = affiliateProgrammes.map((p) => ({ ...p, status: 'pending' as const, approved_on: null }));
    expect(toAffiliateDisplayOffer(vOffer, verified, { ...o, programmes: pending }).preview_link_url).toBeNull();
    expect(toAffiliateDisplayOffer({ ...vOffer, affiliate_programme_id: null }, verified, o).preview_link_url).toBeNull();
  });
  it('built from the ASIN only: stored URLs with tags or other paths are ignored', () => {
    const tampered = { ...vOffer, product_url: 'https://www.amazon.co.uk/gp/product/B0CZ9LH53B?tag=other-21&ref=x', affiliate_url: '' };
    expect(toAffiliateDisplayOffer(tampered, verified, o).preview_link_url).toBe('https://www.amazon.co.uk/dp/B0CZ9LH53B');
  });
  it('resolvePreviewLinkUrl fails closed when productVerified is omitted; amazonUkPreviewUrl rejects bad ASINs', () => {
    expect(resolvePreviewLinkUrl(vOffer, true, affiliateProgrammes, PREVIEW)).toBeNull();
    expect(resolvePreviewLinkUrl(vOffer, true, affiliateProgrammes, PREVIEW, true)).toBe('https://www.amazon.co.uk/dp/B0CZ9LH53B');
    expect(() => amazonUkPreviewUrl('b0cz9lh53b')).toThrow();
    expect(() => amazonUkPreviewUrl('B0CZ9LH53B?tag=x')).toThrow();
  });
});
