/**
 * WEB-ADS-1..4 on real builds (temp copies): no tracking markup without IDs or on previews; with
 * dummy IDs the head runtime, banner, footer link, privacy cookie table and contact copy appear,
 * and the built runtime still sets consent defaults before anything else.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { buildSiteCopy, type SiteBuild } from '../helpers/site-build';

const DUMMY = { PUBLIC_GA4_ID: 'G-TEST000000', PUBLIC_GOOGLE_ADS_ID: 'AW-000000000', PUBLIC_META_PIXEL_ID: '000000000000000' };
const MARKERS = [/uksTracking/, /uksk-consent/, /googletagmanager/, /fbevents/, /data-consent-open/, /Cookie settings/, /cookie-table/, /gtag/];

function pages(dist: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) out.push(p);
    }
  };
  walk(dist);
  return out;
}
const read = (b: SiteBuild, rel: string) => fs.readFileSync(path.join(b.dist, rel), 'utf8');

let plain: SiteBuild;
let dummy: SiteBuild;
let preview: SiteBuild;

beforeAll(() => {
  plain = buildSiteCopy('webads-plain-');
  dummy = buildSiteCopy('webads-dummy-', { env: DUMMY });
  preview = buildSiteCopy('webads-preview-', { env: { ...DUMMY, CF_PAGES: '1', CF_PAGES_BRANCH: 'web-ads-1-4-tracking' } });
  for (const b of [plain, dummy, preview]) expect(b.result.status, b.result.stderr).toBe(0);
}, 240_000);

afterAll(() => {
  for (const b of [plain, dummy, preview]) b?.cleanup();
});

describe.each([
  ['no IDs (default build)', () => plain],
  ['IDs set on a Cloudflare branch preview', () => preview],
])('%s', (_l, get) => {
  it('has no tag code, banner, Cookie settings link or cookie table on any page', () => {
    const b = get();
    const files = pages(b.dist);
    expect(files.length).toBeGreaterThan(30);
    for (const f of files) {
      const html = fs.readFileSync(f, 'utf8');
      for (const m of MARKERS) expect(html, `${path.relative(b.dist, f)} ${m}`).not.toMatch(m);
    }
  });

  it('keeps today\'s footer, privacy and contact copy', () => {
    const b = get();
    expect(read(b, 'index.html')).toContain('No third-party tracking scripts on this launch build.');
    expect(read(b, 'privacy/index.html')).toContain('This launch build does not include third-party');
    expect(read(b, 'contact/index.html')).toContain('no contact form backend and no third-party tracking scripts');
  });
});

describe('dummy IDs on a production build', () => {
  it('every page carries the head runtime before any other script, and no external tag <script src>', () => {
    for (const f of pages(dummy.dist)) {
      const html = fs.readFileSync(f, 'utf8');
      const rel = path.relative(dummy.dist, f);
      const head = html.slice(0, html.indexOf('</head>'));
      const first = head.search(/<script\b/);
      expect(first, rel).toBeGreaterThan(-1);
      expect(head.slice(first, first + 200), rel).not.toMatch(/application\/ld\+json/);
      expect(head.indexOf('uksTracking'), rel).toBeGreaterThan(first);
      expect(html, rel).not.toMatch(/<script[^>]+src=["']https?:\/\/[^"']*(googletagmanager|facebook|google-analytics|doubleclick)/);
      expect(html, rel).toMatch(/<section id="uksk-consent"[^>]*hidden/);
    }
  });

  it('the built runtime pushes consent default first and loads nothing until a choice', () => {
    const html = read(dummy, 'compare/72-hour-emergency-kits/index.html');
    const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('uksTracking'))!;
    const win = new Window({ url: 'https://uksurvivalkits.uk/compare/72-hour-emergency-kits/', settings: { disableJavaScriptFileLoading: true } as never }) as never as Record<string, any>;
    win.document.write(html.replace(/<script>[\s\S]*?<\/script>/g, ''));
    new Function('window', code)(win);
    const dl = [...win.dataLayer].map((a: IArguments) => [...a]);
    expect(dl).toEqual([
      ['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500 }],
    ]);
    expect(win.document.querySelectorAll('script[src]').length).toBe(0);
    expect(win.uksConsent.disabled).toBe(false);
  });

  it('footer swaps the no-tracking text for a Cookie settings link on the same line, one disclosure line kept', () => {
    const html = read(dummy, 'index.html');
    expect(html).not.toContain('No third-party tracking scripts');
    expect(html).toMatch(/<p[^>]*>© \d{4} UK Survival Kits\. <a href="\/privacy\/#cookies" data-consent-open[^>]*>Cookie settings<\/a><\/p>/);
    expect(html.match(/data-testid="amazon-disclosure"/g)).toHaveLength(1);
  });

  it('privacy page has the #cookies section and one table row per tool; contact drops the no-tracking claim', () => {
    const html = read(dummy, 'privacy/index.html');
    expect(html).toContain('id="cookies"');
    expect(html.match(/<th scope="row"/g)).toHaveLength(3);
    expect(html).not.toContain('does not include third-party');
    const contact = read(dummy, 'contact/index.html');
    expect(contact).toContain('This site has no contact form backend.');
    expect(contact).not.toContain('no third-party tracking scripts');
  });

  it('banner offers Accept all, Reject all and Manage with one shared button style and unticked toggles', () => {
    const html = read(dummy, 'index.html');
    const banner = html.slice(html.indexOf('<section id="uksk-consent"'), html.indexOf('</section>', html.indexOf('<section id="uksk-consent"')));
    const buttons = [...banner.matchAll(/<button type="button" class="([^"]+)" data-consent="(\w+)"/g)].map((m) => [m[2], m[1]]);
    expect(buttons).toEqual([['accept', 'btn btn--secondary'], ['reject', 'btn btn--secondary'], ['manage', 'btn btn--secondary']]);
    expect(banner).not.toMatch(/checked/);
    expect(banner.match(/type="checkbox"/g)).toHaveLength(2);
  });
});
