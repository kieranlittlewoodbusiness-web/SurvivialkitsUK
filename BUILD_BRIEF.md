# Build Brief: The Household Brief

**Working brand name:** The Household Brief  
**Tagline:** Practical household planning for disruption  
**Stack:** Astro + TypeScript on Cloudflare Pages  
**Monetisation:** UK retailer affiliate links with ASA-compliant disclosure  
**Tone:** Serious editorial. Calm, specific, sourced. No threat forecasts, no countdown urgency, no weapons.

This brief is the build contract for Cursor Agent. Prefer government and Red Cross guidance over retailer copy. Translate uncertainty into household logistics: outages, severe weather, supply gaps, and temporary evacuation.

---

## 1. Brand, audience, homepage, visual direction

### Brand

**The Household Brief** presents preparedness as ordinary domestic competence: knowing what you already own, writing down contacts, and filling a few gaps over ordinary shopping trips. The name should appear as a hero-level signal on the homepage—not only in the nav.

Positioning line for About/meta: *Independent guides to household readiness in the UK, grounded in official advice and practical product criteria.*

Avoid: “bug-out”, “SHTF”, “prepper”, “survive the collapse”, “arm yourself”, panic stockpiling, invented deadlines.

### Audience

Primary readers:

- UK householders (England, Scotland, Wales; note NI differences where relevant)
- Renters and owners with limited storage and budgets
- Parents, carers, and people supporting neighbours who need extra help
- Rural and flood-risk households who already experience weather-related disruption
- Readers who want calm planning, not lifestyle survivalism

Secondary: local community organisers, workplace wellbeing leads linking staff to official guidance.

Assumptions to design for: mixed broadband reliability; mobile-first reading during warnings; preference for items available from mainstream UK retailers; distrust of hard-sell affiliate sites.

### Homepage layout (one composition, first viewport)

**Hero (full-bleed visual plane):** edge-to-edge photograph of a real UK domestic interior—hall table at dusk with a torch, paper contact list, charged power bank, rain visible through a door glass, or a kitchen cupboard being checked with ordinary tinned food. Brand name large; one headline; one supporting sentence; one CTA group (e.g. *Start with what you own* → 72-hour checklist; *Browse scenarios* → articles). No cards, badges, stats strips, or floating callouts on the image.

**Below the fold (one job per section):**

1. **Why this exists** — short editorial note: UK guidance asks households to prepare for a few days of disruption so responders can prioritise those most in need; global supply and climate pressures make ordinary shocks more common—cite sources, do not predict events.
2. **Four household scenarios** — text-led links (power cut; flood/storm; water interruption; leave-home bag), not product grids.
3. **72-hour checklist preview** — three steps starting with “check cupboards”; link to full checklist.
4. **Gear criteria** — six category links (torches, power banks, radios, water storage, first-aid, winter travel) framed as comparison criteria, not “must-buy now”.
5. **Sources & method** — how we label government guidance vs firsthand tests vs affiliate links.
6. **Footer** — emergency numbers (999 / 111 / 105 / Floodline), PSR link, Scottish/England-Wales source split, cookie/affiliate disclosure, sitemap.

### Visual direction

**Direction:** Quiet British editorial—indoor light after rain, slate ink type, paper texture under content, restrained motion. Not a dashboard; not a catalogue splash.

**CSS variables (proposed):**

| Token | Role | Suggested value |
| --- | --- | --- |
| `--ink` | Body text | `#1C2429` |
| `--paper` | Page field | `#E8EDF0` with subtle grain/noise, not flat white |
| `--field` | Content panels | `#F4F7F8` |
| `--signal` | Accent (links, CTA) | `#0F5C4C` deep teal-green |
| `--warn` | Weather/alert callouts only | `#8A5A12` amber-brown |
| `--line` | Rules | `#C5CED4` |

