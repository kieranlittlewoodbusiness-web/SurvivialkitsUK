/**
 * Prints the expected production affiliate links, derived from tests/offers/verifiedSet.ts
 * (never hard-coded):
 * - compare page: each category's verified products in rank order, capped at `perCategory` (default 3),
 *   each ASIN linked exactly once;
 * - homepage (S1-11): at most one top pick per category that has a compare section (the legacy `kit`
 *   bucket never renders). A home link must be that category's FIRST-ranked verified product.
 * Usage: node --experimental-strip-types scripts/derive-affiliate-count.ts [--json | --asins]
 * Prints the total (compare + one home pick per category); with --json
 * {"compare","home","total","categories","byCategory","topPicks"}; with --asins the JSON array of
 * compare-page ASINs (the exact expected set). Never prints a tag or any credential.
 */
import { VERIFIED_BY_CATEGORY } from '../tests/offers/verifiedSet.ts';

const cap = Number(process.env.PER_CATEGORY_CAP ?? 3);
if (!Number.isInteger(cap) || cap < 1) {
  throw new RangeError('PER_CATEGORY_CAP must be a positive integer');
}
const entries = Object.entries(VERIFIED_BY_CATEGORY).filter(([cat, asins]) => cat !== 'kit' && (asins?.length ?? 0) > 0);
const byCategory = Object.fromEntries(entries.map(([c, asins]) => [c, asins!.slice(0, cap)]));
const topPicks = Object.fromEntries(entries.map(([c, asins]) => [c, asins![0]!]));
const compare = entries.reduce((sum, [, asins]) => sum + Math.min(asins!.length, cap), 0);
const home = entries.length;
const total = compare + home;
if (process.argv.includes('--asins')) {
  process.stdout.write(JSON.stringify(Object.values(byCategory).flat()));
} else if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ compare, home, total, categories: entries.map(([c]) => c), byCategory, topPicks }));
} else {
  process.stdout.write(String(total));
}
