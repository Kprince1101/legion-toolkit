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
export { computeScore, SCORE_WEIGHTS } from './report/score.js';
export { findRegressions } from './report/baseline.js';
export { renderMarkdown } from './report/markdown.js';
export { parseArgs, HELP } from './args.js';
export type { CliArgs, FailOn } from './args.js';
export type * from './types.js';
