import { uncoveredShare } from './score.js';
import type { AuditResult, Regression } from '../types.js';

const percent = (share: number): string => `${Math.round(share * 100)}%`;

const gateStatus = (result: AuditResult, name: string): string =>
  result.gates.find((gate) => gate.name === name)?.status ?? 'skipped';

const legionErrors = (result: AuditResult): number =>
  result.lint.legion.filter((finding) => finding.severity === 'error').length;

export const findRegressions = (
  before: AuditResult,
  after: AuditResult,
): Regression[] => {
  const regressions: Regression[] = [];
  for (const gate of after.gates) {
    const previous = gateStatus(before, gate.name);
    if (previous === 'pass' && gate.status === 'fail') {
      regressions.push({
        area: `gate: ${gate.name}`,
        before: previous,
        after: gate.status,
      });
    }
  }
  const beforeLegion = legionErrors(before);
  const afterLegion = legionErrors(after);
  if (afterLegion > beforeLegion) {
    regressions.push({
      area: 'legion rule errors',
      before: String(beforeLegion),
      after: String(afterLegion),
    });
  }
  if (after.lint.errors > before.lint.errors) {
    regressions.push({
      area: 'lint errors',
      before: String(before.lint.errors),
      after: String(after.lint.errors),
    });
  }
  if (after.directives.fileWide.length > before.directives.fileWide.length) {
    regressions.push({
      area: 'file-wide disables',
      before: String(before.directives.fileWide.length),
      after: String(after.directives.fileWide.length),
    });
  }
  const beforeUncovered = uncoveredShare(before.testCoverage);
  const afterUncovered = uncoveredShare(after.testCoverage);
  if (afterUncovered > beforeUncovered) {
    regressions.push({
      area: 'share without tests',
      before: percent(beforeUncovered),
      after: percent(afterUncovered),
    });
  }
  if (after.score < before.score) {
    regressions.push({
      area: 'score',
      before: String(before.score),
      after: String(after.score),
    });
  }
  return regressions;
};
