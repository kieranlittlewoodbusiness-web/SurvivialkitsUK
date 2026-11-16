/**
 * SEO-9c: breadcrumb separator with empty alt text (CR N3 on #38) and U+00A0 in the hard-coded
 * citation/source dates (QA comment 6931066758 on #41). Checked on a real build in a temp copy.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSiteCopy, type SiteBuild } from '../helpers/site-build';
import fs from 'node:fs';
import path from 'node:path';
import { checkJsonLd } from '../../scripts/lib/jsonld-checks.mjs';
import { checkContent } from '../../scripts/lib/dist-checks.mjs';

const ROOT = path.resolve('.');
const BREADCRUMB_SRC = fs.readFileSync(path.join(ROOT, 'src/components/Breadcrumb.astro'), 'utf8');
const NBSP_DATE = (d: string) => d.replace(/ /g, '(?:\u00a0|&nbsp;|&#160;)');

describe('Breadcrumb.astro separator CSS (source)', () => {
  it('declares the plain fallback first, then the empty-alt form, for each glyph', () => {
    expect(BREADCRUMB_SRC).toMatch(/\.crumbs li \+ li::before \{\s*content: "\/";\s*content: "\/" \/ "";/);
    expect(BREADCRUMB_SRC).toMatch(/\.crumbs--chevron li \+ li::before \{\s*content: "›";\s*content: "›" \/ "";\s*\}/);
  });

  it('uses literal glyphs, not var(--crumb-sep), so the fallback survives in old WebKit', () => {
    const code = BREADCRUMB_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/var\(--crumb-sep\)/);
    expect(code).not.toMatch(/--crumb-sep:/);
    expect(BREADCRUMB_SRC).toMatch(/separator\?: '\/' \| '›';/);
  });
});

describe('built site', () => {
  let site: SiteBuild | undefined;
  let dist = '';
  let build: SiteBuild['result'];
  const read = (rel: string) => fs.readFileSync(path.join(dist, rel), 'utf8');

  beforeAll(() => {
    site = buildSiteCopy('seo-9c-', {
      tz: 'UTC',
    });
    dist = site.dist;
    build = site.result;
  }, 180_000);

  afterAll(() => {
    site?.cleanup();
  });

  it('builds', () => {
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
  });

  it('keeps both content declarations, in order, in the shipped CSS', () => {
    const html = read('compare/72-hour-emergency-kits/index.html');
    expect(html).toMatch(/\.crumbs\[[^\]]+\] li\[[^\]]+\]\+li\[[^\]]+\]:before\{content:"\/";content:"\/" \/ "";/);
    expect(html).toMatch(/\.crumbs--chevron\[[^\]]+\] li\[[^\]]+\]\+li\[[^\]]+\]:before\{content:"›";content:"›" \/ ""\}/);
  });

  it('compare trail uses "/" and the bio trail uses "›" (chevron class), with no inline --crumb-sep', () => {
    const compare = read('compare/72-hour-emergency-kits/index.html');
    const bio = read('about/kieran-littlewood/index.html');
    expect(compare).toMatch(/<ol class="crumbs"[^>]*>/);
    expect(compare).not.toMatch(/crumbs--chevron"/);
    expect(bio).toMatch(/<ol class="crumbs crumbs--end crumbs--chevron"[^>]*>/);
    for (const html of [compare, bio]) expect(html).not.toContain('--crumb-sep');
  });

  it('separators are not in the breadcrumb text (no "/" or "›" glyph in the nav markup)', () => {
    for (const rel of ['compare/72-hour-emergency-kits/index.html', 'about/kieran-littlewood/index.html']) {
      const nav = /<nav aria-label="Breadcrumb"[^>]*>([\s\S]*?)<\/nav>/.exec(read(rel))?.[1] ?? '';
      const text = nav.replace(/<[^>]+>/g, '');
      expect(text, rel).not.toMatch(/[›]|\s\/\s/);
    }
  });

  it('citation and source dates keep their values with U+00A0 between parts', () => {
    const compare = read('compare/72-hour-emergency-kits/index.html');
    const sources = read('sources/index.html');
    expect(compare).toMatch(new RegExp(`simple steps \\(${NBSP_DATE('22 Oct 2026')}\\)`));
    expect(compare).toMatch(new RegExp(`Be Ready checklist \\(${NBSP_DATE('Oct 2026')}\\)`));
    expect(sources).toMatch(new RegExp(`Retrieved for this build: ${NBSP_DATE('16 November 2026')}\\.`));
    expect(compare).not.toContain('(22 Oct 2026)');
    expect(compare).not.toContain('(Oct 2026)');
    expect(sources).not.toContain('16 November 2026');
  });

  it('check:content and check:jsonld still pass on this build', () => {
    expect(checkContent(dist).failures).toEqual([]);
    expect(checkJsonLd(dist, { now: new Date('2026-11-16T12:00:00Z') }).failures).toEqual([]);
  });
});
