/**
 * SEO-2: sitemap <lastmod> values, sourced from real content dates (SEO-1 report F11).
 *
 * - Scenario and gear pages: the latest of the entry's front-matter `updated`, `lastReviewed` and
 *   `pubDate` (the same fields the page shows as "Last reviewed").
 * - /scenarios/ and /gear/ index pages: the latest date of the published entries they list, and
 *   never earlier than STATIC_PAGES_RELEASED.
 * - Every other (static) page: STATIC_PAGES_RELEASED, a fixed release date. Bump it in the same
 *   PR as a meaningful change to a static page's copy. It is NOT the build time, so a rebuild
 *   with no content change does not move any <lastmod>.
 *
 * Plain Node (fs only, no astro:content) so astro.config.mjs can use it at build time.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Release date of the current static page copy (S1-11 rebrand, merged as main f98434f). */
export const STATIC_PAGES_RELEASED = '2026-11-16';

const DATE_KEYS = ['pubDate', 'updated', 'lastReviewed'] as const;

export interface EntryDates {
  draft: boolean;
  /** YYYY-MM-DD, the latest of pubDate / updated / lastReviewed, or null if none parse. */
  lastmod: string | null;
}

/** Read draft flag and dates from a Markdown file's YAML front matter (flat keys only). */
export function frontmatterDates(markdown: string): EntryDates {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1] ?? '';
  const value = (key: string) => {
    const m = new RegExp(`^${key}:\\s*["']?([^"'\\r\\n#]+?)["']?\\s*(?:#.*)?$`, 'm').exec(fm);
    return m ? m[1].trim() : undefined;
  };
  const dates = DATE_KEYS.map((k) => value(k))
    .filter((v): v is string => !!v)
    .map((v) => new Date(v))
    .filter((d) => !Number.isNaN(d.valueOf()))
    .map((d) => d.toISOString().slice(0, 10))
    .sort();
  return { draft: value('draft') === 'true', lastmod: dates.at(-1) ?? null };
}

const latest = (...dates: (string | null | undefined)[]) =>
  dates.filter((d): d is string => !!d).sort().at(-1) ?? null;

/**
 * Map of site path (always with trailing slash, e.g. `/scenarios/power-cuts/`) to YYYY-MM-DD for
 * every published content entry and its collection index. Collection folder names are the URL
 * segments (`src/content/scenarios` -> `/scenarios/`), and the entry id is the file name.
 */
export function contentLastmodMap(
  contentDir: string,
  collections: readonly string[] = ['scenarios', 'gear'],
  staticReleased: string = STATIC_PAGES_RELEASED,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const col of collections) {
    const dir = path.join(contentDir, col);
    let newest: string | null = null;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
      const { draft, lastmod } = frontmatterDates(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (draft || !lastmod) continue;
      map.set(`/${col}/${file.replace(/\.md$/, '')}/`, lastmod);
      newest = latest(newest, lastmod);
    }
    map.set(`/${col}/`, latest(newest, staticReleased)!);
  }
  return map;
}

/** <lastmod> for an absolute sitemap URL: content date if known, otherwise the static release date. */
export function lastmodFor(
  url: string,
  map: Map<string, string>,
  staticReleased: string = STATIC_PAGES_RELEASED,
): string {
  return map.get(new URL(url).pathname) ?? staticReleased;
}
