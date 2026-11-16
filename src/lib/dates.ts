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
/**
 * QA nit on #40 (comment 6930618292): visible dates use U+00A0 NO-BREAK SPACE between day, month
 * and year so a narrow line never strands the year on its own line ("14 Nov" / "2026"). The text
 * reads the same; check:jsonld's visibleDates (\s) and check:content treat U+00A0 as a space.
 */
export const NBSP = '\u00a0';
const keepTogether = (label: string) => label.replace(/\s+/g, NBSP);

/**
 * SEO-6f (QA comment 6932313020 on #42): citation titles keep their year with the word before it, and
 * a "22 Oct 2026" date inside a title stays on one line. Only whitespace changes (to U+00A0); the text
 * reads the same. Idempotent, so labels that already carry NBSP are unchanged.
 */
const YEAR = String.raw`(?:19|20)\d{2}\b`;
const BEFORE_YEAR = new RegExp(String.raw`\s+(?=${YEAR})`, 'g');
const DAY_MONTH_YEAR = new RegExp(String.raw`\b(\d{1,2})\s+([A-Z][a-z]{2,8})(?=${NBSP}${YEAR})`, 'g');

export function keepCitationYear(label: string): string {
  return label.replace(BEFORE_YEAR, NBSP).replace(DAY_MONTH_YEAR, `$1${NBSP}$2`);
}

const londonLongDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatLondonDate(day: Date | string): string {
  return keepTogether(londonLongDate.format(new Date(`${isoDate(day)}T12:00:00Z`)));
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
  return keepTogether(londonShortDate.format(new Date(`${isoDate(day)}T12:00:00Z`)));
}

/** SEO-6d: visible month and year, e.g. "Nov 2026" (Europe/London, TZ-independent). */
export function formatLondonMonthYear(day: Date | string): string {
  return keepTogether(londonMonthYear.format(new Date(`${isoDate(day)}T12:00:00Z`)));
}

/**
 * SEO-6d (CR M1 on #40): the visible "Published" date for gear and scenario bylines, shown only when
 * the published day differs from the day shown as "Last reviewed". check:jsonld requires every
 * Article datePublished to be visible; when the two days are equal, "Last reviewed" already shows it.
 */
export function publishedIfDifferent(
  pubDate: Date | string,
  reviewed: Date | string,
): { datetime: string; label: string } | null {
  const published = isoDate(pubDate);
  if (published === isoDate(reviewed)) return null;
  return { datetime: published, label: formatLondonDate(published) };
}
