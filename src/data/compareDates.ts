/**
 * SEO-6d: the one source of truth for the 72-hour compare page's dates (calendar days, Europe/London).
 *
 * Read by:
 * - the compare page's visible labels ("Published", "Updated", "Last checked", "read on"), via
 *   src/lib/dates.ts (formatted in Europe/London);
 * - the compare page's Article JSON-LD datePublished / dateModified (isoDateTimeLondon: Europe/London
 *   midnight with offset);
 * - the homepage feature kicker ("72-hour kit · Updated Nov 2026").
 *
 * Bump `updated` in the same PR as a meaningful change to the compare page or a fresh check of its
 * Amazon UK listings. Never set it from the build clock.
 */
export const COMPARE_DATES = {
  /** First published. */
  published: '2026-11-14',
  /** Last updated, and the day the Amazon UK listings were last checked. */
  updated: '2026-11-15',
} as const;
