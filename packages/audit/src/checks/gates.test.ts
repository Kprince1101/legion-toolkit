import { countTypeErrors, summarizeTestOutput } from './gates.js';

describe('summarizeTestOutput', () => {
  it('reads a Jest summary', () => {
    const output =
      'Test Suites: 2 failed, 40 passed, 42 total\nTests:       3 failed, 1 skipped, 600 passed, 604 total\n';
    expect(summarizeTestOutput(output)).toBe(
      '3 failed, 600/604 passed, 42 suite(s)',
    );
  });

  it('reads a passing Jest summary', () => {
    const output =
      'Test Suites: 11 passed, 11 total\nTests:       107 passed, 107 total\n';
    expect(summarizeTestOutput(output)).toBe('107/107 passed, 11 suite(s)');
  });

  it('reads a Vitest summary', () => {
    expect(summarizeTestOutput('      Tests  2 failed | 40 passed (42)')).toBe(
      '2 failed, 40/42 passed',
    );
    expect(summarizeTestOutput('      Tests  40 passed (40)')).toBe(
      '40/40 passed',
    );
  });

  it('falls back when nothing matches', () => {
    expect(summarizeTestOutput('done')).toBe(
      'no summary parsed, exit code only',
    );
  });
});

describe('countTypeErrors', () => {
  it('counts tsc diagnostics', () => {
    expect(
      countTypeErrors(
        'a.ts(1,1): error TS2322: x\nb.ts(2,2): error TS2345: y\n',
      ),
    ).toBe(2);
    expect(countTypeErrors('')).toBe(0);
  });
});
