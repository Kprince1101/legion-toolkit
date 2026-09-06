import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const LOCKFILE_NAMES = [
  'yarn.lock',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
];

const MAX_DEPTH = 8;

export interface WorkspaceContext {
  root: string;
  workspaceRoot: string;
  isPackage: boolean;
}

const hasLockfile = (dir: string): boolean =>
  LOCKFILE_NAMES.some((name) => existsSync(join(dir, name)));

const declaresWorkspaces = (dir: string): boolean => {
  const path = join(dir, 'package.json');
  if (!existsSync(path)) return false;
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as {
      workspaces?: unknown;
    };
    return pkg.workspaces !== undefined;
  } catch {
    return false;
  }
};

export const ancestors = (root: string): string[] => {
  const dirs = [root];
  let current = root;
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    const parent = dirname(current);
    if (parent === current) break;
    dirs.push(parent);
    current = parent;
  }
  return dirs;
};

export const findWorkspaceRoot = (root: string): string => {
  if (hasLockfile(root)) return root;
  for (const dir of ancestors(root).slice(1)) {
    if (declaresWorkspaces(dir) && hasLockfile(dir)) return dir;
    if (hasLockfile(dir)) return dir;
  }
  return root;
};

export const workspaceContext = (root: string): WorkspaceContext => {
  const workspaceRoot = findWorkspaceRoot(root);
  return { root, workspaceRoot, isPackage: workspaceRoot !== root };
};