**Typography:** Expressive pairing—display serif for brand/headlines (e.g. Freight Text / Source Serif / similar licensed alternative), humanist sans for body (e.g. Source Sans 3 / IBM Plex Sans). Avoid Inter, Roboto, Arial, system-only stacks as the design voice.

**Atmosphere:** Soft vertical gradient from cool window-light blue-grey into warmer indoor paper; optional faint map-contour or linen pattern in CSS. Hero photography is the main visual idea—product shots belong in gear pages only.

**Motion (2–3 intentional):** (1) hero image slow Ken Burns or rain opacity drift; (2) checklist rows reveal on scroll; (3) CTA underline draw on hover. No glow, no bounce, no emoji.

**Hard avoids:** purple-indigo gradients; warm cream + terracotta + display serif cliché; broadsheet dense columns with hairline rules; dark-mode-first; rounded-full pills; multi-layer shadows; card grids in the hero.

---

## 2. Editorial principles (site-wide)

1. Lead with **official guidance**, then household practice, then optional gear criteria.
2. Start every kit article with **inventory what you already own**.
3. Prefer **gradual top-ups** on normal shops; never “buy before it’s too late”.
4. Separate **England/Wales** flood systems (Environment Agency) from **Scotland** (SEPA Floodline / Ready Scotland).
5. Mention **global uncertainty** only with a sourced frame (e.g. government resilience campaigns; climate-driven severe weather frequency from Met Office context)—never as prophecy.
6. No weapons, ammunition, tactical kit framing, or illegal items.
7. Affiliate product mentions: clear **Ad** labelling per ASA/CAP; editorial criteria pages may list criteria without links, then a labelled “Where to buy” block.
8. Accessibility: printable checklist PDF/HTML; large tap targets; high contrast; skip-link; respect `prefers-reduced-motion`.

---

## 3. Ten original article briefs

Each article: working title, household scenario, angle, must-cite sources, affiliate opportunity, verification flags.

### 1. Power cut evening: light, heat, and information without draining your phone

- **Scenario:** Multi-hour (or overnight) electricity outage at home.
- **Angle:** Torches beat candles; write 105 on paper; radio for updates; keep warm with layers/blankets; unplug surge-sensitive kit; check PSR eligibility.
- **Sources:** Prepare – power cuts; Prepare – get prepared; Ready Scotland emergency kit.
- **Affiliate:** Torches, spare batteries, wind-up/battery radios, power banks—after “use what you own”.
- **Verify:** Confirm NI reporting number (03457 643643) still current; load-block letter tooling at powercut105.com.

### 2. Checking the cupboard first: building three days of food without a speciality shop

- **Scenario:** Stay-home disruption when shops or cooking are limited.
- **Angle:** Audit existing non-perishables; buy what you already eat; tin opener; dietary/baby/pet needs; six-month review.
- **Sources:** Be Ready / National Resilience Checklist; Prepare kit list; Ready Scotland kit.
- **Affiliate:** Minimal—can openers, sealed storage, if needed; avoid panic bulk lists.
- **Verify:** Water litres/person/day (checklist states 3 L drinking; hygiene needs more)—quote precisely per source.

### 3. When the tap runs cloudy: household water interruption and boil notices

- **Scenario:** Burst main, treatment issue, or advice to boil water.
- **Angle:** Stored bottled water vs filling clean containers before a known shut-off; hygiene with wet wipes/sanitiser; Scottish Water text alerts; don’t drink floodwater.
- **Sources:** Prepare kit water guidance; Ready Scotland / Scottish Water alerts; local water company advice pages (link by nation).
- **Affiliate:** Food-grade water carriers, collapsible jugs—criteria over brand hype.
- **Verify:** Per-nation water company contacts; never invent boil-notice rules—link to supplier.

### 4. Amber on the map: what to do the day before a Met Office warning

