/**
 * S1-8: affiliate-only render rule, exact-identity matching across categories,
 * and catalogue comparisons.
 *
 * Render rule: `link_url` is non-null ONLY when the offer matches its product
 * exactly, the product record is verified, its programme is `approved`, the build is a
 * production build (SITE_ENV=production, not a Cloudflare preview; Amazon), the tracking id
 * env var is present at build time (Amazon), and the URL is https on one of the programme's
 * allowed hosts. There is no fallback to product_url, ever.
 */
import {
  AMAZON_PRICE_DISCLAIMER,
  CATALOGUE_LABEL_TEXT,
  CATEGORY_LABELS,
  PRODUCT_CATEGORIES,
  NO_LINK_TEXT,
  NO_LINK_TEXT_EXACT_PRODUCT,
  NO_LINK_TEXT_PRODUCT_UNVERIFIED,
  type AffiliateDisplayOffer,
  type AffiliateProgrammeRecord,
  type BuildEnv,
  type CatalogueComparison,
  type CatalogueExcludedOffer,
  type CatalogueExclusionReason,
  type CatalogueOfferLabel,
  type CatalogueProduct,
  type CategoryComparisonGroup,
  type KitVariant,
  type NoLinkReason,
  type Offer,
  type ProductCategory,
  type ProductRecord,
  type PublicProductSummary,
  type Savings,
} from './types';
import {
  computeSavings,
  deliveredTotal,
  identifiersMatch,
  isStale,
  priceDisclaimer,
  sortOffers,
  type CompareOptions,
} from './compare';
import { ASIN_PATTERN, hasNonUkAmazonUrl, isAmazonOffer } from './schema';
import { londonDateKey } from './time';
import { isPreviewBuild } from '../../data/site';

export interface AffiliateOptions extends CompareOptions {
  /** Programme records (src/data/affiliate/programmes.json). */
  programmes?: AffiliateProgrammeRecord[];
  /** Build-time env. Defaults to process.env when available. Only tracking_id_env names are read. */
  buildEnv?: BuildEnv;
}

const HOUR_MS = 3_600_000;
const AMAZON_UK_HOST = 'www.amazon.co.uk';
/** UK Associates tracking ids end in -21 (e.g. "example-21"). Anything else => no links. */
export const TRACKING_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,60}-21$/;

const money = (n: number) => Math.round(n * 100) / 100;
const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/**
 * S1-8b M1: affiliate links are built only in a production build: SITE_ENV must be exactly
 * 'production' AND the build must not be a preview per isPreviewBuild (src/data/site.ts), which
 * also catches Cloudflare Pages branch previews (CF_PAGES=1 with CF_PAGES_BRANCH other than
 * PRODUCTION_BRANCH, default 'main'). Unset, 'preview' or any other SITE_ENV => no links.
 * Unlike indexability, the default here is fail-closed.
 */
export function isProductionLinkBuild(env: BuildEnv): boolean {
  if (env.SITE_ENV !== 'production') return false;
  return !isPreviewBuild(env);
}

function defaultEnv(): BuildEnv {
  const p = (globalThis as { process?: { env?: BuildEnv } }).process;
  return p?.env ?? {};
}

function nowMs(now: CompareOptions['now']): number {
  if (now === undefined) return Date.now();
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (Number.isNaN(t)) throw new RangeError('Invalid `now`');
  return t;
}

/* ---------- Product helpers ---------- */

export function productCategory(p: ProductRecord): ProductCategory {
  return (p as { category?: ProductCategory }).category ?? 'kit';
}

export function isKitProduct(p: ProductRecord): p is KitVariant {
  return productCategory(p) === 'kit';
}

function productAsin(p: ProductRecord): string | null {
  return (p as { asin_uk?: string | null }).asin_uk ?? null;
}

/**
 * Exact-match rule. Returns null when the offer joins the product, else the reason.
 * - Amazon UK offers: equal ASIN (amazon.co.uk) only. No GTIN fallback.
 * - Other retailers: equal GTIN; kits may instead use the S1-1 MPN/GTIN rule.
 * - model_match_confirmed must be true in every case.
 */
