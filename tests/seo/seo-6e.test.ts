/**
 * SEO-6e: gear and scenario bylines show "Last reviewed <day>" and Article JSON-LD dateModified is that
 * same day. The content schema fails the build when updated or pubDate is later than the reviewed day,
 * so the two cannot drift. Fixture builds mutate a temp copy of the site, never the real content files.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'astro/zod';
import { buildSiteCopy, type SiteBuild } from '../helpers/site-build';
import { refineGuideDates, reviewedDate, reviewedDateIssues, reviewedField } from '../../src/lib/content-dates';
import { checkJsonLd } from '../../scripts/lib/jsonld-checks.mjs';

const NOW = new Date('2026-11-16T12:00:00Z');
const d = (day: string) => new Date(`${day}T00:00:00Z`);

// Same shape and refine as the gear schema (lastReviewed optional) in src/content.config.ts.
const schema = z
  .object({
    pubDate: z.coerce.date(),
    updated: z.coerce.date().optional(),
    lastReviewed: z.coerce.date().optional(),
  })
  .superRefine(refineGuideDates);
const messages = (input: Record<string, string>) => {
  const r = schema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('content schema refine (src/lib/content-dates.ts)', () => {
  it('fails when lastReviewed is before updated, naming both fields', () => {
    expect(messages({ pubDate: '2026-11-14', updated: '2026-11-15', lastReviewed: '2026-11-14' })).toEqual([
      'lastReviewed: lastReviewed (2026-11-14) is before updated (2026-11-15). The guide shows "Last reviewed" from ' +
        'lastReviewed and its JSON-LD dateModified uses the same day, so lastReviewed must be on or after updated. ' +
        'Set lastReviewed to 2026-11-15 or later (SEO-6e).',
    ]);
  });

  it('fails when lastReviewed is before pubDate', () => {
    const m = messages({ pubDate: '2026-11-15', lastReviewed: '2026-11-14' });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/^lastReviewed: lastReviewed \(2026-11-14\) is before pubDate \(2026-11-15\)\./);
  });

  it('reports both when lastReviewed is before updated and pubDate', () => {
    const m = messages({ pubDate: '2026-11-16', updated: '2026-11-15', lastReviewed: '2026-11-14' });
    expect(m.map((x) => x.split('.')[0])).toEqual([
      'lastReviewed: lastReviewed (2026-11-14) is before updated (2026-11-15)',
      'lastReviewed: lastReviewed (2026-11-14) is before pubDate (2026-11-16)',
      // SEO-6f (CR nit on #43): updated before pubDate is reported too.
      'updated: updated (2026-11-15) is before pubDate (2026-11-16)',
    ]);
  });

  it('passes when lastReviewed equals or is after updated and pubDate', () => {
    expect(messages({ pubDate: '2026-11-14', lastReviewed: '2026-11-14' })).toEqual([]);
    expect(messages({ pubDate: '2026-11-14', updated: '2026-11-14', lastReviewed: '2026-11-14' })).toEqual([]);
    expect(messages({ pubDate: '2026-11-14', updated: '2026-11-15', lastReviewed: '2026-11-15' })).toEqual([]);
    expect(messages({ pubDate: '2026-11-14', updated: '2026-11-15', lastReviewed: '2026-11-16' })).toEqual([]);
  });

  it('gear without lastReviewed: the byline day is updated (then pubDate), and updated before pubDate fails', () => {
    expect(reviewedField({ pubDate: d('2026-11-14') })).toBe('pubDate');
    expect(reviewedField({ pubDate: d('2026-11-14'), updated: d('2026-11-15') })).toBe('updated');
    expect(messages({ pubDate: '2026-11-14', updated: '2026-11-15' })).toEqual([]);
    expect(messages({ pubDate: '2026-11-15', updated: '2026-11-14' })[0]).toMatch(
      /^updated: updated \(2026-11-14\) is before pubDate \(2026-11-15\)\./,
    );
  });

  it('reviewedDate is the latest date whenever the refine passes', () => {
    const ok = { pubDate: d('2026-11-14'), updated: d('2026-11-15'), lastReviewed: d('2026-11-15') };
    expect(reviewedDateIssues(ok)).toEqual([]);
    expect(reviewedDate(ok).toISOString().slice(0, 10)).toBe('2026-11-15');
  });

  it('is wired into both collections in src/content.config.ts', () => {
    const src = fs.readFileSync(path.resolve('src/content.config.ts'), 'utf8');
    expect(src.match(/\.superRefine\(refineGuideDates\)/g)).toHaveLength(2);
  });
});

function bump(dir: string, rel: string, from: RegExp, to: string) {
  const file = path.join(dir, rel);
  const md = fs.readFileSync(file, 'utf8');
  expect(md, rel).toMatch(from);
  fs.writeFileSync(file, md.replace(from, to));
}

describe('fixture builds', () => {
  const builds: SiteBuild[] = [];
  afterAll(() => builds.forEach((b) => b.cleanup()));
  const run = (prefix: string, mutate: (dir: string) => void) => {
    const b = buildSiteCopy(prefix, { mutate });
    builds.push(b);
    return b;
  };

  it('fails the build loudly when a gear file bumps updated past lastReviewed', () => {
    const b = run('seo-6e-updated-', (dir) =>
      bump(dir, 'src/content/gear/first-aid.md', /^lastReviewed: 2026-11-14$/m, 'updated: 2026-11-15\nlastReviewed: 2026-11-14'),
    );
    const out = `${b.result.stdout}\n${b.result.stderr}`;
    expect(b.result.status).not.toBe(0);
    expect(out).toContain('first-aid');
    expect(out).toContain('lastReviewed (2026-11-14) is before updated (2026-11-15)');
    expect(fs.existsSync(path.join(b.dist, 'gear/first-aid/index.html'))).toBe(false);
  }, 120_000);

  it('fails the build loudly when a scenario file has pubDate after lastReviewed', () => {
    const b = run('seo-6e-pubdate-', (dir) =>
      bump(dir, 'src/content/scenarios/power-cuts.md', /^pubDate: 2026-11-14$/m, 'pubDate: 2026-11-15'),
    );
    const out = `${b.result.stdout}\n${b.result.stderr}`;
    expect(b.result.status).not.toBe(0);
    expect(out).toContain('power-cuts');
    expect(out).toContain('lastReviewed (2026-11-14) is before pubDate (2026-11-15)');
  }, 120_000);

  it('builds when updated and lastReviewed move together; dateModified equals the byline day and check:jsonld passes', () => {
    const b = run('seo-6e-ok-', (dir) =>
      bump(dir, 'src/content/gear/first-aid.md', /^lastReviewed: 2026-11-14$/m, 'updated: 2026-11-15\nlastReviewed: 2026-11-15'),
    );
    expect(b.result.status, b.result.stderr).toBe(0);
    const html = fs.readFileSync(path.join(b.dist, 'gear/first-aid/index.html'), 'utf8');
    expect(html).toContain('Last reviewed 15\u00a0November\u00a02026');
    expect(html).toContain('"dateModified":"2026-11-15T00:00:00+00:00"');
    expect(checkJsonLd(b.dist, { now: NOW }).failures).toEqual([]);
  }, 120_000);
});

describe('compare page nbsp style (CR nit)', () => {
  const src = fs.readFileSync(path.resolve('src/pages/compare/72-hour-emergency-kits/index.astro'), 'utf8');
  it('uses the NBSP constant only: no \\u00a0 escapes and no &nbsp; entities', () => {
    expect(src).not.toMatch(/\\u00a0/i);
    expect(src).not.toMatch(/&nbsp;|&#160;/);
    // SEO-6f: the citation labels get their NBSPs from keepCitationYear where they render.
    expect(src).toContain('{keepCitationYear(s.label)}');
    expect(src).toContain('(Oct{NBSP}2026)');
  });
});
