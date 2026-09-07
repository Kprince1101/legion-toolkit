#!/usr/bin/env node
import { resolve } from 'node:path';
import {
  COMPONENT_LINE_CAP,
  reactNative,
  recommended,
  strict,
} from 'legion-rules';
import type { LegionConfig } from 'legion-rules';
import { renderBlock } from './block.js';
import { evaluate, parsePayload, renderFindings } from './hook.js';
import { registerHooks } from './settings.js';
import { checkManagedBlock, writeManagedBlock } from './managed.js';
import { resolveTargets } from './targets.js';

const PRESETS: Record<string, LegionConfig> = {
  recommended,
  strict,
  reactNative,
};

export const HELP = `legion-steer <init|check> [options]

Writes a managed block into your agent instruction files, generated from the
rules this repo actually enforces. A rule the config does not enforce cannot
appear in the block, so the steering cannot drift from the enforcement.

Commands
  init      write or refresh the block, and register the Claude Code hooks
  check     exit 1 if the block is missing or out of date (for CI)
  hook      the hook handler itself; reads the hook payload on stdin

Options
  --root <dir>        repo root (default: cwd)
  --preset <name>     recommended | strict | reactNative (default: recommended)
  --targets <ids>     comma separated: agents,junie,cursor,copilot
                      (default: whichever are already present)
  --lint <command>    the lint command to name in the block
  --no-hooks          skip registering hooks in .claude/settings.json
  --help, -h          this text
`;

interface SteerArgs {
  command: 'init' | 'check' | 'hook' | 'help';
  root: string;
  preset: string;
  targets: string[];
  lint: string;
  hooks: boolean;
}

const takeValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} needs a value`);
  }
  return value;
};

export const parseSteerArgs = (argv: string[]): SteerArgs => {
  const args: SteerArgs = {
    command: 'help',
    root: process.cwd(),
    preset: 'recommended',
    targets: [],
    lint: 'yarn lint',
    hooks: true,
  };
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index] ?? '';
    if (arg === 'init') args.command = 'init';
    else if (arg === 'check') args.command = 'check';
    else if (arg === 'hook') args.command = 'hook';
    else if (arg === '--help' || arg === '-h') args.command = 'help';
    else if (arg === '--root') {
      args.root = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--preset') {
      const value = takeValue(argv, index, arg);
      if (!PRESETS[value]) {
        throw new Error('--preset must be recommended, strict or reactNative');
      }
      args.preset = value;
      index += 1;
    } else if (arg === '--targets') {
      args.targets = takeValue(argv, index, arg).split(',').filter(Boolean);
      index += 1;
    } else if (arg === '--lint') {
      args.lint = takeValue(argv, index, arg);
      index += 1;
    } else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  return args;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const componentCapOf = (config: LegionConfig): number | false => {
  if (config.levels['max-lines'] === undefined) return false;
  return COMPONENT_LINE_CAP;
};

const blockFor = (args: SteerArgs): string => {
  const config = PRESETS[args.preset] as LegionConfig;
  return renderBlock({
    config,
    lintCommand: args.lint,
    componentCap: componentCapOf(config),
  });
};

const runInit = (args: SteerArgs): number => {
  const root = resolve(args.root);
  const block = blockFor(args);
  const targets = resolveTargets(root, args.targets);
  for (const target of targets) {
    const result = writeManagedBlock(root, target.file, block);
    console.log(`  ${result.outcome.padEnd(9)} ${result.path}`);
  }
  if (args.hooks) {
    const added = registerHooks(root);
    for (const entry of added) console.log(`  hook      ${entry}`);
  }
  console.log(
    `\nSteered ${targets.length} file(s) from the ${args.preset} preset.`,
  );
  return 0;
};

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

const runHook = async (args: SteerArgs): Promise<number> => {
  const payload = parsePayload(await readStdin());
  const verdict = evaluate(resolve(args.root), payload);
  if (verdict.action === 'allow') return 0;
  console.error(`legion-steer: ${verdict.reason}`);
  console.error(renderFindings(verdict.findings));
  console.error(
    'Move the logic into a use<Component> hook or lib/, then write the file again.',
  );
  return 2;
};

const runCheck = (args: SteerArgs): number => {
  const root = resolve(args.root);
  const block = blockFor(args);
  const targets = resolveTargets(root, args.targets);
  const drifted = targets.filter(
    (target) => !checkManagedBlock(root, target.file, block),
  );
  if (drifted.length === 0) {
    console.log(`legion-steer: ${targets.length} file(s) up to date`);
    return 0;
  }
  console.error('legion-steer: the steering block is missing or out of date');
  for (const target of drifted) console.error(`  ${target.file}`);
  console.error('Run `legion-steer init` to regenerate.');
  return 1;
};

const main = async (): Promise<number> => {
  let args: SteerArgs;
  try {
    args = parseSteerArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`legion-steer: ${getErrorMessage(error)}`);
    console.error(HELP);
    return 2;
  }
  if (args.command === 'help') {
    console.log(HELP);
    return 0;
  }
  if (args.command === 'check') return runCheck(args);
  if (args.command === 'hook') return runHook(args);
  return runInit(args);
};

process.exitCode = await main();
