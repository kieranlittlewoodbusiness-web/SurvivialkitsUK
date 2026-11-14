/**
 * S1-1 offer data contract (v1) for The Household Brief.
 *
 * Source rules: SURVIVAL_COMPARISON_BRIEF.md sections 3, 7 and 8.
 * - One Offer row per kit variant x retailer x capture.
 * - Prices are GBP inc VAT. Never mix with ex-VAT.
 * - delivery_cost_gbp === null means UNKNOWN. Never treat it as 0.
 * - affiliate_url stays '' until a programme is actually approved
 *   (affiliate_programme records the name and approval date).
 * - Offers with model_match_confirmed === false are excluded from comparisons.
 * - `internal.commission_rate` is INTERNAL ONLY and must never be rendered.
 *   UI code should only consume `DisplayOffer` / `VariantComparison`, which omit it.
 */

/** ISO 8601 date-time WITH an explicit offset, expressed in Europe/London time,
 *  e.g. "2026-11-14T23:20:00+00:00" (GMT) or "2026-06-01T09:00:00+01:00" (BST). */
export type LondonIsoDateTime = string;

/** ISO 8601 calendar date, e.g. "2026-11-14". */
export type IsoDate = string;

export const OFFER_SCHEMA_VERSION = 1 as const;

/** Default staleness threshold (brief s7: next_check_due = capture + 7 days). */
export const DEFAULT_STALE_AFTER_DAYS = 7;

export interface SourceRef {
  /** Approved source name, e.g. "EVAQ8 product page", "Amazon UK product page". */
  name: string;
  url: string;
}

export interface ContentsItem {
  quantity: number | null;
  item: string;
}

/** One exact kit variant. variant_id is unique per exact model code
 *  (E184, E184P and E194 are three different variants). */
export interface KitVariant {
  schema_version: typeof OFFER_SCHEMA_VERSION;
  /** Exact-variant key used to group offers, e.g. "evaq8-e182p". */
  variant_id: string;
  /** Kit family key (brief s7 `kit_id`), e.g. "evaq8-gobag-2-person". */
  kit_id: string;
  brand: string;
  manufacturer: string;
  product_name: string;
  /** Exact manufacturer model / product code, e.g. "E182P". */
  model_code: string;
  mpn: string | null;
  gtin: string | null;
  people_covered: number;
  days: number;
  format: 'rucksack' | 'holdall' | 'box' | 'other';
  weight_kg: number | null;
  contents: ContentsItem[];
  /** When the contents list was read from the source. */
  contents_captured_at: LondonIsoDateTime;
  /** Sealed drinking water supplied in the kit, litres. */
  water_litres_included: number;
  source: SourceRef;
  /** Free-text caveats, e.g. "Dimensions UNVERIFIED". */
  notes: string[];
}

export interface AffiliateProgramme {
  /** e.g. "Amazon Associates UK". */
  name: string;
  /** Date the programme actually approved us. */
  approved_on: IsoDate;
}

export type SourceType =
  | 'retailer_page_manual'
  | 'affiliate_feed'
  | 'retailer_api';

export interface OfferSource extends SourceRef {
  type: SourceType;
}

/** Fields that must NEVER be published. Strip before rendering. */
export interface OfferInternal {
  /** INTERNAL ONLY. Never render or publish. From approved programme terms only. */
  commission_rate: number | null;
  /** Document the commission rate came from. INTERNAL ONLY. */
  commission_rate_source: string | null;
}

/** One retailer capture for one exact variant. */
export interface Offer {
  schema_version: typeof OFFER_SCHEMA_VERSION;
  offer_id: string;
  /** Must equal KitVariant.variant_id exactly (no normalisation). */
  variant_id: string;
  kit_id: string;
  retailer: string;
  seller_name: string | null;
  fulfilled_by: string | null;

  /** Exact-model identifiers as shown by the retailer. */
  retailer_sku: string | null;
  asin: string | null;
  mpn: string | null;
  gtin: string | null;
  model_match_confirmed: boolean;
  /** Why the match is / is not confirmed. */
  model_match_note: string;

