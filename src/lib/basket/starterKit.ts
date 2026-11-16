/**
 * S1-12 basket 1: Kieran's 17-item Emergency starter kit (src/data/starter-kit/starterKit.json).
 * Self-contained: its own schema and data, no dependency on the catalogue files. Each item carries
 * its verification and buyability evidence; items that failed are listed under `gaps`, not items.
 * availability_text_seen / delivery_quote_seen are an audit trail and must never be rendered.
 */
import { z } from 'zod';
import raw from '../../data/starter-kit/starterKit.json';
import type { BuildEnv } from '../offers/types';
import { basketLink, type BasketLink } from './cartUrl';
import { BASKET_EXCLUDED_ASINS } from './exclusions';

const asin = z.string().regex(/^[A-Z0-9]{10}$/);
const nonEmpty = z.string().trim().min(1);

const buyabilitySchema = z
  .object({
    checked_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    featured_offer: z.literal(true),
    in_stock: z.literal(true),
    add_to_basket: z.literal(true),
    seller_name: nonEmpty,
    ships_from: nonEmpty,
    seller_class: z.enum(['amazon', 'uk_third_party']),
    seller_rating_note: nonEmpty,
    availability_text_seen: nonEmpty,
    delivery_quote_seen: nonEmpty,
    delivery_reasonable: z.literal(true),
    outcome: z.literal('pass'),
    reason: z.null(),
  })
  .strict();

const itemSchema = z
  .object({
    position: z.number().int().min(1).max(17),
    item: nonEmpty,
    asin,
    brand: nonEmpty,
    model: nonEmpty,
    display_name: nonEmpty,
    product_name: nonEmpty,
    source: z.enum(['s1-10b_verified_pick', 's1-12_research']),
    source_pick: z.string().nullable(),
    image_url: z.null(),
    image_width: z.null(),
    image_height: z.null(),
    image_source: z.null(),
    verification: z.literal('verified'),
    verification_evidence: z
      .object({
        source_url: z.string().startsWith('https://www.amazon.co.uk/dp/'),
        checked_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        canonical_asin: asin,
        checks_matched: z.array(nonEmpty).min(1),
        note: z.string().nullable(),
      })
      .strict(),
    buyability: buyabilitySchema,
  })
  .strict()
  .superRefine((it, ctx) => {
    if (it.verification_evidence.canonical_asin !== it.asin) ctx.addIssue({ code: 'custom', message: `${it.asin}: canonical ASIN differs` });
    if (it.verification_evidence.source_url !== `https://www.amazon.co.uk/dp/${it.asin}`) ctx.addIssue({ code: 'custom', message: `${it.asin}: source_url is not its own page` });
    if (/EVAQ8/i.test(`${it.brand} ${it.display_name} ${it.product_name}`)) ctx.addIssue({ code: 'custom', message: `${it.asin}: EVAQ8 is excluded` });
    if (/\b(baby|infant|toddler|newborn)\b/i.test(`${it.display_name} ${it.product_name}`)) ctx.addIssue({ code: 'custom', message: `${it.asin}: infant products are excluded` });
  });

const gapSchema = z
  .object({ position: z.number().int().min(1).max(17), item: nonEmpty, reason: nonEmpty, candidates_checked: z.array(asin) })
  .strict();

export const starterKitFileSchema = z
  .object({
    schema_version: z.literal(1),
    basket_id: z.literal('emergency-starter-kit'),
    title: nonEmpty,
    list_owner: nonEmpty,
    rules: z.object({ buyability: nonEmpty, availability_text: nonEmpty, no_prices_or_images: z.literal(true) }).strict(),
    items: z.array(itemSchema),
    gaps: z.array(gapSchema),
  })
  .strict()
  .superRefine((f, ctx) => {
    const positions = [...f.items.map((i) => i.position), ...f.gaps.map((g) => g.position)].sort((a, b) => a - b);
    if (positions.length !== 17 || positions.some((p, i) => p !== i + 1)) ctx.addIssue({ code: 'custom', message: 'items + gaps must cover positions 1..17 exactly once' });
    const asins = f.items.map((i) => i.asin);
    if (new Set(asins).size !== asins.length) ctx.addIssue({ code: 'custom', message: 'duplicate ASIN in starter kit' });
    for (const a of asins) if (BASKET_EXCLUDED_ASINS.includes(a)) ctx.addIssue({ code: 'custom', message: `${a} is excluded (s1-10c)` });
  });

export type StarterKitFile = z.infer<typeof starterKitFileSchema>;
export type StarterKitItem = StarterKitFile['items'][number];

export function parseStarterKitFile(input: unknown): StarterKitFile {
  return starterKitFileSchema.parse(input);
}

export const STARTER_KIT: StarterKitFile = parseStarterKitFile(raw);

/** Items in Kieran's list order (gaps skipped). */
export function starterKitItems(kit: StarterKitFile = STARTER_KIT): StarterKitItem[] {
  return [...kit.items].sort((a, b) => a.position - b.position);
}

export function starterKitAsins(kit: StarterKitFile = STARTER_KIT): string[] {
  return starterKitItems(kit).map((i) => i.asin);
}

/** Basket link for the starter kit, or null outside a production link build. */
export function starterKitBasketLink(env: BuildEnv, kit: StarterKitFile = STARTER_KIT): BasketLink | null {
  return basketLink(starterKitAsins(kit), env);
}
