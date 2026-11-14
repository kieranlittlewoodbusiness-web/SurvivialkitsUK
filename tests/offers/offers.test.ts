import { describe, expect, it } from 'vitest';
import {
  buildComparisons,
  compareVariant,
  computeSavings,
  deliveredTotal,
  groupOffersByVariant,
  isStale,
  sortOffers,
  toDisplayOffer,
} from '../../src/lib/offers/compare';
import { NOW, offer, variant } from './fixtures';

const e184 = variant();
const e184p = variant({ variant_id: 'evaq8-e184p', model_code: 'E184P', mpn: 'E184P', weight_kg: 6 });
const e194 = variant({ variant_id: 'evaq8-e194', model_code: 'E194', mpn: 'E194', format: 'holdall' });
const opts = { now: NOW };

describe('variant separation', () => {
  it('groups strictly by exact variant id and never mixes E184 / E184P / E194', () => {
    const a = offer({ variant_id: 'evaq8-e184', mpn: 'E184' });
    const b = offer({ variant_id: 'evaq8-e184p', mpn: 'E184P' });
    const c = offer({ variant_id: 'evaq8-e194', mpn: 'E194' });
    const d = offer({ variant_id: 'EVAQ8-E184', mpn: 'E184' }); // case differs: unknown, not merged
    const { groups, excluded } = groupOffersByVariant([e184, e184p, e194], [a, b, c, d]);
    expect(groups.get('evaq8-e184')!.map((o) => o.offer_id)).toEqual([a.offer_id]);
    expect(groups.get('evaq8-e184p')!.map((o) => o.offer_id)).toEqual([b.offer_id]);
    expect(groups.get('evaq8-e194')!.map((o) => o.offer_id)).toEqual([c.offer_id]);
    expect(excluded).toEqual([expect.objectContaining({ offer_id: d.offer_id, reason: 'unknown_variant' })]);
  });

  it('excludes offers with model_match_confirmed=false', () => {
    const ok = offer();
    const unconfirmed = offer({ model_match_confirmed: false });
    const cmp = compareVariant(e184, [ok, unconfirmed], opts);
    expect(cmp.offers.map((o) => o.offer_id)).toEqual([ok.offer_id]);
    expect(cmp.excluded).toEqual([expect.objectContaining({ offer_id: unconfirmed.offer_id, reason: 'model_match_unconfirmed' })]);
  });

  it('excludes offers whose MPN contradicts the variant even if variant_id matches', () => {
    const wrong = offer({ variant_id: 'evaq8-e184', mpn: 'E184P' });
    const cmp = compareVariant(e184, [wrong], opts);
    expect(cmp.offers).toHaveLength(0);
    expect(cmp.excluded[0]!.reason).toBe('identifier_mismatch');
  });

  it('buildComparisons ranks each variant separately', () => {
    const cheapP = offer({ variant_id: 'evaq8-e184p', mpn: 'E184P', price_gbp_inc_vat: 50 });
    const dear = offer({ variant_id: 'evaq8-e184', price_gbp_inc_vat: 200 });
    const dear2 = offer({ variant_id: 'evaq8-e184', price_gbp_inc_vat: 210 });
    const { comparisons } = buildComparisons([e184, e184p], [cheapP, dear, dear2], opts);
    const c184 = comparisons.find((c) => c.variant_id === 'evaq8-e184')!;
    expect(c184.offers.map((o) => o.offer_id)).toEqual([dear.offer_id, dear2.offer_id]);
    expect(c184.best_price_offer_id).toBe(dear.offer_id);
    const c184p = comparisons.find((c) => c.variant_id === 'evaq8-e184p')!;
    expect(c184p.best_price_offer_id).toBeNull(); // only one eligible row
  });
});