export function matchOfferToProduct(offer: Offer, product: ProductRecord): CatalogueExclusionReason | null {
  if (offer.variant_id !== product.variant_id) return 'unknown_variant';
  if (offer.model_match_confirmed !== true) return 'model_match_unconfirmed';
  const kit = isKitProduct(product);
  if (isAmazonOffer(offer)) {
    const a = productAsin(product);
    if (a === null || offer.asin !== a) return 'asin_mismatch';
    if (offer.asin_marketplace !== undefined && offer.asin_marketplace !== null && offer.asin_marketplace !== 'amazon.co.uk') return 'asin_mismatch';
    if (kit) return identifiersMatch(offer, product) ? null : 'identifier_mismatch';
  } else if (kit) {
    return identifiersMatch(offer, product) ? null : 'identifier_mismatch';
  } else {
    const g = (product as CatalogueProduct).gtin;
    if (g === null) return 'no_exact_identity';
    if (offer.gtin !== g) return 'gtin_mismatch';
  }
  const cp = product as CatalogueProduct;
  if (offer.mpn !== null && cp.mpn !== null && offer.mpn !== cp.mpn) return 'identifier_mismatch';
  if (offer.gtin !== null && cp.gtin !== null && offer.gtin !== cp.gtin) return 'gtin_mismatch';
  return null;
}

/** Spec value from a stored record ({ value, source, ... }) or a public summary (plain value). */
function specValue(specs: unknown, key: string): unknown {
  const v = (specs as Record<string, unknown> | undefined)?.[key];
  if (v !== null && typeof v === 'object' && !Array.isArray(v) && 'value' in v) return (v as { value: unknown }).value;
  return v;
}

/**
 * Link gate on the product record: only `verification: 'verified'` products may carry
 * affiliate links. Kit variants without a verification field are unverified. Verified
 * thermal_clothing and hi_vis must also name their exact size, and a verified warning_triangle
 * must be e_marked or ece_r27 (belt and braces; the schema enforces both).
 * S1-10: also accepts a PublicProductSummary, so the same gate runs on comparisons.
 */
export function isProductVerified(product: ProductRecord | PublicProductSummary): boolean {
  if ((product as { verification?: string }).verification !== 'verified') return false;
  const category = (product as { category?: ProductCategory }).category ?? 'kit';
  const specs = (product as { specs?: unknown }).specs;
  if (category === 'thermal_clothing' || category === 'hi_vis') {
    const size = specValue(specs, 'size_label');
    if (typeof size !== 'string' || !size.trim()) return false;
  }
  if (category === 'warning_triangle') {
    if (specValue(specs, 'e_marked') !== true && specValue(specs, 'ece_r27') !== true) return false;
  }
  return true;
}

/* ---------- Render rule ---------- */

export interface ResolvedLink {
  link_url: string | null;
  link_rel: 'sponsored nofollow' | null;
  no_link_reason: NoLinkReason | null;
  disclosure_text: string | null;
}

const noLink = (reason: NoLinkReason): ResolvedLink => ({
  link_url: null,
  link_rel: null,
  no_link_reason: reason,
  disclosure_text: null,
});

/** Builds the Amazon UK Special Link form: https://www.amazon.co.uk/dp/{ASIN}?tag={tag}. */
export function amazonUkAffiliateUrl(asin: string, tag: string): string {
  return `https://${AMAZON_UK_HOST}/dp/${encodeURIComponent(asin)}?tag=${encodeURIComponent(tag)}`;
}

/**
 * The affiliate-only link rule. Never returns product_url or any non-affiliate URL.
 */
