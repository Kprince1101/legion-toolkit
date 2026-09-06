import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { localBin } from '../exec.js';
import { isExpoProject, isReactNativeProject } from './expo.js';
import type {
  Framework,
  PackageManager,
  Toolchain,
  WorkspaceContext,
  YarnFlavor,
} from '../types.js';

interface PackageJson {
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  prettier?: unknown;
  workspaces?: string[] | { packages?: string[] };
}

const OXLINT_CONFIGS = [
  '.oxlintrc.json',
  '.oxlintrc.jsonc',
  'oxlint.config.ts',
  'oxlint.config.mts',
];

const ESLINT_CONFIGS = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  'eslint.config.mts',
];

const PRETTIER_CONFIGS = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  '.prettierrc.mjs',
  'prettier.config.js',
  'prettier.config.mjs',
];

const readPackageJson = (root: string): PackageJson => {
  try {
    return JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    ) as PackageJson;
  } catch {
    return {};
  }
};

const readFile = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
};

const hasAny = (root: string, names: string[]): boolean =>
  names.some((name) => existsSync(join(root, name)));

const CLASSIC_LOCKFILE_MARKER = '# yarn lockfile v1';

export const yarnFlavorFrom = (
  lockfileHead: string,
  packageManagerField: string | undefined,
  hasYarnrcYml: boolean,
): YarnFlavor => {
  if (lockfileHead.includes(CLASSIC_LOCKFILE_MARKER)) return 'classic';
  if (hasYarnrcYml) return 'berry';
  if (packageManagerField?.startsWith('yarn@') === true) {
    const version = packageManagerField.slice('yarn@'.length);
    if (version.startsWith('1.')) return 'classic';
    return 'berry';
  }
  return 'unknown';
};

const detectYarnFlavor = (
  workspaceRoot: string,
  manager: PackageManager,
): YarnFlavor => {
  if (manager !== 'yarn') return 'none';
  const head = readFile(join(workspaceRoot, 'yarn.lock')).slice(0, 512);
  const pkg = readPackageJson(workspaceRoot);
  return yarnFlavorFrom(
    head,
    pkg.packageManager,
    existsSync(join(workspaceRoot, '.yarnrc.yml')),
  );
};

const detectFramework = (root: string): Framework => {
  if (isExpoProject(root)) return 'expo';
  if (isReactNativeProject(root)) return 'react-native';
  const pkg = readPackageJson(root);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps['next'] !== undefined) return 'next';
  if (deps['vite'] !== undefined) return 'vite';
  if (deps['react'] !== undefined) return 'react';
  return 'node';
};

const PLUGIN_MARKERS = [
  'legion-toolkit/eslint-plugin',
  'eslint-plugin-legion',
  'legion-rules',
];

const referencesPlugin = (root: string): boolean => {
  const configs = [...OXLINT_CONFIGS, ...ESLINT_CONFIGS];
  return configs.some((name) => {
    const path = join(root, name);
    if (!existsSync(path)) return false;
    const text = readFile(path);
    return PLUGIN_MARKERS.some((marker) => text.includes(marker));
  });
};

const isToolkitInstalled = (root: string): boolean => {
  const pkg = readPackageJson(root);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return (
    deps['legion-toolkit'] !== undefined ||
    deps['eslint-plugin-legion'] !== undefined
  );
};

const hasWorkspaces = (root: string): boolean =>
  readPackageJson(root).workspaces !== undefined;

export const detectToolchain = (
  root: string,
  manager: PackageManager,
  workspace: WorkspaceContext,
): Toolchain => {
  const pkg = readPackageJson(root);
  const workspacePkg = readPackageJson(workspace.workspaceRoot);
  return {
    packageManager: manager,
    yarnFlavor: detectYarnFlavor(workspace.workspaceRoot, manager),
    packageManagerField:
      pkg.packageManager ?? workspacePkg.packageManager ?? null,
    framework: detectFramework(root),
    workspaces: hasWorkspaces(workspace.workspaceRoot),
    hasOxlintConfig: hasAny(root, OXLINT_CONFIGS),
    hasEslintConfig: hasAny(root, ESLINT_CONFIGS),
    hasOxlintBin: localBin(root, 'oxlint') !== null,
    hasEslintBin: localBin(root, 'eslint') !== null,
    hasPrettierConfig:
      hasAny(root, PRETTIER_CONFIGS) || pkg.prettier !== undefined,
    hasTsconfig: existsSync(join(root, 'tsconfig.json')),
    toolkitInstalled:
      isToolkitInstalled(root) || isToolkitInstalled(workspace.workspaceRoot),
    pluginReferenced:
      referencesPlugin(root) || referencesPlugin(workspace.workspaceRoot),
    workspaceRoot: workspace.workspaceRoot,
    isWorkspacePackage: workspace.isPackage,
    scripts: pkg.scripts ?? {},
  };
};
