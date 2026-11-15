import fs from 'node:fs';
import { BRAND, head, header, topicRail, footer, wordmark, tile, ARROW } from './partials.mjs';
import { kitBest, kitUnverified, kitStale, kitNone, kitUnconfirmed, productAffiliate, productHeld, productNone, categoryGrid, DISCLOSURE_TEXT } from './kits.mjs';
const out = (f, s) => fs.writeFileSync(new URL('../' + f, import.meta.url), s);
const icon = {
  warn: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5 18.5 17h-17L10 2.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 8v4M10 14.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9v5M10 6v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  err: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m7 7 6 6M13 7l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  ok: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m6.5 10.2 2.4 2.4 4.6-4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  box: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="5" width="14" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 9h14" stroke="currentColor" stroke-width="1.8"/></svg>',
};
const story = (art, kicker, title, dek, meta) => `<article class="card story">
  <div class="story__media"><div class="art art--${art}"></div></div>
  <div class="story__body"><p class="kicker">${kicker}</p><h3 class="story__title"><a href="#">${title}</a></h3><p class="price__sub">${dek}</p><p class="meta">${meta}</p></div>
</article>`;
const disclosure = `<aside class="callout callout--disclosure" aria-labelledby="disc-h">
  <span class="callout__icon">${icon.warn}</span>
  <div class="stack-sm">
    <p class="kicker" id="disc-h">Researched from listings, not tested</p>
    <p>Specs come from seller listings read on 14 November 2026. We have not bought, handled or tested these kits.</p>
    <p>Some retailer links on this page are affiliate links, marked <span class="badge badge--ad">Ad</span>. If you buy through one we may earn commission, at no extra cost to you. Commission never changes the order or what we say. <a href="#">Affiliate disclosure</a>.</p>
    <p><span class="disclosure-text">${DISCLOSURE_TEXT}</span></p>
  </div>
</aside>`;

