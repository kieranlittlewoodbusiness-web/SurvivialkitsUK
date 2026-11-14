/**
 * TEST FIXTURES (web scope), loaded only with OFFERS_FIXTURES=1. Production never uses them.
 *
 * Raw S1-1 `KitVariant` / `Offer` records, validated with Backend's own `parseVariant` /
 * `parseOffer` so they conform to the contract, then run through `buildComparisons` like real data.
 * Variant facts come from seller listings (SURVIVAL_COMPARISON_BRIEF §3). Every price is an
 * EXAMPLE round number. The affiliate programme/URL is example.com. Backend's real E182P seed is
 * added by loadOffers and is not repeated here.
 *
 * States exercised (PR #8 @ 3bdac22 rules):
 *   evaq8-e184  two verified, fresh, same-day offers, strictly cheaper -> best price + savings
 *               (one affiliate link); plus a model-unconfirmed row -> excluded 'model_match_unconfirmed'
 *   evaq8-e180  verified rows on different UK days + unverified + stale -> best_price_offer_id null
 *   evaq8-e194  variant_id deliberately duplicated -> every offer excluded 'duplicate_variant_id'
 *   evaq8-e182p Backend seed: unverified, delivery unknown; Amazon row excluded (model unconfirmed)
 *   tminus-t3-4p no variant record/offers -> "no price captured"
 */
import { addDaysLondon, parseOffer, parseVariant, toLondonIso, type KitVariant, type Offer } from '../../lib/offers';

function variant(v: {
  id: string; kit: string; name: string; code: string; people: number; weight: number; water: number;
  format: KitVariant['format']; url: string; captured: string;
}): KitVariant {
  return parseVariant({
    schema_version: 1,
    variant_id: v.id,
    kit_id: v.kit,
    brand: 'EVAQ8',
    manufacturer: 'Go-Bag',
    product_name: v.name,
    model_code: v.code,
    mpn: v.code,
    gtin: null,
    people_covered: v.people,
    days: 3,
    format: v.format,
    weight_kg: v.weight,
    contents: [{ quantity: null, item: 'EXAMPLE fixture: see seller listing for contents' }],
    contents_captured_at: v.captured,
    water_litres_included: v.water,
    source: { name: 'EVAQ8 product page', url: v.url },
    notes: ['TEST FIXTURE'],
  });
}

function offer(o: {
  id: string; variant: string; kit: string; retailer: string; mpn: string | null; price: number; delivery: number | null;
  priceVerified: boolean; deliveryVerified: boolean; checked: string; url: string; affiliate?: boolean;
  modelConfirmed?: boolean;
}, now: Date): Offer {
  return parseOffer({
    schema_version: 1,
    offer_id: o.id,
    variant_id: o.variant,
    kit_id: o.kit,
    retailer: o.retailer,
    seller_name: o.retailer,
    fulfilled_by: o.retailer,
    retailer_sku: o.mpn,
    asin: null,
    mpn: o.mpn,
    gtin: null,
    model_match_confirmed: o.modelConfirmed ?? true,
    model_match_note: o.modelConfirmed === false ? 'TEST FIXTURE: listing code does not confirm this model.' : 'TEST FIXTURE: exact model code shown.',
    currency: 'GBP',
    price_gbp_inc_vat: o.price,
    price_gbp_ex_vat: null,
    vat_status_note: 'EXAMPLE price',
    price_verified: o.priceVerified,
    delivery_cost_gbp: o.delivery,
    free_delivery_threshold_gbp: null,
    delivery_text_verbatim: null,
    delivery_lead_time_text: null,
    delivery_verified: o.deliveryVerified,
    availability_text: 'In stock',
    was_price_gbp: null,
    was_price_source: null,
    product_url: o.url,
    affiliate_url: o.affiliate ? 'https://example.com/affiliate/evaq8-e184' : '',
    affiliate_programme: o.affiliate ? { name: 'EXAMPLE programme (fixture)', approved_on: '2026-11-01' } : null,
    affiliate_disclosure_required: true,
    source: { name: 'EXAMPLE fixture', url: o.url, type: 'retailer_page_manual' },
    captured_at: o.checked,
    last_checked: o.checked,
    next_check_due: addDaysLondon(o.checked, 7),
    captured_by: 'fixture',
    screenshot_path: null,
    internal: { commission_rate: null, commission_rate_source: null },
  }, { now });
}

