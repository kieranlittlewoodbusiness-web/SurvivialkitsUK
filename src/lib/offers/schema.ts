import { z } from 'zod';
import { LEGACY_CATEGORY_WIND_UP_TORCH_RADIO, PRODUCT_CATEGORIES, VERIFICATION_CHECKS } from './types';
import type {
  AffiliateProgrammeRecord,
  AffiliateProgrammesFile,
  CatalogueProduct,
  CatalogueProductsFile,
  KitVariant,
  Offer,
  OffersFile,
  VariantsFile,
} from './types';
import { isLondonIso, londonDateKey } from './time';

const londonIso = z
  .string()
  .refine(isLondonIso, { message: 'Must be ISO 8601 with the Europe/London offset, e.g. 2026-11-14T23:17:00+00:00' });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const httpUrl = z.string().refine((v) => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}, { message: 'Must be an absolute http(s) URL' });
const httpsUrl = z.string().refine((v) => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}, { message: 'Must be an absolute https URL' });
const gbp = z.number().nonnegative(); // zod 4 numbers are finite by default
const sourceRef = z.object({ name: z.string().min(1), url: httpUrl });
/** v1 (S1-1) and v2 (S1-8) rows are both accepted. */
const schemaVersion = z.union([z.literal(1), z.literal(2)]);
/** Real ASIN shape only: placeholders such as "ASIN_TBD" are rejected. */
export const ASIN_PATTERN = /^[A-Z0-9]{10}$/;
const asin = z.string().regex(ASIN_PATTERN, { message: 'ASIN must be 10 upper-case letters/digits (placeholders are rejected)' });
/** GS1 mod-10 check digit over GTIN-8/12/13/14. All-zero codes are rejected. */
export function isValidGtin(v: string): boolean {
  if (!/^\d+$/.test(v) || ![8, 12, 13, 14].includes(v.length) || /^0+$/.test(v)) return false;
  const digits = [...v].map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}
const gtin = z.string().refine(isValidGtin, { message: 'GTIN must be 8, 12, 13 or 14 digits with a valid GS1 check digit' });

/* ---------- S1-8b: verification evidence ---------- */

const AMAZON_UK_DP_URL = /^https:\/\/www\.amazon\.co\.uk\/dp\/([A-Z0-9]{10})$/;

export const verificationEvidenceSchema = z
  .object({
    method: z.literal('public_listing'),
    /** Tagless https://www.amazon.co.uk/dp/{ASIN}: no query string, no fragment. */
    source_url: z.string().regex(AMAZON_UK_DP_URL, { message: 'source_url must be exactly https://www.amazon.co.uk/dp/{ASIN} (no query string or tag)' }),
    checked_on: isoDate,
    outcome: z.enum(['verified', 'not_verified', 'not_run']),
    checks_matched: z.array(z.enum(VERIFICATION_CHECKS)),
    note: z.string().min(1),
  })
  .strict();

/** Categories sold in sizes: a verified record names one exact size (S1-8b thermals; S1-10 hi-vis). */
export const SIZED_CATEGORIES: readonly string[] = ['thermal_clothing', 'hi_vis'];

/** Required checks for a 'verified' record (sized categories also need 'size'). */
export function requiredVerificationChecks(category: string): readonly string[] {
  const base = ['title', 'brand', 'model', 'pack_contents'];
  return SIZED_CATEGORIES.includes(category) ? [...base, 'size'] : base;
}

/** Shared rule: verified <=> evidence outcome 'verified', with every required check and a matching tagless ASIN URL. */
function refineVerification(
  p: { verification?: 'unverified' | 'verified'; verification_evidence?: z.infer<typeof verificationEvidenceSchema>; asin_uk?: string | null; category?: string },
  ctx: z.RefinementCtx,
): void {
  const verified = p.verification === 'verified';
  const ev = p.verification_evidence;
  if (verified && !ev) {
    ctx.addIssue({ code: 'custom', path: ['verification_evidence'], message: 'verified products need verification_evidence' });
    return;
  }
  if (!ev) return;
  if ((ev.outcome === 'verified') !== verified) {
    ctx.addIssue({ code: 'custom', path: ['verification_evidence', 'outcome'], message: "outcome must be 'verified' exactly when verification is 'verified'" });
  }
  if (verified) {
    for (const c of requiredVerificationChecks(p.category ?? 'kit')) {
      if (!ev.checks_matched.includes(c as (typeof VERIFICATION_CHECKS)[number])) {
        ctx.addIssue({ code: 'custom', path: ['verification_evidence', 'checks_matched'], message: `verified needs check '${c}'` });
      }
    }
    const urlAsin = AMAZON_UK_DP_URL.exec(ev.source_url)?.[1];
    if (!p.asin_uk || urlAsin !== p.asin_uk) {
      ctx.addIssue({ code: 'custom', path: ['verification_evidence', 'source_url'], message: 'verified source_url must be the listing for this record\'s asin_uk' });
    }
  }
}

