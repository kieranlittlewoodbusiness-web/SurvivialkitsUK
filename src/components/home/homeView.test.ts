import { describe, expect, it } from 'vitest';
import { HOME_THEMES, homeButtonCount, homeThemes, topPickLink } from './homeView';
import { loadCatalogue, productSections, type CatalogueSection, type ProductCardModel } from '../catalogue/catalogueView';
import { VERIFIED_BY_CATEGORY } from '../../../tests/offers/verifiedSet';

const NOW = new Date('2026-11-15T12:00:00Z');
const PROD = { SITE_ENV: 'production', AMAZON_ASSOCIATES_UK_TAG: 'verifydist-21' };
const PREVIEW = { SITE_ENV: 'preview' };

const card = (id: string, category: string, link = true): ProductCardModel => ({
  id,
  category: category as ProductCardModel['category'],
  name: `Name ${id}`,
  brand: 'Brand',
  buttonLabel: `Check Name ${id} on Amazon`,
  facts: [],
  image: null,
  offers: [{ offer_id: `o-${id}`, price: null, link: link ? { href: `https://www.amazon.co.uk/dp/B000000${id.padStart(3, '0')}?tag=x-21`, rel: 'sponsored nofollow' } : null }],
});
const section = (category: string, ids: string[]): CatalogueSection => ({
  category: category as CatalogueSection['category'],
  category_label: category,
  cards: ids.map((i) => card(i, category)),
});

describe('homeThemes (S1-11 top picks)', () => {
  it('takes the first (top-ranked) card of each compare section, never re-sorting', () => {
    const themes = homeThemes({ sections: [section('torch', ['3', '1', '2']), section('radio', ['9'])] });
    const picks = themes.flatMap((t) => t.picks);
    expect(picks.map((p) => p.card.id)).toEqual(['3', '9']);
    expect(picks.find((p) => p.category === 'torch')?.count).toBe(3);
    expect(picks.find((p) => p.category === 'torch')?.href).toBe('/compare/72-hour-emergency-kits/#torches');
  });
  it('drops empty categories, the legacy kit bucket and empty themes', () => {
    const themes = homeThemes({ sections: [section('torch', ['1']), section('kit', ['2']), section('radio', [])] });
    expect(themes.map((t) => t.id)).toEqual(['power-cuts']);
    expect(themes[0]!.picks.map((p) => p.category)).toEqual(['torch']);
  });
  it('puts categories that no theme lists into "More essentials" (e.g. new s1-10b categories)', () => {
    const themes = homeThemes({ sections: [section('torch', ['1']), section('whistle', ['2'])] });
    const more = themes.find((t) => t.id === 'more-essentials');
    expect(more?.picks.map((p) => p.category)).toEqual(['whistle']);
    expect(more?.picks[0]?.href).toBe('/compare/72-hour-emergency-kits/#whistle');
    expect(more?.image).toBeNull();
  });
  it('theme images carry the brand guide alts and dimensions', () => {
    for (const t of HOME_THEMES) {
      expect(t.image?.alt).toMatch(/\.$/);
      expect([t.image?.width, t.image?.height]).toEqual([900, 600]);
    }
  });
  it('topPickLink returns only the contract link', () => {
    expect(topPickLink(card('1', 'torch', false))).toBeNull();
    expect(topPickLink(card('1', 'torch'))?.rel).toBe('sponsored nofollow');
  });
});

describe('homeThemes over the committed catalogue', () => {
  const verifiedCats = Object.entries(VERIFIED_BY_CATEGORY)
    .filter(([c, a]) => c !== 'kit' && (a?.length ?? 0) > 0)
    .map(([c]) => c);

  it('production: one top pick with a button per verified category', async () => {
    const model = await loadCatalogue(PROD, NOW);
    const themes = homeThemes(model);
    const picks = themes.flatMap((t) => t.picks);
    expect(picks.map((p) => p.category).sort()).toEqual([...verifiedCats].sort());
    expect(homeButtonCount(themes)).toBe(verifiedCats.length);
    for (const p of picks) {
      const s = productSections(model).find((x) => x.category === p.category)!;
      expect(p.card.id).toBe(s.cards[0]!.id);
      expect(topPickLink(p.card)?.href).toMatch(/^https:\/\/www\.amazon\.co\.uk\/dp\/[A-Z0-9]{10}\?tag=verifydist-21$/);
    }
  });
  it('preview: same picks, no buttons', async () => {
    const themes = homeThemes(await loadCatalogue(PREVIEW, NOW));
    expect(themes.flatMap((t) => t.picks)).toHaveLength(verifiedCats.length);
    expect(homeButtonCount(themes)).toBe(0);
  });
});
