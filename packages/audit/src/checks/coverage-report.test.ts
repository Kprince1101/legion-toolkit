import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSummary, readCoverageReport } from './coverage-report.js';

const SUMMARY = JSON.stringify({
  total: { lines: { total: 100, covered: 91, pct: 91 } },
  '/repo/components/Covered.tsx': { lines: { total: 10, covered: 9, pct: 90 } },
  '/repo/components/Untouched.tsx': { lines: { total: 8, covered: 0, pct: 0 } },
});

describe('parseSummary', () => {
  it('maps absolute paths back to repo-relative and reads the total', () => {
    const report = parseSummary(SUMMARY, '/repo');
    expect(report.available).toBe(true);
    expect(report.totalPct).toBe(91);
    expect(report.files['components/Covered.tsx']).toBe(true);
    expect(report.files['components/Untouched.tsx']).toBe(false);
  });

  it('falls back to statements when lines are absent', () => {
    const text = JSON.stringify({
      '/repo/a.ts': { statements: { covered: 3, pct: 60 } },
    });
    expect(parseSummary(text, '/repo').files['a.ts']).toBe(true);
  });
});

const FINAL = JSON.stringify({
  '/repo/components/Covered.tsx': {
    path: '/repo/components/Covered.tsx',
    statementMap: { '0': {}, '1': {} },
    s: { '0': 4, '1': 1 },
    fnMap: {},
    f: {},
    branchMap: {},
    b: {},
  },
  '/repo/components/Untouched.tsx': {
    path: '/repo/components/Untouched.tsx',
    statementMap: { '0': {}, '1': {} },
    s: { '0': 0, '1': 0 },
    fnMap: {},
    f: {},
    branchMap: {},
    b: {},
  },
});

describe('parseSummary, istanbul coverage-final.json', () => {
  it('reads statement hit counts instead of reporting everything uncovered', () => {
    const report = parseSummary(FINAL, '/repo');
    expect(report.files['components/Covered.tsx']).toBe(true);
    expect(report.files['components/Untouched.tsx']).toBe(false);
  });

  it('computes a total from the statement maps, since there is no total key', () => {
    expect(parseSummary(FINAL, '/repo').totalPct).toBe(50);
  });
});

describe('readCoverageReport', () => {
  const withCoverage = (name: string, contents: string): string => {
    const root = mkdtempSync(join(tmpdir(), 'legion-cov-'));
    mkdirSync(join(root, 'coverage'), { recursive: true });
    writeFileSync(join(root, 'coverage', name), contents);
    return root;
  };

  it('falls back to coverage-final.json when there is no summary', () => {
    const root = withCoverage('coverage-final.json', FINAL);
    const report = readCoverageReport(root);
    expect(report.available).toBe(true);
    expect(Object.values(report.files).filter(Boolean)).toHaveLength(1);
  });

  it('reports nothing rather than everything-uncovered when the file is unreadable', () => {
    const root = withCoverage('coverage-summary.json', 'not json');
    expect(readCoverageReport(root).available).toBe(false);
  });

  it('ignores a summary that parses to no files at all', () => {
    const root = withCoverage('coverage-summary.json', JSON.stringify({}));
    expect(readCoverageReport(root).available).toBe(false);
  });
});
