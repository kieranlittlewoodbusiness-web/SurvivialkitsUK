/**
 * S1-12 basket 2: "Add all home picks to basket". Derived from the homepage model itself
 * (homeThemes -> TopPick -> topPickLink), so it always matches the buttons the homepage renders:
 * only picks that get an affiliate link (verified, model-matched, production build, tag) are
 * included, in homepage order. No ASIN is copied here. Unverified products (including the S1-10c
 * removals, now unverified on main) never get a link, so they never reach this basket.
 */
import { topPickLink, type HomeThemeModel } from '../../components/home/homeView';
import type { BuildEnv } from '../offers/types';
import { basketLink, type BasketLink } from './cartUrl';

/** The contract link is https://www.amazon.co.uk/dp/{ASIN}?tag=...; the ASIN is read from it. */
const DP_ASIN = /^https:\/\/www\.amazon\.co\.uk\/dp\/([A-Z0-9]{10})\?/;

/** ASINs of every homepage top pick that has a buy link, in homepage order, without duplicates. */
export function homeBasketAsins(themes: readonly HomeThemeModel[]): string[] {
  const out: string[] = [];
  for (const t of themes) {
    for (const p of t.picks) {
      const href = topPickLink(p.card)?.href;
      const asin = href ? DP_ASIN.exec(href)?.[1] : undefined;
      if (asin && !out.includes(asin)) out.push(asin);
    }
  }
  return out;
}

/** Basket link for all home picks, or null (no linked picks, or not a production build). */
export function homeBasketLink(themes: readonly HomeThemeModel[], env: BuildEnv): BasketLink | null {
  return basketLink(homeBasketAsins(themes), env);
}
