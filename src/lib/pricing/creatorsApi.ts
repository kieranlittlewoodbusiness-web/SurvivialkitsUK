/**
 * S1-13b: Amazon Creators API price fetcher: interface, documented mapping, typed errors and a
 * STUB that makes no network calls. Live access is blocked until the Associates account
 * qualifies (issue #19), so the stub always returns { ok: false, error.kind: 'unavailable' }.
 *
 * Amazon docs (read 16 Nov 2026):
 * - Auth (OAuth 2.0 client credentials via Login with Amazon; EU credential version 3.2 uses
 *   https://api.amazon.co.uk/auth/o2/token, scope "creatorsapi::default", bearer token valid
 *   1 hour and cacheable):
 *   https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/get-started/using-curl
 * - PA-API -> Creators API (Credential ID + Credential Secret replace AWS keys; Offers V1 is
 *   not available, use OffersV2; lowerCamelCase fields):
 *   https://affiliate-program.amazon.com/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi
 * - GetItems (POST https://creatorsapi.amazon/catalog/v1/getItems, header x-marketplace,
 *   body itemIds/itemIdType/marketplace/partnerTag/resources):
 *   https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/api-reference/operations/get-items
 * - OffersV2 resource (listings[].price.money / savingBasis / savings, isBuyBoxWinner,
 *   condition, availability):
 *   https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/api-reference/resources/offersV2
 *
 * Secrets: credential values are read server-side at build time only, never logged, never put in
 * error messages, never sent to the client. Errors carry fixed strings only.
 */
import { validatePriceRecord } from './schema';
import type { PriceRecord, PriceSource } from './types';

/** Env var NAMES only. Values live in Cloudflare Pages (production) secrets, never the repo. */
export const CREATORS_API_ENV = {
  credentialId: 'AMAZON_CREATORS_API_CREDENTIAL_ID',
  credentialSecret: 'AMAZON_CREATORS_API_CREDENTIAL_SECRET',
  /** "3.2" for EU/UK credentials (selects the token endpoint). */
  credentialVersion: 'AMAZON_CREATORS_API_CREDENTIAL_VERSION',
  /** Partner tag = the existing Associates tracking id; reuse, do not duplicate. */
  partnerTag: 'AMAZON_ASSOCIATES_UK_TAG',
} as const;

export const CREATORS_API = {
  tokenEndpointEu: 'https://api.amazon.co.uk/auth/o2/token',
  scope: 'creatorsapi::default',
  getItemsUrl: 'https://creatorsapi.amazon/catalog/v1/getItems',
  marketplace: 'www.amazon.co.uk',
  /** Requested resources. offersV2.listings.price carries money, savingBasis and savings. */
  resources: [
    'offersV2.listings.price',
    'offersV2.listings.isBuyBoxWinner',
    'offersV2.listings.condition',
    'offersV2.listings.availability',
    'offersV2.listings.merchantInfo',
  ],
  /** GetItems itemIds: "List of Non-Empty Strings (up to 10)" (get-items docs). */
  maxItemIdsPerRequest: 10,
} as const;

/* ---------- Typed errors and retry shape ---------- */

export type PriceFetchErrorKind =
  /** Account not yet eligible for API access (issue #19). Not retryable. */
  | 'unavailable'
  /** Required env vars missing. Not retryable. */
  | 'not_configured'
  /** 401/403 or token failure. Not retryable without operator action. */
  | 'auth'
  /** 429. Retryable with backoff. */
  | 'throttled'
  /** 5xx, timeout, network. Retryable with backoff. */
  | 'transient'
  /** Response did not match the documented shape. Not retryable. */
  | 'invalid_response';

export interface PriceFetchError {
  kind: PriceFetchErrorKind;
  retryable: boolean;
  /** Fixed, secret-free text. Never includes env values, tokens, tags or response bodies. */
  message: string;
  /** Present for 'throttled' when the server sent Retry-After. */
  retryAfterMs?: number;
}

export interface PriceFetchSuccess {
  ok: true;
  records: PriceRecord[];
  /** ASINs the API returned no usable buy-box price for (hidden, not an error). */
  missing: string[];
}
export type PriceFetchResult = PriceFetchSuccess | { ok: false; error: PriceFetchError };

export interface PriceFetcher {
  readonly source: PriceSource;
  fetchPrices(asins: readonly string[]): Promise<PriceFetchResult>;
}

const MESSAGES: Record<PriceFetchErrorKind, string> = {
  unavailable: 'Amazon Creators API access is not available for this account yet (issue #19).',
  not_configured: 'Creators API credentials are not configured.',
  auth: 'Creators API authentication failed.',
  throttled: 'Creators API request was throttled.',
  transient: 'Creators API request failed; it may succeed on retry.',
  invalid_response: 'Creators API response did not match the expected shape.',
};

export function priceFetchError(kind: PriceFetchErrorKind, retryAfterMs?: number): PriceFetchError {
  const retryable = kind === 'throttled' || kind === 'transient';
  const e: PriceFetchError = { kind, retryable, message: MESSAGES[kind] };
  if (kind === 'throttled' && retryAfterMs !== undefined && Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    e.retryAfterMs = retryAfterMs;
  }
  return e;
}

