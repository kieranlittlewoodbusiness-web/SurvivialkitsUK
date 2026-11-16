/**
 * SEO-6: JSON-LD graph builders. One @graph is emitted per indexable page (none on the 404).
 *
 * Headline/name, description and url always come from the same values the page renders (H1, meta
 * description, canonical). Do not hand-type a second copy of those strings at the call site.
 */
import { site } from '../../data/site';

export const JSONLD_CONTEXT = 'https://schema.org';
export const APEX = site.siteUrl;
export const ORG_ID = `${APEX}/#organization`;
export const LOGO_ID = `${APEX}/#logo`;
export const WEBSITE_ID = `${APEX}/#website`;

export type JsonLdNode = Record<string, unknown>;

export type Crumb = { label: string; href: string };

export type WebPageType = 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage';

/** Short breadcrumb labels (SEO-6 JSON-LD; visible crumbs land in SEO-8, except compare which already has them). */
export const CRUMB_LABELS: Record<string, string> = {
  '/compare/72-hour-emergency-kits/': '72-hour emergency kit',
  '/checklist/': 'Checklist',
  '/start-here/': 'Start here',
  '/scenarios/': 'Scenarios',
  '/gear/': 'Gear criteria',
  '/about/': 'About',
  '/method/': 'Method',
  '/sources/': 'Sources',
  '/editorial-policy/': 'Editorial policy',
  '/affiliate-disclosure/': 'Affiliate disclosure',
  '/privacy/': 'Privacy',
  '/contact/': 'Contact',
  '/gear/first-aid/': 'First aid kits',
  '/gear/power-banks/': 'Power banks',
  '/gear/radios/': 'Radios',
  '/gear/torches/': 'Torches',
  '/gear/water-storage/': 'Water storage',
  '/gear/winter-travel/': 'Winter driving gear',
  '/scenarios/power-cuts/': 'Power cut kit',
  '/scenarios/power-cut-evening/': 'Power cut at night',
  '/scenarios/severe-weather/': 'Storm preparation',
  '/scenarios/met-office-warning-day-before/': 'Day before a warning',
  '/scenarios/flood-england-wales/': 'Flooding: England and Wales',
  '/scenarios/flood-scotland-kit/': 'Flooding: Scotland',
  '/scenarios/leave-home-bag/': 'Grab bag',
  '/scenarios/temporary-evacuation/': 'Temporary evacuation',
  '/scenarios/winter-travel/': 'Winter car kit',
  '/scenarios/winter-car-shelf/': 'Stuck in snow',
  '/scenarios/water-interruption/': 'Water interruption',
  '/scenarios/cupboard-first-food/': 'Emergency food',
  '/scenarios/neighbours-psr/': 'Priority Services Register',
  '/scenarios/six-month-kit-review/': 'Six-month kit review',
};

/** Absolute apex URL for a root-relative path (pages must already end in a trailing slash). */
export function pageUrl(canonicalPath: string): string {
  const href = new URL(canonicalPath, `${APEX}/`).href;
  const path = new URL(href).pathname;
  if (!path.endsWith('/')) {
    throw new Error(`pageUrl: canonical path must end in a trailing slash: ${canonicalPath}`);
  }
  return href;
}

export function isoDate(value: Date | string): string {
  if (typeof value === 'string') {
    const day = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw new Error(`isoDate: not an ISO date: ${value}`);
    }
    return day;
  }
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Europe/London offset at local midnight on a calendar date, e.g. "+00:00" (GMT) or "+01:00" (BST). */
export function londonOffset(day: Date | string): string {
  const date = isoDate(day);
  const inst = new Date(`${date}T00:00:00Z`);
  const tz = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    timeZoneName: 'longOffset',
  })
    .formatToParts(inst)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = tz?.match(/GMT([+-]\d{2}):(\d{2})/i);
  if (!match) throw new Error(`londonOffset: could not read the Europe/London offset for ${date} (${tz ?? 'none'})`);
  return `${match[1]}:${match[2]}`;
}

/** Full ISO 8601 datetime at local midnight in Europe/London, e.g. 2026-11-14T00:00:00+00:00. */
export function isoDateTimeLondon(day: Date | string): string {
  const date = isoDate(day);
  return `${date}T00:00:00${londonOffset(date)}`;
}

/** Latest of the given dates as YYYY-MM-DD (updated / lastReviewed / pubDate). */
export function dateModifiedOf(...dates: Array<Date | string | undefined | null>): string {
  const days = dates
    .filter((v): v is Date | string => v != null && v !== '')
    .map(isoDate)
    .sort();
  if (!days.length) throw new Error('dateModifiedOf: no dates provided');
  return days[days.length - 1]!;
}

