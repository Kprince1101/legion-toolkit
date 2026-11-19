import { allow } from './hook.js';
import { failureResponse, hookResponse, respond } from './respond.js';
import { parsePorcelain } from './changes.js';
import { markerKey, takeMarker, writeMarker } from './markers.js';

const blocked = {
  action: 'block' as const,
  findings: [
    {
      rule: 'legion/no-enum',
      file: 'src/a.ts',
      line: 1,
      message: 'no enum',
      severity: 'error' as const,
    },
  ],
  reason: '1 violation(s) would land in this file',
  linted: true,
  notices: [],
};

describe('respond', () => {
  it('stays silent when the write is clean and nothing stepped aside', () => {
    expect(
      respond('PreToolUse', allow('no blocking findings', [], true)),
    ).toEqual({ exitCode: 0, stdout: '', stderr: '' });
  });

  it('exits 2 with the findings when it blocks', () => {
    const response = respond('PreToolUse', blocked);
    expect(response.exitCode).toBe(2);
    expect(response.stderr).toContain('src/a.ts:1  no enum');
  });

  it('says so out loud when it steps aside before a write', () => {
    const response = respond(
      'PreToolUse',
      allow('oxlint is not installed', ['oxlint is not installed, so x']),
    );
    expect(response.exitCode).toBe(0);
    expect(JSON.parse(response.stdout)).toEqual({
      systemMessage: 'legion-steer: oxlint is not installed, so x',
    });
    expect(response.stderr).toContain('oxlint is not installed');
  });

  it('also tells the agent when it steps aside after a write', () => {
    const response = respond('PostToolUse', allow('x', ['not checked']));
    const output = JSON.parse(response.stdout) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    expect(output.hookSpecificOutput?.additionalContext).toContain(
      'not checked',
    );
  });

  it('announces a crash in the hook instead of failing quietly', () => {
    const response = failureResponse('PreToolUse', 'boom');
    expect(response.exitCode).toBe(0);
    expect(response.stdout).toContain('legion-steer failed (boom)');
  });
});

describe('hookResponse', () => {
  it('handles a junk payload by saying it checked nothing', () => {
    const response = hookResponse(process.cwd(), 'not json');
    expect(response.exitCode).toBe(0);
    expect(response.stdout).toContain('nothing was checked');
  });
});

describe('parsePorcelain', () => {
  it('reads modified, untracked and renamed paths', () => {
    const raw = [
      ' M src/a.ts',
      '?? src/new.ts',
      'R  src/moved.ts',
      'src/old.ts',
      'A  src/added.ts',
      '',
    ].join('\0');
    expect(parsePorcelain(raw)).toEqual([
      'src/a.ts',
      'src/new.ts',
      'src/moved.ts',
      'src/added.ts',
    ]);
  });
});

describe('markers', () => {
  it('hands a marker from the pre hook to the post hook exactly once', () => {
    const source = { tool_use_id: `toolu_marker_${process.pid}` };
    expect(
      writeMarker(source, { status: 'checked', at: 1, original: '' }),
    ).toBe(true);
    expect(takeMarker(source)?.status).toBe('checked');
    expect(takeMarker(source)).toBeNull();
  });

  it('keys on the tool input when there is no tool_use_id', () => {
    const first = markerKey({
      session_id: 's',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    });
    const same = markerKey({
      session_id: 's',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    });
    const other = markerKey({
      session_id: 's',
      tool_name: 'Bash',
      tool_input: { command: 'pwd' },
    });
    expect(first).toBe(same);
    expect(first).not.toBe(other);
  });

  it('keeps an id from escaping the state directory', () => {
    expect(markerKey({ tool_use_id: '../../etc/passwd' })).not.toContain('/');
  });
});
