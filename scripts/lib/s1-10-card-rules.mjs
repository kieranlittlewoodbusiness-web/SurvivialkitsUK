/**
 * S1-10 rule-based checks over built compare-page HTML, plus S1-11 homepage top-pick rules. Counts are passed in from the
 * data / verifiedSet; this file never hard-codes 9 or 30.
 */
import fs from 'node:fs';
import path from 'node:path';

export const DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';
export const STANDARDS_RE = /\bBS\s?\d|\bEN\s?\d|ISO\s?\d/i;
export const AFFILIATE_RE = /^https:\/\/www\.amazon\.co\.uk\/dp\/[A-Z0-9]{10}\?tag=[A-Za-z0-9][A-Za-z0-9-]{0,60}-21$/;
const MEASUREMENT_TOKEN = /^\d+(?:[.,]\d+)*(?:mAh|Ah|Wh|W|kW|V|ml|cl|L|m|cm|mm|mm²|kg|g|lm|A|x)$/i;
const COUNT_TOKEN = /^\d+-(?:pack|piece|person|litre|metre|year)s?$/i;

const attr = (attrs, name) => {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3]) : null;
};

export function visibleText(html) {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/\s(?:href|src|srcset|action)="[^"]*"/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&apos;|&lsquo;|&rsquo;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function modelNumberTokens(text) {
  const flagged = [];
  for (const raw of text.split(/\s+/)) {
    const t = raw.replace(/^[("'[]+|[)"'\],.;:!?]+$/g, '');
    if (!t) continue;
    if (/[A-Za-z]/.test(t) && /\d/.test(t) && !MEASUREMENT_TOKEN.test(t) && !COUNT_TOKEN.test(t)) flagged.push(t);
    else if (/^\d{5,}$/.test(t)) flagged.push(t);
  }
  return flagged;
}

export function extractCards(html) {
  const cards = [];
  const re = /<article\b([^>]*)class="[^"]*\bpcard\b[^"]*"([^>]*)>([\s\S]*?)<\/article>/gi;
  for (const m of html.matchAll(re)) {
    const attrs = `${m[1]} ${m[2]}`;
    cards.push({
      id: attr(attrs, 'id'),
      category: attr(attrs, 'data-category'),
      html: m[0],
      text: visibleText(m[0]),
    });
  }
  return cards;
}

export function extractSections(html) {
  const sections = [];
  const re = /<section\b([^>]*)class="[^"]*\bcat-section\b[^"]*"([^>]*)>([\s\S]*?)<\/section>/gi;
  for (const m of html.matchAll(re)) {
    const attrs = `${m[1]} ${m[2]}`;
    const inner = m[0];
    const cards = extractCards(inner);
    sections.push({
      category: attr(attrs, 'data-category'),
      id: attr(attrs, 'id'),
      cards,
    });
  }
  return sections;
}

function relTokens(tagHtml) {
  const m = tagHtml.match(/\brel\s*=\s*("([^"]*)"|'([^']*)')/i);
  return ((m && (m[2] ?? m[3])) || '').toLowerCase().split(/\s+/).filter(Boolean);
}

export function extractCtAs(html) {
  const links = [];
  const re = /<a\b([^>]*\bdata-affiliate="amazon"[^>]*)>/gi;
  for (const m of html.matchAll(re)) {
    const attrs = m[1];
    links.push({
      href: attr(attrs, 'href'),
      rel: relTokens(`<a ${attrs}>`),
    });
  }
  return links;
}

/**
 * @param {string} html compare page HTML
 * @param {{ expectedButtons: number, expectedCategories: string[], maxPerCategory?: number }} opts
 */
export function checkComparePage(html, opts) {
  const failures = [];
  const maxPer = opts.maxPerCategory ?? 3;
  const sections = extractSections(html);
  const cards = extractCards(html);
  const ctas = extractCtAs(html);
  const present = sections.map((s) => s.category).filter(Boolean);

  if (ctas.length !== opts.expectedButtons) {
    failures.push(`expected ${opts.expectedButtons} affiliate buttons (derived), found ${ctas.length}`);
  }
  for (const cta of ctas) {
    if (!cta.href || !AFFILIATE_RE.test(cta.href)) failures.push('CTA is not the tagged amazon.co.uk/dp shape');
    if (!cta.rel.includes('sponsored') || !cta.rel.includes('nofollow')) failures.push('CTA rel missing sponsored nofollow');
  }

  for (const s of sections) {
    if (s.cards.length === 0) failures.push(`empty category section rendered: ${s.category || s.id}`);
    if (s.cards.length > maxPer) failures.push(`category ${s.category} has ${s.cards.length} cards (cap is ${maxPer})`);
  }
  if (opts.expectedCategories) {
    const expected = new Set(opts.expectedCategories);
    for (const cat of present) {
      if (!expected.has(cat)) failures.push(`unexpected category section: ${cat}`);
    }
    for (const cat of expected) {
      if (!present.includes(cat)) failures.push(`missing category section: ${cat}`);
    }
  }

  for (const card of cards) {
    if (STANDARDS_RE.test(card.text)) failures.push(`card ${card.id} visible text contains a standards code`);
    const models = modelNumberTokens(card.text);
    if (models.length) failures.push(`card ${card.id} visible text contains model/SKU-like token "${models[0]}"`);
    if (/size_child_of/i.test(card.text) || /size_child_of/i.test(card.html)) {
      failures.push(`card ${card.id} mentions size_child_of`);
    }
  }

  const priceBlocks = (html.match(/class="pcard__amount"/g) || []).length;
  if (opts.allowPrices !== true && priceBlocks > 0) {
    failures.push(`found ${priceBlocks} rendered price(s) but no price passed the 24h rule`);
  }

  const disclosureCount = html.split(DISCLOSURE).length - 1;
  if (disclosureCount !== 1) failures.push(`expected exactly 1 disclosure line, found ${disclosureCount}`);
  const footerHas = /<footer\b[\s\S]*data-testid="amazon-disclosure"[\s\S]*?<\/footer>/i.test(html) && html.includes(DISCLOSURE);
  if (!footerHas) failures.push('disclosure line is not in the footer');
  for (const card of cards) {
    if (card.text.includes(DISCLOSURE)) failures.push(`card ${card.id} repeats the disclosure`);
  }

  if (opts.expectNoImages) {
    if ((html.match(/class="pcard__img/g) || []).length > 0) {
      failures.push('rendered a product image or image frame when image_url is null');
    }
    if (cards.some((c) => /<img\b/i.test(c.html))) {
      failures.push('product card contains an <img> when image_url is null');
    }
  }

  return { failures, sections, cards, ctas, disclosureCount };
}

/* ---------- S1-11 homepage: top pick per category ---------- */

export const COMPARE_PATH = '/compare/72-hour-emergency-kits/';

export function extractPicks(html) {
  const picks = [];
  const re = /<article\b([^>]*)class="[^"]*\bpick\b[^"]*"([^>]*)>([\s\S]*?)<\/article>/gi;
  for (const m of html.matchAll(re)) {
    const attrs = `${m[1]} ${m[2]}`;
    const catLink = m[0].match(/<a\b[^>]*class="[^"]*\bpick__cat\b[^"]*"[^>]*>/i);
    picks.push({
      category: attr(attrs, 'data-category'),
      html: m[0],
      text: visibleText(m[0]),
      catHref: catLink ? attr(catLink[0], 'href') : null,
      ctas: extractCtAs(m[0]),
      adBadges: (m[0].match(/\bbadge--ad\b/g) || []).length,
    });
  }
  return picks;
}

/**
 * Homepage rules (S1-11): one top pick per compare-page category, each linking to that category's
 * anchor on the compare page, with exactly one tagged sponsored Amazon button and one Ad label when
 * buttons are expected. Plus the brand CTA, image loading rules and the single footer disclosure.
 * @param {string} html homepage HTML
 * @param {{ expectedButtons: number, expectedCategories: string[], compareHtml?: string }} opts
 */
export function checkHomePage(html, opts) {
  const failures = [];
  const picks = extractPicks(html);
  const ctas = extractCtAs(html);
  if (ctas.length !== opts.expectedButtons) {
    failures.push(`expected ${opts.expectedButtons} homepage affiliate buttons (derived), found ${ctas.length}`);
  }
  for (const cta of ctas) {
    if (!cta.href || !AFFILIATE_RE.test(cta.href)) failures.push('homepage CTA is not the tagged amazon.co.uk/dp shape');
    if (!cta.rel.includes('sponsored') || !cta.rel.includes('nofollow')) failures.push('homepage CTA rel missing sponsored nofollow');
  }
  const cats = picks.map((p) => p.category);
  if (new Set(cats).size !== cats.length) failures.push('a category has more than one homepage top pick');
  const expected = new Set(opts.expectedCategories);
  for (const c of cats) if (!expected.has(c)) failures.push(`unexpected homepage pick category: ${c}`);
  for (const c of expected) if (!cats.includes(c)) failures.push(`missing homepage pick for category: ${c}`);
  const anchors = opts.compareHtml ? new Set([...opts.compareHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])) : null;
  for (const p of picks) {
    if (!p.catHref || !p.catHref.startsWith(`${COMPARE_PATH}#`)) failures.push(`pick ${p.category} does not link to a compare-page category anchor`);
    else if (anchors && !anchors.has(p.catHref.split('#')[1])) failures.push(`pick ${p.category} links to missing anchor ${p.catHref}`);
    if (p.ctas.length > 1) failures.push(`pick ${p.category} has ${p.ctas.length} buttons`);
    if (p.ctas.length !== p.adBadges) failures.push(`pick ${p.category} has ${p.ctas.length} buttons but ${p.adBadges} Ad labels`);
    if (STANDARDS_RE.test(p.text)) failures.push(`pick ${p.category} visible text contains a standards code`);
    const models = modelNumberTokens(p.text);
    if (models.length) failures.push(`pick ${p.category} visible text contains model/SKU-like token "${models[0]}"`);
    if (p.text.includes(DISCLOSURE)) failures.push(`pick ${p.category} repeats the disclosure`);
  }
  if ((html.match(/class="pcard__amount"/g) || []).length > 0 || /£\s?\d/.test(picks.map((p) => p.text).join(' '))) {
    failures.push('homepage shows a price');
  }
  const disclosureCount = html.split(DISCLOSURE).length - 1;
  if (disclosureCount !== 1) failures.push(`expected exactly 1 disclosure line on the homepage, found ${disclosureCount}`);
  // Brand CTA: Kieran's wording, Amber CTA class, to the compare page.
  const heroCta = [...html.matchAll(/<a\b([^>]*\bdata-cta="get-prepared"[^>]*)>([\s\S]*?)<\/a>/gi)];
  if (!heroCta.some((m) => /\bbtn--cta\b/.test(m[1]) && attr(m[1], 'href') === COMPARE_PATH && visibleText(m[2]) === 'Get prepared here')) {
    failures.push('no Amber "Get prepared here" CTA to the compare page');
  }
  if (/>\s*Compare kits\s*</i.test(html)) failures.push('"Compare kits" CTA text found (Kieran\'s wording is "Get prepared here")');
  // Images: explicit size; the hero is eager + fetchpriority=high; every other content image is lazy.
  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    const a = m[1];
    const src = attr(a, 'src') ?? '';
    if (!attr(a, 'width') || !attr(a, 'height')) failures.push(`img ${src} has no explicit width/height`);
    if (/^https?:/i.test(src)) failures.push(`img ${src} is not a local image`);
    const isHero = /\bhero__img\b/.test(attr(a, 'class') ?? '');
    const isLogo = /\bwordmark__img\b/.test(attr(a, 'class') ?? '');
    if (isHero) {
      if (attr(a, 'fetchpriority') !== 'high') failures.push('hero image lacks fetchpriority="high"');
      if (attr(a, 'loading') === 'lazy') failures.push('hero image is lazy-loaded');
    } else if (!isLogo && attr(a, 'loading') !== 'lazy') {
      failures.push(`img ${src} is not lazy-loaded`);
    }
    if (attr(a, 'alt') === null) failures.push(`img ${src} has no alt attribute`);
  }
  return { failures, picks, ctas, disclosureCount };
}

export function readHomeHtml(distDir) {
  return fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
}

export function readCompareHtml(distDir) {
  const file = path.join(distDir, 'compare/72-hour-emergency-kits/index.html');
  return fs.readFileSync(file, 'utf8');
}