export function resolveAffiliateLink(
  offer: Offer,
  productMatched: boolean,
  programmes: AffiliateProgrammeRecord[],
  buildEnv: BuildEnv = defaultEnv(),
  /** The product record is verified (see isProductVerified). Defaults to false: fail closed. */
  productVerified = false,
): ResolvedLink {
  if (!productMatched) return noLink('exact_product_not_confirmed');
  if (!productVerified) return noLink('product_unverified');
  const id = offer.affiliate_programme_id ?? null;
  if (id === null) return noLink('no_programme');
  const programme = programmes.find((p) => p.programme_id === id);
  if (!programme) return noLink('no_programme');
  if (programme.status === 'pending') return noLink('programme_pending');
  if (programme.status === 'rejected') return noLink('programme_rejected');
  if (programme.status === 'suspended') return noLink('programme_suspended');
  if (programme.approved_on === null || programme.approved_on > londonDateKey(offer.captured_at)) {
    return noLink('programme_pending');
  }

  const amazon = isAmazonOffer(offer);
  let candidate: string;
  if (amazon || programme.link_mode === 'derive_from_asin') {
    // Amazon links are ALWAYS built from the ASIN; any stored affiliate_url is ignored.
    // A derive_from_asin programme does not apply to non-Amazon offers.
    if (!amazon) return noLink('no_programme');
    if (hasNonUkAmazonUrl(offer)) return noLink('marketplace_not_supported');
    if (!isProductionLinkBuild(buildEnv)) return noLink('non_production_build');
    const envName = programme.tracking_id_env;
    const raw = envName ? buildEnv[envName] : undefined;
    const tag = raw?.trim();
    if (!tag) return noLink('tracking_id_missing');
    if (!TRACKING_ID_PATTERN.test(tag)) return noLink('tracking_id_invalid');
    if (!offer.asin || !ASIN_PATTERN.test(offer.asin)) return noLink('exact_product_not_confirmed');
    candidate = amazonUkAffiliateUrl(offer.asin, tag);
  } else {
    if (!offer.affiliate_url.trim()) return noLink('no_affiliate_url');
    candidate = offer.affiliate_url;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return noLink('not_https');
  }
  if (url.protocol !== 'https:') return noLink('not_https');
  if (!programme.allowed_hosts.includes(url.hostname)) return noLink('host_not_allowed');
  return {
    link_url: candidate,
    link_rel: 'sponsored nofollow',
    no_link_reason: null,
    disclosure_text: programme.disclosure_text,
  };
}

/* ---------- Price display rule ---------- */

/**
 * Amazon prices (and availability/delivery) are displayable only when they came from
 * the Amazon product API and are no older than the programme's max_price_age_hours (24).
 * Other retailers: timestamped captures are displayable (labels still apply).
 */
export function isPriceDisplayAllowed(
  offer: Offer,
  programmes: AffiliateProgrammeRecord[],
  now: CompareOptions['now'],
): boolean {
  const programme = programmes.find((p) => p.programme_id === offer.affiliate_programme_id);
  const apiOnly = isAmazonOffer(offer) || programme?.price_display === 'api_only';
  if (!apiOnly) return true;
  if (offer.price_origin !== 'amazon_product_api') return false;
  const maxHours = programme?.max_price_age_hours ?? 24;
  const captured = Date.parse(offer.captured_at);
  const checked = Date.parse(offer.last_checked);
  if (Number.isNaN(captured) || Number.isNaN(checked)) return false;
  const t = nowMs(now);
  // Age is judged from the OLDER timestamp; any future-dated timestamp hides the price.
  if (captured > t || checked > t) return false;
  const age = t - Math.min(captured, checked);
  return Number.isFinite(age) && age >= 0 && age <= maxHours * HOUR_MS;
}

/* ---------- Display ---------- */

