/**
 * Prints the expected number of production affiliate buttons: verified products in categories that
 * are not render-gated (RENDER_GATED_CATEGORIES), capped at `perCategory` (default 3) in each category. Reads tests/offers/verifiedSet.ts.
 * Usage: node --experimental-strip-types scripts/derive-affiliate-count.ts [--asins | --rainwater]
 * --rainwater prints JSON { asins, note } (all verified rainwater_storage ASINs, gated or not, and the
 * required note) for the verify:dist rainwater guard.
 * Prints a number only (or, with --asins, a JSON array of the expected ASINs: each category's first
 * `perCategory` in rank order). Never prints a tag or any credential.
 */
import { VERIFIED_BY_CATEGORY } from '../tests/offers/verifiedSet.ts';
import { RAINWATER_DRINKING_WATER_NOTE, RENDER_GATED_CATEGORIES } from '../src/lib/offers/types.ts';

/** S1-10b (CR M1): render-gated categories stay verified but never render, so they are not expected in dist. */
const rendered = Object.entries(VERIFIED_BY_CATEGORY)
  .filter(([cat]) => !(RENDER_GATED_CATEGORIES as readonly string[]).includes(cat))
  .map(([, asins]) => asins as readonly string[]);

const cap = Number(process.env.PER_CATEGORY_CAP ?? 3);
if (!Number.isInteger(cap) || cap < 1) {
  throw new RangeError('PER_CATEGORY_CAP must be a positive integer');
}
if (process.argv.includes('--rainwater')) {
  process.stdout.write(JSON.stringify({ asins: VERIFIED_BY_CATEGORY.rainwater_storage ?? [], note: RAINWATER_DRINKING_WATER_NOTE }));
} else if (process.argv.includes('--asins')) {
  const asins = rendered.flatMap((list) => list.slice(0, cap));
  process.stdout.write(JSON.stringify(asins));
} else {
  const n = rendered.reduce((sum, asins) => sum + Math.min(asins.length, cap), 0);
  process.stdout.write(String(n));
}
