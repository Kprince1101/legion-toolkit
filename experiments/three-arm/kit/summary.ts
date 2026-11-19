import { ARMS } from './arms.ts';
import type { Arm } from './arms.ts';
import { tamperCount } from './guards.ts';
import type { RunRecord } from './record.ts';
import { emptyOutcomes, MAIN_AGENT, OUTCOMES } from './transcript.ts';
import type { Outcome } from './transcript.ts';

const OUTCOME_LABEL: Record<Outcome, string> = {
  fixed: 'fixed',
  bypassed: 'bypassed',
  'switched-to-edit': 'via Edit',
  'shell-write': 'via shell',
  'flagged-again': 'blocked again',
  abandoned: 'dropped',
  unknown: 'unknown',
};

const DASH = '–';

export const formatCount = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
};

export const formatCost = (value: number | null): string => {
  if (value === null) return DASH;
  return `$${value.toFixed(2)}`;
};

const formatMaybe = (value: number | null): string => {
  if (value === null) return DASH;
  return String(value);
};

export const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

const sum = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0);

export const outcomeText = (counts: Record<Outcome, number>): string => {
  const parts = OUTCOMES.flatMap((outcome) => {
    const count = counts[outcome];
    if (count === 0) return [];
    return [`${count} ${OUTCOME_LABEL[outcome]}`];
  });
  if (parts.length === 0) return DASH;
  return parts.join(', ');
};

const acceptanceText = (record: RunRecord): string => {
  if (!record.acceptance.ran) return 'not run';
  return `${record.acceptance.passed}/${record.acceptance.total}`;
};

const blocksOf = (record: RunRecord): number =>
  (record.transcript?.hookEvents ?? []).filter(
    (event) => event.kind === 'block',
  ).length;

const blocksText = (record: RunRecord): string => {
  const inSubagents = (record.transcript?.hookEvents ?? []).filter(
    (event) => event.kind === 'block' && event.agent !== MAIN_AGENT,
  ).length;
  const total = String(blocksOf(record));
  if (inSubagents === 0) return total;
  return `${total} (${inSubagents} in subagents)`;
};

const reportsOf = (record: RunRecord): number =>
  (record.transcript?.hookEvents ?? []).filter(
    (event) => event.kind === 'report',
  ).length;

const biggestText = (record: RunRecord): string => {
  const biggest = record.largest[0];
  if (biggest === undefined) return DASH;
  return `${biggest.file} (${biggest.lines})`;
};

const tokensText = (record: RunRecord): string => {
  const tokens = record.transcript?.tokens;
  if (tokens === undefined) return DASH;
  const input = tokens.input + tokens.cacheCreation + tokens.cacheRead;
  return `${formatCount(input)} / ${formatCount(tokens.output)}`;
};

const tamperText = (record: RunRecord): string => {
  const count = tamperCount(record.tampered);
  if (count === 0) return '0';
  const names = [
    ...record.tampered.changed,
    ...record.tampered.added,
    ...record.tampered.removed,
  ];
  return `${count}: ${names.join(', ')}`;
};

const auditNumber = (
  record: RunRecord,
  pick: (audit: NonNullable<RunRecord['audit']>) => number,
): string => {
  if (record.audit === null) return DASH;
  return String(pick(record.audit));
};

export const RUN_HEADERS = [
  'arm',
  'run',
  'acceptance',
  'lint errors',
  'legion findings',
  'components > cap',
  'disables',
  'ts suppressions',
  'hook blocks',
  'after each block',
  'post-edit reports',
  'shell writes to .ts',
  'guardrail files changed',
  'biggest file (lines)',
  'tokens in / out',
  'cost',
  'compactions',
];

export const runRow = (record: RunRecord): string[] => [
  record.arm,
  record.runId,
  acceptanceText(record),
  auditNumber(record, (audit) => audit.lintErrors),
  auditNumber(record, (audit) => audit.legionFindings),
  auditNumber(record, (audit) => audit.componentCap),
  auditNumber(record, (audit) => audit.directives),
  String(record.tsSuppressions),
  blocksText(record),
  outcomeText(record.transcript?.blockOutcomes ?? emptyOutcomes()),
  String(reportsOf(record)),
  String(record.transcript?.shellWritesToSource.length ?? 0),
  tamperText(record),
  biggestText(record),
  tokensText(record),
  formatCost(record.costUsd),
  formatMaybe(record.transcript?.compactions ?? null),
];

