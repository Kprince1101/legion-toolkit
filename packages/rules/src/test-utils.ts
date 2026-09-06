import { RuleTester } from 'eslint';
import type { Rule } from 'eslint';
import * as tsParser from '@typescript-eslint/parser';
import type { LegionRuleModule } from './types.js';

export const createRuleTester = (): RuleTester =>
  new RuleTester({
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  });

export const asEslintRule = (rule: LegionRuleModule): Rule.RuleModule =>
  rule as unknown as Rule.RuleModule;

export const runRule = (
  name: string,
  rule: LegionRuleModule,
  tests: Parameters<RuleTester['run']>[2],
): void => {
  createRuleTester().run(name, asEslintRule(rule), tests);
};
