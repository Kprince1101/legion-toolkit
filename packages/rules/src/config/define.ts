import type { Level } from '../types.js';
import type { LegionRuleName } from '../rules/index.js';
import { RULE_NAMES } from '../rules/index.js';
import type { NoNarrativeCommentsOptions } from '../rules/no-narrative-comments.js';
import type { PresentationalComponentsOptions } from '../rules/presentational-components.js';
import type { NoAdminClientInBrowserOptions } from '../rules/no-admin-client-in-browser.js';
import { isLocked, ruleEntry } from './levels.js';
import type { RuleEntry } from './levels.js';

export interface LegionConfigInput {
  rules?: Partial<Record<LegionRuleName, Level>>;
  noTernary?: Level;
  noExplicitAny?: Level;
  anyBoundaries?: string[];
  componentMaxLines?: number | false;
  componentFiles?: string[];
  testFiles?: string[];
  comments?: NoNarrativeCommentsOptions;
  components?: PresentationalComponentsOptions;
  adminClient?: NoAdminClientInBrowserOptions;
  reactCompiler?: boolean;
  reactNative?: boolean;
}

export interface OxlintOverride {
  files: string[];
  rules: Record<string, RuleEntry>;
}

export interface OxlintConfig {
  jsPlugins: string[];
  rules: Record<string, RuleEntry>;
  overrides: OxlintOverride[];
}

export interface EslintFlatConfig {
  name: string;
  files?: string[];
  plugins?: Record<string, unknown>;
  rules: Record<string, RuleEntry>;
}

export interface EslintExtras {
  typescriptEslint?: unknown;
}

export interface LegionConfig {
  levels: Record<string, Level>;
  locked: string[];
  oxlint: OxlintConfig;
  eslint: (plugin: unknown, extras?: EslintExtras) => EslintFlatConfig[];
}

export const DEFAULT_ANY_BOUNDARIES = [
  'lib/supabase/**',
  '**/*.d.ts',
  'types/db.ts',
];

export const REACT_NATIVE_ANY_BOUNDARIES = [
  'lib/supabase/**',
  'src/lib/supabase/**',
  '**/*.d.ts',
  'types/db.ts',
  'src/types/db.ts',
];

export const WEB_ONLY_RULES: LegionRuleName[] = [
  'no-use-client-in-page',
  'no-client-globals-in-state-init',
  'button-has-type',
  'no-target-blank-without-rel',
  'anchor-is-not-a-button',
  'img-has-alt',
  'no-dangerous-html',
];

export const NATIVE_ONLY_RULES: LegionRuleName[] = [
  'no-rn-button',
  'touchable-has-accessibility-label',
  'controlled-text-input',
  'no-web-dialogs',
];

export const REACT_NATIVE_BROWSER_PATHS = ['/'];

export const DEFAULT_COMPONENT_FILES = ['**/*.tsx'];

export const DEFAULT_TEST_FILES = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
];

export const COMPONENT_LINE_CAP = 180;

export const TEST_EXEMPT_RULES: LegionRuleName[] = ['no-hardcoded-hex'];

const PLUGIN_PACKAGE = 'eslint-plugin-legion';

const TERNARY_RULES_OXLINT = [
  'no-ternary',
  'no-unneeded-ternary',
  'unicorn/prefer-logical-operator-over-ternary',
];

const TERNARY_RULES_ESLINT = ['no-ternary', 'no-unneeded-ternary'];

const highestLevel = (input: LegionConfigInput): Level => {
  const explicit = input.rules?.['no-manual-memo'];
  if (explicit !== undefined && explicit > 0) return explicit;
  const levels = Object.values(input.rules ?? {}) as Level[];
  if (levels.length === 0) return 3;
  return Math.max(...levels) as Level;
};

const resolveLevels = (
  input: LegionConfigInput,
): Record<LegionRuleName, Level> => {
  const resolved = {} as Record<LegionRuleName, Level>;
  for (const name of RULE_NAMES) {
    resolved[name] = input.rules?.[name] ?? 0;
  }
  if (input.reactCompiler === true) {
    resolved['no-manual-memo'] = highestLevel(input);
  }
  if (input.reactNative === true) {
    for (const name of WEB_ONLY_RULES) resolved[name] = 0;
    return resolved;
  }
  for (const name of NATIVE_ONLY_RULES) resolved[name] = 0;
  return resolved;
};

const adminClientOptions = (
  input: LegionConfigInput,
): NoAdminClientInBrowserOptions => {
  const configured: NoAdminClientInBrowserOptions = input.adminClient ?? {};
  if (input.reactNative !== true) return configured;
  if (configured.browserPaths !== undefined) return configured;
  return { ...configured, browserPaths: REACT_NATIVE_BROWSER_PATHS };
};

