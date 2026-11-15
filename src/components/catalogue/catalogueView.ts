/**
 * S1-7 view model for Amazon-only product cards. Read-only over src/lib/offers:
 * comparisons come from buildCatalogueComparisons; this file never sorts offers, never picks a
 * best price and never renders a URL other than the contract's affiliate/preview link.
 */
import {
  buildCatalogueComparisons,
  formatLondonDateTime,
  isAmazonOffer,
  isProductVerified,
  type ProductRecord,
  type AffiliateDisplayOffer,
  type CatalogueComparison,
  type ProductCategory,
} from '../../lib/offers';
import { isPreviewBuild } from '../../data/site';
import { previewLinkOf, type DisplayOfferWithPreview } from './previewLinkShim';

type Env = Record<string, string | undefined>;
const HOUR_MS = 3_600_000;

/** Amazon's required wording (singular "Associate"); shown once, in the site footer. */
export const AMAZON_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';

/* ---------- Links ---------- */

const AFFILIATE_RE = /^https:\/\/www\.amazon\.co\.uk\/dp\/[A-Z0-9]{10}\?tag=[A-Za-z0-9][A-Za-z0-9-]{0,60}-21$/;
const PREVIEW_RE = /^https:\/\/www\.amazon\.co\.uk\/dp\/[A-Z0-9]{10}$/;

export interface ButtonLink {
  href: string;
  rel: 'sponsored nofollow';
  kind: 'affiliate' | 'preview';
}

/**
 * Contract (S1-8c): href = link_url ?? preview_link_url, rel = link_rel; both null => no button.
 * Defence in depth (Code Reviewer): link_url must be the exact amazon.co.uk Special Link shape
 * that resolveAffiliateLink builds and only in a non-preview build; preview_link_url must be a
 * tagless amazon.co.uk/dp URL and only in a preview build. `is_affiliate_link` is never trusted
 * on its own, and no other URL field is ever read.
 */
export function buttonLink(offer: DisplayOfferWithPreview, env: Env): ButtonLink | null {
  if (offer.link_rel !== 'sponsored nofollow') return null;
  const preview = isPreviewBuild(env);
  const live = offer.link_url;
  if (live !== null && !preview && AFFILIATE_RE.test(live)) return { href: live, rel: 'sponsored nofollow', kind: 'affiliate' };
  const prev = previewLinkOf(offer);
  if (live === null && prev !== null && preview && env.SITE_ENV === 'preview' && PREVIEW_RE.test(prev)) {
    return { href: prev, rel: 'sponsored nofollow', kind: 'preview' };
  }
  return null;
}

/* ---------- Price ---------- */

export interface ShownPrice {
  text: string;
  checkedText: string;
  disclaimer: string;
}

/**
 * A price is shown ONLY when all hold:
 * - price_display_allowed is true (contract: Amazon price from the product API, <= 24 h old,
 *   no future timestamps; see isPriceDisplayAllowed in src/lib/offers/affiliate.ts),
 * - price_gbp_inc_vat is a number,
 * - captured_at and last_checked are both within 24 h of `now` (build time) and not in the future,
 * - retailer_price_disclaimer is set (contract: only for an Amazon price that is shown).
 * Otherwise null: no price and no explanatory note.
 */
export function shownPrice(offer: AffiliateDisplayOffer, now: Date): ShownPrice | null {
  if (!offer.price_display_allowed || offer.price_gbp_inc_vat === null) return null;
  if (!offer.retailer_price_disclaimer) return null;
  const t = now.getTime();
  for (const ts of [offer.captured_at, offer.last_checked]) {
    const v = Date.parse(ts);
    if (Number.isNaN(v) || v > t || t - v > 24 * HOUR_MS) return null;
  }
  return {
    text: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(offer.price_gbp_inc_vat),
    checkedText: formatLondonDateTime(offer.last_checked),
    disclaimer: offer.retailer_price_disclaimer,
  };
}

/* ---------- Categories ---------- */

