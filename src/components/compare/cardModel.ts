/**
 * Card-face decisions for KitCard (S1-2b). Pure functions over the S1-1 `VariantComparison`,
 * read-only: never re-sorts (`comparison.offers` order is the API's), never derives a best price.
 */
import type { DisplayOffer, VariantComparison } from '../../lib/offers';

export type FaceOffer =
  | { kind: 'best'; offer: DisplayOffer }
  | { kind: 'held'; offer: DisplayOffer }
  | null;

/** The API's best row, used only if it is internally consistent (flagged best, model confirmed, no labels). */
export function bestOffer(comparison: VariantComparison | undefined): DisplayOffer | undefined {
  if (!comparison?.best_price_offer_id) return undefined;
  const row = comparison.offers.find((o) => o.offer_id === comparison.best_price_offer_id);
  return row && row.is_best_price && row.model_match_confirmed && row.labels.length === 0 && row.delivered_total_gbp !== null
    ? row
    : undefined;
}

/**
 * What goes on the card face:
 * - the API's best price, if there is one;
 * - otherwise the first held offer with a price, in the API's order (shown with its labels,
 *   never as best or verified-best);
 * - otherwise nothing.
 */
export function faceOffer(comparison: VariantComparison | undefined): FaceOffer {
  const best = bestOffer(comparison);
  if (best) return { kind: 'best', offer: best };
  const held = comparison?.offers.find((o) => o.price_gbp_inc_vat !== null);
  return held ? { kind: 'held', offer: held } : null;
}

/** Rows not on the face, API order kept. */
export function otherOffers(comparison: VariantComparison | undefined, face: FaceOffer): DisplayOffer[] {
  return (comparison?.offers ?? []).filter((o) => o !== face?.offer);
}

/**
 * Affiliate-only outbound links (Kieran's ruling on #3): an offer gets a retailer link only when
 * the contract says the link is a programme affiliate URL. Otherwise the UI shows
 * "Retailer link coming soon" as plain text.
 */
export function affiliateHref(offer: DisplayOffer): string | null {
  if (!offer.is_affiliate_link) return null;
  const url = offer.link_url.trim();
  if (!/^https:\/\//i.test(url)) return null;
  return url;
}

function host(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/** Display host for a URL shown as text, e.g. "evaq8.co.uk". */
export function displayHost(url: string): string {
  return host(url) ?? url;
}
