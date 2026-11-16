import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { site } from '../../src/data/site';
import {
  APEX,
  LOGO_ID,
  ORG_ID,
  WEBSITE_ID,
  article,
  breadcrumbList,
  buildGraph,
  crumbsForPage,
  dateModifiedOf,
  isoDate,
  itemList,
  organizationNode,
  pageUrl,
  standardPageNodes,
  webPage,
  websiteNode,
} from '../../src/lib/seo/jsonld';

describe('isoDate and dateModifiedOf', () => {
  it('formats Date and string values as YYYY-MM-DD', () => {
    expect(isoDate('2026-11-14')).toBe('2026-11-14');
    expect(isoDate(new Date('2026-11-14T00:00:00.000Z'))).toBe('2026-11-14');
  });

  it('takes the latest of updated, lastReviewed and pubDate', () => {
    expect(dateModifiedOf('2026-11-01', '2026-11-15', '2026-11-12')).toBe('2026-11-15');
    expect(dateModifiedOf(new Date('2026-11-14T00:00:00.000Z'), undefined, '2026-11-10')).toBe(
      '2026-11-14',
    );
  });
});

describe('pageUrl', () => {
  it('resolves a trailing-slash path on the apex', () => {
    expect(pageUrl('/')).toBe('https://uksurvivalkits.uk/');
    expect(pageUrl('/gear/radios/')).toBe('https://uksurvivalkits.uk/gear/radios/');
  });

  it('throws when the path has no trailing slash', () => {
    expect(() => pageUrl('/gear/radios')).toThrow(/trailing slash/);
  });
});

describe('sitewide nodes', () => {
  it('describes the Organisation with the icon-192 logo and no sameAs or alternateName', () => {
    const org = organizationNode();
    expect(org['@id']).toBe(ORG_ID);
    expect(org.name).toBe(site.name);
    expect(org.url).toBe(`${APEX}/`);
    expect(org.email).toBe(site.contactEmail);
    expect(org).not.toHaveProperty('sameAs');
    expect(org).not.toHaveProperty('alternateName');
    const logo = org.logo as Record<string, unknown>;
    expect(logo['@id']).toBe(LOGO_ID);
    expect(logo.url).toBe(`${APEX}/icon-192.png`);
    expect(logo.contentUrl).toBe(`${APEX}/icon-192.png`);
    expect(logo.width).toBe(192);
    expect(logo.height).toBe(192);
  });

  it('describes the WebSite with a publisher @id reference and no SearchAction', () => {
    const web = websiteNode();
    expect(web['@id']).toBe(WEBSITE_ID);
    expect(web.description).toBe(site.description);
    expect(web.publisher).toEqual({ '@id': ORG_ID });
    expect(web).not.toHaveProperty('potentialAction');
  });
});

describe('article', () => {
  it('omits author and points publisher, image and mainEntityOfPage at stable ids', () => {
    const url = pageUrl('/scenarios/power-cuts/');
    const node = article({
      url,
      headline: 'Power cut kit for UK homes: what to have ready',
      description: 'A UK power cut kit.',
      datePublished: '2026-11-14',
      dateModified: '2026-11-14',
    });
    expect(node).not.toHaveProperty('author');
    expect(node.publisher).toEqual({ '@id': ORG_ID });
    expect(node.mainEntityOfPage).toEqual({ '@id': `${url}#webpage` });
    expect((node.image as { url: string }).url).toBe(`${APEX}/images/social-share.jpg`);
    expect((node.image as { width: number; height: number }).width).toBe(1200);
    expect((node.image as { height: number }).height).toBe(630);
  });

  it('keeps the SEO-9 author placeholder comment next to the builder', () => {
    const src = fs.readFileSync(path.resolve('src/lib/seo/jsonld.ts'), 'utf8');
    expect(src).toMatch(
      /SEO-9 \(Kieran\): add "author" ONLY when a real, named, accountable editor exists/,
    );
  });
});

describe('breadcrumbs, lists and graphs', () => {
  it('builds crumbs Home › parent › current with trailing-slash items', () => {
    const crumbs = crumbsForPage('/gear/radios/', 'Radios', { label: 'Gear criteria', href: '/gear/' });
    expect(crumbs).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Gear criteria', href: '/gear/' },
      { label: 'Radios', href: '/gear/radios/' },
    ]);
    const list = breadcrumbList(pageUrl('/gear/radios/'), crumbs);
    expect(list['@id']).toBe('https://uksurvivalkits.uk/gear/radios/#breadcrumb');
    const items = list.itemListElement as Array<{ position: number; name: string; item: string }>;
    expect(items.map((i) => [i.position, i.name, i.item])).toEqual([
      [1, 'Home', 'https://uksurvivalkits.uk/'],
      [2, 'Gear criteria', 'https://uksurvivalkits.uk/gear/'],
      [3, 'Radios', 'https://uksurvivalkits.uk/gear/radios/'],
    ]);
  });

  it('emits plain ListItems with position, name and on-page url, and no Product', () => {
    const url = pageUrl('/compare/72-hour-emergency-kits/');
    const list = itemList({
      id: `${url}#essentials`,
      name: '72-hour kit essentials compared on this page',
      items: [{ name: 'A can of water', url: `${url}#amazon-uk-b07l142xsn` }],
    });
    expect(JSON.stringify(list)).not.toMatch(/Product|Offer|price/);
    expect(list.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'A can of water',
        url: `${url}#amazon-uk-b07l142xsn`,
      },
    ]);
  });

  it('prepends #organization and #website once in the @graph', () => {
    const url = pageUrl('/');
    const graph = buildGraph([
      webPage({ url, name: 'Home heading', description: 'Home description.', about: true, primaryImage: true }),
    ]);
    expect(graph['@context']).toBe('https://schema.org');
    expect(graph['@graph'][0]?.['@id']).toBe(ORG_ID);
    expect(graph['@graph'][1]?.['@id']).toBe(WEBSITE_ID);
    expect(graph['@graph'][2]?.['@id']).toBe(`${url}#webpage`);
    expect(graph['@graph']).toHaveLength(3);
  });

  it('builds a trust page as WebPage plus BreadcrumbList', () => {
    const nodes = standardPageNodes({
      canonicalPath: '/method/',
      heading: 'How we source and label',
      description: 'How UK Survival Kits labels official guidance.',
      crumb: 'Method',
    });
    expect(nodes.map((n) => n['@type'])).toEqual(['WebPage', 'BreadcrumbList']);
    expect(nodes[0]?.name).toBe('How we source and label');
  });
});
