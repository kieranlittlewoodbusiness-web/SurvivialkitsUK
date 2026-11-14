import { getCollection, type CollectionEntry } from 'astro:content';

export async function getPublishedScenarios() {
  const all = await getCollection('scenarios');
  return all
    .filter((entry) => !entry.data.draft)
    .sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99) || a.data.pubDate.valueOf() - b.data.pubDate.valueOf());
}

export async function getPublishedGear() {
  const all = await getCollection('gear');
  return all
    .filter((entry) => !entry.data.draft)
    .sort((a, b) => a.data.order - b.data.order);
}

export type ScenarioEntry = CollectionEntry<'scenarios'>;
export type GearEntry = CollectionEntry<'gear'>;
