import { describe, expect, it } from 'vitest';
import { buttonLink, shownPrice, AMAZON_DISCLOSURE } from './catalogueView';
import type { DisplayOfferWithPreview } from './previewLinkShim';
import { affiliateProgrammes } from '../../lib/offers/data';

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
} as unknown as DisplayOfferWithPreview;

const PROD = { SITE_ENV: 'production' };
const PREVIEW = { SITE_ENV: 'preview' };
const LIVE = 'https://www.amazon.co.uk/dp/B0CZ9LH53B?tag=example-21';
const TAGLESS = 'https://www.amazon.co.uk/dp/B0CZ9LH53B';

describe('buttonLink (affiliate-only, Code Reviewer link security)', () => {
  it('does NOT render a non-affiliate https URL even when is_affiliate_link is true', () => {
    for (const url of ['https://evaq8.co.uk/products/e182p', 'https://example.com/', 'https://www.amazon.co.uk/dp/B0CZ9LH53B', 'https://www.amazon.com/dp/B0CZ9LH53B?tag=example-21']) {
      const o = { ...base, link_url: url, link_rel: 'sponsored nofollow', is_affiliate_link: true } as DisplayOfferWithPreview;
      expect(buttonLink(o, PROD)).toBeNull();
    }
  });
  it('renders the contract link_url in production with rel sponsored nofollow', () => {
    const o = { ...base, link_url: LIVE, link_rel: 'sponsored nofollow', is_affiliate_link: true } as DisplayOfferWithPreview;
    expect(buttonLink(o, PROD)).toEqual({ href: LIVE, rel: 'sponsored nofollow', kind: 'affiliate' });
  });
  it('never renders link_url in a preview build', () => {
    const o = { ...base, link_url: LIVE, link_rel: 'sponsored nofollow', is_affiliate_link: true } as DisplayOfferWithPreview;
    expect(buttonLink(o, PREVIEW)).toBeNull();
  });
  it('renders preview_link_url only in a preview build, and only the tagless dp shape', () => {
    const o = { ...base, preview_link_url: TAGLESS, link_rel: 'sponsored nofollow' } as DisplayOfferWithPreview;
    expect(buttonLink(o, PREVIEW)).toEqual({ href: TAGLESS, rel: 'sponsored nofollow', kind: 'preview' });
    expect(buttonLink(o, PROD)).toBeNull();
    expect(buttonLink(o, {})).toBeNull();
    expect(buttonLink({ ...o, preview_link_url: LIVE } as DisplayOfferWithPreview, PREVIEW)).toBeNull();
    expect(buttonLink({ ...o, preview_link_url: 'https://example.com/dp/B0CZ9LH53B' } as DisplayOfferWithPreview, PREVIEW)).toBeNull();
  });
  it('renders nothing when both links are null', () => {
    expect(buttonLink({ ...base, link_rel: 'sponsored nofollow' } as DisplayOfferWithPreview, PREVIEW)).toBeNull();
    expect(buttonLink(base, PROD)).toBeNull();
  });
  it('requires rel sponsored nofollow from the contract', () => {
    const o = { ...base, link_url: LIVE, link_rel: null, is_affiliate_link: true } as DisplayOfferWithPreview;
    expect(buttonLink(o, PROD)).toBeNull();
  });
});

describe('shownPrice (Amazon API price under 24 h only)', () => {
  const priced = { ...base, price_display_allowed: true, price_gbp_inc_vat: 19.99, retailer_price_disclaimer: 'Amazon disclaimer' } as DisplayOfferWithPreview;
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

describe('approved set (verified + exact model match, same gate as resolveAffiliateLink)', () => {
  it('renders exactly the 9 approved ASINs from the real catalogue', async () => {
    const { loadCatalogue } = await import('./catalogueView');
    for (const env of [{ SITE_ENV: 'preview' }, { SITE_ENV: 'production' }, {}]) {
      const m = await loadCatalogue(env, new Date('2026-11-15T12:00:00Z'));
      expect([...m.asins].sort()).toEqual(
        ['B0896Q8JXD', 'B00L7S9LU4', 'B005AQK6V2', 'B09VBFQNKK', 'B0987MCGXT', 'B0CZ9LH53B', 'B0CSSRD4NT', 'B0DCZ82MGG', 'B001FIQ7XU'].sort(),
      );
      expect(m.sections.find((s) => s.category === 'thermal_clothing')?.cards).toHaveLength(0);
      expect(m.sections.find((s) => s.category === 'kit')?.cards).toHaveLength(0);
    }
  });
});
