import { z } from 'zod';
import { PRODUCT_CATEGORIES } from './types';
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
const gtin = z.string().regex(/^\d{8,14}$/);

export const kitVariantSchema = z.object({
  schema_version: schemaVersion,
  category: z.literal('kit').optional(),
  asin_uk: asin.nullable().optional(),
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
    category: z.enum(PRODUCT_CATEGORIES as [string, ...string[]]).optional(),
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
        if (o.asin === null) ctx.addIssue({ code: 'custom', path: ['asin'], message: 'Amazon UK rows need an ASIN' });
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

/** Amazon UK offer (by marketplace or retailer name). */
export function isAmazonOffer(o: Pick<Offer, 'retailer' | 'asin_marketplace'>): boolean {
  return o.asin_marketplace === 'amazon.co.uk' || o.retailer === 'Amazon UK';
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

/* ---------- S1-8: catalogue products ---------- */

const sourced = <T extends z.ZodType>(value: T) =>
  z.object({ value, source: sourceRef, captured_at: londonIso }).strict();
const pos = z.number().positive();
const posInt = z.number().int().positive();

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
  wind_up_torch_radio: z
    .object({
      device_type: sourced(z.enum(['torch', 'radio', 'torch_radio'])),
      power_sources: sourced(z.array(z.enum(['wind_up', 'dynamo', 'solar', 'usb', 'aa', 'aaa', 'built_in_battery'])).min(1)),
      lumens: sourced(pos),
      radio_bands: sourced(z.array(z.enum(['AM', 'FM', 'DAB', 'LW'])).min(1)),
      usb_output: sourced(z.boolean()),
      battery_mah: sourced(pos),
    })
    .partial()
    .strict(),
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
} as const;

const productBase = {
  schema_version: z.literal(2),
  variant_id: z.string().min(1),
  product_name: z.string().min(1),
  brand: z.string().min(1),
  asin_uk: asin.nullable(),
  gtin: gtin.nullable(),
  mpn: z.string().min(1).nullable(),
  model_code: z.string().min(1).nullable(),
  pack_quantity: posInt.nullable(),
  source: sourceRef,
  captured_at: londonIso,
  verification: z.enum(['unverified', 'verified']),
  notes: z.array(z.string()),
};

export const catalogueProductSchema = z
  .discriminatedUnion('category', [
    z.object({ ...productBase, category: z.literal('emergency_water'), specs: specsByCategory.emergency_water }).strict(),
    z.object({ ...productBase, category: z.literal('first_aid_kit'), specs: specsByCategory.first_aid_kit }).strict(),
    z.object({ ...productBase, category: z.literal('wind_up_torch_radio'), specs: specsByCategory.wind_up_torch_radio }).strict(),
    z.object({ ...productBase, category: z.literal('power_bank'), specs: specsByCategory.power_bank }).strict(),
    z.object({ ...productBase, category: z.literal('emergency_blanket'), specs: specsByCategory.emergency_blanket }).strict(),
    z.object({ ...productBase, category: z.literal('thermal_clothing'), specs: specsByCategory.thermal_clothing }).strict(),
  ])
  .superRefine((p, ctx) => {
    if (p.asin_uk === null && p.gtin === null) {
      ctx.addIssue({ code: 'custom', path: ['asin_uk'], message: 'a catalogue product needs an exact identity: asin_uk or gtin' });
    }
  });

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

export function parseCatalogueProduct(raw: unknown): CatalogueProduct {
  return catalogueProductSchema.parse(raw) as CatalogueProduct;
}

export function parseCatalogueProductsFile(raw: unknown): CatalogueProductsFile {
  return catalogueProductsFileSchema.parse(raw) as CatalogueProductsFile;
}

export function parseAffiliateProgramme(raw: unknown): AffiliateProgrammeRecord {
  return affiliateProgrammeSchema.parse(raw) as AffiliateProgrammeRecord;
}

export function parseAffiliateProgrammesFile(raw: unknown): AffiliateProgrammesFile {
  return affiliateProgrammesFileSchema.parse(raw) as AffiliateProgrammesFile;
}

/**
 * Cross-file checks: every referenced programme exists, and a stored affiliate_url
 * only exists on an approved stored_exact_url programme.
 */
export function assertCatalogueReferences(offers: Offer[], programmes: AffiliateProgrammeRecord[]): void {
  const byId = new Map(programmes.map((p) => [p.programme_id, p]));
  for (const o of offers) {
    if (!o.affiliate_programme_id) continue;
    const p = byId.get(o.affiliate_programme_id);
    if (!p) throw new Error(`Offer ${o.offer_id}: unknown affiliate_programme_id ${o.affiliate_programme_id}`);
    if (o.affiliate_url !== '' && (p.status !== 'approved' || p.link_mode !== 'stored_exact_url')) {
      throw new Error(`Offer ${o.offer_id}: affiliate_url stored but programme ${p.programme_id} is ${p.status}/${p.link_mode}`);
    }
  }
}
