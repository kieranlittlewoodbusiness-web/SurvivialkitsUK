/**
 * Prints the expected number of production affiliate buttons in the whole build:
 * - compare page: verified products, capped at `perCategory` (default 3) in each category;
 * - homepage (S1-11): one top pick per category that has a compare section (any verified product,
 *   except the legacy `kit` bucket, which the compare page does not render).
 * Reads tests/offers/verifiedSet.ts.
 * Usage: node --experimental-strip-types scripts/derive-affiliate-count.ts [--json]
 * Prints the total (or {"compare","home","total","categories"} with --json); never prints a tag.
 */
import { VERIFIED_BY_CATEGORY } from '../tests/offers/verifiedSet.ts';

const cap = Number(process.env.PER_CATEGORY_CAP ?? 3);
if (!Number.isInteger(cap) || cap < 1) {
  throw new RangeError('PER_CATEGORY_CAP must be a positive integer');
}
const entries = Object.entries(VERIFIED_BY_CATEGORY).filter(([cat, asins]) => cat !== 'kit' && (asins?.length ?? 0) > 0);
const compare = entries.reduce((sum, [, asins]) => sum + Math.min(asins!.length, cap), 0);
const home = entries.length;
const total = compare + home;
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ compare, home, total, categories: entries.map(([c]) => c) }));
} else {
  process.stdout.write(String(total));
}
