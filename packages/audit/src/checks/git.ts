import { run } from '../exec.js';
import type { PrHygiene } from '../types.js';

const PR_NUMBER = /\(#\d+\)/;

export const summarizePrHygiene = (
  lines: string[],
  inspected: number,
): PrHygiene => {
  const withPr = lines.filter((line) => PR_NUMBER.test(line)).length;
  const lastPrCommit = lines.find((line) => PR_NUMBER.test(line)) ?? null;
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
  };
};

export const prHygiene = (root: string, inspected: number): PrHygiene => {
  const result = run(
    'git',
    ['log', `-n${inspected}`, '--format=%h %ad %s', '--date=short'],
    root,
  );
  if (result.code !== 0) {
    return {
      status: 'skipped',
      inspected: 0,
      withPr: 0,
      ratio: 0,
      lastPrCommit: null,
    };
  }
  const lines = result.stdout
    .split('\n')
    .filter((line) => line.trim().length > 0);
  return summarizePrHygiene(lines, inspected);
};
