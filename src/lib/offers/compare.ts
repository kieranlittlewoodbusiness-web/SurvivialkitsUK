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
  /** Days after capture at which an offer is stale. Default 7. */
  staleAfterDays?: number;
  /** Tolerated clock skew before a timestamp counts as "in the future". Default 5 min. */
  futureSkewMs?: number;
}

const DAY_MS = 86_400_000;
const DEFAULT_FUTURE_SKEW_MS = 5 * 60_000;

const money = (n: number) => Math.round(n * 100) / 100;
const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

function nowMs(now: CompareOptions['now']): number {
  if (now === undefined) return Date.now();
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (Number.isNaN(t)) throw new RangeError('Invalid `now`');
  return t;
}

/* ---------- Identity guards ---------- */

/** Offer's MPN/GTIN (when present) agree with the variant. */
export function identifiersMatch(offer: Pick<Offer, 'mpn' | 'gtin'>, variant: KitVariant): boolean {
  const expectedMpn = variant.mpn ?? variant.model_code;
  if (offer.mpn !== null && offer.mpn !== expectedMpn) return false;
  if (offer.gtin !== null && variant.gtin !== null && offer.gtin !== variant.gtin) return false;
  return true;
}

/** Same exact variant, model confirmed, identifiers consistent. */
export function isModelMatch(offer: Offer, variant: KitVariant): boolean {
  return (
    offer.variant_id === variant.variant_id &&
    offer.model_match_confirmed === true &&
    identifiersMatch(offer, variant)
  );
}

/** variant_ids that appear more than once (a data-entry error). */
export function duplicateVariantIds(variants: KitVariant[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of variants) {
    if (seen.has(v.variant_id)) dupes.add(v.variant_id);
    seen.add(v.variant_id);
  }
  return dupes;
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
 * variant, or whose variant_id is unknown. If a variant_id is duplicated
 * (different models sharing a key) every offer for it is excluded with
 * 'duplicate_variant_id' and its group stays empty: nothing is compared.
 */
export function groupOffersByVariant(variants: KitVariant[], offers: Offer[]): GroupResult {
  const dupes = duplicateVariantIds(variants);
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
    if (dupes.has(offer.variant_id)) {
      excluded.push(exclusion(offer, 'duplicate_variant_id'));
      continue;
    }
    if (offer.model_match_confirmed !== true) {
      excluded.push(exclusion(offer, 'model_match_unconfirmed'));
      continue;
    }
    if (!identifiersMatch(offer, variant)) {
      excluded.push(exclusion(offer, 'identifier_mismatch'));
      continue;
    }
    groups.get(variant.variant_id)!.push(offer);
  }
  return { groups, excluded };
}

/* ---------- Per-offer rules ---------- */

type StaleInput = Pick<Offer, 'last_checked' | 'next_check_due'> & { captured_at?: string };

/**
 * Stale when:
 * - the OLDER of captured_at and last_checked is >= staleAfterDays old, or
 * - next_check_due has passed, or
 * - any timestamp is unparseable, or captured_at/last_checked is in the future
 *   (beyond futureSkewMs) relative to `now` (treated as a data error).
 */
export function isStale(offer: StaleInput, options: CompareOptions = {}): boolean {
  const now = nowMs(options.now);
  const days = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const skew = options.futureSkewMs ?? DEFAULT_FUTURE_SKEW_MS;
  const checked = Date.parse(offer.last_checked);
  const captured = offer.captured_at === undefined ? checked : Date.parse(offer.captured_at);
  if (Number.isNaN(checked) || Number.isNaN(captured)) return true;
  if (checked > now + skew || captured > now + skew) return true;
  const oldest = Math.min(checked, captured);
  if (now - oldest >= days * DAY_MS) return true;
  const due = Date.parse(offer.next_check_due);
  return Number.isNaN(due) || now >= due;
}

/** price inc VAT + delivery. null when either is unknown or not a finite, non-negative
 *  number (unknown delivery is NEVER 0). */
export function deliveredTotal(offer: Pick<Offer, 'price_gbp_inc_vat' | 'delivery_cost_gbp'>): number | null {
  if (!isMoney(offer.price_gbp_inc_vat) || !isMoney(offer.delivery_cost_gbp)) return null;
  return money(offer.price_gbp_inc_vat + offer.delivery_cost_gbp);
}

export function offerLabels(offer: Offer, stale: boolean, modelMatch = offer.model_match_confirmed): OfferLabel[] {
  const labels: OfferLabel[] = [];
  if (!modelMatch) labels.push('model_unconfirmed');
  if (!isMoney(offer.price_gbp_inc_vat)) labels.push('price_missing');
  else if (!offer.price_verified) labels.push('price_unverified');
  if (!isMoney(offer.delivery_cost_gbp)) labels.push('delivery_unknown');
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
    return new URL(offer.affiliate_url).protocol === 'https:' ? offer.affiliate_url : null;
  } catch {
    return null;
  }
}

/**
 * Render-safe view. Never copies `internal` (commission_rate).
 * An offer that is unconfirmed, has clashing MPN/GTIN, or belongs to a different
 * variant than the one passed is labelled model_unconfirmed, never eligible, and
 * gets NO derived totals (it is never costed as the wrong model).
 */
