import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LockfileResult, PackageManager } from '../types.js';

const LOCKFILES: Array<[string, PackageManager]> = [
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
];

export const lockfileCheck = (root: string): LockfileResult => {
  const found = LOCKFILES.filter(([name]) => existsSync(join(root, name)));
  const names = found.map(([name]) => name);
  const managers = new Set(found.map(([, manager]) => manager));
  let status: LockfileResult['status'] = 'pass';
  if (managers.size !== 1) status = 'fail';
  const [packageManager = 'unknown'] = [...managers];
  return { status, found: names, packageManager };
};
