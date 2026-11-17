/** WEB-ADS-1: consent defaults, update mapping, banner, storage, preview gate, withdrawal. */
import { describe, expect, it } from 'vitest';
import { ALL, boot, click } from './harness';

const DENIED = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' };

describe('consent defaults (AC4)', () => {
  it('pushes consent default, all four v2 signals denied with wait_for_update 500, before anything else', () => {
    const c = boot();
    const dl = c.dl();
    expect(dl[0]).toEqual(['consent', 'default', { ...DENIED, wait_for_update: 500 }]);
    expect(dl).toHaveLength(1);
  });

  it('loads no Google or Meta script before interaction (AC1, basic mode)', () => {
    const c = boot();
    expect(c.scripts()).toEqual([]);
    expect(c.win.fbq).toBeUndefined();
    expect(c.doc.cookie).toBe('');
  });

  it('shows the banner (not a wall) on first visit and keeps the Manage panel closed', () => {
    const c = boot();
    expect(c.doc.getElementById('uksk-consent')!.hidden).toBe(false);
    expect(c.doc.getElementById('uksk-consent-manage')!.hidden).toBe(true);
  });

  it('the default comes before any tag script once the visitor accepts', () => {
    const c = boot();
    click(c, 'uksk-consent').target; // no-op click on the container
    c.doc.querySelector<HTMLElement>('[data-consent="accept"]')!.click();
    const dl = c.dl();
    expect(dl[0][1]).toBe('default');
    const firstJs = dl.findIndex((e) => e[0] === 'js');
    const firstUpdate = dl.findIndex((e) => e[0] === 'consent' && e[1] === 'update');
    expect(firstUpdate).toBeGreaterThan(0);
    expect(firstJs).toBeGreaterThan(firstUpdate);
  });
});

