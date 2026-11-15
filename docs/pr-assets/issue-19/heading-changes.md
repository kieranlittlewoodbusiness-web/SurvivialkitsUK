## Heading and eyebrow changes (copy only; facts unchanged)

### /start-here
- `<title>`: "Start Here" → "Start here" (tab title is now "Start here · U.K. Survival Kit Brief")
- Eyebrow: "Start Here" → "Start here"
- h1: already sentence case ("Start with what you already own") — unchanged
- Step 1 heading: "1. Inventory the house" → "1. Check what you already have"
- Step 1 body: "Open cupboards and drawers. Note torches, water, food, medication, radio and blankets you already have." → "Look through your cupboards and drawers and note any torches, water, food, medicines, radios and blankets you already own."
- Step 4 heading: "4. Compare kit only for real gaps" → "4. Buy only what you’re missing"
- Step 4 body: "Use gear criteria and product comparison cards after the guidance. Buying links are labelled Ad and sit below the criteria they support." → "Once you know what you are missing, use the 72-hour kit guide to fill those gaps only."
- Step 4 link: "Browse gear criteria →" (`/gear`) → "Get prepared here" CTA to `/compare/72-hour-emergency-kits/`, using the shared `GetPreparedCta` component (same `.btn` styles as the nav CTA)

### Rest of the site
- `/checklist` next-step link: "Start Here" → "Start here"
- Compare page document title: "72-Hour Emergency Kit UK: What to Pack and Essentials Compared" → "72-hour emergency kit UK: what to pack and essentials compared" (h1 was already sentence case; facts unchanged)
- `.eyebrow` CSS: removed `text-transform: uppercase` so sentence-case labels are visible. Page eyebrows such as "Start here", "Checklist", "Sources", "About", "Gear criteria" now render as written. The home hero `.kicker` and footer headings keep their uppercase typographic treatment. Ad-block labels are unchanged.

### Checked and left unchanged
- Other page titles and h1s were already sentence case or a single word (Privacy, Contact, Method, About, Sources, Editorial policy, Affiliate disclosure, Page not found).
- "Amazon Associates" is a proper name.
- Scenario and gear titles were already sentence case.
- Brand name "U.K. Survival Kit Brief" is unchanged.
