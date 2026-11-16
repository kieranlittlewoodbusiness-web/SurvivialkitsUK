import { afterEach, describe, expect, it } from 'vitest';
import { formatLondonDate } from '../../src/lib/dates';
import { buildGraph, isoDateTimeLondon, serializeJsonLd, webPage } from '../../src/lib/seo/jsonld';

// SEO-6b L1: visible date labels must not depend on the build machine's TZ.
const ZONES = ['UTC', 'Europe/London', 'America/Los_Angeles', 'Pacific/Auckland', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];
const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

function underTz<T>(tz: string, fn: () => T): T {
  process.env.TZ = tz;
  return fn();
}

describe('formatLondonDate (SEO-6b L1)', () => {
  it('actually switches the process TZ in this runtime (guards the tests below)', () => {
    const d = new Date('2026-11-14T00:00:00.000Z');
    const la = underTz('America/Los_Angeles', () => d.getTimezoneOffset());
    const akl = underTz('Pacific/Auckland', () => d.getTimezoneOffset());
    expect(la).toBe(480);
    expect(akl).toBe(-780);
    // The old code path (toLocaleDateString without timeZone) drifted a day west of UTC.
    const old = (tz: string) =>
      underTz(tz, () => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
    expect(old('UTC')).toBe('14 November 2026');
    expect(old('America/Los_Angeles')).toBe('13 November 2026');
  });

  it.each([
    ['2026-11-14', '14 November 2026'], // GMT
    ['2026-06-30', '30 June 2026'], // BST
    ['2026-03-29', '29 March 2026'], // clocks go forward
    ['2026-10-25', '25 October 2026'], // clocks go back
    ['2026-12-31', '31 December 2026'], // year boundary
    ['2027-01-01', '1 January 2027'],
  ])('gives the same label for %s in every build TZ', (day, label) => {
    for (const tz of ZONES) {
      // Astro content collections parse YYYY-MM-DD frontmatter as UTC midnight.
      expect(underTz(tz, () => formatLondonDate(new Date(`${day}T00:00:00.000Z`))), tz).toBe(label.replace(/ /g, '\u00a0'));
      expect(underTz(tz, () => formatLondonDate(day)), tz).toBe(label.replace(/ /g, '\u00a0'));
    }
  });

  it('labels the same calendar day the JSON-LD datetime carries (Europe/London midnight)', () => {
    for (const day of ['2026-11-14', '2026-06-30', '2026-03-29', '2026-10-25']) {
      for (const tz of ZONES) {
        const { iso, label } = underTz(tz, () => ({
          iso: isoDateTimeLondon(new Date(`${day}T00:00:00.000Z`)),
          label: formatLondonDate(new Date(`${day}T00:00:00.000Z`)),
        }));
        expect(iso.slice(0, 10)).toBe(day);
        expect(label).toBe(
          new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' }).format(
            new Date(iso),
          ).replace(/ /g, '\u00a0'),
        );
      }
    }
  });
});

describe('serializeJsonLd (SEO-6b L2)', () => {
  it('escapes every < as \\u003c, leaving no raw < that could close the script', () => {
    const graph = buildGraph([
      webPage({
        url: 'https://uksurvivalkits.uk/method/',
        name: 'Evil </script><script>alert(1)</script> <!-- x',
        description: 'a < b and </SCRIPT>',
      }),
    ]);
    const out = serializeJsonLd(graph);
    expect(out).not.toContain('<');
    expect(out.toLowerCase()).not.toContain('</script');
    expect(out).toContain('\\u003c/script>\\u003cscript>');
    expect(out).toContain('\\u003c!-- x');
    expect(out).toContain('a \\u003c b and \\u003c/SCRIPT>');
  });

  it('round-trips through JSON.parse to the original graph', () => {
    const graph = buildGraph([
      webPage({ url: 'https://uksurvivalkits.uk/method/', name: 'x </script> y', description: '<<>>' }),
    ]);
    expect(JSON.parse(serializeJsonLd(graph))).toEqual(graph);
  });

  it('matches plain JSON.stringify when the graph has no <', () => {
    const graph = buildGraph([webPage({ url: 'https://uksurvivalkits.uk/method/', name: 'Method', description: 'Plain' })]);
    expect(serializeJsonLd(graph)).toBe(JSON.stringify(graph));
  });
});

describe('SEO-6b wiring', () => {
  it('JsonLd.astro serialises through serializeJsonLd, not raw JSON.stringify', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/components/JsonLd.astro', 'utf8');
    expect(src).toMatch(/set:html=\{serializeJsonLd\(graph\)\}/);
    expect(src).not.toMatch(/JSON\.stringify/);
  });

  it('no page formats visible dates with toLocaleDateString (use formatLondonDate)', async () => {
    const { execFileSync } = await import('node:child_process');
    let hits = '';
    try {
      hits = execFileSync('grep', ['-rn', '-e', 'toLocaleDateString', '-e', 'toLocaleString(', 'src'], { encoding: 'utf8' });
    } catch {
      hits = '';
    }
    expect(hits).toBe('');
  });
});
