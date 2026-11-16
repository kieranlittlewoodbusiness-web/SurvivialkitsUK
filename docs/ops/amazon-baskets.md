# Amazon UK one-click baskets (S1-12)

Code: `src/lib/basket/`. Data: `src/data/starter-kit/starterKit.json`. Tests: `tests/basket/basket.test.ts`.

## Mechanism

Amazon's "Add to Cart form" takes a GET to `https://www.amazon.co.uk/gp/aws/cart/add.html` with
`ASIN.n` / `Quantity.n` pairs. Amazon shows the visitor a confirmation page ("add these items to your
basket?") before anything goes into their basket.

Source: [Add to Cart form, PA-API 5 docs](https://webservices.amazon.com/paapi5/documentation/add-to-cart-form.html), read 16 Nov 2026:

> "The 'Add to Cart' form enables you to add any number of items to a customer's shopping cart."
>
> "you must specify quantity and at least one of the following parameters: ASIN or OfferListingId. AssociateTag is must for attribution"

The page lists `AssociateTag` as required and suggests opening the form in a new window. It now also
shows a PA-API 5 deprecation notice (it is being replaced by the Creators API). We have no PA-API or
Creators API access, so we cannot use `OfferListingId`. That means we cannot pin the Buy Box seller we
checked: Amazon adds whichever offer is the featured offer when the visitor clicks.

## Associates UK agreement and help pages (read 16 Nov 2026)

- [Linking Requirements](https://affiliate-program.amazon.co.uk/help/operating/linking):
  > "Links promoting a particular Product must connect directly to the detail page for that Product on the Amazon Sites."

  > "you must include your Associates ID or 'tag' (appearing as XXXXX-21...) as a parameter in the URL of each link."

  **Risk:** a basket link goes to the cart-add confirmation page, not a product detail page. Whether
  a basket link counts as "promoting a particular Product" is not settled by the text. Kieran should
  ask Associates support before the basket button goes live.
- [Operating Agreement](https://affiliate-program.amazon.co.uk/help/operating/agreement):
  > "The links must properly use the special 'tagged' link formats we provide and comply with this Agreement ('Special Links')."

  The agreement does not mention cart or Add to Cart links. The only documentation of this format is
  on the PA-API page above.
- [Policies / Commission Income Statement](https://affiliate-program.amazon.co.uk/help/operating/policies):
  commission follows a 24-hour session from the Special Link click. A purchase also qualifies when
  "the customer purchases a Product by adding a Product to his or her shopping cart and completing the order for that Product no later than 89 days after their initial click-through of the Special Link".
  Adding the basket during the session therefore extends the attribution window for those items.
- [Participation Requirements](https://affiliate-program.amazon.co.uk/help/operating/participation):
  - item 19 bans any action that could cause "customer confusion as to our relationship with you, or as to the site on which any functions or transactions (e.g., search, browse, or order) are occurring". The button must say it adds the items to an Amazon basket, open amazon.co.uk in a new tab, and carry the disclosure.
  - item 17 bans ordering on behalf of others.

No UK help page we found explicitly allows or forbids the cart form, and none sets a cap on the
number of items.

## Gate

The tag is added only when `basketTag(env)` passes. That is the same rule as product buttons:

- the programme is approved;
- `isProductionLinkBuild(env)` passes (SITE_ENV=production and not a Cloudflare branch preview);
- `AMAZON_ASSOCIATES_UK_TAG` matches `TRACKING_ID_PATTERN`.

Otherwise `basketLink` returns `null`, and no basket button renders. We chose not to render a
tagless link in preview or dev for three reasons:

- Amazon says the tag is required for attribution, so a tagless link is not a Special Link;
- it matches product cards, which have no buttons in preview;
- preview `check:links` expects zero affiliate links.

`buildCartAddUrl(asins, null)` still gives a tagless URL for docs and tests.

## Audit trail rule

`availability_text_seen` and `delivery_quote_seen` record what the product page said when it was
checked. They are evidence only and must never be rendered. No prices or images are stored.

## Keeping it fresh

The Buy Box seller and stock change. Re-run the buyability check on all starter items before each
release, update `buyability.checked_at`, and move any item that fails to `gaps`. Do not lower the bar.
