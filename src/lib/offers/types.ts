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

export const OFFER_SCHEMA_VERSION = 2 as const;
/** v1 (S1-1) rows stay valid and are treated as category 'kit'. */
export type SchemaVersion = 1 | 2;

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

/** S1-8b: identity checks recorded against a public listing. */
export const VERIFICATION_CHECKS = ['title', 'brand', 'model', 'pack_contents', 'size'] as const;
export type VerificationCheck = (typeof VERIFICATION_CHECKS)[number];

/**
 * S1-8b: evidence for a product's `verification` value. Never holds prices,
 * images or tagged URLs: `source_url` is the tagless https://www.amazon.co.uk/dp/{ASIN}.
 */
export interface VerificationEvidence {
  method: 'public_listing';
  /** https://www.amazon.co.uk/dp/{ASIN} with no query string or fragment. */
  source_url: string;
  checked_on: IsoDate;
  /** 'verified' iff the record's verification is 'verified'. 'not_run' = page unreadable/blocked. */
  outcome: 'verified' | 'not_verified' | 'not_run';
  /** Checks that matched our record. Verified needs title, brand, model, pack_contents (+ size for thermals). */
  checks_matched: VerificationCheck[];
  note: string;
}

/** One exact kit variant. variant_id is unique per exact model code
 *  (E184, E184P and E194 are three different variants). */
export interface KitVariant {
  schema_version: SchemaVersion;
  /** S1-8: absent = 'kit'. */
  category?: 'kit';
  /** S1-8: amazon.co.uk ASIN for this exact variant, if known. */
  asin_uk?: string | null;
  /** S1-8: absent = 'unverified'. Only verified products may carry affiliate links. */
  verification?: 'unverified' | 'verified';
  /** S1-8b: how `verification` was decided (required when verified). */
  verification_evidence?: VerificationEvidence;
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
  schema_version: SchemaVersion;
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
  /** Exact programme-generated URL. '' until the programme is approved.
   *  Amazon rows: always '' (the link is derived at build time from ASIN + env tag). */
  affiliate_url: string;
  /** v1 only (legacy). v2 rows reference a programme with affiliate_programme_id. */
  affiliate_programme: AffiliateProgramme | null;
  /** S1-8: absent = 'kit'. */
  category?: ProductCategory;
  /** S1-8: marketplace the ASIN belongs to. */
  asin_marketplace?: 'amazon.co.uk' | null;
  /** S1-8: -> AffiliateProgrammeRecord.programme_id. */
  affiliate_programme_id?: string | null;
  /** S1-8: where the price came from. Amazon prices display only when 'amazon_product_api'. */
  price_origin?: PriceOrigin;
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
  schema_version: SchemaVersion;
  /** "unverified-seed" until an approved source backs every row. */
  status: 'unverified-seed' | 'verified';
  /** Exact data sources still needed before prices can be published. */
  data_source_needed: string[];
  offers: Offer[];
}

export interface VariantsFile {
  schema_version: SchemaVersion;
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

/* =====================================================================
 * S1-8 (v2) extension: categories, catalogue products, affiliate
 * programmes and the affiliate-only render rule. Additive: v1 data and the
 * S1-1 display API (DisplayOffer / VariantComparison / buildComparisons)
 * are unchanged and marked deprecated for rendering outbound links.
 * ===================================================================== */

export type ProductCategory =
  | 'kit'
  | 'emergency_water'
  | 'first_aid_kit'
  | 'torch'
  | 'radio'
  | 'power_bank'
  | 'batteries'
  | 'emergency_blanket'
  | 'thermal_clothing'
  | 'hi_vis'
  | 'jump_leads'
  | 'warning_triangle';

/**
 * S1-10: canonical category order (also the order groupComparisonsByCategory returns).
 * 'wind_up_torch_radio' was split into 'torch' and 'radio'; see LEGACY_CATEGORY_WIND_UP_TORCH_RADIO.
 */
export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  'kit',
  'emergency_water',
  'first_aid_kit',
  'torch',
  'radio',
  'power_bank',
  'batteries',
  'emergency_blanket',
  'thermal_clothing',
  'hi_vis',
  'jump_leads',
  'warning_triangle',
];

