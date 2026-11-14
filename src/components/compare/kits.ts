/**
 * Editorial kit facts for /compare/72-hour-emergency-kits/.
 *
 * Every value comes from the seller's own listing as recorded in SURVIVAL_COMPARISON_BRIEF.md §3–§4
 * (listings read 14 Nov 2026). Nothing here was tested. Anything the listing does not state is
 * `null` and renders as "Not published". No prices live here: prices come only from offer data.
 *
 * If S1-1 product records (`src/data/kits/**`) later carry the same fields, switch to those and
 * keep only page copy here.
 */

export const RESEARCHED_ON = '2026-11-14';
export const WATER_LITRES_PER_PERSON_PER_DAY = 3;
export const DAYS = 3;

export type Listed = 'listed' | 'not-listed' | 'unclear';

export interface KitVariant {
  /** Exact variant id. Offers are matched on this only. */
  id: string;
  kitLabel: string;
  brand: string;
  name: string;
  modelCode: string;
  people: number;
  peopleNote?: string;
  format: 'grab-bag' | 'home-box';
  formatNote: string;
  /** Listed weight in kg, or null if not published. */
  listedWeightKg: number | null;
  weightNote?: string;
  waterLitresIncluded: number;
  radio: { status: Listed; text: string };
  torches: string;
  powerBank: string;
  firstAid: string;
  stillToAdd: string[];
  conflicts?: string[];
  sourceUrl: string;
  seller: string;
}

export const waterNeeded = (people: number) => people * WATER_LITRES_PER_PERSON_PER_DAY * DAYS;
export const waterShortfall = (v: Pick<KitVariant, 'people' | 'waterLitresIncluded'>) =>
  Math.max(0, waterNeeded(v.people) - v.waterLitresIncluded);

const commonGaps = ['Essential medication', 'Cash', 'Copies of documents', 'Written phone numbers'];

