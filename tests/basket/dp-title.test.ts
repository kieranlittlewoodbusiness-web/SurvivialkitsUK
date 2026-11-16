/**
 * QA guard (16 Nov 2026): every starter-kit item records the /dp title it was checked against, and
 * that title (or the page's brand line) must name the item's brand and share a name or model token.
 */
import { describe, expect, it } from 'vitest';
import raw from '../../src/data/starter-kit/starterKit.json';
import { dpTitleMismatch, readDpTitleCheck } from './dpTitleGuard';

type Item = { asin: string; brand: string; model: string; display_name: string; product_name: string; verification_evidence: { note: string | null } };
const items = (raw as unknown as { items: Item[]; gaps: { position: number; candidates_checked: string[] }[] }).items;

describe('starter kit dp title guard', () => {
  it('every item records a dp_title_checked line (16 Nov 2026, 17:00 UK or later) that matches its brand and name/model', () => {
    for (const i of items) {
      const dp = readDpTitleCheck(i.verification_evidence.note ?? '');
      expect(dp, i.asin).not.toBeNull();
      expect(dp!.checkedAt >= '2026-11-16T17:00Z', i.asin).toBe(true);
      expect(dpTitleMismatch({ brand: i.brand, names: [i.display_name, i.product_name], models: [i.model] }, dp!), i.asin).toEqual([]);
    }
  });

  it('the reused Duronic ASIN is not an item; the wind-up radio is a gap', () => {
    expect(items.map((i) => i.asin)).not.toContain('B002XNGTOI');
    const gaps = (raw as unknown as { gaps: { position: number; candidates_checked: string[] }[] }).gaps;
    expect(gaps.find((g) => g.position === 9)!.candidates_checked).toContain('B002XNGTOI');
  });
});
