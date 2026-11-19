import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { Arm } from './arms.ts';
import { hashGuards } from './guards.ts';
import type { RunMeta, ToolkitInstall, ToolkitSource } from './record.ts';
import { copySource } from './tree.ts';

export interface Manifest {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, string>;
  version?: string;
  [key: string]: unknown;
}

export interface ToolkitPlan {
  source: ToolkitSource;
  spec: string;
  overrides: Record<string, string>;
}

export const mergeManifest = (
  base: Manifest,
  overlay: Manifest,
  toolkit: ToolkitPlan,
): Manifest => {
  const merged: Manifest = {
    ...base,
    scripts: { ...base.scripts, ...overlay.scripts },
    devDependencies: {
      ...base.devDependencies,
      ...overlay.devDependencies,
      'legion-toolkit': toolkit.spec,
    },
  };
  if (Object.keys(toolkit.overrides).length > 0) {
    merged.overrides = { ...base.overrides, ...toolkit.overrides };
  }
  return merged;
};

export const npmPlan = (spec: string): ToolkitPlan => ({
  source: 'npm',
  spec,
  overrides: {},
});

export const checkoutPlan = (tarballs: Record<string, string>): ToolkitPlan => {
  const toolkit = tarballs['legion-toolkit'];
  if (toolkit === undefined) {
    throw new Error('pnpm pack produced no legion-toolkit tarball');
  }
  const overrides = Object.fromEntries(
    Object.entries(tarballs).map(([name, path]) => [name, `file:${path}`]),
  );
  return { source: 'checkout', spec: `file:${toolkit}`, overrides };
};

export const BUILD_OUTPUTS = [
  join('packages', 'steer', 'dist', 'cli.js'),
  join('packages', 'audit', 'dist', 'cli.js'),
  join('packages', 'toolkit', 'presets', 'recommended.json'),
];

export const packArgs = (outDir: string): string[] => [
  '--filter',
  './packages/*',
  'pack',
  '--out',
  join(outDir, '%s.tgz'),
];

export const STEER_INIT = [
  'legion-steer',
  'init',
  '--targets',
  'agents',
  '--lint',
  'npm run lint',
];

export const STEER_CHECK = [
  'legion-steer',
  'check',
  '--targets',
  'agents',
  '--lint',
  'npm run lint',
];

export interface SetupOptions {
  arm: Arm;
  runDir: string;
  kitDir: string;
  repoDir: string;
  toolkit: string | null;
  install: boolean;
  kitCommit: string | null;
  kitDirty: boolean | null;
  log: (line: string) => void;
}

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T;

