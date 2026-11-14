import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const sourceSchema = z.object({
  label: z.string(),
  url: z.string(),
});

const scenarios = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/scenarios' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    scenario: z.string(),
    pubDate: z.coerce.date(),
    updated: z.coerce.date().optional(),
    /** Displayed as last-reviewed date on the guide. */
    lastReviewed: z.coerce.date(),
    draft: z.boolean().default(false),
    affiliate: z.boolean().default(false),
    featured: z.boolean().default(false),
    /** Highlighted on Start Here as a core preparedness path. */
    startHere: z.boolean().default(false),
    order: z.number().int().optional(),
    sources: z.array(sourceSchema).default([]),
    evidence: z
      .array(z.enum(['official-guidance', 'desk-research', 'firsthand-test', 'reader-tip']))
      .default(['official-guidance']),
    /** Unsupported safety claims or unverified specs awaiting editorial clearance. */
    reviewFlags: z.array(z.string()).default([]),
    gearCategories: z
      .array(
        z.enum([
          'torches',
          'power-banks',
          'radios',
          'water-storage',
          'first-aid',
          'winter-travel',
        ]),
      )
      .default([]),
  }),
});

const gear = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/gear' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum([
      'torches',
      'power-banks',
      'radios',
      'water-storage',
      'first-aid',
      'winter-travel',
    ]),
    pubDate: z.coerce.date(),
    updated: z.coerce.date().optional(),
    lastReviewed: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    affiliate: z.boolean().default(true),
    order: z.number().int().default(0),
    criteria: z.array(z.string()).min(1),
    sources: z.array(sourceSchema).default([]),
    reviewFlags: z.array(z.string()).default([]),
  }),
});

export const collections = { scenarios, gear };