/**
 * S1-10: pre-split slug. Still accepted when parsing (backward compatible) and migrated on
 * parse: products by specs.device_type ('torch' => 'torch'; 'radio' / 'torch_radio' / absent =>
 * 'radio'), offers to 'radio' (offer.category is informational only and never used for matching
 * or grouping; grouping uses the product's category). Never emitted.
 */
export const LEGACY_CATEGORY_WIND_UP_TORCH_RADIO = 'wind_up_torch_radio' as const;

/** S1-10: plain-English display label per category (Web renders this as category_label). */
export const CATEGORY_LABELS: Readonly<Record<ProductCategory, string>> = {
  kit: 'Pre-packed kits',
  emergency_water: 'Emergency water',
  first_aid_kit: 'First aid kits',
  torch: 'Torches',
  radio: 'Emergency radios',
  power_bank: 'Power banks',
  batteries: 'Batteries',
  emergency_blanket: 'Emergency blankets',
  thermal_clothing: 'Thermals',
  hi_vis: 'Hi-vis vests',
  jump_leads: 'Jump leads',
  warning_triangle: 'Warning triangles',
};

export type PriceOrigin = 'none' | 'manual_capture' | 'amazon_product_api' | 'affiliate_feed';

/** A spec value with its own provenance. Absent = unknown (never guessed). */
export interface Sourced<T> {
  value: T;
  source: SourceRef;
  captured_at: LondonIsoDateTime;
}

export interface EmergencyWaterSpecs {
  pack_format?: Sourced<'can' | 'carton' | 'pouch' | 'bottle'>;
  unit_volume_ml?: Sourced<number>;
  units_per_pack?: Sourced<number>;
  total_litres?: Sourced<number>;
  shelf_life_years?: Sourced<number>;
}
export interface FirstAidKitSpecs {
  item_count?: Sourced<number>;
  /** e.g. 'BS 8599-1', 'BS 8599-2', 'none_stated', or the exact edition shown. */
  standard?: Sourced<string>;
  kit_size_label?: Sourced<string>;
}
export type TorchRadioPowerSource = 'wind_up' | 'dynamo' | 'solar' | 'usb' | 'aa' | 'aaa' | 'built_in_battery';
export interface TorchRadioSpecs {
  device_type?: Sourced<'torch' | 'radio' | 'torch_radio'>;
  power_sources?: Sourced<TorchRadioPowerSource[]>;
  lumens?: Sourced<number>;
  radio_bands?: Sourced<Array<'AM' | 'FM' | 'DAB' | 'LW'>>;
  usb_output?: Sourced<boolean>;
  battery_mah?: Sourced<number>;
}
/** S1-10: torches and radios share the pre-split spec shape. */
export type TorchSpecs = TorchRadioSpecs;
export type RadioSpecs = TorchRadioSpecs;
export interface PowerBankSpecs {
  capacity_mah?: Sourced<number>;
  capacity_wh?: Sourced<number>;
  max_output_w?: Sourced<number>;
  ports?: Sourced<string[]>;
}
export interface EmergencyBlanketSpecs {
  material?: Sourced<string>;
  size_cm?: Sourced<{ w: number; h: number }>;
  pack_count?: Sourced<number>;
  reusable?: Sourced<boolean>;
}
export interface ThermalClothingSpecs {
  garment_type?: Sourced<'base_layer_top' | 'base_layer_bottom' | 'set' | 'socks' | 'hat' | 'gloves' | 'other'>;
  material?: Sourced<string>;
  size_label?: Sourced<string>;
  pack_count?: Sourced<number>;
}

export type BatterySize = 'AA' | 'AAA' | 'C' | 'D' | '9V' | 'CR2032' | 'other';
export type BatteryChemistry = 'alkaline' | 'lithium' | 'nimh' | 'zinc_carbon' | 'other';
export interface BatterySpecs {
  size?: Sourced<BatterySize>;
  chemistry?: Sourced<BatteryChemistry>;
  pack_count?: Sourced<number>;
}
export interface HiVisSpecs {
  /** Standard exactly as shown on the listing, e.g. 'EN ISO 20471 Class 2'. Evidence/spec only; never in display_name. */
  standard?: Sourced<string>;
  /** Required when verified (one exact size per ASIN, like thermals), e.g. 'XL' or 'One size'. */
  size_label?: Sourced<string>;
  pack_count?: Sourced<number>;
}
export interface JumpLeadsSpecs {
  length_m?: Sourced<number>;
  /** Amp rating as listed, e.g. 400. */
  max_current_a?: Sourced<number>;
  /** Conductor cross-section as listed, e.g. 16 (mm²). */
  cable_gauge_mm2?: Sourced<number>;
}
export interface WarningTriangleSpecs {
  /** Listing states the triangle is E-marked. */
  e_marked?: Sourced<boolean>;
  /** Listing states ECE R27 approval. A verified triangle needs e_marked or ece_r27 === true. */
  ece_r27?: Sourced<boolean>;
  pack_count?: Sourced<number>;
}

