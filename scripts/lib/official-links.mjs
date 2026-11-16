/**
 * SEO-5: fail if source files still link to the retired Prepare campaign
 * /campaign-resources/ path (404 after the Be Ready relaunch) or to
 * prepare.campaign.gov.uk (301s to beready.campaign.gov.uk).
 */
import fs from 'node:fs';
import path from 'node:path';

export const DEAD_CAMPAIGN_RESOURCES = '/campaign-resources/';
export const RETIRED_PREPARE_HOST = 'prepare.campaign.gov.uk';

const TEXT_EXT = new Set(['.astro', '.md', '.ts', '.js', '.mjs', '.css', '.json', '.html', '.txt']);

/**
 * @param {string} rootDir repo root
 * @param {{ dirs?: string[] }} [opts]
 * @returns {{ file: string, line: number, kind: 'campaign-resources' | 'prepare.campaign.gov.uk', text: string }[]}
 */
export function findRetiredOfficialLinks(rootDir, opts = {}) {
  const dirs = opts.dirs ?? ['src'];
  const hits = [];
  for (const dir of dirs) {
    const abs = path.join(rootDir, dir);
    if (!fs.existsSync(abs)) continue;
    walk(abs, rootDir, hits);
  }
  return hits;
}

function walk(dir, rootDir, hits) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.git') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p, rootDir, hits);
      continue;
    }
    if (!ent.isFile() || !TEXT_EXT.has(path.extname(ent.name))) continue;
    const rel = path.relative(rootDir, p).split(path.sep).join('/');
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    lines.forEach((text, i) => {
      if (text.includes(DEAD_CAMPAIGN_RESOURCES)) {
        hits.push({ file: rel, line: i + 1, kind: 'campaign-resources', text: text.trim() });
      }
      if (text.includes(RETIRED_PREPARE_HOST)) {
        hits.push({ file: rel, line: i + 1, kind: 'prepare.campaign.gov.uk', text: text.trim() });
      }
    });
  }
}

/**
 * @param {{ file: string, line: number, kind: string, text: string }[]} hits
 * @returns {string}
 */
export function formatRetiredOfficialLinkFailures(hits) {
  return hits
    .map((h) => `${h.file}:${h.line}: retired official link (${h.kind}): ${h.text}`)
    .join('\n');
}
