/** S1-2 build guards kept from compare/build-guards.test.ts (PR #9 review L2). */
import { describe, expect, it } from 'vitest';
import { isPreviewBuild, siteEnv } from '../data/site';

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