export function crumbsForPage(canonicalPath: string, crumb: string, parent?: Crumb): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Home', href: '/' }];
  if (parent) crumbs.push(parent);
  crumbs.push({ label: crumb, href: canonicalPath });
  return crumbs;
}

export function organizationNode(): JsonLdNode {
  const logoUrl = `${APEX}/icon-192.png`;
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: site.name,
    url: `${APEX}/`,
    email: site.contactEmail,
    logo: {
      '@type': 'ImageObject',
      '@id': LOGO_ID,
      url: logoUrl,
      contentUrl: logoUrl,
      width: 192,
      height: 192,
      caption: site.name,
    },
  };
}

export function websiteNode(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: `${APEX}/`,
    name: site.name,
    description: site.description,
    inLanguage: 'en-GB',
    publisher: { '@id': ORG_ID },
  };
}

export function ogImageObject(): JsonLdNode {
  return {
    '@type': 'ImageObject',
    url: new URL(site.ogImage.path, `${APEX}/`).href,
    width: site.ogImage.width,
    height: site.ogImage.height,
  };
}

export function webPage(opts: {
  url: string;
  name: string;
  description: string;
  type?: WebPageType;
  about?: boolean;
  breadcrumb?: boolean;
  mainEntity?: string;
  primaryImage?: boolean;
}): JsonLdNode {
  const node: JsonLdNode = {
    '@type': opts.type ?? 'WebPage',
    '@id': `${opts.url}#webpage`,
    url: opts.url,
    name: opts.name,
    description: opts.description,
    isPartOf: { '@id': WEBSITE_ID },
    inLanguage: 'en-GB',
  };
  if (opts.breadcrumb) node.breadcrumb = { '@id': `${opts.url}#breadcrumb` };
  if (opts.mainEntity) node.mainEntity = { '@id': opts.mainEntity };
  if (opts.about) node.about = { '@id': ORG_ID };
  if (opts.primaryImage) node.primaryImageOfPage = ogImageObject();
  return node;
}

export function article(opts: {
  url: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
}): JsonLdNode {
  // SEO-9 (Kieran): add "author" ONLY when a real, named, accountable editor exists and is shown on the page (Person with name + url to a real bio page). No invented personas. Google lists author as recommended, not required, for Article.
  return {
    '@type': 'Article',
    '@id': `${opts.url}#article`,
    headline: opts.headline,
    description: opts.description,
    datePublished: isoDateTimeLondon(opts.datePublished),
    dateModified: isoDateTimeLondon(opts.dateModified),
    inLanguage: 'en-GB',
    mainEntityOfPage: { '@id': `${opts.url}#webpage` },
    isPartOf: { '@id': `${opts.url}#webpage` },
    publisher: { '@id': ORG_ID },
    image: ogImageObject(),
  };
}

export function breadcrumbList(url: string, crumbs: Crumb[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.label,
      item: pageUrl(crumb.href),
    })),
  };
}

export function itemList(opts: {
  id: string;
  items: Array<{ name: string; url: string }>;
  name?: string;
}): JsonLdNode {
  const node: JsonLdNode = {
    '@type': 'ItemList',
    '@id': opts.id,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
  if (opts.name) node.name = opts.name;
  return node;
}

/** Sitewide #organization and #website, then the page-specific nodes. */
export function buildGraph(pageNodes: JsonLdNode[]): { '@context': string; '@graph': JsonLdNode[] } {
  return {
    '@context': JSONLD_CONTEXT,
    '@graph': [organizationNode(), websiteNode(), ...pageNodes],
  };
}

/**
 * SEO-6b (L2): serialise a graph for an inline application/ld+json script. Every '<' becomes the
 * JSON escape \u003c so no string value can close the script ("</script>") or open a comment
 * ("<!--"). JSON.parse reads \u003c back as '<', so the data is unchanged.
 */
export function serializeJsonLd(graph: unknown): string {
  return JSON.stringify(graph).replace(/</g, '\\u003c');
}

/** Trust / utility pages: WebPage (or subtype) + BreadcrumbList. */
export function standardPageNodes(opts: {
  canonicalPath: string;
  heading: string;
  description: string;
  crumb: string;
  type?: WebPageType;
  about?: boolean;
}): JsonLdNode[] {
  const url = pageUrl(opts.canonicalPath);
  return [
    webPage({
      url,
      name: opts.heading,
      description: opts.description,
      type: opts.type,
      breadcrumb: true,
      about: opts.about,
    }),
    breadcrumbList(url, crumbsForPage(opts.canonicalPath, opts.crumb)),
  ];
}
