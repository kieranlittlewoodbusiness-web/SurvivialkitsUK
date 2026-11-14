import rawVariants from '../../data/kits/variants.json';
import rawOffers from '../../data/kits/offers.json';
import { parseOffersFile, parseVariantsFile } from './schema';

/** Validated seed data. Status is 'unverified-seed' until an approved source exists. */
export const variantsFile = parseVariantsFile(rawVariants);
export const offersFile = parseOffersFile(rawOffers);

export const kitVariants = variantsFile.variants;
export const kitOffers = offersFile.offers;
