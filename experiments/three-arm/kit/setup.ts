import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { Arm } from './arms.ts';
import { hashGuards } from './guards.ts';
import type { RunMeta } from './record.ts';
import { copySource } from './tree.ts';

export interface Manifest {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export const mergeManifest = (
  base: Manifest,
  overlay: Manifest,
  toolkit: string | null,
): Manifest => {
  const devDependencies = {
    ...base.devDependencies,
    ...overlay.devDependencies,
  };
  if (toolkit !== null) devDependencies['legion-toolkit'] = toolkit;
  return {
    ...base,
    scripts: { ...base.scripts, ...overlay.scripts },
    devDependencies,
  };
};

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
  toolkit: string | null;
  install: boolean;
  kitCommit: string | null;
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

const applySteered = (
  kitDir: string,
  workspace: string,
  toolkit: string | null,
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
  if (options.arm === 'steered') {
    applySteered(options.kitDir, workspace, options.toolkit);
  }
  if (options.install) {
    sh('npm', ['install', '--no-audit', '--no-fund'], workspace);
  }
  if (options.arm === 'steered') steer(workspace);
  commitBaseline(workspace);
  const manifest = readJson<Manifest>(join(workspace, 'package.json'));
  const meta: RunMeta = {
    schema: 1,
    arm: options.arm,
    runId: basename(runDir),
    workspace,
    createdAt: new Date().toISOString(),
    kitCommit: options.kitCommit,
    toolkit: manifest.devDependencies?.['legion-toolkit'] ?? null,
  };
  writeJson(join(runDir, 'run.json'), meta);
  writeJson(join(runDir, 'baseline.json'), hashGuards(workspace));
  options.log(`${options.arm} arm ready in ${workspace}`);
  return meta;
};
