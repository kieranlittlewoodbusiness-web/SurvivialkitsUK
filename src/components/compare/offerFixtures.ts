/**
 * EXAMPLE FIXTURES, NOT REAL PRICES.
 *
 * Used only when the build runs with OFFERS_FIXTURES=1 (or =error), to show every offer state
 * for design review and screenshots. Production builds never load these. Amounts are deliberately
 * round placeholder values; retailer names and product URLs come from the research brief
 * (SURVIVAL_COMPARISON_BRIEF.md §3) so the links are realistic. The affiliate URL is example.com.
 */
import type { Offer } from './offerModel';

const hoursAgo = (now: Date, h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
const daysAhead = (now: Date, d: number) => new Date(now.getTime() + d * 86400_000).toISOString();

export function exampleOffers(now: Date = new Date()): Offer[] {
  const fresh = hoursAgo(now, 20);
  const old = hoursAgo(now, 24 * 10);
  return [
    // E180: one verified delivered price (the "best") + an unverified row.
    {
      variantId: 'evaq8-e180',
      retailer: 'EVAQ8',
      priceGbpIncVat: 10,
      deliveryGbp: 2,
      priceVerified: true,
      deliveryVerified: true,
      availabilityText: 'In stock',
      affiliateUrl: '',
      productUrl: 'https://evaq8.co.uk/go-bag-emergency-kit-72-hour-survival-supplies.html',
      sourceName: 'EVAQ8 product page',
      sourceUrl: 'https://evaq8.co.uk/go-bag-emergency-kit-72-hour-survival-supplies.html',
      lastChecked: fresh,
      nextCheckDue: daysAhead(now, 6),
    },
    {
      variantId: 'evaq8-e180',
      retailer: 'Amazon UK',
      priceGbpIncVat: 9,
      deliveryGbp: 0,
      priceVerified: false,
      deliveryVerified: false,
      availabilityText: 'Usually dispatched within 3 days',
      affiliateUrl: '',
      productUrl: 'https://www.amazon.co.uk/',
      sourceName: 'Amazon UK listing (model match not confirmed)',
      sourceUrl: 'https://www.amazon.co.uk/',
      lastChecked: fresh,
      nextCheckDue: daysAhead(now, 6),
    },
    // E182P: verified price but unknown delivery, plus a stale row. No best price.
    {
      variantId: 'evaq8-e182p',
      retailer: 'EVAQ8',
      priceGbpIncVat: 20,
      deliveryGbp: null,
      priceVerified: true,
      deliveryVerified: false,
      availabilityText: 'In stock',
      affiliateUrl: '',
      productUrl: 'https://evaq8.co.uk/gobag-emergency-kit-2-person-e141-plain.html',
      sourceName: 'EVAQ8 product page',
      sourceUrl: 'https://evaq8.co.uk/gobag-emergency-kit-2-person-e141-plain.html',
      lastChecked: fresh,
      nextCheckDue: daysAhead(now, 6),
    },
    {
      variantId: 'evaq8-e182p',
      retailer: 'Amazon UK',
      priceGbpIncVat: 19,
      deliveryGbp: 0,
      priceVerified: true,
      deliveryVerified: true,
      availabilityText: 'In stock',
      affiliateUrl: '',
      productUrl: 'https://www.amazon.co.uk/dp/B075LHXZ55',
      sourceName: 'Amazon UK listing',
      sourceUrl: 'https://www.amazon.co.uk/dp/B075LHXZ55',
      lastChecked: old,
      nextCheckDue: hoursAgo(now, 24 * 3),
    },
    // E184: verified with an (example) affiliate link to show rel + disclosure.
    {
      variantId: 'evaq8-e184',
      retailer: 'EVAQ8',
      priceGbpIncVat: 40,
      deliveryGbp: 0,
      priceVerified: true,
      deliveryVerified: true,
      availabilityText: 'In stock',
      affiliateUrl: 'https://example.com/affiliate/evaq8-e184',
      productUrl: 'https://evaq8.co.uk/bug-out-bag-4-person-family-go-bag.html',
      sourceName: 'EVAQ8 product page',
      sourceUrl: 'https://evaq8.co.uk/bug-out-bag-4-person-family-go-bag.html',
      lastChecked: fresh,
      nextCheckDue: daysAhead(now, 6),
    },
    // E194: unverified delivery only.
    {
      variantId: 'evaq8-e194',
      retailer: 'EVAQ8',
      priceGbpIncVat: 38,
      deliveryGbp: 3,
      priceVerified: true,
      deliveryVerified: false,
      availabilityText: 'In stock',
      affiliateUrl: '',
      productUrl: 'https://evaq8.co.uk/gobag-emergency-kit-4-person-in-holdall.html',
      sourceName: 'EVAQ8 product page',
      sourceUrl: 'https://evaq8.co.uk/gobag-emergency-kit-4-person-in-holdall.html',
      lastChecked: fresh,
      nextCheckDue: daysAhead(now, 6),
    },
    // tminus-t3-4p: deliberately no offers (per-kit empty state).
  ];
}
