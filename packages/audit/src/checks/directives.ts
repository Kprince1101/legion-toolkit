import { readFileSync } from 'node:fs';
import { listSourceFiles, toPosix } from '../files.js';
import type { DirectiveHit, DirectivesResult, NosonarHit } from '../types.js';

const DIRECTIVE_PATTERN =
  /(?:\/\/|\/\*)\s*(eslint|oxlint)-(disable|enable)(-next-line|-line)?\b([^\n]*?)(?:\*\/|$)/g;

const NOSONAR_PATTERN = /\bNOSONAR\b/;

const scopeFromSuffix = (suffix: string | undefined): DirectiveHit['scope'] => {
  if (suffix === '-next-line') return 'next-line';
  if (suffix === '-line') return 'line';
  return 'file';
};

const splitRest = (rest: string): { rules: string[]; description: string } => {
  const text = rest.trim();
  const separator = text.indexOf('--');
  let rulesText = text;
  let description = '';
  if (separator !== -1) {
    rulesText = text.slice(0, separator);
    description = text.slice(separator + 2).trim();
  }
  const rules = rulesText
    .split(',')
    .map((rule) => rule.trim())
    .filter((rule) => rule.length > 0);
  return { rules, description };
};

const QUOTES = new Set(["'", '"', '`']);

const isInsideString = (text: string, index: number): boolean => {
  let open: string | null = null;
  let position = 0;
  while (position < index) {
    const char = text[position] ?? '';
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

export const parseDirectivesInSource = (
  file: string,
  source: string,
): { hits: DirectiveHit[]; nosonar: NosonarHit[] } => {
  const hits: DirectiveHit[] = [];
  const nosonar: NosonarHit[] = [];
  const lines = source.split('\n');
  lines.forEach((text, index) => {
    const line = index + 1;
    if (NOSONAR_PATTERN.test(text)) nosonar.push({ file, line });
    for (const match of text.matchAll(DIRECTIVE_PATTERN)) {
      if (isInsideString(text, match.index)) continue;
      const [, tool, kind, suffix, rest] = match;
      const { rules, description } = splitRest(rest ?? '');
      hits.push({
        file,
        line,
        tool: tool as DirectiveHit['tool'],
        kind: kind as DirectiveHit['kind'],
        scope: scopeFromSuffix(suffix),
        rules,
        description,
      });
    }
  });
  return { hits, nosonar };
};

export const isFileWideDisable = (hit: DirectiveHit): boolean =>
  hit.kind === 'disable' && hit.scope === 'file' && hit.rules.length === 0;

const ALL_RULES = '(all rules)';

const namesFor = (hit: DirectiveHit): string[] => {
  if (hit.rules.length === 0) return [ALL_RULES];
  return hit.rules;
};

export const scanDirectives = (
  root: string,
  ignore: string[] = [],
): DirectivesResult => {
  const all: DirectiveHit[] = [];
  const nosonar: NosonarHit[] = [];
  for (const file of listSourceFiles(root, ignore)) {
    let source = '';
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const relativeFile = toPosix(root, file);
    const parsed = parseDirectivesInSource(relativeFile, source);
    all.push(...parsed.hits);
    nosonar.push(...parsed.nosonar);
  }
  const byRule: Record<string, number> = {};
  for (const hit of all) {
    if (hit.kind !== 'disable') continue;
    for (const name of namesFor(hit)) byRule[name] = (byRule[name] ?? 0) + 1;
  }
  return {
    fileWide: all.filter(isFileWideDisable),
    all,
    nosonar,
    byRule,
  };
};