- **Scenario:** Yellow/Amber weather warning covering the reader’s area.
- **Angle:** Read the warning *impact text*; charge devices; check travel; move cars if flood risk; review kit; no need to empty shops.
- **Sources:** Met Office UK warnings explainer; Met Office heavy rain safety; Prepare campaign toolkit “sign up for warnings”.
- **Affiliate:** Power banks, weather-radio only if gaps identified.
- **Verify:** Warning colour meanings unchanged; deep-link to live warnings, not screenshots that age.

### 5. Flood alert to flood warning: England and Wales household steps

- **Scenario:** Environment Agency flood alert or warning for the postcode.
- **Angle:** Alert vs warning vs severe; personal flood plan; move documents/meds up; turn off utilities if safe; never drive through floodwater; Floodline.
- **Sources:** GOV.UK flood alerts/warnings; GOV.UK help during flood; Met Office rain safety.
- **Affiliate:** Waterproof document pouches, battery lanterns—not “flood barriers” as miracle products unless criteria + official context.
- **Verify:** Warning lead times; National Flood Forum links; local council evacuation advice varies.

### 6. Floodline and the Scottish kit bag: preparing north of the border

- **Scenario:** SEPA flood messaging / Ready Scotland planning for Scottish households.
- **Angle:** Sign up to Floodline; Ready Scotland plan PDF; waterproof grab items; Scottish Water / NHS 24 numbers; rural snow cut-off context without alarmism.
- **Sources:** Ready Scotland flooding; Ready Scotland emergency kit & plan; SEPA Floodline registration.
- **Affiliate:** Same core kit categories; note Scottish retailer availability where tested.
- **Verify:** SEPA beta site URLs vs long-term stable URLs before publish; Floodline 0345 988 1188.

### 7. The leave-home bag: temporary evacuation without drama

- **Scenario:** Told to leave for flooding, fire aftermath, or gas incident—hours, not “off-grid life”.
- **Angle:** Grab bag for documents, meds, charger, water, snacks, keys, glasses; fire escape = take nothing; meeting point; ICE/Medical ID on phone.
- **Sources:** Prepare get-prepared (grab bag language); Ready Scotland waterproof bag note; GOV.UK flood evacuate advice.
- **Affiliate:** Soft waterproof duffel/dry bag, compact first-aid—criteria page.
- **Verify:** Distinguish fire evacuation (leave possessions) from planned flood leave.

### 8. Winter car shelf: stuck on a UK road in snow or ice

- **Scenario:** Short winter delay or immobilisation; not expedition motoring.
- **Angle:** Avoid non-essential travel; Traffic Scotland / national traffic info; boot kit: torch, warm layers, hi-vis, scraper/de-icer, shovel, jump leads, water/snacks, first aid, phone charge lead.
- **Sources:** Ready Scotland car emergency kit; Prepare winter car note; Met Office travel-in-severe-weather pages (verify URL at build).
- **Affiliate:** Hi-vis, compact shovel, blanket/sleeping bag rated for car storage.
- **Verify:** Legal hi-vis/warning triangle expectations if mentioned; don’t invent legal duties.

### 9. Neighbours and the Priority Services Register: planning for people who need extra support

- **Scenario:** Household includes (or supports) someone who needs power for medical devices, or older neighbours.
- **Angle:** PSR / Customer Care Registers; telecare behaviour in outages; paper meds list; shared contact tree; community check-ins when safe.
- **Sources:** Prepare PSR guidance (thepsr.co.uk); Prepare power cuts telecare notes; Ready Scotland accessible planning.
- **Affiliate:** Usually none—service article. Optional power-bank criteria for device charging only with clinical caution: *ask device provider*.
- **Verify:** PSR eligibility language; NI Customer Care Register naming.

### 10. Six-month kit review: expiry dates, batteries, and changing households

