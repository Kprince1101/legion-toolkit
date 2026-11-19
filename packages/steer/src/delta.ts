import type { Finding } from 'legion-audit';

export const errorsOf = (findings: Finding[]): Finding[] =>
  findings.filter((finding) => finding.severity === 'error');

const keyOf = (finding: Finding): string =>
  `${finding.rule}|${finding.message.replace(/\d+/g, '#')}`;

export const introduced = (after: Finding[], before: Finding[]): Finding[] => {
  const remaining = new Map<string, number>();
  for (const finding of before) {
    const key = keyOf(finding);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  return after.filter((finding) => {
    const key = keyOf(finding);
    const left = remaining.get(key) ?? 0;
    if (left === 0) return true;
    remaining.set(key, left - 1);
    return false;
  });
};
