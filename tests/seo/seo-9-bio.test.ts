import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { site } from '../../src/data/site';
import {
  EDITOR_DATE_MODIFIED,
  EDITOR_DESCRIPTION,
  EDITOR_PERSON_DESCRIPTION,
  EDITOR_TITLE,
  editor,
  editorDocumentTitle,
  editorPersonNode,
  editorProfileJsonLd,
} from '../../src/data/editor';

const root = path.resolve('.');
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const TITLE_MAX = 60;
const META_MIN = 120;
const META_MAX = 160;

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

  it('records the Person description for the later SEO-6 author step, with no sameAs or image', () => {
    expect(EDITOR_PERSON_DESCRIPTION).toBe(
      'Editor of UK Survival Kits. Chooses the products on the site and uses them where he can before sharing them.',
    );
    const person = editorPersonNode();
    expect(person['@id']).toBe('https://uksurvivalkits.uk/about/kieran-littlewood/#person');
    expect(person.description).toBe(EDITOR_PERSON_DESCRIPTION);
    expect(person).not.toHaveProperty('sameAs');
    expect(person).not.toHaveProperty('image');
    expect(person).not.toHaveProperty('knowsAbout');
    const graph = editorProfileJsonLd(EDITOR_DATE_MODIFIED);
    const json = JSON.stringify(graph);
    expect(json).not.toContain('sameAs');
    expect(json).not.toMatch(/"image"/);
    expect(graph['@graph'].some((n) => n['@type'] === 'ProfilePage')).toBe(true);
  });
});

describe('SEO-9 routes and inbound links', () => {
  it('publishes the bio at /about/kieran-littlewood/ with a trailing slash', () => {
    expect(editor.path).toBe('/about/kieran-littlewood/');
    expect(fs.existsSync(path.join(root, 'src/pages/about/kieran-littlewood.astro'))).toBe(true);
    const page = read('src/pages/about/kieran-littlewood.astro');
    expect(page).toContain('canonicalPath={editor.path}');
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

  it.skipIf(!hasDist)('lists the trailing-slash URL in the sitemap', () => {
    const sitemap = fs.readFileSync(path.join(root, 'dist/sitemap-0.xml'), 'utf8');
    expect(sitemap).toContain('<loc>https://uksurvivalkits.uk/about/kieran-littlewood/</loc>');
  });
});
