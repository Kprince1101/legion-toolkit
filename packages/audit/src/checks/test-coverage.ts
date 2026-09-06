import { readFileSync } from 'node:fs';
import {
  baseName,
  listSourceFiles,
  stripExtension,
  toPosix,
} from '../files.js';
import { NO_COVERAGE_REPORT, readCoverageReport } from './coverage-report.js';
import type {
  CoverageReport,
  CoverageSource,
  MissingTest,
  TestCoverage,
} from '../types.js';

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

const ROUTE_FILES = new Set([
  'page',
  'layout',
  'loading',
  'error',
  'not-found',
  'template',
  'route',
  'default',
  'global-error',
]);

const CONFIG_FILES = /\.(config|setup|d)\.[cm]?[jt]sx?$/;

const isTestFile = (file: string): boolean =>
  TEST_FILE.test(file) || file.includes('/__tests__/');

const testBaseName = (file: string): string =>
  stripExtension(stripExtension(baseName(file)));

const isComponentFile = (file: string): boolean => {
  if (!file.endsWith('.tsx')) return false;
  if (CONFIG_FILES.test(file)) return false;
  const name = stripExtension(baseName(file));
  if (ROUTE_FILES.has(name)) return false;
  if (!/^[A-Z]/.test(name)) return false;
  return (
    file.includes('/components/') ||
    file.startsWith('components/') ||
    file.includes('/app/') ||
    file.startsWith('app/')
  );
};

const isHookFile = (file: string): boolean => {
  if (!/\.tsx?$/.test(file)) return false;
  const name = stripExtension(baseName(file));
  return /^use[A-Z0-9]/.test(name);
};

const IMPORT_PATTERN = /(?:from|require\()\s*['"]([^'"]+)['"]/g;
const DESCRIBE_PATTERN = /\b(?:describe|it|test)\s*\(\s*['"`]([^'"`]+)/g;
const IDENTIFIER_HEAD = /^[A-Za-z][A-Za-z0-9_]*/;

export const coveredNames = (source: string): string[] => {
  const names = new Set<string>();
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? '';
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
    names.add(stripExtension(baseName(specifier)));
  }
  for (const match of source.matchAll(DESCRIBE_PATTERN)) {
    const head = IDENTIFIER_HEAD.exec((match[1] ?? '').trim());
    if (head) names.add(head[0]);
  }
  return [...names];
};

const sourceFor = (
  report: CoverageReport,
  covered: Record<string, string[]>,
): CoverageSource => {
  if (report.available) return 'coverage-report';
  if (Object.keys(covered).length > 0) return 'references';
  return 'filenames';
};

export const classify = (
  files: string[],
  covered: Record<string, string[]> = {},
  report: CoverageReport = NO_COVERAGE_REPORT,
): TestCoverage => {
  const tested = new Set<string>();
  const candidates: MissingTest[] = [];
  let components = 0;
  let hooks = 0;
  for (const file of files) {
    if (isTestFile(file)) {
      tested.add(testBaseName(file));
      for (const name of covered[file] ?? []) tested.add(name);
      continue;
    }
    if (isComponentFile(file)) {
      components += 1;
      candidates.push({ file, kind: 'component' });
      continue;
    }
    if (isHookFile(file)) {
      hooks += 1;
      candidates.push({ file, kind: 'hook' });
    }
  }
  const isTested = (file: string): boolean => {
    if (report.available) return report.files[file] === true;
    return tested.has(stripExtension(baseName(file)));
  };
  const missing = candidates.filter((candidate) => !isTested(candidate.file));
  return {
    components,
    hooks,
    missing,
    source: sourceFor(report, covered),
    totalPct: report.totalPct,
  };
};

const readCoveredNames = (
  root: string,
  files: string[],
): Record<string, string[]> => {
  const covered: Record<string, string[]> = {};
  for (const file of files) {
    const relative = toPosix(root, file);
    if (!isTestFile(relative)) continue;
    try {
      covered[relative] = coveredNames(readFileSync(file, 'utf8'));
    } catch {
      covered[relative] = [];
    }
  }
  return covered;
};

export const testCoverage = (
  root: string,
  ignore: string[] = [],
): TestCoverage => {
  const files = listSourceFiles(root, ignore);
  return classify(
    files.map((file) => toPosix(root, file)),
    readCoveredNames(root, files),
    readCoverageReport(root),
  );
};
