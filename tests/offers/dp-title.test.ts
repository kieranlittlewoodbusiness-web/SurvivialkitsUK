/**
 * QA guard (S1-10c, 16 Nov 2026): every verified product records the /dp title it was checked
 * against, and that title must contain the product's brand and a name or model token.
 */
import { describe, expect, it } from 'vitest';
import rawProducts from '../../src/data/catalogue/products.json';
import { dpTitleMismatch, readDpTitleCheck } from './dpTitleGuard';
import { VERIFIED_ASINS } from './verifiedSet';

type Raw = {
  asin_uk: string;
  brand: string;
  display_name: string | null;
  product_name: string;
  model_code: string | null;
  mpn: string | null;
  verification: string;
  verification_evidence?: { note: string };
};
const products = (rawProducts as unknown as { products: Raw[] }).products;
const verified = products.filter((p) => p.verification === 'verified');

describe('dp title guard (reused ASINs)', () => {
  it('every verified product records a dp_title_checked line, checked on or after 16 Nov 2026 17:00 UK', () => {
    expect(verified.map((p) => p.asin_uk).sort()).toEqual([...VERIFIED_ASINS]);
    for (const p of verified) {
      const dp = readDpTitleCheck(p.verification_evidence!.note);
      expect(dp, p.asin_uk).not.toBeNull();
      expect(dp!.checkedAt >= '2026-11-16T17:00Z', p.asin_uk).toBe(true);
    }
  });

  it("each recorded dp title contains the product's brand and a name or model token", () => {
    for (const p of verified) {
      const dp = readDpTitleCheck(p.verification_evidence!.note)!;
      const rec = { brand: p.brand, names: [p.display_name ?? '', p.product_name], models: [p.model_code, p.mpn] };
      expect(dpTitleMismatch(rec, dp), p.asin_uk).toEqual([]);
    }
  });

  it('catches the reused Duronic ASIN (B002XNGTOI now shows a CT51 car tool) and keeps it unverified', () => {
    const duronic = products.find((p) => p.asin_uk === 'B002XNGTOI')!;
    expect(duronic.verification).toBe('unverified');
    const ct51 = {
      checkedAt: '2026-11-16T17:25Z',
      pageBrand: 'Duronic',
      title:
        'Duronic CT51 Emergency Car Tool, Multifunctional Seatbelt Cutter with Pin Hammer, Car Escape Tool with Window Breaker, SOS Alarm and Magnetic Flashlight with USB-C Charging for Cars, Vans & Truck',
    };
    const rec = { brand: duronic.brand, names: [duronic.display_name ?? '', duronic.product_name], models: [duronic.model_code, duronic.mpn] };
    expect(dpTitleMismatch(rec, ct51)).toEqual(['no name or model token from the record appears in the dp title']);
  });
});