export function toAffiliateDisplayOffer(
  offer: Offer,
  product: ProductRecord,
  options: AffiliateOptions = {},
): AffiliateDisplayOffer {
  const programmes = options.programmes ?? [];
  const reason = matchOfferToProduct(offer, product);
  const modelMatch = reason === null;
  const priceAllowed = isPriceDisplayAllowed(offer, programmes, options.now);
  const stale = isStale(offer, options);
  const price = priceAllowed && isMoney(offer.price_gbp_inc_vat) ? offer.price_gbp_inc_vat : null;
  const delivery = priceAllowed && isMoney(offer.delivery_cost_gbp) ? offer.delivery_cost_gbp : null;
  const total = modelMatch ? deliveredTotal({ price_gbp_inc_vat: price, delivery_cost_gbp: delivery }) : null;
  const verified = isProductVerified(product);
  const link = resolveAffiliateLink(offer, modelMatch, programmes, options.buildEnv ?? defaultEnv(), verified);

  const labels: CatalogueOfferLabel[] = [];
  if (!modelMatch) labels.push('model_unconfirmed');
  if (!priceAllowed) labels.push('price_not_displayable');
  else {
    if (price === null) labels.push('price_missing');
    else if (!offer.price_verified) labels.push('price_unverified');
    if (delivery === null) labels.push('delivery_unknown');
    else if (!offer.delivery_verified) labels.push('delivery_unverified');
  }
  if (stale) labels.push('stale');
  if (link.link_url === null) labels.push('no_affiliate_link');

  // L6 (S1-8b): an unverified product never gets is_best_price or savings.
  const eligible = modelMatch && verified && priceAllowed && total !== null && offer.price_verified && offer.delivery_verified && !stale;
  const kit = isKitProduct(product) ? (product as KitVariant) : null;

  return {
    offer_id: offer.offer_id,
    variant_id: offer.variant_id,
    category: productCategory(product),
    retailer: offer.retailer,
    seller_name: offer.seller_name,
    availability_text: priceAllowed ? offer.availability_text : null,
    price_gbp_inc_vat: price,
    delivery_cost_gbp: delivery,
    free_delivery_threshold_gbp: priceAllowed && isMoney(offer.free_delivery_threshold_gbp) ? offer.free_delivery_threshold_gbp : null,
    delivery_text_verbatim: priceAllowed ? offer.delivery_text_verbatim : null,
    delivered_total_gbp: total,
    total_per_person_gbp: kit && total !== null ? money(total / kit.people_covered) : null,
    total_per_person_day_gbp: kit && total !== null ? money(total / (kit.people_covered * kit.days)) : null,
    delivery_known: delivery !== null,
    model_match_confirmed: modelMatch,
    price_verified: offer.price_verified,
    delivery_verified: offer.delivery_verified,
    price_display_allowed: priceAllowed,
    is_stale: stale,
    eligible_for_best_price: eligible,
    is_best_price: false,
    labels,
    label_text: labels.map((l) => CATALOGUE_LABEL_TEXT[l]),
    price_disclaimer: price !== null ? priceDisclaimer(offer) : null,
    retailer_price_disclaimer: price !== null && isAmazonOffer(offer) ? AMAZON_PRICE_DISCLAIMER : null,
    link_url: link.link_url,
    link_rel: link.link_rel,
    is_affiliate_link: link.link_url !== null,
    no_link_reason: link.no_link_reason,
    no_link_text:
      link.link_url !== null
        ? null
        : link.no_link_reason === 'exact_product_not_confirmed'
          ? NO_LINK_TEXT_EXACT_PRODUCT
          : link.no_link_reason === 'product_unverified'
            ? NO_LINK_TEXT_PRODUCT_UNVERIFIED
            : NO_LINK_TEXT,
    disclosure_text: link.disclosure_text,
    captured_at: offer.captured_at,
    last_checked: offer.last_checked,
    next_check_due: offer.next_check_due,
    source: { name: offer.source.name },
  };
}

export function toPublicProductSummary(product: ProductRecord): PublicProductSummary {
  if (isKitProduct(product)) {
    const k = product;
    return {
      variant_id: k.variant_id,
      category: 'kit',
      product_name: k.product_name,
      brand: k.brand,
      asin_uk: k.asin_uk ?? null,
      gtin: k.gtin,
      mpn: k.mpn,
      model_code: k.model_code,
      pack_quantity: null,
      verification: k.verification ?? 'unverified',
      specs: {
        people_covered: k.people_covered,
        days: k.days,
        format: k.format,
        weight_kg: k.weight_kg,
        water_litres_included: k.water_litres_included,
      },
      source_name: k.source.name,
      captured_at: k.contents_captured_at,
      display_name: null,
      display_rank: null,
      image_url: null,
      image_width: null,
      image_height: null,
      image_source: null,
    };
  }
  const p = product as CatalogueProduct;
  const specs: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(p.specs as Record<string, { value: unknown } | undefined>)) {
    if (v) specs[key] = v.value;
  }
  return {
    variant_id: p.variant_id,
    category: p.category,
    product_name: p.product_name,
    brand: p.brand,
    asin_uk: p.asin_uk,
    gtin: p.gtin,
    mpn: p.mpn,
    model_code: p.model_code,
    pack_quantity: p.pack_quantity,
    verification: p.verification,
    specs,
    source_name: p.source.name,
    captured_at: p.captured_at,
    display_name: p.display_name ?? null,
    display_rank: p.display_rank ?? null,
    image_url: p.image_url ?? null,
    image_width: p.image_width ?? null,
    image_height: p.image_height ?? null,
    image_source: p.image_source ?? null,
  };
}

/* ---------- Comparisons ---------- */

function exclusion(offer: Offer, reason: CatalogueExclusionReason): CatalogueExcludedOffer {
  return { offer_id: offer.offer_id, variant_id: offer.variant_id, retailer: offer.retailer, reason };
}