export const CATEGORY_META: Record<ProductCategory, { title: string; short: string; dek: string; anchor: string }> = {
  kit: { title: 'Pre-packed kits', short: 'kit', dek: 'Grab bags and home boxes', anchor: 'kits' },
  emergency_water: { title: 'Emergency water', short: 'water', dek: 'Cans, cartons and pouches', anchor: 'water' },
  first_aid_kit: { title: 'First aid', short: 'first aid kit', dek: 'Household, workplace and car kits', anchor: 'first-aid' },
  wind_up_torch_radio: { title: 'Wind-up torches & radios', short: 'radio', dek: 'Light and news without mains power', anchor: 'radios' },
  power_bank: { title: 'Power banks', short: 'power bank', dek: 'Keep phones charged', anchor: 'power-banks' },
  emergency_blanket: { title: 'Emergency blankets', short: 'blankets', dek: 'Foil and thermal blankets', anchor: 'blankets' },
  thermal_clothing: { title: 'Thermals', short: 'thermals', dek: 'Base layers for cold homes', anchor: 'thermals' },
};

export const CATEGORY_ORDER: ProductCategory[] = [
  'kit',
  'emergency_water',
  'first_aid_kit',
  'wind_up_torch_radio',
  'power_bank',
  'emergency_blanket',
  'thermal_clothing',
];

/* ---------- Specs ---------- */

const POWER: Record<string, string> = { wind_up: 'wind-up', dynamo: 'dynamo', solar: 'solar', usb: 'USB', aa: 'AA', aaa: 'AAA', built_in_battery: 'built-in battery' };
const GARMENT: Record<string, string> = { base_layer_top: 'Base-layer top', base_layer_bottom: 'Base-layer bottoms', set: 'Set', socks: 'Socks', hat: 'Hat', gloves: 'Gloves', other: 'Other' };
const DEVICE: Record<string, string> = { torch: 'Torch', radio: 'Radio', torch_radio: 'Torch and radio' };
const num = (n: number) => new Intl.NumberFormat('en-GB').format(n);

/** Spec values from the public summary as short facts. Only values present in the data. */
export function specFacts(c: CatalogueComparison): string[] {
  const s = c.product.specs as Record<string, unknown>;
  const out: string[] = [];
  const has = (k: string) => s[k] !== undefined && s[k] !== null;
  if (has('total_litres')) out.push(`${s.total_litres} L in total`);
  if (has('units_per_pack') && has('unit_volume_ml')) out.push(`${s.units_per_pack} × ${s.unit_volume_ml} ml`);
  if (has('pack_format')) out.push(`${String(s.pack_format)[0]!.toUpperCase()}${String(s.pack_format).slice(1)}s`);
  if (has('shelf_life_years')) out.push(`Listed shelf life ${s.shelf_life_years} years`);
  if (has('standard')) out.push(String(s.standard));
  if (has('kit_size_label')) out.push(String(s.kit_size_label));
  if (has('item_count')) out.push(`${s.item_count} items`);
  if (has('device_type')) out.push(DEVICE[String(s.device_type)] ?? String(s.device_type));
  if (Array.isArray(s.radio_bands)) out.push(`${(s.radio_bands as string[]).join(' / ')} radio`);
  if (Array.isArray(s.power_sources)) out.push(`Power: ${(s.power_sources as string[]).map((p) => POWER[p] ?? p).join(', ')}`);
  if (has('battery_mah')) out.push(`${num(Number(s.battery_mah))} mAh battery`);
  if (has('capacity_mah')) out.push(`${num(Number(s.capacity_mah))} mAh`);
  if (has('max_output_w')) out.push(`Up to ${s.max_output_w} W`);
  if (Array.isArray(s.ports)) out.push(`Ports: ${(s.ports as string[]).join(', ')}`);
  if (has('size_cm')) {
    const z = s.size_cm as { w: number; h: number };
    out.push(`${z.w} × ${z.h} cm`);
  }
  if (has('material')) out.push(String(s.material));
  if (has('garment_type')) out.push(GARMENT[String(s.garment_type)] ?? String(s.garment_type));
  if (has('pack_count')) out.push(`Pack of ${s.pack_count}`);
  return out;
}

/** Short item name for the visible button label, e.g. "Anker A1689". */
function itemName(c: CatalogueComparison): string {
  const p = c.product;
  const model = p.model_code && p.model_code.toLowerCase() !== 'radio' ? p.model_code : CATEGORY_META[p.category].short;
  return `${p.brand} ${model}`.trim();
}

