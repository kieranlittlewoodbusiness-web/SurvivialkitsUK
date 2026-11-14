/**
 * TEST FIXTURES in the S1-1 contract v1 shape (`VariantComparison` / `DisplayOffer`).
 *
 * Loaded only when the build runs with OFFERS_FIXTURES=1; production builds never use them.
 * - evaq8-e182p reproduces Backend's posted UNVERIFIED seed (issue #2 comment 6885791811):
 *   EVAQ8 £117.00 unverified with unknown delivery; Amazon UK row excluded (MPN E138 ≠ E182P).
 * - Every other price is an EXAMPLE placeholder (round numbers) chosen to exercise UI states:
 *   best verified price, unverified price, stale, unverified delivery, savings, no offers.
 *   The only affiliate URL is example.com.
 * Flags here are set by hand the way the offers API would set them; the UI does not derive them.
 */
import {
  OFFER_LABEL_TEXT,
  formatUkDateTime,
  type DisplayOffer,
  type OfferLabel,
  type VariantComparison,
} from './offerModel';

const iso = (d: Date) => d.toISOString().replace('Z', '+00:00');

type Seed = {
  offer_id: string;
  variant_id: string;
  retailer: string;
  people: number;
  price: number | null;
  delivery: number | null;
  price_verified: boolean;
  delivery_verified: boolean;
  is_stale?: boolean;
  is_best_price?: boolean;
  product_url: string;
  affiliate_url?: string;
  availability_text: string | null;
  delivery_text_verbatim?: string | null;
  source_name: string;
  checked: Date;
};

function display(s: Seed): DisplayOffer {
  const labels: OfferLabel[] = [];
  if (s.price === null) labels.push('price_missing');
  else if (!s.price_verified) labels.push('price_unverified');
  if (s.delivery === null) labels.push('delivery_unknown');
  else if (!s.delivery_verified) labels.push('delivery_unverified');
  if (s.is_stale) labels.push('stale');
  const total = s.price !== null && s.delivery !== null ? s.price + s.delivery : null;
  const isAffiliate = !!s.affiliate_url;
  return {
    offer_id: s.offer_id,
    variant_id: s.variant_id,
    retailer: s.retailer,
    seller_name: s.retailer,
    availability_text: s.availability_text,
    price_gbp_inc_vat: s.price,
    delivery_cost_gbp: s.delivery,
    free_delivery_threshold_gbp: null,
    delivery_text_verbatim: s.delivery_text_verbatim ?? null,
    delivered_total_gbp: total,
    total_per_person_gbp: total === null ? null : Math.round((total / s.people) * 100) / 100,
    total_per_person_day_gbp: total === null ? null : Math.round((total / s.people / 3) * 100) / 100,
    delivery_known: s.delivery !== null,
    price_verified: s.price_verified,
    delivery_verified: s.delivery_verified,
    is_stale: !!s.is_stale,
    eligible_for_best_price: labels.length === 0,
    is_best_price: !!s.is_best_price,
    labels,
    label_text: labels.map((l) => OFFER_LABEL_TEXT[l]),
    price_disclaimer: `Price at ${s.retailer} on ${formatUkDateTime(iso(s.checked))} UK time. Prices change.`,
    link_url: isAffiliate ? (s.affiliate_url as string) : s.product_url,
    is_affiliate_link: isAffiliate,
    product_url: s.product_url,
    captured_at: iso(s.checked),
    last_checked: iso(s.checked),
    next_check_due: iso(new Date(s.checked.getTime() + 7 * 86400_000)),
    source: { name: s.source_name, url: s.product_url },
  };
}

const base = (variant_id: string, model_code: string, people: number, water: number) => ({
  variant_id,
  model_code,
  people_covered: people,
  days: 3,
  water_litres_included: water,
});