/* ---------------- HOME ---------------- */
const home = `${head(`${BRAND}: calm household readiness for UK homes (S1-7 mock)`, 'Practical household planning for UK power cuts, severe weather, supply disruption and temporary evacuation.')}
<body>
${header('start')}
${topicRail()}
<main id="main" class="wrap">
  <section class="lead" aria-label="Lead story">
    <div class="hero">
      <p class="kicker">Start here</p>
      <h1 style="margin-top:12px">Know what you already own. Fill the gaps calmly.</h1>
      <p class="standfirst" style="margin-top:16px">Practical household planning for UK power cuts, severe weather, supply disruption and temporary evacuation, grounded in official guidance.</p>
      <div class="hero__actions"><a class="btn btn--band btn--lg" href="#">Start here</a><a class="btn btn--band-outline btn--lg" href="#">Open the checklist</a></div>
    </div>
    <aside class="brief-box" aria-labelledby="brief-h">
      <p class="kicker">The short version</p>
      <h2 id="brief-h" style="margin-top:6px">Why it matters</h2>
      <ol>
        <li><p>UK government guidance asks households to plan for a few days of disruption.</p></li>
        <li><p>Most of what you need is already in your cupboards, drawers and car.</p></li>
        <li><p>Water is the gap almost every pre-packed kit leaves open.</p></li>
      </ol>
      <a class="btn btn--ghost" href="#" style="margin-top:12px">How we label evidence ${ARROW}</a>
    </aside>
  </section>

  <section class="section" aria-labelledby="feat-h">
    <div class="feature">
      <div class="feature__media"><div class="art art--kit"></div></div>
      <div class="stack">
        <p class="kicker">New comparison · Updated 14 Nov 2026</p>
        <h2 id="feat-h">Pre-packed 72-hour kits compared</h2>
        <p class="standfirst">Five models from UK sellers, checked against the government's Be Ready list: how much water each one is short, whether it has a radio, and what you would still need to add.</p>
        <div class="feature__chips"><span class="badge badge--warn">Researched from listings, not tested</span><span class="chip chip--static">5 kits</span><span class="chip chip--static">1, 2 and 4 people</span></div>
        <a class="btn btn--primary btn--lg" href="compare-mock.html">Compare 72-hour kits</a>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="cat-h" style="padding-top:0">
    <div class="section__head"><h2 id="cat-h">Browse by category</h2><a href="#">All gear</a></div>
    ${categoryGrid}
  </section>

  <section class="section" aria-labelledby="scen-h" style="padding-top:0">
    <div class="section__head"><h2 id="scen-h">Household scenarios</h2><a href="#">All scenarios</a></div>
    <div class="grid grid--3">
      ${story('power', 'Power cuts', 'Light, warmth and information at home', 'Multi-hour or overnight electricity outage at home.', '6 min read · Updated Nov 2026')}
      ${story('cupboard', 'Food', 'Checking the cupboard first: three days without a speciality shop', 'Stay-home disruption when stores or cooking are limited.', '5 min read · Updated Nov 2026')}
      ${story('weather', 'Severe weather', 'Calm steps when a Met Office warning is out', 'What to do the day before, the night of and the morning after.', '4 min read · Updated Nov 2026')}
      ${story('bag', 'Evacuation', 'A calm leave-home bag', 'Asked to leave home for flooding, gas incident or similar.', '7 min read · Updated Nov 2026')}
      ${story('water', 'Water supply', 'When the taps stop: storing and finding water', 'Supply interruption and boil-water notices.', '5 min read · Updated Nov 2026')}
      ${story('power', 'Neighbours', 'Checking on neighbours and the Priority Services Register', 'Who to tell, and how to sign up for priority support.', '3 min read · Updated Nov 2026')}
    </div>
  </section>

  <section class="section" aria-labelledby="steps-h" style="padding-top:0">
    <div class="section__head"><h2 id="steps-h">72-hour checklist in three steps</h2><a href="#">Open the checklist</a></div>
    <ol class="steps grid grid--3">
      <li><div class="card"><span class="num" aria-hidden="true">1</span><h3>Check what you already own</h3><p class="price__sub" style="margin-top:6px">Cupboards, drawers and the car first.</p></div></li>
      <li><div class="card"><span class="num" aria-hidden="true">2</span><h3>Write it down</h3><p class="price__sub" style="margin-top:6px">Contacts, meeting points and medical notes on paper.</p></div></li>
      <li><div class="card"><span class="num" aria-hidden="true">3</span><h3>Fill gaps gradually</h3><p class="price__sub" style="margin-top:6px">Genuine gaps only, on normal shops.</p></div></li>
    </ol>
  </section>

  <section class="section" aria-labelledby="gear-h" style="padding-top:0">
    <div class="section__head"><h2 id="gear-h">Gear criteria</h2><a href="#">All criteria</a></div>
    <ul class="crit">
      ${[['Torches', 'Comparison criteria for household torches and headlamps.'], ['Power banks', 'Capacity, USB-C, self-discharge and medical-device cautions.'], ['Radios', 'Battery and wind-up criteria, FM reception, power source.'], ['Water storage', 'Food-grade storage: quantity, seals, stackability, hygiene.'], ['First-aid kits', 'First-aid kit criteria for UK readiness, contents and limits.'], ['Winter travel', 'Criteria for a modest UK winter car kit.']].map(([a, b]) => `<li><a href="#"><strong>${a}</strong><span>${b}</span>${ARROW}</a></li>`).join('')}
    </ul>
  </section>

  <aside class="callout callout--info" aria-labelledby="gov-h">
    <span class="callout__icon">${icon.info}</span>
    <div class="stack-sm"><h2 id="gov-h">Official guidance first</h2><p>We separate official advice, desk research, firsthand tests and advertising. See <a href="#">Prepare (GOV.UK)</a>, <a href="#">Ready Scotland</a> and our <a href="#">sources list</a>.</p></div>
  </aside>
</main>
${footer}
</body></html>`;
out('home-mock.html', home);

