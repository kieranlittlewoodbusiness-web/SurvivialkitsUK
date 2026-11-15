export const BRAND = 'UK Survival Kit Brief';
export const tile = (fill = 'var(--accent)', stroke = '#fff') => `<svg class="wordmark__tile" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="9" fill="${fill}"/><path d="M12 12v-1.5a4 4 0 0 1 8 0V12" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/><rect x="7.5" y="12" width="17" height="13" rx="3.5" fill="none" stroke="${stroke}" stroke-width="2"/><path d="m12.3 18.6 2.6 2.6 4.8-5" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const wordmark = (band = false) => `<a class="wordmark${band ? ' wordmark--band' : ''}" href="#top">${band ? tile('var(--band-accent)', 'var(--band)') : tile()}<span class="wordmark__text">UK Survival Kit <b>Brief</b></span></a>`;
const arrow = `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const ARROW = arrow;
export const head = (title, desc) => `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="robots" content="noindex, nofollow">
<meta property="og:site_name" content="${BRAND}">
<link rel="preload" href="fonts/schibsted-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="design.css">
</head>`;
export const header = (current = '') => {
  const items = [['Start here', 'start'], ['Scenarios', 'scen'], ['Checklist', 'check'], ['Compare kits', 'compare'], ['Gear criteria', 'gear'], ['Method', 'method']];
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header" id="top">
  <div class="wrap site-header__bar">
    ${wordmark()}
    <nav class="nav-desktop" aria-label="Main">
      <ul>${items.map(([t, k]) => `<li><a href="#"${k === current ? ' aria-current="page"' : ''}>${t}</a></li>`).join('')}</ul>
    </nav>
    <a class="btn btn--primary header-cta" href="#">Compare 72-hour kits</a>
    <button class="btn btn--secondary menu-btn" type="button" aria-expanded="false" aria-controls="menu">Menu</button>
  </div>
</header>`;
};
export const topicRail = (on = '') => {
  const t = ['Power cuts', 'Flooding', 'Water supply', 'Severe weather', 'Leave-home bag', 'Winter travel', 'Neighbours'];
  return `<nav aria-label="Topics"><ul class="topic-rail">${t.map((x) => `<li><a class="chip${x === on ? ' chip--on' : ''}" href="#"${x === on ? ' aria-current="true"' : ''}>${x}</a></li>`).join('')}</ul></nav>`;
};
export const footer = `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="stack">
        ${wordmark(true)}
        <p>Independent UK household readiness guides. Start with what you already own; fill gaps gradually.</p>
        <p><a href="#">Affiliate disclosure</a> · <a href="#">Editorial policy</a> · <a href="#">Privacy</a></p>
      </div>
      <div>
        <h2>Useful numbers</h2>
        <ul>
          <li><span>Emergency services: 999</span></li>
          <li><span>NHS (non-emergency): 111</span></li>
          <li><span>Power cut (GB): 105</span></li>
          <li><span>Floodline: 0345 988 1188</span></li>
        </ul>
      </div>
      <div>
        <h2>Official guidance</h2>
        <ul>
          <li><a href="#">Prepare (GOV.UK)</a></li>
          <li><a href="#">Ready Scotland</a></li>
          <li><a href="#">All sources we cite</a></li>
          <li><a href="#">Contact</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-base">
      <p>Some pages may contain advertising. Where we use affiliate links, they are labelled <span class="badge badge--ad">Ad</span> before you engage with them. See our <a href="#">affiliate disclosure</a>.</p>
      <p>© 2026 ${BRAND}. Design-direction mock for S1-7: placeholder content, not for publication.</p>
    </div>
  </div>
</footer>`;
