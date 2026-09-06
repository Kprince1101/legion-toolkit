import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toPosix } from '../files.js';
import type { CoverageReport } from '../types.js';

interface Metric {
  total?: number;
  covered?: number;
  pct?: number;
}

interface SummaryEntry {
  lines?: Metric;
  statements?: Metric;
}

type Summary = Record<string, SummaryEntry>;

const SUMMARY_PATHS = [
  join('coverage', 'coverage-summary.json'),
  join('coverage', 'coverage-final.json'),
];

const isCovered = (entry: SummaryEntry): boolean => {
  const lines = entry.lines ?? entry.statements;
  if (!lines) return false;
  if (lines.covered !== undefined) return lines.covered > 0;
  if (lines.pct !== undefined) return lines.pct > 0;
  return false;
};

export const parseSummary = (text: string, root: string): CoverageReport => {
  const parsed = JSON.parse(text) as Summary;
  const files: Record<string, boolean> = {};
  let totalPct: number | null = null;
  for (const [key, entry] of Object.entries(parsed)) {
    if (key === 'total') {
      totalPct = entry.lines?.pct ?? entry.statements?.pct ?? null;
      continue;
    }
    files[toPosix(root, key)] = isCovered(entry);
  }
  return { available: true, files, totalPct };
};

export const NO_COVERAGE_REPORT: CoverageReport = {
  available: false,
  files: {},
  totalPct: null,
};

export const readCoverageReport = (root: string): CoverageReport => {
  for (const relative of SUMMARY_PATHS) {
    const path = join(root, relative);
    if (!existsSync(path)) continue;
    try {
      return parseSummary(readFileSync(path, 'utf8'), root);
    } catch {
      continue;
    }
  }
  return NO_COVERAGE_REPORT;
};
