/**
 * WEB-FIX-1: the privacy page must render a space in "our affiliate disclosure"
 * (a line break before the link used to collapse to "ouraffiliate").
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

const SPACE_BEFORE_LINK =
  /our <a href="\/affiliate-disclosure\/">affiliate disclosure<\/a>/;

function privacyHtml(b: SiteBuild): string {
  return fs.readFileSync(path.join(b.dist, 'privacy/index.html'), 'utf8');
}

function visibleText(html: string): string {
  const window = new Window();
  window.document.write(html);
  return (window.document.body.textContent ?? '').replace(/\u00a0/g, ' ');
}

function assertSpace(html: string, label: string) {
  const normalized = html.replace(/\u00a0/g, ' ');
  expect(normalized, label).toMatch(SPACE_BEFORE_LINK);
  expect(normalized, label).not.toContain('ouraffiliate');
  const text = visibleText(html);
  expect(text, label).toContain('our affiliate disclosure');
  expect(text, label).not.toContain('ouraffiliate');
}

let plain: SiteBuild;
let dummy: SiteBuild;

beforeAll(() => {
  plain = buildSiteCopy('webfix1-plain-');
  dummy = buildSiteCopy('webfix1-dummy-', { env: DUMMY });
  for (const b of [plain, dummy]) expect(b.result.status, b.result.stderr).toBe(0);
}, 360_000);

afterAll(() => {
  for (const b of [plain, dummy]) b?.cleanup();
});

describe('WEB-FIX-1 privacy "our affiliate disclosure" space', () => {
  it('keeps a normal (or NBSP-free) space before the link on a no-env build', () => {
    assertSpace(privacyHtml(plain), 'no-env');
  });

  it('keeps the same space on a tracking-on dummy-ID production build', () => {
    assertSpace(privacyHtml(dummy), 'dummy-ID');
  });
});
