import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contentLastmodMap, frontmatterDates, lastmodFor, STATIC_PAGES_RELEASED } from '../../src/lib/seo/lastmod';

const md = (fm: string) => `---\n${fm}\n---\n\nBody with updated: 2099-01-01 in the text.\n`;

describe('frontmatterDates', () => {
  it('takes the latest of pubDate, updated and lastReviewed', () => {
    expect(frontmatterDates(md('pubDate: 2026-11-01\nupdated: 2026-11-10\nlastReviewed: 2026-11-12')).lastmod).toBe('2026-11-12');
    expect(frontmatterDates(md('pubDate: 2026-11-01\nupdated: "2026-11-15"\nlastReviewed: 2026-11-12')).lastmod).toBe('2026-11-15');
    expect(frontmatterDates(md('pubDate: 2026-11-01')).lastmod).toBe('2026-11-01');
  });
  it('ignores dates outside the front matter and reads draft', () => {
    expect(frontmatterDates(md('pubDate: 2026-11-01\ndraft: true'))).toEqual({ draft: true, lastmod: '2026-11-01' });
    expect(frontmatterDates('No front matter, updated: 2026-11-01').lastmod).toBeNull();
  });
});

describe('contentLastmodMap', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lastmod-'));
  fs.mkdirSync(path.join(dir, 'scenarios'));
  fs.mkdirSync(path.join(dir, 'gear'));
  fs.writeFileSync(path.join(dir, 'scenarios', 'a.md'), md('pubDate: 2026-10-01\nlastReviewed: 2026-10-20'));
  fs.writeFileSync(path.join(dir, 'scenarios', 'b.md'), md('pubDate: 2026-10-01\nupdated: 2026-12-02\nlastReviewed: 2026-10-20'));
  fs.writeFileSync(path.join(dir, 'scenarios', '_draft.md'), md('pubDate: 2027-01-01\ndraft: true'));
  fs.writeFileSync(path.join(dir, 'gear', 'c.md'), md('pubDate: 2026-09-01'));
  const map = contentLastmodMap(dir, ['scenarios', 'gear'], '2026-11-16');

  it('dates each published entry by its own front matter, with trailing-slash paths', () => {
    expect(map.get('/scenarios/a/')).toBe('2026-10-20');
    expect(map.get('/scenarios/b/')).toBe('2026-12-02');
    expect(map.get('/gear/c/')).toBe('2026-09-01');
    expect(map.has('/scenarios/_draft/')).toBe(false);
  });
  it('dates an index by its newest entry, never before the static release date', () => {
    expect(map.get('/scenarios/')).toBe('2026-12-02');
    expect(map.get('/gear/')).toBe('2026-11-16');
  });
  it('gives static pages the fixed release date, not the build time', () => {
    expect(lastmodFor('https://uksurvivalkits.uk/about/', map, '2026-11-16')).toBe('2026-11-16');
    expect(lastmodFor('https://uksurvivalkits.uk/about/kieran-littlewood/', map, '2026-11-16')).toBe('2026-11-16');
    expect(lastmodFor('https://uksurvivalkits.uk/scenarios/a/', map, '2026-11-16')).toBe('2026-10-20');
    expect(STATIC_PAGES_RELEASED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('covers every published entry in src/content', () => {
    const real = contentLastmodMap(path.resolve('src/content'));
    for (const col of ['scenarios', 'gear']) {
      const ids = fs
        .readdirSync(path.resolve('src/content', col))
        .filter((f) => f.endsWith('.md') && !frontmatterDates(fs.readFileSync(path.resolve('src/content', col, f), 'utf8')).draft);
      for (const f of ids) expect(real.get(`/${col}/${f.replace(/\.md$/, '')}/`)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
