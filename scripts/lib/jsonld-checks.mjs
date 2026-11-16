/**
 * SEO-6: check:jsonld over built HTML. Exactly one application/ld+json script per indexable
 * page and none on 404.html. Enforces §1.7 of the SEO-6 spec plus K55's constraints: no
 * duplicate @id, banned types, no price or Amazon URLs, absolute apex URLs with a trailing
 * slash on page URLs, and consistency with the canonical, H1, meta description and og:image.
 */
import fs from 'node:fs';
import path from 'node:path';
import { htmlFiles } from './dist-checks.mjs';

export const APEX = 'https://uksurvivalkits.uk';
export const BANNED_TYPES = [
  'Product',
  'Offer',
  'AggregateOffer',
  'Review',
  'AggregateRating',
  'Rating',
  'FAQPage',
  'HowTo',
];
export const BANNED_PRICE_KEYS = ['price', 'priceCurrency', 'lowPrice', 'highPrice', 'priceValidUntil'];

/**
 * SEO-9b (spec §1, /workspace/seo-9-brief/SEO-9b-person-author-spec.md): the one Person site-wide.
 * tests/seo/seo-9b.test.ts asserts personNode() in src/lib/seo/jsonld.ts deep-equals this.
 */
export const BIO_PATH = '/about/kieran-littlewood/';
export const BIO_FILE = 'about/kieran-littlewood/index.html';
export const PERSON_ID = `${APEX}${BIO_PATH}#person`;
export const EXPECTED_PERSON = Object.freeze({
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Kieran Littlewood',
  url: `${APEX}${BIO_PATH}`,
  jobTitle: 'Editor',
  description: 'Editor of UK Survival Kits. Chooses the products on the site and uses them where he can before sharing them.',
  worksFor: { '@id': `${APEX}/#organization` },
});
export const PERSON_FORBIDDEN_KEYS = ['image', 'sameAs', 'knowsAbout', 'alumniOf', 'award', 'hasCredential'];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

const datePart = (value) => String(value).slice(0, 10);

/** Local midnight in Europe/London as a full ISO 8601 datetime with offset. */
export function londonDateTime(day) {
  const date = datePart(day);
  if (!ISO_DAY.test(date)) throw new Error(`londonDateTime: not a calendar date: ${day}`);
  const inst = new Date(`${date}T00:00:00Z`);
  const tz = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    timeZoneName: 'longOffset',
  })
    .formatToParts(inst)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = tz?.match(/GMT([+-]\d{2}):(\d{2})/i);
  if (!match) throw new Error(`londonDateTime: could not read the Europe/London offset for ${date} (${tz ?? 'none'})`);
  return `${date}T00:00:00${match[1]}:${match[2]}`;
}

const MONTHS = {
  january: '01', jan: '01', february: '02', feb: '02', march: '03', mar: '03',
  april: '04', apr: '04', may: '05', june: '06', jun: '06', july: '07', jul: '07',
  august: '08', aug: '08', september: '09', sep: '09', sept: '09', october: '10', oct: '10',
  november: '11', nov: '11', december: '12', dec: '12',
};

/** Calendar dates from <time datetime> and visible "Published" / "Last reviewed" / "Updated" / "Last checked" labels. */
export function visibleDates(html) {
  const out = new Set();
  for (const m of html.matchAll(/<time\b[^>]*\bdatetime\s*=\s*["']([^"']+)["']/gi)) {
    const value = decode(m[1]);
    if (ISO_DAY.test(value) || ISO_DATETIME.test(value)) out.add(datePart(value));
  }
  const text = decode(html.replace(/<[^>]+>/g, ' '));
  const label = /(?:Published|Last reviewed|Updated|Last checked)\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/gi;
  let m;
  while ((m = label.exec(text))) {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) continue;
    out.add(`${m[3]}-${month}-${m[1].padStart(2, '0')}`);
  }
  return [...out];
}

/**
 * SEO-6e: calendar dates from the visible "last modified" labels only ("Last reviewed", "Updated",
 * "Last checked"), not "Published". The byline day an Article's dateModified must equal.
 */
export function visibleModifiedDates(html) {
  const out = new Set();
  const text = decode(html.replace(/<[^>]+>/g, ' '));
  const label = /(?:Last reviewed|Updated|Last checked)\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/gi;
  let m;
  while ((m = label.exec(text))) {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) continue;
    out.add(`${m[3]}-${month}-${m[1].padStart(2, '0')}`);
  }
  return [...out];
}