export function compareProduct(
  product: ProductRecord,
  offers: Offer[],
  options: AffiliateOptions = {},
): CatalogueComparison {
  const excluded: CatalogueExcludedOffer[] = [];
  const included: Offer[] = [];
  for (const o of offers) {
    if (o.variant_id !== product.variant_id) continue;
    const reason = matchOfferToProduct(o, product);
    if (reason === null) included.push(o);
    else excluded.push(exclusion(o, reason));
  }
  const display = sortOffers(included.map((o) => toAffiliateDisplayOffer(o, product, options)));
  const sameWindow = display.length > 0 && new Set(display.map((o) => londonDateKey(o.captured_at))).size === 1;
  const eligible = display.filter((o) => o.eligible_for_best_price);
  let savings: Savings | null = null;
  let best: AffiliateDisplayOffer | null = null;
  if (sameWindow && eligible.length >= 2) {
    savings = computeSavings(eligible[0]!, eligible[1]!);
    if (savings !== null) {
      best = eligible[0]!;
      best.is_best_price = true;
    }
  }
  const disclosures = [...new Set(display.map((o) => o.disclosure_text).filter((t): t is string => t !== null))];
  return {
    variant_id: product.variant_id,
    category: productCategory(product),
    product: toPublicProductSummary(product),
    offers: display,
    excluded,
    best_price_offer_id: best?.offer_id ?? null,
    same_capture_window: sameWindow,
    savings,
    disclosures,
  };
}

/**
 * S1-8 entry point for every category (kits included). Duplicate variant ids
 * produce empty comparisons with every offer excluded.
 */
export function buildCatalogueComparisons(
  products: ProductRecord[],
  offers: Offer[],
  options: AffiliateOptions = {},
): { comparisons: CatalogueComparison[]; unknown: CatalogueExcludedOffer[] } {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.variant_id, (counts.get(p.variant_id) ?? 0) + 1);
  const comparisons = products.map((p) => {
    const mine = offers.filter((o) => o.variant_id === p.variant_id);
    if ((counts.get(p.variant_id) ?? 0) > 1) {
      return {
        variant_id: p.variant_id,
        category: productCategory(p),
        product: toPublicProductSummary(p),
        offers: [],
        excluded: mine.map((o) => exclusion(o, 'duplicate_variant_id')),
        best_price_offer_id: null,
        same_capture_window: false,
        savings: null,
        disclosures: [],
      } satisfies CatalogueComparison;
    }
    return compareProduct(p, mine, options);
  });
  const unknown = offers.filter((o) => !counts.has(o.variant_id)).map((o) => exclusion(o, 'unknown_variant'));
  return { comparisons, unknown };
}

/* ---------- S1-10: three per category ---------- */

export interface GroupOptions {
  /** Maximum comparisons per category. Default 3. */
  perCategory?: number;
}

/**
 * S1-10 shortlist gate: the product summary is `verification: 'verified'`, passes
 * isProductVerified, and at least one offer is an exact model match (model_match_confirmed).
 */
export function isShortlistable(c: CatalogueComparison): boolean {
  return (
    c.product.verification === 'verified' &&
    isProductVerified(c.product) &&
    c.offers.some((o) => o.model_match_confirmed === true)
  );
}

/**
 * S1-10: groups comparisons by category for rendering. Accepts buildCatalogueComparisons()'s
 * result or its `comparisons` array. Keeps only isShortlistable comparisons, sorts each category
 * by display_rank ascending (unranked after ranked; ties in source order), caps at perCategory,
 * drops empty categories and returns categories in PRODUCT_CATEGORIES order.
 */
export function groupComparisonsByCategory(
  input: CatalogueComparison[] | { comparisons: CatalogueComparison[] },
  options: GroupOptions = {},
): CategoryComparisonGroup[] {
  const perCategory = options.perCategory ?? 3;
  if (!Number.isInteger(perCategory) || perCategory < 1) throw new RangeError('perCategory must be a positive integer');
  const comparisons = Array.isArray(input) ? input : input.comparisons;
  const rank = (c: CatalogueComparison) => c.product.display_rank ?? Number.POSITIVE_INFINITY;
  const groups: CategoryComparisonGroup[] = [];
  for (const category of PRODUCT_CATEGORIES) {
    const picked = comparisons
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.category === category && c.product.category === category && isShortlistable(c))
      .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
      .slice(0, perCategory)
      .map(({ c }) => c);
    if (picked.length > 0) groups.push({ category, category_label: CATEGORY_LABELS[category], comparisons: picked });
  }
  return groups;
}
