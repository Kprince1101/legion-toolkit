export { runAudit, DEFAULT_OPTIONS } from './audit.js';
export {
  scanDirectives,
  parseDirectivesInSource,
  isFileWideDisable,
} from './checks/directives.js';
export {
  parseOxlintJson,
  parseEslintJson,
  countByRule,
  summarizeFindings,
  detectLinter,
} from './checks/lint.js';
export { summarizeTestOutput, countTypeErrors } from './checks/gates.js';
export { summarizePrHygiene } from './checks/git.js';
export { classify } from './checks/test-coverage.js';
export { lockfileCheck } from './checks/lockfile.js';
export {
  expoDoctorGate,
  classifyDoctorOutput,
  isExpoProject,
  isReactNativeProject,
  isPatchOnlyDrift,
  parseMismatchRows,
  parseVersion,
} from './checks/expo.js';
export type { DoctorVerdict } from './checks/expo.js';
export { detectToolchain, yarnFlavorFrom } from './checks/toolchain.js';
export {
  detectForge,
  forgeFromRemote,
  forgeLabel,
  forgePattern,
  forgeFix,
} from './checks/forge.js';
export {
  ruleCoverage,
  availableRules,
  configuredFromOxlint,
  configuredFromEslint,
  summarizeCoverage,
} from './checks/rule-coverage.js';
export { findWorkspaceRoot, workspaceContext, ancestors } from './workspace.js';
export {
  buildAdvice,
  toolchainAdvice,
  topRuleAdvice,
  testAdvice,
  bypassAdvice,
  prAdvice,
  ruleCoverageAdvice,
  dependencyAdvice,
  yarnMigrationSteps,
  RULE_LESSONS,
  TARGET_YARN,
} from './advice/index.js';
export type { Lesson } from './advice/index.js';
export { computeScore, SCORE_WEIGHTS } from './report/score.js';
export { findRegressions } from './report/baseline.js';
export { renderMarkdown } from './report/markdown.js';
export { renderConsole, wrap } from './report/console.js';
export { renderAnnotations, annotation } from './report/annotations.js';
export { dependencyCheck, findForbidden } from './checks/dependencies.js';
export {
  applySuppressions,
  buildSuppressions,
  readSuppressions,
  writeSuppressions,
  suppressionKey,
  SUPPRESSIONS_FILE,
} from './checks/suppressions.js';
export { parseArgs, HELP } from './args.js';
export type { CliArgs, FailOn } from './args.js';
export type * from './types.js';