const WEBPAGE_TYPES = new Set(['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage', 'ProfilePage']);

const decode = (s) =>
  String(s)
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? decode(m[1] ?? m[2] ?? m[3]) : null;
};

const is404 = (rel) => rel === '404.html' || rel.endsWith(`${path.sep}404.html`) || rel.endsWith('/404.html');

export function extractLdJsonScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(m[1])) out.push(m[2].trim());
  }
  return out;
}

export function firstH1(html) {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

export function metaContent(html, name) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const hit = tags.find((t) => new RegExp(`\\bname\\s*=\\s*["']${name}["']`, 'i').test(t));
  return hit ? attr(hit, 'content') : null;
}

export function ogContent(html, property) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const hit = tags.find((t) => new RegExp(`\\bproperty\\s*=\\s*["']${property}["']`, 'i').test(t));
  return hit ? attr(hit, 'content') : null;
}

export function canonicalHref(html) {
  const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const hit = tags.find((t) => /\brel\s*=\s*["']canonical["']/i.test(t));
  return hit ? attr(hit, 'href') : null;
}

/** Visible breadcrumb labels and hrefs, or null if the page has no breadcrumb nav. */
export function visibleBreadcrumbs(html) {
  const nav = html.match(/<nav\b[^>]*aria-label\s*=\s*["']Breadcrumb["'][^>]*>([\s\S]*?)<\/nav>/i);
  if (!nav) return null;
  const items = [];
  for (const li of nav[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const href = attr(li[0].match(/<a\b[^>]*>/i)?.[0] ?? '', 'href');
    const name = decode(li[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    items.push({ name, href: href ?? null });
  }
  return items;
}

function typesOf(node) {
  const t = node?.['@type'];
  if (Array.isArray(t)) return t.map(String);
  if (t == null) return [];
  return [String(t)];
}

function walk(node, fn) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, fn);
    return;
  }
  if (node && typeof node === 'object') {
    fn(node);
    for (const value of Object.values(node)) walk(value, fn);
  }
}

function isRef(node) {
  const keys = Object.keys(node);
  return keys.length === 1 && keys[0] === '@id';
}

function definedIds(graph) {
  const ids = new Map();
  const dups = [];
  walk(graph, (node) => {
    if (!node['@id'] || isRef(node)) return;
    const id = String(node['@id']);
    if (ids.has(id)) dups.push(id);
    else ids.set(id, node);
  });
  return { ids, dups };
}

function isAmazonHost(host) {
  const h = host.toLowerCase();
  return h === 'amazon' || h.endsWith('.amazon') || /(^|\.)amazon\./.test(h) || /(^|\.)amzn\./.test(h) || h.includes('media-amazon');
}

function isApexUrl(value) {
  return typeof value === 'string' && (value === `${APEX}/` || value.startsWith(`${APEX}/`));
}

function isAssetPath(pathname) {
  return /\.[a-z0-9]+$/i.test(pathname);
}

function todayStamp(now) {
  return isoFromDate(now ?? new Date());
}

function isoFromDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function findByType(graph, type) {
  const out = [];
  walk(graph, (node) => {
    if (!isRef(node) && typesOf(node).includes(type)) out.push(node);
  });
  return out;
}

function webpageNode(graph) {
  const found = [];
  walk(graph, (node) => {
    if (isRef(node)) return;
    if (typesOf(node).some((t) => WEBPAGE_TYPES.has(t))) found.push(node);
  });
  return found;
}

function checkUrlFields(file, node, failures) {
  for (const key of ['url', 'item', 'contentUrl', '@id']) {
    const value = node[key];
    if (typeof value !== 'string') continue;
    checkOneUrl(file, key, value, failures);
  }
}

function checkOneUrl(file, field, value, failures) {
  if (/^mailto:/i.test(value) || /^tel:/i.test(value)) {
    failures.push({ file, reason: `${field} "${value}" is not an apex https URL` });
    return;
  }
  let u;
  try {
    u = new URL(value);
  } catch {
    failures.push({ file, reason: `${field} "${value}" is not an absolute URL` });
    return;
  }
  if (isAmazonHost(u.hostname)) {
    failures.push({ file, reason: `${field} "${value}" must not use an Amazon host` });
    return;
  }
  if (!isApexUrl(value)) {
    failures.push({ file, reason: `${field} "${value}" is not on ${APEX}/` });
    return;
  }
  if (!isAssetPath(u.pathname) && !u.pathname.endsWith('/')) {
    failures.push({ file, reason: `${field} "${value}" is a page URL and must end in a trailing slash (before any #)` });
  }
}

function checkAnchorsExist(file, html, graph, failures) {
  const lists = findByType(graph, 'ItemList');
  for (const list of lists) {
    const elements = Array.isArray(list.itemListElement) ? list.itemListElement : [];
    for (const item of elements) {
      const url = item?.url;
      if (typeof url !== 'string') continue;
      let u;
      try {
        u = new URL(url);
      } catch {
        continue;
      }
      if (u.origin !== APEX || !u.hash) continue;
      const id = decodeURIComponent(u.hash.slice(1));
      const present =
        new RegExp(`\\sid\\s*=\\s*["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(html) ||
        new RegExp(`\\sid\\s*=\\s*${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s>]`, 'i').test(html);
      if (!present) {
        failures.push({ file, reason: `ItemList url "#${id}" has no matching id in the HTML` });
      }
    }
  }
}

function checkBreadcrumbVisibility(file, html, graph, canonical, failures) {
  const visible = visibleBreadcrumbs(html);
  if (!visible) return;
  const lists = findByType(graph, 'BreadcrumbList');
  if (lists.length !== 1) {
    failures.push({ file, reason: `visible breadcrumb nav present but found ${lists.length} BreadcrumbList node(s)` });
    return;
  }
  const elements = Array.isArray(lists[0].itemListElement) ? lists[0].itemListElement : [];
  if (elements.length !== visible.length) {
    failures.push({
      file,
      reason: `breadcrumb JSON has ${elements.length} item(s) but the visible nav has ${visible.length}`,
    });
    return;
  }
  for (let i = 0; i < visible.length; i += 1) {
    const json = elements[i];
    const vis = visible[i];
    if (json?.name !== vis.name) {
      failures.push({ file, reason: `breadcrumb item ${i + 1} name "${json?.name}" != visible "${vis.name}"` });
    }
    const jsonItem = json?.item;
    const visHref = vis.href;
    if (i === visible.length - 1) {
      if (visHref != null) {
        failures.push({ file, reason: 'visible current breadcrumb item must not be a link' });
      }
      if (jsonItem !== canonical) {
        failures.push({ file, reason: `last breadcrumb item "${jsonItem}" != canonical "${canonical}"` });
      }
    } else {
      let resolved = visHref;
      try {
        resolved = visHref ? new URL(visHref, `${APEX}/`).href : visHref;
      } catch {
        /* keep raw */
      }
      if (jsonItem !== resolved) {
        failures.push({ file, reason: `breadcrumb item ${i + 1} item "${jsonItem}" != visible href "${visHref}"` });
      }
    }
  }
}

const stable = (value) =>
  JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v,
  );

const isPersonRef = (value) => value && typeof value === 'object' && !Array.isArray(value) && isRef(value) && value['@id'] === PERSON_ID;

/** SEO-9b: Person, author and ProfilePage rules for one page graph. Returns this page's Person definitions. */
function checkPerson(file, graph, page, failures) {
  const persons = findByType(graph, 'Person');
  for (const person of persons) {
    if (person['@id'] !== PERSON_ID) {
      failures.push({ file, reason: `Person @id "${person['@id'] ?? '(none)'}" must be ${PERSON_ID} (one Person site-wide)` });
      continue;
    }
    for (const key of PERSON_FORBIDDEN_KEYS) {
      if (key in person) failures.push({ file, reason: `Person must not have "${key}"` });
    }
    if (stable(person) !== stable(EXPECTED_PERSON)) {
      failures.push({ file, reason: `Person ${PERSON_ID} does not match the SEO-9b spec properties exactly` });
    }
  }

  let referenced = false;
  walk(graph, (node) => {
    if (isRef(node) || !('author' in node)) return;
    const types = typesOf(node);
    if (!types.includes('Article')) {
      failures.push({ file, reason: `author is only allowed on Article nodes (found on ${types.join(', ') || 'an untyped node'})` });
      return;
    }
    if (!isPersonRef(node.author)) {
      failures.push({ file, reason: `Article.author must be {"@id":"${PERSON_ID}"} (got ${JSON.stringify(node.author)})` });
      return;
    }
    referenced = true;
  });
  for (const art of findByType(graph, 'Article')) {
    if (!('author' in art)) failures.push({ file, reason: `Article is missing author {"@id":"${PERSON_ID}"}` });
  }

  const profiles = findByType(graph, 'ProfilePage');
  const isBio = page?.url === EXPECTED_PERSON.url;
  if (isBio && !typesOf(page).includes('ProfilePage')) {
    failures.push({ file, reason: `the editor bio page node must be a ProfilePage (got ${typesOf(page).join(', ')})` });
  }
  for (const profile of profiles) {
    if (profile.url !== EXPECTED_PERSON.url) {
      failures.push({ file, reason: `ProfilePage is only for the editor bio page (${EXPECTED_PERSON.url}), not ${profile.url}` });
    }
    if (!isPersonRef(profile.mainEntity)) {
      failures.push({ file, reason: `ProfilePage.mainEntity must be {"@id":"${PERSON_ID}"} (got ${JSON.stringify(profile.mainEntity)})` });
    } else {
      referenced = true;
    }
  }

  if (persons.length && !referenced) {
    failures.push({ file, reason: 'Person is defined but nothing on this page references it (only the bio page and Article pages carry the Person node)' });
  }
  return persons;
}

function checkPage(file, html, { now } = {}, failures) {
  const scripts = extractLdJsonScripts(html);
  if (is404(file)) {
    if (scripts.length) {
      failures.push({ file, reason: `404.html must not contain JSON-LD (found ${scripts.length} script(s))` });
    }
    return;
  }
  if (scripts.length !== 1) {
    failures.push({ file, reason: `expected exactly 1 application/ld+json script, found ${scripts.length}` });
    return;
  }
  let data;
  try {
    data = JSON.parse(scripts[0]);
  } catch (err) {
    failures.push({ file, reason: `JSON-LD did not parse: ${err instanceof Error ? err.message : err}` });
    return;
  }
  if (data?.['@context'] !== 'https://schema.org') {
    failures.push({ file, reason: `@context must be "https://schema.org" (got ${JSON.stringify(data?.['@context'])})` });
  }
  if (!Array.isArray(data?.['@graph'])) {
    failures.push({ file, reason: 'JSON-LD must have a @graph array' });
    return;
  }
  const graph = data['@graph'];

  const { ids, dups } = definedIds(graph);
  for (const id of dups) failures.push({ file, reason: `duplicate @id ${id}` });

  walk(graph, (node) => {
    if (isRef(node)) {
      const id = String(node['@id']);
      if (!ids.has(id)) failures.push({ file, reason: `unresolved @id reference ${id}` });
    }
    for (const t of typesOf(node)) {
      if (BANNED_TYPES.includes(t)) failures.push({ file, reason: `banned type ${t}` });
    }
    for (const key of Object.keys(node)) {
      if (BANNED_PRICE_KEYS.includes(key)) {
        failures.push({ file, reason: `banned price property "${key}"` });
      }
    }
    for (const value of Object.values(node)) {
      if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
        try {
          const u = new URL(value);
          if (isAmazonHost(u.hostname)) {
            failures.push({ file, reason: `Amazon URL is not allowed in JSON-LD: ${value}` });
          }
        } catch {
          /* checked as a URL field below if applicable */
        }
      }
    }
    checkUrlFields(file, node, failures);
  });

  const pages = webpageNode(graph);
  if (pages.length !== 1) {
    failures.push({ file, reason: `expected exactly 1 WebPage (or subtype) node, found ${pages.length}` });
  }
  const page = pages[0];
  const canonical = canonicalHref(html);
  const h1 = firstH1(html);
  const description = metaContent(html, 'description');
  const ogImage = ogContent(html, 'og:image');

  if (page) {
    if (canonical && page.url !== canonical) {
      failures.push({ file, reason: `WebPage.url "${page.url}" != canonical "${canonical}"` });
    }
    if (h1 != null && page.name !== h1) {
      failures.push({ file, reason: `WebPage.name "${page.name}" != H1 "${h1}"` });
    }
    if (description != null && page.description !== description) {
      failures.push({ file, reason: `WebPage.description does not match the meta description` });
    }
  }

  const articles = findByType(graph, 'Article');
  const today = todayStamp(now);
  for (const art of articles) {
    if (h1 != null && art.headline !== h1) {
      failures.push({ file, reason: `Article.headline "${art.headline}" != H1 "${h1}"` });
    }
    if (description != null && art.description !== description) {
      failures.push({ file, reason: `Article.description does not match the meta description` });
    }
    const imageUrl = art.image && typeof art.image === 'object' ? art.image.url : art.image;
    if (ogImage && imageUrl !== ogImage) {
      failures.push({ file, reason: `Article.image.url "${imageUrl}" != og:image "${ogImage}"` });
    }
    for (const field of ['datePublished', 'dateModified']) {
      const value = art[field];
      if (value == null) {
        failures.push({ file, reason: `Article is missing ${field}` });
        continue;
      }
      if (!ISO_DATETIME.test(String(value))) {
        failures.push({
          file,
          reason: `Article.${field} "${value}" is not a full ISO 8601 datetime with a timezone offset (YYYY-MM-DDTHH:MM:SS±HH:MM)`,
        });
        continue;
      }
      const expected = londonDateTime(datePart(value));
      if (value !== expected) {
        failures.push({
          file,
          reason: `Article.${field} "${value}" must be local midnight in Europe/London (${expected})`,
        });
      }
    }
    if (ISO_DATETIME.test(String(art.datePublished ?? '')) && ISO_DATETIME.test(String(art.dateModified ?? ''))) {
      if (datePart(art.datePublished) > datePart(art.dateModified)) {
        failures.push({ file, reason: `datePublished ${art.datePublished} is after dateModified ${art.dateModified}` });
      }
      if (datePart(art.dateModified) > today) {
        failures.push({ file, reason: `dateModified ${art.dateModified} is after the build date ${today}` });
      }
    }
    const visible = visibleDates(html);
    // SEO-6e: when the page shows a "Last reviewed" / "Updated" / "Last checked" day, dateModified must be
    // that day (matching only the "Published" day is not enough).
    const visibleModified = visibleModifiedDates(html);
    if (visible.length && ISO_DATETIME.test(String(art.dateModified ?? ''))) {
      const modified = datePart(art.dateModified);
      if (visibleModified.length) {
        if (!visibleModified.includes(modified)) {
          failures.push({
            file,
            reason: `Article.dateModified date ${modified} does not match the visible date (Last reviewed / Updated / Last checked: ${visibleModified.join(', ')})`,
          });
        }
      } else if (!visible.includes(modified)) {
        failures.push({
          file,
          reason: `Article.dateModified date ${modified} does not match the visible date (${visible.join(', ')})`,
        });
      }
    }
    // SEO-6d (QA comment 6928192150 on #37): a page that shows dates must also show its datePublished.
    if (visible.length && ISO_DATETIME.test(String(art.datePublished ?? ''))) {
      const published = datePart(art.datePublished);
      if (!visible.includes(published)) {
        failures.push({
          file,
          reason: `Article.datePublished date ${published} is not shown on the page (visible: ${visible.join(', ')})`,
        });
      }
    }
  }

  const crumbs = findByType(graph, 'BreadcrumbList');
  for (const list of crumbs) {
    const elements = Array.isArray(list.itemListElement) ? list.itemListElement : [];
    const last = elements[elements.length - 1];
    if (canonical && last?.item !== canonical) {
      failures.push({ file, reason: `last breadcrumb item "${last?.item}" != canonical "${canonical}"` });
    }
  }

  if (canonical) checkBreadcrumbVisibility(file, html, graph, canonical, failures);
  checkAnchorsExist(file, html, graph, failures);
  return { persons: checkPerson(file, graph, page, failures) };
}

/**
 * @param {string} dist
 * @param {{ now?: Date }} [opts]
 * @returns {{ files: number, failures: Array<{ file: string, reason: string }> }}
 */
export function checkJsonLd(dist, { now } = {}) {
  const files = htmlFiles(dist);
  const failures = [];
  const personDefs = new Map();
  let personPages = 0;
  for (const file of files) {
    const rel = path.relative(dist, file);
    const html = fs.readFileSync(file, 'utf8');
    const result = checkPage(rel, html, { now }, failures);
    for (const person of result?.persons ?? []) {
      personPages += 1;
      const key = stable(person);
      if (!personDefs.has(key)) personDefs.set(key, []);
      personDefs.get(key).push(rel);
    }
  }
  // SEO-9b: one Person definition site-wide, and it must live on (and be the mainEntity of) the bio page.
  if (personDefs.size > 1) {
    const variants = [...personDefs.values()].map((pages) => pages.slice(0, 3).join(', ') + (pages.length > 3 ? ', ...' : ''));
    failures.push({ file: '(site)', reason: `${personDefs.size} conflicting Person definitions across pages: ${variants.join(' | ')}` });
  }
  if (personPages && !fs.existsSync(path.join(dist, BIO_FILE))) {
    failures.push({ file: '(site)', reason: `Person ${PERSON_ID} is referenced but the bio page ${BIO_FILE} is not in the build` });
  }
  return { files: files.length, failures };
}
