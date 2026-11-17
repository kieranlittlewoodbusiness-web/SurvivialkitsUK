/** WEB-ADS-4: privacy-page cookie table rows. */
import { describe, expect, it } from 'vitest';
import { advertisingDescription, cookieRows, privacyLines } from '../../src/lib/tracking/cookies';

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

describe('Advertising description (copy review 17 Nov)', () => {
  it.each([
    [{ adsId: 'AW-123456', pixelId: '1234567890' }, 'Google Ads and the Meta Pixel measure whether our adverts lead to visits and clicks to Amazon.'],
    [{ adsId: 'AW-123456', pixelId: null }, 'Google Ads measures whether our adverts lead to visits and clicks to Amazon.'],
    [{ adsId: null, pixelId: '1234567890' }, 'The Meta Pixel measures whether our adverts lead to visits and clicks to Amazon.'],
  ])('%o', (ids, text) => {
    expect(advertisingDescription(ids)).toBe(text);
  });
});

describe('tool-dependent privacy lines (CR M1, PM K55)', () => {
  const APPROVED = {
    description: 'Privacy notice for UK Survival Kits: optional analytics and advertising cookies, what arrives if you email us, and how to change your cookie choices.',
    intro: 'With your permission, we use the analytics and advertising tools listed under Cookies below. They stay off until you choose to turn them on, and you can change your mind at any time.',
    choices: 'Optional cookies are off until you choose them in the cookie banner. Reject all keeps them off. Accept all turns on every tool in the table. Manage lets you choose analytics and advertising separately.',
    consent: 'We use optional analytics and advertising cookies only with your consent, which you can withdraw at any time through Cookie settings. If you email us, we use what you send to reply to you.',
    transfers: 'Google and Meta may process this data outside the UK, including in the United States, under their own safeguards.',
  };
  const cfg = (ga4: boolean, ads: boolean, pixel: boolean) => ({
    ga4Id: ga4 ? 'G-X1234' : null, adsId: ads ? 'AW-123456' : null, pixelId: pixel ? '1234567890' : null,
    analytics: ga4, advertising: ads || pixel,
  });

  it('all three tools: exactly the approved sentences', () => {
    expect(privacyLines(cfg(true, true, true))).toEqual(APPROVED);
  });

  it.each([
    ['GA4 only', cfg(true, false, false), 'analytics', 'Google'],
    ['Pixel only', cfg(false, false, true), 'advertising', 'Meta'],
    ['Ads only', cfg(false, true, false), 'advertising', 'Google'],
    ['GA4 + Ads', cfg(true, true, false), 'analytics and advertising', 'Google'],
    ['Ads + Pixel', cfg(false, true, true), 'advertising', 'Google and Meta'],
    ['GA4 + Pixel', cfg(true, false, true), 'analytics and advertising', 'Google and Meta'],
  ])('%s: only the category and provider names change', (_l, t, cats, providers) => {
    const single = cats !== 'analytics and advertising';
    expect(privacyLines(t)).toEqual({
      description: APPROVED.description.replace('analytics and advertising', cats),
      intro: APPROVED.intro.replace('analytics and advertising', cats),
      choices: single ? APPROVED.choices.replace(' Manage lets you choose analytics and advertising separately.', '') : APPROVED.choices,
      consent: APPROVED.consent.replace('analytics and advertising', cats),
      transfers: APPROVED.transfers.replace('Google and Meta', providers),
    });
  });
});

it('single-category meta descriptions stay inside the 120-160 character check:content range', () => {
  for (const [analytics, advertising] of [[true, false], [false, true], [true, true]]) {
    const n = privacyLines({ ga4Id: analytics ? 'G-X1234' : null, adsId: advertising ? 'AW-123456' : null, pixelId: null, analytics, advertising }).description.length;
    expect(n).toBeGreaterThanOrEqual(120);
    expect(n).toBeLessThanOrEqual(160);
  }
});