export const kitVariantSchema = z.object({
  schema_version: schemaVersion,
  category: z.literal('kit').optional(),
  asin_uk: asin.nullable().optional(),
  /** S1-8: absent = 'unverified'. Only verified products may carry affiliate links. */
  verification: z.enum(['unverified', 'verified']).optional(),
  verification_evidence: verificationEvidenceSchema.optional(),
  variant_id: z.string().min(1),
  kit_id: z.string().min(1),
  brand: z.string().min(1),
  manufacturer: z.string().min(1),
  product_name: z.string().min(1),
  model_code: z.string().min(1),
  mpn: z.string().min(1).nullable(),
  gtin: gtin.nullable(),
  people_covered: z.number().int().positive(),
  days: z.number().int().positive(),
  format: z.enum(['rucksack', 'holdall', 'box', 'other']),
  weight_kg: z.number().positive().nullable(),
  contents: z.array(z.object({ quantity: z.number().int().positive().nullable(), item: z.string().min(1) })).min(1),
  contents_captured_at: londonIso,
  water_litres_included: z.number().nonnegative(),
  source: sourceRef,
  notes: z.array(z.string()),
}).superRefine((k, ctx) => refineVerification({ ...k, category: 'kit' }, ctx));

export const offerSchema = z
  .object({
    schema_version: schemaVersion,
    offer_id: z.string().min(1),
    variant_id: z.string().min(1),
    kit_id: z.string().min(1),
    retailer: z.string().min(1),
    seller_name: z.string().nullable(),
    fulfilled_by: z.string().nullable(),
    retailer_sku: z.string().nullable(),
    asin: asin.nullable(),
    mpn: z.string().nullable(),
    gtin: gtin.nullable(),
    model_match_confirmed: z.boolean(),
    model_match_note: z.string().min(1),
    currency: z.literal('GBP'),
    price_gbp_inc_vat: gbp.nullable(),
    price_gbp_ex_vat: gbp.nullable(),
    vat_status_note: z.string().nullable(),
    price_verified: z.boolean(),
    delivery_cost_gbp: gbp.nullable(),
    free_delivery_threshold_gbp: gbp.nullable(),
    delivery_text_verbatim: z.string().nullable(),
    delivery_lead_time_text: z.string().nullable(),
    delivery_verified: z.boolean(),
    availability_text: z.string().nullable(),
    was_price_gbp: gbp.nullable(),
    was_price_source: z.string().nullable(),
    product_url: httpUrl,
    /** '' until approval, else an exact https URL. */
    affiliate_url: z.union([z.literal(''), httpsUrl]),
    affiliate_programme: z.object({ name: z.string().min(1), approved_on: isoDate }).nullable(),
    affiliate_disclosure_required: z.boolean(),
    source: sourceRef.extend({ type: z.enum(['retailer_page_manual', 'affiliate_feed', 'retailer_api']) }),
    captured_at: londonIso,
    last_checked: londonIso,
    next_check_due: londonIso,
    captured_by: z.string().min(1),
    screenshot_path: z.string().nullable(),
    // S1-10: the pre-split slug still parses; offer.category is informational only (never used for
    // matching or grouping), and every legacy row in the repo was a wind-up radio, so it maps to 'radio'.
    category: z
      .enum([...PRODUCT_CATEGORIES, LEGACY_CATEGORY_WIND_UP_TORCH_RADIO] as string[] as [string, ...string[]])
      .transform((c) => (c === LEGACY_CATEGORY_WIND_UP_TORCH_RADIO ? 'radio' : c))
      .optional(),
    asin_marketplace: z.literal('amazon.co.uk').nullable().optional(),
    affiliate_programme_id: z.string().min(1).nullable().optional(),
    price_origin: z.enum(['none', 'manual_capture', 'amazon_product_api', 'affiliate_feed']).optional(),
    internal: z.object({
      commission_rate: z.number().min(0).max(1).nullable(),
      commission_rate_source: z.string().nullable(),
    }),
  })
  .superRefine((o, ctx) => {
    if (o.schema_version === 2) {
      // S1-8 rules apply to v2 rows only, so v1 (S1-1) data keeps parsing.
      if (o.affiliate_programme !== null) {
        ctx.addIssue({ code: 'custom', path: ['affiliate_programme'], message: 'v2 rows reference a programme with affiliate_programme_id, not affiliate_programme' });
      }
      if (o.affiliate_url !== '' && !o.affiliate_programme_id) {
        ctx.addIssue({ code: 'custom', path: ['affiliate_url'], message: 'affiliate_url requires affiliate_programme_id' });
      }
      if (o.price_origin === undefined) {
        ctx.addIssue({ code: 'custom', path: ['price_origin'], message: 'v2 rows must state price_origin' });
      }
      if (o.price_gbp_inc_vat !== null && o.price_origin === 'none') {
        ctx.addIssue({ code: 'custom', path: ['price_origin'], message: "a price requires price_origin other than 'none'" });
      }
      if (isAmazonOffer(o)) {
        // Detected by marketplace, ASIN, amazon.co.uk host or retailer name; every Amazon rule applies.
        if (o.asin === null) ctx.addIssue({ code: 'custom', path: ['asin'], message: 'Amazon UK rows need an ASIN' });
        if (hasNonUkAmazonUrl(o)) {
          ctx.addIssue({ code: 'custom', path: ['product_url'], message: 'Only amazon.co.uk listings are supported: no other Amazon marketplaces or short links (use https://www.amazon.co.uk/dp/{ASIN})' });
        }
        if (o.asin_marketplace !== 'amazon.co.uk') ctx.addIssue({ code: 'custom', path: ['asin_marketplace'], message: "Amazon UK rows need asin_marketplace 'amazon.co.uk'" });
        if (o.affiliate_url !== '') ctx.addIssue({ code: 'custom', path: ['affiliate_url'], message: 'Amazon links are derived at build time; affiliate_url must be empty' });
        if (o.price_gbp_inc_vat !== null && o.price_origin !== 'amazon_product_api') {
          ctx.addIssue({ code: 'custom', path: ['price_gbp_inc_vat'], message: 'Amazon prices are allowed only from the Amazon product API' });
        }
      }
    }
    if (o.schema_version === 1 && o.affiliate_url !== '' && o.affiliate_programme === null) {
      ctx.addIssue({ code: 'custom', path: ['affiliate_url'], message: 'affiliate_url must be empty until affiliate_programme (name + approved_on) is recorded' });
    }
    if (o.price_verified && o.price_gbp_inc_vat === null) {
      ctx.addIssue({ code: 'custom', path: ['price_verified'], message: 'price_verified requires price_gbp_inc_vat' });
    }
    if (o.delivery_verified && o.delivery_cost_gbp === null) {
      ctx.addIssue({ code: 'custom', path: ['delivery_verified'], message: 'delivery_verified requires delivery_cost_gbp' });
    }
    if (o.was_price_gbp !== null && !o.was_price_source) {
      ctx.addIssue({ code: 'custom', path: ['was_price_source'], message: 'was_price_gbp requires a verifiable was_price_source' });
    }
    if (o.internal.commission_rate !== null && !o.internal.commission_rate_source) {
      ctx.addIssue({ code: 'custom', path: ['internal', 'commission_rate_source'], message: 'commission_rate requires its source document' });
    }
    if (o.affiliate_programme && o.affiliate_programme.approved_on > londonDateKey(o.captured_at)) {
      ctx.addIssue({ code: 'custom', path: ['affiliate_programme', 'approved_on'], message: 'approved_on cannot be later than captured_at (no future approvals)' });
    }
    if (Date.parse(o.captured_at) > Date.parse(o.last_checked)) {
      ctx.addIssue({ code: 'custom', path: ['captured_at'], message: 'captured_at cannot be later than last_checked' });
    }
    if (Date.parse(o.next_check_due) <= Date.parse(o.last_checked)) {
      ctx.addIssue({ code: 'custom', path: ['next_check_due'], message: 'next_check_due must be after last_checked' });
    }
  });

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