describe('consent update mapping (AC4)', () => {
  it('maps Analytics to analytics_storage and Advertising to ad_storage, ad_user_data, ad_personalization', () => {
    const { api } = boot();
    expect(api.mapping({ analytics: true, advertising: false })).toEqual({ ...DENIED, analytics_storage: 'granted' });
    expect(api.mapping({ analytics: false, advertising: true })).toEqual({
      analytics_storage: 'denied', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted',
    });
  });

  it('Accept all grants everything, loads gtag.js once, configures GA4 and Ads, hides the banner and stores the choice', () => {
    const c = boot();
    c.doc.querySelector<HTMLElement>('[data-consent="accept"]')!.click();
    const updates = c.dl().filter((e) => e[1] === 'update');
    expect(updates).toEqual([['consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' }]]);
    expect(c.scripts()).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=G-TEST000000',
      'https://connect.facebook.net/en_US/fbevents.js',
    ]);
    expect(c.dl().filter((e) => e[0] === 'config').map((e) => e[1])).toEqual(['G-TEST000000', 'AW-000000000']);
    expect(c.doc.getElementById('uksk-consent')!.hidden).toBe(true);
    const rec = JSON.parse(c.win.localStorage.getItem('uksk-consent')!);
    expect(rec).toMatchObject({ v: 1, analytics: true, advertising: true });
    expect(typeof rec.ts).toBe('number');
  });

  it('Reject all sends a denied update, loads nothing and stores the refusal', () => {
    const c = boot();
    c.doc.querySelector<HTMLElement>('[data-consent="reject"]')!.click();
    expect(c.dl().filter((e) => e[1] === 'update')).toEqual([['consent', 'update', DENIED]]);
    expect(c.scripts()).toEqual([]);
    expect(JSON.parse(c.win.localStorage.getItem('uksk-consent')!)).toMatchObject({ analytics: false, advertising: false });
  });

  it('Manage: toggles start unticked; analytics only loads gtag for GA4 and no Meta Pixel', () => {
    const c = boot();
    const manage = c.doc.querySelector<HTMLElement>('[data-consent="manage"]')!;
    manage.click();
    expect(manage.getAttribute('aria-expanded')).toBe('true');
    const an = c.doc.querySelector<HTMLInputElement>('input[name="analytics"]')!;
    const ad = c.doc.querySelector<HTMLInputElement>('input[name="advertising"]')!;
    expect(an.checked).toBe(false);
    expect(ad.checked).toBe(false);
    an.checked = true;
    c.doc.querySelector<HTMLElement>('#uksk-consent-manage button[type="submit"]')!.click();
    expect(c.api.state).toEqual({ analytics: true, advertising: false });
    expect(c.scripts()).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-TEST000000']);
    expect(c.dl().filter((e) => e[0] === 'config').map((e) => e[1])).toEqual(['G-TEST000000']);
    expect(c.win.fbq).toBeUndefined();
  });

  it('a returning visitor gets the stored choice applied in <head> and no banner', () => {
    const c = boot({ stored: { v: 1, ts: Date.now(), analytics: true, advertising: false } });
    expect(c.api.state).toEqual({ analytics: true, advertising: false });
    expect(c.doc.getElementById('uksk-consent')!.hidden).toBe(true);
    expect(c.dl()[0][1]).toBe('default');
    expect(c.dl()[1]).toEqual(['consent', 'update', { ...DENIED, analytics_storage: 'granted' }]);
  });

  it.each([
    ['an old version', { v: 0, ts: Date.now(), analytics: true, advertising: true }],
    ['an expired record (over 12 months)', { v: 1, ts: Date.now() - 366 * 864e5, analytics: true, advertising: true }],
    ['junk', 'not-json{'],
  ])('ignores %s and asks again', (_l, stored) => {
    const c = boot({ stored });
    expect(c.api.state).toEqual({ analytics: false, advertising: false });
    expect(c.scripts()).toEqual([]);
    expect(c.doc.getElementById('uksk-consent')!.hidden).toBe(false);
  });

  it('only offers categories that have an ID: no Advertising grant without Ads or Pixel IDs', () => {
    const c = boot({ cfg: { ga4: 'G-TEST000000', ads: null, pixel: null } });
    c.api.choose({ analytics: true, advertising: true });
    expect(c.api.state).toEqual({ analytics: true, advertising: false });
    expect(c.scripts()).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-TEST000000']);
  });

  it('Pixel only: no gtag or dataLayer at all', () => {
    const c = boot({ cfg: { ga4: null, ads: null, pixel: '000000000000000' } });
    expect(c.win.dataLayer).toBeUndefined();
    c.api.choose({ analytics: true, advertising: true });
    expect(c.scripts()).toEqual(['https://connect.facebook.net/en_US/fbevents.js']);
  });
});

describe('preview gate at runtime (AC6)', () => {
  it.each(['https://uksurvivalkits.pages.dev/', 'https://abc123.uksurvivalkits.pages.dev/compare/72-hour-emergency-kits/'])(
    '%s loads no tags, sets no consent state and never shows the banner',
    (url) => {
      const c = boot({ url, stored: { v: 1, ts: Date.now(), analytics: true, advertising: true } });
      expect(c.api.disabled).toBe(true);
      expect(c.win.dataLayer).toBeUndefined();
      expect(c.scripts()).toEqual([]);
      expect(c.doc.getElementById('uksk-consent')!.hidden).toBe(true);
    },
  );
});

