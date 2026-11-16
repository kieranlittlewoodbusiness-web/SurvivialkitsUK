/**
 * S1-13b: 24-hour staleness rule. Pure; the clock is injected.
 *
 * Amazon UK PA licence (viii): non-image Product Advertising Content may be cached "for up to
 * 24 hours". A price is visible while 0 <= now - fetchedAt <= 24h (exactly 24h is still
 * "up to 24 hours"). Future-dated, unparseable or non-UTC fetchedAt => hidden.
 */
import { isUtcIso } from './schema';

export const MAX_PRICE_AGE_HOURS = 24;
export const MAX_PRICE_AGE_MS = MAX_PRICE_AGE_HOURS * 3_600_000;

export type Clock = Date | string | number;

export function toMs(now: Clock): number {
  const t = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : Date.parse(now);
  return Number.isFinite(t) ? t : Number.NaN;
}

export type Freshness = 'fresh' | 'stale' | 'future' | 'invalid';

export function priceFreshness(fetchedAt: unknown, now: Clock, maxAgeMs = MAX_PRICE_AGE_MS): Freshness {
  if (!isUtcIso(fetchedAt)) return 'invalid';
  const n = toMs(now);
  if (Number.isNaN(n)) return 'invalid';
  const age = n - Date.parse(fetchedAt);
  if (age < 0) return 'future';
  if (age > maxAgeMs) return 'stale';
  return 'fresh';
}

export function isPriceVisible(fetchedAt: unknown, now: Clock, maxAgeMs = MAX_PRICE_AGE_MS): boolean {
  return priceFreshness(fetchedAt, now, maxAgeMs) === 'fresh';
}

/** fetchedAt + max age, ISO UTC. */
export function priceExpiresAt(fetchedAt: string, maxAgeMs = MAX_PRICE_AGE_MS): string {
  return new Date(Date.parse(fetchedAt) + maxAgeMs).toISOString();
}
