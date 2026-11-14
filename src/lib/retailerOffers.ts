import { z } from 'zod';
import raw from '../data/retailerOffers.json';

const evidenceSchema = z.enum([
  'official-guidance',
  'desk-research',
  'firsthand-test',
  'reader-tip',
]);

const networkSchema = z.enum([
  'amazon-associates',
  'awin',
  'webgains',
  'cj',
  'sovrn',
  'direct',
  'other',
]);

const categorySchema = z.enum([
  'torches',
  'power-banks',
  'radios',
  'water-storage',
  'first-aid',
  'winter-travel',
  'general',
]);

export const retailerOfferSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  merchant: z.string().min(1),
  network: networkSchema,
  category: categorySchema,
  /** Exact programme-generated URL. Empty string allowed while pending. */
  url: z.string(),
  enabled: z.boolean(),
  priceBand: z.string().optional(),
  summary: z.string().min(1),
  evidence: evidenceSchema.default('desk-research'),
});

export const retailerOffersFileSchema = z.object({
  version: z.number().int().positive(),
  updated: z.string().min(1),
  notes: z.string().optional(),
  offers: z.array(retailerOfferSchema),
});

export type RetailerOffer = z.infer<typeof retailerOfferSchema>;
export type RetailerOffersFile = z.infer<typeof retailerOffersFileSchema>;

const parsed = retailerOffersFileSchema.parse(raw);

export const retailerOffersFile: RetailerOffersFile = parsed;

/** Live offers only: enabled and with a non-empty absolute URL. */
export function getLiveOffers(category?: RetailerOffer['category']): RetailerOffer[] {
  return parsed.offers.filter((offer) => {
    if (!offer.enabled) return false;
    if (!offer.url.trim()) return false;
    if (category && offer.category !== category) return false;
    try {
      const u = new URL(offer.url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  });
}

export function hasLiveAmazonOffers(): boolean {
  return getLiveOffers().some((o) => o.network === 'amazon-associates');
}

export function getPendingOffers(category?: RetailerOffer['category']): RetailerOffer[] {
  return parsed.offers.filter((offer) => {
    if (category && offer.category !== category) return false;
    return !offer.enabled || !offer.url.trim();
  });
}
