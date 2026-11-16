/**
 * S1-10 view model for Amazon-only product cards. Read-only over src/lib/offers:
 * comparisons come from buildCatalogueComparisons, then groupComparisonsByCategory.
 * This file never regroups or re-sorts, never picks a best price, and never renders a URL
 * other than the contract's production affiliate link_url.
 */
import {
  buildCatalogueComparisons,
  formatLondonDateTime,
  isAmazonOffer,
  groupComparisonsByCategory,
  isAllowedImageUrl,
  STANDARDS_CODE_PATTERN,
  CATEGORY_LABELS,
  PRODUCT_CATEGORIES,
  type AffiliateDisplayOffer,
  type CatalogueComparison,
  type ProductCategory,
  type PublicProductSummary,
} from '../../lib/offers';
import { isPreviewBuild } from '../../data/site';

type Env = Record<string, string | undefined>;
const HOUR_MS = 3_600_000;

/** Amazon's required wording (singular "Associate"); shown once, in the site footer. */
export const AMAZON_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';

/** The only host we will render a product image from (Amazon-served Creators API / PA-API). */
export const AMAZON_IMAGE_HOST = 'm.media-amazon.com';

/** Used as width/height (and a 1:1 frame) when an allowed image is missing dimensions. */
export const FALLBACK_IMAGE_SIZE = 400;

/* ---------- Links ---------- */

const AFFILIATE_RE = /^https:\/\/www\.amazon\.co\.uk\/dp\/[A-Z0-9]{10}\?tag=[A-Za-z0-9][A-Za-z0-9-]{0,60}-21$/;

export interface ButtonLink {
  href: string;
  rel: 'sponsored nofollow';
}

/**
 * Affiliate button link. The href comes ONLY from the contract's link_url (built by
 * resolveAffiliateLink), and only when all hold: the offer is flagged is_affiliate_link with
 * link_rel 'sponsored nofollow', the build is not a preview, and link_url has the exact
 * amazon.co.uk Special Link shape (https://www.amazon.co.uk/dp/<10-character id>?tag=<id>-21).
 * is_affiliate_link alone never produces a link, and no other URL field is ever read.
 * Previews therefore show no buttons.
 */
export function buttonLink(offer: AffiliateDisplayOffer, env: Env): ButtonLink | null {
  if (!offer.is_affiliate_link || offer.link_rel !== 'sponsored nofollow') return null;
  if (isPreviewBuild(env)) return null;
  const live = offer.link_url;
  if (live === null || !AFFILIATE_RE.test(live)) return null;
  return { href: live, rel: 'sponsored nofollow' };
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
  kit: { title: CATEGORY_LABELS.kit, short: 'kit', dek: 'Grab bags and home boxes', anchor: 'kits' },
  emergency_water: { title: CATEGORY_LABELS.emergency_water, short: 'water', dek: 'Cans, cartons and pouches', anchor: 'water' },
  first_aid_kit: { title: CATEGORY_LABELS.first_aid_kit, short: 'first aid kit', dek: 'Household, workplace and car kits', anchor: 'first-aid' },
  torch: { title: CATEGORY_LABELS.torch, short: 'torch', dek: 'Light without mains power', anchor: 'torches' },
  radio: { title: CATEGORY_LABELS.radio, short: 'radio', dek: 'News without mains power', anchor: 'radios' },
  batteries: { title: CATEGORY_LABELS.batteries, short: 'batteries', dek: 'Spares for torches and radios', anchor: 'batteries' },
  hi_vis: { title: CATEGORY_LABELS.hi_vis, short: 'hi-vis vest', dek: 'Be seen at the roadside', anchor: 'hi-vis' },
  jump_leads: { title: CATEGORY_LABELS.jump_leads, short: 'jump leads', dek: 'Restart a flat car battery', anchor: 'jump-leads' },
  warning_triangle: { title: CATEGORY_LABELS.warning_triangle, short: 'warning triangle', dek: 'Be seen if you break down', anchor: 'warning-triangles' },
  power_bank: { title: CATEGORY_LABELS.power_bank, short: 'power bank', dek: 'Keep phones charged', anchor: 'power-banks' },
  emergency_blanket: { title: CATEGORY_LABELS.emergency_blanket, short: 'blankets', dek: 'Foil and thermal blankets', anchor: 'blankets' },
  thermal_clothing: { title: CATEGORY_LABELS.thermal_clothing, short: 'thermals', dek: 'Base layers for cold homes', anchor: 'thermals' },
  // S1-10b: minimal compile fix by Backend (placeholder copy; Web owns final wording).
  water_container: { title: CATEGORY_LABELS.water_container, short: 'water container', dek: 'Carriers and jerrycans', anchor: 'water-containers' },
  rainwater_storage: { title: CATEGORY_LABELS.rainwater_storage, short: 'water butt', dek: 'Not drinking water until treated', anchor: 'rainwater' },
  gravity_filter: { title: CATEGORY_LABELS.gravity_filter, short: 'water filter', dek: 'Filter water without power', anchor: 'water-filters' },
  flask: { title: CATEGORY_LABELS.flask, short: 'flask', dek: 'Hot drinks without power', anchor: 'flasks' },
  tin_opener: { title: CATEGORY_LABELS.tin_opener, short: 'tin opener', dek: 'Open tinned food by hand', anchor: 'tin-openers' },
  electric_lighter: { title: CATEGORY_LABELS.electric_lighter, short: 'lighter', dek: 'Rechargeable windproof lighters', anchor: 'lighters' },
  two_way_radio: { title: CATEGORY_LABELS.two_way_radio, short: 'two-way radio', dek: 'Licence-free walkie-talkies', anchor: 'two-way-radios' },
  multi_tool: { title: CATEGORY_LABELS.multi_tool, short: 'multi-tool', dek: 'Pocket tools for repairs', anchor: 'multi-tools' },
  sleeping_bag: { title: CATEGORY_LABELS.sleeping_bag, short: 'sleeping bag', dek: 'Warmth if the heating fails', anchor: 'sleeping-bags' },
  hygiene: { title: CATEGORY_LABELS.hygiene, short: 'hygiene', dek: 'Sanitiser, wipes and toilet bags', anchor: 'hygiene' },
  baby_care: { title: CATEGORY_LABELS.baby_care, short: 'baby care', dek: 'Nappies and wipes', anchor: 'baby-care' },
  document_pouch: { title: CATEGORY_LABELS.document_pouch, short: 'document pouch', dek: 'Keep papers dry', anchor: 'document-pouches' },
  home_kit: { title: CATEGORY_LABELS.home_kit, short: 'home kit', dek: 'Ready-made kits for staying put', anchor: 'home-kits' },
  grab_bag_kit: { title: CATEGORY_LABELS.grab_bag_kit, short: 'grab bag', dek: 'Ready-made bags for leaving fast', anchor: 'grab-bags' },
};