/** amazon.co.uk or any subdomain (the only marketplace we support). */
export function isAmazonUkHost(url: string | null | undefined): boolean {
  const h = hostOf(url);
  return h !== null && (h === 'amazon.co.uk' || h.endsWith('.amazon.co.uk'));
}

/**
 * Any Amazon host: amazon.<tld> including two-part TLDs (amazon.com, amazon.de,
 * amazon.co.uk, amazon.co.jp, amazon.com.au, ...), Amazon short links (amzn.to,
 * amzn.eu, amzn.asia, a.co), and their subdomains.
 */
const AMAZON_HOST_PATTERN = /(^|\.)(amazon\.((com|co)\.[a-z]{2}|[a-z]{2,3})|amzn\.(to|eu|asia)|a\.co)$/;
export function isAmazonHost(url: string | null | undefined): boolean {
  const h = hostOf(url);
  return h !== null && AMAZON_HOST_PATTERN.test(h);
}

/** True when the row points at an Amazon host that is not amazon.co.uk (other marketplace or short link). */
export function hasNonUkAmazonUrl(o: { product_url?: string | null; source?: { url?: string | null } | null }): boolean {
  return [o.product_url, o.source?.url].some((u) => isAmazonHost(u) && !isAmazonUkHost(u));
}

export function isAmazonOffer(
  o: Pick<Offer, 'retailer' | 'asin_marketplace'> & {
    asin?: string | null;
    product_url?: string | null;
    source?: { url?: string | null } | null;
  },
): boolean {
  return (
    o.asin_marketplace === 'amazon.co.uk' ||
    (o.asin !== undefined && o.asin !== null) ||
    isAmazonHost(o.product_url) ||
    isAmazonHost(o.source?.url) ||
    /amazon/i.test(o.retailer ?? '')
  );
}

