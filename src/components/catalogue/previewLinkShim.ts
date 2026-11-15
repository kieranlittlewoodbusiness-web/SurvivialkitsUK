/**
 * TEMPORARY TYPE SHIM, REMOVE ON REBASE ONTO S1-8c (PR #15, 03888e7).
 * PR #15 adds `preview_link_url?: string | null` to AffiliateDisplayOffer (tagless
 * https://www.amazon.co.uk/dp/<ASIN>, set only when SITE_ENV=preview). Until it merges, the
 * field is read through this single adapter. A rename is a one-line change here.
 */
import type { AffiliateDisplayOffer } from '../../lib/offers';

export const PREVIEW_LINK_FIELD = 'preview_link_url' as const;

export type DisplayOfferWithPreview = AffiliateDisplayOffer & { [PREVIEW_LINK_FIELD]?: string | null };

export function previewLinkOf(offer: DisplayOfferWithPreview): string | null {
  const v = offer[PREVIEW_LINK_FIELD];
  return typeof v === 'string' ? v : null;
}
