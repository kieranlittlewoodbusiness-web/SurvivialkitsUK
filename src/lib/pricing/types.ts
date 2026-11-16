/**
 * S1-13b: Amazon price data layer (behind PRICE_DISPLAY_ENABLED, default OFF).
 *
 * Amazon Associates only allows prices that come from its own API (Creators API or PA-API),
 * refreshed and timestamped. Every field in a PriceRecord therefore comes from an API response;
 * nothing here may be hand-entered or scraped, and the repo stores no price values.
 *
 * Money is stored as an integer number of MINOR units (pence for GBP). The API returns decimal
 * amounts (e.g. 59.49); mapping converts them once, rejecting anything that is not a whole number
 * of pence, so rendering never does float arithmetic.
 *
 * Contract for Web: docs/contracts/price-display.md
 */

/** Where a price came from. Only Amazon's own APIs are accepted. */
export const PRICE_SOURCES = ['amazon-creators-api', 'amazon-paapi'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

/** OffersV2 SavingBasisType values (Creators API docs, resources/offersV2). */
export const SAVING_BASIS_TYPES = ['LIST_PRICE', 'LOWEST_PRICE', 'LOWEST_PRICE_STRIKETHROUGH', 'WAS_PRICE'] as const;
export type SavingBasisType = (typeof SAVING_BASIS_TYPES)[number];

/**
 * OffersV2 listings[].availability.type values (Creators API docs, resources/offersV2,
 * "More detail on Availability Types"):
 *   AVAILABLE_DATE    not available, will be available on a future date
 *   IN_STOCK          in stock
 *   IN_STOCK_SCARCE   in stock, but stock levels are limited
 *   LEADTIME          only available after some lead time (order received to shipped)
 *   OUT_OF_STOCK      currently out of stock
 *   PREORDER          not yet available, can be pre-ordered
 *   UNAVAILABLE       not available
 *   UNKNOWN           unknown availability
 */
export const AVAILABILITY_TYPES = [
  'AVAILABLE_DATE',
  'IN_STOCK',
  'IN_STOCK_SCARCE',
  'LEADTIME',
  'OUT_OF_STOCK',
  'PREORDER',
  'UNAVAILABLE',
  'UNKNOWN',
] as const;
export type AvailabilityType = (typeof AVAILABILITY_TYPES)[number];

/**
 * S1-13b stock gate (PM ruling): a price may display only for these. IN_STOCK_SCARCE is still in
 * stock. LEADTIME (backorder-like), PREORDER, AVAILABLE_DATE, OUT_OF_STOCK, UNAVAILABLE and
 * UNKNOWN never display a price.
 */
export const DISPLAYABLE_AVAILABILITY: readonly AvailabilityType[] = ['IN_STOCK', 'IN_STOCK_SCARCE'];

/** ISO 4217 code. The site only displays GBP (amazon.co.uk). */
export type CurrencyCode = string;

export interface MoneyMinor {
  /** Integer minor units (pence), >= 0. */
  amountMinor: number;
  currency: CurrencyCode;
}

export interface PriceSavings {
  /** offersV2.listings.price.savings.money, minor units. > 0. */
  amountMinor: number;
  /** offersV2.listings.price.savings.percentage (integer 1..99). */
  percentage: number;
}

export interface PriceSavingBasis {
  /** offersV2.listings.price.savingBasis.money, minor units (the "list"/"was" reference). */
  amountMinor: number;
  type: SavingBasisType;
  /** offersV2.listings.price.savingBasis.savingBasisTypeLabel, e.g. "List Price". Plain text. */
  label: string;
}

/** One Amazon price for one ASIN, exactly as fetched. */
export interface PriceRecord {
  asin: string;
  /** Always 'www.amazon.co.uk' for this site. */
  marketplace: 'www.amazon.co.uk';
  /** offersV2.listings.price.money, minor units. */
  amountMinor: number;
  currency: CurrencyCode;
  savings?: PriceSavings;
  savingBasis?: PriceSavingBasis;
  /** offersV2.listings[].availability.type of the same (buy-box) listing. Required. */
  availability: AvailabilityType;
  source: PriceSource;
  /** When the API call returned, ISO 8601 UTC ("...Z"). Set by the fetcher, never by hand. */
  fetchedAt: string;
}

/** What Web renders. null from getDisplayPrice means "render nothing price-related". */
export interface DisplayPrice {
  asin: string;
  /** "Amazon.co.uk price" (the site name the licence examples put before the price). */
  sourceLabel: string;
  /** "£59.49" */
  formattedPrice: string;
  /** "Save £10.50 (15%)". Only when the API supplied consistent savings. */
  formattedSavings?: string;
  /** "List Price: £69.99". Only alongside formattedSavings. */
  formattedSavingBasis?: string;
  /** "as of 16 November 2026, 18:20 GMT" (Europe/London, GMT/BST label). */
  fetchedAtLabel: string;
  /** fetchedAt, ISO UTC, for <time datetime>. */
  fetchedAt: string;
  /** fetchedAt + 24h, ISO UTC. After this instant the price must not be visible. */
  expiresAt: string;
  /** Amazon's required disclaimer, verbatim. */
  disclaimerText: string;
}
