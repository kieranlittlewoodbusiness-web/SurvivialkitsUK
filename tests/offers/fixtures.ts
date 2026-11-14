import type { KitVariant, Offer } from '../../src/lib/offers/types';

export const NOW = '2026-11-14T23:30:00+00:00';

export function variant(over: Partial<KitVariant> = {}): KitVariant {
  return {
    schema_version: 1,
    variant_id: 'evaq8-e184',
    kit_id: 'evaq8-gobag-4-person',
    brand: 'EVAQ8',
    manufacturer: 'Go-Bag',
    product_name: 'TEST GoBag 4 Person',
    model_code: 'E184',
    mpn: 'E184',
    gtin: null,
    people_covered: 4,
    days: 3,
    format: 'rucksack',
    weight_kg: 9,
    contents: [{ quantity: 1, item: 'test item' }],
    contents_captured_at: '2026-11-14T20:00:00+00:00',
    water_litres_included: 2,
    source: { name: 'TEST', url: 'https://example.test/e184' },
    notes: [],
    ...over,
  };
}

let n = 0;
export function offer(over: Partial<Offer> = {}): Offer {
  n += 1;
  return {
    schema_version: 1,
    offer_id: `offer-${n}`,
    variant_id: 'evaq8-e184',
    kit_id: 'evaq8-gobag-4-person',
    retailer: `Retailer ${n}`,
    seller_name: null,
    fulfilled_by: null,
    retailer_sku: null,
    asin: null,
    mpn: 'E184',
    gtin: null,
    model_match_confirmed: true,
    model_match_note: 'TEST',
    currency: 'GBP',
    price_gbp_inc_vat: 100,
    price_gbp_ex_vat: null,
    vat_status_note: null,
    price_verified: true,
    delivery_cost_gbp: 5,
    free_delivery_threshold_gbp: null,
    delivery_text_verbatim: null,
    delivery_lead_time_text: null,
    delivery_verified: true,
    availability_text: 'In stock',
    was_price_gbp: null,
    was_price_source: null,
    product_url: 'https://example.test/p',
    affiliate_url: '',
    affiliate_programme: null,
    affiliate_disclosure_required: true,
    source: { name: 'TEST', url: 'https://example.test/p', type: 'retailer_page_manual' },
    captured_at: '2026-11-14T10:00:00+00:00',
    last_checked: '2026-11-14T10:00:00+00:00',
    next_check_due: '2026-11-21T10:00:00+00:00',
    captured_by: 'test',
    screenshot_path: null,
    internal: { commission_rate: 0.05, commission_rate_source: 'TEST terms' },
    ...over,
  };
}
