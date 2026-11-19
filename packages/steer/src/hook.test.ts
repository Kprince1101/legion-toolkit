import { isLintConfig, isLintable, parsePayload, verdictFor } from './hook.js';
import { missingAncestors, readReport, relabel, resolveIn } from './lint.js';
import { parseSteerArgs } from './cli-args.js';
import { mergeSettings, HOOK_COMMAND, WANTED } from './settings.js';
import type { ExecResult, Finding } from 'legion-audit';

const finding = (over: Partial<Finding> = {}): Finding => ({
  rule: 'legion/presentational-components',
  file: 'src/.legion-steer-abc123/Panel.tsx',
  line: 2,
  message: 'useState inside Panel is state in a component',
  severity: 'error',
  ...over,
});

describe('isLintable', () => {
  it('covers the TypeScript and JavaScript extensions oxlint lints', () => {
    for (const file of [
      'src/A.tsx',
      'src/a.ts',
      'src/a.mts',
      'src/a.cts',
      'src/a.js',
      'src/A.jsx',
      'eslint.config.mjs',
      'babel.config.cjs',
    ]) {
      expect(isLintable(file)).toBe(true);
    }
  });

  it('leaves files the linter never reads alone', () => {
    expect(isLintable('README.md')).toBe(false);
    expect(isLintable('.oxlintrc.json')).toBe(false);
    expect(isLintable('notebook.ipynb')).toBe(false);
  });
});

describe('isLintConfig', () => {
  it('recognises the oxlint and eslint config files', () => {
    expect(isLintConfig('/repo/.oxlintrc.json')).toBe(true);
    expect(isLintConfig('/repo/eslint.config.mjs')).toBe(true);
    expect(isLintConfig('/repo/.eslintrc.json')).toBe(true);
    expect(isLintConfig('/repo/src/config.ts')).toBe(false);
  });
});

const exec = (stdout: string, stderr = ''): ExecResult => ({
  code: 0,
  stdout,
  stderr,
  command: 'oxlint',
});

describe('readReport', () => {
  it('reads diagnostics out of a normal report', () => {
    const outcome = readReport(
      exec(
        JSON.stringify({
          diagnostics: [
            {
              code: 'legion(no-enum)',
              filename: 'a.ts',
              severity: 'error',
              message: 'no enum',
              labels: [{ span: { line: 1 } }],
            },
          ],
          number_of_files: 1,
        }),
      ),
    );
    expect(outcome.linted).toBe(true);
    expect(outcome.findings[0]?.rule).toBe('legion/no-enum');
  });

  it('says the check did not run when oxlint printed no report', () => {
    const outcome = readReport(
      exec('', 'Failed to parse configuration file .oxlintrc.json'),
    );
    expect(outcome.linted).toBe(false);
    expect(outcome.reason).toContain('Failed to parse configuration file');
  });

  it('says the check did not run when the report is not JSON', () => {
    expect(readReport(exec('{ not json')).linted).toBe(false);
    expect(readReport(exec('{"nope": true}')).linted).toBe(false);
  });

  it('says so when the config ignores the file instead of calling it clean', () => {
    const outcome = readReport(
      exec(JSON.stringify({ diagnostics: [], number_of_files: 0 })),
    );
    expect(outcome.linted).toBe(false);
    expect(outcome.reason).toContain('ignores this path');
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
    expect(verdict.notices).toEqual([
      'could not lint the pending write: ENOENT, so this write was not checked',
    ]);
  });

  it('announces when oxlint is missing rather than passing quietly', () => {
    const verdict = verdictFor('PreToolUse', {
      linted: false,
      findings: [],
      reason: 'oxlint is not installed',
    });
    expect(verdict.notices[0]).toContain('oxlint is not installed');
  });

  it('blocks only what the write introduces, and says what it left', () => {
    const existing = finding({ message: 'enum Color is not allowed' });
    const added = finding({ rule: 'no-ternary', message: 'no ternary' });
    const verdict = verdictFor('PreToolUse', linted([existing, added]), [
      existing,
    ]);
    expect(verdict.action).toBe('block');
    expect(verdict.findings).toEqual([added]);
    expect(verdict.notices[0]).toContain('1 violation(s) already in this file');
  });

  it('allows an edit to a file whose only errors were already there', () => {
    const existing = finding();
    const verdict = verdictFor('PreToolUse', linted([existing]), [existing]);
    expect(verdict.action).toBe('allow');
    expect(verdict.notices).toHaveLength(1);
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
    expect(added).toEqual([
      'PreToolUse Write|Edit|MultiEdit|NotebookEdit|Bash',
      'PostToolUse Write|Edit|MultiEdit|Bash',
    ]);
    expect(settings.hooks?.['PreToolUse']?.[0]?.hooks?.[0]?.command).toBe(
      HOOK_COMMAND,
    );
  });

  it('checks every write tool before it runs', () => {
    const pre = WANTED.find(([event]) => event === 'PreToolUse')?.[1] ?? '';
    expect(pre.split('|').sort()).toEqual([
      'Bash',
      'Edit',
      'MultiEdit',
      'NotebookEdit',
      'Write',
    ]);
  });

  it('replaces the matchers an older init registered', () => {
    const { settings, added, removed } = mergeSettings({
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write',
            hooks: [{ type: 'command', command: HOOK_COMMAND }],
          },
        ],
        PostToolUse: [
          {
            matcher: 'Edit|Write',
            hooks: [
              { type: 'command', command: HOOK_COMMAND },
              { type: 'command', command: 'my-formatter' },
            ],
          },
        ],
      },
    });
    expect(removed).toEqual(['PreToolUse Write', 'PostToolUse Edit|Write']);
    expect(added).toHaveLength(2);
    expect(settings.hooks?.['PreToolUse']).toHaveLength(1);
    const post = settings.hooks?.['PostToolUse'] ?? [];
    expect(post[0]?.hooks).toEqual([
      { type: 'command', command: 'my-formatter' },
    ]);
    expect(post).toHaveLength(2);
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
    const { added, removed } = mergeSettings(once);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it('preserves unrelated settings keys', () => {
    const { settings } = mergeSettings({ model: 'opus', hooks: {} });
    expect(settings['model']).toBe('opus');
  });
});
