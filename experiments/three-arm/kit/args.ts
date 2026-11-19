import { isArm } from './arms.ts';
import type { Arm } from './arms.ts';

export type Command = 'setup' | 'run' | 'collect' | 'summarize' | 'help';

export interface KitArgs {
  command: Command;
  arm: Arm | null;
  runDir: string | null;
  runsDir: string | null;
  model: string | null;
  from: string | null;
  toolkit: string | null;
  permissionMode: string;
  install: boolean;
  acceptance: boolean;
}

const COMMANDS = new Set<string>(['setup', 'run', 'collect', 'summarize']);

const isCommand = (value: string): value is Command => COMMANDS.has(value);

const takeValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} needs a value`);
  }
  return value;
};

const armFrom = (value: string): Arm => {
  if (!isArm(value))
    throw new Error('--arm must be one of raw, prose, steered');
  return value;
};

export const parseKitArgs = (argv: string[]): KitArgs => {
  const args: KitArgs = {
    command: 'help',
    arm: null,
    runDir: null,
    runsDir: null,
    model: null,
    from: null,
    toolkit: null,
    permissionMode: 'bypassPermissions',
    install: true,
    acceptance: true,
  };
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index] ?? '';
    if (index === 0 && isCommand(arg)) args.command = arg;
    else if (arg === '--help' || arg === '-h' || arg === 'help') {
      args.command = 'help';
    } else if (arg === '--arm') {
      args.arm = armFrom(takeValue(argv, index, arg));
      index += 1;
    } else if (arg === '--run-dir') {
      args.runDir = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--runs-dir') {
      args.runsDir = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--model') {
      args.model = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--from') {
      args.from = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--toolkit') {
      args.toolkit = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--permission-mode') {
      args.permissionMode = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--no-install') args.install = false;
    else if (arg === '--no-acceptance') args.acceptance = false;
    else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  return args;
};

export const required = <T>(value: T | null, flag: string): T => {
  if (value === null) throw new Error(`${flag} is required`);
  return value;
};

export const HELP = `node experiments/three-arm/kit/cli.ts <command> [options]

Commands
  setup       build one run's workspace for an arm
              --arm <raw|prose|steered> --run-dir <dir>
              [--toolkit <npm spec>] [--no-install]
  run         send every prompt in prompts/ to Claude Code, one session
              --run-dir <dir> --model <id>
              [--from <step>] [--permission-mode <mode>]
  collect     gather one run's numbers into <run-dir>/collected.json
              --run-dir <dir> [--no-acceptance]
  summarize   tabulate every collected run under a directory
              --runs-dir <dir>
`;
