/** WEB-ADS-4: privacy-page cookie table rows. */
import { describe, expect, it } from 'vitest';
import { cookieRows } from '../../src/lib/tracking/cookies';

describe('cookie table rows (WEB-ADS-4)', () => {
  it('one row per configured tool, in a fixed order', () => {
    expect(cookieRows({ ga4Id: 'G-X1234', adsId: 'AW-123456', pixelId: '1234567890' }).map((r) => r.tool)).toEqual([
      'Google Analytics (analytics)', 'Google Ads (advertising)', 'Meta Pixel (advertising)',
    ]);
    expect(cookieRows({ ga4Id: null, adsId: null, pixelId: '1234567890' }).map((r) => r.recipient)).toEqual(['Meta']);
    expect(cookieRows({ ga4Id: null, adsId: null, pixelId: null })).toEqual([]);
  });

  it('only names cookies from the vendor docs cited in cookies.ts', () => {
    const text = cookieRows({ ga4Id: 'G-X1234', adsId: 'AW-123456', pixelId: '1234567890' }).map((r) => r.cookies).join(' ');
    const names = [...new Set(text.match(/(?<![\w.])_[a-z_]+/g))];
    expect(names.sort()).toEqual(['_fbc', '_fbp', '_ga', '_ga_', '_gcl_au', '_gcl_aw', '_gcl_gs']);
    expect(text).toContain('fr (90 days)');
  });
});
