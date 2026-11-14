import { z } from 'zod';
import { OFFER_SCHEMA_VERSION } from './types';
import type { KitVariant, Offer, OffersFile, VariantsFile } from './types';
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

export const kitVariantSchema = z.object({
  schema_version: z.literal(OFFER_SCHEMA_VERSION),
  variant_id: z.string().min(1),
  kit_id: z.string().min(1),
  brand: z.string().min(1),
  manufacturer: z.string().min(1),
  product_name: z.string().min(1),
  model_code: z.string().min(1),
  mpn: z.string().min(1).nullable(),
  gtin: z.string().regex(/^\d{8,14}$/).nullable(),
  people_covered: z.number().int().positive(),
  days: z.number().int().positive(),
  format: z.enum(['rucksack', 'holdall', 'box', 'other']),
  weight_kg: z.number().positive().nullable(),
  contents: z.array(z.object({ quantity: z.number().int().positive().nullable(), item: z.string().min(1) })).min(1),
  contents_captured_at: londonIso,
  water_litres_included: z.number().nonnegative(),
  source: sourceRef,
  notes: z.array(z.string()),
});

export const offerSchema = z
  .object({
    schema_version: z.literal(OFFER_SCHEMA_VERSION),
    offer_id: z.string().min(1),
    variant_id: z.string().min(1),
    kit_id: z.string().min(1),
    retailer: z.string().min(1),
    seller_name: z.string().nullable(),
    fulfilled_by: z.string().nullable(),
    retailer_sku: z.string().nullable(),
    asin: z.string().regex(/^[A-Z0-9]{10}$/).nullable(),
    mpn: z.string().nullable(),
    gtin: z.string().regex(/^\d{8,14}$/).nullable(),
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
    internal: z.object({
      commission_rate: z.number().min(0).max(1).nullable(),
      commission_rate_source: z.string().nullable(),
    }),
  })
  .superRefine((o, ctx) => {
    if (o.affiliate_url !== '' && o.affiliate_programme === null) {
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
    schema_version: z.literal(OFFER_SCHEMA_VERSION),
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
    schema_version: z.literal(OFFER_SCHEMA_VERSION),
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

export function parseVariantsFile(raw: unknown): VariantsFile {
  return variantsFileSchema.parse(raw) as VariantsFile;
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

export function parseVariant(raw: unknown): KitVariant {
  return kitVariantSchema.parse(raw) as KitVariant;
}
