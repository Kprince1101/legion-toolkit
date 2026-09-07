export type FailOn = 'regression' | 'error' | 'never';

export interface CliArgs {
  command: 'audit' | 'directives' | 'advice' | 'suppress' | 'help';
  root: string;
  md: string | null;
  json: string | null;
  baseline: string | null;
  failOn: FailOn | null;
  depsAudit: boolean;
  runTests: boolean;
  runTypecheck: boolean;
  runFormat: boolean;
  runExpoDoctor: boolean;
  dryRun: boolean;
  annotations: boolean;
  quiet: boolean;
  ignore: string[];
}

const FAIL_ON_VALUES = new Set<FailOn>(['regression', 'error', 'never']);

const takeValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} needs a value`);
  }
  return value;
};

export const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = {
    command: 'audit',
    root: process.cwd(),
    md: null,
    json: null,
    baseline: null,
    failOn: null,
    depsAudit: true,
    runTests: true,
    runTypecheck: true,
    runFormat: true,
    runExpoDoctor: true,
    dryRun: false,
    annotations: false,
    quiet: false,
    ignore: [],
  };
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index] ?? '';
    if (arg === 'directives') args.command = 'directives';
    else if (arg === 'advice') args.command = 'advice';
    else if (arg === 'suppress') args.command = 'suppress';
    else if (arg === 'help' || arg === '--help' || arg === '-h')
      args.command = 'help';
    else if (arg === '--root') {
      args.root = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--md') {
      args.md = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--json') {
      args.json = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--baseline') {
      args.baseline = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--fail-on') {
      const value = takeValue(argv, index, arg);
      if (!FAIL_ON_VALUES.has(value as FailOn)) {
        throw new Error(`--fail-on must be one of regression, error, never`);
      }
      args.failOn = value as FailOn;
      index += 1;
    } else if (arg === '--ignore') {
      args.ignore.push(takeValue(argv, index, arg));
      index += 1;
    } else if (arg === '--no-deps-audit') args.depsAudit = false;
    else if (arg === '--no-tests') args.runTests = false;
    else if (arg === '--no-typecheck') args.runTypecheck = false;
    else if (arg === '--no-format') args.runFormat = false;
    else if (arg === '--no-expo-doctor') args.runExpoDoctor = false;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--annotations') args.annotations = true;
    else if (arg === '--quiet' || arg === '-q') args.quiet = true;
    else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  return args;
};

export const HELP = `legion-audit [directives] [options]

Runs a read-only scorecard of the current repo against LEGION-STANDARDS.

Commands
  (none)        full audit: gates, rule counts, bypasses, PR hygiene, tests by file
  directives    only scan for file-wide lint disables; exit 1 if any (fast, for lint scripts)
  advice        the nudges only, printed for a human; never fails the build
  suppress      record today's legion/* findings as accepted, so --fail-on error
                only fails on new ones. Use --dry-run to preview the count.

Options
  --root <dir>            repo root (default: cwd)
  --md <file>             write the markdown report (default: print to stdout)
  --json <file>           write the JSON report
  --baseline <file>       compare against a previous JSON report
  --fail-on <mode>        regression | error | never
                          default: regression when --baseline is given, otherwise never
  --ignore <path>         skip a directory for the directive scan and tests-by-file (repeatable)
  --no-deps-audit         skip the dependency audit (needs registry access)
  --no-tests              skip running the test script
  --no-typecheck          skip tsc
  --no-format             skip prettier --check
  --no-expo-doctor        skip expo-doctor on an Expo project
  --annotations           also print GitHub Actions annotations, so findings
                          land inline on the pull request diff
  --quiet, -q             no progress output on stderr
`;
