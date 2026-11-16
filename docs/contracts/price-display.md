# Price display contract (S1-13b)

Owner: Backend. Consumer: Web. Status: **built, flag OFF, not wired into any page.**
Live prices are blocked until the Amazon Associates account qualifies for API access (issue #19).

Code: `src/lib/pricing/` (entry point `src/lib/pricing/index.ts`). Tests: `tests/pricing/`.

## 1. Rules this implements

Amazon only allows prices that come from its own API (Creators API or PA-API), refreshed and
timestamped. So:

- **No hand-entered or scraped prices.** The repo stores no price values. Every `PriceRecord`
  field comes from an API response, and `source` must be `amazon-creators-api` or `amazon-paapi`.
  A test fails if any `src/data` or `src/content` file contains price-layer fields.
- **24-hour maximum age.** A price shows only while `0 <= now - fetchedAt <= 24h`. Exactly 24h
  still shows; 24h + 1 ms does not. A future-dated, missing or non-UTC `fetchedAt` never shows.
  This matches `max_price_age_hours: 24` in `src/data/affiliate/programmes.json`.
- **Flag defaults OFF.** See section 4.

## 2. API: `getDisplayPrice(asin, now, options?)`

```ts
import { getDisplayPrice, AMAZON_CONTENT_NOTICE } from '../lib/pricing';

const price = getDisplayPrice(product.asin_uk, buildTime, { store }); // DisplayPrice | null
```

- `asin`: the product's `asin_uk`.
- `now`: `Date | string | number`. Pass the build or request time. Never fake it.
- `options.env`: defaults to `process.env`. Tests inject it.
- `options.store`: a `PriceStore` built by `createPriceStore(fetcherRecords)`. The default is
  empty, so today the function always returns `null`.

### Returns `null` (render NOTHING price-related) when any of these is true

1. `PRICE_DISPLAY_ENABLED` is not exactly `true`, or the build is not a production link build
   (`SITE_ENV=production` and not a preview, the same rule as affiliate links).
2. There is no record for the ASIN, or the record fails validation. Validation rejects: a
   source other than the two API sources, a missing or invalid `fetchedAt`, non-integer or zero
   pence, a bad currency or ASIN, a non-UK marketplace, unknown fields, or savings that don't
   equal `savingBasis - price` to the penny.
3. The currency is not `GBP`.
4. The price is stale (older than 24h), future-dated, or `now` is invalid.

When it returns `null`, Web keeps rendering exactly what it renders today: the card, the
"View on Amazon" link if one is allowed, and no price, savings, timestamp or disclaimer.

### Returns `DisplayPrice`

```ts
interface DisplayPrice {
  asin: string;
  sourceLabel: string;            // "Amazon.co.uk price"
  formattedPrice: string;         // "£12.34"
  formattedSavings?: string;      // "Save £5.00 (25%)"   (only with a consistent API discount)
  formattedSavingBasis?: string;  // "List Price: £20.00" (Amazon's savingBasisTypeLabel; only with formattedSavings)
  fetchedAtLabel: string;         // "as of 16 November 2026, 12:00 GMT"
  fetchedAt: string;              // ISO UTC, for <time datetime="...">
  expiresAt: string;              // fetchedAt + 24h, ISO UTC
  disclaimerText: string;         // Amazon wording, verbatim (section 3)
}
```

All strings are plain text. Escape them as text and never inject them as HTML.

## 3. Timestamp and disclaimer wording (Amazon rules)

Source: Amazon.co.uk Associates Central, *Associates Program Licence*,
<https://affiliate-program.amazon.co.uk/help/operating/license> (read 16 Nov 2026), clause (ix):

> You will include a date/time stamp adjacent to your display of pricing or availability
> information on your application if you obtain Product Advertising Content from a Data Feed,
> or if you call the PA API or refresh the Product Advertising Content displayed on your
> application less frequently than hourly. However, during the same day on which you requested
> and refreshed the pricing and availability information displayed on your application, you may
> omit the date portion of the stamp. Examples of acceptable messaging include:
> • [insert name of Amazon Site] Price: EUR/POUND 32.77 (as of 01/07/2012 14:11 [insert time zone] - Details)
> • [insert name of Amazon Site] Price: EUR/POUND 32.77 (as of 14:11 [insert time zone] - More info)
>
> Additionally, you must either include the following disclaimer adjacent to the pricing or
> availability information or provide it via a hyperlink, pop-up box, scripted pop-up, or other
> similar method: "Product prices and availability are accurate as of the date/time indicated
> and are subject to change. Any price and availability information displayed on [relevant
> Amazon Site(s), as applicable] at the time of purchase will apply to the purchase of this
> product."

The `disclaimerText` value is that disclaimer, with Amazon.co.uk as the site. It is the existing
`AMAZON_PRICE_DISCLAIMER` constant in `src/lib/offers/types.ts`, re-exported:

> Product prices and availability are accurate as of the date/time indicated and are subject to
> change. Any price and availability information displayed on Amazon.co.uk at the time of
> purchase will apply to the purchase of this product.

Do not reword it. It is Amazon's text, so it keeps Amazon's spelling. Our own labels use UK
English.

Clause (viii), the 24-hour cache limit: "You may store other Product Advertising Content that does
not consist of images for caching purposes for up to 24 hours, but if you do so you must
immediately thereafter refresh and re-display the Product Advertising Content…"

Clause (xi) also requires this notice "in plain view" wherever Product Advertising Content
consisting of text is displayed. It is exported as `AMAZON_CONTENT_NOTICE`:

> CERTAIN CONTENT THAT APPEARS ON THIS SITE COMES FROM AMAZON EUROPE CORE S.à r.l. THIS CONTENT
> IS PROVIDED 'AS IS' AND IS SUBJECT TO CHANGE OR REMOVAL AT ANY TIME.

### Time display decision

- Always show the **full date and time**, even on the same day. The licence allows dropping the
  date on the same day, but a static page can be read the next day, so we never drop it.
- Times are in **Europe/London**, 24-hour clock, labelled **GMT** or **BST** (for example
  `as of 16 November 2026, 12:00 GMT` or `as of 1 July 2026, 13:00 BST`). The date has no
  leading zero and uses the full month name, matching `formatLondonDateTime`.
- Put the UTC instant in the markup: `<time datetime="{fetchedAt}">{fetchedAtLabel}</time>`.

## 4. Placement rules for Web

1. **The price and timestamp sit together**, for example:
   `Amazon.co.uk price: £12.34 (as of 16 November 2026, 12:00 GMT – Details)`.
2. **The disclaimer** is either adjacent (directly under the price, same card) or one click
   away through a "Details" or "More info" control next to the timestamp. A `<details>` or
   disclosure button works; a hover-only tooltip does not, because it fails on touch devices
   and keyboards. The text must be in the HTML, not loaded later.
3. **Savings** (`formattedSavings`, `formattedSavingBasis`) appear only when present, in the
   same block as the price, and they share its timestamp. Never compute your own savings.
4. **`AMAZON_CONTENT_NOTICE`** must be in plain view (the footer is fine) on any page that
   renders at least one `DisplayPrice`. Show it only when a price renders.
5. **Nothing older than 24 hours may show.** The site is static, so the HTML outlives the
   build. Web must emit `data-price-expires="{expiresAt}"` on the price block and include a
   small inline script that removes price blocks once `Date.now() > expiresAt`. Release must
   also schedule a rebuild with a fresh fetch at least every 24h (see section 7). Without both,
   prices must stay OFF.
6. **No price text or images may be cached anywhere else** (no stored images, no JSON in
   `public/`).
7. **Order of precedence:** the card's affiliate-link rules are unchanged. A price never makes
   a link appear, and a missing price never hides one.

## 5. Schema (additive; no existing schema changed)

`PriceRecord` (`src/lib/pricing/types.ts`, validated by `priceRecordSchema`):

| Field | Type | From (Creators API OffersV2) |
| --- | --- | --- |
| `asin` | ASIN | `item.asin` |
| `marketplace` | `'www.amazon.co.uk'` | request marketplace |
| `amountMinor` | integer pence > 0 | `listings[buy box, New].price.money.amount` × 100 |
| `currency` | ISO 4217 (GBP displayable) | `price.money.currency` |
| `savingBasis?` | `{amountMinor, type, label}` | `price.savingBasis.money.amount`, `.savingBasisType`, `.savingBasisTypeLabel` |
| `savings?` | `{amountMinor > 0, percentage 1–99}` | `price.savings.money.amount`, `.percentage` |
| `source` | `'amazon-creators-api' \| 'amazon-paapi'` | set by the fetcher |
| `fetchedAt` | ISO UTC (`…Z`) | fetcher clock when the response arrives |

**Money** is stored as integer minor units. The API returns decimals; `toMinorUnits` converts
them once and rejects anything that isn't a whole number of pence. Savings are kept only when
`savingBasis - price === savings`, all in the same currency; otherwise the price stays and the
savings are dropped.

**Only the buy-box listing counts.** The mapping uses only the listing with
`isBuyBoxWinner === true` and `condition.value === 'New'`, the featured offer, consistent with
the buyability rule.

There are no new fields in `products.json`, `offers.json` or `verifiedSet.ts`. The existing
`price_origin` and `price_*` offer fields are untouched; Amazon offers keep them null or `none`.

## 6. Env vars (names only; values are server-side secrets in Cloudflare Pages production)

| Name | Purpose | Default |
| --- | --- | --- |
| `PRICE_DISPLAY_ENABLED` | Feature flag. Only the exact string `true` turns it on, and only on a production, non-preview build. | unset = OFF |
| `AMAZON_CREATORS_API_CREDENTIAL_ID` | Creators API Credential ID (OAuth `client_id`) | unset |
| `AMAZON_CREATORS_API_CREDENTIAL_SECRET` | Creators API Credential Secret (OAuth `client_secret`) | unset |
| `AMAZON_CREATORS_API_CREDENTIAL_VERSION` | Credential version; `3.2` for EU/UK, which selects `api.amazon.co.uk/auth/o2/token` | unset |
| `AMAZON_ASSOCIATES_UK_TAG` | Existing; reused as `partnerTag`. Never printed or logged. | unset |

Previews, dev and CI must leave all of these unset.

## 7. Fetcher (stub today)

`createPriceFetcher()` returns `CreatorsApiStubFetcher`. It makes **no network calls**, reads no
credentials, and always resolves
`{ ok: false, error: { kind: 'unavailable', retryable: false } }`.

The live fetcher, once #19 clears, should:

- Authenticate with OAuth 2.0 client credentials (POST `https://api.amazon.co.uk/auth/o2/token`,
  scope `creatorsapi::default`) and cache the 1-hour token.
  [Using curl](https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/get-started/using-curl),
  [Migrating from PA-API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi).
- Call POST `https://creatorsapi.amazon/catalog/v1/getItems` with header
  `x-marketplace: www.amazon.co.uk`, body `itemIds` (up to 10), `itemIdType: 'ASIN'`,
  `marketplace`, `partnerTag` and `resources` (`CREATORS_API.resources`).
  [GetItems](https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/api-reference/operations/get-items),
  [OffersV2](https://affiliate-program.amazon.co.uk/creatorsapi/docs/en-us/api-reference/resources/offersV2).
- Map each item with `mapGetItemsItem`.
- Handle failures with the typed errors: `auth` (401/403), `throttled` (429, honours
  Retry-After), `transient` (5xx/408/network), `invalid_response`, `not_configured`,
  `unavailable`. Only `throttled` and `transient` are retried (`nextRetryDelayMs`: 1 s then 2 s,
  3 attempts max, 30 s cap). On any failure no price renders, and the build must not fail
  because of prices.
- Never log credentials, tokens, the tag or response bodies. Error messages are fixed strings.

**Integration point (not built; needs PM, Web and Release):** a build step runs the fetcher
server-side, builds a `PriceStore`, and passes it to pages through `getDisplayPrice`. This PR
wires nothing, by PM constraint (new files only, no rendering or data files).

## 8. Migration and rollback

- Migration: none. The change is additive, with new files only. There are no data changes and
  no new env vars are required.
- Rollback: revert the PR. The flag stays OFF, so production output is unchanged either way.
