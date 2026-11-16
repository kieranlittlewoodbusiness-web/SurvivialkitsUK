/**
 * S1-10: the single source of truth for the committed verified set (ASINs in display_rank order).
 * Tests that depend on which products are verified import from here.
 */
import type { ProductCategory } from '../../src/lib/offers/types';

export const VERIFIED_BY_CATEGORY: Partial<Record<ProductCategory, readonly string[]>> = {
  emergency_water: ['B07L142XSN', 'B0BBSP1QVC'],
  first_aid_kit: ['B00L7S9LU4', 'B001MG6WJ4', 'B008XI72FC'],
  torch: ['B075F3FBTB', 'B0BV7HHSMX', 'B016P27MGG'],
  radio: ['B002XNGTOI', 'B091YFB8N2'], // Sangean B09SZB8Y4R unverified (CR: seller has 0 ratings in 12 months); no third radio passed
  power_bank: ['B0CZ9LH53B', 'B0CNWT16R8', 'B09NTNTVRJ'],
  batteries: ['B093C9B1HK', 'B07L49RDJH', 'B07WSS27QT'],
  emergency_blanket: ['B0CDBYT9WW', 'B0H761VV55'],
  thermal_clothing: ['B004KMGZG2', 'B0887LWT53', 'B013LFW3WS'],
  hi_vis: ['B00KHN3DZE', 'B09V5JXY6D', 'B005DEW1K0'],
  jump_leads: ['B008RXAX0E', 'B000UZGUFE'],
  warning_triangle: ['B001NLVA6S', 'B0DHW4RF9Z'],
};

/** Every verified ASIN, sorted. */
export const VERIFIED_ASINS: readonly string[] = Object.values(VERIFIED_BY_CATEGORY).flat().sort();
export const VERIFIED_COUNT = VERIFIED_ASINS.length;

/** S1-10c hotfix (16 Nov 2026): records whose evidence was checked 16 Nov (replacements; Sangean since unverified). */
export const S1_10C_REPLACEMENTS: readonly string[] = ['B002XNGTOI', 'B09SZB8Y4R', 'B091YFB8N2', 'B0CNWT16R8', 'B09NTNTVRJ', 'B001MG6WJ4', 'B0BV7HHSMX', 'B0BBSP1QVC'];

/** Thermal size children (PM ruling b): child ASIN -> parent canonical (size_child_of). */
export const THERMAL_SIZE_CHILDREN: Readonly<Record<string, string>> = {
  B004KMGZG2: 'B0DMT14LGZ',
  B0887LWT53: 'B0CKXG19WH',
  B013LFW3WS: 'B0DZ8DXDGP',
};

/** Hi-vis size children (PM ruling extending size_child_of to hi_vis): child ASIN -> parent canonical. */
export const HI_VIS_SIZE_CHILDREN: Readonly<Record<string, string>> = {
  B005DEW1K0: 'B0GZ3CPMWB',
};

/** Records kept UNVERIFIED on purpose, with the reason in verification_evidence. */
export const KNOWN_UNVERIFIED: readonly string[] = [
  'B01IFCIYXE', // Seven Oceans: no model number
  'B0134DAXJ2', // Datrex: pack conflict
  'B08GYLB55H', // Mayday: per-pouch volume conflict (S1-10)
  'B005JRULU8', // St John workplace kit: canonical/MPN mismatch
  'B08V17BPBC', // SOLARBABY: generic model
  'B0CMPZJS97', // Lifesystems: canonical/colour
  'B01LX282CT', // Heatwave: no model number
  'B01LYD385A', // Heatwave: no model number
  'B00DNSDDI2', // AA jump leads: model fields hold a barcode (S1-10)
  'B01F1LUW6Y', // Energizer torch (PR #17): not currently purchasable
  'B00SBD0WL0', // Energizer head torch (PR #17): not currently purchasable
  // S1-10c hotfix (16 Nov 2026): failed the buyability rule (no Buy Box / not in stock / seller not Amazon or a well-rated UK seller); replaced.
  'B005AQK6V2', 'B09VBFQNKK', 'B0987MCGXT', 'B0DFVRT79C', 'B0CSSRD4NT', 'B0DCZ82MGG', 'B013P5S1KC',
  'B0896Q8JXD', 'B001FIQ7XU', // earliest delivery more than 10 days out (12 Dec / 6 Dec)
  'B09SZB8Y4R', // Sangean: seller has 0 ratings in the last 12 months (strict 12-month rule; lifetime does not count)
];
