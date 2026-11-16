/**
 * S1-12: ASINs that must never enter a basket. These 7 S1-10 products failed the QA #24 buyability
 * rule on 16 Nov 2026 (no Buy Box / not in stock / Buy Box seller not Amazon or a well-rated UK
 * seller). Hotfix s1-10c unverifies them on main; until it lands they may still be verified there,
 * so both baskets drop them explicitly. Safe to delete once s1-10c is on main (they then fail the
 * verified gate anyway).
 */
export const BASKET_EXCLUDED_ASINS: readonly string[] = [
  'B09VBFQNKK', // PRUNUS wind-up radio: Buy Box seller CN-registered
  'B0987MCGXT', // ROCAM wind-up DAB radio: Buy Box seller HK-registered
  'B0DFVRT79C', // Philips TAR1609 radio: dispatched within 1 to 2 months
  'B0CSSRD4NT', // UGREEN power bank: Buy Box seller HK-registered
  'B0DCZ82MGG', // INIU power bank: Buy Box seller CN-registered, 7 ratings
  'B005AQK6V2', // Reliance Medical first aid kit: seller 83% positive
  'B013P5S1KC', // Energizer head torch: no featured offer
];
