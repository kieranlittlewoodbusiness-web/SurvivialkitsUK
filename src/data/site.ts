/**
 * Site-wide configuration for U.K. Survival Kit Brief.
 * Production canonical host: uksurvivalkits.uk
 */
export const site = {
  name: 'U.K. Survival Kit Brief',
  tagline: 'Calm, practical readiness for UK homes',
  description:
    'Independent guides to household readiness in the UK, grounded in official advice and practical product criteria.',
  /** Production canonical origin (no trailing slash). */
  siteUrl: 'https://uksurvivalkits.uk',
  locale: 'en-GB',
  author: 'U.K. Survival Kit Brief',
  contactEmail: 'editors@uksurvivalkits.uk',
} as const;

export type SiteConfig = typeof site;

/** Canonical path of the Sprint 1 comparison page (trailing slash is intentional). */
export const comparePath = '/compare/72-hour-emergency-kits/';

type Env = Record<string, string | undefined>;

/**
 * Validated SITE_ENV. Unset/empty -> undefined (default behaviour); 'preview' | 'production' as
 * given; anything else (typos such as 'Preview' or 'staging') fails the build instead of silently
 * falling back to the indexable production state.
 */
export function siteEnv(env: Env = process.env): 'preview' | 'production' | undefined {
  const raw = env.SITE_ENV;
  if (raw === undefined || raw === '') return undefined;
  if (raw === 'preview' || raw === 'production') return raw;
  throw new Error(
    `Unknown SITE_ENV "${raw}". Use "preview", "production" or leave it unset.`,
  );
}

/**
 * Build-time deployment check, used to keep previews out of search.
 *
 * A build is a preview (noindex + robots.txt Disallow) when:
 * - SITE_ENV=preview, or
 * - it runs on Cloudflare Pages (CF_PAGES=1) for a branch other than PRODUCTION_BRANCH (default
 *   `main`). This wins even over SITE_ENV=production, so a project-wide SITE_ENV cannot make
 *   branch previews indexable.
 *
 * Otherwise (including a plain local `npm run build`) the build stays indexable, so a production
 * deploy can never be de-indexed by a missing variable. The `_headers` rule for *.pages.dev hosts
 * is the second, host-based layer. Note: robots.txt Disallow on previews means crawlers may not
 * fetch the noindex signals; that trade-off is accepted (issue #3 asks for Disallow).
 */
export function isPreviewBuild(env: Env = process.env): boolean {
  const mode = siteEnv(env);
  const productionBranch = env.PRODUCTION_BRANCH || 'main';
  const cfBranchPreview = env.CF_PAGES === '1' && !!env.CF_PAGES_BRANCH && env.CF_PAGES_BRANCH !== productionBranch;
  if (mode === 'preview' || cfBranchPreview) return true;
  return false;
}
