/** WEB-ADS-2 AC5: IDs come from one config module, validated; previews and dev never enable tags. */
import { describe, expect, it } from 'vitest';
import { trackingConfig } from '../../src/lib/tracking/config';

const IDS = { PUBLIC_GA4_ID: 'G-TEST000000', PUBLIC_GOOGLE_ADS_ID: 'AW-000000000', PUBLIC_META_PIXEL_ID: '000000000000000' };

describe('trackingConfig', () => {
  it('no IDs (or blank IDs): disabled', () => {
    expect(trackingConfig({}).enabled).toBe(false);
    expect(trackingConfig({ PUBLIC_GA4_ID: '', PUBLIC_GOOGLE_ADS_ID: ' ', PUBLIC_META_PIXEL_ID: '' }).enabled).toBe(false);
  });

  it('IDs on a production build: enabled with both categories', () => {
    expect(trackingConfig(IDS, { production: true })).toEqual({
      enabled: true, ga4Id: 'G-TEST000000', adsId: 'AW-000000000', pixelId: '000000000000000', analytics: true, advertising: true,
    });
    expect(trackingConfig({ ...IDS, CF_PAGES: '1', CF_PAGES_BRANCH: 'main' }, { production: true }).enabled).toBe(true);
  });

  it('one ID offers only its category', () => {
    expect(trackingConfig({ PUBLIC_GA4_ID: 'G-TEST000000' }, { production: true })).toMatchObject({ analytics: true, advertising: false });
    expect(trackingConfig({ PUBLIC_META_PIXEL_ID: '000000000000000' }, { production: true })).toMatchObject({ analytics: false, advertising: true });
  });

  it.each([
    ['a Cloudflare branch preview', { CF_PAGES: '1', CF_PAGES_BRANCH: 'web-ads-1-4-tracking' }],
    ['SITE_ENV=preview', { SITE_ENV: 'preview' }],
    ['a branch preview even with SITE_ENV=production', { SITE_ENV: 'production', CF_PAGES: '1', CF_PAGES_BRANCH: 'feature' }],
  ])('%s never enables tags', (_l, env) => {
    expect(trackingConfig({ ...IDS, ...env }, { production: true }).enabled).toBe(false);
  });

  it('a non-production (dev) build never enables tags', () => {
    expect(trackingConfig(IDS, { production: false }).enabled).toBe(false);
  });

  it.each([
    ['PUBLIC_GA4_ID', 'UA-12345-1'],
    ['PUBLIC_GA4_ID', 'g-test000000'],
    ['PUBLIC_GOOGLE_ADS_ID', 'AW-abc'],
    ['PUBLIC_GOOGLE_ADS_ID', '123456789'],
    ['PUBLIC_META_PIXEL_ID', 'pixel'],
    ['PUBLIC_META_PIXEL_ID', '123'],
  ])('rejects a malformed %s (%s) even on previews, without echoing the value', (name, value) => {
    const run = () => trackingConfig({ [name]: value, CF_PAGES: '1', CF_PAGES_BRANCH: 'x' }, { production: true });
    expect(run).toThrow(new RegExp(`${name} has an unexpected format`));
    try { run(); } catch (e) { expect(String(e)).not.toContain(value); }
  });
});