/* ---------- Page model ---------- */

export interface CardOffer {
  offer_id: string;
  price: ShownPrice | null;
  link: ButtonLink | null;
}

export interface ProductCardModel {
  id: string;
  category: ProductCategory;
  name: string;
  brand: string;
  buttonLabel: string;
  facts: string[];
  offers: CardOffer[];
}

export interface CatalogueModel {
  sections: { category: ProductCategory; cards: ProductCardModel[] }[];
  hasAmazonLinks: boolean;
  /** ASINs of rendered products, in render order (for tests and evidence). */
  asins: string[];
  stats: { cards: number; withButton: number; withoutButton: number; withPrice: number };
}

export function toCardModel(c: CatalogueComparison, env: Env, now: Date): ProductCardModel {
  const offers = (c.offers as DisplayOfferWithPreview[]).map((o) => ({
    offer_id: o.offer_id,
    price: shownPrice(o, now),
    link: buttonLink(o, env),
  }));
  return {
    id: c.variant_id,
    category: c.category,
    name: c.product.product_name,
    brand: c.product.brand,
    buttonLabel: `Check ${itemName(c)} on Amazon`,
    facts: specFacts(c),
    offers,
  };
}

/**
 * Amazon-only catalogue (Kieran: "no evaq8 links or anything, just amazon affiliate links").
 * Inputs: catalogue products (non-kit; kits.json holds only a non-Amazon-brand kit) and offers
 * that the contract's own isAmazonOffer recognises. Order is the data's; nothing is re-sorted.
 */
/** Render gate: verified product record (isProductVerified) with at least one exact-match offer. */
export function isApproved(c: CatalogueComparison, record: ProductRecord | undefined): boolean {
  return (
    c.product.verification === 'verified' &&
    record !== undefined &&
    isProductVerified(record) &&
    c.offers.some((o) => o.model_match_confirmed === true)
  );
}

export async function loadCatalogue(env: Env = process.env, now = new Date()): Promise<CatalogueModel> {
  const data = await import('../../lib/offers/data');
  const offers = data.catalogueOffers.filter((o) => isAmazonOffer(o));
  const { comparisons } = buildCatalogueComparisons(data.catalogueProducts, offers, {
    programmes: data.affiliateProgrammes,
    buildEnv: env,
    now,
  });
  // Approved set = the same gate resolveAffiliateLink applies: the product record passes
  // isProductVerified (verification: 'verified', plus size for thermals) AND the offer is an exact
  // model match (matchOfferToProduct === null, surfaced as model_match_confirmed). No ASIN list.
  const records = new Map(data.catalogueProducts.map((p) => [p.variant_id, p]));
  const cards = comparisons
    .filter((c) => isApproved(c, records.get(c.variant_id)))
    .map((c) => toCardModel({ ...c, offers: c.offers.filter((o) => o.model_match_confirmed === true) }, env, now));
  // Distinct visible labels: fall back to the ASIN when two items would read the same.
  const seen = new Map<string, number>();
  for (const card of cards) seen.set(card.buttonLabel, (seen.get(card.buttonLabel) ?? 0) + 1);
  for (const card of cards) {
    if ((seen.get(card.buttonLabel) ?? 0) > 1) {
      const asin = comparisons.find((c) => c.variant_id === card.id)?.product.asin_uk;
      card.buttonLabel = card.buttonLabel.replace(/ on Amazon$/, ` (${asin ?? card.id}) on Amazon`);
    }
  }
  const sections = CATEGORY_ORDER.map((category) => ({ category, cards: cards.filter((c) => c.category === category) }));
  const withButton = cards.filter((c) => c.offers.some((o) => o.link)).length;
  const asinOf = new Map(comparisons.map((c) => [c.variant_id, c.product.asin_uk ?? c.variant_id]));
  return {
    sections,
    hasAmazonLinks: withButton > 0,
    asins: cards.map((c) => asinOf.get(c.id)!),
    stats: { cards: cards.length, withButton, withoutButton: cards.length - withButton, withPrice: cards.filter((c) => c.offers.some((o) => o.price)).length },
  };
}
