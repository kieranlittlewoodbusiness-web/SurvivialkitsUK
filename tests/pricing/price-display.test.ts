/**
 * S1-13b: price data layer behind PRICE_DISPLAY_ENABLED (default OFF).
 * Fake fixtures only (tests/pricing/fixtures.ts). No real tag, credentials or prices.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AMAZON_PRICE_DISCLAIMER,
  CREATORS_API_ENV,
  CreatorsApiStubFetcher,
  EMPTY_PRICE_STORE,
  MAX_PRICE_AGE_HOURS,
  classifyHttpStatus,
  createPriceFetcher,
  createPriceStore,
  getDisplayPrice,
  isPriceDisplayEnabled,
  isPriceVisible,
  mapGetItemsItem,
  missingCreatorsApiEnv,
  nextRetryDelayMs,
  priceFetchError,
  priceFreshness,
  toMinorUnits,
  validatePriceRecord,
} from '../../src/lib/pricing';
import { affiliateProgrammes } from '../../src/lib/offers/data';
import { FAKE_ASIN, FAKE_SECRET, FAKE_TAG, FETCHED_AT, NOW, ON_ENV, fakeApiItem, fakeDiscounted, fakeRecord } from './fixtures';

const HOUR = 3_600_000;
const at = (iso: string, deltaMs: number) => new Date(Date.parse(iso) + deltaMs).toISOString();
const show = (record: unknown, env: Record<string, string | undefined> = ON_ENV, now: string | number | Date = NOW) =>
  getDisplayPrice(FAKE_ASIN, now, { env, store: createPriceStore([record]) });
/** Bypasses createPriceStore filtering, to prove getDisplayPrice validates on its own. */
const rawStore = (record: unknown) => ({ get: (a: string) => (a === FAKE_ASIN ? record : undefined) });

afterEach(() => vi.restoreAllMocks());

describe('flag OFF => nothing renders', () => {
  const valid = [fakeRecord(), fakeDiscounted(), fakeRecord({ source: 'amazon-paapi' })];
  const offEnvs: Record<string, Record<string, string | undefined>> = {
    unset: { SITE_ENV: 'production' },
    empty: { SITE_ENV: 'production', PRICE_DISPLAY_ENABLED: '' },
    false: { SITE_ENV: 'production', PRICE_DISPLAY_ENABLED: 'false' },
    TRUE: { SITE_ENV: 'production', PRICE_DISPLAY_ENABLED: 'TRUE' },
    True: { SITE_ENV: 'production', PRICE_DISPLAY_ENABLED: 'True' },
    '1': { SITE_ENV: 'production', PRICE_DISPLAY_ENABLED: '1' },
    yes: { SITE_ENV: 'production', PRICE_DISPLAY_ENABLED: 'yes' },
    ' true': { SITE_ENV: 'production', PRICE_DISPLAY_ENABLED: ' true' },
    'true ': { SITE_ENV: 'production', PRICE_DISPLAY_ENABLED: 'true ' },
  };
  for (const [name, env] of Object.entries(offEnvs)) {
    it(`PRICE_DISPLAY_ENABLED=${JSON.stringify(name)} => off, null for every fresh valid fixture`, () => {
      expect(isPriceDisplayEnabled(env)).toBe(false);
      for (const r of valid) {
        expect(show(r, env)).toBeNull();
        expect(getDisplayPrice(FAKE_ASIN, NOW, { env, store: rawStore(r) })).toBeNull();
      }
    });
  }

  const nonProd: Record<string, Record<string, string | undefined>> = {
    'dev (SITE_ENV unset)': { PRICE_DISPLAY_ENABLED: 'true' },
    'SITE_ENV=preview': { PRICE_DISPLAY_ENABLED: 'true', SITE_ENV: 'preview' },
    'Cloudflare branch preview': { PRICE_DISPLAY_ENABLED: 'true', SITE_ENV: 'production', CF_PAGES: '1', CF_PAGES_BRANCH: 's1-13b-price-data' },
    'unknown SITE_ENV': { PRICE_DISPLAY_ENABLED: 'true', SITE_ENV: 'staging' },
  };
  for (const [name, env] of Object.entries(nonProd)) {
    it(`flag 'true' but ${name} => off`, () => {
      expect(isPriceDisplayEnabled(env)).toBe(false);
      for (const r of valid) expect(show(r, env)).toBeNull();
    });
  }

  it('default env (no options) is off in the test runner, even with a fresh record', () => {
    expect(getDisplayPrice(FAKE_ASIN, NOW)).toBeNull();
    expect(getDisplayPrice(FAKE_ASIN, NOW, { store: createPriceStore([fakeRecord()]) })).toBeNull();
  });

  it('flag on + production + main branch on Cloudflare => on (the only enabling case)', () => {
    expect(isPriceDisplayEnabled(ON_ENV)).toBe(true);
    expect(isPriceDisplayEnabled({ ...ON_ENV, CF_PAGES: '1', CF_PAGES_BRANCH: 'main' })).toBe(true);
  });
});