/* ---------------- COMPARE ---------------- */
const compare = `${head(`72-hour emergency kits for UK homes compared | ${BRAND} (S1-7 mock)`, 'Pre-packed 72-hour kits from UK sellers compared against government guidance.')}
<body>
${header('compare')}
<main id="main" class="wrap">
  <nav aria-label="Breadcrumb"><ol class="crumbs"><li><a href="#">Home</a></li><li><a href="#">Compare</a></li><li aria-current="page">72-hour kits</li></ol></nav>
  <header class="article-head measure" style="max-width:52rem">
    <p class="kicker">Comparison · Updated 14 Nov 2026</p>
    <h1>72-hour emergency kits for UK homes: what they include, and what they leave out</h1>
    <p class="standfirst">Most pre-packed "72-hour" kits are grab bags with survival rations. None of the example kits below includes anything like three days of drinking water.</p>
    <div class="byline"><span class="chip chip--static">5 kits</span><span class="meta">By the ${BRAND} desk · Prices shown are examples in this mock</span></div>
  </header>
  <div class="compare-layout">
    <div class="stack" style="--gap:24px">
      ${disclosure}
      <nav aria-label="Jump to kit"><ul class="topic-rail" style="padding-inline:0">${['All', '1 person', '2 people', '4 people'].map((x, i) => `<li><a class="chip${i === 0 ? ' chip--on' : ''}" href="#"${i === 0 ? ' aria-current="true"' : ''}>${x}</a></li>`).join('')}</ul></nav>
      <section aria-labelledby="kits-h" class="stack">
        <h2 id="kits-h">The kits</h2>
        <div class="kits">${kitBest}${kitUnverified}${kitStale}${kitNone}${kitUnconfirmed}</div>
      </section>
    </div>
    <aside aria-label="On this page">
      <div class="brief-box"><p class="kicker">The short version</p><ol>
        <li><p>Every example kit is short on drinking water: plan 3 L per person per day.</p></li>
        <li><p>Only verified, same-day prices can be called "best".</p></li>
        <li><p>Add medication, cash, documents and written phone numbers yourself.</p></li>
      </ol></div>
      <div class="card" style="padding:24px" ><h2 style="font-size:var(--step-1)">How we compare</h2><p class="price__sub" style="margin-top:8px">We read seller listings, check them against the government's Be Ready list and show when each price was last checked.</p><a class="btn btn--ghost" style="padding-inline:0;margin-top:8px" href="#">Read the method ${ARROW}</a></div>
    </aside>
  </div>
</main>
${footer}
</body></html>`;
out('compare-mock.html', compare);

