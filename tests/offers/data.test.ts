import { describe, expect, it } from 'vitest';
import { kitOffers, kitVariants, offersFile } from '../../src/lib/offers/data';
import { compareVariant } from '../../src/lib/offers/compare';
import { parseOffer } from '../../src/lib/offers/schema';
import { addDaysLondon, isLondonIso, londonDateKey, toLondonIso } from '../../src/lib/offers/time';
import { offer } from './fixtures';

describe('seed data (src/data/kits)', () => {
  it('validates against the schema and is marked unverified', () => {
    expect(offersFile.status).toBe('unverified-seed');
    expect(offersFile.data_source_needed.length).toBeGreaterThan(0);
    expect(kitVariants.map((v) => v.variant_id)).toEqual(['evaq8-e182p']);
    expect(kitOffers).toHaveLength(2);
    for (const o of kitOffers) {
      expect(o.price_verified).toBe(false);
      expect(o.delivery_verified).toBe(false);
      expect(o.affiliate_url).toBe('');
      expect(o.affiliate_programme).toBeNull();
      expect(o.internal.commission_rate).toBeNull();
      expect(o.delivery_cost_gbp).toBeNull();
    }
  });

  it('produces no best price or savings from the unverified seed', () => {
    const cmp = compareVariant(kitVariants[0]!, kitOffers, { now: '2026-11-15T09:00:00+00:00' });
    expect(cmp.best_price_offer_id).toBeNull();
    expect(cmp.savings).toBeNull();
    expect(cmp.excluded.map((e) => e.reason)).toEqual(['model_match_unconfirmed']); // Amazon lists MPN E138
    expect(cmp.offers).toHaveLength(1);
    expect(cmp.offers[0]!.labels).toEqual(['price_unverified', 'delivery_unknown']);
  });
});

describe('schema guards', () => {
  it('rejects timestamps without the Europe/London offset', () => {
    expect(() => parseOffer({ ...offer(), captured_at: '2026-11-14T10:00:00' })).toThrow();
    expect(() => parseOffer({ ...offer(), captured_at: '2026-06-01T10:00:00+00:00' })).toThrow(); // BST is +01:00
    expect(() => parseOffer(offer())).not.toThrow();
  });

  it('rejects an affiliate URL without a recorded approved programme', () => {
    expect(() => parseOffer({ ...offer(), affiliate_url: 'https://aff.example.test/x' })).toThrow();
  });

  it('rejects verified flags without values and was_price without a source', () => {
    expect(() => parseOffer({ ...offer(), delivery_cost_gbp: null, delivery_verified: true })).toThrow();
    expect(() => parseOffer({ ...offer(), was_price_gbp: 150 })).toThrow();
  });
});

describe('Europe/London time helpers', () => {
  it('formats with the correct GMT/BST offset', () => {
    expect(toLondonIso('2026-11-14T23:17:00Z')).toBe('2026-11-14T23:17:00+00:00');
    expect(toLondonIso('2026-06-01T08:00:00Z')).toBe('2026-06-01T09:00:00+01:00');
    expect(isLondonIso('2026-06-01T09:00:00+01:00')).toBe(true);
    expect(londonDateKey('2026-06-01T23:30:00Z')).toBe('2026-06-02');
    expect(addDaysLondon('2026-11-14T23:17:00+00:00', 7)).toBe('2026-11-21T23:17:00+00:00');
  });
});