/** All categories, in Backend's PRODUCT_CATEGORIES order (for the home grid, including empty ones). */
export const CATEGORY_ORDER: ProductCategory[] = [...PRODUCT_CATEGORIES];

/* ---------- Names ---------- */

/** Measurements are fine in a fallback title: "20,000mAh", "500ml", "12V". */
const MEASUREMENT_TOKEN = /^\d+(?:[.,]\d+)*(?:mAh|Ah|Wh|W|kW|V|ml|cl|L|m|cm|mm|mm²|kg|g|lm|A|x)$/i;
const COUNT_TOKEN = /^\d+-(?:pack|piece|person|litre|metre|year)s?$/i;
const KEPT_CAPS = new Set(['USB', 'DAB', 'AM', 'FM', 'LED', 'UK', 'EU', 'NHS']);
/** Fuller than STANDARDS_CODE_PATTERN, which only matches the start of a code. */
const STANDARDS_CODE_FULL = /\bBS\s?\d+(?:[-\s]\d+)*(?::\d+)?|\bEN(?:\s+ISO)?\s?\d+(?:[-\s]\d+)*|\bISO\s?\d+(?:[-\s]\d+)*/i;

export type NameSource = Pick<PublicProductSummary, 'display_name' | 'product_name'> &
  Partial<Pick<PublicProductSummary, 'brand' | 'model_code' | 'mpn'>>;

/**
 * Fallback cleaner for a listing title when display_name is missing. Strips standards codes,
 * model / part / SKU-like tokens, and ALL-CAPS keyword runs. Not used when display_name is set.
 */
function isCapsKeyword(token: string): boolean {
  const letters = token.replace(/[^A-Za-z]/g, '');
  return letters.length >= 4 && token === token.toUpperCase() && !KEPT_CAPS.has(token);
}

