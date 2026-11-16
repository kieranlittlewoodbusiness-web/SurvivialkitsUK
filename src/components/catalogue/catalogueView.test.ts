import { describe, expect, it } from 'vitest';
import {
  buttonLink,
  shownPrice,
  AMAZON_DISCLOSURE,
  cardDisplayName,
  cleanProductTitle,
  productImage,
  FALLBACK_IMAGE_SIZE,
  loadCatalogue,
} from './catalogueView';
import type { AffiliateDisplayOffer } from '../../lib/offers';
import { affiliateProgrammes } from '../../lib/offers/data';
import { isProductVerified, isShortlistable, PRODUCT_CATEGORIES } from '../../lib/offers';
import { catalogueProducts } from '../../lib/offers/data';
// S1-10b (Backend, CR M1): rendered expectations use RENDERED_BY_CATEGORY (verified minus render-gated categories).
import { RENDERED_BY_CATEGORY as VERIFIED_BY_CATEGORY, VERIFIED_ASINS, VERIFIED_COUNT } from '../../../tests/offers/verifiedSet';

const NOW = new Date('2026-11-15T12:00:00Z');
const base = {
  offer_id: 'o1',
  variant_id: 'v1',
  category: 'power_bank',
  retailer: 'Amazon UK',
  seller_name: null,
  availability_text: null,
  price_gbp_inc_vat: null,
  delivery_cost_gbp: null,
  free_delivery_threshold_gbp: null,
  delivery_text_verbatim: null,
  delivered_total_gbp: null,
  total_per_person_gbp: null,
  total_per_person_day_gbp: null,
  delivery_known: false,
  model_match_confirmed: true,
  price_verified: false,
  delivery_verified: false,
  price_display_allowed: false,
  is_stale: false,
  eligible_for_best_price: false,
  is_best_price: false,
  labels: [],
  label_text: [],
  price_disclaimer: null,
  retailer_price_disclaimer: null,
  link_url: null,
  link_rel: null,
  is_affiliate_link: false,
  no_link_reason: 'non_production_build',
  no_link_text: null,
  disclosure_text: null,
  captured_at: '2026-11-15T10:00:00+00:00',
  last_checked: '2026-11-15T10:00:00+00:00',
  next_check_due: '2026-11-16T10:00:00+00:00',
  source: { name: 'Amazon UK product page' },
} as unknown as AffiliateDisplayOffer;

const PROD = { SITE_ENV: 'production' };
const PREVIEW = { SITE_ENV: 'preview' };
const LIVE = 'https://www.amazon.co.uk/dp/B0CZ9LH53B?tag=example-21';
const TAGLESS = 'https://www.amazon.co.uk/dp/B0CZ9LH53B';

describe('buttonLink (affiliate-only, Code Reviewer link security)', () => {
  it('does NOT render a non-affiliate https URL even when is_affiliate_link is true', () => {
    for (const url of ['https://evaq8.co.uk/products/e182p', 'https://example.com/', 'https://www.amazon.co.uk/dp/B0CZ9LH53B', 'https://www.amazon.com/dp/B0CZ9LH53B?tag=example-21']) {
      const o = { ...base, link_url: url, link_rel: 'sponsored nofollow', is_affiliate_link: true } as AffiliateDisplayOffer;
      expect(buttonLink(o, PROD)).toBeNull();
    }
  });
  it('renders the contract link_url in production with rel sponsored nofollow', () => {
    const o = { ...base, link_url: LIVE, link_rel: 'sponsored nofollow', is_affiliate_link: true } as AffiliateDisplayOffer;
    expect(buttonLink(o, PROD)).toEqual({ href: LIVE, rel: 'sponsored nofollow' });
  });
  it('never renders a link in a preview build (no preview links at all)', () => {
    const o = { ...base, link_url: LIVE, link_rel: 'sponsored nofollow', is_affiliate_link: true } as AffiliateDisplayOffer;
    expect(buttonLink(o, PREVIEW)).toBeNull();
    expect(buttonLink(o, { SITE_ENV: 'production', CF_PAGES: '1', CF_PAGES_BRANCH: 'feature' })).toBeNull();
    // A tagless dp URL is never a button, even in link_url.
    const tagless = { ...base, link_url: TAGLESS, link_rel: 'sponsored nofollow', is_affiliate_link: true } as AffiliateDisplayOffer;
    expect(buttonLink(tagless, PROD)).toBeNull();
  });
  it('needs is_affiliate_link as well as a valid link_url', () => {
    const o = { ...base, link_url: LIVE, link_rel: 'sponsored nofollow', is_affiliate_link: false } as AffiliateDisplayOffer;
    expect(buttonLink(o, PROD)).toBeNull();
  });
  it('renders nothing when link_url is null', () => {
    expect(buttonLink({ ...base, link_rel: 'sponsored nofollow', is_affiliate_link: true } as AffiliateDisplayOffer, PROD)).toBeNull();
    expect(buttonLink(base, PROD)).toBeNull();
  });
  it('requires rel sponsored nofollow from the contract', () => {
    const o = { ...base, link_url: LIVE, link_rel: null, is_affiliate_link: true } as AffiliateDisplayOffer;
    expect(buttonLink(o, PROD)).toBeNull();
  });
});

