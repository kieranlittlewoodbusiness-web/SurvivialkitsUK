/**
 * PROVISIONAL view model for S1-2 (web), owned by the web ticket.
 *
 * The real data contract belongs to S1-1 (`src/lib/offers`, posted on issue #2). Until it lands,
 * the comparison page reads offers through this file only, so swapping in the backend module is a
 * one-file change (`loadOffers` + `classifyOffer`). Field names follow the S1-1 acceptance
 * criteria. This file never ranks across variants and never computes savings.
 */
import { z } from 'zod';

/** One offer row: kit variant × retailer × capture. Mirrors the S1-1 acceptance criteria. */
export const offerSchema = z.object({
  variantId: z.string().min(1),
  retailer: z.string().min(1),
  /** GBP including VAT. */
  priceGbpIncVat: z.number().nonnegative(),
  /** `null` means delivery cost is unknown. Never treated as £0. */
  deliveryGbp: z.number().nonnegative().nullable(),
  priceVerified: z.boolean(),
  deliveryVerified: z.boolean(),
  /** Verbatim from the retailer. */
  availabilityText: z.string(),
  /** Exact programme URL. Empty until the affiliate programme is approved. */
  affiliateUrl: z.string(),
  /** Non-affiliate product URL, used when affiliateUrl is empty. */
  productUrl: z.url(),
  sourceName: z.string().min(1),
  sourceUrl: z.url(),
  /** ISO 8601 with offset, captured in Europe/London. */
  lastChecked: z.iso.datetime({ offset: true }),
  nextCheckDue: z.iso.datetime({ offset: true }),
});

export type Offer = z.infer<typeof offerSchema>;

export type OfferState = 'verified' | 'unverified-price' | 'unknown-delivery' | 'unverified-delivery' | 'stale';

export const STALE_AFTER_DAYS = 7;

export type OffersResult =
  | { status: 'ok'; offers: Offer[]; fixture: boolean }
  | { status: 'empty'; offers: []; fixture: boolean }
  | { status: 'error'; offers: []; fixture: boolean; message: string };

/**
 * State of one offer at build time. Order of checks matters: stale beats everything, then an
 * unverified price, then delivery. Only `verified` rows can be shown as a best delivered price.
 */
export function classifyOffer(offer: Offer, now: Date = new Date()): OfferState {
  const ageMs = now.getTime() - new Date(offer.lastChecked).getTime();
  if (ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000) return 'stale';
  if (!offer.priceVerified) return 'unverified-price';
  if (offer.deliveryGbp === null) return 'unknown-delivery';
  if (!offer.deliveryVerified) return 'unverified-delivery';
  return 'verified';
}

export type OfferRow = Offer & { state: OfferState; totalGbp: number | null };

export interface VariantOffers {
  /** Lowest verified delivered total for this exact variant, if any (same object as in `rows`). */
  best: (OfferRow & { totalGbp: number }) | null;
  /** All rows for this variant: verified by total, then known totals, then unknown delivery. */
  rows: OfferRow[];
}

/** Offers for one exact variant id. Never mixes variants. */
export function offersForVariant(offers: Offer[], variantId: string, now: Date = new Date()): VariantOffers {
  const rows = offers
    .filter((o) => o.variantId === variantId)
    .map((o): OfferRow => {
      const state = classifyOffer(o, now);
      const totalGbp = o.deliveryGbp === null ? null : o.priceGbpIncVat + o.deliveryGbp;
      return { ...o, state, totalGbp };
    })
    .sort((a, b) => {
      const rank = (r: typeof a) => (r.state === 'verified' ? 0 : r.totalGbp !== null ? 1 : 2);
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      return (a.totalGbp ?? Number.POSITIVE_INFINITY) - (b.totalGbp ?? Number.POSITIVE_INFINITY);
    });

  const best = rows.find((r): r is OfferRow & { totalGbp: number } => r.state === 'verified' && r.totalGbp !== null);
  return { best: best ?? null, rows };
}

export function formatGbp(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

/** e.g. "14 Nov 2026, 22:50 GMT" in Europe/London. */
export function formatUkDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(new Date(iso));
}

export const stateLabels: Record<OfferState, { label: string; detail: string }> = {
  verified: { label: 'Verified', detail: 'Price and delivery checked at the retailer.' },
  'unverified-price': {
    label: 'Price not verified',
    detail: 'We could not confirm this price for this exact model. Not used as a best price.',
  },
  'unknown-delivery': {
    label: 'Delivery unknown',
    detail: 'Delivery cost not known, so no delivered total. Not used as a best price.',
  },
  'unverified-delivery': {
    label: 'Delivery not verified',
    detail: 'Delivery cost not confirmed. Not used as a best price.',
  },
  stale: {
    label: `Stale (over ${STALE_AFTER_DAYS} days old)`,
    detail: 'This price is out of date. Check the retailer. Not used as a best price.',
  },
};
