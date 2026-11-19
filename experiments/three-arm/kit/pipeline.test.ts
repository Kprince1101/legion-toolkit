import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectRun, loadRecords } from './collect.ts';
import type { GuardHashes } from './guards.ts';
import { projectSlug } from './isolation.ts';
import type { RunMeta } from './record.ts';
import { setupRun } from './setup.ts';
import { renderSummary } from './summary.ts';
import { listFiles } from './tree.ts';

const KIT = join(process.cwd(), 'experiments', 'three-arm');

let runs = '';
let raw: RunMeta;
let prose: RunMeta;

const quiet = (): void => undefined;

const setup = (arm: RunMeta['arm'], name: string): RunMeta =>
  setupRun({
    arm,
    runDir: join(runs, name),
    kitDir: KIT,
    toolkit: null,
    install: false,
    kitCommit: 'abc123',
    log: quiet,
  });

beforeAll(() => {
  runs = mkdtempSync(join(tmpdir(), 'three-arm-runs-'));
  raw = setup('raw', 'raw-1');
  prose = setup('prose', 'prose-1');
});

afterAll(() => {
  rmSync(runs, { recursive: true, force: true });
});

describe('setupRun', () => {
  it('gives every arm the same start and the prose arm only its rules', () => {
    const rawFiles = listFiles(raw.workspace);
    const proseFiles = listFiles(prose.workspace);
    expect(proseFiles.filter((file) => !rawFiles.includes(file))).toEqual([
      'CLAUDE.md',
    ]);
    expect(rawFiles).toEqual(
      expect.arrayContaining([
        'SPEC.md',
        'acceptance/habits.spec.ts',
        'app/page.tsx',
        'playwright.config.ts',
      ]),
    );
    expect(rawFiles).not.toContain('CLAUDE.md');
    expect(readFileSync(join(prose.workspace, 'CLAUDE.md'), 'utf8')).toBe(
      readFileSync(join(KIT, 'arms', 'prose', 'CLAUDE.md'), 'utf8'),
    );
  });

  it('commits a baseline and records the guarded files', () => {
    expect(existsSync(join(raw.workspace, '.git'))).toBe(true);
    expect(raw).toMatchObject({
      arm: 'raw',
      runId: 'raw-1',
      kitCommit: 'abc123',
      toolkit: null,
    });
    const baseline = JSON.parse(
      readFileSync(join(runs, 'prose-1', 'baseline.json'), 'utf8'),
    ) as GuardHashes;
    expect(Object.keys(baseline)).toEqual(
      expect.arrayContaining([
        'acceptance/auth.spec.ts',
        'playwright.config.ts',
        'CLAUDE.md',
        'package.json#scripts',
      ]),
    );
  });

  it('refuses to reuse a run directory', () => {
    expect(() => setup('raw', 'raw-1')).toThrow('already exists');
  });

  it('refuses a steered arm it cannot install', () => {
    expect(() => setup('steered', 'steered-1')).toThrow(
      'the steered arm needs the install',
    );
  });
});

