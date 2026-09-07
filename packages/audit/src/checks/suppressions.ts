import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Finding, SuppressionFile, SuppressionResult } from '../types.js';

export const SUPPRESSIONS_FILE = '.legion-suppressions.json';

const EMPTY: SuppressionFile = { schema: 1, counts: {} };

export const suppressionKey = (finding: Finding): string =>
  `${finding.rule} ${finding.file}`;

export const buildSuppressions = (findings: Finding[]): SuppressionFile => {
  const counts: Record<string, number> = {};
  for (const finding of findings) {
    const key = suppressionKey(finding);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return { schema: 1, counts };
};

export const readSuppressions = (root: string): SuppressionFile => {
  const path = join(root, SUPPRESSIONS_FILE);
  if (!existsSync(path)) return EMPTY;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as SuppressionFile;
    if (typeof parsed.counts !== 'object' || parsed.counts === null) {
      return EMPTY;
    }
    return { schema: 1, counts: parsed.counts };
  } catch {
    return EMPTY;
  }
};

export const writeSuppressions = (
  root: string,
  file: SuppressionFile,
): string => {
  const path = join(root, SUPPRESSIONS_FILE);
  const ordered = Object.fromEntries(
    Object.entries(file.counts).sort(([a], [b]) => a.localeCompare(b)),
  );
  const body = JSON.stringify({ schema: 1, counts: ordered }, null, 2);
  writeFileSync(path, `${body}\n`);
  return path;
};

export const applySuppressions = (
  findings: Finding[],
  file: SuppressionFile,
): SuppressionResult => {
  const remaining: Record<string, number> = { ...file.counts };
  const surviving: Finding[] = [];
  let suppressed = 0;
  for (const finding of findings) {
    const key = suppressionKey(finding);
    const budget = remaining[key] ?? 0;
    if (budget > 0) {
      remaining[key] = budget - 1;
      suppressed += 1;
      continue;
    }
    surviving.push(finding);
  }
  const stale = Object.entries(remaining)
    .filter(([, count]) => count > 0)
    .map(([key]) => key)
    .sort();
  return { findings: surviving, suppressed, stale, total: findings.length };
};
