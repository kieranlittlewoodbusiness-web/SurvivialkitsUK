/**
 * SEO-6f: citation titles keep their year with the word before them (QA comment 6932313020 on #42),
 * plus CR #43 nits (updated >= pubDate when lastReviewed is set; dateModifiedOf removed).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'astro/zod';
import { keepCitationYear, NBSP } from '../../src/lib/dates';
import { refineGuideDates } from '../../src/lib/content-dates';
import { buildSiteCopy, type SiteBuild } from '../helpers/site-build';

const N = NBSP;
const YEAR_AFTER_PLAIN_SPACE = /[ \t\n](?:19|20)\d{2}\b/;
const DAY_MONTH_PLAIN_SPACE = /\b\d{1,2}[ \t\n][A-Z][a-z]{2,8}\u00a0(?:19|20)\d{2}\b/;

describe('keepCitationYear', () => {
  it('glues a trailing year to the word before it', () => {
    expect(keepCitationYear('Cabinet Office: UK Public Survey of Risk Perception, Resilience and Preparedness 2026')).toBe(
      `Cabinet Office: UK Public Survey of Risk Perception, Resilience and Preparedness${N}2026`,
    );
  });

  it('keeps a "D Mon YYYY" date together and leaves the space before "(" breakable', () => {
    expect(keepCitationYear('GOV.UK: households encouraged to take small, simple steps (22 Oct 2026)')).toBe(
      `GOV.UK: households encouraged to take small, simple steps (22${N}Oct${N}2026)`,
    );
    expect(keepCitationYear('Be Ready checklist (Oct 2026)')).toBe(`Be Ready checklist (Oct${N}2026)`);
    expect(keepCitationYear('Report 16 November 2026')).toBe(`Report 16${N}November${N}2026`);
  });

  it('is idempotent and changes only whitespace', () => {
    for (const s of ['A survey 2026', 'steps (22 Oct 2026)', `x (22${N}Oct${N}2026)`, 'Power Cut 105 (GB)', 'Be Ready checklist (PDF)']) {
      const once = keepCitationYear(s);
      expect(keepCitationYear(once)).toBe(once);
      expect(once.replace(/\u00a0/g, ' ')).toBe(s.replace(/\u00a0/g, ' '));
    }
  });

  it('leaves labels without a year alone (no 3-digit or 5-digit numbers, no URLs)', () => {
    expect(keepCitationYear('Power Cut 105 (GB)')).toBe('Power Cut 105 (GB)');
    expect(keepCitationYear('Item 20261 list')).toBe('Item 20261 list');
  });
});

describe('templates render citation labels through keepCitationYear', () => {
  it('compare and sources pages', () => {
    const compare = fs.readFileSync(path.resolve('src/pages/compare/72-hour-emergency-kits/index.astro'), 'utf8');
    expect(compare).toContain('{keepCitationYear(s.label)}');
    expect(compare).not.toMatch(/\{s\.label\}/);
    const sources = fs.readFileSync(path.resolve('src/pages/sources.astro'), 'utf8');
    expect(sources).toContain('{keepCitationYear(source.label)}');
    expect(sources).toContain('16{NBSP}November{NBSP}2026');
    expect(sources).not.toMatch(/&nbsp;|&#160;/);
  });
});

describe('CR nit on #43: updated must not be before pubDate when lastReviewed is set', () => {
  const schema = z
    .object({ pubDate: z.coerce.date(), updated: z.coerce.date().optional(), lastReviewed: z.coerce.date().optional() })
    .superRefine(refineGuideDates);
  const messages = (input: Record<string, string>) => {
    const r = schema.safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  };

  it('fails with a message naming updated and pubDate', () => {
    expect(messages({ pubDate: '2026-11-15', updated: '2026-11-14', lastReviewed: '2026-11-16' })).toEqual([
      'updated: updated (2026-11-14) is before pubDate (2026-11-15). A guide cannot be updated before it was published, ' +
        'so updated must be on or after pubDate. Set updated to 2026-11-15 or later (SEO-6f).',
    ]);
  });

  it('passes when updated equals or follows pubDate, or is absent', () => {
    expect(messages({ pubDate: '2026-11-14', updated: '2026-11-14', lastReviewed: '2026-11-14' })).toEqual([]);
    expect(messages({ pubDate: '2026-11-14', updated: '2026-11-15', lastReviewed: '2026-11-16' })).toEqual([]);
    expect(messages({ pubDate: '2026-11-14', lastReviewed: '2026-11-16' })).toEqual([]);
  });

  it('gear without lastReviewed: not reported twice (the shown-day rule already covers it)', () => {
    expect(messages({ pubDate: '2026-11-15', updated: '2026-11-14' })).toHaveLength(1);
  });

  it('every real content file already satisfies it (no content dates changed)', () => {
    const dir = path.resolve('src/content');
    const files = fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(21);
    for (const f of files) {
      const md = fs.readFileSync(path.join(dir, f), 'utf8');
      const get = (k: string) => new RegExp(`^${k}: (\\S+)$`, 'm').exec(md)?.[1];
      const input = Object.fromEntries(
        (['pubDate', 'updated', 'lastReviewed'] as const).flatMap((k) => (get(k) ? [[k, get(k)!]] : [])),
      );
      expect(messages(input), f).toEqual([]);
    }
  });
});

describe('built site (TZ=UTC)', () => {
  let site: SiteBuild;
  beforeAll(() => {
    site = buildSiteCopy('seo-6f-');
  }, 120_000);
  afterAll(() => site?.cleanup());
  const page = (rel: string) => fs.readFileSync(path.join(site.dist, rel), 'utf8');
  const linkTexts = (html: string, from: string) => {
    const section = html.slice(html.indexOf(from));
    return [...section.slice(0, section.indexOf('</ul>')).matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]!.trim());
  };

  it('builds', () => {
    expect(site.result.status, site.result.stderr).toBe(0);
  });

  it('compare: every official citation title keeps its year with the previous word', () => {
    const titles = linkTexts(page('compare/72-hour-emergency-kits/index.html'), '>Official guidance</h3>');
    expect(titles.length).toBe(10);
    for (const t of titles) {
      expect(t, t).not.toMatch(YEAR_AFTER_PLAIN_SPACE);
      expect(t, t).not.toMatch(DAY_MONTH_PLAIN_SPACE);
    }
    expect(titles).toContain(`Cabinet Office: UK Public Survey of Risk Perception, Resilience and Preparedness${N}2026`);
    expect(titles).toContain(`GOV.UK: households encouraged to take small, simple steps (22${N}Oct${N}2026)`);
  });

  it('sources: retrieved date and every source title keep years together; no &nbsp; entity', () => {
    const html = page('sources/index.html');
    expect(html).toContain(`Retrieved for this build: 16${N}November${N}2026.`);
    expect(html).not.toContain('&nbsp;');
    for (const t of linkTexts(html, 'Retrieved for this build')) expect(t, t).not.toMatch(YEAR_AFTER_PLAIN_SPACE);
  });
});
