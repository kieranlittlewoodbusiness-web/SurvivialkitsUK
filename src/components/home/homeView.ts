/**
 * S1-11 homepage "top picks" model. Read-only over the S1-10 catalogue model: it takes the
 * compare page's sections (groupComparisonsByCategory, capped and rank-sorted by Backend) and
 * keeps the FIRST card of each, so the homepage shows the same top pick the compare page leads
 * with. It never re-sorts, never reads a URL other than the card's contract link, and never
 * invents a card for an empty category.
 */
import { CATEGORY_META, productSections, type CatalogueModel, type ProductCardModel } from '../catalogue/catalogueView';
import { comparePath } from '../../data/site';

export interface ThemeImage {
  /** Basename in public/images, without width or extension. */
  name: string;
  /** Alt text from Kieran's BRAND-GUIDE.md. */
  alt: string;
  width: number;
  height: number;
}

export interface HomeTheme {
  id: string;
  title: string;
  /** Scenario guide for the situation (internal link). */
  guide: { href: string; label: string } | null;
  image: ThemeImage | null;
  categories: readonly string[];
}

/** Situations from the brand guide's category cards. Categories not listed fall into "More essentials". */
export const HOME_THEMES: readonly HomeTheme[] = [
  {
    id: 'power-cuts',
    title: 'Power cut essentials',
    guide: { href: '/scenarios/power-cuts/', label: 'Power cut guide' },
    image: { name: 'power-cut-essentials', alt: 'Rechargeable lantern, torch and power bank beside a rain-streaked window.', width: 900, height: 600 },
    categories: ['torch', 'power_bank', 'radio', 'batteries', 'electric_lighter', 'sleeping_bag'],
  },
  {
    id: 'winter-car',
    title: 'Winter car kits',
    guide: { href: '/scenarios/winter-car-shelf/', label: 'Winter car guide' },
    image: { name: 'winter-car-kit', alt: 'Blanket, torch and emergency holdall in a car boot.', width: 900, height: 600 },
    categories: ['jump_leads', 'warning_triangle', 'hi_vis', 'emergency_blanket', 'flask'],
  },
  {
    id: 'grab-bags',
    title: 'Grab bags',
    guide: { href: '/scenarios/leave-home-bag/', label: 'Grab bag guide' },
    image: { name: 'grab-bags', alt: 'Open grab bag with a water bottle, torch and folded rain jacket.', width: 900, height: 600 },
    categories: ['grab_bag_kit', 'emergency_water', 'first_aid_kit', 'thermal_clothing', 'document_pouch', 'multi_tool', 'two_way_radio'],
  },
];

const MORE_ESSENTIALS: HomeTheme = { id: 'more-essentials', title: 'More essentials', guide: null, image: null, categories: [] };

export interface TopPick {
  category: string;
  categoryLabel: string;
  /** Link to that category's section on the compare page. */
  href: string;
  /** Cards in the category on the compare page (1-3). */
  count: number;
  card: ProductCardModel;
}

export interface HomeThemeModel extends Omit<HomeTheme, 'categories'> {
  picks: TopPick[];
}

function anchorFor(category: string): string {
  const meta = (CATEGORY_META as Record<string, { anchor: string } | undefined>)[category];
  return meta?.anchor ?? category.replace(/_/g, '-');
}

/**
 * One top pick per compare-page category, grouped into the homepage situations. Themes with no
 * picks are dropped; every category that has a compare section appears exactly once.
 */
export function homeThemes(model: Pick<CatalogueModel, 'sections'>): HomeThemeModel[] {
  const sections = productSections(model);
  const picks = new Map<string, TopPick>();
  for (const s of sections) {
    const card = s.cards[0];
    if (!card) continue;
    picks.set(s.category, {
      category: s.category,
      categoryLabel: s.category_label,
      href: `${comparePath}#${anchorFor(s.category)}`,
      count: s.cards.length,
      card,
    });
  }
  const used = new Set<string>();
  const themes: HomeThemeModel[] = [];
  for (const t of HOME_THEMES) {
    const tp = t.categories.flatMap((c) => (picks.has(c) ? [picks.get(c)!] : []));
    tp.forEach((p) => used.add(p.category));
    const { categories: _c, ...rest } = t;
    if (tp.length) themes.push({ ...rest, picks: tp });
  }
  const rest = [...picks.values()].filter((p) => !used.has(p.category));
  if (rest.length) {
    const { categories: _c, ...more } = MORE_ESSENTIALS;
    themes.push({ ...more, picks: rest });
  }
  return themes;
}

/** Number of homepage buy buttons the model renders (one per top pick that has a contract link). */
export function homeButtonCount(themes: HomeThemeModel[]): number {
  return themes.reduce((n, t) => n + t.picks.filter((p) => p.card.offers.some((o) => o.link)).length, 0);
}

/** Accessible name of a homepage buy button (CR N1 on #25: no space before the colon). */
export function buyLabel(name: string): string {
  return `Buy on Amazon: ${name.trim()} (affiliate link)`;
}

/** First contract link of a card (cards carry Amazon-only, model-matched offers). */
export function topPickLink(card: ProductCardModel) {
  return card.offers.find((o) => o.link)?.link ?? null;
}