  currency: 'GBP';
  /** Consumer price, GBP inc VAT. null = not captured. */
  price_gbp_inc_vat: number | null;
  /** Only when the seller shows it separately. Never compared with inc-VAT. */
  price_gbp_ex_vat: number | null;
  vat_status_note: string | null;
  price_verified: boolean;

  /** GBP. null = UNKNOWN (never treated as 0). 0 only when verified free. */
  delivery_cost_gbp: number | null;
  /** Spend at which delivery becomes free, GBP. null = none/unknown. */
  free_delivery_threshold_gbp: number | null;
  /** Delivery wording verbatim from the page, e.g. "Free shipping". */
  delivery_text_verbatim: string | null;
  delivery_lead_time_text: string | null;
  delivery_verified: boolean;

  /** Verbatim stock wording, e.g. "In stock". Do not paraphrase. */
  availability_text: string | null;

  /** Only with a verifiable reference price (EVAQ8 "Market price" does not count). */
  was_price_gbp: number | null;
  was_price_source: string | null;

  /** Canonical non-affiliate URL, no tracking. */
  product_url: string;
  /** Exact programme-generated URL. '' until affiliate_programme is set. */
  affiliate_url: string;
  affiliate_programme: AffiliateProgramme | null;
  affiliate_disclosure_required: boolean;

  source: OfferSource;
  captured_at: LondonIsoDateTime;
  last_checked: LondonIsoDateTime;
  /** captured/last_checked + 7 days by default. */
  next_check_due: LondonIsoDateTime;
  captured_by: string;
  screenshot_path: string | null;

  /** INTERNAL ONLY. Never rendered. */
  internal: OfferInternal;
}

/** Seed / capture file wrapper (src/data/kits/offers.json). */
export interface OffersFile {
  schema_version: typeof OFFER_SCHEMA_VERSION;
  /** "unverified-seed" until an approved source backs every row. */
  status: 'unverified-seed' | 'verified';
  /** Exact data sources still needed before prices can be published. */
  data_source_needed: string[];
  offers: Offer[];
}

export interface VariantsFile {
  schema_version: typeof OFFER_SCHEMA_VERSION;
  variants: KitVariant[];
}

/* ---------- Derived output the UI consumes ---------- */

export type OfferLabel =
  | 'model_unconfirmed'
  | 'price_unverified'
  | 'price_missing'
  | 'delivery_unverified'
  | 'delivery_unknown'
  | 'stale';

export const OFFER_LABEL_TEXT: Record<OfferLabel, string> = {
  model_unconfirmed: 'Exact model not confirmed',
  price_unverified: 'Price not verified',
  price_missing: 'Price not available',
  delivery_unverified: 'Delivery cost not verified',
  delivery_unknown: 'Delivery cost unknown – not included in total',
  stale: 'Price may be out of date',
};

export type ExclusionReason =
  | 'model_match_unconfirmed'
  | 'identifier_mismatch'
  | 'unknown_variant'
  | 'duplicate_variant_id';

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
  /** delivered_total / people. null when total unknown. */
  total_per_person_gbp: number | null;
  /** delivered_total / (people x days). null when total unknown. */
  total_per_person_day_gbp: number | null;
  delivery_known: boolean;
  /** true only when the offer is model-confirmed AND its MPN/GTIN match the variant.
   *  false => never eligible for best price/savings, labelled model_unconfirmed. */
  model_match_confirmed: boolean;
  price_verified: boolean;
  delivery_verified: boolean;
  is_stale: boolean;
  /** Model confirmed, price & delivery verified and finite, delivery known, not stale. */
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
  /** Sorted: verified known totals asc, then unverified known totals asc,
   *  then unknown delivery (by price), then stale known totals, then stale
   *  unknown delivery, then missing price. */
  offers: DisplayOffer[];
  excluded: ExcludedOffer[];
  /** Set only when same_capture_window is true, >= 2 rows are eligible and the
   *  cheapest eligible row is strictly cheaper than the next (no ties). */
  best_price_offer_id: string | null;
  /** True only when every included row was captured on the same London day. */
  same_capture_window: boolean;
  /** Non-null exactly when best_price_offer_id is non-null. */
  savings: Savings | null;
}