const addCounts = (
  left: Record<Outcome, number>,
  right: Record<Outcome, number>,
): Record<Outcome, number> =>
  Object.fromEntries(
    OUTCOMES.map((outcome) => [outcome, left[outcome] + right[outcome]]),
  ) as Record<Outcome, number>;

const passRate = (records: RunRecord[]): string => {
  const ran = records.filter((record) => record.acceptance.ran);
  if (ran.length === 0) return DASH;
  const rates = ran.map((record) => {
    if (record.acceptance.total === 0) return 0;
    return record.acceptance.passed / record.acceptance.total;
  });
  return `${Math.round((sum(rates) / rates.length) * 100)}%`;
};

const medianOf = (
  records: RunRecord[],
  pick: (record: RunRecord) => number | null,
): string => {
  const values = records.flatMap((record) => {
    const value = pick(record);
    if (value === null) return [];
    return [value];
  });
  return formatMaybe(median(values));
};

const totalOf = (
  records: RunRecord[],
  pick: (record: RunRecord) => number,
): string => String(sum(records.map(pick)));

export const ARM_HEADERS = [
  'arm',
  'runs',
  'mean acceptance pass rate',
  'median lint errors',
  'median legion findings',
  'median components > cap',
  'total disables',
  'total ts suppressions',
  'total hook blocks',
  'after each block',
  'total shell writes to .ts',
  'runs that changed guardrail files',
  'median biggest file (lines)',
  'median cost',
  'total compactions',
];

export const armRow = (arm: Arm, records: RunRecord[]): string[] => {
  const outcomes = records.reduce(
    (total, record) =>
      addCounts(total, record.transcript?.blockOutcomes ?? emptyOutcomes()),
    emptyOutcomes(),
  );
  const costs = records.flatMap((record) => {
    if (record.costUsd === null) return [];
    return [record.costUsd];
  });
  return [
    arm,
    String(records.length),
    passRate(records),
    medianOf(records, (record) => record.audit?.lintErrors ?? null),
    medianOf(records, (record) => record.audit?.legionFindings ?? null),
    medianOf(records, (record) => record.audit?.componentCap ?? null),
    totalOf(records, (record) => record.audit?.directives ?? 0),
    totalOf(records, (record) => record.tsSuppressions),
    totalOf(records, blocksOf),
    outcomeText(outcomes),
    totalOf(
      records,
      (record) => record.transcript?.shellWritesToSource.length ?? 0,
    ),
    String(records.filter((record) => tamperCount(record.tampered) > 0).length),
    medianOf(records, (record) => record.largest[0]?.lines ?? null),
    formatCost(median(costs)),
    totalOf(records, (record) => record.transcript?.compactions ?? 0),
  ];
};

const cell = (value: string): string => value.replaceAll('|', '\\|');

export const markdownTable = (headers: string[], rows: string[][]): string => {
  const line = (cells: string[]) => `| ${cells.map(cell).join(' | ')} |`;
  return [
    line(headers),
    line(headers.map(() => '---')),
    ...rows.map(line),
  ].join('\n');
};

const stepTrend = (record: RunRecord): string => {
  if (record.perStep.length === 0) return DASH;
  return record.perStep
    .map((step) => `${step.step}: ${step.lintErrors}`)
    .join(' → ');
};

const byArmThenRun = (a: RunRecord, b: RunRecord): number =>
  ARMS.indexOf(a.arm) - ARMS.indexOf(b.arm) || a.runId.localeCompare(b.runId);

export const renderSummary = (records: RunRecord[]): string => {
  const sorted = [...records].sort(byArmThenRun);
  const arms = ARMS.filter((arm) =>
    sorted.some((record) => record.arm === arm),
  );
  return [
    '# Three-arm results',
    '',
    '## By arm',
    '',
    markdownTable(
      ARM_HEADERS,
      arms.map((arm) =>
        armRow(
          arm,
          sorted.filter((record) => record.arm === arm),
        ),
      ),
    ),
    '',
    '## By run',
    '',
    markdownTable(RUN_HEADERS, sorted.map(runRow)),
    '',
    '## Lint errors after each step',
    '',
    markdownTable(
      ['arm', 'run', 'errors after each step'],
      sorted.map((record) => [record.arm, record.runId, stepTrend(record)]),
    ),
    '',
  ].join('\n');
};
