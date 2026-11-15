/**
 * Regression tests for Code Reviewer findings on PR #8 (review 5907889681):
 * M1-M4 and L1-L4. Cases adapted from the reviewer's probes (P1-P5).
 */
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
import { parseOffer, parseOffersFile, parseVariantsFile } from '../../src/lib/offers/schema';
import { addDaysLondon } from '../../src/lib/offers/time';
import { NOW, offer, variant } from './fixtures';

const opts = { now: NOW };
const e184 = variant();
const e184p = variant({ variant_id: 'evaq8-e184p', model_code: 'E184P', mpn: 'E184P' });
const day = (iso: string) => ({ captured_at: iso, last_checked: iso, next_check_due: addDaysLondon(iso, 7) });

describe('M1: toDisplayOffer / computeSavings honour model match and variant identity (P1c)', () => {
  it('an unconfirmed offer is labelled, ineligible and yields no savings', () => {
    const unconfirmed = toDisplayOffer(offer({ offer_id: 'u', model_match_confirmed: false, price_gbp_inc_vat: 50 }), e184, opts);
    const ok = toDisplayOffer(offer({ offer_id: 'k' }), e184, opts);
    expect(unconfirmed.model_match_confirmed).toBe(false);
    expect(unconfirmed.eligible_for_best_price).toBe(false);
    expect(unconfirmed.labels).toContain('model_unconfirmed');
    expect(unconfirmed.delivered_total_gbp).toBeNull();
    expect(computeSavings(unconfirmed, ok)).toBeNull();
    expect(computeSavings(ok, unconfirmed)).toBeNull();
  });

  it('an E184P offer is never costed as E184', () => {
    const wrong = toDisplayOffer(offer({ offer_id: 'w', variant_id: 'evaq8-e184p', mpn: 'E184P' }), e184, opts);
    expect(wrong.model_match_confirmed).toBe(false);
    expect(wrong.eligible_for_best_price).toBe(false);
    expect(wrong.delivered_total_gbp).toBeNull();
    expect(wrong.total_per_person_gbp).toBeNull();
    expect(wrong.total_per_person_day_gbp).toBeNull();
    expect(wrong.labels).toContain('model_unconfirmed');
    expect(computeSavings(wrong, toDisplayOffer(offer({ price_gbp_inc_vat: 200 }), e184, opts))).toBeNull();
  });

  it('an offer whose MPN clashes with the variant is ineligible even with a matching variant_id', () => {
    const clash = toDisplayOffer(offer({ mpn: 'E184P' }), e184, opts);
    expect(clash.model_match_confirmed).toBe(false);
    expect(clash.eligible_for_best_price).toBe(false);
  });

  it('a hand-forged DisplayOffer with model_match_confirmed=false gets no savings', () => {
    const a = toDisplayOffer(offer({ price_gbp_inc_vat: 50 }), e184, opts);
    const b = toDisplayOffer(offer({ price_gbp_inc_vat: 100 }), e184, opts);
    expect(computeSavings({ ...a, model_match_confirmed: false }, b)).toBeNull();
  });

  it('mixed variants still group strictly (P1)', () => {
    const e194 = variant({ variant_id: 'evaq8-e194', model_code: 'E194', mpn: 'E194', gtin: '5060176886667' });
    const os = [
      offer({ offer_id: 'a', price_gbp_inc_vat: 90 }),
      offer({ offer_id: 'b', variant_id: 'evaq8-e184p', mpn: 'E184P', price_gbp_inc_vat: 80 }),
      offer({ offer_id: 'c', variant_id: 'evaq8-e184', mpn: 'E184P' }),
      offer({ offer_id: 'd', variant_id: 'evaq8-e194', mpn: null, gtin: '5060176886667' }),
      offer({ offer_id: 'e', variant_id: 'EVAQ8-E184' }),
      offer({ offer_id: 'f', model_match_confirmed: false, price_gbp_inc_vat: 1 }),
    ];
    const r = buildComparisons([e184, e184p, e194], os, opts);
    const by = Object.fromEntries(r.comparisons.map((c) => [c.variant_id, c]));
    expect(by['evaq8-e184']!.offers.map((o) => o.offer_id)).toEqual(['a']);
    expect(by['evaq8-e184']!.excluded.map((e) => `${e.offer_id}:${e.reason}`).sort()).toEqual(['c:identifier_mismatch', 'f:model_match_unconfirmed']);
    expect(by['evaq8-e184p']!.offers.map((o) => o.offer_id)).toEqual(['b']);
    expect(by['evaq8-e194']!.offers.map((o) => o.offer_id)).toEqual(['d']);
    expect(r.unknown.map((e) => e.offer_id)).toEqual(['e']);
  });
});

