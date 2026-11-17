/**
 * WEB-FIX-2: a newline immediately before an <a> must not collapse the preceding
 * character into the link text (CR review 5941659761 on #46).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { buildSiteCopy, type SiteBuild } from './helpers/site-build';

const DUMMY = {
  SITE_ENV: 'production',
  PUBLIC_GA4_ID: 'G-TEST000000',
  PUBLIC_GOOGLE_ADS_ID: 'AW-000000000',
  PUBLIC_META_PIXEL_ID: '000000000000000',
};

/** CR's suggested guard: a word, digit or , : . · glued to an opening <a>. */
const GLUED_TO_LINK = /[A-Za-z0-9:,.·]<a\b/;

function htmlFiles(dist: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) out.push(p);
    }
  };
  walk(dist);
  return out;
}

function read(b: SiteBuild, rel: string): string {
  return fs.readFileSync(path.join(b.dist, rel), 'utf8');
}

function visibleText(html: string): string {
  const window = new Window();
  window.document.write(html);
  return (window.document.body.textContent ?? '').replace(/\u00a0/g, ' ');
}

function assertNoGluedLinks(b: SiteBuild, label: string) {
  const files = htmlFiles(b.dist);
  expect(files.length, label).toBeGreaterThan(30);
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8').replace(/\u00a0/g, ' ');
    const rel = path.relative(b.dist, f);
    expect(html, `${label} ${rel}`).not.toMatch(GLUED_TO_LINK);
  }
}

function assertPhrases(b: SiteBuild, label: string) {
  const home = visibleText(read(b, 'index.html'));
  expect(home, label).toContain('See Be Ready, Ready Scotland and our sources list.');
  expect(home, label).not.toContain('SeeBe Ready');
  expect(home, label).not.toContain(',Ready Scotland');
  expect(home, label).not.toContain('oursources');

  const about = visibleText(read(b, 'about/index.html'));
  expect(about, label).toContain('editorial policy and affiliate disclosure');
  expect(about, label).not.toContain('andaffiliate');

  const method = visibleText(read(b, 'method/index.html'));
  expect(method, label).toContain('Cited links: Sources');
  expect(method, label).not.toContain('Cited links:Sources');

  const checklist = visibleText(read(b, 'checklist/index.html'));
  expect(checklist, label).toContain('See pre-packed 72-hour kits compared');
  expect(checklist, label).not.toContain('Seepre-packed');
  expect(checklist, label).toContain('scenario guides · gear criteria · pre-packed 72-hour kits compared');
  expect(checklist, label).not.toContain('·gear criteria');
  expect(checklist, label).not.toContain('·pre-packed');

  const contact = visibleText(read(b, 'contact/index.html'));
  expect(contact, label).toContain('Email: editors@uksurvivalkits.uk');
  expect(contact, label).not.toContain('Email:editors@');

  for (const f of htmlFiles(b.dist)) {
    const text = visibleText(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(b.dist, f);
    expect(text, `${label} footer ${rel}`).toContain('Editorial policy · Privacy');
    expect(text, `${label} footer ${rel}`).not.toContain('·Privacy');
  }
}

let plain: SiteBuild;
let dummy: SiteBuild;

beforeAll(() => {
  plain = buildSiteCopy('webfix2-plain-');
  dummy = buildSiteCopy('webfix2-dummy-', { env: DUMMY });
  for (const b of [plain, dummy]) expect(b.result.status, b.result.stderr).toBe(0);
}, 360_000);

afterAll(() => {
  for (const b of [plain, dummy]) b?.cleanup();
});

describe('WEB-FIX-2 missing spaces before links', () => {
  it('has no [A-Za-z0-9:,.·]<a in a no-env dist, and the listed phrases keep their spaces', () => {
    assertNoGluedLinks(plain, 'no-env');
    assertPhrases(plain, 'no-env');
  });

  it('keeps the same spaces on a tracking-on dummy-ID production build', () => {
    assertNoGluedLinks(dummy, 'dummy-ID');
    assertPhrases(dummy, 'dummy-ID');
  });
});
