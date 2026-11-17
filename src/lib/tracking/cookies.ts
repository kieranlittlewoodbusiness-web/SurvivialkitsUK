/**
 * WEB-ADS-4: privacy-page cookie table rows, one per configured tool.
 * Names and lifetimes only from the vendors' own pages (checked 17 Nov 2026):
 * - GA4: https://support.google.com/analytics/answer/11397207 (_ga, _ga_<container-id>: 2 years)
 * - Google Ads: https://business.safety.google/adscookies/ (_gcl_au, _gcl_aw, _gcl_gs: 90 days;
 *   Google domains such as doubleclick.net and googleadservices.com)
 * - Meta: https://www.facebook.com/privacy/policies/cookies/ (_fbp, _fbc: 90 days; fr: 90 days)
 */
import type { TrackingConfig } from './config';

export interface CookieRow {
  tool: string;
  purpose: string;
  cookies: string;
  recipient: string;
}

export function cookieRows(t: Pick<TrackingConfig, 'ga4Id' | 'adsId' | 'pixelId'>): CookieRow[] {
  const rows: CookieRow[] = [];
  if (t.ga4Id) {
    rows.push({
      tool: 'Google Analytics (analytics)',
      purpose: 'Counts visits and which pages and Amazon links people use, so we can improve the guides.',
      cookies: '_ga (2 years) and _ga_ followed by our measurement ID (2 years), set on this site.',
      recipient: 'Google',
    });
  }
  if (t.adsId) {
    rows.push({
      tool: 'Google Ads (advertising)',
      purpose: 'Measures whether people who click our Google adverts go on to read the site and click through to Amazon.',
      cookies:
        '_gcl_au, _gcl_aw and _gcl_gs (90 days each), set on this site. Google may also use cookies on its own domains, such as doubleclick.net and googleadservices.com.',
      recipient: 'Google',
    });
  }
  if (t.pixelId) {
    rows.push({
      tool: 'Meta Pixel (advertising)',
      purpose: 'Measures whether people who see our Facebook or Instagram adverts visit the site and click through to Amazon.',
      cookies: '_fbp and _fbc (90 days each), set on this site. Meta may also use its own cookies, such as fr (90 days).',
      recipient: 'Meta',
    });
  }
  return rows;
}
