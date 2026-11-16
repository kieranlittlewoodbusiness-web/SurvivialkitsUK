# Confirming Pages `_headers` are applied

`public/_headers` is copied into `dist/_headers` by the Astro build. Production `verify:dist` checks that the file contains:

- `X-Frame-Options` and a restrictive `Permissions-Policy` on `/*`
- `X-Robots-Tag: noindex` for `https://uksurvivalkits.pages.dev/*` and `https://:version.uksurvivalkits.pages.dev/*` only

Those checks cannot see the live site.

## Why some headers already appear

Cloudflare Pages always adds `Access-Control-Allow-Origin: *`, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Content-Type-Options: nosniff` on static assets. It adds `X-Robots-Tag: noindex` only on preview URLs (for example `https://<deployment-id>.uksurvivalkits.pages.dev/`), not on the production alias `https://uksurvivalkits.pages.dev/` or on custom domains. See [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).

`X-Frame-Options`, `Permissions-Policy`, the production-alias noindex rule, and the `/_astro/*` long-cache rule are not defaults. If they are missing live, `_headers` is not being applied.

## Findings on 16 Nov 2026

At 16:01 GMT (Europe/London), current production deployment `b439afaf` applies `_headers` correctly. Apex and `uksurvivalkits.pages.dev` both serve `X-Frame-Options: DENY` and `permissions-policy: interest-cohort=()`. `uksurvivalkits.pages.dev` also serves `x-robots-tag: noindex`, and the apex doesn't. `/_astro/BaseLayout.DHex1clx.css` returns `Cache-Control: public, max-age=31536000, immutable` on both hosts. Our Direct Upload sends `_headers` as its own form field, which is correct. There is no deploy fault.

An earlier check at 12:22 GMT (Europe/London) saw only the Pages defaults. That reading was taken against an older deployment and is superseded by the 16:01 check above.

The only repo change needed is the Permissions-Policy. `interest-cohort=()` is obsolete, so this branch replaces it with a restrictive policy. `verify:dist` now asserts that policy, `X-Frame-Options` and the pages.dev-only noindex rules in `dist/_headers`.

## Post-deploy curl checks

After the next production deploy, curl the apex, the production alias, and a versioned preview. Expect `X-Frame-Options: DENY` and `Permissions-Policy` (including `camera=()`, `microphone=()`, `geolocation=()`, `payment=()`, `usb=()`) on all three, and `X-Robots-Tag: noindex` on both Pages hosts only — never on `https://uksurvivalkits.uk/`.

```sh
curl -sI https://uksurvivalkits.uk/ | grep -iE '^(HTTP/|x-frame-options|permissions-policy|x-robots-tag):'
# HTTP/2 200
# x-frame-options: DENY
# permissions-policy: … camera=() … (no x-robots-tag)

curl -sI https://uksurvivalkits.pages.dev/ | grep -iE '^(HTTP/|x-frame-options|permissions-policy|x-robots-tag):'
# HTTP/2 200
# x-frame-options: DENY
# permissions-policy: …
# x-robots-tag: noindex

curl -sI "https://<deployment-id>.uksurvivalkits.pages.dev/" | grep -iE '^(HTTP/|x-frame-options|permissions-policy|x-robots-tag):'
# Same as the production alias (preview URLs already get noindex by default)

curl -sI https://uksurvivalkits.pages.dev/_astro/BaseLayout.*.css | grep -i '^cache-control:'
# cache-control: public, max-age=31536000, immutable
```

On the apex, `/_astro/*` may still show a shorter `max-age` if a zone Browser Cache TTL or Cache Rule overlays Pages (the apex CSS was `max-age=14400` on 16 Nov 2026). Trust the **pages.dev** CSS header as the check that `_headers` itself is applied; then inspect zone cache settings if the apex differs.

This site does not embed itself, so `X-Frame-Options` stays `DENY`.
