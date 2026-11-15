/**
 * S1-2 build guards (PR #9 review M1, L2, L4). Runs under the project's `npm test` (vitest).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPreviewBuild, siteEnv } from '../../data/site';
import { loadOffers } from './loadOffers';

const NOW = new Date('2026-11-15T12:00:00+00:00');

afterEach(() => {
  vi.doUnmock('../../lib/offers/data');
  vi.resetModules();
});

describe('SITE_ENV validation (L2)', () => {
  it('unset or empty keeps the default (indexable unless a CF branch preview)', () => {
    expect(siteEnv({})).toBeUndefined();
    expect(siteEnv({ SITE_ENV: '' })).toBeUndefined();
    expect(isPreviewBuild({})).toBe(false);
    expect(isPreviewBuild({ CF_PAGES: '1', CF_PAGES_BRANCH: 'main' })).toBe(false);
    expect(isPreviewBuild({ CF_PAGES: '1', CF_PAGES_BRANCH: 's1-2-web-pages' })).toBe(true);
  });

  it('accepts preview and production', () => {
    expect(isPreviewBuild({ SITE_ENV: 'preview' })).toBe(true);
    expect(isPreviewBuild({ SITE_ENV: 'production' })).toBe(false);
  });

  it('a Cloudflare branch preview stays noindex even if SITE_ENV=production is set project-wide', () => {
    expect(isPreviewBuild({ SITE_ENV: 'production', CF_PAGES: '1', CF_PAGES_BRANCH: 'feature-x' })).toBe(true);
  });

  it.each(['Preview', 'staging', 'prod', 'bogus'])('rejects unknown SITE_ENV=%s', (value) => {
    expect(() => siteEnv({ SITE_ENV: value })).toThrow(/Unknown SITE_ENV/);
    expect(() => isPreviewBuild({ SITE_ENV: value })).toThrow(/Unknown SITE_ENV/);
  });
});

describe('loadOffers fixture gating (M1)', () => {
  it('production + OFFERS_FIXTURES=1 throws', async () => {
    await expect(loadOffers({ OFFERS_FIXTURES: '1', SITE_ENV: 'production' }, NOW)).rejects.toThrow(/only allowed in preview/);
  });

  it('unset SITE_ENV (plain build) + OFFERS_FIXTURES=1 throws', async () => {
    await expect(loadOffers({ OFFERS_FIXTURES: '1' }, NOW)).rejects.toThrow(/only allowed in preview/);
  });

  it('production + OFFERS_FIXTURES=error throws', async () => {
    await expect(loadOffers({ OFFERS_FIXTURES: 'error', SITE_ENV: 'production' }, NOW)).rejects.toThrow(/only allowed in preview/);
  });

  it('rejects an unknown OFFERS_FIXTURES value', async () => {
    await expect(loadOffers({ OFFERS_FIXTURES: 'yes', SITE_ENV: 'preview' }, NOW)).rejects.toThrow(/Unknown OFFERS_FIXTURES/);
  });

  it('preview + OFFERS_FIXTURES=1 uses fixtures', async () => {
    const result = await loadOffers({ OFFERS_FIXTURES: '1', SITE_ENV: 'preview' }, NOW);
    expect(result.status).toBe('ok');
    expect(result.fixture).toBe(true);
    const ids = result.comparisons.map((c) => c.variant_id);
    expect(ids).toContain('evaq8-e184');
    const e184 = result.comparisons.find((c) => c.variant_id === 'evaq8-e184')!;
    expect(e184.best_price_offer_id).toBe('fx-e184-evaq8');
  });

  it('preview + OFFERS_FIXTURES=error renders the error state', async () => {
    const result = await loadOffers({ OFFERS_FIXTURES: 'error', SITE_ENV: 'preview' }, NOW);
    expect(result.status).toBe('error');
  });

  it('no fixtures => real S1-1 data only (no fixture ids, no example.com links)', async () => {
    const result = await loadOffers({}, NOW);
    expect(result.fixture).toBe(false);
    expect(result.status).toBe('ok');
    const offers = result.comparisons.flatMap((c) => c.offers);
    expect(offers.every((o) => !o.offer_id.startsWith('fx-'))).toBe(true);
    expect(offers.every((o) => !o.link_url.includes('example.com'))).toBe(true);
    expect(result.comparisons.map((c) => c.variant_id)).toEqual(['evaq8-e182p']);
  });
});

describe('loadOffers data failures (L4)', () => {
  it('outside fixture mode, invalid seed data fails (rethrows) instead of rendering an error state', async () => {
    vi.resetModules();
    // data.ts validates at import time; simulate that failure surfacing when the data is read.
    vi.doMock('../../lib/offers/data', () => ({
      get kitVariants(): never {
        throw new Error('seed failed validation');
      },
      kitOffers: [],
      offersFile: { status: 'unverified-seed' },
    }));
    const { loadOffers: load } = await import('./loadOffers');
    // Must reject (failing the build); it must not resolve to an 'error' result.
    const outcome = await load({}, NOW).then(
      (r) => ({ resolved: r.status }),
      (e: unknown) => ({ rejected: String(e instanceof Error ? `${e.message} ${String((e as { cause?: unknown }).cause ?? '')}` : e) }),
    );
    expect(outcome).not.toHaveProperty('resolved');
    expect(outcome).toHaveProperty('rejected');
  });
});
