import type { Linter, Preset } from './types.js';

const PRESET_IMPORT: Record<Preset, string> = {
  recommended: 'recommended',
  strict: 'strict',
  reactNative: 'reactNative',
};

export const PRESET_FILE: Record<Preset, string> = {
  recommended: 'recommended',
  strict: 'strict',
  reactNative: 'react-native',
};

export const presetPath = (preset: Preset): string =>
  `./node_modules/legion-toolkit/presets/${PRESET_FILE[preset]}.json`;

export const oxlintConfig = (preset: Preset): string =>
  `${JSON.stringify(
    {
      $schema: './node_modules/oxlint/configuration_schema.json',
      extends: [presetPath(preset)],
      ignorePatterns: ['node_modules/**', '**/dist/**', 'coverage/**'],
    },
    null,
    2,
  )}\n`;

export const eslintConfig = (preset: Preset): string =>
  `import legion from 'legion-toolkit/eslint-plugin';
import * as tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['node_modules/**', 'dist/**', 'build/**', '.next/**', '.expo/**'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  ...legion.configs.${PRESET_IMPORT[preset]},
];
`;

export const tsconfigFor = (framework: string): string => {
  const base = tsconfigBase(framework);
  return `${JSON.stringify(
    { extends: `legion-toolkit/tsconfig/${base}.json`, include: ['.'] },
    null,
    2,
  )}\n`;
};

export const tsconfigBase = (framework: string): string => {
  if (framework === 'expo' || framework === 'react-native') {
    return 'react-native';
  }
  if (framework === 'next') return 'next';
  if (framework === 'node') return 'node';
  return 'base';
};

export const lintScript = (linter: Linter): string => {
  if (linter === 'oxlint') return 'legion-audit directives && oxlint .';
  return 'legion-audit directives && eslint .';
};

export const devDependencies = (linter: Linter): string[] => {
  const deps = ['legion-toolkit', 'prettier'];
  if (linter === 'oxlint') deps.push('oxlint');
  else deps.push('eslint', '@typescript-eslint/parser');
  return deps;
};

export const installCommand = (
  packageManager: string,
  deps: string[],
): string[] => {
  const joined = deps.join(' ');
  if (packageManager === 'npm') return [`npm install -D ${joined}`];
  if (packageManager === 'pnpm') return [`pnpm add -D ${joined}`];
  if (packageManager === 'bun') return [`bun add -d ${joined}`];
  return [`yarn add -D ${joined}`];
};