describe('unknown-delivery sort', () => {
  it('never treats unknown delivery as 0', () => {
    expect(deliveredTotal({ price_gbp_inc_vat: 90, delivery_cost_gbp: null })).toBeNull();
    expect(deliveredTotal({ price_gbp_inc_vat: 90, delivery_cost_gbp: 0 })).toBe(90);
  });

  it('places unknown delivery after known totals, labelled, even if its price is lower', () => {
    const unknownCheap = offer({ price_gbp_inc_vat: 80, delivery_cost_gbp: null, delivery_verified: false });
    const known1 = offer({ price_gbp_inc_vat: 100, delivery_cost_gbp: 4.99 });
    const known2 = offer({ price_gbp_inc_vat: 95, delivery_cost_gbp: 0 });
    const cmp = compareVariant(e184, [unknownCheap, known1, known2], opts);
    expect(cmp.offers.map((o) => o.offer_id)).toEqual([known2.offer_id, known1.offer_id, unknownCheap.offer_id]);
    const last = cmp.offers[2]!;
    expect(last.delivered_total_gbp).toBeNull();
    expect(last.delivery_known).toBe(false);
    expect(last.labels).toContain('delivery_unknown');
    expect(last.label_text).toContain('Delivery cost unknown – not included in total');
    expect(last.eligible_for_best_price).toBe(false);
    expect(cmp.best_price_offer_id).toBe(known2.offer_id);
    expect(cmp.offers[0]!.delivered_total_gbp).toBe(95);
    expect(cmp.offers[1]!.delivered_total_gbp).toBe(104.99);
  });

  it('sorts verified known totals before unverified known totals', () => {
    const unverifiedCheap = offer({ price_gbp_inc_vat: 50, price_verified: false });
    const verified = offer({ price_gbp_inc_vat: 120 });
    const sorted = sortOffers([unverifiedCheap, verified].map((o) => toDisplayOffer(o, e184, opts)));
    expect(sorted.map((o) => o.offer_id)).toEqual([verified.offer_id, unverifiedCheap.offer_id]);
  });
});

describe('stale offers', () => {
  it('uses a 7-day default threshold with injectable now', () => {
    const o = offer({ last_checked: '2026-11-07T23:31:00+00:00', next_check_due: '2026-11-30T00:00:00+00:00' });
    expect(isStale(o, { now: NOW })).toBe(false); // 6d 23h 59m
    expect(isStale(o, { now: '2026-11-14T23:31:00+00:00' })).toBe(true); // exactly 7 days
    expect(isStale(o, { now: NOW, staleAfterDays: 3 })).toBe(true);
  });

  it('is stale once next_check_due has passed', () => {
    const o = offer({ last_checked: '2026-11-13T10:00:00+00:00', next_check_due: '2026-11-14T10:00:00+00:00' });
    expect(isStale(o, { now: NOW })).toBe(true);
  });

  it('shows stale offers labelled and excludes them from best price', () => {
    const staleCheap = offer({
      price_gbp_inc_vat: 10,
      captured_at: '2026-11-01T10:00:00+00:00',
      last_checked: '2026-11-01T10:00:00+00:00',
      next_check_due: '2026-11-08T10:00:00+00:00',
    });
    const fresh1 = offer({ price_gbp_inc_vat: 100 });
    const fresh2 = offer({ price_gbp_inc_vat: 110 });
    const cmp = compareVariant(e184, [staleCheap, fresh1, fresh2], opts);
    const stale = cmp.offers.find((o) => o.offer_id === staleCheap.offer_id)!;
    expect(stale.is_stale).toBe(true);
    expect(stale.labels).toContain('stale');
    expect(stale.eligible_for_best_price).toBe(false);
    expect(stale.is_best_price).toBe(false);
    expect(cmp.best_price_offer_id).toBe(fresh1.offer_id);
    expect(cmp.offers.at(-1)!.offer_id).toBe(staleCheap.offer_id);
    expect(cmp.same_capture_window).toBe(false);
  });
});

describe('unverified offers', () => {
  it('labels unverified price and delivery and keeps them out of best price', () => {
    const o = offer({ price_verified: false, delivery_verified: false, delivery_cost_gbp: 3 });
    const d = toDisplayOffer(o, e184, opts);
    expect(d.labels).toEqual(['price_unverified', 'delivery_unverified']);
    expect(d.label_text).toEqual(['Price not verified', 'Delivery cost not verified']);
    expect(d.eligible_for_best_price).toBe(false);
    const cmp = compareVariant(e184, [o, offer({ price_verified: false })], opts);
    expect(cmp.best_price_offer_id).toBeNull();
    expect(cmp.savings).toBeNull();
  });

  it('labels a missing price and sorts it last', () => {
    const missing = offer({ price_gbp_inc_vat: null, price_verified: false });
    const ok = offer();
    const cmp = compareVariant(e184, [missing, ok], opts);
    expect(cmp.offers.at(-1)!.labels).toContain('price_missing');
  });

  it('formats the price disclaimer in UK time (GMT and BST)', () => {
    const gmt = toDisplayOffer(offer({ retailer: 'EVAQ8', captured_at: '2026-11-14T23:17:00+00:00' }), e184, opts);
    expect(gmt.price_disclaimer).toBe('Price at EVAQ8 on 14 November 2026, 23:17 UK time. Prices change.');
    const bst = toDisplayOffer(
      offer({ retailer: 'Amazon UK', captured_at: '2026-06-01T08:05:00Z', last_checked: '2026-06-01T08:05:00Z', next_check_due: '2026-06-08T08:05:00Z' }),
      e184,
      { now: '2026-06-02T00:00:00Z' },
    );
    expect(bst.price_disclaimer).toBe('Price at Amazon UK on 1 June 2026, 09:05 UK time. Prices change.');
  });

  it('never exposes commission_rate and links the non-affiliate URL until approved', () => {
    const d = toDisplayOffer(offer({ affiliate_url: 'https://aff.example.test/x', affiliate_programme: null }), e184, opts);
    expect(JSON.stringify(d)).not.toContain('commission');
    expect(d).not.toHaveProperty('internal');
    expect(d.link_url).toBe('https://example.test/p');
    expect(d.is_affiliate_link).toBe(false);
    const approved = toDisplayOffer(
      offer({ affiliate_url: 'https://aff.example.test/x', affiliate_programme: { name: 'TEST programme', approved_on: '2026-11-01' } }),
      e184,
      opts,
    );
    expect(approved.link_url).toBe('https://aff.example.test/x');
    expect(approved.is_affiliate_link).toBe(true);
  });

  it('normalises totals per person and per person-day', () => {
    const d = toDisplayOffer(offer({ price_gbp_inc_vat: 115, delivery_cost_gbp: 5 }), e184, opts);
    expect(d.total_per_person_gbp).toBe(30);
    expect(d.total_per_person_day_gbp).toBe(10);
  });
});

