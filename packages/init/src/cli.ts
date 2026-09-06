#!/usr/bin/env node
import { resolve } from 'node:path';
import { applyPlan } from './apply.js';
import { detect } from './detect.js';
import { buildPlan } from './plan.js';
import { renderPlan } from './report.js';
import type { InitOptions, Linter, Preset } from './types.js';

const PRESETS = new Set<Preset>(['recommended', 'strict', 'reactNative']);
const LINTERS = new Set<Linter>(['oxlint', 'eslint']);

export const HELP = `legion-toolkit init [options]

Wires the Legion toolkit into this repo: lint config, Prettier, tsconfig and
the audit script. Detects the package manager, framework and linter, never
overwrites an existing file, and prints the plan before writing anything.

Options
  --root <dir>       repo root (default: cwd)
  --preset <name>    recommended | strict | reactNative (default: detected)
  --linter <name>    oxlint | eslint (default: detected, oxlint for a new repo)
  --yes, -y          take the plan without prompting (for CI and agents)
  --dry-run          print the plan and stop
  --help, -h         this text
`;

const takeValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} needs a value`);
  }
  return value;
};

export const parseInitArgs = (
  argv: string[],
): InitOptions & { help: boolean } => {
  const options: InitOptions & { help: boolean } = {
    root: process.cwd(),
    yes: false,
    dryRun: false,
    preset: null,
    linter: null,
    help: false,
  };
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index] ?? '';
    if (arg === 'init') {
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--root') {
      options.root = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--preset') {
      const value = takeValue(argv, index, arg) as Preset;
      if (!PRESETS.has(value)) {
        throw new Error('--preset must be recommended, strict or reactNative');
      }
      options.preset = value;
      index += 1;
    } else if (arg === '--linter') {
      const value = takeValue(argv, index, arg) as Linter;
      if (!LINTERS.has(value))
        throw new Error('--linter must be oxlint or eslint');
      options.linter = value;
      index += 1;
    } else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  return options;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const run = (options: InitOptions): number => {
  const root = resolve(options.root);
  const detected = detect(root);
  const detection = {
    ...detected,
    linter: options.linter ?? detected.linter,
    preset: options.preset ?? detected.preset,
  };
  const plan = buildPlan(detection, detection.preset);
  console.log(renderPlan(plan));
  if (options.dryRun) {
    console.log('Dry run, nothing written.\n');
    return 0;
  }
  if (!options.yes) {
    console.log(
      'Re-run with --yes to apply this plan, or --dry-run to keep looking.\n',
    );
    return 0;
  }
  let written: string[];
  try {
    written = applyPlan(plan);
  } catch (error) {
    console.error(`legion-toolkit init: ${getErrorMessage(error)}`);
    console.error('Nothing was written.');
    return 1;
  }
  if (written.length === 0) {
    console.log('Nothing to write; this repo is already wired.\n');
    return 0;
  }
  const manual = plan.actions.filter((action) => action.kind === 'manual');
  console.log(`Wrote ${[...new Set(written)].join(', ')}.`);
  for (const action of manual) {
    console.log(`Still yours to do in ${action.path}: ${action.reason}`);
  }
  console.log(`Next: ${plan.install.join(' && ')}\n`);
  return 0;
};

const main = (): number => {
  let options: InitOptions & { help: boolean };
  try {
    options = parseInitArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`legion-toolkit init: ${getErrorMessage(error)}`);
    console.error(HELP);
    return 2;
  }
  if (options.help) {
    console.log(HELP);
    return 0;
  }
  return run(options);
};

process.exitCode = main();