describe('collectRun', () => {
  it('collects a run from its workspace, transcript and results', () => {
    const workspace = raw.workspace;
    mkdirSync(join(workspace, 'app', 'stats'), { recursive: true });
    writeFileSync(
      join(workspace, 'app', 'stats', 'StatsDashboard.tsx'),
      'export const a = 1;\n'.repeat(600),
    );
    writeFileSync(
      join(workspace, 'acceptance', 'auth.spec.ts'),
      'export {};\n',
    );
    const configDir = join(runs, 'claude-config');
    const project = join(
      configDir,
      'projects',
      projectSlug(realpathSync(workspace)),
    );
    mkdirSync(project, { recursive: true });
    const file = join(realpathSync(workspace), 'app', 'Panel.tsx');
    writeFileSync(
      join(project, 'session.jsonl'),
      [
        {
          type: 'assistant',
          uuid: 'a1',
          timestamp: '2026-11-18T00:00:01.000Z',
          message: {
            id: 'm1',
            usage: { input_tokens: 5, output_tokens: 1 },
            content: [
              {
                type: 'tool_use',
                id: 't1',
                name: 'Write',
                input: { file_path: file, content: 'x' },
              },
            ],
          },
        },
        {
          type: 'user',
          uuid: 'u1',
          timestamp: '2026-11-18T00:00:02.000Z',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 't1',
                is_error: true,
                content:
                  'legion-steer: 1 violation(s) would land in this file\n  app/Panel.tsx:1  bad',
              },
            ],
          },
        },
      ]
        .map((entry) => JSON.stringify(entry))
        .join('\n'),
    );
    writeFileSync(
      join(runs, 'raw-1', 'results', '01-build.json'),
      JSON.stringify({ session_id: 's', total_cost_usd: 2.5, num_turns: 3 }),
    );

    const record = collectRun({
      runDir: join(runs, 'raw-1'),
      kitDir: KIT,
      repoDir: runs,
      configDir,
      acceptance: false,
      log: quiet,
    });

    expect(record.auditError).toContain('legion-audit is missing');
    expect(record.tampered.changed).toEqual(['acceptance/auth.spec.ts']);
    expect(record.largest[0]).toMatchObject({
      file: 'app/stats/StatsDashboard.tsx',
      lines: 600,
    });
    expect(record.filesOver500).toBe(1);
    expect(record.tsxOver180).toBe(1);
    expect(record.transcriptFiles).toEqual(['transcripts/session.jsonl']);
    expect(record.transcript?.hookEvents.map((event) => event.outcome)).toEqual(
      ['abandoned'],
    );
    expect(record.costUsd).toBe(2.5);
    expect(existsSync(join(runs, 'raw-1', 'collected.json'))).toBe(true);

    const summary = renderSummary(loadRecords(runs));
    expect(summary).toContain('| raw | raw-1 | not run |');
  });

  it('reads subagent transcripts and tags their events', () => {
    const workspace = realpathSync(prose.workspace);
    const configDir = join(runs, 'claude-config-subagents');
    const project = join(configDir, 'projects', projectSlug(workspace));
    const jsonl = (entries: object[]): string =>
      entries.map((entry) => JSON.stringify(entry)).join('\n');
    const assistant = (
      uuid: string,
      second: number,
      tool: { id: string; name: string; input: object },
    ) => ({
      type: 'assistant',
      uuid,
      timestamp: `2026-11-18T00:00:${String(second).padStart(2, '0')}.000Z`,
      message: {
        id: `msg-${uuid}`,
        usage: { input_tokens: 7, output_tokens: 1 },
        content: [{ type: 'tool_use', ...tool }],
      },
    });
    mkdirSync(join(project, 'sess-1', 'subagents'), { recursive: true });
    mkdirSync(join(project, 'sess-2', 'subagents'), { recursive: true });
    writeFileSync(
      join(project, 'sess-1.jsonl'),
      jsonl([
        assistant('main-1', 1, {
          id: 'task-1',
          name: 'Task',
          input: { description: 'build the stats page' },
        }),
      ]),
    );
    writeFileSync(
      join(project, 'sess-1', 'subagents', 'agent-x.jsonl'),
      jsonl([
        assistant('sub-1', 2, {
          id: 'w1',
          name: 'Write',
          input: {
            file_path: join(workspace, 'app', 'stats', 'page.tsx'),
            content: 'x',
          },
        }),
        {
          type: 'user',
          uuid: 'sub-1-result',
          timestamp: '2026-11-18T00:00:03.000Z',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'w1',
                is_error: true,
                content:
                  'legion-steer: 1 violation(s) would land in this file\n  app/stats/page.tsx:4  a ternary',
              },
            ],
          },
        },
      ]),
    );
    writeFileSync(
      join(project, 'sess-2', 'subagents', 'agent-x.jsonl'),
      jsonl([
        assistant('sub-2', 4, {
          id: 'b1',
          name: 'Bash',
          input: { command: 'cp /tmp/y.tsx app/y.tsx' },
        }),
      ]),
    );

    const record = collectRun({
      runDir: join(runs, 'prose-1'),
      kitDir: KIT,
      repoDir: runs,
      configDir,
      acceptance: false,
      log: quiet,
    });

    expect(record.transcriptFiles).toEqual([
      'transcripts/sess-1.jsonl',
      'transcripts/sess-1/subagents/agent-x.jsonl',
      'transcripts/sess-2/subagents/agent-x.jsonl',
    ]);
    expect(record.transcript?.hookEvents).toHaveLength(1);
    expect(record.transcript?.hookEvents[0]).toMatchObject({
      agent: 'sess-1/subagents/agent-x',
      kind: 'block',
      file: 'app/stats/page.tsx',
      outcome: 'abandoned',
    });
    expect(record.transcript?.shellWritesToSource).toEqual([
      {
        agent: 'sess-2/subagents/agent-x',
        command: 'cp /tmp/y.tsx app/y.tsx',
        targets: ['app/y.tsx'],
        afterCompaction: false,
      },
    ]);
    expect(record.transcript?.tokens.input).toBe(21);
    expect(Object.keys(record.transcript?.tokensByAgent ?? {})).toEqual([
      'main',
      'sess-1/subagents/agent-x',
      'sess-2/subagents/agent-x',
    ]);
  });
});
