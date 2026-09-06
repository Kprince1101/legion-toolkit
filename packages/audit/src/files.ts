import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.expo',
  '.turbo',
  '.yarn',
  'ios',
  'android',
  '.cache',
]);

export const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]);

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return '';
  return name.slice(dot);
};

const normalizePrefix = (prefix: string): string =>
  prefix.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

const isIgnoredPath = (relativePath: string, prefixes: string[]): boolean =>
  prefixes.some(
    (prefix) =>
      relativePath === prefix || relativePath.startsWith(`${prefix}/`),
  );

export const listSourceFiles = (
  root: string,
  ignore: string[] = [],
): string[] => {
  const prefixes = ignore.map(normalizePrefix).filter((p) => p.length > 0);
  const files: string[] = [];
  const visit = (dir: string): void => {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let isDirectory = false;
      try {
        isDirectory = statSync(full).isDirectory();
      } catch {
        continue;
      }
      const relativePath = toPosix(root, full);
      if (isDirectory) {
        if (IGNORED_DIRS.has(entry)) continue;
        if (isIgnoredPath(relativePath, prefixes)) continue;
        visit(full);
        continue;
      }
      if (isIgnoredPath(relativePath, prefixes)) continue;
      if (SOURCE_EXTENSIONS.has(extensionOf(entry))) files.push(full);
    }
  };
  visit(root);
  return files.sort();
};

export const toPosix = (root: string, file: string): string =>
  relative(root, file).split(sep).join('/');

export const baseName = (file: string): string => {
  const slash = file.lastIndexOf('/');
  if (slash === -1) return file;
  return file.slice(slash + 1);
};

export const stripExtension = (name: string): string => {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return name;
  return name.slice(0, dot);
};
