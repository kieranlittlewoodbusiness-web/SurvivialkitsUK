/**
 * Web-side view helpers for the comparison page.
 *
 * All offer types and rules come from S1-1 (`src/lib/offers`, PR #8), imported read-only.
 * The UI renders `VariantComparison` exactly as `buildComparisons` returns it: it never computes
 * a best price, savings, staleness or exclusions itself, and never sees `Offer.internal`.
 */
export type {
  DisplayOffer,
  ExclusionReason,
  KitVariant as OfferKitVariant,
  OfferLabel,
  VariantComparison,
} from '../../lib/offers';
export { OFFER_LABEL_TEXT, formatLondonDateTime } from '../../lib/offers';
import type { ExclusionReason, VariantComparison, KitVariant } from '../../lib/offers';

export type OffersResult =
  | {
      status: 'ok';
      comparisons: VariantComparison[];
      variants: KitVariant[];
      /** 'unverified-seed' until an approved source backs every row. */
      dataStatus: 'unverified-seed' | 'verified';
      fixture: boolean;
    }
  | { status: 'empty'; comparisons: []; variants: KitVariant[]; dataStatus: null; fixture: boolean }
  | { status: 'error'; comparisons: []; variants: []; dataStatus: null; fixture: boolean; message: string };

export function formatGbp(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

export const exclusionText: Record<ExclusionReason, string> = {
  model_match_unconfirmed: 'listing not confirmed as this exact model',
  identifier_mismatch: 'product code does not match this model',
  unknown_variant: 'not matched to a model we compare',
};
