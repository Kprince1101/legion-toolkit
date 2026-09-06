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

interface FinalEntry {
  path?: string;
  statementMap?: Record<string, unknown>;
  s?: Record<string, number>;
}

type Entry = SummaryEntry & FinalEntry;

type Report = Record<string, Entry>;

const SUMMARY_PATHS = [
  join('coverage', 'coverage-summary.json'),
  join('coverage', 'coverage-final.json'),
];

const isFinalEntry = (entry: Entry): boolean =>
  entry.s !== undefined && entry.statementMap !== undefined;

const finalHits = (entry: Entry): number[] => Object.values(entry.s ?? {});

const summaryCovered = (entry: Entry): boolean => {
  const lines = entry.lines ?? entry.statements;
  if (!lines) return false;
  if (lines.covered !== undefined) return lines.covered > 0;
  if (lines.pct !== undefined) return lines.pct > 0;
  return false;
};

const isCovered = (entry: Entry): boolean => {
  if (isFinalEntry(entry)) return finalHits(entry).some((hits) => hits > 0);
  return summaryCovered(entry);
};

const percentage = (covered: number, total: number): number | null => {
  if (total === 0) return null;
  return Math.round((covered / total) * 10000) / 100;
};

export const parseSummary = (text: string, root: string): CoverageReport => {
  const parsed = JSON.parse(text) as Report;
  const files: Record<string, boolean> = {};
  let totalPct: number | null = null;
  let finalCovered = 0;
  let finalTotal = 0;
  for (const [key, entry] of Object.entries(parsed)) {
    if (key === 'total') {
      totalPct = entry.lines?.pct ?? entry.statements?.pct ?? null;
      continue;
    }
    if (isFinalEntry(entry)) {
      const hits = finalHits(entry);
      finalTotal += hits.length;
      finalCovered += hits.filter((count) => count > 0).length;
    }
    files[toPosix(root, key)] = isCovered(entry);
  }
  if (totalPct === null && finalTotal > 0) {
    totalPct = percentage(finalCovered, finalTotal);
  }
  return { available: true, files, totalPct };
};

export const NO_COVERAGE_REPORT: CoverageReport = {
  available: false,
  files: {},
  totalPct: null,
};

const isUsable = (report: CoverageReport): boolean =>
  Object.keys(report.files).length > 0;

export const readCoverageReport = (root: string): CoverageReport => {
  for (const relative of SUMMARY_PATHS) {
    const path = join(root, relative);
    if (!existsSync(path)) continue;
    try {
      const report = parseSummary(readFileSync(path, 'utf8'), root);
      if (isUsable(report)) return report;
    } catch {
      continue;
    }
  }
  return NO_COVERAGE_REPORT;
};
