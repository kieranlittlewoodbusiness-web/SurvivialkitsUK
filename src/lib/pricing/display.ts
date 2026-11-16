/**
 * S1-13b: the single render entry point for Web. See docs/contracts/price-display.md.
 *
 * getDisplayPrice(asin, now, options) returns null (render nothing price-related) unless:
 *   1. the flag is on (PRICE_DISPLAY_ENABLED === 'true' on a production, non-preview build);
 *   2. the store holds a record for the ASIN that passes priceRecordSchema (API source,
 *      UTC fetchedAt, integer pence, consistent savings);
 *   3. the currency is GBP and the marketplace is www.amazon.co.uk;
 *   4. the price is fresh: 0 <= now - fetchedAt <= 24h;
 *   5. the listing is in stock (availability IN_STOCK or IN_STOCK_SCARCE).
 */
import { AMAZON_PRICE_DISCLAIMER, type BuildEnv } from '../offers/types';
import { formatLondonDateTime, londonOffset } from '../offers/time';
import { isPriceDisplayEnabled } from './flag';
import { validatePriceRecord } from './schema';
import { isPriceVisible, priceExpiresAt, toMs, type Clock } from './staleness';
import { DISPLAYABLE_AVAILABILITY, type DisplayPrice, type PriceRecord } from './types';

export { AMAZON_PRICE_DISCLAIMER };

export const PRICE_SOURCE_LABEL = 'Amazon.co.uk price';

/**
 * Licence (xi) notice for sites that display Product Advertising Content consisting of text.
 * PM ruling: compact, in the site footer, rendered only when the flag is on (use
 * amazonContentNotice / shouldShowAmazonPriceNotice below). UK wording.
 */
export const AMAZON_CONTENT_NOTICE =
  "CERTAIN CONTENT THAT APPEARS ON THIS SITE COMES FROM AMAZON EUROPE CORE S.à r.l. THIS CONTENT IS PROVIDED 'AS IS' AND IS SUBJECT TO CHANGE OR REMOVAL AT ANY TIME.";

/**
 * Footer helper for Web (PM ruling): the compact clause (xi) notice renders in the site footer
 * ONLY when the price flag is on. Flag off => false / null, so production output is unchanged.
 */
export function shouldShowAmazonPriceNotice(env?: BuildEnv): boolean {
  return isPriceDisplayEnabled(env);
}

/** The notice text to render in the footer, or null when it must not render. */
export function amazonContentNotice(env?: BuildEnv): string | null {
  return shouldShowAmazonPriceNotice(env) ? AMAZON_CONTENT_NOTICE : null;
}

/** Read-only lookup of fetched prices. The default store is empty: the repo holds no prices. */
export interface PriceStore {
  get(asin: string): unknown;
}

export const EMPTY_PRICE_STORE: PriceStore = { get: () => undefined };

/** Builds a store from fetcher output, keeping only records that validate. */
export function createPriceStore(records: readonly unknown[]): PriceStore {
  const map = new Map<string, PriceRecord>();
  for (const r of records) {
    const v = validatePriceRecord(r);
    if (v.ok) map.set(v.record.asin, v.record);
  }
  return { get: (asin) => map.get(asin) };
}

export interface DisplayPriceOptions {
  env?: BuildEnv;
  store?: PriceStore;
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 });
export const formatPence = (minor: number) => gbp.format(minor / 100);

/** "16 November 2026, 18:20 GMT" / "... BST" in Europe/London. */
export function formatFetchedAt(fetchedAt: string): string {
  const zone = londonOffset(fetchedAt) === '+01:00' ? 'BST' : 'GMT';
  return `${formatLondonDateTime(fetchedAt)} ${zone}`;
}

export function getDisplayPrice(asin: string, now: Clock, options: DisplayPriceOptions = {}): DisplayPrice | null {
  if (!isPriceDisplayEnabled(options.env)) return null;
  if (Number.isNaN(toMs(now))) return null;
  const raw = (options.store ?? EMPTY_PRICE_STORE).get(asin);
  if (raw === undefined) return null;
  const v = validatePriceRecord(raw);
  if (!v.ok) return null;
  const r = v.record;
  if (r.asin !== asin || r.currency !== 'GBP' || r.marketplace !== 'www.amazon.co.uk') return null;
  if (!DISPLAYABLE_AVAILABILITY.includes(r.availability)) return null;
  if (!isPriceVisible(r.fetchedAt, now)) return null;

  const out: DisplayPrice = {
    asin,
    sourceLabel: PRICE_SOURCE_LABEL,
    formattedPrice: formatPence(r.amountMinor),
    fetchedAtLabel: `as of ${formatFetchedAt(r.fetchedAt)}`,
    fetchedAt: new Date(Date.parse(r.fetchedAt)).toISOString(),
    expiresAt: priceExpiresAt(r.fetchedAt),
    disclaimerText: AMAZON_PRICE_DISCLAIMER,
  };
  if (r.savings && r.savingBasis) {
    out.formattedSavings = `Save ${formatPence(r.savings.amountMinor)} (${r.savings.percentage}%)`;
    out.formattedSavingBasis = `${r.savingBasis.label}: ${formatPence(r.savingBasis.amountMinor)}`;
  }
  return out;
}