describe('Cookie settings link and withdrawal (AC3)', () => {
  it('the footer link reopens the panel with the current choices ticked and moves focus to the heading', () => {
    const c = boot({ stored: { v: 1, ts: Date.now(), analytics: true, advertising: false } });
    const ev = click(c, 'settings');
    expect(ev.defaultPrevented).toBe(true);
    expect(c.doc.getElementById('uksk-consent')!.hidden).toBe(false);
    expect(c.doc.getElementById('uksk-consent-manage')!.hidden).toBe(false);
    expect(c.doc.querySelector<HTMLInputElement>('input[name="analytics"]')!.checked).toBe(true);
    expect(c.doc.querySelector<HTMLInputElement>('input[name="advertising"]')!.checked).toBe(false);
    expect(c.doc.activeElement?.id).toBe('uksk-consent-title');
  });

  it('withdrawing sends denied at once, disables GA, revokes the Pixel, deletes cookies and stops events, without a reload', () => {
    const c = boot();
    c.api.choose({ analytics: true, advertising: true });
    c.doc.cookie = '_ga=GA1.1.1; path=/';
    c.doc.cookie = '_ga_TEST000000=GS1; path=/';
    c.doc.cookie = '_gcl_au=1.1.1; path=/';
    c.doc.cookie = '_fbp=fb.1.1.1; path=/';
    c.doc.cookie = 'keep=1; path=/';
    click(c, 'card');
    const before = c.dl().filter((e) => e[1] === 'affiliate_click').length;
    const fbBefore = c.fbq().filter((e) => e[1] === 'AffiliateClick').length;
    expect(before).toBe(1);
    expect(fbBefore).toBe(1);

    click(c, 'settings');
    c.doc.querySelector<HTMLInputElement>('input[name="analytics"]')!.checked = false;
    c.doc.querySelector<HTMLInputElement>('input[name="advertising"]')!.checked = false;
    c.doc.querySelector<HTMLElement>('#uksk-consent-manage button[type="submit"]')!.click();

    expect(c.dl().at(-1)).toEqual(['consent', 'update', DENIED]);
    expect(c.win['ga-disable-G-TEST000000']).toBe(true);
    expect(c.win['ga-disable-AW-000000000']).toBe(true);
    expect(c.fbq().at(-1)).toEqual(['consent', 'revoke']);
    expect(c.doc.cookie).toBe('keep=1');
    click(c, 'card');
    click(c, 'card', { type: 'auxclick', button: 1 });
    expect(c.dl().filter((e) => e[1] === 'affiliate_click')).toHaveLength(before);
    expect(c.fbq().filter((e) => e[1] === 'AffiliateClick')).toHaveLength(fbBefore);
    expect(JSON.parse(c.win.localStorage.getItem('uksk-consent')!)).toMatchObject({ analytics: false, advertising: false });
    // focus returns to the link that opened the panel
    expect(c.doc.activeElement?.id).toBe('settings');
  });

  it('withdrawing only Advertising keeps analytics running and does not touch _ga', () => {
    const c = boot();
    c.api.choose({ analytics: true, advertising: true });
    c.doc.cookie = '_ga=GA1.1.1; path=/';
    c.doc.cookie = '_gcl_au=1.1.1; path=/';
    c.api.choose({ analytics: true, advertising: false });
    expect(c.doc.cookie).toBe('_ga=GA1.1.1');
    expect(c.win['ga-disable-G-TEST000000']).toBe(false);
    click(c, 'card');
    const ev = c.dl().filter((e) => e[1] === 'affiliate_click');
    expect(ev).toHaveLength(1);
    expect((ev[0][2] as Record<string, unknown>).send_to).toEqual(['G-TEST000000']);
  });

  it('re-granting after withdrawal does not reload gtag.js or re-init the Pixel', () => {
    const c = boot();
    c.api.choose({ analytics: true, advertising: true });
    c.api.choose({ analytics: false, advertising: false });
    c.api.choose({ analytics: true, advertising: true });
    expect(c.scripts()).toHaveLength(2);
    expect(c.fbq().filter((e) => e[0] === 'init')).toHaveLength(1);
    expect(c.fbq().at(-1)).toEqual(['consent', 'grant']);
    expect(c.win['ga-disable-G-TEST000000']).toBe(false);
  });
});

it('ALL fixture uses only dummy IDs', () => {
  expect(ALL).toEqual({ ga4: 'G-TEST000000', ads: 'AW-000000000', pixel: '000000000000000' });
});
