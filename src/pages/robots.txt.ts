import type { APIRoute } from 'astro';
import { site, isPreviewBuild } from '../data/site';

// Previews (see isPreviewBuild) disallow all crawling; production stays indexable.
export const GET: APIRoute = () => {
  const body = isPreviewBuild()
    ? `# Preview build: not for search engines.
User-agent: *
Disallow: /
`
    : `User-agent: *
Allow: /

Sitemap: ${site.siteUrl}/sitemap-index.xml
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
