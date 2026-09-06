import legion from 'legion-toolkit/eslint-plugin';
import * as tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['node_modules/**'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  ...legion.configs.recommended,
];