export function cleanProductTitle(title: string): string {
  let s = title.replace(new RegExp(STANDARDS_CODE_FULL, 'gi'), ' ');
  s = s.replace(/[|®™]/g, ' ');
  const tokens: string[] = [];
  for (const raw of s.split(/\s+/)) {
    const t = raw.replace(/^[("'[]+|[)"'\],.;:!?]+$/g, '');
    if (!t) continue;
    if (/[A-Za-z]/.test(t) && /\d/.test(t) && !MEASUREMENT_TOKEN.test(t) && !COUNT_TOKEN.test(t)) continue;
    if (/^\d{5,}$/.test(t)) continue;
    tokens.push(t);
  }
  // Drop ALL-CAPS keyword-stuffing runs (two or more adjacent caps words). A single
  // caps token such as a brand (UGREEN, INIU) is kept.
  const kept: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    if (isCapsKeyword(tokens[i]!)) {
      let j = i + 1;
      while (j < tokens.length && isCapsKeyword(tokens[j]!)) j++;
      if (j - i >= 2) {
        i = j;
        continue;
      }
    }
    kept.push(tokens[i]!);
    i++;
  }
  const cleaned = kept.join(' ').replace(/\s*\([^)]*$/g, '').replace(/[\s\-–,]+$/g, '').replace(/\s+for\s+Ref\s+\d+\s*$/i, '').replace(/\s+/g, ' ').trim();
  return cleaned || title.trim();
}

/** Visible card heading / image alt: display_name, or a cleaned listing title. */
export function cardDisplayName(product: NameSource): string {
  const name = product.display_name?.trim();
  if (name) return name;
  return cleanProductTitle(product.product_name);
}

/* ---------- Images ---------- */

export type ProductImageInput = {
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  image_source: 'paapi' | null;
  display_name?: string | null;
  product_name?: string;
};

export interface ProductImageModel {
  url: string;
  width: number;
  height: number;
  alt: string;
  /** True when the data had no usable width/height; the card uses a fixed-aspect frame. */
  fixedAspect: boolean;
}

/**
 * Renderable product image. Returns null (no img, no frame) unless image_url is set, its host is
 * exactly m.media-amazon.com, the URL passes isAllowedImageUrl, and image_source is set.
 */
export function productImage(product: ProductImageInput): ProductImageModel | null {
  if (!product.image_url || !product.image_source) return null;
  if (!isAllowedImageUrl(product.image_url)) return null;
  let host: string;
  try {
    host = new URL(product.image_url).hostname;
  } catch {
    return null;
  }
  if (host !== AMAZON_IMAGE_HOST) return null;
  const hasWidth = typeof product.image_width === 'number' && product.image_width > 0;
  const hasHeight = typeof product.image_height === 'number' && product.image_height > 0;
  return {
    url: product.image_url,
    width: hasWidth ? product.image_width! : FALLBACK_IMAGE_SIZE,
    height: hasHeight ? product.image_height! : FALLBACK_IMAGE_SIZE,
    alt: cardDisplayName({
      display_name: product.display_name ?? null,
      product_name: product.product_name ?? '',
    }),
    fixedAspect: !hasWidth || !hasHeight,
  };
}

/* ---------- Specs ---------- */

const POWER: Record<string, string> = { wind_up: 'wind-up', dynamo: 'dynamo', solar: 'solar', usb: 'USB', aa: 'AA', aaa: 'AAA', built_in_battery: 'built-in battery' };
const GARMENT: Record<string, string> = {
  base_layer_top: 'Base-layer top',
  base_layer_bottom: 'Base-layer bottoms',
  set: 'Set',
  socks: 'Socks',
  hat: 'Hat',
  gloves: 'Gloves',
  vest: 'Vest',
  jacket: 'Jacket',
  other: 'Other',
};
const DEVICE: Record<string, string> = { torch: 'Torch', radio: 'Radio', torch_radio: 'Torch and radio' };
const CHEMISTRY: Record<string, string> = { alkaline: 'Alkaline', lithium: 'Lithium', nimh: 'NiMH', zinc_carbon: 'Zinc-carbon', other: 'Other' };
const num = (n: number) => new Intl.NumberFormat('en-GB').format(n);

function isPlainFact(value: string): boolean {
  return !STANDARDS_CODE_PATTERN.test(value) && !STANDARDS_CODE_FULL.test(value) && value !== 'none_stated';
}

/** Spec values from the public summary as short facts. Only values present in the data. */
export function specFacts(c: CatalogueComparison): string[] {
  const s = c.product.specs as Record<string, unknown>;
  const out: string[] = [];
  const has = (k: string) => s[k] !== undefined && s[k] !== null;
  // size_child_of is an identity field, not a spec, and must never be rendered.
  if (has('total_litres')) out.push(`${s.total_litres} L in total`);
  if (has('units_per_pack') && has('unit_volume_ml')) out.push(`${s.units_per_pack} × ${s.unit_volume_ml} ml`);
  if (has('pack_format')) out.push(`${String(s.pack_format)[0]!.toUpperCase()}${String(s.pack_format).slice(1)}s`);
  if (has('shelf_life_years')) out.push(`Listed shelf life ${s.shelf_life_years} years`);
  // Never show a standards code (BS / EN / ISO) as a card fact.
  if (has('standard')) {
    const std = String(s.standard);
    if (isPlainFact(std)) out.push(std);
  }
  if (has('kit_size_label')) {
    const label = String(s.kit_size_label);
    if (isPlainFact(label)) out.push(label);
  }
  if (has('item_count')) out.push(`${s.item_count} items`);
  if (has('device_type')) out.push(DEVICE[String(s.device_type)] ?? String(s.device_type));
  if (Array.isArray(s.radio_bands)) out.push(`${(s.radio_bands as string[]).join(' / ')} radio`);
  if (Array.isArray(s.power_sources)) out.push(`Power: ${(s.power_sources as string[]).map((p) => POWER[p] ?? p).join(', ')}`);
  if (has('lumens')) out.push(`${num(Number(s.lumens))} lumens`);
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
  if (has('size')) out.push(String(s.size));
  if (has('chemistry')) out.push(CHEMISTRY[String(s.chemistry)] ?? String(s.chemistry));
  if (has('colour')) out.push(String(s.colour));
  if (has('size_label')) out.push(`Size ${s.size_label}`);
  if (has('length_m')) out.push(`${s.length_m} m`);
  if (has('cable_csa_mm2')) out.push(`${s.cable_csa_mm2} mm² cable`);
  if (has('rated_amps')) out.push(`Rated ${num(Number(s.rated_amps))} A`);
  if (has('max_engine_cc')) out.push(`Suits engines up to ${num(Number(s.max_engine_cc))} cc`);
  if (has('pack_count')) out.push(`Pack of ${s.pack_count}`);
  return out.filter(isPlainFact);
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
  image: ProductImageModel | null;
  offers: CardOffer[];
}

export interface CatalogueSection {
  category: ProductCategory;
  category_label: string;
  cards: ProductCardModel[];
}

export interface CatalogueModel {
  sections: CatalogueSection[];
  hasAmazonLinks: boolean;
  /** Marketplace ids of rendered products, in render order (for tests and evidence). */
  asins: string[];
  stats: { cards: number; withButton: number; withoutButton: number; withPrice: number };
}

export function toCardModel(c: CatalogueComparison, env: Env, now: Date): ProductCardModel {
  const name = cardDisplayName(c.product);
  const offers = c.offers.map((o) => ({
    offer_id: o.offer_id,
    price: shownPrice(o, now),
    link: buttonLink(o, env),
  }));
  return {
    id: c.variant_id,
    category: c.category,
    name,
    brand: c.product.brand,
    buttonLabel: `Check ${name} on Amazon`,
    facts: specFacts(c),
    image: productImage(c.product),
    offers,
  };
}

/**
 * Amazon-only catalogue. Inputs: catalogue products and offers that isAmazonOffer recognises.
 * Grouping, the verification gate, rank sort and the per-category cap come from
 * groupComparisonsByCategory; this function does not regroup or re-sort.
 */
export async function loadCatalogue(env: Env = process.env, now = new Date()): Promise<CatalogueModel> {
  const data = await import('../../lib/offers/data');
  const offers = data.catalogueOffers.filter((o) => isAmazonOffer(o));
  const built = buildCatalogueComparisons(data.catalogueProducts, offers, {
    programmes: data.affiliateProgrammes,
    buildEnv: env,
    now,
  });
  const groups = groupComparisonsByCategory(built, { perCategory: 3 });
  const sections: CatalogueSection[] = groups.map((g) => ({
    category: g.category,
    category_label: g.category_label,
    cards: g.comparisons.map((c) =>
      toCardModel({ ...c, offers: c.offers.filter((o) => o.model_match_confirmed === true) }, env, now),
    ),
  }));
  const cards = sections.flatMap((s) => s.cards);
  // Distinct visible labels without putting a marketplace id in the button text.
  const seen = new Map<string, number>();
  for (const card of cards) seen.set(card.buttonLabel, (seen.get(card.buttonLabel) ?? 0) + 1);
  for (const card of cards) {
    if ((seen.get(card.buttonLabel) ?? 0) > 1) {
      card.buttonLabel = `Check ${card.brand}: ${card.name} on Amazon`;
    }
  }
  const withButton = cards.filter((c) => c.offers.some((o) => o.link)).length;
  const asinOf = new Map(groups.flatMap((g) => g.comparisons.map((c) => [c.variant_id, c.product.asin_uk ?? c.variant_id] as const)));
  return {
    sections,
    hasAmazonLinks: withButton > 0,
    asins: cards.map((c) => asinOf.get(c.id)!),
    stats: { cards: cards.length, withButton, withoutButton: cards.length - withButton, withPrice: cards.filter((c) => c.offers.some((o) => o.price)).length },
  };
}

/**
 * Category sections that the compare page renders (one anchor each): every section with at least
 * one card, except the legacy `kit` bucket. The homepage links only to these anchors.
 */
export function productSections(model: Pick<CatalogueModel, 'sections'>): CatalogueSection[] {
  return model.sections.filter((s) => s.category !== 'kit' && s.cards.length > 0);
}
