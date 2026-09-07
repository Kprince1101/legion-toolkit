import {
  isLintable,
  missingAncestors,
  parsePayload,
  relabel,
  resolveIn,
  verdictFor,
} from './hook.js';
import { parseSteerArgs } from './cli-args.js';
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

const linted = (findings: Finding[]) => ({
  linted: true,
  findings,
  reason: 'linted',
});

describe('verdictFor', () => {
  it('blocks a PreToolUse write that would introduce an error', () => {
    const verdict = verdictFor('PreToolUse', linted([finding()]));
    expect(verdict.action).toBe('block');
    expect(verdict.findings).toHaveLength(1);
  });

  it('only reports after the fact, since the edit already happened', () => {
    expect(verdictFor('PostToolUse', linted([finding()])).action).toBe(
      'report',
    );
  });

  it('allows when nothing is at error level', () => {
    const verdict = verdictFor(
      'PreToolUse',
      linted([finding({ severity: 'warning' })]),
    );
    expect(verdict.action).toBe('allow');
  });

  it('allows a clean file', () => {
    expect(verdictFor('PreToolUse', linted([])).action).toBe('allow');
  });

  it('allows when the check could not run, and says it did not run', () => {
    const verdict = verdictFor('PreToolUse', {
      linted: false,
      findings: [],
      reason: 'could not lint the pending write: ENOENT',
    });
    expect(verdict.action).toBe('allow');
    expect(verdict.linted).toBe(false);
    expect(verdict.reason).toContain('could not lint');
  });
});

describe('resolveIn', () => {
  it('resolves a relative write against the repo root, not the cwd', () => {
    expect(resolveIn('/repo', 'src/A.tsx')).toBe('/repo/src/A.tsx');
    expect(resolveIn('/repo', '/elsewhere/A.tsx')).toBe('/elsewhere/A.tsx');
  });
});

describe('missingAncestors', () => {
  it('reports nothing for a directory that exists', () => {
    expect(missingAncestors(process.cwd())).toEqual([]);
  });

  it('lists the chain to create, outermost first, so it can be undone', () => {
    const missing = missingAncestors(`${process.cwd()}/a-b-c/d-e-f`);
    expect(missing).toEqual([
      `${process.cwd()}/a-b-c`,
      `${process.cwd()}/a-b-c/d-e-f`,
    ]);
  });
});

describe('parseSteerArgs', () => {
  it('parses --no-hooks, which HELP advertises', () => {
    expect(parseSteerArgs(['init', '--no-hooks']).hooks).toBe(false);
    expect(parseSteerArgs(['init']).hooks).toBe(true);
  });

  it('still rejects a flag it does not know', () => {
    expect(() => parseSteerArgs(['init', '--nope'])).toThrow(
      'unknown argument',
    );
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
