import {
  DEFAULT_STALE_AFTER_DAYS,
  OFFER_LABEL_TEXT,
  type DisplayOffer,
  type ExcludedOffer,
  type KitVariant,
  type Offer,
  type OfferLabel,
  type Savings,
  type VariantComparison,
} from './types';
import { formatLondonDateTime, londonDateKey } from './time';

export interface CompareOptions {
  /** Injectable clock for staleness. Defaults to the current time. */
  now?: Date | string | number;
  /** Days after last_checked at which an offer is stale. Default 7. */
  staleAfterDays?: number;
}

const DAY_MS = 86_400_000;

const money = (n: number) => Math.round(n * 100) / 100;

function nowMs(now: CompareOptions['now']): number {
  if (now === undefined) return Date.now();
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (Number.isNaN(t)) throw new RangeError('Invalid `now`');
  return t;
}

/* ---------- Grouping ---------- */

export interface GroupResult {
  /** variant_id -> offers for exactly that variant. */
  groups: Map<string, Offer[]>;
  excluded: ExcludedOffer[];
}

function exclusion(offer: Offer, reason: ExcludedOffer['reason']): ExcludedOffer {
  return { offer_id: offer.offer_id, variant_id: offer.variant_id, retailer: offer.retailer, reason };
}

/**
 * Groups offers strictly by exact variant_id (case-sensitive, no normalisation).
 * Excludes offers that are not model-confirmed, whose MPN/GTIN contradict the
 * variant, or whose variant_id is unknown. Different variants never share a group.
 */
export function groupOffersByVariant(variants: KitVariant[], offers: Offer[]): GroupResult {
  const byId = new Map(variants.map((v) => [v.variant_id, v]));
  const groups = new Map<string, Offer[]>();
  for (const v of variants) groups.set(v.variant_id, []);
  const excluded: ExcludedOffer[] = [];

  for (const offer of offers) {
    const variant = byId.get(offer.variant_id);
    if (!variant) {
      excluded.push(exclusion(offer, 'unknown_variant'));
      continue;
    }
    if (offer.model_match_confirmed !== true) {
      excluded.push(exclusion(offer, 'model_match_unconfirmed'));
      continue;
    }
    const expectedMpn = variant.mpn ?? variant.model_code;
    const mpnClash = offer.mpn !== null && offer.mpn !== expectedMpn;
    const gtinClash = offer.gtin !== null && variant.gtin !== null && offer.gtin !== variant.gtin;
    if (mpnClash || gtinClash) {
      excluded.push(exclusion(offer, 'identifier_mismatch'));
      continue;
    }
    groups.get(variant.variant_id)!.push(offer);
  }
  return { groups, excluded };
}

/* ---------- Per-offer rules ---------- */

/** Stale when last_checked is >= staleAfterDays old or next_check_due has passed. */
export function isStale(offer: Pick<Offer, 'last_checked' | 'next_check_due'>, options: CompareOptions = {}): boolean {
  const now = nowMs(options.now);
  const days = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const checked = Date.parse(offer.last_checked);
  if (Number.isNaN(checked)) return true;
  if (now - checked >= days * DAY_MS) return true;
  const due = Date.parse(offer.next_check_due);
  return !Number.isNaN(due) && now >= due;
}

/** price inc VAT + delivery. null when either is unknown (unknown delivery is NEVER 0). */
export function deliveredTotal(offer: Pick<Offer, 'price_gbp_inc_vat' | 'delivery_cost_gbp'>): number | null {
  if (offer.price_gbp_inc_vat === null || offer.delivery_cost_gbp === null) return null;
  return money(offer.price_gbp_inc_vat + offer.delivery_cost_gbp);
}

export function offerLabels(offer: Offer, stale: boolean): OfferLabel[] {
  const labels: OfferLabel[] = [];
  if (offer.price_gbp_inc_vat === null) labels.push('price_missing');
  else if (!offer.price_verified) labels.push('price_unverified');
  if (offer.delivery_cost_gbp === null) labels.push('delivery_unknown');
  else if (!offer.delivery_verified) labels.push('delivery_unverified');
  if (stale) labels.push('stale');
  return labels;
}

export function priceDisclaimer(offer: Pick<Offer, 'retailer' | 'captured_at'>): string {
  return `Price at ${offer.retailer} on ${formatLondonDateTime(offer.captured_at)} UK time. Prices change.`;
}

