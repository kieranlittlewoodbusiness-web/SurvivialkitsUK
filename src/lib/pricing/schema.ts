/**
 * S1-13b: runtime validation for PriceRecord. Anything without an Amazon API source and a valid
 * UTC fetchedAt is rejected, as are non-integer money, unknown currencies and inconsistent
 * savings. Invalid records are dropped, never "repaired".
 */
import { z } from 'zod';
import { ASIN_PATTERN } from '../offers/schema';
import { AVAILABILITY_TYPES, PRICE_SOURCES, SAVING_BASIS_TYPES, type PriceRecord } from './types';

/** Strict ISO 8601 UTC instant, e.g. 2026-11-16T18:20:00Z or 2026-11-16T18:20:00.123Z. */
export const UTC_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function isUtcIso(value: unknown): value is string {
  if (typeof value !== 'string' || !UTC_ISO_PATTERN.test(value)) return false;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return false;
  // Reject calendar overflow such as 2026-02-30 (Date.parse would roll it over).
  return new Date(t).toISOString().slice(0, 19) === value.slice(0, 19);
}

const minor = z.number().int().nonnegative().max(100_000_000);
/** ISO 4217 shape; only GBP is displayable (enforced in display). */
const currency = z.string().regex(/^[A-Z]{3}$/);

export const priceRecordSchema = z
  .object({
    asin: z.string().regex(ASIN_PATTERN),
    marketplace: z.literal('www.amazon.co.uk'),
    amountMinor: minor.refine((n) => n > 0, { message: 'Price must be > 0' }),
    currency,
    savings: z
      .object({
        amountMinor: minor.refine((n) => n > 0, { message: 'Savings must be > 0' }),
        percentage: z.number().int().min(1).max(99),
      })
      .strict()
      .optional(),
    savingBasis: z
      .object({
        amountMinor: minor,
        type: z.enum(SAVING_BASIS_TYPES),
        label: z.string().min(1).max(40).regex(/^[A-Za-z][A-Za-z ]*$/),
      })
      .strict()
      .optional(),
    /** Missing or any value outside the documented enum => record rejected. */
    availability: z.enum(AVAILABILITY_TYPES),
    source: z.enum(PRICE_SOURCES),
    fetchedAt: z.string().refine(isUtcIso, { message: 'fetchedAt must be ISO 8601 UTC (Z)' }),
  })
  .strict()
  .superRefine((r, ctx) => {
    // Savings and saving basis come as a pair and must agree to the penny:
    // savings = savingBasis - price (Creators API docs: "the difference between the Price Money
    // and the SavingBasis Money").
    if (!!r.savings !== !!r.savingBasis) {
      ctx.addIssue({ code: 'custom', message: 'savings and savingBasis must both be present or both absent' });
      return;
    }
    if (r.savings && r.savingBasis) {
      if (r.savingBasis.amountMinor - r.amountMinor !== r.savings.amountMinor) {
        ctx.addIssue({ code: 'custom', message: 'savings must equal savingBasis - price' });
        return;
      }
      // CR L2: the API percentage must agree with the amounts to within 1 point (rounding).
      const expectedPct = Math.round((r.savings.amountMinor * 100) / r.savingBasis.amountMinor);
      if (Math.abs(expectedPct - r.savings.percentage) > 1) {
        ctx.addIssue({ code: 'custom', message: 'savings.percentage must be within 1 of round(savings * 100 / savingBasis)' });
      }
    }
  });

export type PriceValidation = { ok: true; record: PriceRecord } | { ok: false; issues: string[] };

export function validatePriceRecord(input: unknown): PriceValidation {
  const r = priceRecordSchema.safeParse(input);
  if (r.success) return { ok: true, record: r.data as PriceRecord };
  return { ok: false, issues: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
}
