// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site, comparePath } from './src/data/site.ts';

// Static output for Cloudflare Pages (`dist`).
//
// trailingSlash is 'ignore' (was 'never') so `/compare/72-hour-emergency-kits/` can be served with
// its trailing slash. Build output (build.format 'directory') is unchanged, so every existing route
// emits the same files as before.
export default defineConfig({
  site: site.siteUrl,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
      serialize(item) {
        // Match each page's canonical URL: existing routes stay slash-less (as under 'never');
        // the home page and the comparison page keep their trailing slash.
        const keepSlash = new Set([`${site.siteUrl}/`, new URL(comparePath, site.siteUrl).href]);
        if (!keepSlash.has(item.url)) item.url = item.url.replace(/\/$/, '');
        return item;
      },
    }),
  ],
});
