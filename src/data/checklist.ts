export type ChecklistGroupId =
  | 'inventory'
  | 'water-food'
  | 'light-warmth'
  | 'communications'
  | 'hygiene'
  | 'documents'
  | 'household'
  | 'plan';

export interface ChecklistItem {
  id: string;
  label: string;
}

export interface ChecklistGroup {
  id: ChecklistGroupId;
  title: string;
  intro?: string;
  items: ChecklistItem[];
}

/** Inventory-first 72-hour checklist aligned with Prepare / Ready Scotland / Be Ready. */
export const checklistGroups: ChecklistGroup[] = [
  {
    id: 'inventory',
    title: 'Check what you already have',
    intro:
      'Walk the house before you buy anything. Tick items you already own and can find in the dark.',
    items: [
      { id: 'inv-torch', label: 'Working torch (not only phone light) and spare batteries or wind-up' },
      { id: 'inv-radio', label: 'Battery or wind-up FM radio, or a written car-radio plan if safe' },
      { id: 'inv-powerbank', label: 'Charged power bank and leads' },
      { id: 'inv-water', label: 'Bottled water or clean sealed containers you can fill' },
      { id: 'inv-food', label: 'Ready-to-eat food you already buy, plus a tin opener' },
      { id: 'inv-meds', label: 'Essential medication for several days, with doses written down' },
      { id: 'inv-firstaid', label: 'Basic first-aid items' },
      { id: 'inv-blankets', label: 'Blankets, sleeping bags or spare warm layers' },
    ],
  },
  {
    id: 'water-food',
    title: 'Water and food',
    intro:
      'Official checklists suggest about 3 litres of drinking water per person per day for three days, plus more for hygiene, cooking, pets or formula. Prefer food you already eat.',
    items: [
      { id: 'wf-water-3d', label: 'Drinking water for three days (about 3 L per person per day)' },
      { id: 'wf-extra-water', label: 'Extra water noted for hygiene, cooking, pets or formula if needed' },
      { id: 'wf-food-3d', label: 'Three days of non-perishable food that needs no fridge or cooking' },
      { id: 'wf-opener', label: 'Tin opener kept with the food' },
      { id: 'wf-baby', label: 'Ready-to-feed formula / baby food if needed (safer if you cannot boil water)' },
      { id: 'wf-pet', label: 'Pet food and water if needed' },
    ],
  },
  {
    id: 'light-warmth',
    title: 'Light and warmth',
    intro: 'Torches are safer than candles. Keep spare cells with the torch.',
    items: [
      { id: 'lw-torch', label: 'Torch with spare batteries or a wind-up torch' },
      { id: 'lw-spare-cells', label: 'Spare batteries stored where you can find them' },
      { id: 'lw-layers', label: 'Warm clothing layers for everyone in the household' },
      { id: 'lw-blankets', label: 'Blankets or sleeping bags' },
      { id: 'lw-rooms', label: 'Plan to close unused rooms and draw curtains to keep heat in' },
    ],
  },
  {
    id: 'communications',
    title: 'Communications',
    items: [
      { id: 'com-105', label: 'Power-cut number on paper: 105 (England, Scotland, Wales) or 03457 643643 (Northern Ireland)' },
      { id: 'com-radio', label: 'Battery or wind-up radio for updates if broadband fails' },
      { id: 'com-freqs', label: 'Local/national radio frequencies written on paper' },
      { id: 'com-powerbank', label: 'Charged power bank for essential phone use' },
      { id: 'com-contacts', label: 'Paper list of household, school, insurance and ICE contacts' },
    ],
  },
  {
    id: 'hygiene',
    title: 'Hygiene',
    items: [
      { id: 'hyg-sanitiser', label: 'Hand sanitiser' },
      { id: 'hyg-wipes', label: 'Wet wipes for limited washing water' },
      { id: 'hyg-toiletries', label: 'Essential toiletries and bathroom supplies for a few days' },
      { id: 'hyg-bags', label: 'Rubbish bags for waste if collections are disrupted' },
    ],
  },
  {
    id: 'documents',
    title: 'Essential documents',
    items: [
      { id: 'doc-ids', label: 'Copies or known location of ID and important certificates' },
      { id: 'doc-insurance', label: 'Insurance policy details and contact numbers' },
      { id: 'doc-prescriptions', label: 'Prescription details / medication list' },
      { id: 'doc-plan', label: 'Printed or handwritten household emergency plan' },
      { id: 'doc-cash', label: 'Small amount of cash (coins and notes) as well as cards' },
    ],
  },
  {
    id: 'household',
    title: 'Household-specific needs',
    intro: 'Only tick what applies. Accessibility, care and medical equipment needs come first.',
    items: [
      { id: 'hh-psr', label: 'Priority Services Register / Customer Care Register checked if eligible' },
      { id: 'hh-telecare', label: 'Telecare / medical device behaviour in a power cut confirmed with the provider' },
      { id: 'hh-glasses', label: 'Spare glasses, contact lenses or hearing-aid batteries if needed' },
      { id: 'hh-mobility', label: 'Spare mobility aids or written instructions for equipment if needed' },
      { id: 'hh-grab', label: 'Waterproof grab-bag subset if temporary flood leave is plausible' },
      { id: 'hh-car', label: 'Modest winter car kit if you drive in severe weather' },
    ],
  },
  {
    id: 'plan',
    title: 'Household plan (on paper)',
    items: [
      { id: 'plan-escape', label: 'Fire escape routes and flood actions discussed' },
      { id: 'plan-meet', label: 'Meeting point if you cannot return home' },
      { id: 'plan-ice', label: 'ICE / Medical ID on phones; nominated contact told' },
      { id: 'plan-school', label: 'School or childcare contact numbers checked' },
      { id: 'plan-flood', label: 'Flood warnings signed up (Environment Agency or SEPA Floodline as appropriate)' },
      { id: 'plan-weather', label: 'Met Office weather warnings method chosen' },
      { id: 'plan-review', label: 'Six-month calendar reminder to review the kit' },
    ],
  },
];

export const CHECKLIST_STORAGE_KEY = 'thb-checklist-v1';
