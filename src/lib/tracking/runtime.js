/* WEB-ADS-1..4 consent + tag runtime. Classic script: inlined in <head> only when tracking is
 * enabled (see TrackingHead.astro), then called as uksTracking(window, {ga4, ads, pixel}).
 * Basic Consent Mode: no Google or Meta script is requested until the visitor opts in.
 * Never logs URLs or the affiliate tag. */
function uksTracking(w, cfg) {
  var d = w.document;
  var KEY = 'uksk-consent';
  var VERSION = 1;
  var MAX_AGE = 365 * 864e5;
  var hasGoogle = !!(cfg.ga4 || cfg.ads);
  var offerAnalytics = !!cfg.ga4;
  var offerAdvertising = !!cfg.ads;
  var state = { analytics: false, advertising: false };
  var loaded = {};
  var configured = {};
  var api = { state: state, loaded: loaded, disabled: false };

  // Runtime preview gate: *.pages.dev (production alias and previews) never loads tags or shows the banner.
  if (/(^|\.)pages\.dev$/i.test(w.location.hostname)) {
    api.disabled = true;
    return api;
  }

  function gtag() { w.dataLayer.push(arguments); }
  if (hasGoogle) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = gtag;
    // Defaults first, before any Google tag can exist on the page.
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      wait_for_update: 500,
    });
  }

  function loadScript(src, key) {
    if (loaded[key]) return;
    loaded[key] = true;
    var s = d.createElement('script');
    s.async = true;
    s.src = src;
    d.head.appendChild(s);
  }

  function mapping(c) {
    var ad = c.advertising ? 'granted' : 'denied';
    return { analytics_storage: c.analytics ? 'granted' : 'denied', ad_storage: ad, ad_user_data: ad, ad_personalization: ad };
  }
  api.mapping = mapping;

  function configure(id) {
    w['ga-disable-' + id] = false;
    if (!loaded.gtag) {
      loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id), 'gtag');
      gtag('js', new Date());
    }
    if (!configured[id]) {
      configured[id] = true;
      gtag('config', id);
    }
  }

  function deleteCookies(rx) {
    var names = (d.cookie || '').split(';').map(function (p) { return p.split('=')[0].trim(); }).filter(function (n) { return rx.test(n); });
    if (!names.length) return;
    var parts = w.location.hostname.split('.');
    var domains = [''];
    for (var i = 0; i < parts.length - 1; i++) {
      var dom = parts.slice(i).join('.');
      domains.push('; domain=' + dom, '; domain=.' + dom);
    }
    names.forEach(function (name) {
      domains.forEach(function (dm) {
        d.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + dm;
      });
    });
  }

  function apply(c) {
    var prev = { analytics: state.analytics, advertising: state.advertising };
    state.analytics = offerAnalytics && !!c.analytics;
    state.advertising = offerAdvertising && !!c.advertising;
    if (hasGoogle) gtag('consent', 'update', mapping(state));
    if (cfg.ga4) {
      if (state.analytics) configure(cfg.ga4);
      else w['ga-disable-' + cfg.ga4] = true;
    }
    if (cfg.ads) {
      if (state.advertising) configure(cfg.ads);
      else w['ga-disable-' + cfg.ads] = true;
    }
    if (prev.analytics && !state.analytics) deleteCookies(/^(_ga|_ga_.+|_gid|_gat.*)$/);
    if (prev.advertising && !state.advertising) deleteCookies(/^(_gcl_.+|_gac_.+)$/);
  }

  function read() {
    try {
      var v = JSON.parse(w.localStorage.getItem(KEY) || 'null');
      if (!v || v.v !== VERSION || typeof v.ts !== 'number' || Date.now() - v.ts > MAX_AGE) return null;
      return { analytics: !!v.analytics, advertising: !!v.advertising };
    } catch (e) {
      return null;
    }
  }

  function choose(c) {
    var rec = { v: VERSION, ts: Date.now(), analytics: offerAnalytics && !!c.analytics, advertising: offerAdvertising && !!c.advertising };
    try { w.localStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) { /* storage blocked: choice applies to this page only */ }
    apply(rec);
    hide();
  }
  api.choose = choose;

  function affiliateParams(a) {
    var u;
    try { u = new URL(a.href); } catch (e) { return null; }
    var m = /\/dp\/([A-Z0-9]{10})(?:[/?#]|$)/.exec(u.pathname + '/');
    var catEl = a.closest('[data-category]');
    var placement = a.getAttribute('data-placement') ||
      (a.closest('.pcard, .pick') ? 'card' : a.closest('table') ? 'table' : 'inline');
    return {
      link_domain: u.hostname,
      asin: a.getAttribute('data-asin') || (m ? m[1] : ''),
      product_category: (catEl && catEl.getAttribute('data-category')) || '',
      placement: placement,
      page_path: w.location.pathname,
    };
  }
  api.affiliateParams = affiliateParams;

  function onClick(e) {
    if (e.type === 'click' ? e.button !== 0 : e.button !== 1) return;
    var t = e.target;
    var a = t && t.closest ? t.closest('a[rel~="sponsored"][href*="amazon."]') : null;
    if (!a) return;
    var targets = [];
    if (cfg.ga4 && state.analytics) targets.push(cfg.ga4);
    if (cfg.ads && state.advertising) targets.push(cfg.ads);
    if (!targets.length) return;
    var p = affiliateParams(a);
    if (!p) return;
    if (targets.length) {
      gtag('event', 'affiliate_click', {
        link_domain: p.link_domain, asin: p.asin, product_category: p.product_category,
        placement: p.placement, page_path: p.page_path, send_to: targets, transport_type: 'beacon',
      });
    }
  }
  // Capture phase, passive: never delays or cancels navigation. Enter on a link fires 'click'.
  d.addEventListener('click', onClick, { capture: true, passive: true });
  d.addEventListener('auxclick', onClick, { capture: true, passive: true });

  // Returning visitor: apply the stored choice straight away (still before any tag loads).
  var stored = read();
  if (stored) apply(stored);

  // Banner wiring.
  var box, panel, opener;
  function q(sel) { return box ? box.querySelector(sel) : null; }
  function setManage(open) {
    if (!panel) return;
    panel.hidden = !open;
    var b = q('[data-consent="manage"]');
    if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var an = q('input[name="analytics"]');
      var ad = q('input[name="advertising"]');
      if (an) an.checked = state.analytics;
      if (ad) ad.checked = state.advertising;
    }
  }
  function show(manage) {
    if (!box) return;
    box.hidden = false;
    setManage(!!manage);
  }
  function hide() {
    if (!box || box.hidden) return;
    var hadFocus = box.contains(d.activeElement);
    box.hidden = true;
    if (hadFocus && opener && opener.focus) opener.focus();
    opener = null;
  }
  api.open = function (from) {
    opener = from || null;
    show(true);
    var h = q('[data-consent-title]');
    if (h && h.focus) h.focus();
  };
  function wire() {
    box = d.getElementById('uksk-consent');
    if (!box) return;
    panel = q('#uksk-consent-manage');
    box.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-consent]') : null;
      if (!b) return;
      var act = b.getAttribute('data-consent');
      if (act === 'accept') choose({ analytics: true, advertising: true });
      else if (act === 'reject') choose({ analytics: false, advertising: false });
      else if (act === 'manage') setManage(panel ? panel.hidden : false);
    });
    if (panel) {
      panel.addEventListener('submit', function (e) {
        e.preventDefault();
        var an = q('input[name="analytics"]');
        var ad = q('input[name="advertising"]');
        choose({ analytics: !!(an && an.checked), advertising: !!(ad && ad.checked) });
      });
    }
    d.addEventListener('click', function (e) {
      var l = e.target && e.target.closest ? e.target.closest('[data-consent-open]') : null;
      if (!l) return;
      e.preventDefault();
      api.open(l);
    });
    if (!stored) show(false);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', wire);
  else wire();
  api.wire = wire;
  return api;
}