- **Scenario:** Routine maintenance after moving, new baby, new pet, or seasonal change.
- **Angle:** Calendar reminder; rotate food/water; test torch/radio; update plan PDF; school contact numbers; insurance docs.
- **Sources:** National Resilience Checklist “check every six months”; Ready Scotland “keep plan up to date”.
- **Affiliate:** Replacement batteries, refreshed first-aid consumables—soft sell.
- **Verify:** Any dated campaign PDFs (Be Ready checklist path includes dated CMS paths—re-check live URL).

---

## 4. Seventy-two-hour checklist (starts with what readers own)

Mirror official “see what you already have” framing. Present as interactive checklist + printable page. Default horizon: **up to three days** of disruption while support reaches those most in need.

### Step A — Inventory (do this first; buy nothing yet)

Walk the house with a notepad or the on-page checklist:

| Already own? | Item |
| --- | --- |
| ☐ | Working torch (not only phone light) + spare batteries or wind-up |
| ☐ | Warm blankets / sleeping bags / spare layers |
| ☐ | Battery or wind-up FM radio (or noted plan to use car radio only if safe) |
| ☐ | Charged power bank + leads |
| ☐ | Bottled water or clean sealed containers you can fill |
| ☐ | Ready-to-eat food you already buy (tins, nuts, fruit bars, etc.) + tin opener |
| ☐ | Essential medication (several days) + written doses |
| ☐ | Basic first-aid items |
| ☐ | Hand sanitiser / wet wipes |
| ☐ | Cash (coins and notes) as well as cards |
| ☐ | Paper list of phone numbers (105, household, insurance, local radio freqs) |
| ☐ | Copies or known location of ID, insurance, prescriptions |
| ☐ | Baby supplies / ready-to-feed formula if needed |
| ☐ | Pet food and water if needed |
| ☐ | Any spare glasses, hearing-aid batteries, mobility aids |

### Step B — Plan on paper

- ☐ Escape routes (fire) and flood actions if relevant  
- ☐ Household meeting point if you cannot return home  
- ☐ ICE / Medical ID on phones; tell the nominated contact  
- ☐ School/childcare numbers checked  
- ☐ PSR / Customer Care Register checked if eligible  
- ☐ Flood warnings signed up (EA or SEPA Floodline as appropriate)  
- ☐ Met Office weather warnings method chosen (app/email/BBC)  

### Step C — Fill gaps gradually

Only after A and B: add missing items on normal shops. Target quantities from official checklists (confirm at publish time):

- Drinking water: **about 3 litres per person per day** for three days (more for hygiene, cooking, pets, formula)  
- Food: three days non-perishable that needs no cooking/fridge  
- Grab-bag subset in a waterproof bag if flood leave is plausible  

### Step D — Review

- ☐ Calendar reminder in six months  
- ☐ Neighbour contact swap if appropriate  

**CTA pairing:** Checklist page → scenario articles → criteria pages → labelled retailer links.

---

## 5. Gear comparison criteria

Use the same criteria matrix on each category page. Rank transparency over “best”. Include **UK plug/voltage**, **spare parts availability**, and **storage in damp British homes**.

### Shared evaluation columns

| Criterion | What to record |
| --- | --- |
| Intended job | Stay-home outage / grab bag / car |
| Runtime or capacity | Measured or manufacturer claim (label which) |
| Power source | Primary cells / Li-ion / wind-up / USB-C |
| Spareability | Common battery sizes vs proprietary |
| Visibility / UI | Glove use, lock-out, charge indicators |
| Durability | IP rating, drop, cold performance |
| Household fit | Noise, weight, storage size, child safety |
| Evidence grade | Firsthand test / desk research / maker claim |
| Price band | £ at time of write-up (date-stamp) |

### Torches

- Beam distance vs flood for indoor navigation  
- Runtime at usable indoor lumen level (not turbo marketing peak)  
- Mode memory / lock to avoid pocket drain  
- Candle vs torch safety note (official: torches safer)  
- Headlamp option for hands-free kit work  

### Power banks

