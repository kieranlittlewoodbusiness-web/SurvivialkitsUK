// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { site } from './src/data/site.ts';
import { contentLastmodMap, lastmodFor } from './src/lib/seo/lastmod.ts';

// Static output for Cloudflare Pages (`dist`).
//
// SEO-2: trailingSlash 'always'. With build.format 'directory' every route is emitted as
// `<route>/index.html`, which Cloudflare Pages serves with a 200 at `/<route>/` and 308-redirects
// from `/<route>`. Canonicals, og:url, sitemap URLs and internal links therefore all use the
// trailing-slash form (checked by scripts/check-trailing-slash.mjs).
const lastmods = contentLastmodMap(fileURLToPath(new URL('./src/content', import.meta.url)));

export default defineConfig({
  site: site.siteUrl,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
      serialize(item) {
        // URLs keep the trailing slash the sitemap integration emits (matches each canonical).
        item.lastmod = lastmodFor(item.url, lastmods);
        return item;
      },
    }),
  ],
});