function approvedAffiliateUrl(offer: Offer): string | null {
  if (!offer.affiliate_programme || !offer.affiliate_url.trim()) return null;
  try {
    const u = new URL(offer.affiliate_url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? offer.affiliate_url : null;
  } catch {
    return null;
  }
}

/** Render-safe view. Never copies `internal` (commission_rate). */
export function toDisplayOffer(offer: Offer, variant: KitVariant, options: CompareOptions = {}): DisplayOffer {
  const stale = isStale(offer, options);
  const total = deliveredTotal(offer);
  const deliveryKnown = offer.delivery_cost_gbp !== null;
  const labels = offerLabels(offer, stale);
  const affiliate = approvedAffiliateUrl(offer);
  const eligible =
    total !== null && offer.price_verified && offer.delivery_verified && deliveryKnown && !stale;
  return {
    offer_id: offer.offer_id,
    variant_id: offer.variant_id,
    retailer: offer.retailer,
    seller_name: offer.seller_name,
    availability_text: offer.availability_text,
    price_gbp_inc_vat: offer.price_gbp_inc_vat,
    delivery_cost_gbp: offer.delivery_cost_gbp,
    free_delivery_threshold_gbp: offer.free_delivery_threshold_gbp,
    delivery_text_verbatim: offer.delivery_text_verbatim,
    delivered_total_gbp: total,
    total_per_person_gbp: total === null ? null : money(total / variant.people_covered),
    total_per_person_day_gbp:
      total === null ? null : money(total / (variant.people_covered * variant.days)),
    delivery_known: deliveryKnown,
    price_verified: offer.price_verified,
    delivery_verified: offer.delivery_verified,
    is_stale: stale,
    eligible_for_best_price: eligible,
    is_best_price: false,
    labels,
    label_text: labels.map((l) => OFFER_LABEL_TEXT[l]),
    price_disclaimer: priceDisclaimer(offer),
    link_url: affiliate ?? offer.product_url,
    is_affiliate_link: affiliate !== null,
    product_url: offer.product_url,
    captured_at: offer.captured_at,
    last_checked: offer.last_checked,
    next_check_due: offer.next_check_due,
    source: { name: offer.source.name, url: offer.source.url },
  };
}

/* ---------- Sorting ---------- */

/** 0 verified+fresh known total, 1 known total but unverified, 2 unknown delivery, 3 stale, 4 no price. */
function tier(o: DisplayOffer): number {
  if (o.price_gbp_inc_vat === null) return 4;
  if (o.is_stale) return 3;
  if (!o.delivery_known) return 2;
  if (o.eligible_for_best_price) return 0;
  return 1;
}

/**
 * Sorts by verified delivered total ascending. Unknown-delivery rows come after
 * every known-total row (sorted by price among themselves) and keep their
 * `delivery_unknown` label; they are never costed as if delivery were 0.
 */
export function sortOffers(offers: DisplayOffer[]): DisplayOffer[] {
  return [...offers].sort((a, b) => {
    const t = tier(a) - tier(b);
    if (t !== 0) return t;
    const ka = a.delivered_total_gbp ?? a.price_gbp_inc_vat ?? Infinity;
    const kb = b.delivered_total_gbp ?? b.price_gbp_inc_vat ?? Infinity;
    if (ka !== kb) return ka - kb;
    return a.offer_id < b.offer_id ? -1 : a.offer_id > b.offer_id ? 1 : 0;
  });
}

/* ---------- Savings guard ---------- */

/**
 * Saving between two rows, or null unless BOTH are verified (price + delivery),
 * fresh, for the same exact variant and captured on the same Europe/London day.
 */
export function computeSavings(a: DisplayOffer, b: DisplayOffer): Savings | null {
  if (a.variant_id !== b.variant_id) return null;
  if (!a.eligible_for_best_price || !b.eligible_for_best_price) return null;
  if (a.delivered_total_gbp === null || b.delivered_total_gbp === null) return null;
  const day = londonDateKey(a.captured_at);
  if (day !== londonDateKey(b.captured_at)) return null;
  const [cheap, dear] = a.delivered_total_gbp <= b.delivered_total_gbp ? [a, b] : [b, a];
  const amount = money(dear.delivered_total_gbp! - cheap.delivered_total_gbp!);
  if (amount <= 0) return null;
  return { amount_gbp: amount, cheaper_offer_id: cheap.offer_id, dearer_offer_id: dear.offer_id, capture_window: day };
}

/* ---------- Comparison ---------- */

export function compareVariant(
  variant: KitVariant,
  offers: Offer[],
  options: CompareOptions = {},
): VariantComparison {
  const { groups, excluded } = groupOffersByVariant([variant], offers);
  const included = groups.get(variant.variant_id) ?? [];
  const display = sortOffers(included.map((o) => toDisplayOffer(o, variant, options)));

  const days = new Set(display.map((o) => londonDateKey(o.captured_at)));
  const sameWindow = display.length > 0 && days.size === 1;

  const eligible = display.filter((o) => o.eligible_for_best_price);
  const eligibleSameDay = new Set(eligible.map((o) => londonDateKey(o.captured_at))).size === 1;
  let best: DisplayOffer | null = null;
  let savings: Savings | null = null;
  if (eligible.length >= 2 && eligibleSameDay) {
    best = eligible[0]!;
    best.is_best_price = true;
    savings = computeSavings(eligible[0]!, eligible[1]!);
  }

  return {
    variant_id: variant.variant_id,
    model_code: variant.model_code,
    people_covered: variant.people_covered,
    days: variant.days,
    water_litres_included: variant.water_litres_included,
    offers: display,
    // Offers for other variants are not this variant's exclusions.
    excluded: excluded.filter((e) => e.reason !== 'unknown_variant'),
    best_price_offer_id: best?.offer_id ?? null,
    same_capture_window: sameWindow,
    savings,
  };
}

/** One comparison per variant. Offers for unknown variants are returned separately. */
export function buildComparisons(
  variants: KitVariant[],
  offers: Offer[],
  options: CompareOptions = {},
): { comparisons: VariantComparison[]; unknown: ExcludedOffer[] } {
  const known = new Set(variants.map((v) => v.variant_id));
  const comparisons = variants.map((v) =>
    compareVariant(v, offers.filter((o) => o.variant_id === v.variant_id), options),
  );
  const unknown = offers
    .filter((o) => !known.has(o.variant_id))
    .map((o) => exclusion(o, 'unknown_variant'));
  return { comparisons, unknown };
}