/* ---------------- COMPONENTS SHEET ---------------- */
const sw = (name, bg, fg, label) => `<div class="swatch"><div class="swatch__chip" style="background:var(--${bg});color:var(--${fg})">${label}</div><div class="swatch__txt"><strong>--${bg}</strong><code>text: --${fg}</code></div></div>`;
const radius = [['--r-xs', '8px'], ['--r-sm', '12px'], ['--r-md', '20px'], ['--r-lg', '28px'], ['--r-pill', 'pill']];
const comps = `${head(`Components and tokens | ${BRAND} S1-7 design direction`, 'S1-7 design direction components sheet.')}
<body>
<a class="skip-link" href="#main">Skip to content</a>
<main id="main" class="wrap" style="padding-block:32px">
  <header class="stack" style="margin-bottom:24px">
    <p class="kicker">S1-7 design direction · for Kieran's approval</p>
    <h1>${BRAND}: components and tokens</h1>
    <p class="standfirst measure">Editorial, news-style layout with rounded cards and controls. Placeholder content only; every price is labelled Example.</p>
  </header>

  <section class="sheet-sec" aria-labelledby="wm-h"><h2 id="wm-h">Wordmark</h2><p class="meta">Rounded tile with a grab-bag-and-tick glyph, plus the name set in Schibsted Grotesk 800 with "Brief" in the accent colour. The tile doubles as favicon and app icon.</p>
    <div class="row-wrap">
      <div class="card" style="padding:16px 20px">${wordmark()}</div>
      <div style="background:var(--band);padding:16px 20px;border-radius:var(--r-md)">${wordmark(true)}</div>
      <div class="card" style="padding:16px" aria-label="Favicon sizes" role="img"><div class="row-wrap">${tile().replace('class="wordmark__tile"', 'width="48" height="48"')}${tile().replace('class="wordmark__tile"', 'width="32" height="32"')}${tile().replace('class="wordmark__tile"', 'width="16" height="16"')}</div></div>
    </div>
  </section>

  <section class="sheet-sec" aria-labelledby="col-h"><h2 id="col-h">Colour</h2><p class="meta">Light theme first. Every text/background pair below passes WCAG AA; ratios are in README contrast table.</p>
    <div class="swatches">
      ${sw('', 'canvas', 'ink', 'Aa canvas')}${sw('', 'surface', 'ink', 'Aa surface')}${sw('', 'surface-2', 'ink-2', 'Aa sunken')}${sw('', 'band', 'on-band', 'Aa band')}
      ${sw('', 'accent', 'on-accent', 'Accent A')}${sw('', 'accent-soft', 'accent', 'Accent soft')}
      ${sw('', 'success-soft', 'success', 'Verified')}${sw('', 'warning-soft', 'warning', 'Not verified')}${sw('', 'error-soft', 'error', 'Not available')}${sw('', 'info-soft', 'info', 'Out of date')}${sw('', 'ad-soft', 'ad', 'Ad')}
    </div>
    <h3 style="margin-top:24px">Accent option B: Beacon amber</h3>
    <div data-accent="b" class="row-wrap" style="margin-top:12px">
      <a class="btn btn--primary" href="#">Compare 72-hour kits</a><span class="kicker">Kicker in amber</span><a class="btn btn--ghost" href="#">Link in amber</a>${wordmark()}
    </div>
  </section>

  <section class="sheet-sec" aria-labelledby="type-h"><h2 id="type-h">Type</h2><p class="meta">Option A (recommended): Schibsted Grotesk only, one variable file, 46 KB latin subset. Option B: Source Serif 4 headlines (adds 50 KB). Fluid scale, 320 to 1280px.</p>
    <div class="grid grid--2">
      <div class="card type-spec" style="padding:24px"><p class="kicker">A · Sans headlines</p>
        <div><span class="meta">--step-5 · 38→64px</span><p style="font:760 var(--step-5)/1.05 var(--font-sans);letter-spacing:-.03em">Fill the gaps</p></div>
        <div><span class="meta">--step-3 · 26→34px</span><p style="font:740 var(--step-3)/1.15 var(--font-sans);letter-spacing:-.02em">Household scenarios</p></div>
        <div><span class="meta">--step-1 · 18→20px standfirst</span><p class="standfirst">Five models from UK sellers, checked against official guidance.</p></div>
        <div><span class="meta">--step-0 · 16→17px body</span><p>Specs come from seller listings. We have not tested these kits.</p></div>
        <div><span class="meta">--step--1 · 13→14px meta</span><p class="meta">Last checked 14 Nov 2026, 09:00 UK time</p></div>
      </div>
      <div class="card type-spec serif-heads" style="padding:24px"><p class="kicker">B · Serif headlines</p>
        <div><span class="meta">--step-5 · Source Serif 4 650</span><p style="font:650 var(--step-5)/1.05 var(--font-serif);letter-spacing:-.02em">Fill the gaps</p></div>
        <div><span class="meta">--step-3</span><p style="font:650 var(--step-3)/1.15 var(--font-serif)">Household scenarios</p></div>
        <div><span class="meta">body stays Schibsted Grotesk</span><p class="standfirst">Five models from UK sellers, checked against official guidance.</p></div>
      </div>
    </div>
  </section>

  <section class="sheet-sec" aria-labelledby="shape-h"><h2 id="shape-h">Shape, space, elevation, focus</h2><p class="meta">Curved edges at four sizes plus pill. 4px spacing base. Hairline border + soft shadow. Focus is a 2px surface gap and 3px blue ring.</p>
    <div class="row-wrap">${radius.map(([k, v]) => `<div class="radius-demo" style="border-radius:${v === 'pill' ? '999px' : v}">${k}<br>${v}</div>`).join('')}</div>
    <div class="space-demo" style="margin-top:24px" aria-label="Spacing scale 4, 8, 12, 16, 24, 32, 48, 64 pixels" role="img">${[4, 8, 12, 16, 24, 32, 48, 64].map((n) => `<div style="width:${n}px;height:${n}px"></div>`).join('')}</div>
    <div class="row-wrap" style="margin-top:24px">
      <div class="card" style="padding:20px;width:200px">--shadow-1 card</div>
      <div class="card" style="padding:20px;width:200px;box-shadow:var(--shadow-2)">--shadow-2 hover</div>
      <a class="btn btn--primary" href="#" style="box-shadow:var(--ring)">Focus ring</a>
      <a class="chip" href="#" style="box-shadow:var(--ring)">Focused chip</a>
    </div>
  </section>

  <section class="sheet-sec" aria-labelledby="ctl-h"><h2 id="ctl-h">Buttons, chips, badges</h2><p class="meta">All interactive targets are at least 44px tall. Price badges keep their S1-2 wording and meaning.</p>
    <div class="row-wrap"><a class="btn btn--primary" href="#">Primary</a><a class="btn btn--secondary" href="#">Secondary</a><a class="btn btn--ghost" href="#">Ghost link ${ARROW}</a><a class="btn btn--primary btn--lg" href="#">Large primary</a></div>
    <div class="row-wrap" style="margin-top:16px"><a class="chip chip--on" href="#" aria-current="true">All</a><a class="chip" href="#">Power cuts</a><a class="chip" href="#">Flooding</a><span class="chip chip--static">2 people</span></div>
    <div class="row-wrap" style="margin-top:16px"><span class="badge badge--ok">Verified</span><span class="badge badge--warn">Price not verified</span><span class="badge badge--warn">Delivery cost not verified</span><span class="badge badge--warn">Delivery cost unknown – not included in total</span><span class="badge badge--warn">Exact model not confirmed</span><span class="badge badge--stale">Price may be out of date</span><span class="badge badge--error">Price not available</span><span class="badge badge--neutral">No retailer link yet</span><span class="badge badge--neutral">Price not shown here</span><span class="badge badge--ad">Ad</span><span class="badge badge--example">Example</span></div>
  </section>

  <section class="sheet-sec" aria-labelledby="nav-h"><h2 id="nav-h">Header and navigation</h2><p class="meta">Mobile: wordmark + Menu pill, swipeable topic chips, menu opens as a rounded sheet. Desktop: segmented pill nav + primary CTA. Sticky with a translucent blur.</p>
    <div class="grid grid--2">
      <div class="mini-phone"><div class="site-header" style="position:static"><div class="site-header__bar" style="padding-inline:16px">${wordmark()}<button class="btn btn--secondary" type="button" aria-expanded="true">Close</button></div></div>
        <div style="padding:12px"><nav class="menu-sheet" aria-label="Mobile menu sample"><ul>${['Start here', 'Scenarios', 'Checklist', 'Compare kits', 'Gear criteria', 'Method'].map((x) => `<li><a href="#">${x}${ARROW.replace('<svg', '<svg width="18"')}</a></li>`).join('')}</ul></nav></div></div>
      <div class="stack"><div class="card" style="padding:8px 16px"><div class="row-wrap" style="justify-content:space-between">${wordmark()}<nav class="nav-desktop" style="display:block" aria-label="Desktop nav sample"><ul><li><a href="#" aria-current="page">Start here</a></li><li><a href="#">Checklist</a></li><li><a href="#">Compare kits</a></li></ul></nav></div></div>
        <div class="card" style="padding:4px 0">${topicRail('Power cuts').replace('aria-label="Topics"', 'aria-label="Topics sample"')}</div></div>
    </div>
  </section>

  <section class="sheet-sec" aria-labelledby="card-h"><h2 id="card-h">Story and guide cards</h2><p class="meta">Guardian-style anatomy: kicker, headline, standfirst, meta. Whole card is clickable via the headline link; CSS-only art, no photos needed.</p>
    <div class="grid grid--3">
      ${story('power', 'Power cuts', 'Light, warmth and information at home', 'Multi-hour or overnight outage.', '6 min read')}
      ${story('water', 'Water supply', 'When the taps stop', 'Supply interruption and boil-water notices.', '5 min read')}
      <div class="stack"><article class="card story story--row"><div class="story__media"><div class="art art--bag"></div></div><div class="story__body"><p class="kicker">Evacuation</p><h3 class="story__title"><a href="#">A calm leave-home bag</a></h3></div></article>
      <article class="card story story--row"><div class="story__media"><div class="art art--weather"></div></div><div class="story__body"><p class="kicker">Severe weather</p><h3 class="story__title"><a href="#">When a warning is out</a></h3></div></article></div>
    </div>
  </section>

  <section class="sheet-sec" aria-labelledby="kit-h"><h2 id="kit-h">Kit comparison card: price states</h2><p class="meta">Renders only what compareVariant/buildComparisons return. Each state shows last checked, the price disclaimer and the source name (as text). Buttons appear only for approved affiliate links, each labelled with the model and retailer and followed by Ad; otherwise no_link_text is shown as plain text.</p>
    <div class="grid grid--3">${kitBest}${kitUnverified}${kitStale}${kitNone}${kitUnconfirmed}
      <article class="kit" aria-label="Loading state sample"><div class="kit__head"><div class="skel" style="height:14px;width:40%"></div><div class="skel" style="height:24px;width:85%"></div><div class="skel" style="height:24px;width:60%"></div></div><div class="price price--none"><div class="skel" style="height:40px;width:50%"></div><div class="skel" style="height:14px;width:90%"></div></div><div class="kit__actions"><div class="skel" style="height:44px;border-radius:999px"></div></div><p class="meta" style="padding:0 24px 24px">Loading state (client-side only; static build normally ships data)</p></article>
    </div>
  </section>

  <section class="sheet-sec" aria-labelledby="pc-h"><h2 id="pc-h">Product cards (S1-8 categories)</h2><p class="meta">Same card shell as kits. Three link states: affiliate link with a per-item label and Ad; held/unverified price with no button; no button and no price, showing no_link_text as plain text. Category icons stand in for product photos.</p>
    <div class="grid grid--3">${productAffiliate}${productHeld}${productNone}</div>
  </section>

  <section class="sheet-sec" aria-labelledby="cg-h"><h2 id="cg-h">Category grid</h2><p class="meta">Seven S1-8 categories. Kits lead as the dark feature tile; the others are equal tiles, 2 across on mobile and 4 on desktop.</p>
    ${categoryGrid}
  </section>

  <section class="sheet-sec" aria-labelledby="call-h"><h2 id="call-h">Callouts: disclosure, info, success, error, empty</h2><p class="meta">Disclosure copy and meaning unchanged.</p>
    <div class="grid grid--2">
      ${disclosure}
      <aside class="callout callout--info"><span class="callout__icon">${icon.info}</span><div class="stack-sm"><h3>Official guidance first</h3><p>Check <a href="#">Prepare (GOV.UK)</a> before buying anything.</p></div></aside>
      <aside class="callout callout--success"><span class="callout__icon">${icon.ok}</span><div class="stack-sm"><h3>Checklist saved on this device</h3><p>Nothing is sent to us. Clear it any time.</p></div></aside>
      <aside class="callout callout--error"><span class="callout__icon">${icon.err}</span><div class="stack-sm"><h3>Prices could not be loaded</h3><p>The kit details below are still accurate. No prices are shown rather than old or guessed ones.</p></div></aside>
      <aside class="callout callout--neutral"><span class="callout__icon">${icon.box}</span><div class="stack-sm"><h3>No kits match this filter</h3><p>Try "All" to see every kit we compare.</p><a class="btn btn--secondary" href="#">Show all kits</a></div></aside>
    </div>
  </section>

  <section class="sheet-sec" aria-labelledby="dark-h"><h2 id="dark-h">Optional dark theme</h2><p class="meta">Tokens provided and contrast-checked; only ship if Kieran wants it.</p>
    <div class="dark-preview" data-theme="dark"><div class="row-wrap" style="justify-content:space-between">${wordmark()}<a class="btn btn--primary" href="#">Compare kits</a></div>
      <p class="kicker" style="margin-top:16px">Power cuts</p><h3 style="margin-top:4px">Light, warmth and information at home</h3><p class="price__sub" style="margin-top:6px">Multi-hour or overnight outage.</p>
      <div class="row-wrap" style="margin-top:12px"><span class="badge badge--ok">Verified</span><span class="badge badge--warn">Price not verified</span><span class="badge badge--stale">Price may be out of date</span><span class="badge badge--error">Price not available</span><span class="badge badge--ad">Ad</span></div></div>
  </section>
</main>
${footer}
</body></html>`;
out('components.html', comps);
console.log('built');
