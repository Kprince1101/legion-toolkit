import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkpointAfter, errorsByFile, errorsIn } from './lintstate.ts';
import type { AuditSummary } from './reports.ts';
import { clearScoring, prepareScoring, withDirectivesFrom } from './score.ts';
import { stripDirectives } from './strip.ts';

const BAD = [
  '/* eslint-disable */',
  'export const Bad = (value: any) => {',
  '  var copy = value;',
  '  debugger;',
  '  if (copy == 1) return 1;',
  '  return 0;',
  '};',
  '',
].join('\n');

describe('stripDirectives', () => {
  it("removes bosun's file-wide disable and keeps every line in place", () => {
    const stripped = stripDirectives(BAD);
    expect(stripped).not.toContain('eslint-disable');
    expect(stripped.split('\n')).toHaveLength(BAD.split('\n').length);
    expect(stripped.split('\n')[2]).toBe('  var copy = value;');
  });

  it('removes line, next-line, block and JSX directives of both linters', () => {
    const source = [
      'const a = 1; // eslint-disable-line no-unused-vars',
      '// oxlint-disable-next-line no-ternary -- demo',
      'const b = a ? 1 : 2;',
      '/* eslint-disable no-console,',
      '   no-debugger */',
      'const c = <div>{/* eslint-disable-next-line */}</div>;',
      '/* oxlint-enable */',
    ].join('\n');
    const stripped = stripDirectives(source);
    expect(stripped).not.toMatch(/(?:eslint|oxlint)-(?:disable|enable)/);
    expect(stripped.split('\n')).toHaveLength(7);
    expect(stripped).toContain('const c = <div>{}</div>;');
  });

  it('leaves directive text inside strings alone', () => {
    const source = "const hint = '// eslint-disable-next-line';\n";
    expect(stripDirectives(source)).toBe(source);
  });
});

describe('prepareScoring', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'three-arm-strip-'));
    mkdirSync(join(root, 'workspace', 'app'), { recursive: true });
    writeFileSync(join(root, 'workspace', 'app', 'Bad.tsx'), BAD);
    writeFileSync(join(root, 'reference.json'), '{}');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const paths = () => ({
    workspace: join(root, 'workspace'),
    scoringDir: join(root, 'scoring'),
    repoDir: root,
    referenceConfig: join(root, 'reference.json'),
  });

  it('lints the scoring copy without the agent bypasses', () => {
    expect(prepareScoring(paths(), true)).toEqual({
      stripped: ['app/Bad.tsx'],
      removedConfigs: [],
    });
    const scored = readFileSync(
      join(root, 'scoring', 'app', 'Bad.tsx'),
      'utf8',
    );
    expect(scored).not.toContain('eslint-disable');
    expect(scored).toContain('debugger;');
    expect(
      readFileSync(join(root, 'workspace', 'app', 'Bad.tsx'), 'utf8'),
    ).toBe(BAD);
    expect(existsSync(join(root, 'scoring', '.oxlintrc.json'))).toBe(true);
    clearScoring(join(root, 'scoring'));
    expect(existsSync(join(root, 'scoring'))).toBe(false);
  });

  it('keeps the bypasses for the as-written pass', () => {
    expect(prepareScoring(paths(), false).stripped).toEqual([]);
    expect(
      readFileSync(join(root, 'scoring', 'app', 'Bad.tsx'), 'utf8'),
    ).toContain('/* eslint-disable */');
    clearScoring(join(root, 'scoring'));
  });

  it('replaces every lint config the agent wrote with the reference', () => {
    const configs = [
      '.oxlintrc.json',
      'app/.oxlintrc.json',
      'app/stats/.oxlintrc.jsonc',
      'oxlint.config.ts',
      'lib/oxlint.config.mjs',
      'eslint.config.js',
      'app/.eslintrc.json',
      '.eslintrc',
    ];
    for (const config of configs) {
      mkdirSync(join(root, 'workspace', config, '..'), { recursive: true });
      writeFileSync(
        join(root, 'workspace', config),
        '{"ignorePatterns":["**/*"]}',
      );
    }
    const copy = prepareScoring(paths(), true);
    expect([...copy.removedConfigs].sort()).toEqual([...configs].sort());
    for (const config of configs.slice(1)) {
      expect(existsSync(join(root, 'scoring', config))).toBe(false);
      expect(existsSync(join(root, 'workspace', config))).toBe(true);
    }
    expect(readFileSync(join(root, 'scoring', '.oxlintrc.json'), 'utf8')).toBe(
      '{}',
    );
    clearScoring(join(root, 'scoring'));
  });
});

describe('scores', () => {
  const summary = (lintErrors: number, directives: number): AuditSummary => ({
    score: 50,
    lintStatus: 'fail',
    lintErrors,
    lintWarnings: 0,
    legionFindings: 0,
    componentCap: 0,
    topRules: [],
    directives,
    fileWideDirectives: directives,
    directivesByRule: { '(all rules)': directives },
    untested: 0,
    lintErrorsAsWritten: null,
  });

  it('takes lint from the stripped pass and directives as written', () => {
    expect(withDirectivesFrom(summary(5, 0), summary(1, 1))).toMatchObject({
      lintErrors: 5,
      lintErrorsAsWritten: 1,
      directives: 1,
      fileWideDirectives: 1,
      directivesByRule: { '(all rules)': 1 },
    });
  });
});

describe('lint state', () => {
  it('counts errors per file and skips warnings', () => {
    const json = JSON.stringify({
      diagnostics: [
        { severity: 'error', filename: 'app/Bad.tsx' },
        { severity: 'error', filename: '/scoring/app/Bad.tsx' },
        { severity: 'warning', filename: 'app/Bad.tsx' },
        { severity: 'error', filename: './lib/x.ts' },
      ],
    });
    expect(errorsByFile(json, '/scoring')).toEqual({
      'app/Bad.tsx': 2,
      'lib/x.ts': 1,
    });
  });

  it('picks the first checkpoint after an event, else the last', () => {
    const checkpoints = [
      { at: '2026-11-18T03:00:00.000Z', errors: { a: 1 } },
      { at: '2026-11-18T01:00:00.000Z', errors: { a: 2 } },
    ];
    expect(
      checkpointAfter(checkpoints, '2026-11-18T00:30:00.000Z')?.errors,
    ).toEqual({ a: 2 });
    expect(
      checkpointAfter(checkpoints, '2026-11-18T02:00:00.000Z')?.errors,
    ).toEqual({ a: 1 });
    expect(
      checkpointAfter(checkpoints, '2026-11-19T00:00:00.000Z')?.errors,
    ).toEqual({ a: 1 });
    expect(checkpointAfter([], null)).toBeNull();
    expect(errorsIn({ at: '', errors: { a: 2, b: 1 } }, ['a', 'c'])).toBe(2);
  });
});
