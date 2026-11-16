import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findRetiredOfficialLinks,
  formatRetiredOfficialLinkFailures,
} from './lib/official-links.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'official-links-'));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(d, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return d;
}

describe('findRetiredOfficialLinks', () => {
  it('fails when content links to the known-dead /campaign-resources/ path', () => {
    const root = fixture({
      'src/pages/sources.astro':
        "url: 'https://prepare.campaign.gov.uk/campaign-resources/',\n",
    });
    const hits = findRetiredOfficialLinks(root);
    expect(hits.some((h) => h.kind === 'campaign-resources')).toBe(true);
    expect(formatRetiredOfficialLinkFailures(hits)).toMatch(/campaign-resources/);
  });

  it('fails when content still links to prepare.campaign.gov.uk', () => {
    const root = fixture({
      'src/components/Footer.astro':
        '<a href="https://prepare.campaign.gov.uk/get-prepared-for-emergencies/">Prepare</a>\n',
    });
    const hits = findRetiredOfficialLinks(root);
    expect(hits.some((h) => h.kind === 'prepare.campaign.gov.uk')).toBe(true);
  });

  it('passes when official links use the Be Ready relaunch URLs', () => {
    const root = fixture({
      'src/pages/sources.astro':
        "url: 'https://beready.campaign.gov.uk/be-ready-for-emergencies/',\n",
    });
    expect(findRetiredOfficialLinks(root)).toEqual([]);
  });

  it('finds no retired official links in src/', () => {
    const hits = findRetiredOfficialLinks(repoRoot);
    expect(hits, formatRetiredOfficialLinkFailures(hits)).toEqual([]);
  });
});
