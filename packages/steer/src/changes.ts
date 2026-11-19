import { statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { run } from 'legion-audit';
import { firstLine } from './text.js';

export const MTIME_SLACK_MS = 1000;

export type Changes =
  | {
      ok: true;
      top: string;
      files: string[];
      base: string | null;
      notices: string[];
    }
  | { ok: false; reason: string };

interface History {
  paths: string[];
  base: string | null;
  notices: string[];
}

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

const nulSeparated = (raw: string): string[] =>
  raw.split('\0').filter((path) => path.length > 0);

const writtenSince = (file: string, since: number): boolean => {
  try {
    const stat = statSync(file);
    return stat.isFile() && stat.mtimeMs >= since - MTIME_SLACK_MS;
  } catch {
    return false;
  }
};

export const headOf = (cwd: string): string | null => {
  const head = run('git', ['rev-parse', '--verify', '-q', 'HEAD'], cwd);
  if (head.code !== 0) return null;
  return head.stdout.trim();
};

const resolvable = (top: string, sha: string): boolean =>
  run('git', ['cat-file', '-e', `${sha}^{commit}`], top).code === 0;

const lostStart = (startHead: string): History => ({
  paths: [],
  base: 'HEAD',
  notices: [
    `HEAD moved from ${startHead.slice(0, 12)} during the command and that commit can no longer be found, so files the command committed could not be listed and were not checked`,
  ],
});

export const sinceStart = (top: string, startHead: string): History => {
  const current = headOf(top);
  if (startHead.length === 0) {
    if (current === null) return { paths: [], base: null, notices: [] };
    const tracked = run('git', ['ls-files', '-z'], top);
    return { paths: nulSeparated(tracked.stdout), base: null, notices: [] };
  }
  if (current === startHead) return { paths: [], base: startHead, notices: [] };
  if (!resolvable(top, startHead)) return lostStart(startHead);
  const diff = run('git', ['diff', '--name-only', '-z', startHead], top);
  return { paths: nulSeparated(diff.stdout), base: startHead, notices: [] };
};

export const changedSince = (
  cwd: string,
  since: number,
  startHead: string,
): Changes => {
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
  const history = sinceStart(root, startHead);
  const paths = new Set([...parsePorcelain(status.stdout), ...history.paths]);
  const files = [...paths]
    .map((path) => join(root, path))
    .filter((file) => writtenSince(file, since));
  return {
    ok: true,
    top: root,
    files,
    base: history.base,
    notices: history.notices,
  };
};

export const committedContent = (
  top: string,
  file: string,
  base: string | null,
): string | null => {
  if (base === null) return null;
  const path = relative(top, file).split(sep).join('/');
  const shown = run('git', ['show', `${base}:${path}`], top);
  if (shown.code !== 0) return null;
  return shown.stdout;
};
