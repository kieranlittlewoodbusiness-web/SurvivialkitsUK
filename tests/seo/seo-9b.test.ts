/**
 * SEO-9b: Person + Article author JSON-LD and the compare byline, checked on a real build of the
 * site (temp copy, so `npm test` does not depend on an existing dist).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSiteCopy, type SiteBuild } from '../helpers/site-build';
import fs from 'node:fs';
import path from 'node:path';
import { editor, EDITOR_PERSON_DESCRIPTION } from '../../src/data/editor';
import { PERSON_ID, PERSON_URL, article, personNode } from '../../src/lib/seo/jsonld';
import { EXPECTED_PERSON, PERSON_ID as CHECK_PERSON_ID, checkJsonLd } from '../../scripts/lib/jsonld-checks.mjs';

const NOW = new Date('2026-11-16T12:00:00Z');
type Node = Record<string, unknown>;

describe('personNode (spec §1)', () => {
  it('matches the spec node exactly and the check:jsonld expectation', () => {
    expect(personNode()).toEqual({
      '@type': 'Person',
      '@id': 'https://uksurvivalkits.uk/about/kieran-littlewood/#person',
      name: 'Kieran Littlewood',
      url: 'https://uksurvivalkits.uk/about/kieran-littlewood/',
      jobTitle: 'Editor',
      description: 'Editor of UK Survival Kits. Chooses the products on the site and uses them where he can before sharing them.',
      worksFor: { '@id': 'https://uksurvivalkits.uk/#organization' },
    });
    expect(personNode()).toEqual(EXPECTED_PERSON);
    expect(PERSON_ID).toBe(CHECK_PERSON_ID);
  });

  it('is sourced from src/data/editor.ts', () => {
    expect(personNode().name).toBe(editor.name);
    expect(personNode().description).toBe(EDITOR_PERSON_DESCRIPTION);
    expect(PERSON_URL).toBe(`https://uksurvivalkits.uk${editor.path}`);
  });

  it('Article author is a reference to #person and publisher stays the Organization', () => {
    const node = article({
      url: 'https://uksurvivalkits.uk/gear/radios/',
      headline: 'h',
      description: 'd',
      datePublished: '2026-11-14',
      dateModified: '2026-11-14',
    });
    expect(node.author).toEqual({ '@id': PERSON_ID });
    expect(node.publisher).toEqual({ '@id': 'https://uksurvivalkits.uk/#organization' });
  });
});

describe('built site', () => {
  let site: SiteBuild | undefined;
  let dist = '';
  let build: SiteBuild['result'];
  const graphOf = (rel: string): Node[] => {
    const html = fs.readFileSync(path.join(dist, rel), 'utf8');
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(scripts, rel).toHaveLength(1);
    return JSON.parse(scripts[0]![1]!)['@graph'];
  };
  const types = (g: Node[]) => g.map((n) => n['@type']);
  const pages = () =>
    (fs.readdirSync(dist, { recursive: true }) as string[])
      .filter((f) => f.endsWith('index.html'))
      .map((f) => f.split(path.sep).join('/'));
  const articlePages = () => pages().filter((p) => /^(gear|scenarios)\/[^/]+\/index\.html$|^compare\//.test(p));

  beforeAll(() => {
    site = buildSiteCopy('seo-9b-', {
      tz: 'UTC',
    });
    dist = site.dist;
    build = site.result;
  }, 180_000);

  afterAll(() => {
    site?.cleanup();
  });

  it('builds and passes check:jsonld', () => {
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    const r = checkJsonLd(dist, { now: NOW });
    expect(r.failures).toEqual([]);
  });

  it('bio page: ProfilePage (same #webpage id) with mainEntity #person, plus the Person', () => {
    const g = graphOf('about/kieran-littlewood/index.html');
    expect(types(g)).toEqual(['Organization', 'WebSite', 'ProfilePage', 'Person', 'BreadcrumbList']);
    const profile = g[2]!;
    expect(profile['@id']).toBe('https://uksurvivalkits.uk/about/kieran-littlewood/#webpage');
    expect(profile.mainEntity).toEqual({ '@id': PERSON_ID });
    expect(g[3]).toEqual(EXPECTED_PERSON);
  });

  it('every Article page (6 gear, 14 scenarios, compare) carries the Person and author -> #person', () => {
    const list = articlePages();
    expect(list).toHaveLength(21);
    for (const rel of list) {
      const g = graphOf(rel);
      const persons = g.filter((n) => n['@type'] === 'Person');
      expect(persons, rel).toEqual([EXPECTED_PERSON]);
      const articles = g.filter((n) => n['@type'] === 'Article');
      expect(articles, rel).toHaveLength(1);
      expect(articles[0]!.author, rel).toEqual({ '@id': PERSON_ID });
      expect(articles[0]!.publisher, rel).toEqual({ '@id': 'https://uksurvivalkits.uk/#organization' });
    }
  });

  it('no Person, author or ProfilePage on home, hubs or trust pages', () => {
    const others = pages().filter((p) => !articlePages().includes(p) && p !== 'about/kieran-littlewood/index.html');
    expect(others.length).toBeGreaterThanOrEqual(12);
    for (const rel of others) {
      const json = JSON.stringify(graphOf(rel));
      expect(json, rel).not.toMatch(/"Person"|"author"|"ProfilePage"/);
    }
  });

  it('no sameAs or image on any Person anywhere', () => {
    for (const rel of pages()) {
      for (const n of graphOf(rel).filter((x) => x['@type'] === 'Person')) {
        expect(n, rel).not.toHaveProperty('sameAs');
        expect(n, rel).not.toHaveProperty('image');
      }
    }
  });

  it('compare page shows the approved byline dated from dateModified', () => {
    const html = fs.readFileSync(path.join(dist, 'compare/72-hour-emergency-kits/index.html'), 'utf8');
    const byline = /<p class="meta byline"[^>]*><span>([\s\S]*?)<\/span><\/p>/.exec(html)?.[1] ?? '';
    const text = byline.replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ');
    expect(text).toBe('Edited by Kieran Littlewood · Last reviewed 15 November 2026');
    expect(byline).toContain('<a href="/about/kieran-littlewood/">Kieran Littlewood</a>');
    const art = graphOf('compare/72-hour-emergency-kits/index.html').find((n) => n['@type'] === 'Article')!;
    expect(art.dateModified).toBe('2026-11-15T00:00:00+00:00');
    expect(art.datePublished).toBe('2026-11-14T00:00:00+00:00');
    expect(html).not.toMatch(/\b(expert|certified|tested by|reviewed the products)\b/i);
  });
});