describe('M2: duplicate variant ids (P1b)', () => {
  const dupes = [variant(), variant({ model_code: 'E184P', mpn: 'E184P' })]; // both evaq8-e184

  it('schema rejects duplicate variant_id', () => {
    expect(() => parseVariantsFile({ schema_version: 1, variants: dupes })).toThrow(/Duplicate variant_id/);
  });

  it('schema rejects duplicate model_code and gtin', () => {
    expect(() => parseVariantsFile({ schema_version: 1, variants: [variant(), variant({ variant_id: 'x' })] })).toThrow(/Duplicate model_code/);
    expect(() =>
      parseVariantsFile({ schema_version: 1, variants: [variant({ gtin: '5060176886667' }), variant({ variant_id: 'x', model_code: 'X', gtin: '5060176886667' })] }),
    ).toThrow(/Duplicate gtin/);
  });

  it('schema rejects duplicate offer_id', () => {
    expect(() =>
      parseOffersFile({ schema_version: 1, status: 'unverified-seed', data_source_needed: [], offers: [offer({ offer_id: 'z' }), offer({ offer_id: 'z' })] }, opts),
    ).toThrow(/Duplicate offer_id/);
  });

  it('runtime never merges models that share an id: nothing is compared', () => {
    const os = [offer({ offer_id: 'a', mpn: null }), offer({ offer_id: 'b', mpn: null, price_gbp_inc_vat: 80 })];
    const r = buildComparisons(dupes, os, opts);
    for (const c of r.comparisons) {
      expect(c.offers).toEqual([]);
      expect(c.best_price_offer_id).toBeNull();
      expect(c.excluded.every((e) => e.reason === 'duplicate_variant_id')).toBe(true);
    }
    const g = groupOffersByVariant(dupes, os);
    expect(g.groups.get('evaq8-e184')).toEqual([]);
    expect(g.excluded.map((e) => e.reason)).toEqual(['duplicate_variant_id', 'duplicate_variant_id']);
  });
});

describe('M3: staleness uses the older timestamp and rejects/flags future dates (P3)', () => {
  it('old captured_at with a fresh last_checked is stale and ineligible', () => {
    const d = toDisplayOffer(
      offer({ captured_at: '2026-09-01T10:00:00+01:00', last_checked: '2026-11-14T10:00:00+00:00', next_check_due: '2026-11-21T10:00:00+00:00' }),
      e184,
      opts,
    );
    expect(d.is_stale).toBe(true);
    expect(d.eligible_for_best_price).toBe(false);
    expect(d.labels).toContain('stale');
    expect(d.price_disclaimer).toMatch(/ on 1 September 2026, 10:00 UK time\. Prices change\.$/);
  });

  it('threshold boundaries are unchanged', () => {
    const at = (s: string) => ({ last_checked: s, next_check_due: addDaysLondon(s, 7) });
    expect(isStale(at('2026-11-08T00:30:01+00:00'), opts)).toBe(false);
    expect(isStale(at('2026-11-07T23:30:00+00:00'), opts)).toBe(true);
  });

  it('a future-dated last_checked or captured_at is flagged stale relative to injected now', () => {
    expect(isStale({ last_checked: '2027-11-14T10:00:00+00:00', next_check_due: '2027-11-21T10:00:00+00:00' }, opts)).toBe(true);
    expect(isStale({ ...day('2027-11-14T10:00:00+00:00') }, opts)).toBe(true);
    // within 5 minutes of skew is tolerated
    expect(isStale({ ...day('2026-11-14T23:33:00+00:00') }, opts)).toBe(false);
  });

  it('schema rejects captured_at later than last_checked', () => {
    expect(() => parseOffer(offer({ captured_at: '2026-11-14T11:00:00+00:00', last_checked: '2026-11-14T10:00:00+00:00' }), opts)).toThrow(/captured_at cannot be later/);
  });

  it('parse rejects captures dated after injected now', () => {
    expect(() => parseOffer(offer(day('2027-11-14T10:00:00+00:00')), opts)).toThrow(/in the future/);
    expect(() => parseOffer(offer(), opts)).not.toThrow();
  });

  it('invalid now still throws', () => {
    expect(() => isStale(day('2026-11-14T10:00:00+00:00'), { now: 'garbage' })).toThrow(RangeError);
  });
});

describe('M4: no best price or savings unless every row shares the capture window (P4)', () => {
  it('a cheaper unknown-delivery row from another day blocks best price and savings', () => {
    const a = offer({ offer_id: 'a', price_gbp_inc_vat: 100 });
    const b = offer({ offer_id: 'b', price_gbp_inc_vat: 110 });
    const other = offer({ offer_id: 'unk-cheap', price_gbp_inc_vat: 60, delivery_cost_gbp: null, delivery_verified: false, ...day('2026-11-13T09:00:00+00:00') });
    const c = compareVariant(e184, [a, b, other], opts);
    expect(c.same_capture_window).toBe(false);
    expect(c.best_price_offer_id).toBeNull();
    expect(c.savings).toBeNull();
    expect(c.offers.some((o) => o.is_best_price)).toBe(false);
  });

  it('same window still produces best price and savings', () => {
    const c = compareVariant(e184, [offer({ offer_id: 'a', price_gbp_inc_vat: 100 }), offer({ offer_id: 'b', price_gbp_inc_vat: 110 })], opts);
    expect(c.same_capture_window).toBe(true);
    expect(c.best_price_offer_id).toBe('a');
    expect(c.savings?.amount_gbp).toBe(10);
  });
});