/**
 * S1-10: image source. 'paapi' = Amazon's Creators API (formerly the Product Advertising API,
 * PA-API); the literal is kept as 'paapi'. No downloaded, rehosted, scraped or tag-bearing images.
 */
export type ImageSource = 'paapi';

interface CatalogueProductBase {
  schema_version: 2;
  /** Exact product key (same join key as S1-1 variant_id). */
  variant_id: string;
  product_name: string;
  brand: string;
  /** amazon.co.uk ASIN, ^[A-Z0-9]{10}$. Placeholders are rejected. */
  asin_uk: string | null;
  gtin: string | null;
  /** Manufacturer part number used as an identity key. */
  mpn: string | null;
  model_code: string | null;
  /** S1-8b: manufacturer's own SKU (e.g. UGREEN 25683), an identity key alongside model_code. */
  manufacturer_sku?: string | null;
  /**
   * S1-8b: a part number shown only on the retailer listing (e.g. Amazon "Manufacturer Part
   * Number") that is NOT confirmed by the manufacturer. Recorded as shown; never an identity key
   * and never used for matching. Must differ from mpn and manufacturer_sku.
   */
  listing_mpn?: string | null;
  pack_quantity: number | null;
  source: SourceRef;
  captured_at: LondonIsoDateTime;
  /** 'unverified' until an approved source (e.g. Amazon product API) confirms it. */
  verification: 'unverified' | 'verified';
  /** S1-8b: how `verification` was decided (required when verified). */
  verification_evidence?: VerificationEvidence;
  /**
   * S1-10: short, plain product name for card headings and image alt (e.g. "Anker 20,000mAh power
   * bank"). REQUIRED when verified. No standards codes, model/part/SKU numbers, ALL-CAPS keyword
   * stuffing, and at most DISPLAY_NAME_MAX_LENGTH characters (see validateDisplayName).
   * product_name keeps the full listing title for evidence only.
   */
  display_name?: string | null;
  /** S1-10: order within the category, integer 1-3 (lower first). Absent/null = after ranked items, source order. */
  display_rank?: number | null;
  /**
   * S1-10: Amazon-served image from Amazon's Creators API (formerly PA-API) only: https on
   * m.media-amazon.com, with image_source 'paapi'. null at launch (no API access yet).
   */
  image_url?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  image_source?: ImageSource | null;
  notes: string[];
}
export type CatalogueProduct =
  | (CatalogueProductBase & { category: 'emergency_water'; specs: EmergencyWaterSpecs })
  | (CatalogueProductBase & { category: 'first_aid_kit'; specs: FirstAidKitSpecs })
  | (CatalogueProductBase & { category: 'torch'; specs: TorchSpecs })
  | (CatalogueProductBase & { category: 'radio'; specs: RadioSpecs })
  | (CatalogueProductBase & { category: 'power_bank'; specs: PowerBankSpecs })
  | (CatalogueProductBase & { category: 'emergency_blanket'; specs: EmergencyBlanketSpecs })
  | (CatalogueProductBase & { category: 'thermal_clothing'; specs: ThermalClothingSpecs })
  | (CatalogueProductBase & { category: 'batteries'; specs: BatterySpecs })
  | (CatalogueProductBase & { category: 'hi_vis'; specs: HiVisSpecs })
  | (CatalogueProductBase & { category: 'jump_leads'; specs: JumpLeadsSpecs })
  | (CatalogueProductBase & { category: 'warning_triangle'; specs: WarningTriangleSpecs });

export type ProductRecord = KitVariant | CatalogueProduct;

export interface CatalogueProductsFile {
  schema_version: 2;
  status: 'unverified-seed' | 'verified';
  data_source_needed: string[];
  products: CatalogueProduct[];
}

