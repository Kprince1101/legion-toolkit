import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { run } from '../exec.js';
import { localBin } from '../exec.js';
import { ancestors } from '../workspace.js';
import type { RuleCoverage } from '../types.js';

const PLUGIN_PACKAGES = [
  'eslint-plugin-legion',
  'legion-toolkit/eslint-plugin',
];

const OXLINT_CONFIGS = ['.oxlintrc.json', '.oxlintrc.jsonc'];

const LEGION_PREFIX = 'legion/';

const stripPrefix = (name: string): string => name.slice(LEGION_PREFIX.length);

export const availableRules = async (root: string): Promise<string[]> => {
  for (const dir of ancestors(root)) {
    const anchor = join(dir, 'package.json');
    if (!existsSync(anchor)) continue;
    const require = createRequire(anchor);
    for (const specifier of PLUGIN_PACKAGES) {
      try {
        const resolved = require.resolve(specifier);
        const loaded = (await import(`file://${resolved}`)) as {
          default?: { rules?: Record<string, unknown> };
          rules?: Record<string, unknown>;
        };
        const rules = loaded.default?.rules ?? loaded.rules;
        if (rules) return Object.keys(rules).sort();
      } catch {
        continue;
      }
    }
  }
  return [];
};

const stripComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export const configuredFromOxlint = (root: string): string[] | null => {
  for (const name of OXLINT_CONFIGS) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(stripComments(readFileSync(path, 'utf8'))) as {
        rules?: Record<string, unknown>;
      };
      return Object.keys(parsed.rules ?? {})
        .filter((rule) => rule.startsWith(LEGION_PREFIX))
        .map(stripPrefix)
        .sort();
    } catch {
      return null;
    }
  }
  return null;
};

export const configuredFromEslint = (
  root: string,
  probe: string,
): string[] | null => {
  const bin = localBin(root, 'eslint');
  if (!bin) return null;
  const result = run(bin, ['--print-config', probe], root);
  if (result.code !== 0) return null;
  try {
    const parsed = JSON.parse(result.stdout) as {
      rules?: Record<string, unknown>;
    };
    return Object.keys(parsed.rules ?? {})
      .filter((rule) => rule.startsWith(LEGION_PREFIX))
      .map(stripPrefix)
      .sort();
  } catch {
    return null;
  }
};

const SKIPPED: RuleCoverage = {
  status: 'skipped',
  available: [],
  configured: [],
  unconfigured: [],
  source: 'none',
};

export const ruleCoverage = async (
  root: string,
  probe: string | null,
): Promise<RuleCoverage> => {
  const available = await availableRules(root);
  if (available.length === 0) return SKIPPED;
  const fromOxlint = configuredFromOxlint(root);
  if (fromOxlint !== null) {
    return summarizeCoverage(available, fromOxlint, 'oxlint');
  }
  if (probe === null) return SKIPPED;
  const fromEslint = configuredFromEslint(root, probe);
  if (fromEslint === null) return SKIPPED;
  return summarizeCoverage(available, fromEslint, 'eslint');
};

export const summarizeCoverage = (
  available: string[],
  configured: string[],
  source: RuleCoverage['source'],
): RuleCoverage => ({
  status: 'checked',
  available,
  configured,
  unconfigured: available.filter((rule) => !configured.includes(rule)),
  source,
});
