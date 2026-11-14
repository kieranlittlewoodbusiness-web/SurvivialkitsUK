/**
 * Offer source for the comparison page (S1-2).
 *
 * Production: S1-1 seed data (`src/lib/offers/data`, validated by Backend's schema) passed through
 * `buildComparisons`, evaluated once at static build time (`now` = build time). Read-only.
 *
 * Build-time switches (never set in production):
 *   OFFERS_FIXTURES=1     add test fixtures (web scope) to exercise every state
 *   OFFERS_FIXTURES=error simulate a failed data load (error state)
 */
import { buildComparisons } from '../../lib/offers';
import type { OffersResult } from './offerModel';

export async function loadOffers(env: Record<string, string | undefined> = process.env, now = new Date()): Promise<OffersResult> {
  const mode = env.OFFERS_FIXTURES;
  const fixture = mode === '1' || mode === 'error';
  try {
    if (mode === 'error') throw new Error('Simulated offer data failure (OFFERS_FIXTURES=error)');
    // Dynamic import so invalid seed data renders the error state instead of breaking the page.
    const data = await import('../../lib/offers/data');
    let variants = data.kitVariants;
    let offers = data.kitOffers;
    let dataStatus = data.offersFile.status;
    if (mode === '1') {
      const fx = await import('./offerFixtures');
      const extra = fx.fixtureData(now);
      variants = [...variants, ...extra.variants];
      offers = [...offers, ...extra.offers];
      dataStatus = 'unverified-seed';
    }
    const { comparisons } = buildComparisons(variants, offers, { now });
    return comparisons.some((c) => c.offers.length > 0 || c.excluded.length > 0)
      ? { status: 'ok', comparisons, variants, dataStatus, fixture }
      : { status: 'empty', comparisons: [], variants, dataStatus: null, fixture };
  } catch (error) {
    return {
      status: 'error',
      comparisons: [],
      variants: [],
      dataStatus: null,
      fixture,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
