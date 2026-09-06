import { RULE_LESSONS } from './lessons.js';
import { toolchainAdvice } from './toolchain.js';
import type {
  Advice,
  AuditResult,
  DirectivesResult,
  LintResult,
  PrHygiene,
  TestCoverage,
} from '../types.js';

const MAX_DETAIL = 6;
const TOP_RULES = 3;

const withOverflow = (lines: string[], total: number): string[] => {
  if (total <= lines.length) return lines;
  return [...lines, `...and ${total - lines.length} more`];
};

export const topRuleAdvice = (lint: LintResult): Advice[] => {
  const ranked = lint.rules
    .filter((rule) => RULE_LESSONS[rule.rule] !== undefined)
    .filter((rule) => rule.errors + rule.warnings > 0)
    .slice(0, TOP_RULES);
  return ranked.map((rule) => {
    const lesson = RULE_LESSONS[rule.rule] as (typeof RULE_LESSONS)[string];
    const hits = lint.legion
      .concat(lint.componentCap)
      .filter((finding) => finding.rule === rule.rule);
    const files = [...new Set(hits.map((finding) => finding.file))];
    return {
      id: `rule:${rule.rule}`,
      area: 'rules' as const,
      title: `${rule.rule} fires ${rule.errors + rule.warnings} time(s).`,
      why: lesson.why,
      fix: lesson.fix,
      detail: withOverflow(files.slice(0, MAX_DETAIL), files.length),
    };
  });
};

const COVERAGE_WORDING: Record<TestCoverage['source'], string> = {
  'coverage-report':
    'Measured from your coverage report, so this is what the tests actually execute.',
  references:
    'Inferred from what your test files import and describe, so a batch file covering many components counts for all of them.',
  filenames:
    'Inferred from filenames only. Run the tests with coverage once and this becomes a measurement instead of a guess.',
};

export const testAdvice = (coverage: TestCoverage): Advice | null => {
  if (coverage.missing.length === 0) return null;
  const components = coverage.missing.filter(
    (entry) => entry.kind === 'component',
  ).length;
  const hooks = coverage.missing.length - components;
  const files = coverage.missing.map((entry) => entry.file);
  const detail = [
    COVERAGE_WORDING[coverage.source],
    ...withOverflow(files.slice(0, MAX_DETAIL), files.length),
  ];
  return {
    id: 'missing-tests',
    area: 'tests',
    title: `${components} component(s) and ${hooks} hook(s) are not covered by a test.`,
    why: 'Section 8: a feature without tests is incomplete. The hooks are the cheap ones to start with, because a view-model hook is a plain function that takes props and returns an object.',
    fix: [
      'hooks: call it with props and assert the returned object',
      'components: Testing Library with the hook mocked',
      'one file per component is not required; group them however reads best',
    ],
    detail,
  };
};

export const bypassAdvice = (directives: DirectivesResult): Advice | null => {
  if (directives.fileWide.length === 0) return null;
  const lesson = RULE_LESSONS[
    'legion/scoped-disables'
  ] as (typeof RULE_LESSONS)[string];
  const files = directives.fileWide.map((hit) => `${hit.file}:${hit.line}`);
  return {
    id: 'file-wide-disables',
    area: 'bypasses',
    title: `${directives.fileWide.length} file-wide lint disable(s).`,
    why: lesson.why,
    fix: lesson.fix,
    detail: withOverflow(files.slice(0, MAX_DETAIL), files.length),
  };
};

const PR_HYGIENE_FLOOR = 0.2;

export const prAdvice = (hygiene: PrHygiene): Advice | null => {
  if (hygiene.status === 'skipped') return null;
  if (hygiene.ratio >= PR_HYGIENE_FLOOR) return null;
  const direct = hygiene.inspected - hygiene.withPr;
  return {
    id: 'pr-hygiene',
    area: 'process',
    title: `${direct} of the last ${hygiene.inspected} commits landed straight on the branch.`,
    why: 'Not a problem by itself, and it does not affect the score. Section 12 only requires a PR on a client repo, where nothing reaches main without review. On your own repo it is your call, so the thing to check is that the commit messages carry what a PR description would have said, because they are then the only record.',
    fix: [
      'client repo: git switch -c <branch>, gh pr create --fill, never merge it yourself',
      'own repo: nothing to change, as long as the commit message says why',
    ],
    detail: [],
  };
};

export const buildAdvice = (
  result: Omit<AuditResult, 'schema' | 'generatedAt' | 'score' | 'advice'>,
): Advice[] => {
  const entries: Advice[] = [
    ...toolchainAdvice(result.toolchain, result.lockfile, result.expo),
    ...topRuleAdvice(result.lint),
  ];
  const tests = testAdvice(result.testCoverage);
  if (tests) entries.push(tests);
  const bypasses = bypassAdvice(result.directives);
  if (bypasses) entries.push(bypasses);
  const process = prAdvice(result.prHygiene);
  if (process) entries.push(process);
  return entries;
};

export { RULE_LESSONS } from './lessons.js';
export {
  yarnMigrationSteps,
  toolchainAdvice,
  TARGET_YARN,
} from './toolchain.js';
export type { Lesson } from './lessons.js';