describe('shownPrice (Amazon API price under 24 h only)', () => {
  const priced = { ...base, price_display_allowed: true, price_gbp_inc_vat: 19.99, retailer_price_disclaimer: 'Amazon disclaimer' } as AffiliateDisplayOffer;
  it('shows an allowed, fresh Amazon price', () => {
    expect(shownPrice(priced, NOW)?.text).toBe('£19.99');
  });
  it('hides it when price_display_allowed is false', () => {
    expect(shownPrice({ ...priced, price_display_allowed: false }, NOW)).toBeNull();
  });
  it('hides it when last_checked or captured_at is older than 24 h or in the future', () => {
    expect(shownPrice({ ...priced, last_checked: '2026-11-14T11:59:00+00:00' }, NOW)).toBeNull();
    expect(shownPrice({ ...priced, captured_at: '2026-11-14T11:00:00+00:00' }, NOW)).toBeNull();
    expect(shownPrice({ ...priced, last_checked: '2026-11-15T13:00:00+00:00' }, NOW)).toBeNull();
  });
  it('hides it without the Amazon price disclaimer', () => {
    expect(shownPrice({ ...priced, retailer_price_disclaimer: null }, NOW)).toBeNull();
  });
});

describe('Amazon disclosure wording', () => {
  it('matches the approved programme disclosure_text exactly', () => {
    expect(AMAZON_DISCLOSURE).toBe('As an Amazon Associate I earn from qualifying purchases.');
    expect(affiliateProgrammes.find((p) => p.programme_id === 'amazon-associates-uk')?.disclosure_text).toBe(AMAZON_DISCLOSURE);
  });
});

describe('plain names', () => {
  it('uses display_name when present', () => {
    expect(
      cardDisplayName({
        display_name: 'St John Ambulance vehicle first aid kit (medium)',
        product_name: 'St John Ambulance BS 8599-2:2014 Medium Motor Vehicle First Aid Kit',
      }),
    ).toBe('St John Ambulance vehicle first aid kit (medium)');
  });
  it('falls back to a cleaned title, stripping standards codes and model/SKU tokens', () => {
    expect(cleanProductTitle('St John Ambulance BS 8599-2:2014 Medium Motor Vehicle First Aid Kit')).toBe(
      'St John Ambulance Medium Motor Vehicle First Aid Kit',
    );
    expect(cleanProductTitle('UGREEN 20,000mAh 22.5W power bank (PB312)')).toBe('UGREEN 20,000mAh 22.5W power bank');
    expect(cleanProductTitle('Reliance Medical | BS8599-1 Medium Workplace First Aid Kit (for Ref 343 - 77319RM)')).toBe(
      'Reliance Medical Medium Workplace First Aid Kit',
    );
  });
  it('falls back when display_name is missing', () => {
    expect(
      cardDisplayName({
        display_name: null,
        product_name: 'Anker A1689 20,000mAh Power Bank',
      }),
    ).toBe('Anker 20,000mAh Power Bank');
  });
});

describe('productImage', () => {
  const display_name = 'Anker Zolo 20,000mAh power bank';
  const allowed = {
    image_url: 'https://m.media-amazon.com/images/I/example.jpg',
    image_width: 160,
    image_height: 200,
    image_source: 'paapi' as const,
    display_name,
    product_name: 'Anker A1689 Power Bank',
  };
  it('renders an allowed Amazon image with explicit width, height and display_name alt', () => {
    expect(productImage(allowed)).toEqual({
      url: allowed.image_url,
      width: 160,
      height: 200,
      alt: display_name,
      fixedAspect: false,
    });
  });
  it('uses a fixed-aspect fallback size when dimensions are missing', () => {
    const img = productImage({ ...allowed, image_width: null, image_height: null });
    expect(img).toEqual({
      url: allowed.image_url,
      width: FALLBACK_IMAGE_SIZE,
      height: FALLBACK_IMAGE_SIZE,
      alt: display_name,
      fixedAspect: true,
    });
  });
  it('returns null (no image, no frame) when image_url or image_source is missing, or the host is not m.media-amazon.com', () => {
    expect(productImage({ ...allowed, image_url: null, image_source: null, image_width: null, image_height: null })).toBeNull();
    expect(productImage({ ...allowed, image_source: null })).toBeNull();
    expect(productImage({ ...allowed, image_url: 'https://images-eu.ssl-images-amazon.com/images/I/x.jpg' })).toBeNull();
    expect(productImage({ ...allowed, image_url: 'https://example.com/images/I/x.jpg' })).toBeNull();
  });
});