export function exampleComparisons(now: Date = new Date()): VariantComparison[] {
  const fresh = new Date(now.getTime() - 2 * 3600_000);
  const old = new Date(now.getTime() - 10 * 86400_000);
  const seedTime = new Date('2026-11-14T23:17:00+00:00');

  const e180Best = display({ offer_id: 'evaq8-e180--evaq8--example', variant_id: 'evaq8-e180', retailer: 'EVAQ8', people: 1, price: 50, delivery: 5, price_verified: true, delivery_verified: true, is_best_price: true, product_url: 'https://evaq8.co.uk/go-bag-emergency-kit-72-hour-survival-supplies.html', availability_text: 'In stock', source_name: 'EXAMPLE fixture', checked: fresh });
  const e180Amz = display({ offer_id: 'evaq8-e180--amazon-uk--example', variant_id: 'evaq8-e180', retailer: 'Amazon UK', people: 1, price: 48, delivery: 0, price_verified: false, delivery_verified: true, product_url: 'https://www.amazon.co.uk/', availability_text: 'In stock', source_name: 'EXAMPLE fixture', checked: fresh });

  const e182p = display({ offer_id: 'evaq8-e182p--evaq8--20261114', variant_id: 'evaq8-e182p', retailer: 'EVAQ8', people: 2, price: 117, delivery: null, price_verified: false, delivery_verified: false, product_url: 'https://evaq8.co.uk/gobag-emergency-kit-2-person-e141-plain.html', availability_text: 'In stock (69 items available)', delivery_text_verbatim: 'Free shipping', source_name: 'EVAQ8 product page (manual public capture, not an approved feed)', checked: seedTime });

  const e184A = display({ offer_id: 'evaq8-e184--evaq8--example', variant_id: 'evaq8-e184', retailer: 'EVAQ8', people: 4, price: 200, delivery: 0, price_verified: true, delivery_verified: true, is_best_price: true, product_url: 'https://evaq8.co.uk/bug-out-bag-4-person-family-go-bag.html', affiliate_url: 'https://example.com/affiliate/evaq8-e184', availability_text: 'In stock', source_name: 'EXAMPLE fixture', checked: fresh });
  const e184B = display({ offer_id: 'evaq8-e184--example-retailer--example', variant_id: 'evaq8-e184', retailer: 'Example Retailer', people: 4, price: 205, delivery: 5, price_verified: true, delivery_verified: true, product_url: 'https://example.com/product/e184', availability_text: 'In stock', source_name: 'EXAMPLE fixture', checked: fresh });

  const e194Stale = display({ offer_id: 'evaq8-e194--evaq8--example-old', variant_id: 'evaq8-e194', retailer: 'EVAQ8', people: 4, price: 190, delivery: 0, price_verified: true, delivery_verified: true, is_stale: true, product_url: 'https://evaq8.co.uk/gobag-emergency-kit-4-person-in-holdall.html', availability_text: 'In stock', source_name: 'EXAMPLE fixture', checked: old });
  const e194Del = display({ offer_id: 'evaq8-e194--example-retailer--example', variant_id: 'evaq8-e194', retailer: 'Example Retailer', people: 4, price: 195, delivery: 6, price_verified: true, delivery_verified: false, product_url: 'https://example.com/product/e194', availability_text: 'Usually dispatched in 2 to 3 days', source_name: 'EXAMPLE fixture', checked: fresh });
  const londonDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(fresh);

  return [
    { ...base('evaq8-e180', 'E180', 1, 0.5), offers: [e180Best, e180Amz], excluded: [], best_price_offer_id: e180Best.offer_id, same_capture_window: true, savings: null },
    {
      ...base('evaq8-e182p', 'E182P', 2, 1),
      offers: [e182p],
      excluded: [{ offer_id: 'evaq8-e182p--amazon-uk--20261114', variant_id: 'evaq8-e182p', retailer: 'Amazon UK', reason: 'model_match_unconfirmed' }],
      best_price_offer_id: null,
      same_capture_window: true,
      savings: null,
    },
    {
      ...base('evaq8-e184', 'E184', 4, 2),
      offers: [e184A, e184B],
      excluded: [],
      best_price_offer_id: e184A.offer_id,
      same_capture_window: true,
      savings: { amount_gbp: 10, cheaper_offer_id: e184A.offer_id, dearer_offer_id: e184B.offer_id, capture_window: londonDay },
    },
    { ...base('evaq8-e194', 'E194', 4, 2), offers: [e194Del, e194Stale], excluded: [], best_price_offer_id: null, same_capture_window: false, savings: null },
    // tminus-t3-4p: deliberately absent (per-kit "no price captured" state).
  ];
}