- Wh or mAh **and** estimated full phone charges  
- USB-C PD input/output; airline Wh limits if travel mentioned  
- Pass-through charging behaviour  
- Self-discharge over months in a drawer (test or cite)  
- Clear warning: medical devices—confirm with manufacturer  

### Radios

- FM reception quality indoors; DAB optional not required for outage basics  
- Battery vs wind-up vs solar hybrid—noise and effort trade-offs  
- Headphone jack; backlight drain  
- Ability to note station frequencies on paper plan  
- Car radio as fallback with severe-weather stay-indoors caveat  

### Water storage

- Food-grade materials; opaque vs algae risk  
- Seal integrity; pour handles; stackability in flats  
- Static vs rotating “store what you drink” approach  
- Do not treat floodwater as drinking water  
- Quantities tied to 3 L/person/day drinking baseline  

### First-aid kits

- Contents mapped to common household injuries (plasters, sterile dressings, gloves, tape, antiseptic, thermometer, eyewash)  
- BS-compliant workplace kits vs compact home kits—explain difference without overclaiming  
- Medication: readers supply their own prescribed meds; kits don’t replace training  
- Expiry tracking for sterile items  
- Optional face masks where Ready Scotland lists them  

### Winter travel supplies

- Hi-vis, scraper/de-icer, compact shovel, warm layers, blanket  
- Jump leads compatible with reader’s battery type (ICE vs caution on hybrids/EVs—verify)  
- Torch + in-car charge lead  
- Food/warm drink flask  
- Paper map backup when signal fails  
- Message: delay or cancel journeys when warnings advise  

**Product tables:** criteria first; optional “example products” in a clearly labelled **Advertisement / Ad** section with merchant name and “we may earn a commission”.

---

## 6. Sources, verification, and evidence labelling

### Core source URLs (re-verify on build day)

| Source | URL | Use for |
| --- | --- | --- |
| Prepare – Get prepared for emergencies | https://prepare.campaign.gov.uk/get-prepared-for-emergencies/ | Kit, plan, grab bag, PSR, 105 |
| Prepare – Power cuts | https://prepare.campaign.gov.uk/be-informed-about-hazards/power-cuts/ | Outage behaviour, radio, telecare |
| Prepare – Campaign toolkit | https://prepare.campaign.gov.uk/campaign-resources/ | Five simple steps framing |
| GOV.UK – Households encouraged to prepare | https://www.gov.uk/government/news/households-encouraged-to-take-small-simple-steps-to-stay-prepared-in-an-emergency | Campaign context |
| National Resilience / Be Ready checklist (PDF) | https://beready.campaign.gov.uk/wp-content/uploads/sites/252/2026/10/Be-Ready-Checklist_English.pdf | “Check what you already have”; 3 L water; six-month review |
| Ready Scotland – Emergency kit | https://ready.campaign.gov.scot/emergency-kit | Scottish kit + car kit |
| Ready Scotland – Emergency plan | https://ready.campaign.gov.scot/emergency-plan | Plan template, contacts |
| Ready Scotland – Flooding | https://ready.campaign.gov.scot/flooding | Scottish flood prep |
| Ready Scotland – Find/share information | https://ready.campaign.gov.scot/find-share-information-emergency | Scottish Water alerts, official channels |
| SEPA flooding | https://beta.sepa.scot/flooding/ | Live warnings (confirm stable URL) |
| Floodline signup (Scotland) | https://myfloodline.sepa.scot/register | Registration CTA |
| GOV.UK – Flood alerts and warnings | https://www.gov.uk/guidance/flood-alerts-and-warnings-what-they-are-and-what-to-do | EA alert levels |
| GOV.UK – Help during a flood | https://www.gov.uk/help-during-flood | During-flood actions |
| Met Office – UK warnings | https://weather.metoffice.gov.uk/warnings-and-advice/uk-warnings | Warning colours |
| Met Office – Heavy rain safety | https://weather.metoffice.gov.uk/warnings-and-advice/seasonal-advice/stay-safe-in-heavy-rain | Property/flood tips |
| British Red Cross – 72 hours context | https://www.redcross.org.uk/stories/disasters-and-emergencies/uk/why-are-we-being-asked-to-prepare-for-72-hours | Plain-language 72-hour rationale |
| Priority Services Register | https://www.thepsr.co.uk/ | Extra support signup |
| ASA – Affiliate marketing | https://www.asa.org.uk/advice-online/affiliate-marketing.html | Disclosure rules |
| Power cut reporting | 105 (England, Scotland, Wales); confirm NI number on Prepare pages | Contact blocks |

