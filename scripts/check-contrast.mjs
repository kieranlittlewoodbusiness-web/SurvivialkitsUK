#!/usr/bin/env node
/**
 * WCAG 2.x contrast check for src/styles/tokens.css, light and dark token sets.
 * Text pairs need 4.5:1; focus ring and control borders need 3:1 (WCAG 1.4.11).
 * Usage: node scripts/check-contrast.mjs [--md out.md]
 */
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const block = (name) => {
  const m = css.match(new RegExp(`/\\* @tokens ${name} \\*/([\\s\\S]*?)/\\* @end \\*/`));
  if (!m) throw new Error(`token block ${name} not found`);
  return Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, k, v]) => [k, v]));
};
const light = block('light');
const themes = { light, dark: { ...light, ...block('dark') } };
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (h) => { const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const pairs = [
  ['ink', 'canvas', 'Body and headings on page', 4.5],
  ['ink', 'surface', 'Text on cards', 4.5],
  ['ink', 'surface-2', 'Text on chips / sunken', 4.5],
  ['ink-2', 'canvas', 'Secondary text on page', 4.5],
  ['ink-2', 'surface', 'Secondary text on cards', 4.5],
  ['ink-2', 'surface-2', 'Chip and badge text', 4.5],
  ['ink-3', 'canvas', 'Meta on page', 4.5],
  ['ink-3', 'surface', 'Meta on cards', 4.5],
  ['accent', 'canvas', 'Links and kickers on page', 4.5],
  ['accent', 'surface', 'Links and kickers on cards', 4.5],
  ['accent', 'accent-soft', 'Icon tiles, active nav', 4.5],
  ['on-accent', 'accent', 'Primary button label', 4.5],
  ['on-accent', 'accent-hover', 'Primary button hover', 4.5],
  ['canvas', 'ink', 'Step numbers, skip link', 4.5],
  ['on-band', 'band', 'Hero / footer text', 4.5],
  ['on-band-2', 'band', 'Hero / footer secondary', 4.5],
  ['band-accent', 'band', 'Kicker on dark band', 4.5],
  ['band', 'on-band', 'Light button on band', 4.5],
  ['success', 'success-soft', 'Badge / price panel', 4.5],
  ['success', 'surface', 'Price figure on card', 4.5],
  ['warning', 'warning-soft', 'Warning badge', 4.5],
  ['error', 'error-soft', 'Error badge', 4.5],
  ['info', 'info-soft', 'Info badge', 4.5],
  ['ink', 'info-soft', 'Text in info notice', 4.5],
  ['ink', 'warning-soft', 'Text in disclosure notice', 4.5],
  ['ad', 'ad-soft', 'Ad label', 4.5],
  ['line-strong', 'surface', 'Secondary button border (1.4.11)', 3],
  ['line-strong', 'canvas', 'Secondary button border on page (1.4.11)', 3],
  ['focus', 'canvas', 'Focus ring on page (1.4.11)', 3],
  ['focus', 'surface', 'Focus ring on card (1.4.11)', 3],
];
let fails = 0;
let md = '';
for (const [name, t] of Object.entries(themes)) {
  md += `\n### ${name}\n\n| Foreground | Background | Use | Ratio | Needs | Result |\n|---|---|---|---|---|---|\n`;
  for (const [f, b, use, min] of pairs) {
    if (!t[f] || !t[b]) throw new Error(`missing token ${f} or ${b} in ${name}`);
    const r = ratio(t[f], t[b]);
    const ok = r >= min;
    if (!ok) fails++;
    md += `| --${f} ${t[f]} | --${b} ${t[b]} | ${use} | ${r.toFixed(2)}:1 | ${min}:1 | ${ok ? 'PASS' : 'FAIL'} |\n`;
  }
}
const i = process.argv.indexOf('--md');
if (i > 0) fs.writeFileSync(process.argv[i + 1], md);
console.log(md);
console.log(`${pairs.length * 2} pairs checked (light + dark), ${fails} failures`);
process.exit(fails ? 1 : 0);
