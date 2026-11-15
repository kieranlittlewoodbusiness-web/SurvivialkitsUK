# S1-7 design direction: UK Survival Kit Brief

**Ticket:** #10 (S1-7) · **Owner:** Design And Web Developer (M66) · **Status:** direction for Kieran's approval, no site code changed.
Static mocks only. Implementation follows on `s1-7-design-refresh` (styles, layout and components only; `src/lib/offers` and `src/data/kits` untouched).

Open `components.html`, `home-mock.html` and `compare-mock.html` directly in a browser. Every price is a placeholder `£00.00` marked **Example**; kits, models and retailers are fictional ("Example Kit A", "EX-A2", "Example Retailer One"). No retailer imagery is used: cards show neutral pictograms (people count + format, or a category icon).

| Screenshot | 375px | 1280px |
|---|---|---|
| Home | `home-mock-375.png` | `home-mock-1280.png` |
| Compare 72-hour kits | `compare-mock-375.png` | `compare-mock-1280.png` |
| Components and tokens | `components-375.png` | `components-1280.png` |

## Direction in one paragraph
A calm, editorial news-site front page: lead story in a dark rounded hero band, an Axios-style "The short version" box beside it, a featured comparison card, a 7-category grid, then Guardian-style story cards (kicker, headline, standfirst, meta) under ruled section heads. Everything is rounded (20px cards, 28px bands, pill buttons and chips) with hairline borders and soft shadows. One variable sans family keeps it light on slow connections.

## Brand rename: UK Survival Kit Brief
Mocks use **UK Survival Kit Brief** with a simple wordmark: a rounded-square tile (grab bag with a tick) plus the name in Schibsted Grotesk 800, with "Brief" in the accent colour. On dark bands the tile inverts. The tile doubles as favicon (48/32/16px shown on the components sheet).

