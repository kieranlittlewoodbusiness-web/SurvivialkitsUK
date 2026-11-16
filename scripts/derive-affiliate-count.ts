/**
 * Prints the expected number of production affiliate buttons: verified products, capped
 * at `perCategory` (default 3) in each category. Reads tests/offers/verifiedSet.ts.
 * Usage: node --experimental-strip-types scripts/derive-affiliate-count.ts [--asins]
 * Prints a number only (or, with --asins, a JSON array of the expected ASINs: each category's first
 * `perCategory` in rank order). Never prints a tag or any credential.
 */
import { VERIFIED_BY_CATEGORY } from '../tests/offers/verifiedSet.ts';

const cap = Number(process.env.PER_CATEGORY_CAP ?? 3);
if (!Number.isInteger(cap) || cap < 1) {
  throw new RangeError('PER_CATEGORY_CAP must be a positive integer');
}
if (process.argv.includes('--asins')) {
  const asins = Object.values(VERIFIED_BY_CATEGORY).flatMap((list) => list.slice(0, cap));
  process.stdout.write(JSON.stringify(asins));
} else {
  const n = Object.values(VERIFIED_BY_CATEGORY).reduce((sum, asins) => sum + Math.min(asins.length, cap), 0);
  process.stdout.write(String(n));
}