export const kits: KitVariant[] = [
  {
    id: 'evaq8-e180',
    kitLabel: '1 person',
    brand: 'EVAQ8',
    name: 'GoBag Emergency Kit 72hr Survival Supplies',
    modelCode: 'E180',
    people: 1,
    format: 'grab-bag',
    formatNote: 'Rucksack (grab bag)',
    listedWeightKg: 2.5,
    waterLitresIncluded: 0.5,
    radio: { status: 'not-listed', text: 'Not listed' },
    torches: '1 wind-up LED torch',
    powerBank: 'Listed (capacity not published)',
    firstAid: 'Compact first aid kit',
    stillToAdd: ['8.5 L of drinking water', 'A battery or wind-up FM radio', ...commonGaps, 'Tin opener', 'Baby or pet items if needed'],
    conflicts: ['The listing gives both 2,400 kcal and 2,500 kcal for the food ration.'],
    sourceUrl: 'https://evaq8.co.uk/go-bag-emergency-kit-72-hour-survival-supplies.html',
    seller: 'EVAQ8',
  },
  {
    id: 'evaq8-e182p',
    kitLabel: '2 people',
    brand: 'EVAQ8',
    name: 'GoBag 2 Person Emergency Kit in Plain Rucksack',
    modelCode: 'E182P',
    people: 2,
    format: 'grab-bag',
    formatNote: 'Rucksack (grab bag)',
    listedWeightKg: 4,
    waterLitresIncluded: 1,
    radio: { status: 'not-listed', text: 'Not listed' },
    torches: '1 wind-up LED torch for 2 people',
    powerBank: 'Listed (capacity not published)',
    firstAid: 'Universal first aid kit',
    stillToAdd: ['17 L of drinking water', 'A battery or wind-up FM radio', 'A second torch', ...commonGaps, 'Tin opener', 'Baby or pet items if needed'],
    conflicts: ['The red-bag version (E182) was not confirmed to have identical contents.'],
    sourceUrl: 'https://evaq8.co.uk/gobag-emergency-kit-2-person-e141-plain.html',
    seller: 'EVAQ8',
  },
  {
    id: 'evaq8-e184',
    kitLabel: '4 people',
    brand: 'EVAQ8',
    name: 'GoBag Emergency Kit 4 Person Family Survival Kit',
    modelCode: 'E184',
    people: 4,
    format: 'grab-bag',
    formatNote: 'One red rucksack (grab bag)',
    listedWeightKg: 9,
    weightNote: 'One bag for four people: at or above a realistic single-adult carry.',
    waterLitresIncluded: 2,
    radio: { status: 'unclear', text: 'Compact AM/FM radio (power source not stated)' },
    torches: '1 wind-up LED torch for 4 people',
    powerBank: 'Listed (capacity not published)',
    firstAid: 'First aid kit in soft bag',
    stillToAdd: ['34 L of drinking water', 'Extra torches (one per person)', 'Check how the radio is powered', ...commonGaps, 'Tin opener', 'Baby or pet items if needed'],
    conflicts: [
      'A third-party roundup says this kit has no first aid kit; the current EVAQ8 listing includes one.',
      'Amazon UK listings for "4 person" EVAQ8 kits disagree with the maker on weight and rations, so we use EVAQ8’s own page.',
    ],
    sourceUrl: 'https://evaq8.co.uk/bug-out-bag-4-person-family-go-bag.html',
    seller: 'EVAQ8',
  },
  {
    id: 'evaq8-e194',
    kitLabel: '4 people (holdall)',
    brand: 'EVAQ8',
    name: '72 Hour Emergency 4 Person Family Kit in Holdall',
    modelCode: 'E194',
    people: 4,
    format: 'grab-bag',
    formatNote: 'Holdall (grab bag); same listed items as E184',
    listedWeightKg: 8.5,
    waterLitresIncluded: 2,
    radio: { status: 'unclear', text: 'Compact AM/FM radio (power source not stated)' },
    torches: '1 wind-up LED torch for 4 people',
    powerBank: 'Listed (capacity not published)',
    firstAid: 'First aid kit in soft bag',
    stillToAdd: ['34 L of drinking water', 'Extra torches (one per person)', 'Check how the radio is powered', ...commonGaps, 'Tin opener', 'Baby or pet items if needed'],
    sourceUrl: 'https://evaq8.co.uk/gobag-emergency-kit-4-person-in-holdall.html',
    seller: 'EVAQ8',
  },
  {
    id: 'tminus-t3-4p',
    kitLabel: 'Premium, 4 people',
    brand: 'T-MINUS',
    name: 'T+3 Go Bag (72-hour emergency kit)',
    modelCode: 'T+3 (4-person configuration)',
    people: 4,
    peopleNote: 'Two adults and two children as standard; 2- and 6-person configurations offered.',
    format: 'grab-bag',
    formatNote: 'One rucksack per adult, built to order',
    listedWeightKg: null,
    waterLitresIncluded: 12,
    radio: { status: 'listed', text: 'Wind-up/solar radio' },
    torches: '4 rechargeable head torches + lantern',
    powerBank: '20,000 mAh',
    firstAid: 'Comprehensive first aid kit + tourniquet (no medicines)',
    stillToAdd: ['24 L of sealed drinking water', 'Essential medication', 'Cash', 'Baby items (ask the seller)', 'Pet items (optional add-on)'],
    conflicts: ['Includes a gas stove the listing says is for outdoor use only. Never cook indoors in a power cut (carbon monoxide risk).'],
    sourceUrl: 'https://tminus.co.uk/72-hour-emergency-kit',
    seller: 'T-MINUS',
  },
];

/** Be Ready checklist matrix rows (brief §4.2). Columns follow `matrixKits` order. */
export const matrixKits = [
  { key: 'A', label: 'EVAQ8 E180', people: '1 person' },
  { key: 'B', label: 'EVAQ8 E182P', people: '2 people' },
  { key: 'C', label: 'EVAQ8 E184 / E194', people: '4 people' },
  { key: 'D', label: 'T-MINUS T+3', people: '4 people' },
] as const;

