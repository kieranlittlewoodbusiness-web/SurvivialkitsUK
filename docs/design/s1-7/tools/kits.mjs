// Kit + product card states for the mocks, mapped to S1-1 + proposed S1-8 DisplayOffer fields.
// All prices/models/retailers are EXAMPLE placeholders. No retailer imagery identifies a variant.
export const DISCLOSURE_TEXT = 'As an Amazon Associate I earn from qualifying purchases.'; // sample disclosure_text from S1-8 proposal
export const NO_LINK_TEXT = 'No retailer link yet: we only link to retailers through approved affiliate programmes.';
const ex = '<span class="badge badge--example">Example</span>';
const fine = (retailer, src, when = '14 Nov 2026, 09:00') => `<div class="price__fine">
  <span>Last checked ${when} UK time.</span>
  <span>Price at ${retailer} on ${when} UK time. Prices change.</span>
  <span>Source: ${src}</span>
</div>`;
// Affiliate-link state: per-item visible label, Ad label, disclosure_text beside the first link.
const affiliate = (code, retailer, disclosure = true) => `<div class="row row--cta">
  <span class="badge badge--ad">Ad</span>
  <a class="btn btn--primary" href="#" rel="sponsored nofollow">Check ${code} at ${retailer}</a>
</div>${disclosure ? `<p class="meta">${DISCLOSURE_TEXT}</p>` : ''}`;
// No-button state: link_url null -> plain text no_link_text, no fallback link.
const noLink = (text = NO_LINK_TEXT) => `<p class="nolink"><span class="badge badge--neutral">No retailer link yet</span><span>${text}</span></p>`;
const water = (incl, need, people) => {
  const pct = Math.max(4, Math.round((incl / need) * 100));
  return `<div class="kit__water">
  <div class="offer__top"><strong>Drinking water</strong><span class="meta">Example figures</span></div>
  <div class="meter" role="img" aria-label="Includes ${incl} litres of ${need} litres needed"><span style="width:${pct}%"></span></div>
  <p class="price__sub">Includes ${incl} L. ${people} ${people === 1 ? 'person needs' : 'people need'} about ${need} L for 3 days, so you would add <strong>${String(+(need - incl).toFixed(1))} L</strong>.</p>
</div>`;
};
const contents = `<details class="disclose"><summary>What's in the kit</summary><div><ul class="contents">
  <li><span class="yes" aria-hidden="true">✓</span><span>Wind-up radio and torch</span><span class="visually-hidden">Included</span></li>
  <li><span class="yes" aria-hidden="true">✓</span><span>First aid kit</span><span class="visually-hidden">Included</span></li>
  <li><span class="no" aria-hidden="true">✕</span><span>Three days of drinking water</span><span class="visually-hidden">Not included</span></li>
  <li><span class="nl" aria-hidden="true">?</span><span>Power bank</span><span class="visually-hidden">Not listed by seller</span></li>
</ul></div></details>`;
// Neutral illustration: people count + format pictogram, never a retailer photo.
const pict = (people, format) => `<div class="pict" aria-hidden="true"><svg viewBox="0 0 48 48"><rect x="9" y="16" width="30" height="24" rx="7" fill="none" stroke="currentColor" stroke-width="3"/><path d="M18 16v-3a6 6 0 0 1 12 0v3" fill="none" stroke="currentColor" stroke-width="3"/>${format === 'box' ? '<path d="M9 26h30" stroke="currentColor" stroke-width="3"/>' : '<path d="M19 28.5l4 4 7-7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'}</svg><span>${people}×</span></div>`;
const head = (id, forLabel, name, code, facts, people, format = 'bag') => `<header class="kit__head">
  <div class="kit__headrow">${pict(people, format)}<div class="stack-sm"><p class="kicker">${forLabel}</p>
  <h3 id="${id}">${name}<span class="kit__code">Model ${code}</span></h3></div></div>
  <ul class="kit__facts" aria-label="Key facts">${facts.map((f) => `<li class="chip chip--static">${f}</li>`).join('')}</ul>
</header>`;