export type ProgrammeStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface AffiliateProgrammeRecord {
  /** e.g. 'amazon-associates-uk'. */
  programme_id: string;
  name: string;
  network: 'amazon-associates' | 'awin' | 'webgains' | 'direct' | 'other';
  status: ProgrammeStatus;
  status_updated_on: IsoDate;
  /** Non-null only when status is 'approved'. */
  approved_on: IsoDate | null;
  /** NAME of the env var holding the tracking id. Never the value. */
  tracking_id_env: string | null;
  link_mode: 'derive_from_asin' | 'stored_exact_url';
  /** e.g. ['www.amazon.co.uk']. */
  allowed_hosts: string[];
  disclosure_text: string;
  price_display: 'api_only' | 'timestamped_capture';
  max_price_age_hours: number;
  terms_url: string;
  notes: string[];
}

export interface AffiliateProgrammesFile {
  schema_version: 2;
  programmes: AffiliateProgrammeRecord[];
}

/** Build-time environment consulted by the link builder (injectable for tests). */
export type BuildEnv = Record<string, string | undefined>;

export const AMAZON_ASSOCIATES_UK_TAG_ENV = 'AMAZON_ASSOCIATES_UK_TAG' as const;

export const AMAZON_PRICE_DISCLAIMER =
  'Product prices and availability are accurate as of the date/time indicated and are subject to change. Any price and availability information displayed on Amazon.co.uk at the time of purchase will apply to the purchase of this product.';

export const NO_LINK_TEXT =
  'No retailer link yet: we only link to retailers through approved affiliate programmes.';

/** Shown when the listing is not confirmed as the exact product (ASIN/GTIN/model). */
export const NO_LINK_TEXT_EXACT_PRODUCT =
  "No retailer link: we haven't confirmed this listing is the exact product shown.";

/** Shown when the product's details have not been verified yet. */
export const NO_LINK_TEXT_PRODUCT_UNVERIFIED =
  "No retailer link yet: we haven't finished checking this product's details.";

export type CatalogueOfferLabel = OfferLabel | 'no_affiliate_link' | 'price_not_displayable';

export const CATALOGUE_LABEL_TEXT: Record<CatalogueOfferLabel, string> = {
  ...OFFER_LABEL_TEXT,
  no_affiliate_link: 'No retailer link yet',
  price_not_displayable: 'Price not shown',
};

/** S1-8 exclusion reasons (superset of S1-1 ExclusionReason). */
export type CatalogueExclusionReason = ExclusionReason | 'asin_mismatch' | 'gtin_mismatch' | 'no_exact_identity';

export interface CatalogueExcludedOffer {
  offer_id: string;
  variant_id: string;
  retailer: string;
  reason: CatalogueExclusionReason;
}

/**
 * Why `link_url` is null (for Web; never shown verbatim to readers):
 * - no_programme: no approved-programme record applies to this retailer/offer.
 * - programme_pending / _rejected / _suspended: programme not (or no longer) approved,
 *   or approved_on is after the offer's capture date (pending).
 * - tracking_id_missing: the programme's tracking id env var is unset/empty at build time.
 * - tracking_id_invalid: the env var is set but malformed (UK Associates ids must end in -21).
 * - no_affiliate_url / not_https / host_not_allowed: stored-link programmes only.
 * - exact_product_not_confirmed: the offer is not confirmed as the exact product
 *   (ASIN/GTIN/model mismatch, missing identity, or model_match_confirmed=false).
 *   Renamed from `product_not_matched` (PR #12 review).
 * - product_unverified: the offer matches, but the product record is not
 *   `verification: 'verified'` (kits: absent = unverified; verified thermal_clothing
 *   also needs specs.size_label). New in PR #12 review r2.
 * - marketplace_not_supported: an Amazon offer whose URLs point at a non-UK Amazon
 *   marketplace or an Amazon short link (amzn.to, a.co, ...). Only amazon.co.uk links
 *   are built. New in PR #12 review r2.
 * - non_production_build: an Amazon (ASIN-derived) link in a build that is not production:
 *   SITE_ENV is unset, 'preview' or anything other than 'production', or the build is a
 *   Cloudflare Pages branch preview (CF_PAGES=1, CF_PAGES_BRANCH != PRODUCTION_BRANCH/'main').
 *   Checked before the tracking id, so previews never read it. Render as the generic no-link
 *   text (NO_LINK_TEXT). New in S1-8b (PR #13 review M1).
 */
