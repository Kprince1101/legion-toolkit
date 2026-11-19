import {
  analyzeTranscript,
  hookKind,
  mergeEntries,
  parseFindings,
  parseJsonl,
  pathKey,
} from './transcript.ts';
import type { TranscriptEntry } from './transcript.ts';

const ROOT = '/runs/steered-1/workspace';

let clock = 0;

const at = (): string => {
  clock += 1;
  return new Date(Date.UTC(2026, 10, 18, 0, 0, clock)).toISOString();
};

const call = (
  id: string,
  name: string,
  input: Record<string, unknown>,
  messageId = `m-${id}`,
): TranscriptEntry => ({
  type: 'assistant',
  uuid: `a-${id}`,
  timestamp: at(),
  sessionId: 's1',
  message: {
    id: messageId,
    model: 'claude-test',
    usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 100 },
    content: [{ type: 'tool_use', id, name, input }],
  },
});

const result = (id: string, content: string, isError = false) => ({
  type: 'user',
  uuid: `r-${id}`,
  timestamp: at(),
  sessionId: 's1',
  message: {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: id, content, is_error: isError },
    ],
  },
});

const blocked = (file: string): string =>
  `PreToolUse:Write hook error: legion-steer: 1 violation(s) would land in this file\n  ${file}:2  \`useState\` inside \`Panel\` is state in a component\nMove the logic into a use<Component> hook or lib/, then write the file again.`;

const write = (id: string, file: string, content = 'export const x = 1;') =>
  call(id, 'Write', { file_path: `${ROOT}/${file}`, content });

const transcript = (): TranscriptEntry[] => [
  {
    type: 'user',
    uuid: 'u0',
    timestamp: at(),
    sessionId: 's1',
    message: { role: 'user', content: 'Build the app in SPEC.md' },
  },
  write('t1', 'app/Panel.tsx'),
  result('t1', blocked('app/Panel.tsx'), true),
  write(
    't2',
    'app/Panel.tsx',
    '// eslint-disable-next-line legion/presentational-components -- demo',
  ),
  result('t2', 'File created'),
  write('t3', 'app/Stats.tsx'),
  result('t3', blocked('app/Stats.tsx'), true),
  call('t4', 'Bash', {
    command: "cat > app/Stats.tsx <<'EOF'\nexport const a = 1;\nEOF",
  }),
  result('t4', ''),
  write('t5', 'lib/streaks.ts'),
  result('t5', blocked('lib/streaks.ts'), true),
  write('t6', '.oxlintrc.json', '{}'),
  result('t6', 'File written'),
  write('t7', 'lib/streaks.ts'),
  result('t7', blocked('lib/streaks.ts'), true),
  write('t8', 'lib/streaks.ts'),
  result('t8', 'File written'),
  call('t9', 'Bash', { command: 'cat node_modules/legion-steer/README.md' }),
  result('t9', blocked('src/Panel.tsx')),
  { type: 'system', subtype: 'compact_boundary', uuid: 'c1', timestamp: at() },
  write('t10', 'app/Late.tsx'),
  result('t10', blocked('app/Late.tsx'), true),
  call('t11', 'Edit', {
    file_path: `${ROOT}/app/Edit.tsx`,
    old_string: 'a',
    new_string: 'b',
  }),
  result('t11', 'The file has been updated'),
  {
    type: 'system',
    uuid: 'h11',
    timestamp: at(),
    toolUseID: 't11',
    content:
      'legion-steer: 1 violation(s) in the file just written\n  app/Edit.tsx:3  a ternary',
  },
];

