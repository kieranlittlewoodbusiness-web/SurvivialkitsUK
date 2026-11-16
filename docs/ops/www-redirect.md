# Redirect www.uksurvivalkits.uk to the apex

Pages `_redirects` cannot do a domain-level redirect, so this has to be a zone rule in the Cloudflare dashboard, not a file in the repo.

Canonical host: `https://uksurvivalkits.uk`.

## Preferred: zone Single Redirect Rule

In the Cloudflare dashboard, open the **uksurvivalkits.uk** zone → **Rules** → **Redirect Rules** (or **Rules** → **Overview** → **Create rule** → **Redirect Rule**).

Create one Single Redirect:

- **Rule name:** `www to apex`
- **When incoming requests match:** Custom filter expression

```
http.host eq "www.uksurvivalkits.uk"
```

- **Then:**
  - **Type:** Dynamic
  - **Expression:** `concat("https://uksurvivalkits.uk", http.request.uri.path)`
  - **Status code:** `301` (Permanent Redirect)
  - **Preserve query string:** on

`http.request.uri.path` is the path only. Turning **Preserve query string** on is what keeps `?utm=…` and similar parameters. Leave it off and the query string is dropped (it is off by default).

Deploy the rule.

The rule only runs on proxied (orange-cloud) DNS. A proxied `www` record must exist. As of 16 Nov 2026, 12:22 GMT (Europe/London), `https://www.uksurvivalkits.uk/` already returned `200` from Cloudflare, so the proxied record is in place; only the redirect rule is missing. Do not replace that record unless it has been un-proxied.

Equivalent API `action_parameters`:

```json
{
  "from_value": {
    "target_url": {
      "expression": "concat(\"https://uksurvivalkits.uk\", http.request.uri.path)"
    },
    "status_code": 301,
    "preserve_query_string": true
  }
}
```

Filter expression: `http.host eq "www.uksurvivalkits.uk"`.

Reference: [Single Redirects settings](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/).

## Alternative: Bulk Redirect

Follow [Redirecting www to domain apex](https://developers.cloudflare.com/pages/how-to/www-redirect/):

1. Create a Bulk Redirect list with one entry:

   | Source URL | Target URL | Status | Parameters |
   | --- | --- | --- | --- |
   | `www.uksurvivalkits.uk` | `https://uksurvivalkits.uk` | `301` | Preserve query string; Subpath matching; Preserve path suffix; Include subdomains |

2. Create a Bulk Redirect rule that uses that list.
3. Keep (or, if missing, create) a proxied DNS record for `www`. The Pages guide uses `A www 192.0.2.1` (proxied). Prefer leaving the existing proxied `www` record alone if it already points at this Pages project.

## Post-apply curl checks

Run these from a network that can reach the public site (not a proxy that rewrites port 80). Expect a single `301` hop onto the apex, with the path and query preserved, and a final `200` on `https://uksurvivalkits.uk`.

```sh
curl -sI https://www.uksurvivalkits.uk/
# HTTP/2 301
# location: https://uksurvivalkits.uk/

curl -sI https://www.uksurvivalkits.uk/start-here/?ref=test
# HTTP/2 301
# location: https://uksurvivalkits.uk/start-here/?ref=test

curl -sI https://www.uksurvivalkits.uk/compare/72-hour-emergency-kits/
# HTTP/2 301
# location: https://uksurvivalkits.uk/compare/72-hour-emergency-kits/

curl -sI -L https://www.uksurvivalkits.uk/start-here/
# Final response: HTTP/2 200 on https://uksurvivalkits.uk/start-here/

curl -sI https://uksurvivalkits.uk/
# Still HTTP/2 200 (the apex must not redirect)
```

Also check `http://www.uksurvivalkits.uk/` if port 80 is reachable: the same rule matches on `http.host`, so it should 301 straight to `https://uksurvivalkits.uk/` (path and query preserved).