function duplicates(values: (string | null)[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) {
    if (v === null) continue;
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  return [...dupes];
}

export const offersFileSchema = z
  .object({
    schema_version: schemaVersion,
    status: z.enum(['unverified-seed', 'verified']),
    data_source_needed: z.array(z.string()),
    offers: z.array(offerSchema),
  })
  .superRefine((f, ctx) => {
    for (const id of duplicates(f.offers.map((o) => o.offer_id))) {
      ctx.addIssue({ code: 'custom', path: ['offers'], message: `Duplicate offer_id: ${id}` });
    }
  });

export const variantsFileSchema = z
  .object({
    schema_version: schemaVersion,
    variants: z.array(kitVariantSchema),
  })
  .superRefine((f, ctx) => {
    for (const [field, values] of [
      ['variant_id', f.variants.map((v) => v.variant_id)],
      ['model_code', f.variants.map((v) => v.model_code)],
      ['gtin', f.variants.map((v) => v.gtin)],
    ] as const) {
      for (const d of duplicates([...values])) {
        ctx.addIssue({ code: 'custom', path: ['variants'], message: `Duplicate ${field}: ${d}` });
      }
    }
  });

export interface ParseOptions {
  /** Clock used to reject future-dated captures. Defaults to the current time. */
  now?: Date | string | number;
  /** Tolerated clock skew in ms. Default 5 minutes. */
  futureSkewMs?: number;
}

function assertNotFuture(offers: Offer[], options: ParseOptions): void {
  const now = options.now === undefined ? Date.now() : new Date(options.now).getTime();
  if (Number.isNaN(now)) throw new RangeError('Invalid `now`');
  const limit = now + (options.futureSkewMs ?? 5 * 60_000);
  for (const o of offers) {
    for (const field of ['captured_at', 'last_checked'] as const) {
      if (Date.parse(o[field]) > limit) {
        throw new Error(`Offer ${o.offer_id}: ${field} ${o[field]} is in the future`);
      }
    }
  }
}

/**
 * S1-8b L1: verification_evidence.checked_on may not be later than today (Europe/London)
 * per `options.now` (defaults to the current time).
 */
function assertEvidenceNotFuture(records: { variant_id: string; verification_evidence?: { checked_on: string } }[], options: ParseOptions): void {
  const now = options.now === undefined ? Date.now() : new Date(options.now).getTime();
  if (Number.isNaN(now)) throw new RangeError('Invalid `now`');
  const today = londonDateKey(now);
  for (const r of records) {
    const d = r.verification_evidence?.checked_on;
    if (d !== undefined && d > today) {
      throw new Error(`${r.variant_id}: verification_evidence.checked_on ${d} is in the future (today is ${today}, Europe/London)`);
    }
  }
}

export function parseVariantsFile(raw: unknown, options: ParseOptions = {}): VariantsFile {
  const file = variantsFileSchema.parse(raw) as VariantsFile;
  assertEvidenceNotFuture(file.variants, options);
  return file;
}

/** Validates the file and rejects captured_at/last_checked later than `now`. */
export function parseOffersFile(raw: unknown, options: ParseOptions = {}): OffersFile {
  const file = offersFileSchema.parse(raw) as OffersFile;
  assertNotFuture(file.offers, options);
  return file;
}

/** Validates one offer and rejects captured_at/last_checked later than `now`. */
export function parseOffer(raw: unknown, options: ParseOptions = {}): Offer {
  const offer = offerSchema.parse(raw) as Offer;
  assertNotFuture([offer], options);
  return offer;
}

export function parseVariant(raw: unknown, options: ParseOptions = {}): KitVariant {
  const v = kitVariantSchema.parse(raw) as KitVariant;
  assertEvidenceNotFuture([v], options);
  return v;
}

/* ---------- S1-8: catalogue products ---------- */

const sourced = <T extends z.ZodType>(value: T) =>
  z.object({ value, source: sourceRef, captured_at: londonIso }).strict();
const pos = z.number().positive();
const posInt = z.number().int().positive();

const torchRadioSpecs = z
  .object({
    device_type: sourced(z.enum(['torch', 'radio', 'torch_radio'])),
    power_sources: sourced(z.array(z.enum(['wind_up', 'dynamo', 'solar', 'usb', 'aa', 'aaa', 'built_in_battery'])).min(1)),
    lumens: sourced(pos),
    radio_bands: sourced(z.array(z.enum(['AM', 'FM', 'DAB', 'LW'])).min(1)),
    usb_output: sourced(z.boolean()),
    battery_mah: sourced(pos),
  })
  .partial()
  .strict();

const specsByCategory = {
  emergency_water: z
    .object({
      pack_format: sourced(z.enum(['can', 'carton', 'pouch', 'bottle'])),
      unit_volume_ml: sourced(pos),
      units_per_pack: sourced(posInt),
      total_litres: sourced(pos),
      shelf_life_years: sourced(pos),
    })
    .partial()
    .strict(),
  first_aid_kit: z
    .object({
      item_count: sourced(posInt),
      standard: sourced(z.string().min(1)),
      kit_size_label: sourced(z.string().min(1)),
    })
    .partial()
    .strict(),
  torch: torchRadioSpecs,
  radio: torchRadioSpecs,
  power_bank: z
    .object({
      capacity_mah: sourced(pos),
      capacity_wh: sourced(pos),
      max_output_w: sourced(pos),
      ports: sourced(z.array(z.string().min(1)).min(1)),
    })
    .partial()
    .strict(),
  emergency_blanket: z
    .object({
      material: sourced(z.string().min(1)),
      size_cm: sourced(z.object({ w: pos, h: pos }).strict()),
      pack_count: sourced(posInt),
      reusable: sourced(z.boolean()),
    })
    .partial()
    .strict(),
  thermal_clothing: z
    .object({
      garment_type: sourced(z.enum(['base_layer_top', 'base_layer_bottom', 'set', 'socks', 'hat', 'gloves', 'other'])),
      material: sourced(z.string().min(1)),
      size_label: sourced(z.string().min(1)),
      pack_count: sourced(posInt),
    })
    .partial()
    .strict(),
  batteries: z
    .object({
      size: sourced(z.enum(['AA', 'AAA', 'C', 'D', '9V', 'CR2032', 'other'])),
      chemistry: sourced(z.enum(['alkaline', 'lithium', 'nimh', 'zinc_carbon', 'other'])),
      pack_count: sourced(posInt),
    })
    .partial()
    .strict(),
  hi_vis: z
    .object({
      standard: sourced(z.string().min(1)),
      size_label: sourced(z.string().min(1)),
      pack_count: sourced(posInt),
    })
    .partial()
    .strict(),
  jump_leads: z
    .object({
      length_m: sourced(pos),
      max_current_a: sourced(pos),
      cable_gauge_mm2: sourced(pos),
    })
    .partial()
    .strict(),
  warning_triangle: z
    .object({
      e_marked: sourced(z.boolean()),
      ece_r27: sourced(z.boolean()),
      pack_count: sourced(posInt),
    })
    .partial()
    .strict(),
} as const;

/* ---------- S1-10: display_name and image rules ---------- */

export const DISPLAY_NAME_MAX_LENGTH = 60;
/** Standards codes (BS 8599, EN 471, ISO 20471, ...). Same pattern Web's card-text test bans. */
export const STANDARDS_CODE_PATTERN = /\bBS\s?\d|\bEN\s?\d|ISO\s?\d/i;
/** Measurements are fine in a display name: "20,000mAh", "500ml", "3.5m", "400A", "12V", "2x". */
const MEASUREMENT_TOKEN = /^\d+(?:[.,]\d+)*(?:mAh|Ah|Wh|W|kW|V|ml|cl|L|m|cm|mm|mm²|kg|g|lm|A|x)$/i;
/** Counts written with a hyphen: "2-pack", "4-piece", "2-person". */
const COUNT_TOKEN = /^\d+-(?:pack|piece|person|litre|metre|year)s?$/i;

export interface DisplayNameIdentity {
  brand?: string | null;
  model_code?: string | null;
  mpn?: string | null;
  manufacturer_sku?: string | null;
  listing_mpn?: string | null;
}

const stripPunct = (t: string) => t.replace(/^[("'\[]+|[)"'\],.;:!?]+$/g, '');

/**
 * S1-10: problems with a display_name ([] = valid). Rejects standards codes, model / part / SKU-like
 * tokens (letters mixed with digits such as PB312 or ESFH21, long bare digit runs, and any
 * digit-bearing token of the record's own model_code / mpn / manufacturer_sku / listing_mpn),
 * ALL-CAPS keyword stuffing (brand words excepted), pipes, and names over DISPLAY_NAME_MAX_LENGTH.
 */
export function validateDisplayName(name: string, identity: DisplayNameIdentity = {}): string[] {
  const issues: string[] = [];
  if (name.trim() !== name || name.length === 0) issues.push('display_name must be non-empty with no leading/trailing spaces');
  if (name.length > DISPLAY_NAME_MAX_LENGTH) issues.push(`display_name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`);
  if (STANDARDS_CODE_PATTERN.test(name)) issues.push('display_name must not contain standards codes (BS / EN / ISO numbers)');
  if (/[|®™]/.test(name)) issues.push('display_name must not contain listing separators or trademark symbols');
  const tokens = name.split(/\s+/).map(stripPunct).filter(Boolean);
  for (const t of tokens) {
    if (/[A-Za-z]/.test(t) && /\d/.test(t) && !MEASUREMENT_TOKEN.test(t) && !COUNT_TOKEN.test(t)) {
      issues.push(`display_name must not contain model/part-number-like token "${t}"`);
    } else if (/^\d{5,}$/.test(t)) {
      issues.push(`display_name must not contain SKU-like number "${t}"`);
    }
  }
  const lower = name.toLowerCase();
  const own = [identity.model_code, identity.mpn, identity.manufacturer_sku, identity.listing_mpn]
    .flatMap((v) => (v ? v.split(/[\s,;/]+/) : []))
    .map(stripPunct)
    .filter((t) => t.length >= 3 && /\d/.test(t));
  for (const t of new Set(own)) {
    if (lower.includes(t.toLowerCase())) issues.push(`display_name must not contain the product's own model/part number "${t}"`);
  }
  const brandWords = new Set((identity.brand ?? '').split(/\s+/).map((w) => stripPunct(w).toUpperCase()).filter(Boolean));
  const letters = name.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 4 && letters === letters.toUpperCase()) {
    issues.push('display_name must not be written in capitals');
  } else {
    const caps = tokens.filter((t) => {
      const l = t.replace(/[^A-Za-z]/g, '');
      return l.length >= 2 && l === l.toUpperCase() && !brandWords.has(t.toUpperCase());
    });
    if (caps.some((t) => t.replace(/[^A-Za-z]/g, '').length >= 5) || caps.length >= 3) {
      issues.push(`display_name must not use ALL-CAPS keywords (${caps.join(', ')})`);
    }
  }
  return issues;
}

/** S1-10: the only host a product image may come from (Amazon's Creators API, formerly PA-API). */
export const ALLOWED_IMAGE_HOSTS: readonly string[] = ['m.media-amazon.com'];

/** https on an allowed image host, with no credentials, query string or fragment. */
export function isAllowedImageUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return (
    u.protocol === 'https:' &&
    ALLOWED_IMAGE_HOSTS.includes(u.hostname) &&
    u.port === '' &&
    u.username === '' &&
    u.password === '' &&
    u.search === '' &&
    u.hash === ''
  );
}

const imageDimension = z.number().int().positive().nullable().optional();

const productBase = {
  schema_version: z.literal(2),
  variant_id: z.string().min(1),
  product_name: z.string().min(1),
  brand: z.string().min(1),
  asin_uk: asin.nullable(),
  gtin: gtin.nullable(),
  mpn: z.string().min(1).nullable(),
  model_code: z.string().min(1).nullable(),
  /** S1-8b: manufacturer SKU (identity key). */
  manufacturer_sku: z.string().trim().min(1).nullable().optional(),
  /** S1-8b: listing-only part number (not an identity key). */
  listing_mpn: z.string().trim().min(1).nullable().optional(),
  pack_quantity: posInt.nullable(),
  source: sourceRef,
  captured_at: londonIso,
  verification: z.enum(['unverified', 'verified']),
  verification_evidence: verificationEvidenceSchema.optional(),
  /** S1-10: required when verified; rules in validateDisplayName. */
  display_name: z.string().nullable().optional(),
  display_rank: z.number().int().min(1).max(3).nullable().optional(),
  image_url: z.string().nullable().optional(),
  image_width: imageDimension,
  image_height: imageDimension,
  image_source: z.literal('paapi').nullable().optional(),
  notes: z.array(z.string()),
};

/**
 * S1-10: migrates the pre-split 'wind_up_torch_radio' category on parse: a device_type of
 * 'torch' becomes 'torch'; 'radio', 'torch_radio' or no device_type becomes 'radio'.
 */
export function migrateLegacyProductCategory(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || (raw as { category?: unknown }).category !== LEGACY_CATEGORY_WIND_UP_TORCH_RADIO) return raw;
  const device = (raw as { specs?: { device_type?: { value?: unknown } } }).specs?.device_type?.value;
  return { ...(raw as object), category: device === 'torch' ? 'torch' : 'radio' };
}

const catalogueProductUnion = z
  .discriminatedUnion('category', [
    z.object({ ...productBase, category: z.literal('emergency_water'), specs: specsByCategory.emergency_water }).strict(),
    z.object({ ...productBase, category: z.literal('first_aid_kit'), specs: specsByCategory.first_aid_kit }).strict(),
    z.object({ ...productBase, category: z.literal('torch'), specs: specsByCategory.torch }).strict(),
    z.object({ ...productBase, category: z.literal('radio'), specs: specsByCategory.radio }).strict(),
    z.object({ ...productBase, category: z.literal('power_bank'), specs: specsByCategory.power_bank }).strict(),
    z.object({ ...productBase, category: z.literal('emergency_blanket'), specs: specsByCategory.emergency_blanket }).strict(),
    z.object({ ...productBase, category: z.literal('thermal_clothing'), specs: specsByCategory.thermal_clothing }).strict(),
    z.object({ ...productBase, category: z.literal('batteries'), specs: specsByCategory.batteries }).strict(),
    z.object({ ...productBase, category: z.literal('hi_vis'), specs: specsByCategory.hi_vis }).strict(),
    z.object({ ...productBase, category: z.literal('jump_leads'), specs: specsByCategory.jump_leads }).strict(),
    z.object({ ...productBase, category: z.literal('warning_triangle'), specs: specsByCategory.warning_triangle }).strict(),
  ])
  .superRefine((p, ctx) => {
    if (p.asin_uk === null && p.gtin === null) {
      ctx.addIssue({ code: 'custom', path: ['asin_uk'], message: 'a catalogue product needs an exact identity: asin_uk or gtin' });
    }
    if ((p.category === 'thermal_clothing' || p.category === 'hi_vis') && p.verification === 'verified' && !p.specs.size_label) {
      // Prices for different sizes must never be compared: each size needs its own ASIN/GTIN row.
      ctx.addIssue({ code: 'custom', path: ['specs', 'size_label'], message: `verified ${p.category} needs size_label (one exact size per ASIN/GTIN)` });
    }
    if (p.category === 'warning_triangle' && p.verification === 'verified' && p.specs.e_marked?.value !== true && p.specs.ece_r27?.value !== true) {
      ctx.addIssue({ code: 'custom', path: ['specs', 'e_marked'], message: 'a verified warning_triangle needs e_marked or ece_r27 === true from the listing' });
    }
    if (p.listing_mpn && (p.listing_mpn === p.mpn || p.listing_mpn === p.manufacturer_sku || p.listing_mpn === p.model_code)) {
      // A listing-only number must not double as an identity key.
      ctx.addIssue({ code: 'custom', path: ['listing_mpn'], message: 'listing_mpn is listing-only and must not equal mpn, manufacturer_sku or model_code' });
    }
    // S1-10: display_name (required when verified).
    if (p.display_name === undefined || p.display_name === null) {
      if (p.verification === 'verified') ctx.addIssue({ code: 'custom', path: ['display_name'], message: 'verified products need display_name' });
    } else {
      for (const message of validateDisplayName(p.display_name, p)) ctx.addIssue({ code: 'custom', path: ['display_name'], message });
    }
    // S1-10: images come only from Amazon's Creators API (formerly PA-API) on m.media-amazon.com.
    if (p.image_url !== undefined && p.image_url !== null) {
      if (!isAllowedImageUrl(p.image_url)) {
        ctx.addIssue({ code: 'custom', path: ['image_url'], message: `image_url must be https on ${ALLOWED_IMAGE_HOSTS.join(', ')} with no query string or fragment` });
      }
      if (p.image_source !== 'paapi') ctx.addIssue({ code: 'custom', path: ['image_source'], message: "image_url requires image_source 'paapi'" });
    } else {
      for (const k of ['image_source', 'image_width', 'image_height'] as const) {
        if (p[k] !== undefined && p[k] !== null) ctx.addIssue({ code: 'custom', path: [k], message: `${k} must be null when image_url is null` });
      }
    }
    refineVerification(p, ctx);
  });

/** S1-8 catalogue product. S1-10: the legacy 'wind_up_torch_radio' slug is migrated before validation. */
export const catalogueProductSchema = z.preprocess(migrateLegacyProductCategory, catalogueProductUnion);

export const catalogueProductsFileSchema = z
  .object({
    schema_version: z.literal(2),
    status: z.enum(['unverified-seed', 'verified']),
    data_source_needed: z.array(z.string()),
    products: z.array(catalogueProductSchema),
  })
  .superRefine((f, ctx) => {
    for (const [field, values] of [
      ['variant_id', f.products.map((p) => p.variant_id)],
      ['asin_uk', f.products.map((p) => p.asin_uk)],
      ['gtin', f.products.map((p) => p.gtin)],
    ] as const) {
      for (const d of duplicates([...values])) {
        ctx.addIssue({ code: 'custom', path: ['products'], message: `Duplicate ${field}: ${d}` });
      }
    }
  });

/* ---------- S1-8: affiliate programmes ---------- */

export const affiliateProgrammeSchema = z
  .object({
    programme_id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    network: z.enum(['amazon-associates', 'awin', 'webgains', 'direct', 'other']),
    status: z.enum(['pending', 'approved', 'rejected', 'suspended']),
    status_updated_on: isoDate,
    approved_on: isoDate.nullable(),
    /** An env var NAME (upper snake case), never a tag value. */
    tracking_id_env: z.string().regex(/^[A-Z][A-Z0-9_]*$/, { message: 'tracking_id_env must be an env var name, not a value' }).nullable(),
    link_mode: z.enum(['derive_from_asin', 'stored_exact_url']),
    allowed_hosts: z.array(z.string().regex(/^[a-z0-9.-]+$/)).min(1),
    disclosure_text: z.string().min(1),
    price_display: z.enum(['api_only', 'timestamped_capture']),
    max_price_age_hours: z.number().positive(),
    terms_url: httpsUrl,
    notes: z.array(z.string()),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.status === 'approved' && p.approved_on === null) {
      ctx.addIssue({ code: 'custom', path: ['approved_on'], message: 'approved programmes need approved_on' });
    }
    if (p.status !== 'approved' && p.status !== 'suspended' && p.approved_on !== null) {
      ctx.addIssue({ code: 'custom', path: ['approved_on'], message: 'approved_on must be null unless the programme was approved' });
    }
    if (p.approved_on !== null && p.approved_on > p.status_updated_on) {
      ctx.addIssue({ code: 'custom', path: ['approved_on'], message: 'approved_on cannot be after status_updated_on' });
    }
    if (p.link_mode === 'derive_from_asin' && p.tracking_id_env === null) {
      ctx.addIssue({ code: 'custom', path: ['tracking_id_env'], message: 'derive_from_asin needs tracking_id_env' });
    }
  });