const defaultAnyBoundaries = (input: LegionConfigInput): string[] => {
  if (input.reactNative === true) return REACT_NATIVE_ANY_BOUNDARIES;
  return DEFAULT_ANY_BOUNDARIES;
};

const optionsFor = (
  name: LegionRuleName,
  input: LegionConfigInput,
  locked: string[],
): unknown => {
  if (name === 'no-narrative-comments') return input.comments ?? {};
  if (name === 'scoped-disables') return { locked };
  if (name === 'presentational-components') {
    return {
      ...(input.components ?? {}),
      reactCompiler: input.reactCompiler === true,
    };
  }
  if (name === 'no-admin-client-in-browser') return adminClientOptions(input);
  return undefined;
};

const ternaryOptions = (name: string): unknown => {
  if (name === 'no-unneeded-ternary') return { defaultAssignment: false };
  return undefined;
};

const maxLinesEntry = (cap: number): RuleEntry => [
  'error',
  { max: cap, skipBlankLines: true, skipComments: true },
];

const testFileRules = (withCap: boolean): Record<string, RuleEntry> => {
  const rules: Record<string, RuleEntry> = {};
  if (withCap) rules['max-lines'] = 'off';
  for (const name of TEST_EXEMPT_RULES) rules[`legion/${name}`] = 'off';
  return rules;
};

export const defineLegionConfig = (input: LegionConfigInput): LegionConfig => {
  const ruleLevels = resolveLevels(input);
  const noTernary = input.noTernary ?? 0;
  const noExplicitAny = input.noExplicitAny ?? 0;
  const anyBoundaries = input.anyBoundaries ?? defaultAnyBoundaries(input);
  const componentFiles = input.componentFiles ?? DEFAULT_COMPONENT_FILES;
  const testFiles = input.testFiles ?? DEFAULT_TEST_FILES;
  const cap = input.componentMaxLines ?? COMPONENT_LINE_CAP;

  const levels: Record<string, Level> = { ...ruleLevels };
  for (const name of TERNARY_RULES_OXLINT) levels[name] = noTernary;
  levels['no-explicit-any'] = noExplicitAny;
  if (cap !== false) levels['max-lines'] = 3;

  const locked = Object.entries(levels)
    .filter(([, level]) => isLocked(level))
    .map(([name]) => name);

  const legionRules = (prefix: string): Record<string, RuleEntry> => {
    const entries: Record<string, RuleEntry> = {};
    for (const name of RULE_NAMES) {
      entries[`${prefix}${name}`] = ruleEntry(
        ruleLevels[name],
        optionsFor(name, input, locked),
      );
    }
    return entries;
  };

  const oxlintRules: Record<string, RuleEntry> = legionRules('legion/');
  for (const name of TERNARY_RULES_OXLINT) {
    oxlintRules[name] = ruleEntry(noTernary, ternaryOptions(name));
  }
  oxlintRules['typescript/no-explicit-any'] = ruleEntry(noExplicitAny);

  const oxlintOverrides: OxlintOverride[] = [];
  if (cap !== false) {
    oxlintOverrides.push({
      files: componentFiles,
      rules: { 'max-lines': maxLinesEntry(cap) },
    });
    oxlintOverrides.push({ files: testFiles, rules: testFileRules(true) });
  }
  oxlintOverrides.push({
    files: anyBoundaries,
    rules: { 'typescript/no-explicit-any': 'off' },
  });

  const oxlint: OxlintConfig = {
    jsPlugins: [PLUGIN_PACKAGE],
    rules: oxlintRules,
    overrides: oxlintOverrides,
  };

  const eslint = (
    plugin: unknown,
    extras?: EslintExtras,
  ): EslintFlatConfig[] => {
    const base: Record<string, RuleEntry> = legionRules('legion/');
    for (const name of TERNARY_RULES_ESLINT) {
      base[name] = ruleEntry(noTernary, ternaryOptions(name));
    }
    const configs: EslintFlatConfig[] = [
      { name: 'legion/rules', plugins: { legion: plugin }, rules: base },
    ];
    if (cap !== false) {
      configs.push({
        name: 'legion/component-line-cap',
        files: componentFiles,
        rules: { 'max-lines': maxLinesEntry(cap) },
      });
      configs.push({
        name: 'legion/test-files',
        files: testFiles,
        rules: testFileRules(true),
      });
    }
    if (extras?.typescriptEslint) {
      configs.push({
        name: 'legion/no-explicit-any',
        plugins: { '@typescript-eslint': extras.typescriptEslint },
        rules: {
          '@typescript-eslint/no-explicit-any': ruleEntry(noExplicitAny),
        },
      });
      configs.push({
        name: 'legion/any-boundaries',
        files: anyBoundaries,
        rules: { '@typescript-eslint/no-explicit-any': 'off' },
      });
    }
    return configs;
  };

  return { levels, locked, oxlint, eslint };
};
