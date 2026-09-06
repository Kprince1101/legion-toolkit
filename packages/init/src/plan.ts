import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  devDependencies,
  eslintConfig,
  installCommand,
  lintScript,
  oxlintConfig,
  presetPath,
  tsconfigFor,
} from './templates.js';
import type {
  InitDetection,
  InitPlan,
  PlannedAction,
  Preset,
} from './types.js';

const read = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
};

const lintConfigAction = (
  detection: InitDetection,
  preset: Preset,
): PlannedAction => {
  if (detection.linter === 'oxlint') {
    const path = join(detection.root, '.oxlintrc.json');
    if (!existsSync(path)) {
      return {
        kind: 'create',
        path: '.oxlintrc.json',
        reason: `extends the ${preset} preset, so new rules arrive on upgrade`,
        contents: oxlintConfig(preset),
      };
    }
    if (read(path).includes('legion')) {
      return {
        kind: 'skip',
        path: '.oxlintrc.json',
        reason: 'already references the Legion plugin',
      };
    }
    return {
      kind: 'merge',
      path: '.oxlintrc.json',
      reason: `add "extends": ["${presetPath(preset)}"], keeping every other key`,
      extendsPath: presetPath(preset),
    };
  }
  const candidates = [
    'eslint.config.mjs',
    'eslint.config.js',
    'eslint.config.ts',
  ];
  const found = candidates.find((name) =>
    existsSync(join(detection.root, name)),
  );
  if (!found) {
    return {
      kind: 'create',
      path: 'eslint.config.mjs',
      reason: `spreads legion.configs.${preset}`,
      contents: eslintConfig(preset),
    };
  }
  if (read(join(detection.root, found)).includes('legion')) {
    return {
      kind: 'skip',
      path: found,
      reason: 'already references the Legion plugin',
    };
  }
  return {
    kind: 'manual',
    path: found,
    reason: `add: import legion from 'legion-toolkit/eslint-plugin'; then spread ...legion.configs.${preset}`,
  };
};

const tsconfigAction = (detection: InitDetection): PlannedAction => {
  if (detection.hasTsconfig) {
    return {
      kind: 'skip',
      path: 'tsconfig.json',
      reason: 'already present, left alone',
    };
  }
  return {
    kind: 'create',
    path: 'tsconfig.json',
    reason: `extends the ${detection.framework} base`,
    contents: tsconfigFor(detection.framework),
  };
};

const prettierAction = (detection: InitDetection): PlannedAction => {
  if (detection.hasPrettierConfig) {
    return {
      kind: 'skip',
      path: 'package.json',
      reason: 'a Prettier config already exists, left alone',
    };
  }
  return {
    kind: 'merge',
    path: 'package.json',
    reason: 'set "prettier": "legion-toolkit/prettier"',
  };
};

export const missingScripts = (
  detection: InitDetection,
): Array<'lint' | 'audit'> => {
  const missing: Array<'lint' | 'audit'> = [];
  if (detection.scripts['lint'] === undefined) missing.push('lint');
  if (detection.scripts['audit'] === undefined) missing.push('audit');
  return missing;
};

const scriptsAction = (detection: InitDetection): PlannedAction => {
  const missing = missingScripts(detection);
  if (missing.length === 0) {
    return {
      kind: 'skip',
      path: 'package.json',
      reason: 'lint and audit scripts already present, left alone',
    };
  }
  const described = missing
    .map((name) => {
      if (name === 'lint')
        return `scripts.lint = "${lintScript(detection.linter)}"`;
      return 'scripts.audit = "legion-audit --md AUDIT.md --json audit.json"';
    })
    .join(', ');
  return {
    kind: 'merge',
    path: 'package.json',
    reason: `add ${described}`,
  };
};

export const buildPlan = (
  detection: InitDetection,
  preset: Preset,
): InitPlan => {
  const actions = [
    lintConfigAction(detection, preset),
    tsconfigAction(detection),
    prettierAction(detection),
    scriptsAction(detection),
  ];
  return {
    detection,
    actions,
    install: installCommand(
      detection.packageManager,
      devDependencies(detection.linter),
    ),
  };
};
