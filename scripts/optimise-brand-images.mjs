#!/usr/bin/env node
/**
 * S1-11 one-off: turns Kieran's brand imagery (kieran-assets-1116/UKSurvivalKits/imagery) into
 * AVIF + WebP + JPEG renditions in public/images/. Not part of the build; the outputs are committed.
 * sharp is not a project dependency. Run it from a folder where sharp is installed, e.g.
 *   NODE_PATH=/path/to/tools/node_modules node scripts/optimise-brand-images.mjs <imagery-dir>
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const req = createRequire(path.join(process.env.NODE_PATH ?? process.cwd(), 'noop.js'));
const sharp = req('sharp');
const src = process.argv[2];
if (!src) throw new Error('usage: optimise-brand-images.mjs <imagery-dir>');
const out = new URL('../public/images/', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });

const jobs = [
  { file: 'hero-desktop.webp', name: 'hero-desktop', widths: [960, 1280, 1600], q: { avif: 48, webp: 68, jpeg: 70 } },
  { file: 'hero-mobile.webp', name: 'hero-mobile', widths: [480, 720], q: { avif: 48, webp: 68, jpeg: 70 } },
  { file: 'power-cut-essentials.webp', name: 'power-cut-essentials', widths: [450, 900], q: { avif: 50, webp: 70, jpeg: 72 } },
  { file: 'winter-car-kit.webp', name: 'winter-car-kit', widths: [450, 900], q: { avif: 50, webp: 70, jpeg: 72 } },
  { file: 'grab-bags.webp', name: 'grab-bags', widths: [450, 900], q: { avif: 50, webp: 70, jpeg: 72 } },
];

for (const job of jobs) {
  for (const w of job.widths) {
    const base = sharp(path.join(src, job.file)).resize({ width: w, withoutEnlargement: true });
    await base.clone().avif({ quality: job.q.avif, effort: 6 }).toFile(path.join(out, `${job.name}-${w}.avif`));
    await base.clone().webp({ quality: job.q.webp, effort: 6 }).toFile(path.join(out, `${job.name}-${w}.webp`));
    await base.clone().jpeg({ quality: job.q.jpeg, mozjpeg: true, progressive: true }).toFile(path.join(out, `${job.name}-${w}.jpg`));
  }
}
// Open Graph image: 1200 x 630 JPEG (crawlers do not all read AVIF/WebP).
await sharp(path.join(src, 'social-share.jpg')).resize(1200, 630).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(out, 'social-share.jpg'));

for (const f of fs.readdirSync(out).sort()) console.log(`${String(fs.statSync(path.join(out, f)).size).padStart(7)}  ${f}`);
