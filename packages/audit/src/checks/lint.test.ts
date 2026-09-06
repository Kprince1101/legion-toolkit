import {
  countByRule,
  parseEslintJson,
  parseOxlintJson,
  summarizeFindings,
} from './lint.js';

const OXLINT_OUTPUT = JSON.stringify({
  diagnostics: [
    {
      message: 'enum is not allowed',
      code: 'legion(no-enum)',
      severity: 'error',
      filename: 'types.ts',
      labels: [{ span: { offset: 0, length: 4, line: 4, column: 1 } }],
    },
    {
      message: 'too many lines',
      code: 'eslint(max-lines)',
      severity: 'error',
      filename: 'components/Big.tsx',
      labels: [{ span: { offset: 0, length: 0, line: 181, column: 1 } }],
    },
    {
      message: 'unused',
      code: 'typescript(no-unused-vars)',
      severity: 'warning',
      filename: 'lib/x.ts',
      labels: [{ span: { offset: 0, length: 0, line: 2, column: 1 } }],
    },
  ],
  number_of_files: 3,
});

const ESLINT_OUTPUT = JSON.stringify([
  {
    filePath: '/repo/app/page.tsx',
    messages: [
      {
        ruleId: 'legion/no-use-client-in-page',
        severity: 2,
        line: 1,
        message: 'nope',
      },
      { ruleId: 'max-lines', severity: 2, line: 200, message: 'big' },
      {
        ruleId: null,
        severity: 1,
        line: 3,
        message: 'Unused eslint-disable directive',
      },
    ],
  },
]);

describe('parseOxlintJson', () => {
  it('normalizes rule ids and locations', () => {
    const findings = parseOxlintJson(`some progress line\n${OXLINT_OUTPUT}`);
    expect(findings.map((f) => [f.rule, f.file, f.line, f.severity])).toEqual([
      ['legion/no-enum', 'types.ts', 4, 'error'],
      ['max-lines', 'components/Big.tsx', 181, 'error'],
      ['typescript/no-unused-vars', 'lib/x.ts', 2, 'warning'],
    ]);
  });
});

describe('parseEslintJson', () => {
  it('strips the root and keeps rule ids', () => {
    const findings = parseEslintJson(ESLINT_OUTPUT, '/repo');
    expect(findings.map((f) => [f.rule, f.file, f.line, f.severity])).toEqual([
      ['legion/no-use-client-in-page', 'app/page.tsx', 1, 'error'],
      ['max-lines', 'app/page.tsx', 200, 'error'],
      ['parse-error', 'app/page.tsx', 3, 'warning'],
    ]);
  });
});

describe('summarizeFindings', () => {
  it('splits legion findings and component cap hits', () => {
    const summary = summarizeFindings(
      'oxlint',
      parseOxlintJson(OXLINT_OUTPUT),
      1,
    );
    expect(summary.status).toBe('fail');
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(1);
    expect(summary.legion.map((f) => f.rule)).toEqual(['legion/no-enum']);
    expect(summary.componentCap.map((f) => f.file)).toEqual([
      'components/Big.tsx',
    ]);
    expect(countByRule(summary.legion)).toEqual([
      { rule: 'legion/no-enum', errors: 1, warnings: 0 },
    ]);
  });

  it('passes on a clean run', () => {
    expect(summarizeFindings('eslint', [], 0).status).toBe('pass');
  });
});
