# The Household Brief

UK civilian household preparedness site: serious editorial guides for outages, severe weather, supply disruption and temporary evacuation. Built with **Astro** and **TypeScript**, published as a **static** site to **Cloudflare Pages** (`npm run build` → `dist`).

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

Set the production domain in `src/data/site.ts` (`siteUrl`) so canonical URLs, Open Graph tags and `robots.txt` stay correct.

## Content publishing

### Scenario articles

1. Add a Markdown file under `src/content/scenarios/`.
2. Frontmatter must satisfy `src/content.config.ts` (`title`, `description`, `scenario`, `pubDate`, optional `draft`, `sources`, etc.).
3. Set `draft: true` to keep a piece out of production listings, routes and the sitemap filter of published collections.
4. Run `npm run build` and confirm the page appears under `/scenarios/<filename-without-extension>`.

### Gear criteria pages

1. Add Markdown under `src/content/gear/`.
2. Set `category` to one of: `torches`, `power-banks`, `radios`, `water-storage`, `first-aid`, `winter-travel`.
3. List comparison `criteria` as an array of strings.
4. Build and open `/gear/<id>`.

### Affiliate / retailer offers

1. Edit **`src/data/retailerOffers.json`** only (validated by `src/lib/retailerOffers.ts`).
2. Paste the **exact** programme-generated tracking URL into `url`. Do not rewrite query parameters.
3. Set `enabled: true` only after programme approval **and** when the URL is final.
4. For Amazon: after Associates approval and live Special Links, set `amazonAssociatesLive: true` in `src/data/site.ts`. The Amazon Associates statement then appears prominently on pages that include live Amazon offers.
5. Affiliate anchors are rendered by `AffiliateLink.astro` with `rel="sponsored noopener noreferrer"`. Commercial blocks use `AdBlock.astro`, which shows an **Ad** label before links.

### Drafts

- `draft: true` entries are excluded by `getPublishedScenarios()` / `getPublishedGear()` and therefore omitted from indexes, `getStaticPaths`, and normal navigation.
- A sample draft lives at `src/content/scenarios/_draft-example-not-published.md`.

## Project map

```
src/
  content/scenarios/   Article Markdown
  content/gear/        Category criteria Markdown
  data/site.ts         Brand + production domain flags
  data/retailerOffers.json
  components/          Header, Footer, AdBlock, AffiliateLink, …
  layouts/BaseLayout.astro
  pages/               Routes including 404, robots.txt.ts
public/images/         Original SVG hero (licensed as project original)
BUILD_BRIEF.md         Product / editorial brief
```

## Accessibility and layout notes

- Mobile-first CSS; sticky header with keyboard-operable menu (`aria-expanded`, Escape closes).
- Visible `:focus-visible` outlines; skip link to `#main`.
- Checklist is printable via browser print CSS.
- No third-party tracking scripts in the launch build (Google Fonts are loaded for typography only).

## What you still need to supply

1. **Confirmed production domain** (update `siteUrl` if not `https://www.thehouseholdbrief.co.uk`).
2. **Affiliate programme approvals** and exact tracking URLs in `retailerOffers.json`.
3. **Contact inbox** if `editors@thehouseholdbrief.co.uk` is not the real address.
4. Optional: replace the original SVG hero with licensed photography (keep full-bleed treatment).
5. Re-verify government source URLs on publish day (campaign PDF paths change).

## Licence note for images

`public/images/hero-hall.svg` and `public/favicon.svg` are original project artwork created for this site.
