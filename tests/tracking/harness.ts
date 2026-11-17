/** Loads src/lib/tracking/runtime.js into a happy-dom window, the way TrackingHead inlines it. */
import fs from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';

const SRC = fs.readFileSync(path.resolve('src/lib/tracking/runtime.js'), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const uksTracking = new Function(`${SRC}\nreturn uksTracking;`)() as (w: unknown, cfg: Cfg) => Api;

export interface Cfg { ga4: string | null; ads: string | null; pixel: string | null }
export interface Api {
  disabled: boolean;
  state: { analytics: boolean; advertising: boolean };
  loaded: Record<string, boolean>;
  choose: (c: { analytics: boolean; advertising: boolean }) => void;
  open: (from?: Element) => void;
  uuid: () => string;
  mapping: (c: { analytics: boolean; advertising: boolean }) => Record<string, string>;
}

export const ALL: Cfg = { ga4: 'G-TEST000000', ads: 'AW-000000000', pixel: '000000000000000' };

export const BANNER = `
<section id="uksk-consent" class="consent" aria-labelledby="uksk-consent-title" hidden>
  <h2 id="uksk-consent-title" tabindex="-1" data-consent-title>Cookies</h2>
  <button type="button" data-consent="accept">Accept all</button>
  <button type="button" data-consent="reject">Reject all</button>
  <button type="button" data-consent="manage" aria-expanded="false" aria-controls="uksk-consent-manage">Manage</button>
  <form id="uksk-consent-manage" hidden>
    <input type="checkbox" name="analytics"><input type="checkbox" name="advertising">
    <button type="submit">Save choices</button>
  </form>
</section>`;

export const PAGE = `${BANNER}
<main>
  <article class="pcard" id="torch-x" data-category="torch">
    <a id="card" class="btn btn--cta" href="https://www.amazon.co.uk/dp/B0TESTASIN?tag=example-21" rel="sponsored nofollow noopener" data-affiliate="amazon"><span id="inner">View on Amazon</span></a>
  </article>
  <table><tr><td><a id="tbl" href="https://www.amazon.co.uk/dp/B0TABLE001?tag=example-21" rel="sponsored nofollow">x</a></td></tr></table>
  <p><a id="inline" href="https://www.amazon.co.uk/dp/B0INLINE01?tag=example-21" rel="sponsored nofollow" data-category="radio">y</a></p>
  <p><a id="plain" href="https://www.amazon.co.uk/dp/B0PLAIN001">not sponsored</a></p>
  <p><a id="gov" href="https://www.gov.uk/" rel="noopener">gov</a></p>
</main>
<footer><a id="settings" href="/privacy/#cookies" data-consent-open>Cookie settings</a></footer>`;

export interface Ctx {
  win: Window & Record<string, any>;
  doc: Document;
  api: Api;
  prevented: boolean[];
  scripts: () => string[];
  dl: () => unknown[][];
  fbq: () => unknown[][];
}

export function boot(opts: { cfg?: Cfg; url?: string; stored?: unknown; html?: string; noRandomUUID?: boolean } = {}): Ctx {
  const win = new Window({
    url: opts.url ?? 'https://uksurvivalkits.uk/compare/72-hour-emergency-kits/',
    settings: { disableJavaScriptFileLoading: true, handleDisabledFileLoadingAsSuccess: true, navigation: { disableMainFrameNavigation: true } } as any,
  }) as Window & Record<string, any>;
  const doc = win.document as unknown as Document;
  doc.body.innerHTML = opts.html ?? PAGE;
  if (opts.stored !== undefined) win.localStorage.setItem('uksk-consent', JSON.stringify(opts.stored));
  Object.defineProperty(win, 'crypto', {
    value: opts.noRandomUUID ? { getRandomValues: (b: Uint8Array) => globalThis.crypto.getRandomValues(b) } : globalThis.crypto,
    configurable: true,
  });
  const api = uksTracking(win, opts.cfg ?? ALL);
  // Record whether anything cancelled the navigation before the page's own handlers finish, then
  // stop happy-dom actually navigating to Amazon so the test page (and its cookies) stay put.
  const prevented: boolean[] = [];
  for (const type of ['click', 'auxclick']) {
    doc.addEventListener(type, (e) => prevented.push(e.defaultPrevented));
    win.addEventListener(type, (e: any) => { if (e.target?.closest?.('a[href^="https://"]')) e.preventDefault(); });
  }
  return {
    prevented,
    win,
    doc,
    api,
    scripts: () => [...doc.querySelectorAll('script[src]')].map((s) => (s as HTMLScriptElement).getAttribute('src')!),
    dl: () => ((win.dataLayer ?? []) as IArguments[]).map((a) => [...a]),
    fbq: () => (win.fbq?.queue ?? []).map((a: IArguments) => [...a]),
  };
}

export function click(ctx: Ctx, id: string, init: { type?: string; button?: number; detail?: number } = {}) {
  const el = ctx.doc.getElementById(id)!;
  const { type = 'click', ...rest } = init;
  const ev = new ctx.win.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...rest });
  el.dispatchEvent(ev as unknown as Event);
  return ev;
}
