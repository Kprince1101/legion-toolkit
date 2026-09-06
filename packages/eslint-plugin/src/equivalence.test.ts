import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import * as tsParser from '@typescript-eslint/parser';
import { defineLegionConfig, strictInput } from 'legion-rules';
import plugin from './index.js';

const ROOT = resolve(__dirname, '..', '..', '..');
const FIXTURES = resolve(ROOT, 'fixtures');
const OXLINT_BIN = resolve(ROOT, 'node_modules', '.bin', 'oxlint');

const COMPARED_RULES = new Set([
  'no-ternary',
  'no-unneeded-ternary',
  'max-lines',
]);

const KNOWN_DIVERGENCE_FILES = new Set(['invalid/file-wide.ts']);

const FIXTURE_CONFIG = defineLegionConfig({
  ...strictInput,
  reactCompiler: true,
});

const isCompared = (rule: string): boolean =>
  rule.startsWith('legion/') || COMPARED_RULES.has(rule);

const key = (file: string, line: number, rule: string): string =>
  `${file}:${line}:${rule}`;

interface OxlintDiagnostic {
  code: string;
  filename: string;
  severity: string;
  labels?: Array<{ span: { line: number } }>;
}

const oxlintRuleId = (code: string): string => {
  const match = /^([^(]+)\(([^)]+)\)$/.exec(code);
  if (!match) return code;
  if (match[1] === 'eslint') return match[2] ?? code;
  return `${match[1]}/${match[2]}`;
};

const runOxlint = (): Set<string> => {
  const configPath = resolve(ROOT, `.fixtures-${process.pid}.oxlintrc.json`);
  writeFileSync(
    configPath,
    `${JSON.stringify({ ...FIXTURE_CONFIG.oxlint, plugins: ['eslint', 'typescript', 'unicorn', 'react'] }, null, 2)}\n`,
  );
  const result = spawnSync(
    OXLINT_BIN,
    ['-c', configPath, '--format', 'json', '.'],
    {
      cwd: FIXTURES,
      encoding: 'utf8',
    },
  );
  rmSync(configPath, { force: true });
  const parsed = JSON.parse(result.stdout) as {
    diagnostics: OxlintDiagnostic[];
  };
  const keys = new Set<string>();
  for (const diagnostic of parsed.diagnostics) {
    const rule = oxlintRuleId(diagnostic.code);
    if (!isCompared(rule)) continue;
    if (KNOWN_DIVERGENCE_FILES.has(diagnostic.filename)) continue;
    keys.add(
      key(diagnostic.filename, diagnostic.labels?.[0]?.span.line ?? 0, rule),
    );
  }
  return keys;
};

const listFixtureFiles = (dir = FIXTURES, prefix = ''): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const relativePath = `${prefix}${entry}`;
    if (statSync(full).isDirectory()) {
      files.push(...listFixtureFiles(full, `${relativePath}/`));
      continue;
    }
    if (/\.tsx?$/.test(entry)) files.push(relativePath);
  }
  return files.sort();
};

const runEslint = async (): Promise<Set<string>> => {
  const eslint = new ESLint({
    cwd: FIXTURES,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
          parser: tsParser,
          ecmaVersion: 'latest',
          sourceType: 'module',
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        linterOptions: { reportUnusedDisableDirectives: 'off' },
      },
      ...(FIXTURE_CONFIG.eslint(plugin) as never[]),
    ],
  });
  const keys = new Set<string>();
  for (const file of listFixtureFiles()) {
    if (KNOWN_DIVERGENCE_FILES.has(file)) continue;
    const code = readFileSync(resolve(FIXTURES, file), 'utf8');
    const results = await eslint.lintText(code, {
      filePath: resolve(FIXTURES, file),
    });
    for (const message of results[0]?.messages ?? []) {
      const rule = message.ruleId ?? 'parse-error';
      if (!isCompared(rule)) continue;
      keys.add(key(file, message.line, rule));
    }
  }
  return keys;
};

const describeIfOxlint = (): jest.Describe => {
  if (existsSync(OXLINT_BIN)) return describe;
  return describe.skip;
};

describeIfOxlint()('oxlint and ESLint agree on the fixtures', () => {
  it('report the same rule at the same file and line', async () => {
    const fromOxlint = runOxlint();
    const fromEslint = await runEslint();
    const onlyOxlint = [...fromOxlint].filter((k) => !fromEslint.has(k)).sort();
    const onlyEslint = [...fromEslint].filter((k) => !fromOxlint.has(k)).sort();
    expect({ onlyOxlint, onlyEslint }).toEqual({
      onlyOxlint: [],
      onlyEslint: [],
    });
    expect(fromOxlint.size).toBeGreaterThan(20);
  });

  it('report nothing from the compared rules on the valid fixtures except bypass warnings', async () => {
    const fromEslint = await runEslint();
    const validHits = [...fromEslint].filter((k) => k.startsWith('valid/'));
    expect(validHits).toEqual(['valid/directives.ts:2:legion/no-disables']);
  });
});
