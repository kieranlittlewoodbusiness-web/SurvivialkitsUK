/**
 * S1-7 dist checks, shared by the CLI scripts and their unit tests.
 *
 * checkLinks(dist, cfg, { expectAffiliate })
 *   Every external URL in href/src/action/srcset must be an own host, an allowlisted https
 *   citation host, an allowlisted product image (https on cfg.image_hosts, which is only
 *   m.media-amazon.com, and only on <img> or <source>), or an affiliate link: an <a> to
 *   https://www.amazon.co.uk/dp/<ASIN>?tag=<id>-21 with every rel token in cfg.affiliate.required_rel
 *   ("sponsored" and "nofollow").
 *
 * checkContent(dist, { production, banned })
 *   - No banned string (pre-publication copy, placeholder copy, old brand, non-Amazon retailers)
 *     anywhere in the HTML, case-insensitive, after decoding entities.
 *   - Every Ad badge (.badge--ad) sits in a card (<article>, or class card/pcard/cta) that also
 *     contains an <a rel="sponsored …"> link. A legend badge must opt out with data-badge-legend.
 *   - Exactly one <meta name="robots"> per page.
 *   - production: no noindex on any page except 404.html; robots.txt allows crawling;
 *     _headers must exist and send X-Robots-Tag: noindex for the production
 *     pages.dev alias and preview subdomains, never for uksurvivalkits.uk.
 *     Canonical, og:url and sitemap URLs must use the apex https://uksurvivalkits.uk
 *     and must not contain www.uksurvivalkits.uk or pages.dev.
 */
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_BANNED = [
  'not live yet',
  'editorial review',
  'do not publish',
  'unsupported safety claim',
  'unverified specification',
  'coming soon',
  'household brief',
  'survival kit brief',
  'evaq8',
  't-minus',
  'prepared britain',
  'decathlon',
  'go outdoors',
  'argos',
  'millets',
];

export const redactTag = (s) => String(s).replace(/([?&]tag=)[^&#"'\s]+/g, '$1[REDACTED]');

export function htmlFiles(dist) {
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) files.push(p);
    }
  })(dist);
  return files.sort();
}

const relRx = /\brel\s*=\s*("([^"]*)"|'([^']*)')/i;
const relTokens = (attrs) => {
  const m = attrs.match(relRx);
  return ((m && (m[2] ?? m[3])) || '').toLowerCase().split(/\s+/).filter(Boolean);
};
const attr = (attrs, name) => {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3]) : null;
};

