import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectToolchain, lockfileCheck, workspaceContext } from 'legion-audit';
import type { InitDetection, Linter, Preset } from './types.js';

const AGENT_MARKERS: Array<[string, string]> = [
  ['.claude', 'Claude Code'],
  ['.junie', 'Junie'],
  ['.cursor', 'Cursor'],
  ['.github/copilot-instructions.md', 'Copilot'],
  ['AGENTS.md', 'AGENTS.md'],
];

const readPackageJson = (
  root: string,
): { scripts?: Record<string, string> } => {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
  } catch {
    return {};
  }
};

export const presetFor = (framework: string): Preset => {
  if (framework === 'expo' || framework === 'react-native')
    return 'reactNative';
  return 'recommended';
};

export const linterFor = (
  hasOxlintConfig: boolean,
  hasEslintConfig: boolean,
): Linter => {
  if (hasOxlintConfig) return 'oxlint';
  if (hasEslintConfig) return 'eslint';
  return 'oxlint';
};

export const detectAgents = (root: string): string[] =>
  AGENT_MARKERS.filter(([path]) => existsSync(join(root, path))).map(
    ([, label]) => label,
  );

export const detect = (root: string): InitDetection => {
  const workspace = workspaceContext(root);
  const lockfile = lockfileCheck(workspace.workspaceRoot);
  const toolchain = detectToolchain(root, lockfile.packageManager, workspace);
  return {
    root,
    packageManager: lockfile.packageManager,
    linter: linterFor(toolchain.hasOxlintConfig, toolchain.hasEslintConfig),
    preset: presetFor(toolchain.framework),
    framework: toolchain.framework,
    hasOxlintConfig: toolchain.hasOxlintConfig,
    hasEslintConfig: toolchain.hasEslintConfig,
    hasPrettierConfig: toolchain.hasPrettierConfig,
    hasTsconfig: toolchain.hasTsconfig,
    pluginReferenced: toolchain.pluginReferenced,
    agents: detectAgents(root),
    scripts: readPackageJson(root).scripts ?? {},
  };
};
