/**
 * S1-10: the single source of truth for the committed verified set (ASINs in display_rank order).
 * Tests that depend on which products are verified import from here.
 */
import type { ProductCategory } from '../../src/lib/offers/types';
import { RENDER_GATED_CATEGORIES } from '../../src/lib/offers/types.ts';

export const VERIFIED_BY_CATEGORY: Partial<Record<ProductCategory, readonly string[]>> = {
  emergency_water: ['B07L142XSN', 'B0BBSP1QVC'],
  first_aid_kit: ['B00L7S9LU4', 'B008XI72FC', 'B001MG6WJ4'],
  torch: ['B075F3FBTB', 'B016P27MGG', 'B0BV7HHSMX'],
  radio: ['B002XNGTOI', 'B091YFB8N2'], // Sangean B09SZB8Y4R unverified (CR: 0 seller ratings in 12 months); no third radio passed
  power_bank: ['B0CZ9LH53B', 'B0CNWT16R8', 'B09NTNTVRJ'],
  batteries: ['B093C9B1HK', 'B07L49RDJH', 'B07WSS27QT'],
  emergency_blanket: ['B0CDBYT9WW', 'B0H761VV55'],
  thermal_clothing: ['B004KMGZG2', 'B0887LWT53', 'B013LFW3WS'],
  hi_vis: ['B00KHN3DZE', 'B09V5JXY6D', 'B005DEW1K0'],
  jump_leads: ['B008RXAX0E', 'B000UZGUFE'],
  warning_triangle: ['B001NLVA6S', 'B0DHW4RF9Z'],
  // S1-10b (16 Nov 2026)
  water_container: ['B0036OW40Q', 'B003QAD4KY'],
  rainwater_storage: ['B00ZUTJAHA', 'B0CVL4W8CQ'],
  gravity_filter: ['B0DWTDW914'],
  flask: ['B00JOV3YDG', 'B000T21JFE', 'B00JOV3Z6W'],
  tin_opener: ['B00004OCJW', 'B000079XW2', 'B07NJHB97Y'],
  electric_lighter: ['B088HF3TYP'],
  two_way_radio: ['B07DYGD8CH', 'B078C7TD7Z', 'B01FDI6OKS'],
  multi_tool: ['B079MJBP21', 'B007ERHM5S', 'B0CX32Q354'],
  sleeping_bag: ['B0CLY3FR44', 'B0GQ4SQC9P'],
  hygiene: ['B08DDY4GCS', 'B06XYH6966'],
  baby_care: ['B08MXSBRSB', 'B0FFTNGFM9'],
  document_pouch: [], // OverBoard B07B19M6DB unverified (CR M2: seller has 5 ratings in 12 months); no replacement passed
  home_kit: [], // Ready America B00MCN9AJ0 unverified 16 Nov (N1: not UK-sold)
  grab_bag_kit: [], // Mayday + First My Family unverified 16 Nov (buyability: low-rated sellers); no kit met the 16 Nov kit criteria
};

/**
 * Every verified ASIN, sorted. NOTE (S1-10b, CR M1): categories in RENDER_GATED_CATEGORIES
 * (src/lib/offers/types.ts) stay verified here but do not render; rendered expectations subtract them
 * in code (scripts/derive-affiliate-count.ts, tests).
 */
export const VERIFIED_ASINS: readonly string[] = Object.values(VERIFIED_BY_CATEGORY).flat().sort();
export const VERIFIED_COUNT = VERIFIED_ASINS.length;

/** S1-10c hotfix (16 Nov 2026): records whose evidence was checked 16 Nov (replacements; Sangean since unverified). */
export const S1_10C_REPLACEMENTS: readonly string[] = ['B002XNGTOI', 'B09SZB8Y4R', 'B091YFB8N2', 'B0CNWT16R8', 'B09NTNTVRJ', 'B001MG6WJ4', 'B0BV7HHSMX', 'B0BBSP1QVC'];

/**
 * S1-10b (CR M1): what renders = VERIFIED_BY_CATEGORY minus RENDER_GATED_CATEGORIES (derived, never
 * hard-coded). Use these for anything that inspects rendered output (cards, links, dist).
 */
export const RENDERED_BY_CATEGORY: Partial<Record<ProductCategory, readonly string[]>> = Object.fromEntries(
  Object.entries(VERIFIED_BY_CATEGORY).filter(([c]) => !RENDER_GATED_CATEGORIES.includes(c as ProductCategory)),
);
export const RENDERED_ASINS: readonly string[] = Object.values(RENDERED_BY_CATEGORY).flat().sort();
export const RENDERED_COUNT = RENDERED_ASINS.length;

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
  'B00MGM3K7A', // Simply warning triangle: unverified at Kieran sign-off (S1-10, CR nit on #21)
  // S1-10b QA #24 buyability rule (16 Nov 2026): no Buy Box / not in stock / seller not Amazon or a well-rated UK seller.
  'B005AQK6V2', 'B09VBFQNKK', 'B0987MCGXT', 'B0CSSRD4NT', 'B0DCZ82MGG', 'B013P5S1KC', 'B0DFVRT79C',
  'B098X7PSQH', 'B0CHXZTBK9', 'B0CMY1SQ3D', 'B07QFSVXZW', 'B005GGMBI2', 'B09VTM8P2Z', 'B009A6VM1G',
  'B097JVCVMK', 'B07KRRFW9J', 'B0065ISDR8', 'B0HF7LWYV9', 'B00CRE5ZQG',
  'B0CMY1GRTZ', // LifeStraw Peak green (S1-10b): no Add to Basket on 16 Nov re-check
  'B004LWWFQ0', // Highlander 10L carrier (S1-10b): no Add to Basket on 16 Nov re-check
  'B0CHVPBJ29', // First My Family 1-person (S1-10b): pack-count conflict (36 vs 30)
  'B00MCN9AJ0', // Ready America 70510 (S1-10b N1): only offer is a US third-party seller, not UK-sold
  'B0896Q8JXD', 'B001FIQ7XU', // S1-10c (16 Nov 17:05): earliest delivery 12 Dec / 6 Dec, more than 10 days out
  'B09SZB8Y4R', 'B07B19M6DB', // CR strict 12-month seller rule (16 Nov 17:13): fewer than 20 ratings in the last 12 months
];

/** S1-10b (QA #24): a passing Buy Box check for synthetic verified fixtures in tests. */
export const TEST_BUYABILITY = {
  checked_at: '2026-11-15T09:00:00+00:00',
  featured_offer: true,
  in_stock: true,
  add_to_basket: true,
  seller_name: 'Amazon',
  ships_from: 'Amazon',
  seller_class: 'amazon' as const,
  seller_rating_note: null,
  availability_text_seen: 'In stock',
  outcome: 'pass' as const,
  reason: null,
};