export function checkLinks(dist, cfg, { expectAffiliate = null } = {}) {
  const own = new Set(cfg.own_hosts);
  const citations = new Set(cfg.citation_hosts);
  const aff = cfg.affiliate;
  const affHosts = new Set(aff.hosts);
  const imageHosts = new Set(cfg.image_hosts ?? []);
  const pathRe = new RegExp(aff.path_pattern);
  const tagRe = new RegExp(aff.tag_pattern);
  const tagRx = /<(a|link|script|img|iframe|source|form|area)\b([^>]*)>/gi;
  const attrRx = /\b(href|src|action|srcset)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  const files = htmlFiles(dist);
  const failures = [];
  const counts = { files: files.length, external: 0, citation: 0, affiliate: 0 };
  const hosts = {};
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(dist, file);
    for (const m of html.matchAll(tagRx)) {
      const [, tag, attrs] = m;
      const rt = relTokens(attrs);
      for (const a of attrs.matchAll(attrRx)) {
        const raw = (a[3] ?? a[4] ?? '').trim();
        const values = a[1].toLowerCase() === 'srcset' ? raw.split(',').map((s) => s.trim().split(/\s+/)[0]) : [raw];
        for (const v of values) {
          if (!/^(https?:)?\/\//i.test(v)) continue;
          let url;
          try {
            url = new URL(v.startsWith('//') ? `https:${v}` : v);
          } catch {
            failures.push({ file: rel, url: redactTag(v), reason: 'unparseable URL' });
            continue;
          }
          if (own.has(url.hostname)) continue;
          counts.external++;
          hosts[url.hostname] = (hosts[url.hostname] ?? 0) + 1;
          if (citations.has(url.hostname)) {
            counts.citation++;
            if (url.protocol !== 'https:') failures.push({ file: rel, url: v, reason: 'citation link is not https' });
            continue;
          }
          if (imageHosts.has(url.hostname)) {
            const problems = [];
            if (url.protocol !== 'https:') problems.push('image is not https');
            if (!['img', 'source'].includes(tag.toLowerCase())) problems.push(`image host in <${tag}>`);
            if (url.hostname !== 'm.media-amazon.com') problems.push('image host must be m.media-amazon.com');
            if (problems.length) failures.push({ file: rel, url: redactTag(v), reason: problems.join('; ') });
            continue;
          }
          if (affHosts.has(url.hostname)) {
            counts.affiliate++;
            const problems = [];
            if (url.protocol !== 'https:') problems.push('not https');
            if (tag.toLowerCase() !== 'a') problems.push(`affiliate URL in <${tag}>`);
            if (!pathRe.test(url.pathname)) problems.push(`path ${url.pathname} is not /dp/<ASIN>`);
            for (const q of aff.required_query) if (!url.searchParams.get(q)) problems.push(`missing ?${q}=`);
            const t = url.searchParams.get('tag');
            if (t && !tagRe.test(t)) problems.push('malformed tag');
            if ([...url.searchParams.keys()].some((k) => !aff.required_query.includes(k))) problems.push('unexpected query parameters');
            for (const r of aff.required_rel) if (!rt.includes(r)) problems.push(`rel missing "${r}"`);
            if (problems.length) failures.push({ file: rel, url: redactTag(v), reason: problems.join('; ') });
            continue;
          }
          failures.push({ file: rel, url: redactTag(v), reason: `host ${url.hostname} is not allowlisted` });
        }
      }
    }
  }
  if (expectAffiliate != null && counts.affiliate !== expectAffiliate) {
    failures.push({ file: '*', url: '-', reason: `expected ${expectAffiliate} affiliate links, found ${counts.affiliate}` });
  }
  return { dist, ...counts, hosts, failures };
}

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&amp;/g, '&');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const isCard = (tag, attrs) => tag === 'article' || /\b(card|pcard|cta)\b/.test(attr(attrs, 'class') ?? '');

/** Ad badges whose card has no sponsored link. */
export function orphanAdBadges(html) {
  const body = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  const stack = [];
  const orphans = [];
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, close, rawTag, attrs, selfClose] = m;
    const tag = rawTag.toLowerCase();
    if (close) {
      const i = stack.map((e) => e.tag).lastIndexOf(tag);
      if (i < 0) continue;
      for (const el of stack.splice(i)) {
        if (el.card && el.badges > 0 && !el.sponsored) orphans.push(el.label);
      }
      continue;
    }
    const cls = attr(attrs, 'class') ?? '';
    const el = { tag, card: isCard(tag, attrs), badges: 0, sponsored: false, label: `<${tag}${cls ? ` class="${cls}"` : ''}>` };
    if (/\bbadge--ad\b/.test(cls) && !/\bdata-badge-legend\b/.test(attrs)) {
      const card = [...stack].reverse().find((e) => e.card);
      if (card) card.badges++;
      else orphans.push(`Ad badge outside any card near <${tag}>`);
    }
    if (tag === 'a' && attr(attrs, 'href') && relTokens(attrs).includes('sponsored')) for (const e of stack) e.sponsored = true;
    if (!VOID.has(tag) && !selfClose) stack.push(el);
  }
  for (const el of stack) if (el.card && el.badges > 0 && !el.sponsored) orphans.push(el.label);
  return orphans;
}


/** Hosts that production HTML must stay indexable on. */
export const CANONICAL_HOSTS = ['uksurvivalkits.uk', 'www.uksurvivalkits.uk'];
/** Production Cloudflare Pages alias that must be noindexed. */
export const PAGES_DEV_ALIAS = 'uksurvivalkits.pages.dev';