export const kitBest = `<article class="kit" aria-labelledby="k1">
${head('k1', 'Best verified price · affiliate link', 'Example Kit A, 2-person grab bag', 'EX-A2', ['2 people', 'Grab bag', 'Listed 6.1 kg'], 2)}
<section class="price price--best" aria-label="Price for EX-A2">
  <p class="price__label">Best verified delivered price <span class="badge badge--ok">Verified</span></p>
  <div class="price__fig"><span class="price__amount">£00.00</span>${ex}<span class="price__sub">incl. free delivery · Example Retailer One</span></div>
  <p class="price__sub">Saves £0.00 vs the next eligible offer on the same day ${ex}</p>
  ${fine('Example Retailer One', 'Example Retailer One listing')}
</section>
${water(1.5, 18, 2)}
<div class="kit__actions">${affiliate('EX-A2', 'Example Retailer One')}</div>
${contents}
</article>`;

export const kitUnverified = `<article class="kit" aria-labelledby="k2">
${head('k2', 'Held price, not verified · no link', 'Example Kit B, 1-person grab bag', 'EX-B1', ['1 person', 'Grab bag', 'Weight not published'], 1)}
<section class="price price--warn" aria-label="Price for EX-B1">
  <p class="price__label">Listed price, not verified</p>
  <div class="price__fig"><span class="price__amount price__amount--muted">£00.00</span>${ex}</div>
  <div class="price__flags"><span class="badge badge--warn">Price not verified</span><span class="badge badge--warn">Delivery cost unknown – not included in total</span></div>
  ${fine('Example Retailer Two', 'Example Retailer Two listing')}
</section>
${water(0.5, 9, 1)}
<div class="kit__actions">${noLink()}</div>
${contents}
</article>`;

export const kitStale = `<article class="kit" aria-labelledby="k3">
${head('k3', 'Stale price · affiliate link', 'Example Kit C, 4-person home box', 'EX-C4', ['4 people', 'Stay-at-home box', 'Listed 11 kg'], 4, 'box')}
<section class="price price--stale" aria-label="Price for EX-C4">
  <p class="price__label">Last seen price <span class="badge badge--stale">Price may be out of date</span></p>
  <div class="price__fig"><span class="price__amount price__amount--muted">£00.00</span>${ex}<span class="price__sub">checked more than 7 days ago</span></div>
  ${fine('Example Retailer One', 'Example Retailer One listing', '3 Nov 2026, 09:00')}
</section>
${water(3, 36, 4)}
<div class="kit__actions">${affiliate('EX-C4', 'Example Retailer One', false)}</div>
${contents}
</article>`;

export const kitNone = `<article class="kit" aria-labelledby="k4">
${head('k4', 'No button, no price', 'Example Kit D, 2-person grab bag', 'EX-D2', ['2 people', 'Grab bag', 'Listed 5.4 kg'], 2)}
<section class="price price--none" aria-label="Price for EX-D2">
  <p class="price__label">No price shown <span class="badge badge--error">Price not available</span></p>
  <p class="price__sub">We only show prices we are allowed to display and can date. We will not show an estimate.</p>
  <div class="price__fine"><span>Page built 14 Nov 2026, 09:00 UK time.</span></div>
</section>
${water(1.5, 18, 2)}
<div class="kit__actions">${noLink('Retailer link coming soon.')}</div>
${contents}
</article>`;

export const kitUnconfirmed = `<article class="kit" aria-labelledby="k5">
${head('k5', 'Model not confirmed', 'Example Kit E, 2-person grab bag', 'EX-E2', ['2 people', 'Grab bag'], 2)}
<section class="price price--warn" aria-label="Price for EX-E2">
  <p class="price__label">Listing may be a different model</p>
  <div class="price__fig"><span class="price__amount price__amount--muted">£00.00</span>${ex}</div>
  <div class="price__flags"><span class="badge badge--warn">Exact model not confirmed</span></div>
  <p class="price__sub">Never shown as the best price.</p>
  ${fine('Example Retailer Two', 'Example Retailer Two listing')}
</section>
<div class="kit__actions">${noLink()}</div>
</article>`;

