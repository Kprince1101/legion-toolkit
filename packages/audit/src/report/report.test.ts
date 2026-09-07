import { findRegressions } from './baseline.js';
import { renderMarkdown } from './markdown.js';
import { computeScore } from './score.js';
import type { AuditResult } from '../types.js';

const base = (): AuditResult => ({
  schema: 1,
  generatedAt: '2026-09-07T00:00:00.000Z',
  root: '/repo',
  packageManager: 'yarn',
  score: 0,
  gates: [
    { name: 'typecheck', status: 'pass', summary: 'clean' },
    {
      name: 'lint',
      status: 'pass',
      summary: 'oxlint: 0 error(s), 0 warning(s)',
    },
    { name: 'tests', status: 'pass', summary: '10/10 passed' },
    { name: 'format', status: 'pass', summary: 'clean' },
  ],
  lint: {
    linter: 'oxlint',
    status: 'pass',
    errors: 0,
    warnings: 0,
    rules: [],
    legion: [],
    componentCap: [],
  },
  directives: { fileWide: [], all: [], nosonar: [], byRule: {} },
  prHygiene: {
    status: 'pass',
    inspected: 80,
    withPr: 80,
    ratio: 1,
    lastPrCommit: 'abc (#1)',
    forge: 'github',
  },
  testCoverage: {
    components: 4,
    hooks: 2,
    missing: [],
    source: 'filenames',
    totalPct: null,
  },
  lockfile: { status: 'pass', found: ['yarn.lock'], packageManager: 'yarn' },
  toolchain: {
    packageManager: 'yarn',
    yarnFlavor: 'berry',
    packageManagerField: 'yarn@4.18.0',
    framework: 'next',
    workspaces: false,
    hasOxlintConfig: true,
    hasEslintConfig: false,
    hasOxlintBin: true,
    hasEslintBin: false,
    hasPrettierConfig: true,
    hasTsconfig: true,
    toolkitInstalled: true,
    pluginReferenced: true,
    workspaceRoot: '/repo',
    isWorkspacePackage: false,
    reactCompiler: false,
    scripts: {},
  },
  expo: {
    name: 'expo-doctor',
    status: 'skipped',
    summary: 'not an expo project',
    patchDrift: [],
    installed: false,
  },
  workspace: { root: '/repo', workspaceRoot: '/repo', isPackage: false },
  ruleCoverage: {
    status: 'skipped',
    available: [],
    configured: [],
    unconfigured: [],
    source: 'none',
  },
  advice: [],
  suppressions: { findings: [], suppressed: 0, stale: [], total: 0 },
  dependencies: { status: 'checked', forbidden: [], inspected: 12 },
});

const withScore = (result: AuditResult): AuditResult => ({
  ...result,
  score: computeScore(result),
});

describe('computeScore', () => {
  it('gives a clean repo 100', () => {
    expect(computeScore(base())).toBe(100);
  });

  it('subtracts documented penalties', () => {
    const result = base();
    result.gates[2] = { name: 'tests', status: 'fail', summary: '1 failed' };
    result.lint.legion = [
      {
        rule: 'legion/no-enum',
        file: 'a.ts',
        line: 1,
        message: '',
        severity: 'error',
      },
      {
        rule: 'legion/no-enum',
        file: 'b.ts',
        line: 1,
        message: '',
        severity: 'error',
      },
    ];
    result.prHygiene = {
      status: 'fail',
      inspected: 80,
      withPr: 8,
      ratio: 0.1,
      lastPrCommit: null,
      forge: 'github',
    };
    result.testCoverage.missing = [
      { file: 'components/X.tsx', kind: 'component' },
    ];
    result.directives.fileWide = [
      {
        file: 'a.ts',
        line: 1,
        tool: 'eslint',
        kind: 'disable',
        scope: 'file',
        rules: [],
        description: '',
      },
    ];
    const uncovered = (1 / 6) * 15;
    expect(computeScore(result)).toBe(Math.round(100 - 20 - 4 - uncovered - 5));
  });

  it('leaves PR hygiene out of the score entirely', () => {
    const result = base();
    const clean = computeScore(result);
    result.prHygiene = {
      status: 'fail',
      inspected: 44,
      withPr: 2,
      ratio: 0.045,
      lastPrCommit: null,
      forge: 'github',
    };
    expect(computeScore(result)).toBe(clean);
  });
});

describe('findRegressions', () => {
  it('reports gate flips, new legion errors, and score drops', () => {
    const before = withScore(base());
    const after = base();
    after.gates[0] = {
      name: 'typecheck',
      status: 'fail',
      summary: '2 error(s)',
    };
    after.lint.legion = [
      {
        rule: 'legion/no-enum',
        file: 'a.ts',
        line: 1,
        message: '',
        severity: 'error',
      },
    ];
    after.lint.errors = 1;
    const regressions = findRegressions(before, withScore(after));
    expect(regressions.map((r) => r.area)).toEqual([
      'gate: typecheck',
      'legion rule errors',
      'lint errors',
      'score',
    ]);
  });

  it('is empty when nothing got worse', () => {
    expect(findRegressions(withScore(base()), withScore(base()))).toEqual([]);
  });
});

describe('renderMarkdown', () => {
  it('renders every section', () => {
    const result = withScore(base());
    result.directives.all = [
      {
        file: 'a.ts',
        line: 3,
        tool: 'eslint',
        kind: 'disable',
        scope: 'next-line',
        rules: ['no-console'],
        description: 'cli',
      },
    ];
    result.directives.byRule = { 'no-console': 1 };
    const markdown = renderMarkdown(result, []);
    for (const heading of [
      '# Legion audit',
      '## Gates',
      '## Legion rules',
      '## Lint bypasses',
      '## PR hygiene',
      '## Tests by file',
      '## Lockfile',
      '## Baseline',
      '## Score formula',
    ]) {
      expect(markdown).toContain(heading);
    }
    expect(markdown).toContain('| no-console | 1 |');
    expect(markdown).toContain('1/1 directives carry a reason');
    expect(markdown).toContain('Score: **100/100**');
  });
});
