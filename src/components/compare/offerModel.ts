/**
 * Local mirror of the S1-1 offer data contract v1 (derived, render-safe shapes only).
 * Source: https://github.com/kieranlittlewoodbusiness-web/SurvivialkitsUK/issues/2#issuecomment-6885791811
 *
 * Copied verbatim (field names and comments) so fixtures type-check against the contract.
 * TODO(S1-1 merged): delete these declarations and re-export from `src/lib/offers/types` instead,
 * read-only. Never edit `src/lib/offers`. The UI does not compute best price or savings itself:
 * it renders `best_price_offer_id` and `savings` exactly as the offers API returns them.
 * `Offer.internal` (commission) is not part of these shapes and must never be rendered.
 */

/** ISO 8601 date-time WITH an explicit offset, expressed in Europe/London time. */
export type LondonIsoDateTime = string;
/** ISO 8601 calendar date, e.g. "2026-11-14". */
export type IsoDate = string;

export const DEFAULT_STALE_AFTER_DAYS = 7;

export interface SourceRef {
  name: string;
  url: string;
}

export type OfferLabel = 'price_unverified' | 'price_missing' | 'delivery_unverified' | 'delivery_unknown' | 'stale';

export const OFFER_LABEL_TEXT: Record<OfferLabel, string> = {
  price_unverified: 'Price not verified',
  price_missing: 'Price not available',
  delivery_unverified: 'Delivery cost not verified',
  delivery_unknown: 'Delivery cost unknown – not included in total',
  stale: 'Price may be out of date',
};

export type ExclusionReason = 'model_match_unconfirmed' | 'identifier_mismatch' | 'unknown_variant';

export interface ExcludedOffer {
  offer_id: string;
  variant_id: string;
  retailer: string;
  reason: ExclusionReason;
}

/** Public, render-safe view of an Offer (no `internal`). */
export interface DisplayOffer {
  offer_id: string;
  variant_id: string;
  retailer: string;
  seller_name: string | null;
  availability_text: string | null;
  price_gbp_inc_vat: number | null;
  delivery_cost_gbp: number | null;
  free_delivery_threshold_gbp: number | null;
  delivery_text_verbatim: string | null;
  /** price + delivery. null when price or delivery is unknown. */
  delivered_total_gbp: number | null;
  total_per_person_gbp: number | null;
  total_per_person_day_gbp: number | null;
  delivery_known: boolean;
  price_verified: boolean;
  delivery_verified: boolean;
  is_stale: boolean;
  /** price & delivery verified, delivery known, not stale. */
  eligible_for_best_price: boolean;
  is_best_price: boolean;
  labels: OfferLabel[];
  label_text: string[];
  /** "Price at [retailer] on [date, time] UK time. Prices change." */
  price_disclaimer: string;
  /** affiliate_url when a programme is approved, else product_url. */
  link_url: string;
  is_affiliate_link: boolean;
  product_url: string;
  captured_at: LondonIsoDateTime;
  last_checked: LondonIsoDateTime;
  next_check_due: LondonIsoDateTime;
  source: SourceRef;
}

export interface Savings {
  amount_gbp: number;
  cheaper_offer_id: string;
  dearer_offer_id: string;
  /** Europe/London calendar date both rows were captured on. */
  capture_window: IsoDate;
}

export interface VariantComparison {
  variant_id: string;
  model_code: string;
  people_covered: number;
  days: number;
  water_litres_included: number;
  /** Sorted by the offers API. The UI keeps this order. */
  offers: DisplayOffer[];
  excluded: ExcludedOffer[];
  best_price_offer_id: string | null;
  same_capture_window: boolean;
  savings: Savings | null;
}

/* ---------- Web-only helpers (presentation, no business rules) ---------- */

export type OffersResult =
  | { status: 'ok'; comparisons: VariantComparison[]; fixture: boolean }
  | { status: 'empty'; comparisons: []; fixture: boolean }
  | { status: 'error'; comparisons: []; fixture: boolean; message: string };

export function formatGbp(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

/** e.g. "14 Nov 2026, 23:17" in Europe/London (callers add "UK time"). */
export function formatUkDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export const exclusionText: Record<ExclusionReason, string> = {
  model_match_unconfirmed: 'listing not confirmed as this exact model',
  identifier_mismatch: 'product code does not match this model',
  unknown_variant: 'not matched to a model we compare',
};
