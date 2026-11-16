import { isoDate } from './seo/jsonld';

/**
 * SEO-6b (L1): visible date labels, e.g. "14 November 2026".
 *
 * Content dates are calendar days (frontmatter YYYY-MM-DD, parsed as UTC midnight). The JSON-LD
 * emits the same calendar day as Europe/London midnight (isoDateTimeLondon). To keep the visible
 * label on that same day whatever the build machine's TZ, we take the calendar day with isoDate
 * (UTC parts) and format it at midday UTC with timeZone 'Europe/London' (UTC+0/+1, so midday never
 * crosses a day boundary).
 */
const londonLongDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatLondonDate(day: Date | string): string {
  return londonLongDate.format(new Date(`${isoDate(day)}T12:00:00Z`));
}

const londonShortDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const londonMonthYear = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  month: 'short',
  year: 'numeric',
});

/** SEO-6d: short visible date, e.g. "15 Nov 2026" (Europe/London, TZ-independent). */
export function formatLondonShortDate(day: Date | string): string {
  return londonShortDate.format(new Date(`${isoDate(day)}T12:00:00Z`));
}

/** SEO-6d: visible month and year, e.g. "Nov 2026" (Europe/London, TZ-independent). */
export function formatLondonMonthYear(day: Date | string): string {
  return londonMonthYear.format(new Date(`${isoDate(day)}T12:00:00Z`));
}