describe('getDisplayPrice render contract (flag on)', () => {
  it('fresh valid record => formatted price, timestamp label, disclaimer, expiry', () => {
    expect(show(fakeRecord())).toEqual({
      asin: FAKE_ASIN,
      sourceLabel: 'Amazon.co.uk price',
      formattedPrice: '£12.34',
      fetchedAtLabel: 'as of 16 November 2026, 12:00 GMT',
      fetchedAt: '2026-11-16T12:00:00.000Z',
      expiresAt: '2026-11-17T12:00:00.000Z',
      disclaimerText: AMAZON_PRICE_DISCLAIMER,
    });
  });

  it('discount => formattedSavings and formattedSavingBasis', () => {
    const d = show(fakeDiscounted())!;
    expect(d.formattedPrice).toBe('£15.00');
    expect(d.formattedSavings).toBe('Save £5.00 (25%)');
    expect(d.formattedSavingBasis).toBe('List Price: £20.00');
  });

  it('BST timestamps are labelled BST in Europe/London time', () => {
    const d = show(fakeRecord({ fetchedAt: '2026-07-01T12:00:00Z' }), ON_ENV, '2026-07-01T13:00:00Z')!;
    expect(d.fetchedAtLabel).toBe('as of 1 July 2026, 13:00 BST');
  });

  it('disclaimer is the UK licence wording verbatim', () => {
    expect(AMAZON_PRICE_DISCLAIMER).toBe(
      'Product prices and availability are accurate as of the date/time indicated and are subject to change. Any price and availability information displayed on Amazon.co.uk at the time of purchase will apply to the purchase of this product.',
    );
  });

  it('unknown ASIN / empty store => null', () => {
    expect(getDisplayPrice('B0NOTSTORE', NOW, { env: ON_ENV, store: createPriceStore([fakeRecord()]) })).toBeNull();
    expect(getDisplayPrice(FAKE_ASIN, NOW, { env: ON_ENV, store: EMPTY_PRICE_STORE })).toBeNull();
    expect(getDisplayPrice(FAKE_ASIN, NOW, { env: ON_ENV })).toBeNull();
  });

  it('record keyed under a different ASIN => null', () => {
    const store = { get: () => fakeRecord({ asin: 'B0OTHERASN' }) };
    expect(getDisplayPrice(FAKE_ASIN, NOW, { env: ON_ENV, store })).toBeNull();
  });

  it('invalid now => null', () => {
    expect(show(fakeRecord(), ON_ENV, 'not a date')).toBeNull();
  });
});