export type NoLinkReason =
  | 'no_programme'
  | 'programme_pending'
  | 'programme_rejected'
  | 'programme_suspended'
  | 'tracking_id_missing'
  | 'tracking_id_invalid'
  | 'no_affiliate_url'
  | 'not_https'
  | 'host_not_allowed'
  | 'exact_product_not_confirmed'
  | 'product_unverified'
  | 'marketplace_not_supported'
  | 'non_production_build';

/**
 * S1-8 render-safe offer. The ONLY outbound URL is `link_url`, and it is an approved
 * affiliate link or null. There is no product_url and no source URL here, by design.
 */
export interface AffiliateDisplayOffer {
  offer_id: string;
  variant_id: string;
  category: ProductCategory;
  retailer: string;
  seller_name: string | null;
  availability_text: string | null;
  /** null when unknown OR when price_display_allowed is false. */
  price_gbp_inc_vat: number | null;
  delivery_cost_gbp: number | null;
  free_delivery_threshold_gbp: number | null;
  delivery_text_verbatim: string | null;
  delivered_total_gbp: number | null;
  /** Kits only (people x days); null for other categories. */
  total_per_person_gbp: number | null;
  total_per_person_day_gbp: number | null;
  delivery_known: boolean;
  model_match_confirmed: boolean;
  price_verified: boolean;
  delivery_verified: boolean;
  price_display_allowed: boolean;
  is_stale: boolean;
  eligible_for_best_price: boolean;
  is_best_price: boolean;
  labels: CatalogueOfferLabel[];
  label_text: string[];
  /** "Price at [retailer] on [date, time] UK time. Prices change." or null when no price is shown. */
  price_disclaimer: string | null;
  /** Amazon's own disclaimer when an Amazon price is shown; else null. */
  retailer_price_disclaimer: string | null;
  /** Approved affiliate URL or null. NEVER a plain retailer URL. */
  link_url: string | null;
  link_rel: 'sponsored nofollow' | null;
  /** === (link_url !== null). */
  is_affiliate_link: boolean;
  no_link_reason: NoLinkReason | null;
  no_link_text: string | null;
  /** Programme disclosure, set whenever link_url is set. */
  disclosure_text: string | null;
  captured_at: LondonIsoDateTime;
  last_checked: LondonIsoDateTime;
  next_check_due: LondonIsoDateTime;
  /** Name only: render as text, never as a link. */
  source: { name: string };
}

/** Render-safe product identity and spec values (no source URLs). */
export interface PublicProductSummary {
  variant_id: string;
  category: ProductCategory;
  product_name: string;
  brand: string;
  asin_uk: string | null;
  gtin: string | null;
  mpn: string | null;
  model_code: string | null;
  pack_quantity: number | null;
  verification: 'unverified' | 'verified';
  /** Spec values only, keyed by spec name; provenance stays in the stored record. */
  specs: Record<string, unknown>;
  /** e.g. 'Amazon UK product page (public listing, unverified)'. */
  source_name: string;
  captured_at: LondonIsoDateTime;
  /** S1-10: short plain name for headings/alt; null for kits and for unverified products without one. */
  display_name: string | null;
  /** S1-10: 1-3 within the category, or null. */
  display_rank: number | null;
  /** S1-10: Creators API (formerly PA-API) image on m.media-amazon.com, or null (all null at launch). */
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  image_source: ImageSource | null;
}

export interface CatalogueComparison {
  variant_id: string;
  category: ProductCategory;
  product: PublicProductSummary;
  offers: AffiliateDisplayOffer[];
  excluded: CatalogueExcludedOffer[];
  best_price_offer_id: string | null;
  same_capture_window: boolean;
  savings: Savings | null;
  /** Distinct disclosure texts for links that rendered (show before the first link). */
  disclosures: string[];
}

/** S1-10: one category's shortlisted comparisons (see groupComparisonsByCategory). */
export interface CategoryComparisonGroup {
  category: ProductCategory;
  category_label: string;
  /** Gated, sorted by display_rank (ties/unranked in source order), capped at perCategory. */
  comparisons: CatalogueComparison[];
}
