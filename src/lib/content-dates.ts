/**
 * SEO-6e: one rule for guide dates, enforced when content collections load (src/content.config.ts).
 *
 * Gear and scenario guides show "Last reviewed <day>" in the byline, and their Article JSON-LD
 * dateModified is that same day. The day shown is lastReviewed (gear falls back to updated, then
 * pubDate, because gear lastReviewed is optional). For the byline and dateModified to agree, that
 * day must be on or after every other content date. If an editor bumps `updated` (or `pubDate`)
 * without bumping `lastReviewed`, the build fails with a message naming the fields.
 *
 * Plain module (no astro:content) so it can be unit tested and used by the content config.
 */

export interface GuideDates {
  pubDate: Date;
  updated?: Date;
  lastReviewed?: Date;
}

type Field = keyof GuideDates;

const day = (d: Date) => d.toISOString().slice(0, 10);

/** The field whose date the byline shows as "Last reviewed" (and JSON-LD uses as dateModified). */
export function reviewedField(d: GuideDates): Field {
  if (d.lastReviewed) return 'lastReviewed';
  if (d.updated) return 'updated';
  return 'pubDate';
}

/** The day shown as "Last reviewed" and emitted as dateModified. */
export function reviewedDate(d: GuideDates): Date {
  return d[reviewedField(d)]!;
}

/** Human-readable problems, one per content date that is later than the reviewed day. */
export function reviewedDateIssues(d: GuideDates): Array<{ path: Field; message: string }> {
  const shown = reviewedField(d);
  const shownDay = day(reviewedDate(d));
  const issues: Array<{ path: Field; message: string }> = [];
  for (const field of ['updated', 'pubDate'] as const) {
    const value = d[field];
    if (!value || field === shown) continue;
    if (day(value) > shownDay) {
      issues.push({
        path: shown,
        message:
          `${shown} (${shownDay}) is before ${field} (${day(value)}). The guide shows "Last reviewed" from ${shown} ` +
          `and its JSON-LD dateModified uses the same day, so ${shown} must be on or after ${field}. ` +
          `Set ${shown} to ${day(value)} or later (SEO-6e).`,
      });
    }
  }
  return issues;
}

/** zod superRefine callback for the gear and scenarios schemas. */
export function refineGuideDates(
  d: GuideDates,
  ctx: { addIssue: (issue: { code: 'custom'; message: string; path: (string | number)[] }) => void },
): void {
  for (const issue of reviewedDateIssues(d)) {
    ctx.addIssue({ code: 'custom', message: issue.message, path: [issue.path] });
  }
}
