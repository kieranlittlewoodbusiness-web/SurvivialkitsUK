/**
 * S1-12: one-click Amazon UK baskets via Amazon's Add to Cart form (GET).
 * https://webservices.amazon.com/paapi5/documentation/add-to-cart-form.html lists the UK endpoint
 * below, takes ASIN.x + Quantity.x pairs ("any number of items") and needs AssociateTag for attribution.
 *
 * The tag is added only when the SAME production gate as resolveAffiliateLink passes (imported, not
 * copied): SITE_ENV=production, not a preview / Cloudflare branch preview (isProductionLinkBuild),
 * the Amazon Associates UK programme approved, and a well-formed -21 tag in the programme's env var.
 * Pure: no I/O, no clock, env passed in.
 */
import rawProgrammes from '../../data/affiliate/programmes.json';
import { isProductionLinkBuild, TRACKING_ID_PATTERN } from '../offers/affiliate';
import type { BuildEnv } from '../offers/types';

export const AMAZON_UK_CART_ADD_URL = 'https://www.amazon.co.uk/gp/aws/cart/add.html';
export const BASKET_LINK_REL = 'sponsored nofollow' as const;
export const AMAZON_UK_PROGRAMME_ID = 'amazon-associates-uk';
/** Conservative cap for a GET URL (well under the ~8 KB limits of browsers, CDNs and Amazon's edge). */
export const MAX_BASKET_URL_LENGTH = 2000;
const ASIN_RE = /^[A-Z0-9]{10}$/;

interface ProgrammeLike {
  programme_id: string;
  status: string;
  approved_on: string | null;
  tracking_id_env?: string | null;
  disclosure_text: string | null;
}
const programmes = (rawProgrammes as { programmes: ProgrammeLike[] }).programmes;

/** The Associates UK programme record (src/data/affiliate/programmes.json). */
export function amazonUkProgramme(): ProgrammeLike | undefined {
  return programmes.find((p) => p.programme_id === AMAZON_UK_PROGRAMME_ID);
}

/**
 * The tag to attach, or null. Same rule as resolveAffiliateLink's Amazon branch: approved programme,
 * production build (isProductionLinkBuild), tag present and matching TRACKING_ID_PATTERN.
 */
export function basketTag(env: BuildEnv): string | null {
  const programme = amazonUkProgramme();
  if (!programme || programme.status !== 'approved' || programme.approved_on === null) return null;
  if (!isProductionLinkBuild(env)) return null;
  const name = programme.tracking_id_env;
  const tag = name ? env[name]?.trim() : undefined;
  if (!tag || !TRACKING_ID_PATTERN.test(tag)) return null;
  return tag;
}

/**
 * Pure URL builder. ASINs are numbered 1..n in the given order, Quantity is always 1, and
 * AssociateTag is appended only when `tag` is given. Throws on an empty list, a malformed or
 * duplicate ASIN, a malformed tag, or a URL longer than MAX_BASKET_URL_LENGTH.
 */
export function buildCartAddUrl(asins: readonly string[], tag: string | null = null): string {
  if (asins.length === 0) throw new RangeError('basket needs at least one ASIN');
  const seen = new Set<string>();
  const parts: string[] = [];
  asins.forEach((a, i) => {
    if (!ASIN_RE.test(a)) throw new RangeError(`invalid ASIN "${a}"`);
    if (seen.has(a)) throw new RangeError(`duplicate ASIN "${a}"`);
    seen.add(a);
    parts.push(`ASIN.${i + 1}=${a}`, `Quantity.${i + 1}=1`);
  });
  if (tag !== null) {
    if (!TRACKING_ID_PATTERN.test(tag)) throw new RangeError('invalid AssociateTag');
    parts.push(`AssociateTag=${encodeURIComponent(tag)}`);
  }
  const url = `${AMAZON_UK_CART_ADD_URL}?${parts.join('&')}`;
  if (url.length > MAX_BASKET_URL_LENGTH) throw new RangeError(`basket URL too long (${url.length} > ${MAX_BASKET_URL_LENGTH})`);
  return url;
}

export interface BasketLink {
  /** Add to Cart form URL with AssociateTag (production only). */
  url: string;
  rel: typeof BASKET_LINK_REL;
  /** Open Amazon in a new tab so the visitor can come back (Amazon's own suggestion). */
  target: '_blank';
  /** ASINs in URL order (ASIN.1..ASIN.n). */
  asins: string[];
  item_count: number;
  /** Show next to the button, as for every affiliate link. */
  disclosure_text: string;
}

/**
 * The basket link for a list of ASINs, or null when no affiliate link may be shown: not a
 * production build, no or invalid tag, programme not approved, or an empty basket. Previews and
 * dev builds therefore render no basket button (same as product buttons): a tagless Add to Cart
 * URL is not a Special Link, would not be attributed, and would put an untagged Amazon link in a
 * preview build.
 */
export function basketLink(asins: readonly string[], env: BuildEnv): BasketLink | null {
  if (asins.length === 0) return null;
  const tag = basketTag(env);
  if (tag === null) return null;
  const disclosure = amazonUkProgramme()?.disclosure_text;
  if (!disclosure) return null;
  return {
    url: buildCartAddUrl(asins, tag),
    rel: BASKET_LINK_REL,
    target: '_blank',
    asins: [...asins],
    item_count: asins.length,
    disclosure_text: disclosure,
  };
}
