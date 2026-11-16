import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BIO_FILE, EXPECTED_PERSON, PERSON_ID, checkJsonLd } from './lib/jsonld-checks.mjs';

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
    datePublished: '2026-11-14T00:00:00+00:00',
    dateModified: '2026-11-15T00:00:00+00:00',
    inLanguage: 'en-GB',
    mainEntityOfPage: { '@id': `${CANONICAL}#webpage` },
    isPartOf: { '@id': `${CANONICAL}#webpage` },
    author: { '@id': 'https://uksurvivalkits.uk/about/kieran-littlewood/#person' },
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
  // SEO-9b: the Person the Article author resolves to (index 5).
  { ...EXPECTED_PERSON, worksFor: { ...EXPECTED_PERSON.worksFor } },
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

// SEO-9b: a valid editor bio page (ProfilePage + the Person). site() adds it unless a test passes its own
// BIO_FILE entry or opts out with { [NO_BIO]: true }, because check:jsonld requires the bio page whenever
// a page carries the Person node.
const BIO_URL = 'https://uksurvivalkits.uk/about/kieran-littlewood/';
const bioNodes = () => [
  pageNodes()[0],
  pageNodes()[1],
  {
    '@type': 'ProfilePage',
    '@id': `${BIO_URL}#webpage`,
    url: BIO_URL,
    name: 'Kieran Littlewood',
    description: DESC,
    isPartOf: { '@id': 'https://uksurvivalkits.uk/#website' },
    inLanguage: 'en-GB',
    breadcrumb: { '@id': `${BIO_URL}#breadcrumb` },
    mainEntity: { '@id': PERSON_ID },
  },
  { ...EXPECTED_PERSON, worksFor: { ...EXPECTED_PERSON.worksFor } },
  {
    '@type': 'BreadcrumbList',
    '@id': `${BIO_URL}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://uksurvivalkits.uk/' },
      { '@type': 'ListItem', position: 2, name: 'About', item: 'https://uksurvivalkits.uk/about/' },
      { '@type': 'ListItem', position: 3, name: 'Kieran Littlewood', item: BIO_URL },
    ],
  },
];
const NO_BIO = Symbol('no bio page');

function site(input) {
  const files = { ...input };
  if (!input[NO_BIO] && !(BIO_FILE in files)) {
    files[BIO_FILE] = html({ script: graph(bioNodes()), heading: 'Kieran Littlewood', canonical: BIO_URL });
  }
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
    expect(r.files).toBe(3);
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

  it('SEO-6b: parses a script whose strings carry \\u003c escapes for <', () => {
    const nodes = pageNodes();
    nodes[0] = { ...nodes[0], alternateName: 'UK Survival Kits </script> <!-- test' };
    const script = graph(nodes).replace(/</g, '\\u003c');
    expect(script).not.toContain('<');
    const r = checkJsonLd(site({ 'method/index.html': html({ script, body: '<nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Method</li></ol></nav>' }) }), { now: NOW });
    expect(r.failures).toEqual([]);
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

  it('fails when dates are not full ISO 8601 datetimes with a Europe/London offset, are out of order, or are in the future', () => {
    const dateOnly = pageNodes();
    dateOnly[3].datePublished = '2026-11-14';
    expect(reasons(site({ 'method/index.html': html({ script: graph(dateOnly) }) }))).toMatch(
      /full ISO 8601 datetime with a timezone offset/,
    );

    const zulu = pageNodes();
    zulu[3].datePublished = '2026-11-14T00:00:00Z';
    expect(reasons(site({ 'method/index.html': html({ script: graph(zulu) }) }))).toMatch(
      /full ISO 8601 datetime with a timezone offset/,
    );

    const wrongOffset = pageNodes();
    wrongOffset[3].datePublished = '2026-11-14T00:00:00+01:00';
    expect(reasons(site({ 'method/index.html': html({ script: graph(wrongOffset) }) }))).toMatch(
      /Europe\/London/,
    );

    const order = pageNodes();
    order[3].datePublished = '2026-11-16T00:00:00+00:00';
    order[3].dateModified = '2026-11-15T00:00:00+00:00';
    expect(reasons(site({ 'method/index.html': html({ script: graph(order) }) }))).toMatch(
      /datePublished .* is after dateModified/,
    );

    const future = pageNodes();
    future[3].dateModified = '2026-11-20T00:00:00+00:00';
    expect(reasons(site({ 'method/index.html': html({ script: graph(future) }) }))).toMatch(/after the build date/);
  });

  it('fails when dateModified does not match the visible date, and passes when it does', () => {
    const mismatch = html({
      body: 'Updated <time datetime="2026-11-14">14 Nov 2026</time>',
    });
    expect(reasons(site({ 'method/index.html': mismatch }))).toMatch(/does not match the visible date/);

    const match = html({
      body: 'Published <time datetime="2026-11-14">14 Nov 2026</time> · Updated <time datetime="2026-11-15">15 Nov 2026</time>',
    });
    expect(checkJsonLd(site({ 'method/index.html': match, '404.html': html({ robots: 'noindex, nofollow', script: '', canonical: null, heading: 'Page not found' }) }), { now: NOW }).failures).toEqual([]);
  });

  it('SEO-6e: dateModified must equal the visible Last reviewed / Updated day, not just the Published day', () => {
    // Byline shows Published 14 Nov and Last reviewed 15 Nov, but dateModified is 14 Nov: before SEO-6e this
    // passed because 14 Nov is visible (as Published); now it fails against the Last reviewed day.
    const stale = pageNodes();
    stale[3].dateModified = '2026-11-14T00:00:00+00:00';
    const byline = '<span>Edited by <a href="/about/kieran-littlewood/">Kieran Littlewood</a> · Published <time datetime="2026-11-14">14\u00a0November\u00a02026</time> · Last reviewed 15\u00a0November\u00a02026</span>';
    expect(reasons(site({ 'method/index.html': html({ script: graph(stale), body: byline }) }))).toMatch(
      /Article\.dateModified date 2026-11-14 does not match the visible date \(Last reviewed \/ Updated \/ Last checked: 2026-11-15\)/,
    );

    // dateModified 15 Nov matches the Last reviewed day: passes.
    expect(reasons(site({ 'method/index.html': html({ body: byline }) }))).toBe('');

    // Pages without a Last reviewed / Updated / Last checked label keep the older rule (any visible date).
    expect(reasons(site({ 'method/index.html': html({ body: 'Published <time datetime="2026-11-14">14 Nov 2026</time> <time datetime="2026-11-15">15 Nov</time>' }) }))).toBe('');
  });

  it('SEO-6d: fails when datePublished is not shown on a page that shows dates, and passes when it is', () => {
    const missing = html({ body: 'Updated <time datetime="2026-11-15">15 Nov 2026</time>' });
    expect(reasons(site({ 'method/index.html': missing }))).toMatch(
      /Article\.datePublished date 2026-11-14 is not shown on the page \(visible: 2026-11-15\)/,
    );
    const labelOnly = html({ body: '<p>Published 14 November 2026 · Updated 15 Nov 2026</p>' });
    expect(reasons(site({ 'method/index.html': labelOnly }))).toBe('');
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

describe('SEO-9b Person rules', () => {
  const method = (nodes, extra = {}) =>
    site({ 'method/index.html': html({ script: graph(nodes) }), ...extra });
  const bio = (nodes) => html({ script: graph(nodes), heading: 'Kieran Littlewood', canonical: BIO_URL });

  it('passes the valid fixture (Article author -> #person, bio ProfilePage)', () => {
    expect(reasons(method(pageNodes()))).toBe('');
  });

  it('fails a second Person with a different @id', () => {
    const nodes = pageNodes();
    nodes.push({ ...EXPECTED_PERSON, '@id': 'https://uksurvivalkits.uk/about/#person', worksFor: { ...EXPECTED_PERSON.worksFor } });
    expect(reasons(method(nodes))).toMatch(/Person @id "https:\/\/uksurvivalkits\.uk\/about\/#person" must be .*#person \(one Person site-wide\)/);
  });

  it.each(['sameAs', 'image', 'hasCredential', 'knowsAbout', 'alumniOf', 'award'])('fails a Person with %s', (key) => {
    const nodes = pageNodes();
    nodes[5] = { ...nodes[5], [key]: key === 'sameAs' ? ['https://uksurvivalkits.uk/'] : 'x' };
    const r = reasons(method(nodes));
    expect(r).toContain(`Person must not have "${key}"`);
    expect(r).toMatch(/does not match the SEO-9b spec properties exactly/);
  });

  it('fails a Person whose description or jobTitle drifts from the spec', () => {
    const nodes = pageNodes();
    nodes[5] = { ...nodes[5], jobTitle: 'Expert editor' };
    expect(reasons(method(nodes))).toMatch(/does not match the SEO-9b spec properties exactly/);
  });

  it('fails an Article with no author', () => {
    const nodes = pageNodes();
    delete nodes[3].author;
    const r = reasons(method(nodes));
    expect(r).toMatch(/Article is missing author/);
    expect(r).toMatch(/Person is defined but nothing on this page references it/);
  });

  it('fails an Article whose author is the Organization, an embedded Person, or an array', () => {
    for (const author of [
      { '@id': 'https://uksurvivalkits.uk/#organization' },
      { '@type': 'Person', name: 'Kieran Littlewood' },
      [{ '@id': PERSON_ID }],
    ]) {
      const nodes = pageNodes();
      nodes[3] = { ...nodes[3], author };
      expect(reasons(method(nodes)), JSON.stringify(author)).toMatch(/Article\.author must be \{"@id":"https:\/\/uksurvivalkits\.uk\/about\/kieran-littlewood\/#person"\}/);
    }
  });

  it('fails author on a non-Article node', () => {
    const nodes = pageNodes();
    nodes[2] = { ...nodes[2], author: { '@id': PERSON_ID } };
    expect(reasons(method(nodes))).toMatch(/author is only allowed on Article nodes \(found on WebPage\)/);
  });

  it('fails a Person on a page with nothing that references it', () => {
    const nodes = pageNodes().filter((n) => n['@type'] !== 'Article');
    nodes[2] = { ...nodes[2], mainEntity: undefined };
    delete nodes[2].mainEntity;
    expect(reasons(method(nodes))).toMatch(/Person is defined but nothing on this page references it/);
  });

  it('fails an unresolved author when the page omits the Person node', () => {
    const nodes = pageNodes().slice(0, 5);
    expect(reasons(method(nodes))).toMatch(/unresolved @id reference https:\/\/uksurvivalkits\.uk\/about\/kieran-littlewood\/#person/);
  });

  it('fails a bio page that is a plain WebPage, or a ProfilePage with the wrong mainEntity', () => {
    const asWebPage = bioNodes();
    asWebPage[2] = { ...asWebPage[2], '@type': 'WebPage' };
    expect(reasons(site({ [BIO_FILE]: bio(asWebPage) }))).toMatch(/the editor bio page node must be a ProfilePage \(got WebPage\)/);

    const wrongMain = bioNodes();
    wrongMain[2] = { ...wrongMain[2], mainEntity: { '@id': 'https://uksurvivalkits.uk/#organization' } };
    expect(reasons(site({ [BIO_FILE]: bio(wrongMain) }))).toMatch(/ProfilePage\.mainEntity must be \{"@id":".*#person"\}/);
  });

  it('fails a ProfilePage on any page other than the bio page', () => {
    const nodes = pageNodes();
    nodes[2] = { ...nodes[2], '@type': 'ProfilePage', mainEntity: { '@id': PERSON_ID } };
    expect(reasons(method(nodes))).toMatch(/ProfilePage is only for the editor bio page/);
  });

  it('fails conflicting Person definitions across pages', () => {
    const bioDrift = bioNodes();
    bioDrift[3] = { ...bioDrift[3], name: 'K. Littlewood' };
    const r = reasons(site({ 'method/index.html': html(), [BIO_FILE]: bio(bioDrift) }));
    expect(r).toMatch(/\(site\): 2 conflicting Person definitions across pages/);
  });

  it('fails when pages reference the Person but the bio page is not in the build', () => {
    const r = reasons(site({ 'method/index.html': html(), [NO_BIO]: true }));
    expect(r).toMatch(/\(site\): Person .*#person is referenced but the bio page about\/kieran-littlewood\/index\.html is not in the build/);
  });
});
