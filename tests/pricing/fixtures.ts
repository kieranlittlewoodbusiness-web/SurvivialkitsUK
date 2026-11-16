/**
 * S1-13b FAKE fixtures only. These ASINs and amounts are invented test values, not Amazon
 * prices, and must never be copied into src/data. Fake tag/secret values only.
 */
import type { PriceRecord } from '../../src/lib/pricing';

export const FAKE_ASIN = 'B0TESTONLY';
export const FAKE_TAG = 'TESTONLY-21';
export const FAKE_SECRET = 'fake-secret-do-not-use';
export const FETCHED_AT = '2026-11-16T12:00:00Z';
export const NOW = '2026-11-16T18:00:00Z';

/** Flag on, production, not a preview: the only env in which prices may render. */
export const ON_ENV = { PRICE_DISPLAY_ENABLED: 'true', SITE_ENV: 'production' } as const;

export function fakeRecord(over: Partial<PriceRecord> & Record<string, unknown> = {}): PriceRecord {
  return {
    asin: FAKE_ASIN,
    marketplace: 'www.amazon.co.uk',
    amountMinor: 1234,
    currency: 'GBP',
    source: 'amazon-creators-api',
    fetchedAt: FETCHED_AT,
    ...over,
  } as PriceRecord;
}

export function fakeDiscounted(over: Partial<PriceRecord> = {}): PriceRecord {
  return fakeRecord({
    amountMinor: 1500,
    savingBasis: { amountMinor: 2000, type: 'LIST_PRICE', label: 'List Price' },
    savings: { amountMinor: 500, percentage: 25 },
    ...over,
  });
}

/** Shape of a Creators API GetItems item (OffersV2), fake values. */
export function fakeApiItem(over: Record<string, unknown> = {}) {
  return {
    asin: FAKE_ASIN,
    offersV2: {
      listings: [
        {
          availability: { type: 'IN_STOCK' },
          condition: { value: 'New' },
          isBuyBoxWinner: true,
          merchantInfo: { name: 'Fake Merchant' },
          price: {
            money: { amount: 15, currency: 'GBP', displayAmount: '£15.00' },
            savingBasis: {
              money: { amount: 20, currency: 'GBP', displayAmount: '£20.00' },
              savingBasisType: 'LIST_PRICE',
              savingBasisTypeLabel: 'List Price',
            },
            savings: { money: { amount: 5, currency: 'GBP', displayAmount: '£5.00' }, percentage: 25 },
          },
        },
      ],
    },
    ...over,
  };
}
