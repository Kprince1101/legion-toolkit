import { run } from '../exec.js';
import { detectForge, forgePattern } from './forge.js';
import type { Forge, PrHygiene } from '../types.js';

const SKIPPED = (forge: Forge): PrHygiene => ({
  status: 'skipped',
  inspected: 0,
  withPr: 0,
  ratio: 0,
  lastPrCommit: null,
  forge,
});

export const summarizePrHygiene = (
  lines: string[],
  inspected: number,
  forge: Forge = 'github',
): PrHygiene => {
  const pattern = forgePattern(forge);
  if (pattern === null) return SKIPPED(forge);
  const withPr = lines.filter((line) => pattern.test(line)).length;
  const lastPrCommit = lines.find((line) => pattern.test(line)) ?? null;
  let ratio = 0;
  if (lines.length > 0) ratio = withPr / lines.length;
  let status: PrHygiene['status'] = 'pass';
  if (ratio < 0.5) status = 'fail';
  return {
    status,
    inspected: Math.min(inspected, lines.length),
    withPr,
    ratio,
    lastPrCommit,
    forge,
  };
};

const SEPARATOR = '<<<legion>>>';

export const prHygiene = (root: string, inspected: number): PrHygiene => {
  const forge = detectForge(root);
  if (forge === 'unknown') return SKIPPED(forge);
  const result = run(
    'git',
    [
      'log',
      `-n${inspected}`,
      `--format=%h %ad %s%n%b${SEPARATOR}`,
      '--date=short',
    ],
    root,
  );
  if (result.code !== 0) return SKIPPED(forge);
  const lines = result.stdout
    .split(SEPARATOR)
    .map((entry) => entry.replace(/\s+/g, ' ').trim())
    .filter((entry) => entry.length > 0);
  return summarizePrHygiene(lines, inspected, forge);
};
