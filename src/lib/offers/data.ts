import rawVariants from '../../data/kits/variants.json';
import rawOffers from '../../data/kits/offers.json';
import rawCatalogueProducts from '../../data/catalogue/products.json';
import rawCatalogueOffers from '../../data/catalogue/offers.json';
import rawProgrammes from '../../data/affiliate/programmes.json';
import {
  assertCatalogueReferences,
  parseAffiliateProgrammesFile,
  parseCatalogueProductsFile,
  parseOffersFile,
  parseVariantsFile,
} from './schema';
import type { Offer, ProductRecord } from './types';

/** Validated seed data. Status is 'unverified-seed' until an approved source exists. */
export const variantsFile = parseVariantsFile(rawVariants);
export const offersFile = parseOffersFile(rawOffers);

export const kitVariants = variantsFile.variants;
export const kitOffers = offersFile.offers;

/* ---------- S1-8 ---------- */

export const programmesFile = parseAffiliateProgrammesFile(rawProgrammes);
export const affiliateProgrammes = programmesFile.programmes;

export const catalogueProductsFile = parseCatalogueProductsFile(rawCatalogueProducts);
export const catalogueOffersFile = parseOffersFile(rawCatalogueOffers);

export const catalogueProducts = catalogueProductsFile.products;
export const catalogueOffers = catalogueOffersFile.offers;

assertCatalogueReferences([...kitOffers, ...catalogueOffers], affiliateProgrammes);

/** Every product (kits + catalogue) and every offer, for buildCatalogueComparisons. */
export const allProducts: ProductRecord[] = [...kitVariants, ...catalogueProducts];
export const allOffers: Offer[] = [...kitOffers, ...catalogueOffers];