export const affiliateProgrammesFileSchema = z
  .object({ schema_version: z.literal(2), programmes: z.array(affiliateProgrammeSchema) })
  .strict()
  .superRefine((f, ctx) => {
    for (const d of duplicates(f.programmes.map((p) => p.programme_id))) {
      ctx.addIssue({ code: 'custom', path: ['programmes'], message: `Duplicate programme_id: ${d}` });
    }
  });

export function parseCatalogueProduct(raw: unknown, options: ParseOptions = {}): CatalogueProduct {
  const p = catalogueProductSchema.parse(raw) as CatalogueProduct;
  assertEvidenceNotFuture([p], options);
  return p;
}

export function parseCatalogueProductsFile(raw: unknown, options: ParseOptions = {}): CatalogueProductsFile {
  const file = catalogueProductsFileSchema.parse(raw) as CatalogueProductsFile;
  assertEvidenceNotFuture(file.products, options);
  return file;
}

export function parseAffiliateProgramme(raw: unknown): AffiliateProgrammeRecord {
  return affiliateProgrammeSchema.parse(raw) as AffiliateProgrammeRecord;
}

export function parseAffiliateProgrammesFile(raw: unknown): AffiliateProgrammesFile {
  return affiliateProgrammesFileSchema.parse(raw) as AffiliateProgrammesFile;
}