### What needs verification before each publish

- [ ] Live URLs for Prepare / Ready Scotland / SEPA (campaign hosts and `/wp-content/` PDF paths change).  
- [ ] Exact water volume and kit wording still match the cited checklist.  
- [ ] Flood warning product names (alert / warning / severe) unchanged per nation.  
- [ ] Affiliate programme open status, cookie length, and prohibited publisher categories.  
- [ ] Product prices, stock, and UK plug/warranty claims.  
- [ ] Any “global uncertainty” sentence still tied to a dated, citable public source—delete if unsourced.  
- [ ] ASA labelling on every page with tracked links.

### Evidence labels (required UI pattern)

Use visible chips or bylines:

| Label | Meaning | Allowed claims |
| --- | --- | --- |
| **Official guidance** | Paraphrase/quote of government or statutory agency advice with link | “UK guidance recommends…” |
| **Desk research** | Spec sheets, manuals, standards comparison; no physical test | “Manufacturer states…” |
| **Firsthand test** | Author used the item in a described UK household scenario; method note linked | Runtime, ergonomics, reception notes you measured |
| **Reader tip** | User-submitted; moderated; not verified | Clearly non-endorsement |
| **Ad** | Affiliate or sponsored product block | Must be obvious before engagement |

Never present desk research as a test. Firsthand tests need: date, location type (flat/house/car), ambient conditions, and pass/fail against the criteria matrix—not star spam.

---

## 7. Candidate UK retailer affiliate programmes

**Legend**

- **Programme availability (research snapshot):** whether a public programme listing was found during brief research (Nov 2026). Re-check in-network before relying on it.  
- **Eligibility / approval:** separate from availability—publisher must apply; approval is not guaranteed; content policies apply.

| Retailer | Network (reported) | Availability snapshot | Eligibility / approval (separate) | Fit for this site | Notes / verify |
| --- | --- | --- | --- | --- | --- |
| Amazon.co.uk | Amazon Associates UK | **Listed as available** via Associates Central | Application + original public content; suitability review; qualifying activity rules (e.g. sales within stated window—confirm current policy) | Broad kit coverage | Read operating policies; no trademark-in-domain; disclose Ad |
| Decathlon UK | Awin (merchant profile public) | **Listed on Awin** | Awin publisher account + merchant approval; commission tiers differ for incentive vs non-incentive | Torches, bags, outdoor layers | Marketplace sales may be excluded—confirm T&Cs |
| Go Outdoors | Awin | **Listed on Awin** | JD/Awin publisher approval; inactive publishers may be removed | Outdoor / winter travel | Same group policies as Blacks/Millets—read current terms |
| Blacks | Awin | **Listed on Awin** | Approval + engagement expectations | Outdoor kit | Public profile cites full-price vs sale commission split—verify in account |
| Millets | Awin | **Listed on Awin** | Approval + engagement expectations | Value outdoor / car kit | Confirm excluded product categories |
| Cotswold Outdoor | Webgains (directory listings) | **Reported active on Webgains** | Webgains + merchant approval; PPC brand bidding often restricted | Higher-spec outdoor | Confirm UK programme open at application time |
| Argos | CJ (directory listings) | **Reported on CJ** | CJ account + Argos approval | Torches, power banks, home kit | Commission rates from third-party directories—verify in CJ |
| John Lewis | Sovrn Commerce (directory listings) | **Reported open via Sovrn** | Sovrn site approval + Commerce install/click before monetisation | Home/first-aid/quality basics | Confirm merchant still enabled for your publisher type |
| Screwfix | Merchant page | **Closed to new applicants** (merchant help page) | N/A while closed | Tools/torches | Do not plan launch dependency; re-check later |
| Halfords / tool specialists | Various | **Not verified in this brief** | Unknown | Car kit | Investigate during build; mark unverified until confirmed |

