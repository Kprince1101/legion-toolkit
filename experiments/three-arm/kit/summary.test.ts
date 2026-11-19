import type { Arm } from './arms.ts';
import type { RunRecord } from './record.ts';
import { NOT_RUN } from './reports.ts';
import {
  armRow,
  formatCount,
  markdownTable,
  median,
  outcomeText,
  renderSummary,
  runRow,
} from './summary.ts';
import { emptyOutcomes } from './transcript.ts';
import type { HookEvent } from './transcript.ts';

const block = (outcome: HookEvent['outcome'], agent = 'main'): HookEvent => ({
  agent,
  kind: 'block',
  toolUseId: 't',
  tool: 'Write',
  file: 'app/x.tsx',
  violations: 1,
  findings: [],
  outcome,
  callsUntilNext: 1,
  touchedGuardrails: false,
  afterCompaction: false,
  timestamp: null,
});

const record = (arm: Arm, runId: string, lintErrors: number): RunRecord => ({
  schema: 1,
  arm,
  runId,
  collectedAt: '2026-11-18T00:00:00.000Z',
  acceptance: { ...NOT_RUN, ran: true, passed: 22, failed: 2, total: 24 },
  audit: {
    score: 80,
    lintStatus: 'fail',
    lintErrors,
    lintWarnings: 0,
    legionFindings: lintErrors,
    componentCap: 1,
    topRules: [],
    directives: 2,
    fileWideDirectives: 0,
    directivesByRule: {},
    untested: 0,
  },
  auditError: null,
  tsSuppressions: 1,
  largest: [{ file: 'app/stats/StatsDashboard.tsx', lines: 512, bytes: 1 }],
  tsxOver180: 1,
  filesOver500: 1,
  transcript: {
    sessions: ['s'],
    models: ['m'],
    agents: ['main'],
    toolCalls: 10,
    compactions: 2,
    tokens: {
      input: 1000,
      output: 12_500,
      cacheCreation: 0,
      cacheRead: 2_000_000,
    },
    tokensByAgent: {},
    hookEvents: [block('fixed'), block('fixed'), block('shell-write')],
    blockOutcomes: { ...emptyOutcomes(), fixed: 2, 'shell-write': 1 },
    reportOutcomes: emptyOutcomes(),
    shellWritesToSource: [
      {
        agent: 'main',
        command: 'cat > app/x.tsx',
        targets: ['app/x.tsx'],
        afterCompaction: false,
      },
    ],
    guardrailEdits: [],
  },
  transcriptFiles: [],
  steps: [],
  costUsd: 3.5,
  tampered: { changed: ['.oxlintrc.json'], added: [], removed: [] },
  perStep: [
    {
      step: '01-build',
      lintErrors: 0,
      legionFindings: 0,
      componentCap: 0,
      directives: 0,
    },
    {
      step: '02-any-way-you-can',
      lintErrors: lintErrors,
      legionFindings: 0,
      componentCap: 0,
      directives: 0,
    },
  ],
});

describe('summary', () => {
  it('formats counts and medians', () => {
    expect(formatCount(950)).toBe('950');
    expect(formatCount(1500)).toBe('1.5k');
    expect(formatCount(12_500)).toBe('13k');
    expect(formatCount(2_001_000)).toBe('2.0M');
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it('lists only the outcomes that happened', () => {
    expect(outcomeText({ ...emptyOutcomes(), fixed: 2, bypassed: 1 })).toBe(
      '2 fixed, 1 bypassed',
    );
    expect(outcomeText(emptyOutcomes())).toBe('–');
  });

  it('says how many blocks happened inside subagents', () => {
    const base = record('steered', 'steered-2', 0);
    const withSubagent: RunRecord = {
      ...base,
      transcript: {
        ...(base.transcript as NonNullable<RunRecord['transcript']>),
        hookEvents: [block('fixed'), block('fixed', 's1/subagents/agent-x')],
      },
    };
    expect(runRow(withSubagent)[8]).toBe('2 (1 in subagents)');
  });

  it('renders one row per run', () => {
    expect(runRow(record('steered', 'steered-1', 4))).toEqual([
      'steered',
      'steered-1',
      '22/24',
      '4',
      '4',
      '1',
      '2',
      '1',
      '3',
      '2 fixed, 1 via shell',
      '0',
      '1',
      '1: .oxlintrc.json',
      'app/stats/StatsDashboard.tsx (512)',
      '2.0M / 13k',
      '$3.50',
      '2',
    ]);
  });

  it('aggregates an arm', () => {
    const row = armRow('raw', [
      record('raw', 'raw-1', 10),
      record('raw', 'raw-2', 20),
    ]);
    expect(row.slice(0, 4)).toEqual(['raw', '2', '92%', '15']);
    expect(row[9]).toBe('4 fixed, 2 via shell');
    expect(row[13]).toBe('$3.50');
  });

  it('escapes pipes inside a markdown cell', () => {
    expect(markdownTable(['a'], [['x | y']])).toBe(
      '| a |\n| --- |\n| x \\| y |',
    );
  });

  it('puts the arms in a fixed order', () => {
    const summary = renderSummary([
      record('steered', 'steered-1', 1),
      record('raw', 'raw-1', 9),
    ]);
    expect(summary.indexOf('| raw | raw-1')).toBeLessThan(
      summary.indexOf('| steered | steered-1'),
    );
    expect(summary).toContain('01-build: 0 → 02-any-way-you-can: 9');
  });
});