export function fixtureData(now: Date = new Date()): { variants: KitVariant[]; offers: Offer[] } {
  const t = now.getTime();
  const fresh1 = toLondonIso(t - 60_000);
  // Same instant as fresh1 so a build just after UK midnight cannot split the capture window.
  const fresh2 = fresh1;
  const yesterday = toLondonIso(t - 26 * 3600_000);
  const old = toLondonIso(t - 10 * 86_400_000);
  const e180Url = 'https://evaq8.co.uk/go-bag-emergency-kit-72-hour-survival-supplies.html';
  const e184Url = 'https://evaq8.co.uk/bug-out-bag-4-person-family-go-bag.html';
  const e194Url = 'https://evaq8.co.uk/gobag-emergency-kit-4-person-in-holdall.html';

  const variants = [
    variant({ id: 'evaq8-e180', kit: 'evaq8-gobag-1-person', name: 'GoBag Emergency Kit 72hr Survival Supplies', code: 'E180', people: 1, weight: 2.5, water: 0.5, format: 'rucksack', url: e180Url, captured: fresh1 }),
    variant({ id: 'evaq8-e184', kit: 'evaq8-gobag-4-person', name: 'GoBag Emergency Kit 4 Person Family Survival Kit', code: 'E184', people: 4, weight: 9, water: 2, format: 'rucksack', url: e184Url, captured: fresh1 }),
    variant({ id: 'evaq8-e194', kit: 'evaq8-gobag-4-person', name: '72 Hour Emergency 4 Person Family Kit in Holdall', code: 'E194', people: 4, weight: 8.5, water: 2, format: 'holdall', url: e194Url, captured: fresh1 }),
    // Deliberate data-entry error: a different model keyed with the same variant_id.
    variant({ id: 'evaq8-e194', kit: 'evaq8-gobag-4-person', name: 'GoBag 4 Person Emergency Kit in Plain Rucksack', code: 'E184P', people: 4, weight: 6, water: 2, format: 'rucksack', url: 'https://evaq8.co.uk/emergency-go-bag-4-person-plain.html', captured: fresh1 }),
  ];
  const offers = [
    // E180: no best price (verified rows from different UK days), plus unverified and stale rows.
    offer({ id: 'fx-e180-evaq8', variant: 'evaq8-e180', kit: 'evaq8-gobag-1-person', retailer: 'EVAQ8', mpn: 'E180', price: 50, delivery: 5, priceVerified: true, deliveryVerified: true, checked: fresh1, url: e180Url }, now),
    offer({ id: 'fx-e180-example', variant: 'evaq8-e180', kit: 'evaq8-gobag-1-person', retailer: 'Example Retailer', mpn: 'E180', price: 52, delivery: 0, priceVerified: true, deliveryVerified: true, checked: yesterday, url: 'https://example.com/product/e180' }, now),
    offer({ id: 'fx-e180-unverified', variant: 'evaq8-e180', kit: 'evaq8-gobag-1-person', retailer: 'Second Example Shop', mpn: 'E180', price: 48, delivery: 0, priceVerified: false, deliveryVerified: true, checked: fresh1, url: 'https://example.com/product/e180-b' }, now),
    offer({ id: 'fx-e180-stale', variant: 'evaq8-e180', kit: 'evaq8-gobag-1-person', retailer: 'Old Example Shop', mpn: 'E180', price: 45, delivery: 0, priceVerified: true, deliveryVerified: true, checked: old, url: 'https://example.com/product/e180-old' }, now),
    // E184: best + savings; model-unconfirmed row is excluded by the API.
    offer({ id: 'fx-e184-evaq8', variant: 'evaq8-e184', kit: 'evaq8-gobag-4-person', retailer: 'EVAQ8', mpn: 'E184', price: 200, delivery: 0, priceVerified: true, deliveryVerified: true, checked: fresh1, url: e184Url, affiliate: true }, now),
    offer({ id: 'fx-e184-example', variant: 'evaq8-e184', kit: 'evaq8-gobag-4-person', retailer: 'Example Retailer', mpn: 'E184', price: 205, delivery: 5, priceVerified: true, deliveryVerified: true, checked: fresh2, url: 'https://example.com/product/e184' }, now),
    offer({ id: 'fx-e184-unconfirmed', variant: 'evaq8-e184', kit: 'evaq8-gobag-4-person', retailer: 'Marketplace Example', mpn: null, price: 150, delivery: 0, priceVerified: true, deliveryVerified: true, checked: fresh1, url: 'https://example.com/product/e184-maybe', modelConfirmed: false }, now),
    // E194: duplicate variant_id -> all excluded.
    offer({ id: 'fx-e194-evaq8', variant: 'evaq8-e194', kit: 'evaq8-gobag-4-person', retailer: 'EVAQ8', mpn: 'E194', price: 190, delivery: 0, priceVerified: true, deliveryVerified: true, checked: fresh1, url: e194Url }, now),
  ];

  return { variants, offers };
}
