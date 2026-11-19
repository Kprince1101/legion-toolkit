import {
  BYPASS_PENDING,
  BYPASS_WRITTEN,
  HOOK_PREFIX,
  violationsCommandWrote,
  violationsPending,
  violationsWritten,
} from '../../../packages/steer/src/reasons.ts';
import {
  agentOf,
  analyzeTranscript,
  hookKind,
  hookMatch,
  mergeEntries,
  parseFindings,
  parseJsonl,
  pathKey,
  tagEntries,
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
      ['app/Stats.tsx', 'shell-write-unflagged', false],
      ['lib/streaks.ts', 'flagged-again', false],
      ['lib/streaks.ts', 'fixed', false],
      ['app/Late.tsx', 'abandoned', true],
    ]);
    expect(report.blockOutcomes).toMatchObject({
      bypassed: 1,
      'shell-write-unflagged': 1,
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
      {
        agent: 'main',
        tool: 'Write',
        targets: ['.oxlintrc.json'],
        afterCompaction: false,
      },
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
    expect(report.shellWritesToSource[0]).toMatchObject({
      targets: ['app/Stats.tsx'],
      flagged: false,
    });
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

describe('subagents', () => {
  const main = tagEntries(
    [
      {
        type: 'user',
        uuid: 'm0',
        timestamp: at(),
        message: { content: 'Build it' },
      },
      call('p1', 'Task', { description: 'build stats' }),
      {
        type: 'system',
        subtype: 'compact_boundary',
        uuid: 'mc',
        timestamp: at(),
      },
    ],
    'main',
  );
  const agent = 's1/subagents/agent-x';
  const sub = tagEntries(
    [
      write('q1', 'app/stats/page.tsx'),
      result('q1', blocked('app/stats/page.tsx'), true),
      {
        type: 'system',
        subtype: 'compact_boundary',
        uuid: 'sc',
        timestamp: at(),
      },
      call('q2', 'Bash', {
        command: "cat > app/stats/page.tsx <<'EOF'\nx\nEOF",
      }),
      result('q2', ''),
    ],
    agent,
  );
  const report = analyzeTranscript(mergeEntries([main, sub]), [ROOT]);

  it('tags a block inside a subagent with that agent', () => {
    expect(report.hookEvents).toHaveLength(1);
    expect(report.hookEvents[0]).toMatchObject({
      agent,
      file: 'app/stats/page.tsx',
      outcome: 'shell-write-unflagged',
    });
    expect(report.shellWritesToSource[0]?.agent).toBe(agent);
    expect(report.agents).toEqual(['main', agent]);
  });

  it('splits tokens by agent and counts only main-session compactions', () => {
    expect(report.tokensByAgent['main']?.input).toBe(10);
    expect(report.tokensByAgent[agent]?.input).toBe(20);
    expect(report.tokens.input).toBe(30);
    expect(report.compactions).toBe(1);
  });

  it('names an agent after its transcript path', () => {
    expect(agentOf('abc.jsonl')).toBe('main');
    expect(agentOf('abc/subagents/agent-x.jsonl')).toBe(
      'abc/subagents/agent-x',
    );
  });
});

describe('the hook on main', () => {
  const postBash = (count: number, lines: string[]): string =>
    [
      'PostToolUse:Bash hook blocking error from command: "npx legion-steer hook":',
      `${HOOK_PREFIX}${violationsCommandWrote(count)}`,
      ...lines,
      'The write already landed. Fix these before moving on.',
    ].join('\n');

  const bypassBlock = (file: string): string =>
    [
      `${HOOK_PREFIX}${BYPASS_PENDING}`,
      `  ${file}:1  line 1: eslint-disable (every rule) hides rules from the linter for the whole file`,
      'Fix the code rather than bypassing the rule, then write the file again.',
    ].join('\n');

  const entries = (): TranscriptEntry[] => [
    call('c1', 'Bash', { command: 'node scripts/generate.js' }),
    result(
      'c1',
      postBash(3, [
        '  app/gen/Card.tsx:3  a ternary',
        '  app/gen/Card.tsx:9  a narrative comment',
        '  lib/gen.ts:1  the function keyword',
      ]),
      true,
    ),
    write('c2', 'app/gen/Card.tsx'),
    result('c2', 'File written'),
    call('c3', 'Bash', { command: "sed -i '' 's/x/y/' lib/gen.ts" }),
    result('c3', ''),
    write('c4', 'app/Hidden.tsx', '/* eslint-disable */\nexport const a = 1;'),
    result('c4', bypassBlock('app/Hidden.tsx'), true),
    call('c5', 'Edit', {
      file_path: `${ROOT}/app/Hidden.tsx`,
      old_string: '/* eslint-disable */',
      new_string: '',
    }),
    result('c5', 'The file has been updated'),
    {
      type: 'system',
      uuid: 'h-bypass-written',
      timestamp: at(),
      toolUseID: 'c6',
      content: `${HOOK_PREFIX}${BYPASS_WRITTEN}\n  lib/x.ts:1  line 1: eslint-disable`,
    },
    call('c7', 'Bash', { command: 'cat > lib/clean.ts <<EOF\nx\nEOF' }),
    result('c7', ''),
  ];
  const report = analyzeTranscript(mergeEntries([entries()]), [ROOT]);

  it('records a Bash post-hook report with the files from its findings', () => {
    const bash = report.hookEvents.find((event) => event.tool === 'Bash');
    expect(bash).toMatchObject({
      kind: 'report',
      cause: 'lint',
      violations: 3,
      file: 'app/gen/Card.tsx',
      files: ['app/gen/Card.tsx', 'lib/gen.ts'],
      outcome: 'fixed',
    });
    expect(report.reportOutcomes.fixed).toBeGreaterThanOrEqual(1);
  });

  it('records a bypass block and calls an Edit retry that passes fixed', () => {
    const bypass = report.hookEvents.find(
      (event) => event.file === 'app/Hidden.tsx',
    );
    expect(bypass).toMatchObject({
      kind: 'block',
      cause: 'bypass',
      tool: 'Write',
      violations: 1,
      outcome: 'fixed',
    });
  });

  it('records a written-bypass report attached by tool id', () => {
    expect(
      report.hookEvents.filter(
        (event) => event.kind === 'report' && event.cause === 'bypass',
      ),
    ).toHaveLength(1);
  });

  it('marks which shell writes the hook flagged', () => {
    expect(
      report.shellWritesToSource.map((write) => [write.targets, write.flagged]),
    ).toEqual([
      [['lib/gen.ts'], false],
      [['lib/clean.ts'], false],
    ]);
  });

  it('matches every reason the hook can give', () => {
    expect(hookMatch(`${HOOK_PREFIX}${violationsPending(2)}`)).toEqual({
      kind: 'block',
      cause: 'lint',
      scope: 'file',
      count: 2,
    });
    expect(hookMatch(`${HOOK_PREFIX}${violationsWritten(1)}`)?.kind).toBe(
      'report',
    );
    expect(hookMatch(`${HOOK_PREFIX}${violationsCommandWrote(4)}`)).toEqual({
      kind: 'report',
      cause: 'lint',
      scope: 'command',
      count: 4,
    });
    expect(hookMatch(`${HOOK_PREFIX}${BYPASS_PENDING}`)?.cause).toBe('bypass');
    expect(hookMatch(`${HOOK_PREFIX}${BYPASS_WRITTEN}`)?.kind).toBe('report');
    expect(
      hookMatch(`${HOOK_PREFIX}app/a.ts gains a lint bypass at line 3`),
    ).toBeNull();
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
