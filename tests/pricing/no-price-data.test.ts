/**
 * S1-13b: the repo holds no API price data, and nothing renders prices yet.
 * Prices may only come from the Creators API / PA-API at build time, never from repo files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalogueOffers, kitOffers } from '../../src/lib/offers/data';

const ROOT = path.resolve(__dirname, '../..');
const walk = (dir: string): string[] =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : [p];
      })
    : [];

/** Field names and source literals that only the S1-13b price layer uses. */
const PRICE_LAYER_KEYS = ['amountMinor', 'fetchedAt', 'fetched_at', 'savingBasis', 'saving_basis', 'listPrice', 'list_price', 'amazon-creators-api', 'amazon-paapi'];

describe('no price data in repo data files', () => {
  const dataFiles = [...walk(path.join(ROOT, 'src/data')), ...walk(path.join(ROOT, 'src/content'))];

  it('scans a non-empty set of data files', () => {
    expect(dataFiles.length).toBeGreaterThan(5);
  });

  it('no src/data or src/content file contains price-layer fields or API source literals', () => {
    const hits = dataFiles.flatMap((f) => {
      const text = fs.readFileSync(f, 'utf8');
      return PRICE_LAYER_KEYS.filter((k) => text.includes(k)).map((k) => `${path.relative(ROOT, f)}: ${k}`);
    });
    expect(hits).toEqual([]);
  });

  it('no Amazon offer in the repo carries a price value', () => {
    const amazon = [...catalogueOffers, ...kitOffers].filter((o) => o.retailer === 'Amazon UK');
    expect(amazon.length).toBeGreaterThan(0);
    for (const o of amazon) {
      expect(o.price_gbp_inc_vat).toBeNull();
      expect(o.price_gbp_ex_vat).toBeNull();
      expect(o.was_price_gbp).toBeNull();
      expect(o.price_verified).toBe(false);
    }
  });

  it('no Amazon catalogue offer claims an API price origin', () => {
    for (const o of catalogueOffers) expect(o.price_origin ?? 'none').toBe('none');
  });
});

describe('price layer is not wired into rendering yet', () => {
  it('no component, page or layout imports src/lib/pricing', () => {
    const ui = ['src/components', 'src/pages', 'src/layouts'].flatMap((d) => walk(path.join(ROOT, d)));
    expect(ui.length).toBeGreaterThan(0);
    const importers = ui.filter((f) => /lib\/pricing/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
    expect(importers).toEqual([]);
  });
});
