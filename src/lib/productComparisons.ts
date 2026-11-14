import { z } from 'zod';
import raw from '../data/productComparisons.json';
import { getLiveOffers, retailerOffersFile, type RetailerOffer } from './retailerOffers';

const evidenceSchema = z.enum([
  'official-guidance',
  'desk-research',
  'firsthand-test',
  'reader-tip',
]);

const productSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    'torches',
    'power-banks',
    'radios',
    'water-storage',
    'first-aid',
    'winter-travel',
  ]),
  name: z.string().min(1),
  suits: z.string().min(1),
  specs: z.array(z.string()).min(1),
  limitations: z.array(z.string()).min(1),
  evidence: evidenceSchema,
  reviewFlags: z.array(z.string()).default([]),
  offerIds: z.array(z.string()).default([]),
});

const fileSchema = z.object({
  version: z.number(),
  updated: z.string(),
  products: z.array(productSchema),
});

export type ComparedProduct = z.infer<typeof productSchema>;

const parsed = fileSchema.parse(raw);

export function getProductsForCategory(category: ComparedProduct['category']): ComparedProduct[] {
  return parsed.products.filter((p) => p.category === category);
}

export function resolveProductOffers(product: ComparedProduct): RetailerOffer[] {
  const byId = new Map(retailerOffersFile.offers.map((o) => [o.id, o]));
  const fromIds = product.offerIds
    .map((id) => byId.get(id))
    .filter((o): o is RetailerOffer => Boolean(o));
  const liveFromIds = fromIds.filter((o) => o.enabled && o.url.trim());
  if (liveFromIds.length) return liveFromIds;
  return getLiveOffers(product.category);
}
