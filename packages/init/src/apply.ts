import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { missingScripts } from './plan.js';
import { lintScript } from './templates.js';
import type { InitPlan, PlannedAction } from './types.js';

interface Manifest {
  scripts?: Record<string, string>;
  prettier?: unknown;
  [key: string]: unknown;
}

const readManifest = (root: string): Manifest => {
  try {
    return JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    ) as Manifest;
  } catch {
    return {};
  }
};

export const applyManifest = (plan: InitPlan): string[] => {
  const changes: string[] = [];
  const wantsPrettier = plan.actions.some(
    (action) =>
      action.path === 'package.json' && action.reason.includes('prettier'),
  );
  const missing = missingScripts(plan.detection);
  if (!wantsPrettier && missing.length === 0) return changes;
  const manifest = readManifest(plan.detection.root);
  if (wantsPrettier) {
    manifest['prettier'] = 'legion-toolkit/prettier';
    changes.push('prettier: legion-toolkit/prettier');
  }
  if (missing.length > 0) {
    const scripts = manifest.scripts ?? {};
    for (const name of missing) {
      if (name === 'lint') scripts['lint'] = lintScript(plan.detection.linter);
      else scripts['audit'] = 'legion-audit --md AUDIT.md --json audit.json';
      changes.push(`scripts.${name}`);
    }
    manifest.scripts = scripts;
  }
  writeFileSync(
    join(plan.detection.root, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return changes;
};

const writeAction = (root: string, action: PlannedAction): boolean => {
  if (action.kind !== 'create') return false;
  if (action.contents === undefined) return false;
  if (action.path === 'package.json') return false;
  writeFileSync(join(root, action.path), action.contents);
  return true;
};

export const applyPlan = (plan: InitPlan): string[] => {
  const written: string[] = [];
  for (const action of plan.actions) {
    if (writeAction(plan.detection.root, action)) written.push(action.path);
  }
  const manifestChanges = applyManifest(plan);
  if (manifestChanges.length > 0) written.push('package.json');
  return written;
};
