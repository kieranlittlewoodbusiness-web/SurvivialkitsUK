/**
 * S1-10 rule-based checks over built compare-page HTML. Counts are passed in from the
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

export function readCompareHtml(distDir) {
  const file = path.join(distDir, 'compare/72-hour-emergency-kits/index.html');
  return fs.readFileSync(file, 'utf8');
}