/**
 * Cross-file checks: every referenced programme exists, a derive_from_asin (Amazon)
 * programme is referenced only by Amazon offers, and a stored affiliate_url
 * only exists on an approved stored_exact_url programme.
 */
export function assertCatalogueReferences(offers: Offer[], programmes: AffiliateProgrammeRecord[]): void {
  const byId = new Map(programmes.map((p) => [p.programme_id, p]));
  for (const o of offers) {
    if (!o.affiliate_programme_id) continue;
    const p = byId.get(o.affiliate_programme_id);
    if (!p) throw new Error(`Offer ${o.offer_id}: unknown affiliate_programme_id ${o.affiliate_programme_id}`);
    if (p.link_mode === 'derive_from_asin' && !isAmazonOffer(o)) {
      // S1-8b: an ASIN-derived (Amazon) programme can never apply to another retailer's row.
      throw new Error(`Offer ${o.offer_id}: non-Amazon offer references ASIN-derived programme ${p.programme_id}`);
    }
    if (o.affiliate_url !== '' && (p.status !== 'approved' || p.link_mode !== 'stored_exact_url')) {
      throw new Error(`Offer ${o.offer_id}: affiliate_url stored but programme ${p.programme_id} is ${p.status}/${p.link_mode}`);
    }
  }
}
