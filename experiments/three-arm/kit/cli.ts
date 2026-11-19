import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { HELP, parseKitArgs, required } from './args.ts';
import type { KitArgs } from './args.ts';
import { collectRun, loadRecords } from './collect.ts';
import { inheritedInstructions, userConfigWarnings } from './isolation.ts';
import type { RunMeta } from './record.ts';
import { runSteps } from './runner.ts';
import { setupRun } from './setup.ts';
import { renderSummary } from './summary.ts';

const KIT_DIR = resolve(import.meta.dirname, '..');
const REPO_DIR = resolve(KIT_DIR, '..', '..');
const DEFAULT_CONFIG_DIR = join(homedir(), '.claude');

const log = (line: string): void => {
  console.error(`three-arm: ${line}`);
};

const configDir = (): string =>
  process.env['CLAUDE_CONFIG_DIR'] ?? DEFAULT_CONFIG_DIR;

const readOrNull = (path: string): string | null => {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
};

const kitCommit = (): string | null => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_DIR,
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return result.stdout.trim();
};

const userLevelFiles = (): string[] =>
  [DEFAULT_CONFIG_DIR, configDir()].flatMap((directory) => [
    join(directory, 'settings.json'),
    join(directory, 'settings.local.json'),
    join(directory, 'CLAUDE.md'),
  ]);

const checkIsolation = (runDir: string): void => {
  const inherited = inheritedInstructions(runDir, existsSync, userLevelFiles());
  if (inherited.length > 0) {
    throw new Error(
      `the run directory would inherit agent instructions:\n  ${inherited.join('\n  ')}\nPick a --run-dir with none of these above it, such as one under /tmp.`,
    );
  }
  for (const warning of userConfigWarnings(configDir(), readOrNull)) {
    log(`warning: ${warning}`);
  }
};

const runSetup = (args: KitArgs): number => {
  const runDir = resolve(required(args.runDir, '--run-dir'));
  checkIsolation(runDir);
  setupRun({
    arm: required(args.arm, '--arm'),
    runDir,
    kitDir: KIT_DIR,
    toolkit: args.toolkit,
    install: args.install,
    kitCommit: kitCommit(),
    log,
  });
  return 0;
};

const runRun = (args: KitArgs): number => {
  const runDir = resolve(required(args.runDir, '--run-dir'));
  const meta = JSON.parse(
    readFileSync(join(runDir, 'run.json'), 'utf8'),
  ) as RunMeta;
  const finished = runSteps(meta, {
    runDir,
    kitDir: KIT_DIR,
    repoDir: REPO_DIR,
    model: required(args.model, '--model'),
    permissionMode: args.permissionMode,
    from: args.from,
    log,
  });
  if (finished) return 0;
  return 1;
};

const runCollect = (args: KitArgs): number => {
  const runDir = resolve(required(args.runDir, '--run-dir'));
  const record = collectRun({
    runDir,
    kitDir: KIT_DIR,
    repoDir: REPO_DIR,
    configDir: configDir(),
    acceptance: args.acceptance,
    log,
  });
  if (record.auditError !== null) log(record.auditError);
  log(`wrote ${join(runDir, 'collected.json')}`);
  return 0;
};

const runSummarize = (args: KitArgs): number => {
  const runsDir = resolve(required(args.runsDir, '--runs-dir'));
  const records = loadRecords(runsDir);
  const summary = renderSummary(records);
  writeFileSync(join(runsDir, 'summary.md'), summary);
  writeFileSync(
    join(runsDir, 'summary.json'),
    `${JSON.stringify(records, null, 2)}\n`,
  );
  console.log(summary);
  log(
    `${records.length} run(s) summarized into ${join(runsDir, 'summary.md')}`,
  );
  return 0;
};

const COMMANDS: Record<KitArgs['command'], (args: KitArgs) => number> = {
  setup: runSetup,
  run: runRun,
  collect: runCollect,
  summarize: runSummarize,
  help: () => {
    console.log(HELP);
    return 0;
  },
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const main = (): number => {
  try {
    const args = parseKitArgs(process.argv.slice(2));
    return COMMANDS[args.command](args);
  } catch (error) {
    log(getErrorMessage(error));
    return 2;
  }
};

process.exitCode = main();
