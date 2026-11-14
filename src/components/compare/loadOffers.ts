/**
 * Offer source for the comparison page (S1-2).
 *
 * Production: S1-1 seed data (`src/lib/offers/data`, validated by Backend's schema) passed through
 * `buildComparisons`, evaluated once at static build time (`now` = build time). Read-only.
 * Any data/validation failure is rethrown so the build fails loudly (no green build with an
 * error banner).
 *
 * Build-time switches, PREVIEW BUILDS ONLY (see isPreviewBuild). In any other build they throw:
 *   OFFERS_FIXTURES=1     add test fixtures (web scope) to exercise every state
 *   OFFERS_FIXTURES=error render the error state (the only way to reach it)
 */
import { buildComparisons } from '../../lib/offers';
import { isPreviewBuild } from '../../data/site';
import type { OffersResult } from './offerModel';

type Env = Record<string, string | undefined>;

export function fixtureMode(env: Env): '1' | 'error' | null {
  const mode = env.OFFERS_FIXTURES;
  if (mode === undefined || mode === '') return null;
  if (mode !== '1' && mode !== 'error') {
    throw new Error(`Unknown OFFERS_FIXTURES "${mode}". Use "1", "error" or leave it unset.`);
  }
  if (!isPreviewBuild(env)) {
    throw new Error(
      'OFFERS_FIXTURES is only allowed in preview builds (SITE_ENV=preview, or a Cloudflare Pages ' +
        'branch other than the production branch). Refusing to publish test prices in an indexable build.',
    );
  }
  return mode;
}

export async function loadOffers(env: Env = process.env, now = new Date()): Promise<OffersResult> {
  const mode = fixtureMode(env);
  const fixture = mode !== null;
  if (mode === 'error') {
    return {
      status: 'error',
      comparisons: [],
      variants: [],
      dataStatus: null,
      fixture,
      message: 'Simulated offer data failure (OFFERS_FIXTURES=error, preview only)',
    };
  }

  // Not caught: invalid seed data must fail the build.
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
}