describe('savings guard', () => {
  const d = (o: ReturnType<typeof offer>, v = e184) => toDisplayOffer(o, v, opts);

  it('returns savings when both rows are verified, same variant and same London day', () => {
    const a = d(offer({ price_gbp_inc_vat: 100, delivery_cost_gbp: 0 }));
    const b = d(offer({ price_gbp_inc_vat: 110, delivery_cost_gbp: 4.5, captured_at: '2026-11-14T22:00:00+00:00', last_checked: '2026-11-14T22:00:00+00:00' }));
    expect(computeSavings(a, b)).toEqual({ amount_gbp: 14.5, cheaper_offer_id: a.offer_id, dearer_offer_id: b.offer_id, capture_window: '2026-11-14' });
    const cmp = compareVariant(e184, [offer({ price_gbp_inc_vat: 100 }), offer({ price_gbp_inc_vat: 120 })], opts);
    expect(cmp.savings?.amount_gbp).toBe(20);
  });

  it('returns null when either row is unverified', () => {
    const a = d(offer({ price_gbp_inc_vat: 100 }));
    expect(computeSavings(a, d(offer({ price_gbp_inc_vat: 120, price_verified: false })))).toBeNull();
    expect(computeSavings(a, d(offer({ price_gbp_inc_vat: 120, delivery_verified: false })))).toBeNull();
    expect(computeSavings(a, d(offer({ price_gbp_inc_vat: 120, delivery_cost_gbp: null, delivery_verified: false })))).toBeNull();
  });

  it('returns null for different variants', () => {
    const a = d(offer({ price_gbp_inc_vat: 100 }));
    const b = d(offer({ variant_id: 'evaq8-e184p', mpn: 'E184P', price_gbp_inc_vat: 150 }), e184p);
    expect(computeSavings(a, b)).toBeNull();
  });

  it('returns null when captured on different Europe/London days', () => {
    // 23:30 GMT on 13 Nov vs 00:30 GMT on 14 Nov: 1 hour apart but different UK days.
    const a = d(offer({ price_gbp_inc_vat: 100, captured_at: '2026-11-13T23:30:00+00:00', last_checked: '2026-11-13T23:30:00+00:00' }));
    const b = d(offer({ price_gbp_inc_vat: 120, captured_at: '2026-11-14T00:30:00+00:00', last_checked: '2026-11-14T00:30:00+00:00' }));
    expect(computeSavings(a, b)).toBeNull();
    const cmp = compareVariant(e184, [
      offer({ price_gbp_inc_vat: 100, captured_at: '2026-11-13T23:30:00+00:00', last_checked: '2026-11-13T23:30:00+00:00' }),
      offer({ price_gbp_inc_vat: 120 }),
    ], opts);
    expect(cmp.best_price_offer_id).toBeNull();
    expect(cmp.savings).toBeNull();
  });

  it('returns null when a row is stale', () => {
    const a = d(offer({ price_gbp_inc_vat: 100 }));
    const b = d(offer({ price_gbp_inc_vat: 120, last_checked: '2026-11-01T10:00:00+00:00' }));
    expect(computeSavings(a, b)).toBeNull();
  });
});
