/**
 * Offer source for the comparison page (S1-2). Returns S1-1 contract v1 `VariantComparison`s.
 *
 * TODO(S1-1 merged): call the `src/lib/offers` comparison function (read-only) here instead of
 * returning nothing. Do not edit `src/lib/offers` from this ticket.
 *
 * Build-time switches (never set in production):
 *   OFFERS_FIXTURES=1     render the test fixtures (all offer states)
 *   OFFERS_FIXTURES=error simulate a failed data load (error state)
 */
import type { OffersResult, VariantComparison } from './offerModel';
import { exampleComparisons } from './offerFixtures';

export function loadOffers(env: Record<string, string | undefined> = process.env, now = new Date()): OffersResult {
  const mode = env.OFFERS_FIXTURES;
  const fixture = mode === '1' || mode === 'error';
  try {
    if (mode === 'error') throw new Error('Simulated offer data failure (OFFERS_FIXTURES=error)');
    // No merged S1-1 source yet: production builds render the empty state.
    const comparisons: VariantComparison[] = mode === '1' ? exampleComparisons(now) : [];
    if (!Array.isArray(comparisons)) throw new Error('Offer data is not a list');
    return comparisons.some((c) => c.offers.length > 0)
      ? { status: 'ok', comparisons, fixture }
      : { status: 'empty', comparisons: [], fixture };
  } catch (error) {
    return { status: 'error', comparisons: [], fixture, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}
