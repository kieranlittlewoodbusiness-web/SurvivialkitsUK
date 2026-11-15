/** S1-2b card-face rules (issue #3 real-device items 3 and 6). */
import { describe, expect, it } from 'vitest';
import { buildComparisons, type DisplayOffer, type VariantComparison } from '../../lib/offers';
import { kitOffers, kitVariants } from '../../lib/offers/data';
import { affiliateHref, displayHost, faceOffer, otherOffers } from './cardModel';
import { fixtureData } from './offerFixtures';

const NOW = new Date('2026-11-15T00:10:00+00:00');

function comparisons(withFixtures: boolean): Map<string, VariantComparison> {
  const fx = withFixtures ? fixtureData(NOW) : { variants: [], offers: [] };
  const { comparisons: list } = buildComparisons([...kitVariants, ...fx.variants], [...kitOffers, ...fx.offers], { now: NOW });
  return new Map(list.map((c) => [c.variant_id, c]));
}

describe('faceOffer (item 3: held price on the card face)', () => {
  const real = comparisons(false);
  const e182p = real.get('evaq8-e182p')!;

  it('real data: E182P £117.00 is on the face as a held price, never as best', () => {
    const face = faceOffer(e182p);
    expect(face?.kind).toBe('held');
    expect(face?.offer.price_gbp_inc_vat).toBe(117);
    expect(face?.offer.labels).toEqual(expect.arrayContaining(['price_unverified', 'delivery_unknown']));
    expect(face?.offer.is_best_price).toBe(false);
    expect(e182p.best_price_offer_id).toBeNull();
  });

  it('the face row is removed from "Other prices we hold"', () => {
    const face = faceOffer(e182p);
    expect(otherOffers(e182p, face)).not.toContain(face?.offer);
    expect(otherOffers(e182p, face).length).toBe(e182p.offers.length - 1);
  });

  it('with no best price, the face is the first priced offer in API order (no re-sort)', () => {
    const e180 = comparisons(true).get('evaq8-e180')!;
    expect(e180.best_price_offer_id).toBeNull();
    const face = faceOffer(e180);
    expect(face?.kind).toBe('held');
    expect(face?.offer).toBe(e180.offers.find((o) => o.price_gbp_inc_vat !== null));
  });

  it('with a best price, the face is the API best row', () => {
    const e184 = comparisons(true).get('evaq8-e184')!;
    const face = faceOffer(e184);
    expect(face?.kind).toBe('best');
    expect(face?.offer.offer_id).toBe(e184.best_price_offer_id);
  });

  it('no offers => empty face', () => {
    expect(faceOffer(undefined)).toBeNull();
    const dup = comparisons(true).get('evaq8-e194')!;
    expect(dup.offers).toHaveLength(0);
    expect(faceOffer(dup)).toBeNull();
  });
});

describe('affiliate-only links (item 6)', () => {
  const real = comparisons(false);
  const e182pOffer = real.get('evaq8-e182p')!.offers[0];

  it('no affiliate link => no outbound href (renders "Retailer link coming soon")', () => {
    expect(e182pOffer.is_affiliate_link).toBe(false);
    expect(affiliateHref(e182pOffer)).toBeNull();
  });

  it('affiliate link from the contract => exact link_url', () => {
    const fxBest = comparisons(true).get('evaq8-e184')!.offers.find((o) => o.is_affiliate_link)!;
    expect(affiliateHref(fxBest)).toBe(fxBest.link_url);
  });

  it('is_affiliate_link without an https URL => no link', () => {
    const fake = { ...e182pOffer, is_affiliate_link: true, link_url: '' } as DisplayOffer;
    expect(affiliateHref(fake)).toBeNull();
  });

  it('price source is shown as a name and host (text only)', () => {
    expect(displayHost(e182pOffer.source.url)).toBe('evaq8.co.uk');
    expect(displayHost('not a url')).toBe('not a url');
  });

  it('no non-affiliate offer on the real page yields a link', () => {
    for (const c of real.values()) for (const o of c.offers) {
      if (!o.is_affiliate_link) expect(affiliateHref(o)).toBeNull();
    }
  });
});
