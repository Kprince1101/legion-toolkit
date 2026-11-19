import { rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { listFiles } from './tree.ts';

const LINT_CONFIG =
  /^(?:\.oxlintrc(?:\.jsonc?)?|oxlint\.config\.[cm]?[jt]s|eslint\.config\.[cm]?[jt]s|\.eslintrc(?:\.(?:json|jsonc|js|cjs|mjs|yml|yaml))?)$/;

export const isLintConfig = (file: string): boolean =>
  LINT_CONFIG.test(basename(file));

export const lintConfigsIn = (root: string): string[] =>
  listFiles(root).filter(isLintConfig);

export const removeLintConfigs = (root: string): string[] => {
  const found = lintConfigsIn(root);
  for (const file of found) rmSync(join(root, file), { force: true });
  return found;
};