describe('24-hour staleness (injectable clock)', () => {
  it('MAX_PRICE_AGE_HOURS = 24 and agrees with programmes.json max_price_age_hours', () => {
    expect(MAX_PRICE_AGE_HOURS).toBe(24);
    const amz = affiliateProgrammes.find((p) => p.programme_id === 'amazon-associates-uk')!;
    expect((amz as { max_price_age_hours?: number }).max_price_age_hours).toBe(24);
  });

  it('boundary: exactly 24h old => shown; 24h + 1ms => hidden', () => {
    expect(priceFreshness(FETCHED_AT, at(FETCHED_AT, 24 * HOUR))).toBe('fresh');
    expect(show(fakeRecord(), ON_ENV, at(FETCHED_AT, 24 * HOUR))).not.toBeNull();
    expect(priceFreshness(FETCHED_AT, at(FETCHED_AT, 24 * HOUR + 1))).toBe('stale');
    expect(show(fakeRecord(), ON_ENV, at(FETCHED_AT, 24 * HOUR + 1))).toBeNull();
  });

  it('stale > 24h => null (25h, 7 days)', () => {
    expect(show(fakeRecord(), ON_ENV, at(FETCHED_AT, 25 * HOUR))).toBeNull();
    expect(show(fakeDiscounted(), ON_ENV, at(FETCHED_AT, 7 * 24 * HOUR))).toBeNull();
  });

  it('age 0 => shown; future fetchedAt (even 1ms) => null', () => {
    expect(show(fakeRecord(), ON_ENV, FETCHED_AT)).not.toBeNull();
    expect(priceFreshness(FETCHED_AT, at(FETCHED_AT, -1))).toBe('future');
    expect(show(fakeRecord(), ON_ENV, at(FETCHED_AT, -1))).toBeNull();
    expect(show(fakeRecord({ fetchedAt: '2027-01-01T00:00:00Z' }))).toBeNull();
  });

  it('invalid fetchedAt => invalid / hidden', () => {
    for (const f of ['', 'yesterday', '2026-11-16', '2026-11-16T12:00:00+00:00', '2026-02-30T12:00:00Z', 123, null, undefined]) {
      expect(priceFreshness(f, NOW)).toBe('invalid');
      expect(isPriceVisible(f, NOW)).toBe(false);
      expect(getDisplayPrice(FAKE_ASIN, NOW, { env: ON_ENV, store: rawStore(fakeRecord({ fetchedAt: f as string })) })).toBeNull();
    }
  });

  it('accepts Date, number and string clocks', () => {
    const t = Date.parse(NOW);
    expect(isPriceVisible(FETCHED_AT, new Date(t))).toBe(true);
    expect(isPriceVisible(FETCHED_AT, t)).toBe(true);
    expect(isPriceVisible(FETCHED_AT, NOW)).toBe(true);
  });
});

describe('runtime validation rejects anything not from the API', () => {
  const bad: Record<string, Record<string, unknown>> = {
    'missing source': { source: undefined },
    'manual source': { source: 'manual_capture' },
    'scraped source': { source: 'scrape' },
    'legacy PriceOrigin value': { source: 'amazon_product_api' },
    'missing fetchedAt': { fetchedAt: undefined },
    'lowercase currency': { currency: 'gbp' },
    'two-letter currency': { currency: 'GB' },
    'non-UK marketplace': { marketplace: 'www.amazon.com' },
    'decimal amount': { amountMinor: 12.34 },
    'zero amount': { amountMinor: 0 },
    'negative amount': { amountMinor: -1 },
    'string amount': { amountMinor: '1234' },
    'bad ASIN': { asin: 'not-an-asin' },
    'unknown extra field': { image: 'https://example.invalid/x.jpg' },
    'savings without basis': { savings: { amountMinor: 100, percentage: 10 } },
    'inconsistent savings': {
      savingBasis: { amountMinor: 2000, type: 'LIST_PRICE', label: 'List Price' },
      savings: { amountMinor: 600, percentage: 25 },
      amountMinor: 1500,
    },
    'unknown saving basis type': {
      savingBasis: { amountMinor: 2000, type: 'RRP', label: 'RRP' },
      savings: { amountMinor: 766, percentage: 38 },
    },
  };
  for (const [name, over] of Object.entries(bad)) {
    it(`${name} => rejected and never displayed`, () => {
      const r = { ...fakeRecord(), ...over };
      for (const k of Object.keys(over)) if (over[k] === undefined) delete (r as Record<string, unknown>)[k];
      expect(validatePriceRecord(r).ok).toBe(false);
      expect(show(r)).toBeNull();
      expect(getDisplayPrice(FAKE_ASIN, NOW, { env: ON_ENV, store: rawStore(r) })).toBeNull();
    });
  }

  it('valid USD record validates but does not display (GBP only)', () => {
    const usd = fakeRecord({ currency: 'USD' });
    expect(validatePriceRecord(usd).ok).toBe(true);
    expect(show(usd)).toBeNull();
  });

  it('both API sources are accepted', () => {
    expect(validatePriceRecord(fakeRecord({ source: 'amazon-paapi' })).ok).toBe(true);
    expect(validatePriceRecord(fakeRecord({ source: 'amazon-creators-api' })).ok).toBe(true);
  });
});

