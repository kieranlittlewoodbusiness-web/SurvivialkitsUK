/**
 * Site-wide configuration for The Household Brief.
 * Production canonical host: uksurvivalkits.uk
 */
export const site = {
  name: 'The Household Brief',
  tagline: 'Practical household planning for disruption',
  description:
    'Independent guides to household readiness in the UK, grounded in official advice and practical product criteria.',
  /** Production canonical origin (no trailing slash). */
  siteUrl: 'https://uksurvivalkits.uk',
  locale: 'en-GB',
  author: 'The Household Brief',
  contactEmail: 'editors@uksurvivalkits.uk',
  /**
   * Set true only after Amazon Associates approval and when live Amazon
   * tracking URLs are present in retailerOffers.json.
   */
  amazonAssociatesLive: false,
  amazonAssociatesIdPlaceholder: 'YOUR-ASSOCIATES-TAG',
} as const;

export type SiteConfig = typeof site;

/** Canonical path of the Sprint 1 comparison page (trailing slash is intentional). */
export const comparePath = '/compare/72-hour-emergency-kits/';

/**
 * Build-time deployment check, used to keep previews out of search.
 *
 * A build is treated as a preview (noindex + robots.txt Disallow) when:
 * - SITE_ENV=preview is set explicitly (use this for `wrangler pages deploy --branch` previews), or
 * - it runs on Cloudflare Pages (CF_PAGES=1) for a branch other than PRODUCTION_BRANCH (default `main`).
 *
 * Any other build (including a plain local `npm run build`) stays indexable, so a production
 * deploy can never be de-indexed by a missing variable. The `_headers` rule for *.pages.dev hosts
 * is the second, host-based layer and applies whatever the build settings were.
 */
export function isPreviewBuild(env: Record<string, string | undefined> = process.env): boolean {
  if (env.SITE_ENV === 'preview') return true;
  if (env.SITE_ENV === 'production') return false;
  const productionBranch = env.PRODUCTION_BRANCH || 'main';
  return env.CF_PAGES === '1' && !!env.CF_PAGES_BRANCH && env.CF_PAGES_BRANCH !== productionBranch;
}
