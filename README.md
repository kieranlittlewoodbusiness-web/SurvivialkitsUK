# UK Survival Kits

UK civilian household preparedness site: serious editorial guides for outages, severe weather, supply disruption and temporary evacuation. Built with **Astro** and **TypeScript**, published as a **static** site to **Cloudflare Pages** (`npm run build` → `dist`).

Production domain: **https://uksurvivalkits.uk**

## Exact commands

```bash
# Install dependencies
npm install

# Local development server
npm run dev

# Production build (required for Cloudflare Pages)
npm run build

# Preview the production build locally
npm run preview

# Type-check + build + dist checks (links and content). Works without the Associates tag.
npm run check

# Unit tests (includes a production verify:dist run with a dummy tag)
npm test

# Required before a production deploy: production build with a DUMMY tag + strict dist checks
npm run verify:dist
```

### Dist checks (required)

`npm run check` runs `astro check`, `astro build`, then `check:dist` against `dist`:

- **`check:links`** (`scripts/check-outbound-links.mjs`, allowlist in `config/outbound-allowlist.json`): every external URL must be an allowlisted https citation host or an Amazon UK affiliate link of the form `https://www.amazon.co.uk/dp/<ASIN>?tag=<id>-21` on an `<a>` with `rel` containing both `sponsored` and `nofollow`. Any other host fails.
- **`check:content`** (`scripts/check-content.mjs`): fails on banned strings (pre-publication and placeholder copy such as "not live yet", "Editorial review", "do not publish", "Unsupported safety claim", "Unverified specification", "coming soon", the old brand name, and non-Amazon retailer names), on an **Ad** badge with no sponsored link in the same card, and on any page without exactly one robots meta.

A build without the tag (or a non-production `SITE_ENV`) has 0 affiliate links. Citations, banned strings and Ad badges are still checked.

**`npm run verify:dist`** (`scripts/verify-dist.mjs`) is the production gate. Run it before every production deploy. It builds with `SITE_ENV=production` and the dummy tag `verifydist-21` into `.verify-dist/` (the real tag is never used or printed), then runs:

- `check:links --expect-affiliate 9`: exactly 9 affiliate links, all with `sponsored` and `nofollow`;
- `check:content --production`: no `noindex` on any page except `404.html`, `robots.txt` contains `Allow: /` and no `Disallow: /`, `_headers` exists and sends `X-Robots-Tag: noindex` for `uksurvivalkits.pages.dev` and `*.uksurvivalkits.pages.dev` only, never for `uksurvivalkits.uk`, and every canonical, `og:url` and sitemap URL uses the apex `https://uksurvivalkits.uk` (never `www` or `pages.dev`).

`npm test` runs the same `verify:dist` path, plus mutation tests for both checkers (`scripts/dist-checks.test.mjs`). There is no CI workflow in this repo yet. Run `npm run check`, `npm test` and `npm run verify:dist` locally before merging and deploying. Preview builds stay `noindex` with `robots.txt` `Disallow: /`.

`npm run check:contrast` checks the light and dark colour tokens in `src/styles/tokens.css` against WCAG contrast ratios.

### Cloudflare Pages settings

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `22` (or matching `engines` in `package.json`) |
| Framework preset | None / Astro static |

