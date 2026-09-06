export { rules, RULE_NAMES } from './rules/index.js';
export type { LegionRuleName } from './rules/index.js';
export {
  defineLegionConfig,
  COMPONENT_LINE_CAP,
  DEFAULT_ANY_BOUNDARIES,
  DEFAULT_COMPONENT_FILES,
  DEFAULT_TEST_FILES,
} from './config/define.js';
export type {
  LegionConfig,
  LegionConfigInput,
  OxlintConfig,
  OxlintOverride,
  EslintFlatConfig,
  EslintExtras,
} from './config/define.js';
export {
  recommended,
  strict,
  recommendedInput,
  strictInput,
} from './config/presets.js';
export { levelToSeverity, isLevel, isLocked, LEVELS } from './config/levels.js';
export type { RuleEntry } from './config/levels.js';
export { parseDirective, bareRuleName } from './directives.js';
export type { Directive, DirectiveKind, DirectiveScope } from './directives.js';
export {
  BUILT_IN_ALLOWED_COMMENT_PATTERNS,
  normalizeComment,
} from './rules/no-narrative-comments.js';
export type { NoNarrativeCommentsOptions } from './rules/no-narrative-comments.js';
export type { ScopedDisablesOptions } from './rules/scoped-disables.js';
export type { PresentationalComponentsOptions } from './rules/presentational-components.js';
export type { NoAdminClientInBrowserOptions } from './rules/no-admin-client-in-browser.js';
export { isAppRouteFile } from './rules/no-use-client-in-page.js';
export type { Level, Severity, LegionRuleModule } from './types.js';
