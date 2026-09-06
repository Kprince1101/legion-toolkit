import { findRegressions } from './baseline.js';
import { computeScore, uncoveredShare } from './score.js';
import type { AuditResult, MissingTest, TestCoverage } from '../types.js';

const coverage = (
  components: number,
  hooks: number,
  missing: number,
): TestCoverage => ({
  components,
  hooks,
  missing: Array.from({ length: missing }, (_unused, index) => ({
    file: `components/Shell${index}.tsx`,
    kind: 'component' as const,
  })) as MissingTest[],
  source: 'filenames',
  totalPct: null,
});

const result = (
  testCoverage: TestCoverage,
  ratio: number,
): Omit<AuditResult, 'score' | 'schema' | 'generatedAt' | 'advice'> =>
  ({
    gates: [],
    lint: { legion: [], warnings: 0, errors: 0 },
    directives: { fileWide: [] },
    prHygiene: { status: 'pass', inspected: 44, withPr: 2, ratio },
    testCoverage,
  }) as unknown as Omit<
    AuditResult,
    'score' | 'schema' | 'generatedAt' | 'advice'
  >;

describe('uncoveredShare', () => {
  it('is a share, not a count', () => {
    expect(uncoveredShare(coverage(38, 0, 31))).toBeCloseTo(31 / 38);
    expect(uncoveredShare(coverage(100, 0, 79))).toBeCloseTo(0.79);
  });

  it('is zero when there is nothing to cover', () => {
    expect(uncoveredShare(coverage(0, 0, 0))).toBe(0);
  });
});

describe('computeScore', () => {
  it('does not punish decomposing one component into many', () => {
    const before = computeScore(result(coverage(38, 0, 31), 1));
    const after = computeScore(result(coverage(100, 0, 79), 1));
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('ignores PR hygiene, which is history and not the current code', () => {
    const clean = computeScore(result(coverage(10, 0, 0), 1));
    const messy = computeScore(result(coverage(10, 0, 0), 0.05));
    expect(messy).toBe(clean);
    expect(clean).toBe(100);
  });

  it('still scales the penalty with the share left uncovered', () => {
    expect(computeScore(result(coverage(10, 0, 10), 1))).toBe(85);
    expect(computeScore(result(coverage(10, 0, 5), 1))).toBe(93);
  });
});

describe('findRegressions', () => {
  it('does not call decomposition a coverage regression', () => {
    const before = {
      ...result(coverage(38, 0, 31), 1),
      score: 80,
    } as unknown as AuditResult;
    const after = {
      ...result(coverage(100, 0, 79), 1),
      score: 80,
    } as unknown as AuditResult;
    expect(findRegressions(before, after)).toEqual([]);
  });

  it('still catches a genuine drop in the covered share', () => {
    const before = {
      ...result(coverage(10, 0, 1), 1),
      score: 90,
    } as unknown as AuditResult;
    const after = {
      ...result(coverage(10, 0, 6), 1),
      score: 90,
    } as unknown as AuditResult;
    expect(findRegressions(before, after)).toEqual([
      { area: 'share without tests', before: '10%', after: '60%' },
    ]);
  });
});
