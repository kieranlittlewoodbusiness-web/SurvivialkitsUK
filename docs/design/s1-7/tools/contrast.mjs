// WCAG 2.x relative-luminance contrast for every text/background pair used in the mocks.
import fs from 'node:fs';
const hex = (h) => { h = h.replace('#',''); return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)/255); };
const lin = (c) => c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4;
const L = (h) => { const [r,g,b] = hex(h).map(lin); return 0.2126*r+0.7152*g+0.0722*b; };
const ratio = (a,b) => { const [x,y] = [L(a),L(b)].sort((m,n)=>n-m); return (x+0.05)/(y+0.05); };
const css = fs.readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
function block(sel){ const m = css.match(new RegExp(sel.replace(/[[\]()*.]/g,'\\$&')+'\\s*\\{([^}]*)\\}')); const o={}; for (const [,k,v] of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) o[k]=v; return o; }
const themes = {
  'light (accent A green)': block(':root'),
  'light (accent B amber)': { ...block(':root'), ...block('[data-accent="b"]') },
  'dark (optional)': { ...block(':root'), ...block('[data-theme="dark"]') },
};
// [text token, background token, usage, minimum]
const pairs = [
  ['ink','canvas','Body and headlines on page canvas',4.5],
  ['ink','surface','Body and headlines on cards',4.5],
  ['ink','surface-2','Text on sunken band / chips',4.5],
  ['ink-2','canvas','Standfirst / secondary text on canvas',4.5],
  ['ink-2','surface','Standfirst / secondary text on cards',4.5],
  ['ink-2','surface-2','Secondary text on sunken band',4.5],
  ['ink-3','surface','Meta (dates, last checked) on cards',4.5],
  ['ink-3','canvas','Meta on canvas',4.5],
  ['accent','surface','Links, kickers on cards',4.5],
  ['accent','canvas','Links, kickers on canvas',4.5],
  ['accent','accent-soft','Accent chip text',4.5],
  ['on-accent','accent','Primary button label',4.5],
  ['on-accent','accent-hover','Primary button label (hover)',4.5],
  ['on-band','band','Text on dark hero/feature band',4.5],
  ['on-band-2','band','Secondary text on dark band',4.5],
  ['band-accent','band','Kicker on dark band',4.5],
  ['success','success-soft','Badge: Verified / best verified price',4.5],
  ['success','surface','Best price figure on card',4.5],
  ['warning','warning-soft','Badge: Price not verified / delivery unknown / model unconfirmed',4.5],
  ['error','error-soft','Badge: Price not available / error state',4.5],
  ['info','info-soft','Badge: Price may be out of date (stale) / info callout',4.5],
  ['ad','ad-soft','Ad label',4.5],
  ['ink','warning-soft','Body copy inside disclosure callout',4.5],
  ['ink','info-soft','Body copy inside info callout',4.5],
  ['line-strong','surface','Control / secondary-button border (non-text, 1.4.11)',3],
  ['focus','canvas','Focus ring vs canvas (non-text, 1.4.11)',3],
  ['focus','surface','Focus ring vs card (non-text, 1.4.11)',3],
];
let md = '';
const out = {};
let fails = 0;
for (const [name,t] of Object.entries(themes)) {
  md += `\n#### ${name}\n\n| Text / foreground | Background | Use | Ratio | Needs | Result |\n|---|---|---|---|---|---|\n`;
  out[name] = [];
  for (const [f,b,use,min] of pairs) {
    if (!t[f] || !t[b]) continue;
    const r = ratio(t[f],t[b]);
    const pass = r >= min; if (!pass) fails++;
    const aaa = min===4.5 && r>=7 ? ' (AAA)' : '';
    out[name].push({fg:f,fgHex:t[f],bg:b,bgHex:t[b],use,ratio:+r.toFixed(2),min,pass});
    md += `| \`--${f}\` ${t[f]} | \`--${b}\` ${t[b]} | ${use} | **${r.toFixed(2)}:1** | ${min}:1 | ${pass?'PASS'+aaa:'FAIL'} |\n`;
  }
}
fs.writeFileSync(new URL('../contrast.md', import.meta.url), md);
fs.writeFileSync(new URL('../contrast.json', import.meta.url), JSON.stringify(out,null,2));
console.log(md); console.log('FAILS:', fails);
