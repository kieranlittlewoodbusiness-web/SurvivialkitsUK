import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { site } from '../../src/data/site';
import { EDITOR_DESCRIPTION, EDITOR_TITLE, editor, editorDocumentTitle } from '../../src/data/editor';
import { PERSON_ID, breadcrumbList, crumbsForPage, pageUrl, personNode, webPage } from '../../src/lib/seo/jsonld';

const root = path.resolve('.');
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const TITLE_MAX = 60;
const META_MIN = 120;
const META_MAX = 160;
function parseGraph(html: string) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter((m) =>
    /type\s*=\s*["']application\/ld\+json["']/i.test(m[1]),
  );
  return { scripts, data: scripts.length === 1 ? JSON.parse(scripts[0][2]) : null };
}

const typesOf = (node: { '@type'?: string | string[] }) =>
  Array.isArray(node['@type']) ? node['@type'] : node['@type'] ? [node['@type']] : [];

describe('SEO-9 editor bio copy', () => {
  it('uses the approved title, 60 characters or fewer including the site suffix', () => {
    expect(EDITOR_TITLE).toBe('Kieran Littlewood, editor');
    expect(editorDocumentTitle).toBe('Kieran Littlewood, editor · UK Survival Kits');
    expect(editorDocumentTitle).toBe(`${EDITOR_TITLE} · ${site.name}`);
    expect(editorDocumentTitle.length).toBe(44);
    expect(editorDocumentTitle.length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it('uses the approved meta description, 120–160 characters and unique wording', () => {
    expect(EDITOR_DESCRIPTION).toBe(
      'Kieran Littlewood edits UK Survival Kits. He chooses the products on the site and uses them where he can before sharing them.',
    );
    expect(EDITOR_DESCRIPTION.length).toBe(125);
    expect(EDITOR_DESCRIPTION.length).toBeGreaterThanOrEqual(META_MIN);
    expect(EDITOR_DESCRIPTION.length).toBeLessThanOrEqual(META_MAX);
  });

  it('keeps the key line "use them where I can" and does not claim every product was used or tested', () => {
    const page = read('src/pages/about/kieran-littlewood.astro');
    expect(page).toContain('I choose the products on this site and use them where I can before sharing them.');
    expect(page).toMatch(/use them where I can/);
    expect(page).not.toMatch(/used every|tested every|use[sd] them all/i);
    expect(page).not.toMatch(/<img\b/);
    expect(page).not.toMatch(/sameAs/);
  });

  it('SEO-9b: uses a ProfilePage with mainEntity #person and one Person node, with no sameAs', () => {
    const page = read('src/pages/about/kieran-littlewood.astro');
    expect(page).toContain('jsonLd={jsonLd}');
    expect(page).toContain('webPage(');
    expect(page).toContain("type: 'ProfilePage'");
    expect(page).toContain('mainEntity: PERSON_ID');
    expect(page).toContain('personNode()');
    expect(page).toContain('breadcrumbList(');
    expect(page).toContain("crumbsForPage(canonicalPath, editor.name, { label: 'About', href: '/about/' })");
    expect(page).not.toMatch(/sameAs|author:/);

    const url = pageUrl(editor.path);
    const nodes = [
      webPage({ url, name: editor.name, description: editor.description, type: 'ProfilePage', breadcrumb: true, mainEntity: PERSON_ID }),
      personNode(),
      breadcrumbList(url, crumbsForPage(editor.path, editor.name, { label: 'About', href: '/about/' })),
    ];
    expect(nodes[0]['@type']).toBe('ProfilePage');
    expect(nodes[0]['@id']).toBe('https://uksurvivalkits.uk/about/kieran-littlewood/#webpage');
    expect(nodes[0].mainEntity).toEqual({ '@id': 'https://uksurvivalkits.uk/about/kieran-littlewood/#person' });
    expect(nodes[0].name).toBe('Kieran Littlewood');
    expect(nodes[0].description).toBe(EDITOR_DESCRIPTION);
    expect(nodes[0].url).toBe('https://uksurvivalkits.uk/about/kieran-littlewood/');
    expect(nodes[1]['@type']).toBe('Person');
    expect(nodes[2]['@type']).toBe('BreadcrumbList');
    const crumbs = nodes[2].itemListElement as Array<{ position: number; name: string; item: string }>;
    expect(crumbs.map((c) => [c.position, c.name, c.item])).toEqual([
      [1, 'Home', 'https://uksurvivalkits.uk/'],
      [2, 'About', 'https://uksurvivalkits.uk/about/'],
      [3, 'Kieran Littlewood', 'https://uksurvivalkits.uk/about/kieran-littlewood/'],
    ]);
    expect(JSON.stringify(nodes)).not.toMatch(/sameAs|"author"|"image"/);
  });
});

describe('SEO-9 routes and inbound links', () => {
  it('publishes the bio at /about/kieran-littlewood/ with a trailing slash', () => {
    expect(editor.path).toBe('/about/kieran-littlewood/');
    expect(fs.existsSync(path.join(root, 'src/pages/about/kieran-littlewood.astro'))).toBe(true);
    const page = read('src/pages/about/kieran-littlewood.astro');
    expect(page).toContain('canonicalPath={canonicalPath}');
    expect(page).toContain('<h1>{editor.name}</h1>');
  });

  it('links to the bio from About, Method, and article bylines', () => {
    expect(read('src/pages/about.astro')).toContain('href="/about/kieran-littlewood/"');
    expect(read('src/pages/method.astro')).toContain('href="/about/kieran-littlewood/"');
    const byline = read('src/components/EditorByline.astro');
    expect(byline).toContain('Edited by');
    expect(byline).toContain('{editor.path}');
    expect(byline).toContain('{editor.name}');
    expect(byline).toContain('Last reviewed {reviewed}');
    expect(read('src/pages/scenarios/[slug].astro')).toContain('EditorByline');
    expect(read('src/pages/gear/[slug].astro')).toContain('EditorByline');
  });
});

describe('SEO-9 built page (when dist is present)', () => {
  const distPage = path.join(root, 'dist/about/kieran-littlewood/index.html');
  const hasDist = fs.existsSync(distPage);

  it.skipIf(!hasDist)('emits the approved title, meta, canonical, og tags and body', () => {
    const html = fs.readFileSync(distPage, 'utf8');
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '';
    expect(title).toBe(editorDocumentTitle);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '';
    expect(desc).toBe(EDITOR_DESCRIPTION);
    expect(desc.length).toBeGreaterThanOrEqual(META_MIN);
    expect(desc.length).toBeLessThanOrEqual(META_MAX);
    expect(html).toContain('rel="canonical" href="https://uksurvivalkits.uk/about/kieran-littlewood/"');
    expect(html).toContain('property="og:url" content="https://uksurvivalkits.uk/about/kieran-littlewood/"');
    expect(html).toContain(`property="og:title" content="${editorDocumentTitle}"`);
    expect(html).toContain('name="robots" content="index, follow"');
    expect(html).toMatch(/<h1[^>]*>Kieran Littlewood<\/h1>/);
    expect(html).toContain('use them where I can');
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
    expect(main).not.toMatch(/<img\b/);
  });

  it.skipIf(!hasDist)('SEO-9b: emits one @graph with Organization, WebSite, ProfilePage, Person and BreadcrumbList, and no author or sameAs', () => {
    const html = fs.readFileSync(distPage, 'utf8');
    const { scripts, data } = parseGraph(html);
    expect(scripts).toHaveLength(1);
    expect(data['@context']).toBe('https://schema.org');
    const graph = data['@graph'] as Array<Record<string, unknown>>;
    const types = graph.flatMap((n) => typesOf(n));
    expect(types).toEqual(['Organization', 'WebSite', 'ProfilePage', 'Person', 'BreadcrumbList']);
    expect(JSON.stringify(data)).not.toMatch(/"author"|sameAs/);

    const page = graph.find((n) => typesOf(n).includes('ProfilePage'))!;
    expect(page.mainEntity).toEqual({ '@id': 'https://uksurvivalkits.uk/about/kieran-littlewood/#person' });
    const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
    const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1];
    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i)?.[1];
    expect(page.name).toBe(h1);
    expect(page.description).toBe(desc);
    expect(page.url).toBe(canonical);
    expect(canonical).toBe('https://uksurvivalkits.uk/about/kieran-littlewood/');

    const crumbs = (graph.find((n) => typesOf(n).includes('BreadcrumbList'))!.itemListElement as Array<{ name: string; item: string }>);
    expect(crumbs.map((c) => [c.name, c.item])).toEqual([
      ['Home', 'https://uksurvivalkits.uk/'],
      ['About', 'https://uksurvivalkits.uk/about/'],
      ['Kieran Littlewood', 'https://uksurvivalkits.uk/about/kieran-littlewood/'],
    ]);
  });

  it.skipIf(!hasDist)('lists the trailing-slash URL in the sitemap', () => {
    const sitemap = fs.readFileSync(path.join(root, 'dist/sitemap-0.xml'), 'utf8');
    expect(sitemap).toContain('<loc>https://uksurvivalkits.uk/about/kieran-littlewood/</loc>');
  });
});
