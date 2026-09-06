import { parseSummary } from './coverage-report.js';

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
