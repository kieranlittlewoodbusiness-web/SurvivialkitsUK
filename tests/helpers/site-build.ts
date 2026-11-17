/**
 * Build a temp copy of the site for fixture tests (seo-6d-byline, seo-9b, seo-9c).
 *
 * node_modules is linked entry by entry, NOT as one symlink: Astro keeps its content-layer cache in
 * node_modules/.astro (data-store.json) and Vite in node_modules/.vite. A whole-directory symlink
 * made parallel fixture builds share that cache, so one build could render another build's content
 * (seen in SEO-9c: the bumped lastReviewed fixture rendered the unbumped dates). Each copy gets its
 * own empty cache dirs instead.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve('.');
const COPY = ['src', 'public', 'config', 'astro.config.mjs', 'package.json', 'tsconfig.json'];
const PER_BUILD_CACHES = new Set(['.astro', '.vite']);

export interface SiteBuild {
  tmp: string;
  dist: string;
  result: SpawnSyncReturns<string>;
  cleanup: () => void;
}

export function buildSiteCopy(
  prefix: string,
  opts: { tz?: string; mutate?: (dir: string) => void; env?: Record<string, string> } = {},
): SiteBuild {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const entry of COPY) fs.cpSync(path.join(ROOT, entry), path.join(tmp, entry), { recursive: true });
  const modules = path.join(tmp, 'node_modules');
  fs.mkdirSync(modules);
  for (const entry of fs.readdirSync(path.join(ROOT, 'node_modules'))) {
    if (PER_BUILD_CACHES.has(entry)) continue;
    fs.symlinkSync(path.join(ROOT, 'node_modules', entry), path.join(modules, entry));
  }
  opts.mutate?.(tmp);
  const dist = path.join(tmp, 'dist');
  const env: NodeJS.ProcessEnv = { ...process.env, TZ: opts.tz ?? 'UTC' };
  const scrub = ['SITE_ENV', 'AMAZON_ASSOCIATES_UK_TAG', 'CF_PAGES', 'CF_PAGES_BRANCH', 'CF_PAGES_URL'];
  // WEB-ADS: tracking IDs never leak in from the shell; tests pass them explicitly via opts.env.
  scrub.push('PUBLIC_GA4_ID', 'PUBLIC_GOOGLE_ADS_ID', 'PUBLIC_META_PIXEL_ID');
  for (const k of scrub) delete env[k];
  Object.assign(env, opts.env);
  const result = spawnSync(path.join(ROOT, 'node_modules/.bin/astro'), ['build', '--outDir', dist], {
    cwd: tmp,
    env,
    encoding: 'utf8',
  });
  return { tmp, dist, result, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}