export const matrixRows: Array<{ item: string; values: [string, string, string, string]; emphasis?: boolean }> = [
  { item: 'Drinking water listed', values: ['0.5 L', '1 L', '2 L', '12 L'] },
  { item: 'Water needed (3 L × people × 3 days)', values: ['9 L', '18 L', '36 L', '36 L'] },
  { item: 'Water shortfall', values: ['8.5 L', '17 L', '34 L', '24 L'], emphasis: true },
  { item: 'No-cook food', values: ['Ration bar', 'Ration bars', 'Ration bars', 'Mostly needs boiling water, plus 5 ration bars'] },
  { item: 'Tin opener', values: ['Not listed', 'Not listed', 'Not listed', 'Not listed'] },
  { item: 'Torch', values: ['1 wind-up', '1 wind-up', '1 wind-up', '4 head torches + lantern'] },
  { item: 'FM radio', values: ['Not listed', 'Not listed', 'AM/FM (power unclear)', 'Wind-up/solar'] },
  { item: 'Power bank', values: ['Listed (capacity unclear)', 'Listed (capacity unclear)', 'Listed (capacity unclear)', '20,000 mAh'] },
  { item: 'Spare batteries', values: ['4 AA', '4 AA', 'Not listed', 'Not listed'] },
  { item: 'First aid kit', values: ['Compact', 'Universal', 'Soft bag (disputed by a third party)', 'Comprehensive + tourniquet'] },
  { item: 'Essential medication', values: ['Not listed', 'Not listed', 'Not listed', 'Excluded'] },
  { item: 'Hygiene', values: ['4 wipes, mask', '8 wipes, masks', '40 wipes, masks', 'Extensive'] },
  { item: 'Warmth', values: ['Foil blanket + emergency sleeping bag', '2 of each', '4 of each', 'Bivvies, foil, wool throw'] },
  { item: 'Cash', values: ['Not listed', 'Not listed', 'Not listed', 'Not listed'] },
  { item: 'Document copies / wallet', values: ['Not listed', 'Not listed', 'Not listed', 'Fire-resistant document bag'] },
  { item: 'Written contacts / plan', values: ['Not listed', 'Not listed', 'Not listed', 'Field manual'] },
  { item: 'Baby items', values: ['Not listed', 'Not listed', 'Not listed', 'Unclear (on request)'] },
  { item: 'Pet items', values: ['Not listed', 'Not listed', 'Not listed', 'Optional dog add-on'] },
  { item: 'Indoor-unsafe items', values: ['None listed', 'None listed', 'None listed', 'Stove + gas (outdoor only)'] },
];

export const sources = {
  official: [
    { label: 'Be Ready: be ready for emergencies (GOV.UK campaign)', url: 'https://beready.campaign.gov.uk/be-ready-for-emergencies/' },
    { label: 'Be Ready checklist (PDF)', url: 'https://beready.campaign.gov.uk/wp-content/uploads/sites/252/2026/10/Be-Ready-Checklist_English.pdf' },
    { label: 'GOV.UK: households encouraged to take small, simple steps (22 Oct 2026)', url: 'https://www.gov.uk/government/news/households-encouraged-to-take-small-simple-steps-to-stay-prepared-in-an-emergency' },
    { label: 'British Red Cross: prepare an emergency kit', url: 'https://www.redcross.org.uk/get-help/prepare-for-emergencies/prepare-an-emergency-kit' },
    { label: 'Cabinet Office: UK Public Survey of Risk Perception, Resilience and Preparedness 2026', url: 'https://www.gov.uk/government/statistics/uk-public-survey-of-risk-perception-resilience-and-preparedness-2026/uk-public-survey-of-risk-perception-resilience-and-preparedness-2026-headline-findings-html' },
    { label: 'Power Cut 105 (GB)', url: 'https://www.powercut105.com/en/' },
  ],
  listings: [
    { label: 'EVAQ8 E180 listing', url: 'https://evaq8.co.uk/go-bag-emergency-kit-72-hour-survival-supplies.html' },
    { label: 'EVAQ8 E182P listing', url: 'https://evaq8.co.uk/gobag-emergency-kit-2-person-e141-plain.html' },
    { label: 'EVAQ8 E184 listing', url: 'https://evaq8.co.uk/bug-out-bag-4-person-family-go-bag.html' },
    { label: 'EVAQ8 E194 listing', url: 'https://evaq8.co.uk/gobag-emergency-kit-4-person-in-holdall.html' },
    { label: 'EVAQ8 home emergency kits category (weights)', url: 'https://evaq8.co.uk/Home-Emergency-Kits/' },
    { label: 'T-MINUS T+3 listing', url: 'https://tminus.co.uk/72-hour-emergency-kit' },
    { label: 'PreparedBritain grab bag roundup (third-party claims we flag)', url: 'https://www.preparedbritain.co.uk/kit/grab-bags' },
  ],
};