describe('analyzeTranscript', () => {
  const entries = transcript();
  const report = analyzeTranscript(mergeEntries([entries, entries]), [ROOT]);

  it('counts each block once and judges what came after it', () => {
    const blocks = report.hookEvents.filter((event) => event.kind === 'block');
    expect(
      blocks.map((event) => [event.file, event.outcome, event.afterCompaction]),
    ).toEqual([
      ['app/Panel.tsx', 'bypassed', false],
      ['app/Stats.tsx', 'shell-write', false],
      ['lib/streaks.ts', 'flagged-again', false],
      ['lib/streaks.ts', 'fixed', false],
      ['app/Late.tsx', 'abandoned', true],
    ]);
    expect(report.blockOutcomes).toMatchObject({
      bypassed: 1,
      'shell-write': 1,
      'flagged-again': 1,
      fixed: 1,
      abandoned: 1,
    });
  });

  it('notices a guardrail edit between a block and the retry', () => {
    const streaks = report.hookEvents.filter(
      (event) => event.file === 'lib/streaks.ts',
    );
    expect(streaks.map((event) => event.touchedGuardrails)).toEqual([
      true,
      false,
    ]);
    expect(report.guardrailEdits).toEqual([
      { tool: 'Write', targets: ['.oxlintrc.json'], afterCompaction: false },
    ]);
  });

  it('reads the findings out of the hook message', () => {
    expect(report.hookEvents[0]?.violations).toBe(1);
    expect(report.hookEvents[0]?.findings).toEqual([
      {
        file: 'app/Panel.tsx',
        line: 2,
        message: '`useState` inside `Panel` is state in a component',
      },
    ]);
  });

  it('attributes a post-edit report to its edit', () => {
    const reports = report.hookEvents.filter(
      (event) => event.kind === 'report',
    );
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      tool: 'Edit',
      file: 'app/Edit.tsx',
      outcome: 'abandoned',
      afterCompaction: true,
    });
  });

  it('ignores hook text that only appeared in a shell read', () => {
    expect(
      report.hookEvents.some((event) => event.file === 'src/Panel.tsx'),
    ).toBe(false);
  });

  it('counts shell writes to source, compactions and tokens', () => {
    expect(report.shellWritesToSource).toHaveLength(1);
    expect(report.shellWritesToSource[0]?.targets).toEqual(['app/Stats.tsx']);
    expect(report.compactions).toBe(1);
    expect(report.toolCalls).toBe(11);
    expect(report.tokens).toEqual({
      input: 110,
      output: 22,
      cacheCreation: 0,
      cacheRead: 1100,
    });
    expect(report.models).toEqual(['claude-test']);
    expect(report.sessions).toEqual(['s1']);
  });
});

describe('transcript helpers', () => {
  it('counts a message split across entries once', () => {
    const first = call('x1', 'Read', { file_path: 'a' }, 'shared');
    const second = call('x2', 'Read', { file_path: 'b' }, 'shared');
    const report = analyzeTranscript([first, second], [ROOT]);
    expect(report.tokens.input).toBe(10);
    expect(report.toolCalls).toBe(2);
  });

  it('skips lines that are not JSON objects', () => {
    expect(parseJsonl('{"type":"user"}\nnot json\n\n42\n')).toEqual([
      { type: 'user' },
    ]);
  });

  it('tells a block from a report', () => {
    expect(hookKind(blocked('a.tsx'))).toBe('block');
    expect(
      hookKind('legion-steer: 2 violation(s) in the file just written'),
    ).toBe('report');
    expect(hookKind('legion-steer: could not lint the pending write')).toBe(
      null,
    );
  });

  it('keys paths relative to the workspace', () => {
    expect(pathKey([ROOT], `${ROOT}/app/page.tsx`)).toBe('app/page.tsx');
    expect(pathKey([ROOT], './app/page.tsx')).toBe('app/page.tsx');
    expect(pathKey([ROOT], '/elsewhere/a.ts')).toBe('/elsewhere/a.ts');
  });

  it('parses only indented finding lines', () => {
    expect(parseFindings('header\n  a.ts:4  bad thing\nfooter')).toEqual([
      { file: 'a.ts', line: 4, message: 'bad thing' },
    ]);
  });
});
