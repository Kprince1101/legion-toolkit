import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { compareGuards, hashGuards, SCRIPTS_KEY } from './guards.ts';
import {
  countLines,
  countTsSuppressions,
  isSkipped,
  listFiles,
  sourceSizes,
  tsSuppressionsIn,
} from './tree.ts';

let root = '';

const put = (file: string, content: string): void => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'three-arm-tree-'));
  put('app/page.tsx', 'a\nb\nc\n');
  put('app/stats/StatsDashboard.tsx', `${'x\n'.repeat(520)}`);
  put('lib/streaks.ts', '// @ts-expect-error\nconst a = 1;\n// @ts-ignore\n');
  put('acceptance/auth.spec.ts', `${'y\n'.repeat(900)}`);
  put('node_modules/next/index.js', `${'z\n'.repeat(5000)}`);
  put('data/store.json', '{}');
  put('lib/data/seed.ts', 'export const seed = 1;\n');
  put(
    'package.json',
    JSON.stringify({ scripts: { lint: 'oxlint .' }, dependencies: {} }),
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('tree', () => {
  it('skips dependencies, build output and the top-level data store', () => {
    expect(isSkipped('node_modules/next/index.js')).toBe(true);
    expect(isSkipped('app/.next/x')).toBe(true);
    expect(isSkipped('data/store.json')).toBe(true);
    expect(isSkipped('lib/data/seed.ts')).toBe(false);
    expect(listFiles(root)).toEqual([
      'acceptance/auth.spec.ts',
      'app/page.tsx',
      'app/stats/StatsDashboard.tsx',
      'lib/data/seed.ts',
      'lib/streaks.ts',
      'package.json',
    ]);
  });

  it('ranks agent-written source by lines and leaves out the kit checks', () => {
    expect(sourceSizes(root).map((size) => [size.file, size.lines])).toEqual([
      ['app/stats/StatsDashboard.tsx', 520],
      ['app/page.tsx', 3],
      ['lib/streaks.ts', 3],
      ['lib/data/seed.ts', 1],
    ]);
  });

  it('counts type suppressions', () => {
    expect(countTsSuppressions('// @ts-nocheck\n// @ts-ignore')).toBe(2);
    expect(tsSuppressionsIn(root)).toBe(2);
  });

  it('counts lines with or without a trailing newline', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\nb\n')).toBe(2);
  });
});

describe('guards', () => {
  it('notices a changed check, a new hook file and an edited script', () => {
    const before = hashGuards(root);
    expect(Object.keys(before).sort()).toEqual([
      'acceptance/auth.spec.ts',
      SCRIPTS_KEY,
    ]);
    put('acceptance/auth.spec.ts', 'test.skip();\n');
    put('.claude/settings.json', '{}');
    put('package.json', JSON.stringify({ scripts: { lint: 'true' } }));
    expect(compareGuards(before, hashGuards(root))).toEqual({
      changed: ['acceptance/auth.spec.ts', SCRIPTS_KEY],
      added: ['.claude/settings.json'],
      removed: [],
    });
  });

  it('ignores dependency changes that leave the scripts alone', () => {
    const before = hashGuards(root);
    put(
      'package.json',
      JSON.stringify({
        scripts: { lint: 'oxlint .' },
        dependencies: { 'better-sqlite3': '12.0.0' },
      }),
    );
    expect(compareGuards(before, hashGuards(root)).changed).toEqual([]);
  });

  it('notices a removed rules file', () => {
    put('AGENTS.md', 'rules');
    const before = hashGuards(root);
    rmSync(join(root, 'AGENTS.md'));
    expect(compareGuards(before, hashGuards(root)).removed).toEqual([
      'AGENTS.md',
    ]);
  });

  it('notices lint configs added or changed at any depth, in any format', () => {
    put('app/stats/oxlint.config.ts', 'export default {};\n');
    const before = hashGuards(root);
    put('app/.oxlintrc.json', '{"ignorePatterns":["**/*"]}');
    put('lib/eslint.config.mjs', 'export default [];\n');
    put('app/.eslintrc.json', '{}');
    put('app/stats/oxlint.config.ts', 'export default { rules: {} };\n');
    put('node_modules/next/.oxlintrc.json', '{}');
    expect(compareGuards(before, hashGuards(root))).toEqual({
      changed: ['app/stats/oxlint.config.ts'],
      added: [
        'app/.eslintrc.json',
        'app/.oxlintrc.json',
        'lib/eslint.config.mjs',
      ],
      removed: [],
    });
  });
});