export function toDisplayOffer(offer: Offer, variant: KitVariant, options: CompareOptions = {}): DisplayOffer {
  const modelMatch = isModelMatch(offer, variant);
  const stale = isStale(offer, options);
  const total = modelMatch ? deliveredTotal(offer) : null;
  const deliveryKnown = isMoney(offer.delivery_cost_gbp);
  const priceKnown = isMoney(offer.price_gbp_inc_vat);
  const labels = offerLabels(offer, stale, modelMatch);
  const affiliate = approvedAffiliateUrl(offer);
  const eligible =
    modelMatch && total !== null && offer.price_verified && offer.delivery_verified && !stale;
  return {
    offer_id: offer.offer_id,
    variant_id: offer.variant_id,
    retailer: offer.retailer,
    seller_name: offer.seller_name,
    availability_text: offer.availability_text,
    price_gbp_inc_vat: priceKnown ? offer.price_gbp_inc_vat : null,
    delivery_cost_gbp: deliveryKnown ? offer.delivery_cost_gbp : null,
    free_delivery_threshold_gbp: isMoney(offer.free_delivery_threshold_gbp) ? offer.free_delivery_threshold_gbp : null,
    delivery_text_verbatim: offer.delivery_text_verbatim,
    delivered_total_gbp: total,
    total_per_person_gbp: total === null ? null : money(total / variant.people_covered),
    total_per_person_day_gbp:
      total === null ? null : money(total / (variant.people_covered * variant.days)),
    delivery_known: deliveryKnown,
    model_match_confirmed: modelMatch,
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

/**
 * 0 eligible known total, 1 known total but unverified/unconfirmed, 2 unknown delivery,
 * 3 stale known total, 4 stale unknown delivery, 5 no price.
 */
/** Fields the ranking and savings rules need (DisplayOffer and AffiliateDisplayOffer both qualify). */
export type RankableOffer = Pick<
  DisplayOffer,
  | 'offer_id'
  | 'variant_id'
  | 'price_gbp_inc_vat'
  | 'delivered_total_gbp'
  | 'is_stale'
  | 'eligible_for_best_price'
  | 'model_match_confirmed'
  | 'price_verified'
  | 'delivery_verified'
  | 'captured_at'
>;

function tier(o: RankableOffer): number {
  if (o.price_gbp_inc_vat === null) return 5;
  if (o.is_stale) return o.delivered_total_gbp === null ? 4 : 3;
  if (o.delivered_total_gbp === null) return 2;
  if (o.eligible_for_best_price) return 0;
  return 1;
}

/**
 * Sorts by verified delivered total ascending. Unknown-delivery rows come after
 * every known-total row (sorted by price among themselves) and keep their
 * `delivery_unknown` label; they are never costed as if delivery were 0.
 * Delivered totals and bare prices are never compared within one tier.
 */
export function sortOffers<T extends RankableOffer>(offers: T[]): T[] {
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
 * Saving between two rows, or null unless BOTH are model-confirmed, verified
 * (price + delivery), fresh, finite, for the same exact variant, captured on the
 * same Europe/London day, and one is strictly cheaper.
 */
export function computeSavings(a: RankableOffer, b: RankableOffer): Savings | null {
  if (a.variant_id !== b.variant_id) return null;
  if (a.offer_id === b.offer_id) return null;
  if (!a.model_match_confirmed || !b.model_match_confirmed) return null;
  if (!a.eligible_for_best_price || !b.eligible_for_best_price) return null;
  if (a.is_stale || b.is_stale || !a.price_verified || !b.price_verified || !a.delivery_verified || !b.delivery_verified) return null;
  if (!isMoney(a.delivered_total_gbp) || !isMoney(b.delivered_total_gbp)) return null;
  const day = londonDateKey(a.captured_at);
  if (day !== londonDateKey(b.captured_at)) return null;
  const [cheap, dear] = a.delivered_total_gbp <= b.delivered_total_gbp ? [a, b] : [b, a];
  const amount = money(dear.delivered_total_gbp! - cheap.delivered_total_gbp!);
  if (!(amount > 0) || !Number.isFinite(amount)) return null;
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

  // Brief s7 rule 4: every compared retailer row must share one capture window.
  const days = new Set(display.map((o) => londonDateKey(o.captured_at)));
  const sameWindow = display.length > 0 && days.size === 1;

  const eligible = display.filter((o) => o.eligible_for_best_price);
  let best: DisplayOffer | null = null;
  let savings: Savings | null = null;
  if (sameWindow && eligible.length >= 2) {
    savings = computeSavings(eligible[0]!, eligible[1]!);
    // No "best" on a tie: only when strictly cheaper than the runner-up.
    if (savings !== null) {
      best = eligible[0]!;
      best.is_best_price = true;
    }
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

/** One comparison per variant. Offers for unknown variants are returned separately.
 *  Duplicated variant ids get empty comparisons with every offer excluded. */
export function buildComparisons(
  variants: KitVariant[],
  offers: Offer[],
  options: CompareOptions = {},
): { comparisons: VariantComparison[]; unknown: ExcludedOffer[] } {
  const dupes = duplicateVariantIds(variants);
  const known = new Set(variants.map((v) => v.variant_id));
  const comparisons = variants.map((v) => {
    const mine = offers.filter((o) => o.variant_id === v.variant_id);
    if (!dupes.has(v.variant_id)) return compareVariant(v, mine, options);
    return {
      variant_id: v.variant_id,
      model_code: v.model_code,
      people_covered: v.people_covered,
      days: v.days,
      water_litres_included: v.water_litres_included,
      offers: [],
      excluded: mine.map((o) => exclusion(o, 'duplicate_variant_id')),
      best_price_offer_id: null,
      same_capture_window: false,
      savings: null,
    } satisfies VariantComparison;
  });
  const unknown = offers
    .filter((o) => !known.has(o.variant_id))
    .map((o) => exclusion(o, 'unknown_variant'));
  return { comparisons, unknown };
}