### Network accounts to open early

1. Amazon Associates UK  
2. Awin publisher  
3. Webgains publisher  
4. CJ publisher  
5. Sovrn Commerce (if pursuing John Lewis)

### Compliance checklist for affiliate UX

- [ ] Sitewide footer: commercial relationship explanation  
- [ ] On any page with tracked links: upfront **Ad** / **Advertisement feature** where required (ASA: “affiliate” alone is not enough)  
- [ ] Criteria/editorial sections free of tracked links, or clearly separated from Ad blocks  
- [ ] No false scarcity, no “only surviving families buy X” copy  
- [ ] Cookie consent + disclosure compatible with UK GDPR/PECR practice  
- [ ] Record approval emails/screenshots per merchant for audit  

---

## 8. Technical build outline (Astro + Cloudflare Pages)

### Site map (v1)

```
/                       Homepage
/checklist              72-hour checklist (interactive + print CSS)
/scenarios              Index of 10 articles
/scenarios/[slug]       Article
/gear                   Criteria hub
/gear/[category]        Six category criteria pages
/method                 How we source, test, and label Ads
/sources                Link list with retrieved dates
/about                  Brand, audience, contact
/privacy                Privacy + cookies + affiliate disclosure
```

### Implementation notes

- Astro content collections for `scenarios` and `gear` with Zod frontmatter: `title`, `scenario`, `sources[]`, `evidence[]`, `updated`, `affiliate: boolean`.  
- MDX for articles; components: `SourceCite`, `EvidenceBadge`, `Checklist`, `AdBlock`, `NationTabs` (England & Wales / Scotland / Northern Ireland).  
- Cloudflare Pages: `@astrojs/cloudflare` or static output—prefer static for this content site unless forms need Functions.  
- Image pipeline: Astro assets; hero images compressed; no remote hotlink to retailer CDNs in editorial heroes.  
- Print stylesheet for checklist.  
- `llms`/SEO: sober titles; no clickbait.  
- Env: affiliate tags in Cloudflare env vars, not committed.

### Acceptance criteria for Agent builds

1. Homepage passes brand test (brand readable if nav removed).  
2. Checklist step A is inventory-first.  
3. Every official claim has a citation component.  
4. No weapons content; no panic CTAs.  
5. Affiliate pages show ASA-suitable labelling.  
6. Scotland vs England/Wales flood sections do not conflate agencies.  
7. Lighthouse-accessible baseline on mobile.

---

## 9. Suggested first build slice

1. Scaffold Astro + TS + Cloudflare Pages config + design tokens.  
2. Homepage + Method + Sources stubs.  
3. Full checklist page.  
4. Two scenario articles (#1 power cut, #6 Scottish flood kit) as templates.  
5. One gear criteria page (torches) with empty Ad block awaiting programme approval.  
6. Apply to Amazon Associates + Awin; do not publish tracked links until approved.

---

## 10. Copy bank (tone samples)

**Allowed:** “Start by checking what you already keep at home.” / “UK guidance suggests preparing for up to three days of disruption.” / “If a flood warning is issued, follow emergency services advice.”

**Disallowed:** “The grid will fail this winter.” / “Buy now before empty shelves.” / “Best tactical flashlights for civil unrest.” / “You need a weapon in your grab bag.”

---

*Brief status: planning document for implementation. Affiliate availability rows are research snapshots, not enrolment proof. Re-verify all government URLs and merchant programme statuses before launch.*
