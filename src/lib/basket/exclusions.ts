/**
 * S1-12: ASINs that must never enter a basket. This list matches the removals in hotfix #28
 * (S1-10c) exactly: products that failed the buyability rule on 16 Nov 2026 (no Buy Box / not in
 * stock / earliest delivery more than 10 days out / Buy Box seller not Amazon or a GB seller with
 * >=85% positive and >=20 ratings in the last 12 months). #28 unverifies them on main; until it
 * lands some are still verified there, so both baskets drop them explicitly.
 * DELETE THIS FILE once #28 is on main (they then fail the verified gate anyway).
 */
export const BASKET_EXCLUDED_ASINS: readonly string[] = [
  'B09VBFQNKK', // PRUNUS wind-up radio: Buy Box seller CN-registered
  'B0987MCGXT', // ROCAM wind-up DAB radio: Buy Box seller HK-registered
  'B0DFVRT79C', // Philips TAR1609 radio: dispatched within 1 to 2 months
  'B0CSSRD4NT', // UGREEN power bank: Buy Box seller HK-registered
  'B0DCZ82MGG', // INIU power bank: Buy Box seller CN-registered, 7 ratings
  'B005AQK6V2', // Reliance Medical first aid kit: seller 83% positive
  'B013P5S1KC', // Energizer head torch: no featured offer
  'B0896Q8JXD', // Cano 500ml water: earliest delivery 12 Dec
  'B001FIQ7XU', // HypaGuard foil blankets: earliest delivery 6 Dec
  'B09SZB8Y4R', // Sangean radio: seller has 0 ratings in the last 12 months
];
