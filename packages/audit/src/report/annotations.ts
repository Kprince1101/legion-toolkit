import type { AuditResult, Finding } from '../types.js';

const escape = (value: string): string =>
  value
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');

const level = (finding: Finding): string => {
  if (finding.severity === 'warning') return 'warning';
  return 'error';
};

export const annotation = (finding: Finding): string => {
  const parts = [
    `file=${escape(finding.file)}`,
    `line=${finding.line}`,
    `title=${escape(finding.rule)}`,
  ];
  return `::${level(finding)} ${parts.join(',')}::${escape(finding.message)}`;
};

export const renderAnnotations = (result: AuditResult): string => {
  const lines = result.suppressions.findings.map(annotation);
  for (const entry of result.dependencies.forbidden) {
    lines.push(
      `::error title=${escape('forbidden dependency')}::${escape(
        `${entry.name} is not allowed here: ${entry.reason}. Use ${entry.instead}.`,
      )}`,
    );
  }
  return lines.join('\n');
};