/** HTTP status -> error kind for the future live fetcher. */
export function classifyHttpStatus(status: number): PriceFetchErrorKind | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'throttled';
  if (status >= 500 || status === 408) return 'transient';
  return 'invalid_response';
}

export const RETRY_POLICY = { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 30_000 } as const;

/**
 * Delay before retry number `attempt` (1-based), or null to stop. Exponential backoff
 * (1s, 2s, ...) capped at maxDelayMs. A server Retry-After is honoured when larger than the
 * backoff; if Retry-After exceeds maxDelayMs we do NOT retry (return null) rather than retry
 * early against the server's instruction. Deterministic (no jitter) so it is testable; the
 * live fetcher may add jitter.
 */
export function nextRetryDelayMs(error: PriceFetchError, attempt: number, policy = RETRY_POLICY): number | null {
  if (!error.retryable || attempt >= policy.maxAttempts) return null;
  if (error.retryAfterMs !== undefined && error.retryAfterMs > policy.maxDelayMs) return null;
  const backoff = Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
  return Math.max(backoff, error.retryAfterMs ?? 0);
}

/** Which env var NAMES are missing. Never returns or logs values. */
export function missingCreatorsApiEnv(env: Record<string, string | undefined>): string[] {
  return Object.values(CREATORS_API_ENV).filter((name) => !env[name]);
}

/* ---------- Documented response mapping (pure; used by the future live fetcher) ---------- */

/** Decimal API amount (e.g. 59.49) -> integer pence, or null if not a whole number of pence. */
export function toMinorUnits(amount: unknown): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return null;
  const minor = Math.round(amount * 100);
  if (Math.abs(minor - amount * 100) > 1e-6) return null;
  return minor;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null);

/**
 * Maps one Creators API GetItems item to a PriceRecord, or null when it has no usable price.
 * Field mapping (OffersV2):
 *   item.asin                                        -> asin
 *   listing where isBuyBoxWinner === true and condition.value === 'New'
 *     .price.money.amount / .currency                -> amountMinor / currency
 *     .price.savingBasis.money.amount                -> savingBasis.amountMinor
 *     .price.savingBasis.savingBasisType             -> savingBasis.type
 *     .price.savingBasis.savingBasisTypeLabel        -> savingBasis.label
 *     .price.savings.money.amount / .percentage      -> savings.amountMinor / percentage
 *     .availability.type                             -> availability (missing/unknown => null)
 *   (fetcher clock at response time)                 -> fetchedAt (ISO UTC)
 * Savings are dropped (price kept) unless savings, savingBasis and price are all present, in the
 * same currency, and consistent to the penny.
 */
export function mapGetItemsItem(item: unknown, fetchedAt: string, source: PriceSource = 'amazon-creators-api'): PriceRecord | null {
  const it = obj(item);
  const listings = obj(it?.offersV2)?.listings;
  if (!it || !Array.isArray(listings)) return null;
  const listing = listings.map(obj).find((l) => l?.isBuyBoxWinner === true && obj(l.condition)?.value === 'New');
  const price = obj(listing?.price);
  const money = obj(price?.money);
  const amountMinor = toMinorUnits(money?.amount);
  if (!price || !money || amountMinor === null) return null;
  const currency = money.currency;

  const base = {
    asin: it.asin,
    marketplace: CREATORS_API.marketplace,
    amountMinor,
    currency,
    availability: obj(listing?.availability)?.type,
    source,
    fetchedAt,
  };

  const sb = obj(price.savingBasis);
  const sv = obj(price.savings);
  const sbMoney = obj(sb?.money);
  const svMoney = obj(sv?.money);
  let candidate: unknown = base;
  if (sb && sv && sbMoney && svMoney && sbMoney.currency === currency && svMoney.currency === currency) {
    const withSavings = {
      ...base,
      savingBasis: { amountMinor: toMinorUnits(sbMoney.amount), type: sb.savingBasisType, label: sb.savingBasisTypeLabel },
      savings: { amountMinor: toMinorUnits(svMoney.amount), percentage: sv.percentage },
    };
    if (validatePriceRecord(withSavings).ok) candidate = withSavings;
  }
  const v = validatePriceRecord(candidate);
  return v.ok ? v.record : null;
}

/* ---------- Stub (the only fetcher until #19 clears) ---------- */

/**
 * Makes NO network calls (no fetch, no token request) and never reads credential values.
 * Always resolves { ok: false, error: { kind: 'unavailable' } }.
 */
export class CreatorsApiStubFetcher implements PriceFetcher {
  readonly source = 'amazon-creators-api' as const;
  async fetchPrices(_asins: readonly string[]): Promise<PriceFetchResult> {
    return { ok: false, error: priceFetchError('unavailable') };
  }
}

export function createPriceFetcher(): PriceFetcher {
  return new CreatorsApiStubFetcher();
}
