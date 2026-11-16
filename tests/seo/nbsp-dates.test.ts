/** QA nit on #40 (comment 6930618292): visible dates keep day, month and year together with U+00A0. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NBSP, formatLondonDate, formatLondonMonthYear, formatLondonShortDate, publishedIfDifferent } from '../../src/lib/dates';
import { checkJsonLd, visibleDates } from '../../scripts/lib/jsonld-checks.mjs';

describe('date formatters use U+00A0 between parts', () => {
  it.each([
    [formatLondonDate, '2026-11-15', '15\u00a0November\u00a02026'],
    [formatLondonDate, '2026-09-01', '1\u00a0September\u00a02026'],
    [formatLondonShortDate, '2026-11-14', '14\u00a0Nov\u00a02026'],
    [formatLondonShortDate, '2026-09-15', '15\u00a0Sept\u00a02026'],
    [formatLondonMonthYear, '2026-11-15', 'Nov\u00a02026'],
  ] as const)('%o(%s)', (fn, day, expected) => {
    const out = fn(day);
    expect(out).toBe(expected);
    expect(out).not.toMatch(/ /);
    expect(out.replace(new RegExp(NBSP, 'g'), ' ')).toBe(expected.replace(/\u00a0/g, ' '));
  });

  it('the conditional Published label uses it too', () => {
    expect(publishedIfDifferent('2026-11-14', '2026-11-15')?.label).toBe('14\u00a0November\u00a02026');
  });
});

describe('check:jsonld visible-date parsing with U+00A0', () => {
  it('reads labels joined with U+00A0, &nbsp; and &#160;', () => {
    expect(visibleDates('<p>Last reviewed 15\u00a0November\u00a02026</p>')).toEqual(['2026-11-15']);
    expect(visibleDates('<p>Updated 15\u00a0Nov\u00a02026</p>')).toEqual(['2026-11-15']);
    expect(visibleDates('<p>Published 14&nbsp;November&nbsp;2026</p>')).toEqual(['2026-11-14']);
    expect(visibleDates('<p>Last checked\u00a015\u00a0Sept\u00a02026</p>')).toEqual(['2026-09-15']);
  });

  it('matches Article dates to U+00A0 labels in a built page (and still fails a mismatch)', () => {
    const graph = (modified: string) =>
      JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', '@id': 'https://uksurvivalkits.uk/#organization', name: 'UK Survival Kits', url: 'https://uksurvivalkits.uk/' },
          { '@type': 'WebSite', '@id': 'https://uksurvivalkits.uk/#website', url: 'https://uksurvivalkits.uk/', publisher: { '@id': 'https://uksurvivalkits.uk/#organization' } },
          { '@type': 'WebPage', '@id': 'https://uksurvivalkits.uk/x/#webpage', url: 'https://uksurvivalkits.uk/x/', name: 'X page heading', description: 'D' },
          {
            '@type': 'Article',
            '@id': 'https://uksurvivalkits.uk/x/#article',
            headline: 'X page heading',
            description: 'D',
            datePublished: '2026-11-14T00:00:00+00:00',
            dateModified: modified,
            isPartOf: { '@id': 'https://uksurvivalkits.uk/x/#webpage' },
          },
        ],
      });
    const page = (modified: string) =>
      `<!doctype html><html><head><meta name="robots" content="index, follow"><meta name="description" content="D"><link rel="canonical" href="https://uksurvivalkits.uk/x/"><script type="application/ld+json">${graph(modified)}</script></head><body><h1>X page heading</h1><p>Published 14\u00a0Nov\u00a02026 · Updated 15\u00a0Nov\u00a02026</p></body></html>`;
    const run = (modified: string) => {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nbsp-'));
      fs.mkdirSync(path.join(d, 'x'));
      fs.writeFileSync(path.join(d, 'x/index.html'), page(modified));
      return checkJsonLd(d, { now: new Date('2026-11-16T12:00:00Z') }).failures.map((f) => f.reason);
    };
    const dateReasons = (r: string[]) => r.filter((x) => /visible|not shown/.test(x));
    expect(dateReasons(run('2026-11-15T00:00:00+00:00'))).toEqual([]);
    expect(dateReasons(run('2026-11-16T00:00:00+00:00'))).toEqual([
      'Article.dateModified date 2026-11-16 does not match the visible date (2026-11-14, 2026-11-15)',
    ]);
  });
});
