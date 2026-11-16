# Confirming Pages `_headers` are applied

`public/_headers` is copied into `dist/_headers` by the Astro build. Production `verify:dist` checks that the file contains:

- `X-Frame-Options` and a restrictive `Permissions-Policy` on `/*`
- `X-Robots-Tag: noindex` for `https://uksurvivalkits.pages.dev/*` and `https://:version.uksurvivalkits.pages.dev/*` only

Those checks cannot see the live site.

## Why some headers already appear

Cloudflare Pages always adds `Access-Control-Allow-Origin: *`, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Content-Type-Options: nosniff` on static assets. It adds `X-Robots-Tag: noindex` only on preview URLs (for example `https://<deployment-id>.uksurvivalkits.pages.dev/`), not on the production alias `https://uksurvivalkits.pages.dev/` or on custom domains. See [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/).

`X-Frame-Options`, `Permissions-Policy`, the production-alias noindex rule, and the `/_astro/*` long-cache rule are not defaults. If they are missing live, `_headers` is not being applied.

## Findings on 16 Nov 2026

At 12:22 GMT (Europe/London), after production deployment `90c790a8` of `92d317f` (Direct Upload, `_headers` passed as a form field, deploy ended 12:13:22 GMT / Europe/London):

- Apex, www and `uksurvivalkits.pages.dev` had the Pages default headers only.
- `X-Frame-Options`, `Permissions-Policy` and `X-Robots-Tag` were absent on the apex and on the production alias.
- `https://uksurvivalkits.pages.dev/_astro/BaseLayout.DHex1clx.css` and the same file on `https://90c790a8.uksurvivalkits.pages.dev/` still sent `Cache-Control: public, max-age=0, must-revalidate` (the Pages default), not `max-age=31536000, immutable`.
- The host-specific noindex patterns in the repo already match the [Pages `_headers` docs](https://developers.cloudflare.com/pages/configuration/headers/). This is not a pattern-syntax bug.

The repo has no `functions/` directory or `_worker.js`, and the site is static, so a Pages Function intercept is unlikely unless an advanced-mode worker was uploaded outside the repo.

Direct Upload must attach the file as the multipart field `_headers` ([create deployment](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/create/)). If that field is omitted, sent as a non-file text part, or dropped when retrying a failed `manifest` encoding, the deployment succeeds but the rules never run. Prefer `wrangler pages deploy dist` (it uploads `_headers` itself) or confirm the API request includes `_headers` as a file part.

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
