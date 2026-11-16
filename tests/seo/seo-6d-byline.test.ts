/**
 * SEO-6d (CR M1 on #40): gear and scenario bylines show "Published <date>" when pubDate differs
 * from the "Last reviewed" day, so check:jsonld's visible-datePublished rule survives a routine
 * review-date bump. The fixture build copies the site into a temp dir and bumps lastReviewed there,
 * never in the real content files.
 */
import { afterAll, beforeAll, afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publishedIfDifferent } from '../../src/lib/dates';
import { checkJsonLd } from '../../scripts/lib/jsonld-checks.mjs';

const ROOT = path.resolve('.');
const NOW = new Date('2026-11-16T12:00:00Z');
const PUBLISHED_MARKUP = ' · Published <time datetime="2026-11-14">14\u00a0November\u00a02026</time> · Last reviewed 15\u00a0November\u00a02026';
const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('publishedIfDifferent', () => {
  it('returns null when the published and reviewed days are equal (label absent)', () => {
    expect(publishedIfDifferent('2026-11-14', '2026-11-14')).toBeNull();
    expect(publishedIfDifferent(new Date('2026-11-14T00:00:00Z'), '2026-11-14')).toBeNull();
  });

  it('returns the pubDate day and its Europe/London label when they differ, in any build TZ', () => {
    for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Auckland']) {
      process.env.TZ = tz;
      expect(publishedIfDifferent(new Date('2026-11-14T00:00:00Z'), new Date('2026-11-15T00:00:00Z')), tz).toEqual({
        datetime: '2026-11-14',
        label: '14\u00a0November\u00a02026',
      });
    }
  });
});

describe('fixture build with lastReviewed bumped past pubDate', () => {
  let tmp = '';
  let dist = '';
  let build: ReturnType<typeof spawnSync>;
  const page = (rel: string) => fs.readFileSync(path.join(dist, rel), 'utf8');
  const byline = (html: string) => /Edited by [\s\S]*?<\/span>/.exec(html)?.[0] ?? '';

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-6d-byline-'));
    for (const entry of ['src', 'public', 'config', 'astro.config.mjs', 'package.json', 'tsconfig.json']) {
      fs.cpSync(path.join(ROOT, entry), path.join(tmp, entry), { recursive: true });
    }
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
    for (const rel of ['src/content/gear/first-aid.md', 'src/content/scenarios/power-cuts.md']) {
      const file = path.join(tmp, rel);
      const md = fs.readFileSync(file, 'utf8');
      expect(md).toMatch(/^pubDate: 2026-11-14$/m);
      expect(md).toMatch(/^lastReviewed: 2026-11-14$/m);
      fs.writeFileSync(file, md.replace(/^lastReviewed: 2026-11-14$/m, 'lastReviewed: 2026-11-15'));
    }
    dist = path.join(tmp, 'dist');
    const env: NodeJS.ProcessEnv = { ...process.env, TZ: 'America/Los_Angeles' };
    for (const k of ['SITE_ENV', 'AMAZON_ASSOCIATES_UK_TAG', 'CF_PAGES', 'CF_PAGES_BRANCH', 'CF_PAGES_URL']) delete env[k];
    build = spawnSync(path.join(ROOT, 'node_modules/.bin/astro'), ['build', '--outDir', dist], {
      cwd: tmp,
      env,
      encoding: 'utf8',
    });
  }, 180_000);

  afterAll(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('builds', () => {
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
  });

  it('shows Published next to Last reviewed on the bumped gear and scenario pages', () => {
    for (const rel of ['gear/first-aid/index.html', 'scenarios/power-cuts/index.html']) {
      const b = byline(page(rel));
      expect(b, rel).toContain(PUBLISHED_MARKUP);
      expect(b, rel).toMatch(/^Edited by <a href="\/about\/kieran-littlewood\/"[^>]*>Kieran Littlewood<\/a> · Published /);
    }
  });

  it('keeps the label absent on pages whose dates are still equal', () => {
    for (const rel of ['gear/radios/index.html', 'scenarios/flood-england-wales/index.html']) {
      const b = byline(page(rel));
      expect(b, rel).toMatch(/<\/a> · Last reviewed 14\u00a0November\u00a02026<\/span>$/);
      expect(b, rel).not.toContain('Published');
      expect(page(rel), rel).not.toContain('<time');
    }
  });

  it('passes check:jsonld on the fixture output (datePublished visible, dateModified matches)', () => {
    const r = checkJsonLd(dist, { now: NOW });
    expect(r.failures).toEqual([]);
    expect(r.files).toBe(35);
  });
});