const writeJson = (path: string, value: unknown): void => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const sh = (command: string, args: string[], cwd: string): void => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}`);
  }
};

const applyProse = (kitDir: string, workspace: string): void => {
  copyFileSync(
    join(kitDir, 'arms', 'prose', 'CLAUDE.md'),
    join(workspace, 'CLAUDE.md'),
  );
};

const packCheckout = (repoDir: string, outDir: string): ToolkitPlan => {
  const missing = BUILD_OUTPUTS.filter(
    (output) => !existsSync(join(repoDir, output)),
  );
  if (missing.length > 0) {
    throw new Error(
      `the checkout is not built (missing ${missing.join(', ')}); run pnpm install && pnpm build in ${repoDir}, or pass --toolkit <npm version>`,
    );
  }
  mkdirSync(outDir, { recursive: true });
  sh('pnpm', packArgs(outDir), repoDir);
  const tarballs = Object.fromEntries(
    readdirSync(outDir)
      .filter((file) => file.endsWith('.tgz'))
      .map((file) => [file.replace(/\.tgz$/, ''), join(outDir, file)]),
  );
  return checkoutPlan(tarballs);
};

const planToolkit = (options: SetupOptions, runDir: string): ToolkitPlan => {
  if (options.toolkit !== null) return npmPlan(options.toolkit);
  return packCheckout(options.repoDir, join(runDir, 'toolkit'));
};

const installedSteer = (workspace: string): string | null => {
  const path = join(workspace, 'node_modules', 'legion-steer', 'package.json');
  if (!existsSync(path)) return null;
  return readJson<Manifest>(path).version ?? null;
};

const describeInstall = (
  plan: ToolkitPlan,
  workspace: string,
  options: SetupOptions,
): ToolkitInstall => {
  const install: ToolkitInstall = {
    source: plan.source,
    spec: plan.spec,
    legionSteer: installedSteer(workspace),
    commit: null,
    dirty: null,
  };
  if (plan.source === 'checkout') {
    install.commit = options.kitCommit;
    install.dirty = options.kitDirty;
  }
  return install;
};

const applySteered = (
  kitDir: string,
  workspace: string,
  toolkit: ToolkitPlan,
): void => {
  const armDir = join(kitDir, 'arms', 'steered');
  copyFileSync(join(armDir, 'CLAUDE.md'), join(workspace, 'CLAUDE.md'));
  copyFileSync(
    join(armDir, 'oxlintrc.json'),
    join(workspace, '.oxlintrc.json'),
  );
  const manifestPath = join(workspace, 'package.json');
  writeJson(
    manifestPath,
    mergeManifest(
      readJson<Manifest>(manifestPath),
      readJson<Manifest>(join(armDir, 'package.overlay.json')),
      toolkit,
    ),
  );
};

const steer = (workspace: string): void => {
  sh('npx', ['--no-install', ...STEER_INIT], workspace);
  sh('npx', ['--no-install', ...STEER_CHECK], workspace);
  const settings = readFileSync(
    join(workspace, '.claude', 'settings.json'),
    'utf8',
  );
  if (!settings.includes('legion-steer hook')) {
    throw new Error('legion-steer init did not register its hook');
  }
};

const commitBaseline = (workspace: string): void => {
  const identity = [
    '-c',
    'user.name=three-arm kit',
    '-c',
    'user.email=kit@example.invalid',
  ];
  sh('git', ['init', '--quiet'], workspace);
  sh('git', ['add', '--all'], workspace);
  sh(
    'git',
    [...identity, 'commit', '--quiet', '--message', 'arm baseline'],
    workspace,
  );
};

export const setupRun = (options: SetupOptions): RunMeta => {
  const runDir = resolve(options.runDir);
  const workspace = join(runDir, 'workspace');
  if (existsSync(workspace)) {
    throw new Error(`${workspace} already exists; pick a fresh --run-dir`);
  }
  if (options.arm === 'steered' && !options.install) {
    throw new Error('the steered arm needs the install to run legion-steer');
  }
  mkdirSync(join(runDir, 'results'), { recursive: true });
  copySource(join(options.kitDir, 'template'), workspace);
  options.log(`copied the template into ${workspace}`);
  if (options.arm === 'prose') applyProse(options.kitDir, workspace);
  let plan: ToolkitPlan | null = null;
  if (options.arm === 'steered') {
    plan = planToolkit(options, runDir);
    applySteered(options.kitDir, workspace, plan);
  }
  if (options.install) {
    sh('npm', ['install', '--no-audit', '--no-fund'], workspace);
  }
  if (options.arm === 'steered') steer(workspace);
  commitBaseline(workspace);
  let toolkit: ToolkitInstall | null = null;
  if (plan !== null) toolkit = describeInstall(plan, workspace, options);
  const meta: RunMeta = {
    schema: 1,
    arm: options.arm,
    runId: basename(runDir),
    workspace,
    createdAt: new Date().toISOString(),
    kitCommit: options.kitCommit,
    kitDirty: options.kitDirty,
    toolkit,
  };
  writeJson(join(runDir, 'run.json'), meta);
  writeJson(join(runDir, 'baseline.json'), hashGuards(workspace));
  options.log(`${options.arm} arm ready in ${workspace}`);
  return meta;
};
