/**
 * Offer source for the comparison page (S1-2).
 *
 * TODO(S1-1): replace the body with a read-only import from `src/lib/offers` once Backend's
 * contract is posted on issue #2 / merged. Do not edit `src/lib/offers` from this ticket.
 *
 * Build-time switches (never set in production):
 *   OFFERS_FIXTURES=1     render the EXAMPLE fixtures (all offer states)
 *   OFFERS_FIXTURES=error simulate a failed/invalid data load (error state)
 */
import { z } from 'zod';
import { offerSchema, type OffersResult } from './offerModel';
import { exampleOffers } from './offerFixtures';

export function loadOffers(env: Record<string, string | undefined> = process.env, now = new Date()): OffersResult {
  const mode = env.OFFERS_FIXTURES;
  try {
    if (mode === 'error') throw new Error('Simulated offer data failure (OFFERS_FIXTURES=error)');
    // No live source yet: production builds render the empty state.
    const raw: unknown = mode === '1' ? exampleOffers(now) : [];
    const offers = z.array(offerSchema).parse(raw);
    const fixture = mode === '1';
    return offers.length > 0 ? { status: 'ok', offers, fixture } : { status: 'empty', offers: [], fixture };
  } catch (error) {
    return {
      status: 'error',
      offers: [],
      fixture: mode === 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
