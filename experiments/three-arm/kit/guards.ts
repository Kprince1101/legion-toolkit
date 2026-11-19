import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { filesUnder, sha256 } from './tree.ts';

export const GUARDED_PATHS = [
  'acceptance',
  'playwright.config.ts',
  '.oxlintrc.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
  'CLAUDE.md',
  'CLAUDE.local.md',
  'AGENTS.md',
];

export const SCRIPTS_KEY = 'package.json#scripts';

export type GuardHashes = Record<string, string>;

export interface TamperReport {
  changed: string[];
  added: string[];
  removed: string[];
}

const scriptsHash = (root: string): string | null => {
  const path = join(root, 'package.json');
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = parsed.scripts ?? {};
    const sorted = Object.keys(scripts)
      .sort()
      .map((name) => [name, scripts[name]]);
    return sha256(JSON.stringify(sorted));
  } catch {
    return sha256('unparseable');
  }
};

export const hashGuards = (root: string): GuardHashes => {
  const hashes: GuardHashes = {};
  for (const path of GUARDED_PATHS) {
    for (const file of filesUnder(root, path)) {
      hashes[file] = sha256(readFileSync(join(root, file)));
    }
  }
  const scripts = scriptsHash(root);
  if (scripts !== null) hashes[SCRIPTS_KEY] = scripts;
  return hashes;
};

export const compareGuards = (
  before: GuardHashes,
  after: GuardHashes,
): TamperReport => {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  const report: TamperReport = { changed: [], added: [], removed: [] };
  for (const name of [...names].sort()) {
    const was = before[name];
    const now = after[name];
    if (was === undefined) report.added.push(name);
    else if (now === undefined) report.removed.push(name);
    else if (was !== now) report.changed.push(name);
  }
  return report;
};

export const tamperCount = (report: TamperReport): number =>
  report.changed.length + report.added.length + report.removed.length;
