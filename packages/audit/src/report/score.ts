import type { AuditResult } from '../types.js';

export const SCORE_WEIGHTS = {
  legionError: 2,
  legionErrorCap: 40,
  warning: 0.5,
  warningCap: 10,
  typecheckFail: 15,
  lintFail: 15,
  testsFail: 20,
  formatFail: 5,
  prHygieneMax: 10,
  missingTest: 1,
  missingTestCap: 15,
  fileWideDisable: 5,
  fileWideDisableCap: 15,
} as const;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const gatePenalty = (
  result: Pick<AuditResult, 'gates'>,
  name: string,
  penalty: number,
): number => {
  const gate = result.gates.find((entry) => entry.name === name);
  if (gate?.status === 'fail') return penalty;
  return 0;
};

export const computeScore = (
  result: Omit<AuditResult, 'score' | 'schema' | 'generatedAt'>,
): number => {
  const w = SCORE_WEIGHTS;
  let score = 100;
  const legionErrors = result.lint.legion.filter(
    (finding) => finding.severity === 'error',
  ).length;
  score -= clamp(legionErrors * w.legionError, 0, w.legionErrorCap);
  score -= clamp(result.lint.warnings * w.warning, 0, w.warningCap);
  score -= gatePenalty(result, 'typecheck', w.typecheckFail);
  score -= gatePenalty(result, 'lint', w.lintFail);
  score -= gatePenalty(result, 'tests', w.testsFail);
  score -= gatePenalty(result, 'format', w.formatFail);
  if (result.prHygiene.status !== 'skipped') {
    score -= (1 - result.prHygiene.ratio) * w.prHygieneMax;
  }
  score -= clamp(
    result.testCoverage.missing.length * w.missingTest,
    0,
    w.missingTestCap,
  );
  score -= clamp(
    result.directives.fileWide.length * w.fileWideDisable,
    0,
    w.fileWideDisableCap,
  );
  return Math.round(clamp(score, 0, 100));
};
