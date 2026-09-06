import {
  baseName,
  listSourceFiles,
  stripExtension,
  toPosix,
} from '../files.js';
import type { MissingTest, TestCoverage } from '../types.js';

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

export const classify = (files: string[]): TestCoverage => {
  const tested = new Set<string>();
  const candidates: MissingTest[] = [];
  let components = 0;
  let hooks = 0;
  for (const file of files) {
    if (isTestFile(file)) {
      tested.add(testBaseName(file));
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
  const missing = candidates.filter(
    (candidate) => !tested.has(stripExtension(baseName(candidate.file))),
  );
  return { components, hooks, missing };
};

export const testCoverage = (
  root: string,
  ignore: string[] = [],
): TestCoverage =>
  classify(listSourceFiles(root, ignore).map((file) => toPosix(root, file)));