const PER_CATEGORY = 3;
const expectedFromVerifiedSet = Object.values(VERIFIED_BY_CATEGORY).reduce(
  (n, asins) => n + Math.min(asins.length, PER_CATEGORY),
  0,
);
const expectedCategories = PRODUCT_CATEGORIES.filter((c) => (VERIFIED_BY_CATEGORY[c]?.length ?? 0) > 0);
const PROD_ENV = { SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: 'verifydist-21' };

describe('catalogue grouping (groupComparisonsByCategory, cap 3)', () => {
  it('derives the rendered set from the verified data, caps at 3, hides empty categories, and keeps short categories as-is', async () => {
    for (const env of [PROD_ENV, { SITE_ENV: 'preview' }, {}]) {
      const m = await loadCatalogue(env, NOW);
      expect(m.stats.cards).toBe(expectedFromVerifiedSet);
      expect(m.asins).toHaveLength(expectedFromVerifiedSet);
      expect([...m.asins].sort()).toEqual(
        expectedCategories.flatMap((cat) => [...(VERIFIED_BY_CATEGORY[cat] ?? [])].slice(0, PER_CATEGORY)).sort(),
      );
      expect(m.sections.map((s) => s.category)).toEqual(expectedCategories);
      expect(m.sections.find((s) => s.category === 'kit')).toBeUndefined();
      for (const s of m.sections) {
        expect(s.cards.length).toBeGreaterThan(0);
        expect(s.cards.length).toBeLessThanOrEqual(PER_CATEGORY);
        expect(s.cards.length).toBe(Math.min(VERIFIED_BY_CATEGORY[s.category]!.length, PER_CATEGORY));
        expect(s.category_label).toBeTruthy();
        expect(s.cards.every((c) => c.category === s.category)).toBe(true);
      }
      // Short categories (fewer than PER_CATEGORY verified products) render exactly what exists, no placeholder.
      for (const [cat, asins] of Object.entries(VERIFIED_BY_CATEGORY)) {
        if (asins.length > 0 && asins.length < PER_CATEGORY) {
          expect(m.sections.find((s) => s.category === cat)?.cards).toHaveLength(asins.length);
        }
      }
    }
  });

  it('uses display_name for headings, omits standards codes and size_child_of, and has no image when image_url is null', async () => {
    const m = await loadCatalogue({ SITE_ENV: 'preview' }, NOW);
    const records = new Map(catalogueProducts.map((p) => [p.asin_uk, p]));
    for (const s of m.sections) {
      for (const card of s.cards) {
        expect(card.image).toBeNull();
        expect(card.name).not.toMatch(/\bBS\s?\d|\bEN\s?\d|ISO\s?\d/);
        expect(card.facts.join(' ')).not.toMatch(/\bBS\s?\d|\bEN\s?\d|ISO\s?\d/);
        expect(card.facts.join(' ')).not.toMatch(/size_child_of/i);
        expect(card.buttonLabel).toContain(card.name);
        expect(card.buttonLabel).not.toMatch(/B0[A-Z0-9]{8}/);
        const record = [...records.values()].find((p) => p.variant_id === card.id);
        expect(record).toBeTruthy();
        if (record?.display_name) expect(card.name).toBe(record.display_name);
        expect(record).not.toBeUndefined();
        expect('size_child_of' in card).toBe(false);
      }
    }
  });

  it('every production CTA maps to a shortlistable verified product and the button count is derived, not hard-coded', async () => {
    const m = await loadCatalogue(PROD_ENV, NOW);
    expect(m.stats.withButton).toBe(expectedFromVerifiedSet);
    expect(m.stats.withButton).toBe(m.stats.cards);
    expect(m.stats.withPrice).toBe(0);
    const records = new Map(catalogueProducts.map((p) => [p.variant_id, p]));
    for (const s of m.sections) {
      for (const card of s.cards) {
        const record = records.get(card.id);
        expect(record).toBeTruthy();
        expect(record!.verification).toBe('verified');
        expect(isProductVerified(record!)).toBe(true);
        const links = card.offers.filter((o) => o.link);
        expect(links.length).toBeGreaterThan(0);
        for (const o of links) {
          expect(o.link!.rel).toBe('sponsored nofollow');
          expect(o.link!.href).toMatch(/^https:\/\/www\.amazon\.co\.uk\/dp\/[A-Z0-9]{10}\?tag=verifydist-21$/);
        }
        expect(card.offers.every((o) => o.price === null)).toBe(true);
      }
    }
    expect(VERIFIED_COUNT).toBe(VERIFIED_ASINS.length);
    expect(m.asins.every((id) => VERIFIED_ASINS.includes(id))).toBe(true);
    expect(isShortlistable).toEqual(expect.any(Function));
  });
});
