/** WEB-ADS-2 / WEB-ADS-3: affiliate_click payload, once per click, Meta Pixel gating and event_id. */
import { describe, expect, it } from 'vitest';
import { boot, click, type Ctx } from './harness';

const events = (c: Ctx) => c.dl().filter((e) => e[0] === 'event' && e[1] === 'affiliate_click').map((e) => e[2] as Record<string, unknown>);
const fbClicks = (c: Ctx) => c.fbq().filter((e) => e[0] === 'trackCustom' && e[1] === 'AffiliateClick');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function accepted(over: Parameters<typeof boot>[0] = {}) {
  return boot({ stored: { v: 1, ts: Date.now(), analytics: true, advertising: true }, ...over });
}

describe('affiliate_click (WEB-ADS-2 AC2)', () => {
  it('sends the five params with beacon transport for a card link (click on an inner span)', () => {
    const c = accepted();
    click(c, 'inner');
    expect(events(c)).toEqual([
      {
        link_domain: 'www.amazon.co.uk',
        asin: 'B0TESTASIN',
        product_category: 'torch',
        placement: 'card',
        page_path: '/compare/72-hour-emergency-kits/',
        send_to: ['G-TEST000000', 'AW-000000000'],
        transport_type: 'beacon',
      },
    ]);
    expect(c.prevented).toEqual([false]); // never cancels navigation
  });

  it('derives placement table / inline and reads data-category from the link itself', () => {
    const c = accepted();
    click(c, 'tbl');
    click(c, 'inline');
    expect(events(c).map((e) => [e.placement, e.asin, e.product_category])).toEqual([
      ['table', 'B0TABLE001', ''],
      ['inline', 'B0INLINE01', 'radio'],
    ]);
  });

  it('prefers explicit data-asin / data-placement when present', () => {
    const c = accepted();
    const a = c.doc.getElementById('card')!;
    a.setAttribute('data-asin', 'B0OVERRIDE');
    a.setAttribute('data-placement', 'inline');
    click(c, 'card');
    expect(events(c)[0]).toMatchObject({ asin: 'B0OVERRIDE', placement: 'inline' });
  });

  it('fires once for a left click, once for a middle click (auxclick) and once for Enter (keyboard click)', () => {
    const c = accepted();
    click(c, 'card');
    expect(events(c)).toHaveLength(1);
    click(c, 'card', { type: 'auxclick', button: 1 });
    expect(events(c)).toHaveLength(2);
    // Browsers turn Enter on a focused link into a 'click' with detail 0; there is no separate key handler to double-count.
    (c.doc.getElementById('card') as HTMLElement).focus();
    click(c, 'card', { detail: 0 });
    expect(events(c)).toHaveLength(3);
    expect(fbClicks(c)).toHaveLength(3);
    expect(c.prevented.every((p) => p === false)).toBe(true);
  });

  it('ignores right clicks, non-sponsored Amazon links and non-Amazon links', () => {
    const c = accepted();
    click(c, 'card', { type: 'auxclick', button: 2 });
    click(c, 'card', { type: 'click', button: 2 });
    click(c, 'plain');
    click(c, 'gov');
    expect(events(c)).toEqual([]);
    expect(fbClicks(c)).toEqual([]);
  });

  it('sends nothing before consent or after Reject all', () => {
    const c = boot();
    click(c, 'card');
    c.api.choose({ analytics: false, advertising: false });
    click(c, 'card');
    expect(events(c)).toEqual([]);
    expect(c.win.fbq).toBeUndefined();
  });

  it('analytics only: GA4 destination only, no Pixel event', () => {
    const c = boot({ stored: { v: 1, ts: Date.now(), analytics: true, advertising: false } });
    click(c, 'card');
    expect(events(c)[0].send_to).toEqual(['G-TEST000000']);
    expect(c.win.fbq).toBeUndefined();
  });

  it('never puts the affiliate tag or the full Amazon URL in the payload', () => {
    const c = accepted();
    click(c, 'card');
    const blob = JSON.stringify([c.dl(), c.fbq()]);
    expect(blob).not.toMatch(/tag=|example-21|amazon\.co\.uk\/dp/);
  });
});

describe('Meta Pixel (WEB-ADS-3)', () => {
  it('does not exist before Advertising consent, even with analytics granted', () => {
    const c = boot();
    c.api.choose({ analytics: true, advertising: false });
    expect(c.win.fbq).toBeUndefined();
    expect(c.scripts().some((s) => s.includes('facebook'))).toBe(false);
  });

  it('after Advertising consent: grant, init, PageView with an event_id; AffiliateClick with its own event_id', () => {
    const c = boot();
    c.api.choose({ analytics: false, advertising: true });
    const q = c.fbq();
    expect(q.slice(0, 3).map((e) => e.slice(0, 2))).toEqual([['consent', 'grant'], ['init', '000000000000000'], ['track', 'PageView']]);
    const pvId = (q[2][3] as { eventID: string }).eventID;
    expect(pvId).toMatch(UUID);
    click(c, 'card');
    const [ac] = fbClicks(c);
    expect(ac[2]).toEqual({ link_domain: 'www.amazon.co.uk', asin: 'B0TESTASIN', product_category: 'torch', placement: 'card', page_path: '/compare/72-hour-emergency-kits/' });
    expect((ac[3] as { eventID: string }).eventID).toMatch(UUID);
    expect((ac[3] as { eventID: string }).eventID).not.toBe(pvId);
    // advertising-only: GA4 gets nothing, the Ads tag gets the click
    expect(events(c)[0].send_to).toEqual(['AW-000000000']);
  });

  it('event_id falls back to getRandomValues when crypto.randomUUID is missing', () => {
    const c = boot({ noRandomUUID: true });
    const ids = new Set(Array.from({ length: 50 }, () => c.api.uuid()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID);
  });
});
