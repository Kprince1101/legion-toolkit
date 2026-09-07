const PRESET_NAMES = new Set(['recommended', 'strict', 'reactNative']);

export interface SteerArgs {
  command: 'init' | 'check' | 'hook' | 'help';
  root: string;
  preset: string;
  targets: string[];
  lint: string;
  hooks: boolean;
}

export const takeValue = (
  argv: string[],
  index: number,
  flag: string,
): string => {
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
    else if (arg === '--no-hooks') args.hooks = false;
    else if (arg === '--root') {
      args.root = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--preset') {
      const value = takeValue(argv, index, arg);
      if (!PRESET_NAMES.has(value)) {
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
