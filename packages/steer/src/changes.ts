import { statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { run } from 'legion-audit';
import { firstLine } from './text.js';

export const MTIME_SLACK_MS = 1000;

export type Changes =
  { ok: true; top: string; files: string[] } | { ok: false; reason: string };

const RENAMED = /[RC]/;

export const parsePorcelain = (raw: string): string[] => {
  const tokens = raw.split('\0').filter((token) => token.length > 0);
  const paths: string[] = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? '';
    paths.push(token.slice(3));
    index += 1;
    if (RENAMED.test(token.slice(0, 2))) index += 1;
  }
  return paths;
};

const writtenSince = (file: string, since: number): boolean => {
  try {
    const stat = statSync(file);
    return stat.isFile() && stat.mtimeMs >= since - MTIME_SLACK_MS;
  } catch {
    return false;
  }
};

export const changedSince = (cwd: string, since: number): Changes => {
  const top = run('git', ['rev-parse', '--show-toplevel'], cwd);
  if (top.code !== 0) {
    return {
      ok: false,
      reason:
        'this is not a git repository, so the files the command wrote could not be listed',
    };
  }
  const root = top.stdout.trim();
  const status = run(
    'git',
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    root,
  );
  if (status.code !== 0) {
    return {
      ok: false,
      reason: `git status failed (${firstLine(status.stderr)})`,
    };
  }
  const files = parsePorcelain(status.stdout)
    .map((path) => join(root, path))
    .filter((file) => writtenSince(file, since));
  return { ok: true, top: root, files };
};

export const committedContent = (top: string, file: string): string | null => {
  const path = relative(top, file).split(sep).join('/');
  const shown = run('git', ['show', `HEAD:${path}`], top);
  if (shown.code !== 0) return null;
  return shown.stdout;
};