/**
 * Parse a Cloudflare Pages `_headers` file into `{ pattern, headers }[]` rules.
 * Comments and blank lines are ignored. Header lines must be indented.
 */
export function parseHeadersFile(text) {
  const rules = [];
  let pattern = null;
  let headers = [];
  const flush = () => {
    if (pattern && headers.length) rules.push({ pattern, headers });
    pattern = null;
    headers = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      flush();
      pattern = raw.trim();
      continue;
    }
    const m = raw.trim().match(/^([^:]+):\s*(.*)$/);
    if (m && pattern) headers.push({ name: m[1], value: m[2] });
  }
  flush();
  return rules;
}

/**
 * Match a Pages `_headers` URL pattern against a request URL.
 * Path-only patterns match any host. Placeholders (`:name`) match one host or
 * path segment (host segments stop at `.` or `/`). A single splat (`*`) matches
 * the remainder. Protocol and port are ignored, per Pages docs.
 */
export function headersPatternMatches(pattern, url) {
  const u = new URL(url);
  const request = pattern.startsWith('/') ? u.pathname : `https://${u.hostname}${u.pathname}`;
  let i = 0;
  let re = '^';
  const slashesIn = (s) => (s.match(/\//g) || []).length;
  while (i < pattern.length) {
    if (pattern[i] === '*') {
      re += '.*';
      i += 1;
      continue;
    }
    if (pattern[i] === ':' && i + 1 < pattern.length && /[A-Za-z]/.test(pattern[i + 1])) {
      const m = pattern.slice(i).match(/^:([A-Za-z]\w*)/);
      const inHost = pattern.startsWith('https://') && slashesIn(pattern.slice(0, i)) < 3;
      re += inHost ? '[^./]+' : '[^/]+';
      i += m[0].length;
      continue;
    }
    re += pattern[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    i += 1;
  }
  re += '$';
  return new RegExp(re).test(request);
}

function noindexRules(rules) {
  return rules.filter((r) => r.headers.some((h) => /^X-Robots-Tag$/i.test(h.name) && /noindex/i.test(h.value)));
}

function headersNoindexApplies(rules, url) {
  return noindexRules(rules).some((r) => headersPatternMatches(r.pattern, url));
}


const APEX_ORIGIN = 'https://uksurvivalkits.uk';

function listedUrls(html, kind) {
  if (kind === 'canonical') {
    return [...html.matchAll(/<link\b[^>]*>/gi)]
      .filter((m) => /\brel\s*=\s*["']canonical["']/i.test(m[0]))
      .map((m) => attr(m[0], 'href') ?? '');
  }
  if (kind === 'og:url') {
    return [...html.matchAll(/<meta\b[^>]*>/gi)]
      .filter((m) => /\bproperty\s*=\s*["']og:url["']/i.test(m[0]))
      .map((m) => attr(m[0], 'content') ?? '');
  }
  return [...html.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1].trim());
}

function assertApexUrl(file, field, url, failures) {
  if (!url) return;
  if (!url.startsWith(`${APEX_ORIGIN}/`) && url !== APEX_ORIGIN && url !== `${APEX_ORIGIN}/`) {
    failures.push({ file, reason: `${field} "${url}" is not on the apex host ${APEX_ORIGIN}` });
    return;
  }
  if (/www\.uksurvivalkits\.uk/i.test(url) || /pages\.dev/i.test(url)) {
    failures.push({ file, reason: `${field} "${url}" must not contain www.uksurvivalkits.uk or pages.dev` });
  }
}

export function checkContent(dist, { production = false, banned = DEFAULT_BANNED } = {}) {
  const files = htmlFiles(dist);
  const failures = [];
  const hits = Object.fromEntries(banned.map((b) => [b, 0]));
  let adBadges = 0;
  for (const file of files) {
    const rel = path.relative(dist, file);
    const html = fs.readFileSync(file, 'utf8');
    const text = decode(html).toLowerCase();
    for (const b of banned) {
      const re = new RegExp(`(^|[^a-z0-9])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'g');
      const n = (text.match(re) || []).length;
      if (n) {
        hits[b] += n;
        failures.push({ file: rel, reason: `banned string "${b}" ×${n}` });
      }
    }
    adBadges += (html.match(/\bbadge--ad\b/g) || []).length;
    for (const o of orphanAdBadges(html)) failures.push({ file: rel, reason: `Ad badge with no sponsored link in the same card: ${o}` });
    const robots = [...html.matchAll(/<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*>/gi)].map((m) => attr(m[0], 'content') ?? '');
    if (robots.length !== 1) failures.push({ file: rel, reason: `expected exactly 1 robots meta, found ${robots.length}` });
    if (production && rel !== '404.html' && robots.some((c) => /noindex/i.test(c))) failures.push({ file: rel, reason: 'production page is noindex' });
  }
  const site = {};
  if (production) {
    const robotsTxt = path.join(dist, 'robots.txt');
    if (!fs.existsSync(robotsTxt)) failures.push({ file: 'robots.txt', reason: 'missing' });
    else {
      const t = fs.readFileSync(robotsTxt, 'utf8');
      site.robotsTxt = t.trim().split('\n').join(' | ');
      if (!/^\s*Allow:\s*\/\s*$/im.test(t)) failures.push({ file: 'robots.txt', reason: 'does not contain "Allow: /"' });
      if (/^\s*Disallow:\s*\/\s*$/im.test(t)) failures.push({ file: 'robots.txt', reason: 'contains "Disallow: /"' });
    }
    const headers = path.join(dist, '_headers');
    if (!fs.existsSync(headers)) {
      failures.push({ file: '_headers', reason: 'missing' });
    } else {
      const rules = parseHeadersFile(fs.readFileSync(headers, 'utf8'));
      for (const r of noindexRules(rules)) {
        if (!/^https:\/\/[^/]*\.pages\.dev\//.test(r.pattern)) {
          failures.push({ file: '_headers', reason: `X-Robots-Tag noindex applies to "${r.pattern}", which can match the production host` });
        }
      }
      const mustNoindex = [
        `https://${PAGES_DEV_ALIAS}/`,
        `https://${PAGES_DEV_ALIAS}/scenarios/leave-home-bag/`,
        `https://preview-sha.${PAGES_DEV_ALIAS}/`,
        `https://preview-sha.${PAGES_DEV_ALIAS}/scenarios/leave-home-bag/`,
      ];
      for (const url of mustNoindex) {
        if (!headersNoindexApplies(rules, url)) {
          failures.push({ file: '_headers', reason: `X-Robots-Tag noindex does not apply to ${url}` });
        }
      }
      for (const host of CANONICAL_HOSTS) {
        for (const pathName of ['/', '/scenarios/leave-home-bag/']) {
          const url = `https://${host}${pathName}`;
          if (headersNoindexApplies(rules, url)) {
            failures.push({ file: '_headers', reason: `X-Robots-Tag noindex must not apply to ${url}` });
          }
        }
      }
    }
    for (const file of files) {
      const rel = path.relative(dist, file);
      const html = fs.readFileSync(file, 'utf8');
      for (const url of listedUrls(html, 'canonical')) assertApexUrl(rel, 'canonical', url, failures);
      for (const url of listedUrls(html, 'og:url')) assertApexUrl(rel, 'og:url', url, failures);
    }
    if (fs.existsSync(dist)) {
      for (const name of fs.readdirSync(dist)) {
        if (!/^sitemap.*\.xml$/i.test(name)) continue;
        const xml = fs.readFileSync(path.join(dist, name), 'utf8');
        for (const url of listedUrls(xml, 'sitemap')) assertApexUrl(name, 'sitemap loc', url, failures);
      }
    }
  }
  return { dist, files: files.length, production, adBadges, hits, site, failures };
}
