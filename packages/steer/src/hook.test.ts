import { isLintable, parsePayload, relabel, verdictFor } from './hook.js';
import { mergeSettings, HOOK_COMMAND } from './settings.js';
import type { Finding } from 'legion-audit';

const finding = (over: Partial<Finding> = {}): Finding => ({
  rule: 'legion/presentational-components',
  file: 'src/.legion-steer-abc123/Panel.tsx',
  line: 2,
  message: 'useState inside Panel is state in a component',
  severity: 'error',
  ...over,
});

describe('isLintable', () => {
  it('covers the TypeScript extensions and nothing else', () => {
    expect(isLintable('src/A.tsx')).toBe(true);
    expect(isLintable('src/a.ts')).toBe(true);
    expect(isLintable('README.md')).toBe(false);
    expect(isLintable('src/a.js')).toBe(false);
  });
});

describe('parsePayload', () => {
  it('reads a hook payload and survives junk', () => {
    expect(parsePayload('{"hook_event_name":"PreToolUse"}')).toEqual({
      hook_event_name: 'PreToolUse',
    });
    expect(parsePayload('not json')).toEqual({});
  });
});

describe('relabel', () => {
  it('reports the file the agent tried to write, not the scratch copy', () => {
    const [first] = relabel(
      [finding()],
      '.legion-steer-abc123',
      'src/Panel.tsx',
    );
    expect(first?.file).toBe('src/Panel.tsx');
  });

  it('leaves an unrelated path alone', () => {
    const [first] = relabel(
      [finding({ file: 'src/Other.tsx' })],
      '.legion-steer-abc123',
      'src/Panel.tsx',
    );
    expect(first?.file).toBe('src/Other.tsx');
  });
});

describe('verdictFor', () => {
  it('blocks a PreToolUse write that would introduce an error', () => {
    const verdict = verdictFor('PreToolUse', [finding()]);
    expect(verdict.action).toBe('block');
    expect(verdict.findings).toHaveLength(1);
  });

  it('only reports after the fact, since the edit already happened', () => {
    expect(verdictFor('PostToolUse', [finding()]).action).toBe('report');
  });

  it('allows when nothing is at error level', () => {
    const verdict = verdictFor('PreToolUse', [
      finding({ severity: 'warning' }),
    ]);
    expect(verdict.action).toBe('allow');
  });

  it('allows a clean file', () => {
    expect(verdictFor('PreToolUse', []).action).toBe('allow');
  });
});

describe('mergeSettings', () => {
  it('adds both hooks to an empty settings file', () => {
    const { settings, added } = mergeSettings({});
    expect(added).toEqual(['PreToolUse Write', 'PostToolUse Edit|Write']);
    expect(settings.hooks?.['PreToolUse']?.[0]?.hooks?.[0]?.command).toBe(
      HOOK_COMMAND,
    );
  });

  it('keeps hooks somebody else registered', () => {
    const { settings } = mergeSettings({
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'my-guard' }],
          },
        ],
      },
    });
    const pre = settings.hooks?.['PreToolUse'] ?? [];
    expect(pre).toHaveLength(2);
    expect(pre[0]?.hooks?.[0]?.command).toBe('my-guard');
  });

  it('is idempotent, so init can run twice', () => {
    const once = mergeSettings({}).settings;
    const { added } = mergeSettings(once);
    expect(added).toEqual([]);
  });

  it('preserves unrelated settings keys', () => {
    const { settings } = mergeSettings({ model: 'opus', hooks: {} });
    expect(settings['model']).toBe('opus');
  });
});