describe('L1: no best price on a tie', () => {
  it('equal delivered totals give neither best price nor savings', () => {
    const tie = compareVariant(e184, [offer({ offer_id: 'a' }), offer({ offer_id: 'z' })], opts);
    expect(tie.best_price_offer_id).toBeNull();
    expect(tie.savings).toBeNull();
  });
});

describe('L2: non-finite prices are never eligible (P2 NaN)', () => {
  it('NaN / Infinity / negative values give no total, no eligibility, no savings', () => {
    expect(deliveredTotal({ price_gbp_inc_vat: NaN, delivery_cost_gbp: 0 })).toBeNull();
    expect(deliveredTotal({ price_gbp_inc_vat: Infinity, delivery_cost_gbp: 0 })).toBeNull();
    expect(deliveredTotal({ price_gbp_inc_vat: 10, delivery_cost_gbp: -5 })).toBeNull();
    const nan = toDisplayOffer(offer({ offer_id: 'nan', price_gbp_inc_vat: NaN }), e184, opts);
    expect(nan.delivered_total_gbp).toBeNull();
    expect(nan.price_gbp_inc_vat).toBeNull();
    expect(nan.eligible_for_best_price).toBe(false);
    expect(nan.labels).toContain('price_missing');
    expect(computeSavings(nan, toDisplayOffer(offer({ offer_id: 'ok' }), e184, opts))).toBeNull();
  });

  it('schema rejects NaN, Infinity and negative delivery', () => {
    expect(() => parseOffer(offer({ price_gbp_inc_vat: NaN }), opts)).toThrow();
    expect(() => parseOffer(offer({ price_gbp_inc_vat: Infinity }), opts)).toThrow();
    expect(() => parseOffer(offer({ delivery_cost_gbp: -5 }), opts)).toThrow();
  });
});

describe('L3: stale group keeps delivered totals and bare prices apart (P2 order)', () => {
  it('stale known-total rows sort before stale unknown-delivery rows', () => {
    const old = day('2026-11-01T10:00:00+00:00');
    const os = [
      offer({ offer_id: 'unk', price_gbp_inc_vat: 50, delivery_cost_gbp: null, delivery_verified: false }),
      offer({ offer_id: 'k1', price_gbp_inc_vat: 100 }),
      offer({ offer_id: 'k2', price_gbp_inc_vat: 95, price_verified: false }),
      offer({ offer_id: 'nop', price_gbp_inc_vat: null, price_verified: false }),
      offer({ offer_id: 'nop2', price_gbp_inc_vat: null, price_verified: false }),
      offer({ offer_id: 'stK', price_gbp_inc_vat: 65, ...old }),
      offer({ offer_id: 'stU', price_gbp_inc_vat: 62, delivery_cost_gbp: null, delivery_verified: false, ...old }),
    ];
    const c = compareVariant(e184, os, opts);
    expect(c.offers.map((o) => o.offer_id)).toEqual(['k1', 'k2', 'unk', 'stK', 'stU', 'nop', 'nop2']);
    const disp = os.map((o) => toDisplayOffer(o, e184, opts));
    const base = sortOffers(disp).map((o) => o.offer_id).join();
    for (let i = 0; i < 50; i++) {
      const shuffled = [...disp].sort(() => Math.random() - 0.5);
      expect(sortOffers(shuffled).map((o) => o.offer_id).join()).toBe(base);
    }
  });
});

describe('L4: affiliate URL must be https and approval cannot be in the future (P5)', () => {
  const approved = { name: 'X', approved_on: '2026-01-01' };

  it('rejects an affiliate URL without a programme, a future approved_on, and non-https URLs', () => {
    expect(() => parseOffer(offer({ affiliate_url: 'https://x.test/?tag=abc', affiliate_programme: null }), opts)).toThrow();
    expect(() => parseOffer(offer({ affiliate_url: 'https://x.test/?tag=abc', affiliate_programme: { name: 'X', approved_on: '2099-01-01' } }), opts)).toThrow(/approved_on/);
    expect(() => parseOffer(offer({ affiliate_url: 'javascript:alert(1)', affiliate_programme: approved }), opts)).toThrow();
    expect(() => parseOffer(offer({ affiliate_url: 'http://x.test/', affiliate_programme: approved }), opts)).toThrow();
    expect(() => parseOffer(offer({ affiliate_url: 'https://x.test/?tag=abc', affiliate_programme: approved }), opts)).not.toThrow();
  });

  it('display falls back to product_url for non-https affiliate URLs', () => {
    for (const url of ['javascript:alert(1)', 'http://x.test/']) {
      const d = toDisplayOffer(offer({ affiliate_url: url, affiliate_programme: approved }), e184, opts);
      expect(d.link_url).toBe('https://example.test/p');
      expect(d.is_affiliate_link).toBe(false);
    }
  });
});
