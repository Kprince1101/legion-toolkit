import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DependencyFinding, DependencyResult } from '../types.js';

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface Forbidden {
  match: RegExp;
  reason: string;
  instead: string;
}

const FORBIDDEN: Forbidden[] = [
  {
    match: /^(redux|@reduxjs\/toolkit|react-redux)$/,
    reason: 'a global store in an app that has not shown it needs one',
    instead: 'useState, then Context with a guarded hook, then Zustand on RN',
  },
  {
    match: /^(mobx|mobx-react|mobx-react-lite)$/,
    reason: 'observable state is a second model of reactivity beside React',
    instead: 'useState, then Context with a guarded hook',
  },
  {
    match: /^(styled-components|@emotion\/(styled|react|css))$/,
    reason: 'runtime CSS-in-JS, which section 7 replaces with tokens',
    instead: 'Tailwind with @theme tokens on web, NativeWind on React Native',
  },
  {
    match: /^(moment)$/,
    reason: 'a large, mutable date library that is no longer maintained',
    instead:
      'Intl.DateTimeFormat, or date-fns when a helper is genuinely needed',
  },
];

const readManifest = (root: string): Manifest => {
  try {
    return JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    ) as Manifest;
  } catch {
    return {};
  }
};

export const findForbidden = (
  names: string[],
  declared: Record<string, string>,
): DependencyFinding[] => {
  const findings: DependencyFinding[] = [];
  for (const name of names) {
    const rule = FORBIDDEN.find((entry) => entry.match.test(name));
    if (!rule) continue;
    findings.push({
      name,
      version: declared[name] ?? '',
      reason: rule.reason,
      instead: rule.instead,
    });
  }
  return findings;
};

export const dependencyCheck = (root: string): DependencyResult => {
  const manifest = readManifest(root);
  const declared = { ...manifest.dependencies, ...manifest.devDependencies };
  const names = Object.keys(declared).sort();
  if (names.length === 0) {
    return { status: 'skipped', forbidden: [], inspected: 0 };
  }
  return {
    status: 'checked',
    forbidden: findForbidden(names, declared),
    inspected: names.length,
  };
};
