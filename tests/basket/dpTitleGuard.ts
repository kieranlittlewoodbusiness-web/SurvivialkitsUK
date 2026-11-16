/**
 * QA guard (16 Nov 2026): an ASIN can be reused by Amazon for a different product (Duronic
 * B002XNGTOI now shows a CT51 car tool). Every verified record carries a line in its evidence note:
 *   dp_title_checked <ISO time>; brand on page "<brand>"; title "<dp page title>".
 * The recorded title must name the record's brand (or the page's brand line must) and share a
 * name or model token with the record, so a reused ASIN is caught when its title is re-recorded.
 */
const DP_LINE = /dp_title_checked (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z); brand on page "([^"]*)"; title "([^"]+)"\./;
const STOP = new Set(['with', 'and', 'pack', 'the', 'for', 'from', 'one', 'set', 'kit', 'black', 'white', 'silver', 'size', 'green', 'blue', 'grey', 'portable', 'large', 'small', 'emergency', 'water']);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+\-/]+/).filter(Boolean);

export interface DpTitleCheck {
  checkedAt: string;
  pageBrand: string;
  title: string;
}

export function readDpTitleCheck(note: string): DpTitleCheck | null {
  const m = DP_LINE.exec(note);
  return m ? { checkedAt: m[1], pageBrand: m[2], title: m[3] } : null;
}

/** Returns the reasons the recorded dp title does not match the record (empty = match). */
export function dpTitleMismatch(rec: { brand: string; names: string[]; models: (string | null | undefined)[] }, dp: DpTitleCheck): string[] {
  const out: string[] = [];
  const brandTokens = words(rec.brand).map(norm).filter((w) => w.length >= 3);
  const seen = new Set(words(`${dp.title} ${dp.pageBrand}`).map(norm));
  if (!brandTokens.some((w) => seen.has(w))) out.push(`brand "${rec.brand}" not in the dp title or page brand`);
  const titleWords = new Set(words(dp.title).map(norm));
  const flat = norm(dp.title);
  const candidates = [...rec.names.flatMap((n) => words(n)).map(norm), ...rec.models.filter((m): m is string => !!m).map(norm)].filter(
    (w) => w.length >= 4 && !brandTokens.includes(w) && !STOP.has(w),
  );
  if (!candidates.some((w) => titleWords.has(w) || (/\d/.test(w) && flat.includes(w)))) out.push('no name or model token from the record appears in the dp title');
  return out;
}