describe('Creators API fetcher stub', () => {
  it('never calls fetch, returns unavailable (#19), logs nothing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('network must not be used');
    });
    const logSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const f = createPriceFetcher();
    expect(f).toBeInstanceOf(CreatorsApiStubFetcher);
    const res = await f.fetchPrices([FAKE_ASIN, 'B0TESTONL2']);
    expect(res).toEqual({
      ok: false,
      error: { kind: 'unavailable', retryable: false, message: 'Amazon Creators API access is not available for this account yet (issue #19).' },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const s of logSpies) expect(s).not.toHaveBeenCalled();
  });

  it('errors and env checks never contain secret or tag values', () => {
    const env = {
      [CREATORS_API_ENV.credentialId]: 'fake-id',
      [CREATORS_API_ENV.credentialSecret]: FAKE_SECRET,
      [CREATORS_API_ENV.partnerTag]: FAKE_TAG,
    };
    expect(missingCreatorsApiEnv(env)).toEqual(['AMAZON_CREATORS_API_CREDENTIAL_VERSION']);
    expect(missingCreatorsApiEnv({})).toHaveLength(4);
    const all = (['unavailable', 'not_configured', 'auth', 'throttled', 'transient', 'invalid_response'] as const).map((k) => priceFetchError(k, 5));
    const text = JSON.stringify([all, missingCreatorsApiEnv(env)]);
    expect(text).not.toContain(FAKE_SECRET);
    expect(text).not.toContain(FAKE_TAG);
    expect(text).not.toContain('fake-id');
  });

  it('typed errors: retryable only for throttled/transient; HTTP classification', () => {
    expect(priceFetchError('throttled').retryable).toBe(true);
    expect(priceFetchError('transient').retryable).toBe(true);
    for (const k of ['unavailable', 'not_configured', 'auth', 'invalid_response'] as const) expect(priceFetchError(k).retryable).toBe(false);
    expect(classifyHttpStatus(200)).toBeNull();
    expect(classifyHttpStatus(401)).toBe('auth');
    expect(classifyHttpStatus(403)).toBe('auth');
    expect(classifyHttpStatus(429)).toBe('throttled');
    expect(classifyHttpStatus(503)).toBe('transient');
    expect(classifyHttpStatus(400)).toBe('invalid_response');
  });

  it('retry: exponential backoff, Retry-After honoured, max 3 attempts, none for non-retryable', () => {
    const t = priceFetchError('transient');
    expect([1, 2, 3].map((a) => nextRetryDelayMs(t, a))).toEqual([1000, 2000, null]);
    expect(nextRetryDelayMs(priceFetchError('throttled', 10_000), 1)).toBe(10_000);
    expect(nextRetryDelayMs(priceFetchError('throttled', 120_000), 1)).toBe(30_000);
    expect(nextRetryDelayMs(priceFetchError('auth'), 1)).toBeNull();
    expect(nextRetryDelayMs(priceFetchError('unavailable'), 1)).toBeNull();
  });
});

describe('OffersV2 mapping (fake API shape)', () => {
  it('maps buy-box New listing price, savingBasis and savings to pence', () => {
    expect(mapGetItemsItem(fakeApiItem(), FETCHED_AT)).toEqual(fakeDiscounted());
  });

  it('drops savings (keeps price) when inconsistent or in another currency', () => {
    const item = fakeApiItem();
    item.offersV2.listings[0]!.price.savings.money.amount = 4;
    expect(mapGetItemsItem(item, FETCHED_AT)).toEqual(fakeRecord({ amountMinor: 1500 }));
    const item2 = fakeApiItem();
    item2.offersV2.listings[0]!.price.savingBasis.money.currency = 'USD';
    expect(mapGetItemsItem(item2, FETCHED_AT)).toEqual(fakeRecord({ amountMinor: 1500 }));
  });

  it('no buy-box winner, used condition, missing money or bad fetchedAt => null', () => {
    const noBox = fakeApiItem();
    noBox.offersV2.listings[0]!.isBuyBoxWinner = false;
    expect(mapGetItemsItem(noBox, FETCHED_AT)).toBeNull();
    const used = fakeApiItem();
    used.offersV2.listings[0]!.condition.value = 'Used';
    expect(mapGetItemsItem(used, FETCHED_AT)).toBeNull();
    expect(mapGetItemsItem({ asin: FAKE_ASIN }, FETCHED_AT)).toBeNull();
    expect(mapGetItemsItem(null, FETCHED_AT)).toBeNull();
    expect(mapGetItemsItem(fakeApiItem(), '2026-11-16 12:00')).toBeNull();
  });

  it('toMinorUnits: whole pence only', () => {
    expect(toMinorUnits(59.49)).toBe(5949);
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
    expect(toMinorUnits(1.005)).toBeNull();
    expect(toMinorUnits(-1)).toBeNull();
    expect(toMinorUnits('5')).toBeNull();
    expect(toMinorUnits(Number.NaN)).toBeNull();
  });
});
