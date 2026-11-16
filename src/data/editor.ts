/**
 * SEO-9 editor bio. Copy is the FINAL text Kieran approved (relayed by the PM).
 * Do not add credentials, a photo, sameAs, or claims that he used or tested every product.
 */
import { site } from './site';

/** Visible document title without the site suffix BaseHead appends. */
export const EDITOR_TITLE = 'Kieran Littlewood, editor';

/** Meta description (120–160 characters). */
export const EDITOR_DESCRIPTION =
  'Kieran Littlewood edits UK Survival Kits. He chooses the products on the site and uses them where he can before sharing them.';

/** Person JSON-LD description, recorded for the later SEO-6 author step. */
export const EDITOR_PERSON_DESCRIPTION =
  'Editor of UK Survival Kits. Chooses the products on the site and uses them where he can before sharing them.';

/** dateModified on the bio ProfilePage; matches STATIC_PAGES_RELEASED. */
export const EDITOR_DATE_MODIFIED = '2026-11-16';

export const editor = {
  name: 'Kieran Littlewood',
  jobTitle: 'Editor',
  path: '/about/kieran-littlewood/',
  title: EDITOR_TITLE,
  description: EDITOR_DESCRIPTION,
  personDescription: EDITOR_PERSON_DESCRIPTION,
  get url() {
    return `${site.siteUrl}${this.path}`;
  },
  get personId() {
    return `${site.siteUrl}${this.path}#person`;
  },
} as const;

/** Full <title> including the site suffix, as rendered by BaseHead. */
export const editorDocumentTitle = `${EDITOR_TITLE} · ${site.name}`;

/** Person node for the bio page. Do not add this to the SEO-6 @graph in this PR. */
export function editorPersonNode() {
  return {
    '@type': 'Person',
    '@id': editor.personId,
    name: editor.name,
    url: editor.url,
    jobTitle: editor.jobTitle,
    description: editor.personDescription,
    worksFor: { '@id': `${site.siteUrl}/#organization` },
  } as const;
}

export function editorProfileJsonLd(dateModified: string) {
  const pageId = `${editor.url}#webpage`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': pageId,
        url: editor.url,
        name: editorDocumentTitle,
        description: editor.description,
        inLanguage: 'en-GB',
        dateModified,
        mainEntity: { '@id': editor.personId },
      },
      editorPersonNode(),
      {
        '@type': 'BreadcrumbList',
        '@id': `${editor.url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'About', item: `${site.siteUrl}/about/` },
          { '@type': 'ListItem', position: 3, name: editor.name, item: editor.url },
        ],
      },
    ],
  };
}
