/** Listing-verified Amazon UK ASINs (public amazon.co.uk pages, 15 Nov 2026). Shared by the S1-8b and S1-9 tests. */

/** S1-8b: the 9 ASINs that matched title, brand, model and pack contents (Kieran's approved 9). */
export const S1_8B_VERIFIED = [
  'B0896Q8JXD',
  'B00L7S9LU4',
  'B005AQK6V2',
  'B09VBFQNKK',
  'B0987MCGXT',
  'B0CZ9LH53B',
  'B0CSSRD4NT',
  'B0DCZ82MGG',
  'B001FIQ7XU',
].sort();

/** S1-9: new checklist products verified from their public listings. */
export const S1_9_NEW_VERIFIED = [
  'B01F1LUW6Y', // Energizer Waterproof Torch 2xAA (ESFH21)
  'B00SBD0WL0', // Energizer 5 LED Head Torch 3xAAA (638866)
].sort();

/** S1-9: new checklist candidates checked but left unverified (with a reason in verification_evidence.note). */
export const S1_9_NEW_UNVERIFIED = [
  'B0FJYDMPQH', // Heat Holders thermal hat: canonical URL is the parent ASIN
].sort();

export const ALL_VERIFIED = [...S1_8B_VERIFIED, ...S1_9_NEW_VERIFIED].sort();
