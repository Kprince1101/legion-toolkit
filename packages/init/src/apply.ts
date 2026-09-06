import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { missingScripts } from './plan.js';
import { lintScript } from './templates.js';
import type { InitPlan, PlannedAction } from './types.js';

interface Manifest {
  scripts?: Record<string, string>;
  prettier?: unknown;
  [key: string]: unknown;
}

export class UnreadableManifestError extends Error {
  constructor(path: string) {
    super(
      `${path} could not be parsed as JSON, so it was left untouched. Fix it, then run init again.`,
    );
    this.name = 'UnreadableManifestError';
  }
}

const readManifest = (root: string): Manifest => {
  const path = join(root, 'package.json');
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
  } catch {
    throw new UnreadableManifestError(path);
  }
};

const mergeExtends = (root: string, action: PlannedAction): boolean => {
  if (action.extendsPath === undefined) return false;
  const path = join(root, action.path);
  if (!existsSync(path)) return false;
  let parsed: { extends?: string[] } & Record<string, unknown>;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as typeof parsed;
  } catch {
    throw new Error(
      `${action.path} could not be parsed as JSON, so it was left untouched.`,
    );
  }
  const existing = parsed.extends ?? [];
  if (existing.includes(action.extendsPath)) return false;
  parsed.extends = [...existing, action.extendsPath];
  writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`);
  return true;
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

const parseOrThrow = (path: string, label: string): void => {
  if (!existsSync(path)) return;
  try {
    JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(
      `${label} could not be parsed as JSON, so nothing was written. Fix it, then run init again.`,
    );
  }
};

export const preflight = (plan: InitPlan): void => {
  const root = plan.detection.root;
  const touchesManifest = plan.actions.some(
    (action) => action.path === 'package.json' && action.kind === 'merge',
  );
  if (touchesManifest) parseOrThrow(join(root, 'package.json'), 'package.json');
  for (const action of plan.actions) {
    if (action.kind !== 'merge') continue;
    if (action.extendsPath === undefined) continue;
    parseOrThrow(join(root, action.path), action.path);
  }
};

export const applyPlan = (plan: InitPlan): string[] => {
  preflight(plan);
  const written: string[] = [];
  for (const action of plan.actions) {
    if (writeAction(plan.detection.root, action)) written.push(action.path);
    if (action.kind === 'merge' && mergeExtends(plan.detection.root, action)) {
      written.push(action.path);
    }
  }
  const manifestChanges = applyManifest(plan);
  if (manifestChanges.length > 0) written.push('package.json');
  return written;
};