/* ---------- Product cards (S1-8 categories) ---------- */
export const catIcon = {
  kit: '<path d="M12 18v-3a8 8 0 0 1 16 0v3" /><rect x="6" y="18" width="28" height="18" rx="6"/><path d="m15 27 4 4 7-7"/>',
  emergency_water: '<path d="M20 5c6 8 11 14 11 20a11 11 0 0 1-22 0c0-6 5-12 11-20Z"/><path d="M14 26a6 6 0 0 0 6 6"/>',
  first_aid_kit: '<rect x="5" y="11" width="30" height="23" rx="6"/><path d="M15 11V8h10v3M20 17v11M14.5 22.5h11"/>',
  wind_up_torch_radio: '<rect x="5" y="14" width="22" height="16" rx="5"/><circle cx="13" cy="22" r="3.5"/><path d="M20 19h3M20 23h3M27 20h4a3 3 0 0 1 0 6h-1M10 14l7-6"/>',
  power_bank: '<rect x="10" y="5" width="20" height="30" rx="6"/><path d="m21 12-4 8h6l-4 8"/>',
  emergency_blanket: '<path d="M7 9h26v22H7z" stroke-linejoin="round"/><path d="M7 16l26 8M7 24l26-8"/>',
  thermal_clothing: '<path d="M14 6 6 11l3 7 4-2v18h14V16l4 2 3-7-8-5c-1 3-3 4-6 4s-5-1-6-4Z" stroke-linejoin="round"/>',
};
export const icon40 = (k) => `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">${catIcon[k]}</svg>`;
export const categories = [
  ['kit', 'Pre-packed kits', '72-hour grab bags and home boxes'],
  ['emergency_water', 'Emergency water', 'Cartons, pouches and storage'],
  ['first_aid_kit', 'First aid', 'Household and BS 8599 kits'],
  ['wind_up_torch_radio', 'Wind-up torches & radios', 'No-battery light and news'],
  ['power_bank', 'Power banks', 'Phone and device backup'],
  ['emergency_blanket', 'Emergency blankets', 'Foil and reusable blankets'],
  ['thermal_clothing', 'Thermals', 'Base layers, socks and hats'],
];
export const categoryGrid = `<ul class="cat-grid">${categories.map(([k, t, d]) => `<li><a class="cat" href="#"><span class="cat__icon">${icon40(k)}</span><span class="cat__txt"><strong>${t}</strong><span>${d}</span></span></a></li>`).join('')}</ul>`;

const pHead = (id, cat, name, code, facts) => `<header class="kit__head"><div class="kit__headrow"><div class="pict pict--cat" aria-hidden="true">${icon40(cat)}</div><div class="stack-sm"><p class="kicker">${categories.find((c) => c[0] === cat)[1]}</p><h3 id="${id}">${name}<span class="kit__code">Model ${code}</span></h3></div></div>
<ul class="kit__facts" aria-label="Key facts">${facts.map((f) => `<li class="chip chip--static">${f}</li>`).join('')}</ul></header>`;

export const productAffiliate = `<article class="kit product" aria-labelledby="p1">
${pHead('p1', 'power_bank', 'Example Power Bank 10K', 'EX-PB10', ['10,000 mAh (source: listing)', 'USB-C'])}
<section class="price price--none" aria-label="Price for EX-PB10">
  <p class="price__label">Price shown at retailer <span class="badge badge--neutral">Price not shown here</span></p>
  <p class="price__sub">We can only show this retailer's price when it comes from their own feed. Check the current price on their site.</p>
  <div class="price__fine"><span>Product details last checked 14 Nov 2026, 09:00 UK time.</span><span>Source: Example Retailer Three listing</span></div>
</section>
<div class="kit__actions">${affiliate('EX-PB10', 'Example Retailer Three')}</div>
</article>`;

export const productHeld = `<article class="kit product" aria-labelledby="p2">
${pHead('p2', 'first_aid_kit', 'Example First Aid Kit, household', 'EX-FA1', ['Standard: none stated', '80 items (source: listing)'])}
<section class="price price--warn" aria-label="Price for EX-FA1">
  <p class="price__label">Listed price, not verified</p>
  <div class="price__fig"><span class="price__amount price__amount--muted">£00.00</span>${ex}</div>
  <div class="price__flags"><span class="badge badge--warn">Price not verified</span><span class="badge badge--warn">Delivery cost not verified</span></div>
  ${fine('Example Retailer Two', 'Example Retailer Two listing')}
</section>
<div class="kit__actions">${noLink()}</div>
</article>`;

export const productNone = `<article class="kit product" aria-labelledby="p3">
${pHead('p3', 'emergency_blanket', 'Example Foil Blanket, 4-pack', 'EX-EB4', ['210 × 160 cm (source: listing)', 'Single use'])}
<section class="price price--none" aria-label="Price for EX-EB4">
  <p class="price__label">No price shown</p>
  <p class="price__sub">No displayable price yet.</p>
</section>
<div class="kit__actions">${noLink('Retailer link coming soon.')}</div>
</article>`;
