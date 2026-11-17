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

/** Manage-panel Advertising description: "measures" for one tool, "measure" for both (copy review 17 Nov). */
export function advertisingDescription(t: Pick<TrackingConfig, 'adsId' | 'pixelId'>): string {
  const subject = t.adsId && t.pixelId ? 'Google Ads and the Meta Pixel measure' : t.adsId ? 'Google Ads measures' : 'The Meta Pixel measures';
  return `${subject} whether our adverts lead to visits and clicks to Amazon.`;
}

/**
 * Tool-dependent /privacy/ copy (copy review 17 Nov; CR M1; PM K55 13:53). With both categories
 * and both providers configured these are exactly the approved sentences; otherwise only the
 * category and provider names change, and the Manage sentence is dropped when there is only one
 * category to choose.
 */
export function privacyLines(t: Pick<TrackingConfig, 'ga4Id' | 'adsId' | 'pixelId' | 'analytics' | 'advertising'>) {
  const categories = [t.analytics && 'analytics', t.advertising && 'advertising'].filter(Boolean).join(' and ');
  const providers = [...new Set(cookieRows(t).map((r) => r.recipient))].join(' and ');
  const both = t.analytics && t.advertising;
  return {
    description: `Privacy notice for UK Survival Kits: optional ${categories} cookies, what arrives if you email us, and how to change your cookie choices.`,
    intro: `With your permission, we use the ${categories} tools listed under Cookies below. They stay off until you choose to turn them on, and you can change your mind at any time.`,
    choices: `Optional cookies are off until you choose them in the cookie banner. Reject all keeps them off. Accept all turns on every tool in the table.${both ? ' Manage lets you choose analytics and advertising separately.' : ''}`,
    consent: `We use optional ${categories} cookies only with your consent, which you can withdraw at any time through Cookie settings. If you email us, we use what you send to reply to you.`,
    transfers: `${providers} may process this data outside the UK, including in the United States, under their own safeguards.`,
  };
}
