# U.K. Survival Kit Brief

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

# Type-check / Astro sync + production build
npm run check
```

### Cloudflare Pages settings

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `22` (or matching `engines` in `package.json`) |
| Framework preset | None / Astro static |

Canonical URLs, Open Graph, sitemap and `robots.txt` read `siteUrl` from `src/data/site.ts`.

## How to publish a new guide

1. Create `src/content/scenarios/your-slug.md` (filename = URL slug).
2. Frontmatter must include at least:
   - `title`, `description`, `scenario`
   - `pubDate`, `lastReviewed` (shown on the page)
   - `sources: [{ label, url }]` from BUILD_BRIEF / official pages
   - `draft: false` when ready
   - optional `startHere: true` to appear on `/start-here`
   - optional `reviewFlags: ["…"]` for unsupported safety claims or unverified specs (shown as editorial review banners)
   - optional `gearCategories` to embed product comparisons
3. Keep copy calm and practical. Prefer official guidance; do not invent urgency.
4. Run `npm run check` and open `/scenarios/your-slug`.
5. Commit, push, and deploy via Cloudflare Pages.

Drafts: set `draft: true` to exclude from listings, routes and the published collection helpers.

## How to update a product link

1. Open **`src/data/retailerOffers.json`**.
2. Find the offer `id` (or add a new offer object matching the schema).
3. Paste the **exact** programme-generated tracking URL into `url`. Do not rewrite query parameters.
4. Set `enabled: true` only after programme approval.
5. If the product comparison card should use that offer, add the offer `id` to `offerIds` on the product in **`src/data/productComparisons.json`**.
6. For Amazon: when live Associates links exist, set `amazonAssociatesLive: true` in `src/data/site.ts`.
7. Run `npm run build` and confirm the gear/scenario page shows an **Ad**-labelled link with `rel="sponsored"`.

Checklist copy lives in `src/data/checklist.ts` (grouped sections). Product comparison cards live in `src/data/productComparisons.json`.

## Preparedness features

- **`/start-here`** — inventory → checklist → core scenarios → gear
- **`/checklist`** — printable 72-hour list grouped by water/food, light/warmth, communications, hygiene, documents, household-specific needs; starts with “check what you already have”; ticks save in `localStorage` on this device only; Reset clears; works without JS for reading/printing; ads hidden in print
- **Core scenarios** — `/scenarios/power-cuts`, `/severe-weather`, `/temporary-evacuation`, `/winter-travel` with sources, last-reviewed date and review flags
- **Product comparisons** — stacked cards (who it suits, specs, limitations, tested vs researched, retailer choices after guidance)

## Project map

```
src/
  content/scenarios/          Guide Markdown
  content/gear/               Category criteria Markdown
  data/checklist.ts           Checklist groups/items
  data/productComparisons.json
  data/retailerOffers.json
  data/site.ts
  components/ProductCard.astro
  components/ProductComparison.astro
  pages/start-here.astro
  pages/checklist.astro
BUILD_BRIEF.md
```

## Accessibility and print

- Mobile-first CSS; keyboard menu with Escape to close; visible `:focus-visible`
- Print stylesheet hides header/footer, toolbars, `.ad-block`, `.product-card__buy`, `.no-print`
- No third-party tracking scripts (Google Fonts load for typography only)

## What you still need to supply

1. Affiliate programme approvals + exact tracking URLs in `retailerOffers.json`
2. Contact inbox if not `editors@uksurvivalkits.uk`
3. Cloudflare Pages DNS for `uksurvivalkits.uk`
4. Clear or rewrite any `reviewFlags` before treating those claims as published fact
5. Optional licensed photography for the hero
6. Re-verify government source URLs on publish day