Production is deployed by Direct Upload of a locally built `dist` (see `docs/ops/pages-headers.md`), so Cloudflare Pages dashboard environment variables are not applied to the production build. Export `SITE_ENV` and any IDs in the shell that runs `npm run build` — see item 1 under [What you still need to supply](#what-you-still-need-to-supply).

Canonical URLs, Open Graph, sitemap and `robots.txt` read `siteUrl` from `src/data/site.ts`.

## How to publish a new guide

1. Create `src/content/scenarios/your-slug.md` (filename = URL slug).
2. Frontmatter must include at least:
   - `title`, `description`, `scenario`
   - `pubDate`, `lastReviewed` (shown on the page)
   - `sources: [{ label, url }]` from BUILD_BRIEF / official pages
   - `draft: false` when ready
   - optional `startHere: true` to appear on `/start-here`
   - optional `reviewFlags: ["…"]`: internal editorial notes for unsupported safety claims or unverified specs. They are **not rendered**; clear the claim in the copy before publishing.
   - optional `gearCategories` to link to the matching sections of the 72-hour compare page
3. Keep copy calm and practical. Prefer official guidance; do not invent urgency.
4. Run `npm run check` and open `/scenarios/your-slug`.
5. Commit, push, and deploy via Cloudflare Pages.

Drafts: set `draft: true` to exclude from listings, routes and the published collection helpers.

## How product links work

Product buttons appear only on `/compare/72-hour-emergency-kits/`, and only in production builds. Each button's URL is `link_url` from the offer contract in `src/lib/offers` (Backend-owned), built by `resolveAffiliateLink` from the product's ASIN and the `AMAZON_ASSOCIATES_UK_TAG` environment variable. Only products with `verification: "verified"` and an exact model match are shown. There are no hand-pasted retailer URLs. Gear and scenario pages show criteria and link to the matching compare-page section.

The Amazon Associates disclosure is a single footer line on every page: "As an Amazon Associate I earn from qualifying purchases."

Checklist copy lives in `src/data/checklist.ts` (grouped sections).

## Preparedness features

- **`/start-here`** — inventory → checklist → core scenarios → gear
- **`/checklist`** — printable 72-hour list grouped by water/food, light/warmth, communications, hygiene, documents, household-specific needs; starts with “check what you already have”; ticks save in `localStorage` on this device only; Reset clears; works without JS for reading/printing; ads hidden in print
- **Core scenarios** — `/scenarios/power-cuts`, `/severe-weather`, `/temporary-evacuation`, `/winter-travel` with sources, last-reviewed date and review flags
- **72-hour kit guide** — `/compare/72-hour-emergency-kits/`: verified Amazon UK essentials by category, with Ad-labelled affiliate buttons in production

## Project map

```
src/
  content/scenarios/          Guide Markdown
  content/gear/               Category criteria Markdown
  data/checklist.ts           Checklist groups/items
  data/site.ts
  lib/offers/                 Offer and catalogue contract (Backend)
  components/catalogue/       Amazon catalogue cards, category grid, compare links
  styles/tokens.css           Light and dark design tokens
scripts/                      Dist checks (links, content, verify:dist) and contrast
config/outbound-allowlist.json
  pages/start-here.astro
  pages/checklist.astro
BUILD_BRIEF.md
```

## Accessibility and print

- Mobile-first CSS; keyboard menu with Escape to close; visible `:focus-visible`
- Print stylesheet hides header/footer, toolbars and `.no-print`
- No third-party scripts or fonts (Barlow Condensed 700 and Inter 400/600 are self-hosted from @fontsource in `public/fonts`, OFL 1.1)

## What you still need to supply

1. Export `SITE_ENV=production` and `AMAZON_ASSOCIATES_UK_TAG` in the shell that runs `npm run build` before you upload `dist`. Production is deployed by Direct Upload (see `docs/ops/pages-headers.md`), so Cloudflare Pages dashboard variables do not reach the build. Optionally, only with Kieran's yes when tracking is switched on, also export `PUBLIC_GA4_ID`, `PUBLIC_GOOGLE_ADS_ID` and `PUBLIC_META_PIXEL_ID`. Tracking needs `SITE_ENV=production` **and** at least one of those IDs; previews (`*.pages.dev`) never load tags. Example (placeholder IDs only, clearly not real accounts — omit the `PUBLIC_*` lines until tracking is switched on):

   ```bash
   export SITE_ENV=production
   export AMAZON_ASSOCIATES_UK_TAG  # set in this shell; do not print or commit the real tag
   # Optional examples only, and only with Kieran's yes when tracking is switched on:
   export PUBLIC_GA4_ID=G-TEST000000
   export PUBLIC_GOOGLE_ADS_ID=AW-000000000
   export PUBLIC_META_PIXEL_ID=000000000000000
   npm run build
   ```
2. Contact inbox if not `editors@uksurvivalkits.uk`
3. Cloudflare Pages DNS for `uksurvivalkits.uk`
4. Clear or rewrite the claims behind any `reviewFlags` (internal notes, not rendered)
5. Optional licensed photography for the hero
6. Re-verify government source URLs on publish day
