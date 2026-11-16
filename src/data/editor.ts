/**
 * SEO-9 editor bio. Copy is the FINAL text Kieran approved (relayed by the PM).
 * Do not add credentials, a photo, sameAs, or claims that he used or tested every product.
 * Person JSON-LD / author is a follow-up after SEO-6 (#37) and this page are live.
 */
import { site } from './site';

/** Visible document title without the site suffix BaseHead appends. */
export const EDITOR_TITLE = 'Kieran Littlewood, editor';

/** Meta description (120–160 characters). */
export const EDITOR_DESCRIPTION =
  'Kieran Littlewood edits UK Survival Kits. He chooses the products on the site and uses them where he can before sharing them.';

export const editor = {
  name: 'Kieran Littlewood',
  path: '/about/kieran-littlewood/',
  title: EDITOR_TITLE,
  description: EDITOR_DESCRIPTION,
} as const;

/** Full <title> including the site suffix, as rendered by BaseHead. */
export const editorDocumentTitle = `${EDITOR_TITLE} · ${site.name}`;
