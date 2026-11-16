import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { COMPARE_DATES } from '../../src/data/compareDates';
import { formatLondonDate, formatLondonMonthYear, formatLondonShortDate } from '../../src/lib/dates';
import { isoDateTimeLondon } from '../../src/lib/seo/jsonld';
import { visibleDates } from '../../scripts/lib/jsonld-checks.mjs';

const COMPARE_SRC = 'src/pages/compare/72-hour-emergency-kits/index.astro';
const HOME_SRC = 'src/pages/index.astro';
const ZONES = ['UTC', 'Europe/London', 'America/Los_Angeles', 'Pacific/Auckland', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];
const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const underTz = <T>(tz: string, fn: () => T): T => {
  process.env.TZ = tz;
  return fn();
};

describe('COMPARE_DATES (SEO-6d single source of truth)', () => {
  it('keeps the existing values: no date bump', () => {
    expect(COMPARE_DATES).toEqual({ published: '2026-11-14', updated: '2026-11-15' });
  });

  it('gives visible labels and JSON-LD datetimes on the same calendar day', () => {
    expect(formatLondonShortDate(COMPARE_DATES.published)).toBe('14 Nov 2026');
    expect(formatLondonShortDate(COMPARE_DATES.updated)).toBe('15 Nov 2026');
    expect(formatLondonDate(COMPARE_DATES.updated)).toBe('15 November 2026');
    expect(formatLondonMonthYear(COMPARE_DATES.updated)).toBe('Nov 2026');
    expect(isoDateTimeLondon(COMPARE_DATES.published)).toBe('2026-11-14T00:00:00+00:00');
    expect(isoDateTimeLondon(COMPARE_DATES.updated)).toBe('2026-11-15T00:00:00+00:00');
  });

  it('round-trips: check:jsonld reads the rendered labels back to the JSON-LD days', () => {
    const kicker = `Guide and comparison · Published ${formatLondonShortDate(COMPARE_DATES.published)} · Updated ${formatLondonShortDate(COMPARE_DATES.updated)}`;
    const sources = `<p>Last checked ${formatLondonDate(COMPARE_DATES.updated)}.</p>`;
    const days = visibleDates(`<p>${kicker}</p>${sources}`).sort();
    expect(days).toEqual([
      isoDateTimeLondon(COMPARE_DATES.published).slice(0, 10),
      isoDateTimeLondon(COMPARE_DATES.updated).slice(0, 10),
    ]);
  });
});

describe('short-date and month-year formatters are TZ-independent', () => {
  it.each([
    ['2026-11-15', '15 Nov 2026', 'Nov 2026'],
    ['2026-06-30', '30 Jun 2026', 'Jun 2026'],
    ['2026-03-29', '29 Mar 2026', 'Mar 2026'],
    ['2026-10-25', '25 Oct 2026', 'Oct 2026'],
    ['2027-01-01', '1 Jan 2027', 'Jan 2027'],
  ])('%s', (day, short, monthYear) => {
    for (const tz of ZONES) {
      const utcMidnight = new Date(`${day}T00:00:00.000Z`);
      expect(underTz(tz, () => formatLondonShortDate(utcMidnight)), tz).toBe(short);
      expect(underTz(tz, () => formatLondonShortDate(day)), tz).toBe(short);
      expect(underTz(tz, () => formatLondonMonthYear(utcMidnight)), tz).toBe(monthYear);
    }
  });
});

describe('compare and homepage sources read COMPARE_DATES (no hard-coded dates)', () => {
  const compare = fs.readFileSync(COMPARE_SRC, 'utf8');
  const home = fs.readFileSync(HOME_SRC, 'utf8');
  const hardCoded = /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\s+20\d\d\b|'20\d\d-\d\d-\d\d'/;

  it('the compare page has no hard-coded visible or JSON-LD dates', () => {
    // Citation labels keep their own source dates (e.g. a GOV.UK press release "(22 Oct 2026)").
    const withoutCitations = compare
      .split('\n')
      .filter((line) => !/label: '.*', url: 'https:\/\//.test(line))
      .join('\n');
    expect(withoutCitations).not.toMatch(hardCoded);
    expect(compare).not.toContain('15 Nov 2026');
    expect(compare).not.toContain('15 November 2026');
    expect(compare).toMatch(/const PUBLISHED_ON = COMPARE_DATES\.published;/);
    expect(compare).toMatch(/const UPDATED_ON = COMPARE_DATES\.updated;/);
    expect(compare).toMatch(/datePublished: PUBLISHED_ON,/);
    expect(compare).toMatch(/dateModified: UPDATED_ON,/);
  });

  it('the compare page shows the published date next to the updated date', () => {
    expect(compare).toContain(
      'Published <time datetime={PUBLISHED_ON}>{formatLondonShortDate(PUBLISHED_ON)}</time> · Updated <time datetime={UPDATED_ON}>{formatLondonShortDate(UPDATED_ON)}</time>',
    );
  });

  it('the homepage kicker reads the compare updated date', () => {
    expect(home).not.toContain('Updated Nov 2026');
    expect(home).toContain('Updated {formatLondonMonthYear(COMPARE_DATES.updated)}');
  });
});