Where the rename applies at implementation (S1-7 branch, not PR #9):
- Site name constant (`src/data/site.ts`) and `package.json` name
- Header wordmark/logo (`Header.astro`) and `public/favicon.svg`
- Every `<title>` and meta description template (`BaseHead.astro`, page titles)
- `og:site_name` and any JSON-LD `publisher`/`name`
- Footer brand and copyright (`Footer.astro`)
- Disclosure copy (affiliate disclosure page, research disclosure, footer ad note)
- Repo `README.md` (plus `BUILD_BRIEF.md` references if the PM wants)
- Evidence: `rg -n "Household Brief"` must return nothing outside history

## Patterns borrowed (not identities)
1. **Modular story cards with kicker / headline / standfirst / meta**, few container types: Guardian design system and its 2024-25 homepage redesign (19 containers reduced to 5). https://design.theguardian.com/ · https://www.designweek.co.uk/the-guardian-unveils-redesigned-app-and-homepage/
2. **Top stories first, then grouped "story sets"**: The Verge's 2026 homepage separates curated sets from the feed; we lead with one story, then category and scenario sets. https://www.theverge.com/bulletin/914842/the-next-evolution-of-the-verges-homepage-is-here
3. **"The short version / Why it matters" bullet box**: Axios Smart Brevity. https://www.axios.com/smart-brevity
4. **Separating verifiable facts from our view**: Semafor's Semaform structure, used as a principle for the research disclosure and price labels (we do not borrow its right-angled, cream look). https://www.semafor.com/
5. **Labelled pick cards with evidence badges**: Wirecutter "Our pick" and Which? Best Buy cards, adapted as "Best verified delivered price" only when the API says so. https://www.nytimes.com/wirecutter/ · https://www.which.co.uk/
Mobbin was tried for web patterns but needs a paid plan (NOT RUN).

## Tokens (`tokens.css`)
**Surfaces:** canvas `#f5f3ee`, surface `#ffffff`, surface-2 `#eeebe4`, band `#10201c`, line `#ddd8ce`, line-strong `#858a8e`.
**Text:** ink `#14181b`, ink-2 `#434b51`, ink-3 `#5a6268`, on-band `#f5f3ee`, on-band-2 `#c3cdc9`, band-accent `#7fd6b8`.
**Accent A, Signal green (recommended, continues today's `#0f5c4c`):** `#0b5d4b`, hover `#07463a`, soft `#e2f1ec`.
**Accent B, Beacon amber:** `#a3360a`, hover `#842b07`, soft `#fbe9de`.
**Semantic (price labels, meaning unchanged):** success `#13592b` on `#e3f3e7` (Verified, best verified price) · warning `#7a4100` on `#fcefd8` (not verified, delivery unverified/unknown, model unconfirmed, research disclosure) · error `#9b1c1c` on `#fbe7e5` (price not available, load error) · info `#1b4a85` on `#e5edf8` (price may be out of date) · ad `#3a3e42` on `#ebe7de` (Ad) · neutral ink-2 on surface-2 (No retailer link yet, Price not shown here) · focus `#1a55c9`.
**Dark theme:** optional set under `[data-theme="dark"]`, contrast-checked below; not proposed for this sprint unless Kieran wants it.

**Type:** Schibsted Grotesk (variable 400-900, OFL, via Fontsource `@fontsource-variable/schibsted-grotesk`), latin subset **46.8 KB**, one file, `font-display: swap`, preloaded. Option B adds Source Serif 4 variable (latin, **50.9 KB**) for headlines only. Today's site loads two Google Fonts families from a third-party host; this direction self-hosts one file.
Fluid scale (320 to 1280px): `--step--1` 13→14 · `--step-0` 16→17 body · `--step-1` 18→20 · `--step-2` 21→25 · `--step-3` 26→34 · `--step-4` 32→48 · `--step-5` 38→64 (homepage lead).

**Shape:** `--r-xs` 8px (badges, inputs) · `--r-sm` 12px (nested panels, offer rows) · `--r-md` 20px (cards) · `--r-lg` 28px (hero, bands, kit cards, footer top) · `--r-pill` (buttons, chips, nav).
**Space:** 4px base: 4, 8, 12, 16, 24, 32, 48, 64, 96; gutter `clamp(16px, 3vw, 32px)`; max width 76rem; tap target `--tap: 44px`.
**Elevation:** 1px hairline + `--shadow-1` (rest) / `--shadow-2` (hover); no heavy drops.
**Focus:** `box-shadow: 0 0 0 2px surface, 0 0 0 5px #1a55c9` (visible on canvas, cards and accent buttons). Hover lift is disabled under `prefers-reduced-motion`.

## Components shown
Header (mobile Menu pill + rounded menu sheet; desktop segmented pill nav + CTA; sticky blur), swipeable topic chips, hero/lead band, "short version" box, featured comparison, **category grid (7 S1-8 categories: kits, water, first aid, wind-up torches & radios, power banks, blankets, thermals)**, story cards (grid + compact row), numbered step cards, criteria list, callouts (disclosure, info, success, error, empty), skeleton loading state, footer.

**Kit and product cards** use one shell and follow S1-1 plus the proposed S1-8 `DisplayOffer` (issue #11):
| State | Price area | Action area |
|---|---|---|
| Best verified (`best_price_offer_id` set) | green panel, Verified badge, savings only if `savings` set | Affiliate link: `Ad` label, then per-item button "Check EX-A2 at Example Retailer One", `disclosure_text` below |
| Held / unverified | amber panel, price on card face with Price not verified / Delivery cost unknown labels | `link_url` null: no button, `no_link_text` as plain text |
| Stale | blue panel, Price may be out of date, older last checked | Affiliate link if approved |
| No button, no price (`price_display_allowed` false and/or `link_url` null) | grey panel, no figure, never an estimate | "Retailer link coming soon." as plain text |
| Model unconfirmed | amber, Exact model not confirmed, never best | no button |
| Product, affiliate but price not displayable (e.g. retailer price not from its API) | "Price shown at retailer" | Affiliate button + Ad + disclosure_text |
Every priced state shows last checked, the price disclaimer ("Price at {retailer} on {date} UK time. Prices change.") and **source name as text** (S1-8 removes `source.url` from the display shape). Cards render only `VariantComparison.offers`; no client sorting. The disclosure component shows `disclosure_text` verbatim.

## Contrast (WCAG 2.x, measured by `tools/contrast.mjs`)
Text pairs need 4.5:1 (AA); focus ring and control borders need 3:1 (1.4.11). **0 failures across 81 checks.**

#### light (accent A green)

| Text / foreground | Background | Use | Ratio | Needs | Result |
|---|---|---|---|---|---|
| `--ink` #14181b | `--canvas` #f5f3ee | Body and headlines on page canvas | **16.10:1** | 4.5:1 | PASS (AAA) |
| `--ink` #14181b | `--surface` #ffffff | Body and headlines on cards | **17.85:1** | 4.5:1 | PASS (AAA) |
| `--ink` #14181b | `--surface-2` #eeebe4 | Text on sunken band / chips | **15.00:1** | 4.5:1 | PASS (AAA) |
| `--ink-2` #434b51 | `--canvas` #f5f3ee | Standfirst / secondary text on canvas | **8.01:1** | 4.5:1 | PASS (AAA) |
| `--ink-2` #434b51 | `--surface` #ffffff | Standfirst / secondary text on cards | **8.88:1** | 4.5:1 | PASS (AAA) |
| `--ink-2` #434b51 | `--surface-2` #eeebe4 | Secondary text on sunken band | **7.46:1** | 4.5:1 | PASS (AAA) |
| `--ink-3` #5a6268 | `--surface` #ffffff | Meta (dates, last checked) on cards | **6.21:1** | 4.5:1 | PASS |
| `--ink-3` #5a6268 | `--canvas` #f5f3ee | Meta on canvas | **5.60:1** | 4.5:1 | PASS |
| `--accent` #0b5d4b | `--surface` #ffffff | Links, kickers on cards | **7.83:1** | 4.5:1 | PASS (AAA) |
| `--accent` #0b5d4b | `--canvas` #f5f3ee | Links, kickers on canvas | **7.06:1** | 4.5:1 | PASS (AAA) |
| `--accent` #0b5d4b | `--accent-soft` #e2f1ec | Accent chip text | **6.72:1** | 4.5:1 | PASS |
| `--on-accent` #ffffff | `--accent` #0b5d4b | Primary button label | **7.83:1** | 4.5:1 | PASS (AAA) |
| `--on-accent` #ffffff | `--accent-hover` #07463a | Primary button label (hover) | **10.79:1** | 4.5:1 | PASS (AAA) |
| `--on-band` #f5f3ee | `--band` #10201c | Text on dark hero/feature band | **15.21:1** | 4.5:1 | PASS (AAA) |
| `--on-band-2` #c3cdc9 | `--band` #10201c | Secondary text on dark band | **10.36:1** | 4.5:1 | PASS (AAA) |
| `--band-accent` #7fd6b8 | `--band` #10201c | Kicker on dark band | **9.81:1** | 4.5:1 | PASS (AAA) |
| `--success` #13592b | `--success-soft` #e3f3e7 | Badge: Verified / best verified price | **7.32:1** | 4.5:1 | PASS (AAA) |
| `--success` #13592b | `--surface` #ffffff | Best price figure on card | **8.43:1** | 4.5:1 | PASS (AAA) |
| `--warning` #7a4100 | `--warning-soft` #fcefd8 | Badge: Price not verified / delivery unknown / model unconfirmed | **7.15:1** | 4.5:1 | PASS (AAA) |
| `--error` #9b1c1c | `--error-soft` #fbe7e5 | Badge: Price not available / error state | **6.86:1** | 4.5:1 | PASS |
| `--info` #1b4a85 | `--info-soft` #e5edf8 | Badge: Price may be out of date (stale) / info callout | **7.53:1** | 4.5:1 | PASS (AAA) |
| `--ad` #3a3e42 | `--ad-soft` #ebe7de | Ad label | **8.74:1** | 4.5:1 | PASS (AAA) |
| `--ink` #14181b | `--warning-soft` #fcefd8 | Body copy inside disclosure callout | **15.71:1** | 4.5:1 | PASS (AAA) |
| `--ink` #14181b | `--info-soft` #e5edf8 | Body copy inside info callout | **15.13:1** | 4.5:1 | PASS (AAA) |
| `--line-strong` #858a8e | `--surface` #ffffff | Control / secondary-button border (non-text, 1.4.11) | **3.49:1** | 3:1 | PASS |
| `--focus` #1a55c9 | `--canvas` #f5f3ee | Focus ring vs canvas (non-text, 1.4.11) | **5.94:1** | 3:1 | PASS |
| `--focus` #1a55c9 | `--surface` #ffffff | Focus ring vs card (non-text, 1.4.11) | **6.59:1** | 3:1 | PASS |

#### light (accent B amber)

| Text / foreground | Background | Use | Ratio | Needs | Result |
|---|---|---|---|---|---|
| `--ink` #14181b | `--canvas` #f5f3ee | Body and headlines on page canvas | **16.10:1** | 4.5:1 | PASS (AAA) |
| `--ink` #14181b | `--surface` #ffffff | Body and headlines on cards | **17.85:1** | 4.5:1 | PASS (AAA) |
| `--ink` #14181b | `--surface-2` #eeebe4 | Text on sunken band / chips | **15.00:1** | 4.5:1 | PASS (AAA) |
| `--ink-2` #434b51 | `--canvas` #f5f3ee | Standfirst / secondary text on canvas | **8.01:1** | 4.5:1 | PASS (AAA) |
| `--ink-2` #434b51 | `--surface` #ffffff | Standfirst / secondary text on cards | **8.88:1** | 4.5:1 | PASS (AAA) |
| `--ink-2` #434b51 | `--surface-2` #eeebe4 | Secondary text on sunken band | **7.46:1** | 4.5:1 | PASS (AAA) |
| `--ink-3` #5a6268 | `--surface` #ffffff | Meta (dates, last checked) on cards | **6.21:1** | 4.5:1 | PASS |
| `--ink-3` #5a6268 | `--canvas` #f5f3ee | Meta on canvas | **5.60:1** | 4.5:1 | PASS |
| `--accent` #a3360a | `--surface` #ffffff | Links, kickers on cards | **6.80:1** | 4.5:1 | PASS |
| `--accent` #a3360a | `--canvas` #f5f3ee | Links, kickers on canvas | **6.13:1** | 4.5:1 | PASS |
| `--accent` #a3360a | `--accent-soft` #fbe9de | Accent chip text | **5.77:1** | 4.5:1 | PASS |
| `--on-accent` #ffffff | `--accent` #a3360a | Primary button label | **6.80:1** | 4.5:1 | PASS |
| `--on-accent` #ffffff | `--accent-hover` #842b07 | Primary button label (hover) | **9.01:1** | 4.5:1 | PASS (AAA) |
| `--on-band` #f5f3ee | `--band` #10201c | Text on dark hero/feature band | **15.21:1** | 4.5:1 | PASS (AAA) |
| `--on-band-2` #c3cdc9 | `--band` #10201c | Secondary text on dark band | **10.36:1** | 4.5:1 | PASS (AAA) |
| `--band-accent` #ffb48a | `--band` #10201c | Kicker on dark band | **9.75:1** | 4.5:1 | PASS (AAA) |
| `--success` #13592b | `--success-soft` #e3f3e7 | Badge: Verified / best verified price | **7.32:1** | 4.5:1 | PASS (AAA) |
| `--success` #13592b | `--surface` #ffffff | Best price figure on card | **8.43:1** | 4.5:1 | PASS (AAA) |
| `--warning` #7a4100 | `--warning-soft` #fcefd8 | Badge: Price not verified / delivery unknown / model unconfirmed | **7.15:1** | 4.5:1 | PASS (AAA) |
| `--error` #9b1c1c | `--error-soft` #fbe7e5 | Badge: Price not available / error state | **6.86:1** | 4.5:1 | PASS |
| `--info` #1b4a85 | `--info-soft` #e5edf8 | Badge: Price may be out of date (stale) / info callout | **7.53:1** | 4.5:1 | PASS (AAA) |
| `--ad` #3a3e42 | `--ad-soft` #ebe7de | Ad label | **8.74:1** | 4.5:1 | PASS (AAA) |
| `--ink` #14181b | `--warning-soft` #fcefd8 | Body copy inside disclosure callout | **15.71:1** | 4.5:1 | PASS (AAA) |
| `--ink` #14181b | `--info-soft` #e5edf8 | Body copy inside info callout | **15.13:1** | 4.5:1 | PASS (AAA) |
| `--line-strong` #858a8e | `--surface` #ffffff | Control / secondary-button border (non-text, 1.4.11) | **3.49:1** | 3:1 | PASS |
| `--focus` #1a55c9 | `--canvas` #f5f3ee | Focus ring vs canvas (non-text, 1.4.11) | **5.94:1** | 3:1 | PASS |
| `--focus` #1a55c9 | `--surface` #ffffff | Focus ring vs card (non-text, 1.4.11) | **6.59:1** | 3:1 | PASS |

#### dark (optional)

| Text / foreground | Background | Use | Ratio | Needs | Result |
|---|---|---|---|---|---|
| `--ink` #edf1ef | `--canvas` #0e1312 | Body and headlines on page canvas | **16.45:1** | 4.5:1 | PASS (AAA) |
| `--ink` #edf1ef | `--surface` #161d1b | Body and headlines on cards | **15.04:1** | 4.5:1 | PASS (AAA) |
| `--ink` #edf1ef | `--surface-2` #1d2523 | Text on sunken band / chips | **13.74:1** | 4.5:1 | PASS (AAA) |
| `--ink-2` #bcc5c1 | `--canvas` #0e1312 | Standfirst / secondary text on canvas | **10.62:1** | 4.5:1 | PASS (AAA) |
| `--ink-2` #bcc5c1 | `--surface` #161d1b | Standfirst / secondary text on cards | **9.70:1** | 4.5:1 | PASS (AAA) |
| `--ink-2` #bcc5c1 | `--surface-2` #1d2523 | Secondary text on sunken band | **8.87:1** | 4.5:1 | PASS (AAA) |
| `--ink-3` #9da7a3 | `--surface` #161d1b | Meta (dates, last checked) on cards | **6.93:1** | 4.5:1 | PASS |
| `--ink-3` #9da7a3 | `--canvas` #0e1312 | Meta on canvas | **7.58:1** | 4.5:1 | PASS (AAA) |
| `--accent` #6fd0ae | `--surface` #161d1b | Links, kickers on cards | **9.23:1** | 4.5:1 | PASS (AAA) |
| `--accent` #6fd0ae | `--canvas` #0e1312 | Links, kickers on canvas | **10.09:1** | 4.5:1 | PASS (AAA) |
| `--accent` #6fd0ae | `--accent-soft` #143229 | Accent chip text | **7.45:1** | 4.5:1 | PASS (AAA) |
| `--on-accent` #062219 | `--accent` #6fd0ae | Primary button label | **9.04:1** | 4.5:1 | PASS (AAA) |
| `--on-accent` #062219 | `--accent-hover` #8fdcc0 | Primary button label (hover) | **10.53:1** | 4.5:1 | PASS (AAA) |
| `--on-band` #edf1ef | `--band` #08100e | Text on dark hero/feature band | **16.90:1** | 4.5:1 | PASS (AAA) |
| `--on-band-2` #bcc5c1 | `--band` #08100e | Secondary text on dark band | **10.90:1** | 4.5:1 | PASS (AAA) |
| `--band-accent` #7fd6b8 | `--band` #08100e | Kicker on dark band | **11.20:1** | 4.5:1 | PASS (AAA) |
| `--success` #86d9a1 | `--success-soft` #12301d | Badge: Verified / best verified price | **8.49:1** | 4.5:1 | PASS (AAA) |
| `--success` #86d9a1 | `--surface` #161d1b | Best price figure on card | **10.16:1** | 4.5:1 | PASS (AAA) |
| `--warning` #f1c46e | `--warning-soft` #33260c | Badge: Price not verified / delivery unknown / model unconfirmed | **9.04:1** | 4.5:1 | PASS (AAA) |
| `--error` #ff9f97 | `--error-soft` #3a1614 | Badge: Price not available / error state | **8.17:1** | 4.5:1 | PASS (AAA) |
| `--info` #a3c4ff | `--info-soft` #14253f | Badge: Price may be out of date (stale) / info callout | **8.71:1** | 4.5:1 | PASS (AAA) |
| `--ad` #d8d3c8 | `--ad-soft` #2a2924 | Ad label | **9.76:1** | 4.5:1 | PASS (AAA) |
| `--ink` #edf1ef | `--warning-soft` #33260c | Body copy inside disclosure callout | **12.95:1** | 4.5:1 | PASS (AAA) |
| `--ink` #edf1ef | `--info-soft` #14253f | Body copy inside info callout | **13.49:1** | 4.5:1 | PASS (AAA) |
| `--line-strong` #7a8682 | `--surface` #161d1b | Control / secondary-button border (non-text, 1.4.11) | **4.54:1** | 3:1 | PASS |
| `--focus` #8cb4ff | `--canvas` #0e1312 | Focus ring vs canvas (non-text, 1.4.11) | **9.00:1** | 3:1 | PASS |
| `--focus` #8cb4ff | `--surface` #161d1b | Focus ring vs card (non-text, 1.4.11) | **8.23:1** | 3:1 | PASS |

## QA on the mocks (Chromium 159, Playwright, `tools/render.mjs`, results in `qa-report.json`)
| Check | 320 | 375 | 390 | 768 | 1280 |
|---|---|---|---|---|---|
| Horizontal overflow (home / compare / components) | none | none | none | none | none |
| axe-core (wcag2a/aa, 2.1, 2.2aa, best-practice) violations | 0 | 0 | 0 | 0 | 0 |
| Interactive targets under 44px (excluding inline text links) | 0 | 0 | 0 | 0 | 0 |
NOT RUN on mocks: WebKit/iPhone Safari, Android Chrome, Lighthouse (to be run on the implementation preview against the #10 thresholds).

## Decisions for Kieran
1. **Accent colour:** A Signal green `#0b5d4b` (recommended, continuity and calm) or B Beacon amber `#a3360a` (warmer, more news-like).
2. **Headlines:** A all-sans Schibsted Grotesk (recommended, one 47 KB font) or B Source Serif 4 headlines (more "newspaper", +51 KB).
3. **Wordmark:** tile + "UK Survival Kit **Brief**" as shown, or text-only. Also confirm the spelling "UK Survival Kit Brief" (no full stops).
4. Optional: ship the dark theme now or later.

## Files
`tokens.css`, `design.css`, `components.html`, `home-mock.html`, `compare-mock.html`, six PNGs, `contrast.md/json`, `qa-report.json`, `fonts/` (OFL-1.1, from Fontsource 5.3.x), `tools/` (generator, contrast and QA scripts; tools/render.mjs expects Playwright and @axe-core/playwright installed locally).
