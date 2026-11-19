import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

const SKIP_ANYWHERE = new Set(['node_modules', '.next', '.git']);

const SKIP_AT_TOP = new Set([
  'data',
  'coverage',
  'test-results',
  'playwright-report',
  '.kit-acceptance',
]);

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
]);

const KIT_OWNED = ['acceptance/', 'playwright.config.ts', 'next-env.d.ts'];

export const toPosix = (path: string): string => path.split(sep).join('/');

export const isSkipped = (relativePath: string): boolean => {
  const segments = toPosix(relativePath).split('/');
  if (SKIP_AT_TOP.has(segments[0] ?? '')) return true;
  return segments.some((segment) => SKIP_ANYWHERE.has(segment));
};

export const listFiles = (root: string): string[] => {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (isSkipped(relative(root, absolute))) continue;
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) found.push(toPosix(relative(root, absolute)));
    }
  };
  walk(root);
  return found.sort();
};

export const isSource = (file: string): boolean =>
  SOURCE_EXTENSIONS.has(extname(file));

export const isAgentSource = (file: string): boolean =>
  isSource(file) && !KIT_OWNED.some((owned) => file.startsWith(owned));

export const countLines = (text: string): number => {
  if (text.length === 0) return 0;
  const lines = text.split('\n').length;
  if (text.endsWith('\n')) return lines - 1;
  return lines;
};

export interface FileSize {
  file: string;
  lines: number;
  bytes: number;
}

export const sourceSizes = (root: string): FileSize[] =>
  listFiles(root)
    .filter(isAgentSource)
    .map((file) => {
      const absolute = join(root, file);
      return {
        file,
        lines: countLines(readFileSync(absolute, 'utf8')),
        bytes: statSync(absolute).size,
      };
    })
    .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));

const TS_SUPPRESSION = /@ts-(?:ignore|expect-error|nocheck)\b/g;

export const countTsSuppressions = (text: string): number =>
  [...text.matchAll(TS_SUPPRESSION)].length;

export const tsSuppressionsIn = (root: string): number =>
  listFiles(root)
    .filter(isAgentSource)
    .reduce(
      (total, file) =>
        total + countTsSuppressions(readFileSync(join(root, file), 'utf8')),
      0,
    );

export const sha256 = (content: string | Buffer): string =>
  createHash('sha256').update(content).digest('hex');

export const copySource = (from: string, to: string): void => {
  cpSync(from, to, {
    recursive: true,
    filter: (source) => !isSkipped(relative(from, source)),
  });
};

export const filesUnder = (root: string, path: string): string[] => {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [toPosix(path)];
  return listFiles(absolute).map((file) => toPosix(join(path, file)));
};
