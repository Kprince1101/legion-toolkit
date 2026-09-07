import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { END, START } from './block.js';

export type MergeOutcome = 'created' | 'replaced' | 'appended' | 'unchanged';

export interface MergeResult {
  outcome: MergeOutcome;
  contents: string;
}

const separatorFor = (existing: string): string => {
  if (existing.endsWith('\n')) return '\n';
  return '\n\n';
};

export const mergeBlock = (existing: string, block: string): MergeResult => {
  if (existing.length === 0) {
    return { outcome: 'created', contents: `${block}\n` };
  }
  const start = existing.indexOf(START);
  const end = existing.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    return {
      outcome: 'appended',
      contents: `${existing}${separatorFor(existing)}${block}\n`,
    };
  }
  const before = existing.slice(0, start);
  const after = existing.slice(end + END.length);
  const next = `${before}${block}${after}`;
  if (next === existing) return { outcome: 'unchanged', contents: existing };
  return { outcome: 'replaced', contents: next };
};

export const readFileOrEmpty = (path: string): string => {
  if (!existsSync(path)) return '';
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(
      `${path} exists but could not be read, so it was left untouched: ${String(error)}`,
    );
  }
};

export interface WriteTarget {
  path: string;
  outcome: MergeOutcome;
}

export const writeManagedBlock = (
  root: string,
  relative: string,
  block: string,
): WriteTarget => {
  const path = join(root, relative);
  const merged = mergeBlock(readFileOrEmpty(path), block);
  if (merged.outcome !== 'unchanged') writeFileSync(path, merged.contents);
  return { path: relative, outcome: merged.outcome };
};

export const checkManagedBlock = (
  root: string,
  relative: string,
  block: string,
): boolean => {
  const existing = readFileOrEmpty(join(root, relative));
  if (existing.length === 0) return false;
  return mergeBlock(existing, block).outcome === 'unchanged';
};
