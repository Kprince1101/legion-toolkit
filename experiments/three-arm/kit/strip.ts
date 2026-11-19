import { readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { listFiles } from './tree.ts';

const DIRECTIVE_COMMENT =
  /\/\/[ \t]*(?:eslint|oxlint)-(?:disable|enable)[^\n]*|\/\*\s*(?:eslint|oxlint)-(?:disable|enable)[\s\S]*?\*\//g;

const LINTED = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

const QUOTES = new Set(["'", '"', '`']);

const insideString = (source: string, offset: number): boolean => {
  let open: string | null = null;
  let position = source.lastIndexOf('\n', offset - 1) + 1;
  while (position < offset) {
    const char = source[position] ?? '';
    if (char === '\\') {
      position += 2;
      continue;
    }
    if (open === null && QUOTES.has(char)) open = char;
    else if (open === char) open = null;
    position += 1;
  }
  return open !== null;
};

export const stripDirectives = (source: string): string =>
  source.replace(DIRECTIVE_COMMENT, (match: string, offset: number) => {
    if (insideString(source, offset)) return match;
    return match.replace(/[^\n]/g, '');
  });

export const stripDirectivesIn = (root: string): string[] => {
  const stripped: string[] = [];
  for (const file of listFiles(root)) {
    if (!LINTED.has(extname(file))) continue;
    const path = join(root, file);
    const source = readFileSync(path, 'utf8');
    const clean = stripDirectives(source);
    if (clean === source) continue;
    writeFileSync(path, clean);
    stripped.push(file);
  }
  return stripped;
};
