import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkJsonLd } from './lib/jsonld-checks.mjs';

const TITLE = 'A valid page title';
const DESC =
  'A unique meta description that is long enough to satisfy the one hundred and twenty character minimum for indexable pages on this site.';
const H1 = 'Visible heading for this page';
const CANONICAL = 'https://uksurvivalkits.uk/method/';
const OG = 'https://uksurvivalkits.uk/images/social-share.jpg';
const NOW = new Date('2026-11-16T12:00:00.000Z');

const pageNodes = () => [
  {
    '@type': 'Organization',
    '@id': 'https://uksurvivalkits.uk/#organization',
    name: 'UK Survival Kits',
    url: 'https://uksurvivalkits.uk/',
    email: 'editors@uksurvivalkits.uk',
    logo: {
      '@type': 'ImageObject',
      '@id': 'https://uksurvivalkits.uk/#logo',
      url: 'https://uksurvivalkits.uk/icon-192.png',
      contentUrl: 'https://uksurvivalkits.uk/icon-192.png',
      width: 192,
      height: 192,
      caption: 'UK Survival Kits',
    },
  },
  {
    '@type': 'WebSite',
    '@id': 'https://uksurvivalkits.uk/#website',
    url: 'https://uksurvivalkits.uk/',
    name: 'UK Survival Kits',
    description: 'Independent guides.',
    inLanguage: 'en-GB',
    publisher: { '@id': 'https://uksurvivalkits.uk/#organization' },
  },
  {
    '@type': 'WebPage',
    '@id': `${CANONICAL}#webpage`,
    url: CANONICAL,
    name: H1,
    description: DESC,
    isPartOf: { '@id': 'https://uksurvivalkits.uk/#website' },
    inLanguage: 'en-GB',
    breadcrumb: { '@id': `${CANONICAL}#breadcrumb` },
    mainEntity: { '@id': `${CANONICAL}#article` },
  },
  {
    '@type': 'Article',
    '@id': `${CANONICAL}#article`,
    headline: H1,
    description: DESC,
    datePublished: '2026-11-14',
    dateModified: '2026-11-15',
    inLanguage: 'en-GB',
    mainEntityOfPage: { '@id': `${CANONICAL}#webpage` },
    isPartOf: { '@id': `${CANONICAL}#webpage` },
    publisher: { '@id': 'https://uksurvivalkits.uk/#organization' },
    image: { '@type': 'ImageObject', url: OG, width: 1200, height: 630 },
  },
  {
    '@type': 'BreadcrumbList',
    '@id': `${CANONICAL}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://uksurvivalkits.uk/' },
      { '@type': 'ListItem', position: 2, name: 'Method', item: CANONICAL },
    ],
  },
];

const graph = (nodes = pageNodes()) =>
  JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });

const html = ({ body = '', robots = 'index, follow', extraHead = '', script = graph(), heading = H1, canonical = CANONICAL } = {}) =>
  `<!doctype html><html><head>
    <meta name="robots" content="${robots}">
    <title>${TITLE}</title>
    <meta name="description" content="${DESC}">
    ${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
    <meta property="og:image" content="${OG}">
    ${script ? `<script type="application/ld+json">${script}</script>` : ''}
    ${extraHead}
  </head><body>
    <h1>${heading}</h1>
    ${body}
  </body></html>`;

function site(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonld-'));
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(d, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return d;
}

const good = () =>
  site({
    'method/index.html': html({
      body: '<nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Method</li></ol></nav>',
    }),
    '404.html': html({ robots: 'noindex, nofollow', script: '', canonical: null, heading: 'Page not found' }),
  });

const reasons = (dist) => checkJsonLd(dist, { now: NOW }).failures.map((f) => `${f.file}: ${f.reason}`).join('\n');

describe('checkJsonLd', () => {
  it('passes a valid indexable page and a 404 with no JSON-LD', () => {
    const r = checkJsonLd(good(), { now: NOW });
    expect(r.failures).toEqual([]);
    expect(r.files).toBe(2);
  });

  it('fails when an indexable page has no JSON-LD script', () => {
    expect(reasons(site({ 'index.html': html({ script: '' }) }))).toMatch(/expected exactly 1 application\/ld\+json script, found 0/);
  });

  it('fails when a page has two JSON-LD scripts', () => {
    const page = html({ extraHead: `<script type="application/ld+json">${graph()}</script>` });
    expect(reasons(site({ 'index.html': page }))).toMatch(/found 2/);
  });

  it('fails when 404.html contains JSON-LD', () => {
    expect(reasons(site({ '404.html': html({ robots: 'noindex, nofollow', canonical: null }) }))).toMatch(
      /404\.html must not contain JSON-LD/,
    );
  });

  it('fails when the script is not valid JSON', () => {
    expect(reasons(site({ 'index.html': html({ script: '{not-json' }) }))).toMatch(/did not parse/);
  });

  it('fails when @context or @graph is missing', () => {
    expect(reasons(site({ 'index.html': html({ script: JSON.stringify({ '@graph': [] }) }) }))).toMatch(/@context/);
    expect(reasons(site({ 'index.html': html({ script: JSON.stringify({ '@context': 'https://schema.org' }) }) }))).toMatch(
      /@graph array/,
    );
  });

  it('fails on a duplicate @id', () => {
    const nodes = pageNodes();
    nodes.push({ '@type': 'WebPage', '@id': `${CANONICAL}#webpage`, url: CANONICAL, name: H1, description: DESC });
    expect(reasons(site({ 'method/index.html': html({ script: graph(nodes) }) }))).toMatch(/duplicate @id/);
  });

  it('fails on an unresolved @id reference', () => {
    const nodes = pageNodes();
    nodes[2].isPartOf = { '@id': 'https://uksurvivalkits.uk/#missing' };
    expect(reasons(site({ 'method/index.html': html({ script: graph(nodes) }) }))).toMatch(/unresolved @id/);
  });

  it('fails on banned types anywhere in the graph', () => {
    const nodes = pageNodes();
    nodes.push({ '@type': 'Product', '@id': `${CANONICAL}#product`, name: 'A kit' });
    expect(reasons(site({ 'method/index.html': html({ script: graph(nodes) }) }))).toMatch(/banned type Product/);
  });

  it('fails on a price property', () => {
    const nodes = pageNodes();
    nodes.push({ '@type': 'Thing', '@id': `${CANONICAL}#offer`, price: '12.00' });
    expect(reasons(site({ 'method/index.html': html({ script: graph(nodes) }) }))).toMatch(/banned price property "price"/);
  });

  it('fails on an Amazon URL, but allows an on-page #amazon-uk- fragment', () => {
    const nodes = pageNodes();
    nodes.push({
      '@type': 'ItemList',
      '@id': `${CANONICAL}#essentials`,
      numberOfItems: 1,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'A can',
          url: 'https://www.amazon.co.uk/dp/B07L142XSN?tag=x-21',
        },
      ],
    });
    expect(reasons(site({ 'method/index.html': html({ script: graph(nodes) }) }))).toMatch(/Amazon/);

    const ok = pageNodes();
    ok.push({
      '@type': 'ItemList',
      '@id': `${CANONICAL}#essentials`,
      numberOfItems: 1,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'A can',
          url: 'https://uksurvivalkits.uk/compare/72-hour-emergency-kits/#amazon-uk-b07l142xsn',
        },
      ],
    });
    const page = html({
      script: graph(ok),
      body: '<article id="amazon-uk-b07l142xsn">A can</article><nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Method</li></ol></nav>',
    });
    // The ItemList url points at a different page, so the in-HTML id check only applies when the
    // host+path match this page. This fixture only asserts the Amazon-host rule allows the fragment.
    expect(checkJsonLd(site({ 'method/index.html': page, '404.html': html({ robots: 'noindex, nofollow', script: '', canonical: null, heading: 'Page not found' }) }), { now: NOW }).failures).toEqual([]);
  });

  it('fails when a page URL is not on the apex or is missing a trailing slash', () => {
    const nodes = pageNodes();
    nodes[2].url = 'https://example.com/method/';
    expect(reasons(site({ 'method/index.html': html({ script: graph(nodes) }) }))).toMatch(/not on https:\/\/uksurvivalkits\.uk\//);

    const slash = pageNodes();
    slash[2].url = 'https://uksurvivalkits.uk/method';
    slash[2]['@id'] = 'https://uksurvivalkits.uk/method#webpage';
    expect(reasons(site({ 'method/index.html': html({ script: graph(slash), canonical: 'https://uksurvivalkits.uk/method' }) }))).toMatch(
      /trailing slash/,
    );
  });

  it('fails when WebPage.url, name or description disagree with the canonical, H1 or meta', () => {
    const nodes = pageNodes();
    nodes[2].url = 'https://uksurvivalkits.uk/about/';
    expect(reasons(site({ 'method/index.html': html({ script: graph(nodes) }) }))).toMatch(/WebPage\.url/);

    const name = pageNodes();
    expect(reasons(site({ 'method/index.html': html({ script: graph(name), heading: 'A different heading' }) }))).toMatch(
      /WebPage\.name/,
    );

    const desc = pageNodes();
    desc[2].description = 'A different description that is still long enough to look like a meta description on the page.';
    expect(reasons(site({ 'method/index.html': html({ script: graph(desc) }) }))).toMatch(/WebPage\.description/);
  });

  it('fails when Article.headline, description or image disagree with the H1, meta or og:image', () => {
    const nodes = pageNodes();
    nodes[3].headline = 'A different headline';
    expect(reasons(site({ 'method/index.html': html({ script: graph(nodes) }) }))).toMatch(/Article\.headline/);

    const img = pageNodes();
    img[3].image.url = 'https://uksurvivalkits.uk/icon-192.png';
    expect(reasons(site({ 'method/index.html': html({ script: graph(img) }) }))).toMatch(/Article\.image\.url/);
  });

  it('fails when dates are not ISO, are out of order, or are in the future', () => {
    const bad = pageNodes();
    bad[3].datePublished = '14 November 2026';
    expect(reasons(site({ 'method/index.html': html({ script: graph(bad) }) }))).toMatch(/YYYY-MM-DD/);

    const order = pageNodes();
    order[3].datePublished = '2026-11-16';
    order[3].dateModified = '2026-11-15';
    expect(reasons(site({ 'method/index.html': html({ script: graph(order) }) }))).toMatch(/datePublished .* is after dateModified/);

    const future = pageNodes();
    future[3].dateModified = '2026-11-20';
    expect(reasons(site({ 'method/index.html': html({ script: graph(future) }) }))).toMatch(/after the build date/);
  });

  it('fails when the last breadcrumb item is not the canonical', () => {
    const nodes = pageNodes();
    nodes[4].itemListElement[1].item = 'https://uksurvivalkits.uk/about/';
    expect(reasons(site({ 'method/index.html': html({ script: graph(nodes) }) }))).toMatch(/last breadcrumb item/);
  });

  it('fails when a visible breadcrumb nav does not match the JSON-LD list', () => {
    const body =
      '<nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">About</li></ol></nav>';
    expect(reasons(site({ 'method/index.html': html({ body }) }))).toMatch(/breadcrumb item 2 name/);
  });

  it('fails when an ItemList url hash has no matching id in the HTML', () => {
    const nodes = pageNodes();
    nodes.push({
      '@type': 'ItemList',
      '@id': `${CANONICAL}#essentials`,
      numberOfItems: 1,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'A can', url: `${CANONICAL}#amazon-uk-missing` },
      ],
    });
    expect(
      reasons(
        site({
          'method/index.html': html({
            script: graph(nodes),
            body: '<nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Method</li></ol></nav>',
          }),
        }),
      ),
    ).toMatch(/no matching id in the HTML/);
  });
});
