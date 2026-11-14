/**
 * Site-wide configuration for The Household Brief.
 * Update `siteUrl` to the real Cloudflare Pages / custom domain before launch.
 */
export const site = {
  name: 'The Household Brief',
  tagline: 'Practical household planning for disruption',
  description:
    'Independent guides to household readiness in the UK, grounded in official advice and practical product criteria.',
  /** Production canonical origin (no trailing slash). */
  siteUrl: 'https://www.thehouseholdbrief.co.uk',
  locale: 'en-GB',
  author: 'The Household Brief',
  contactEmail: 'editors@thehouseholdbrief.co.uk',
  /**
   * Set true only after Amazon Associates approval and when live Amazon
   * tracking URLs are present in retailerOffers.json.
   */
  amazonAssociatesLive: false,
  amazonAssociatesIdPlaceholder: 'YOUR-ASSOCIATES-TAG',
} as const;

export type SiteConfig = typeof site;
