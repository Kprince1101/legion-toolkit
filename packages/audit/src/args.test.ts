import { parseArgs } from './args.js';

describe('parseArgs', () => {
  it('defaults to a full audit in the cwd', () => {
    expect(parseArgs([])).toMatchObject({
      command: 'audit',
      md: null,
      json: null,
      failOn: null,
      depsAudit: true,
    });
  });

  it('reads the directives subcommand and flags', () => {
    expect(
      parseArgs([
        'directives',
        '--root',
        '/x',
        '--md',
        'A.md',
        '--json',
        'a.json',
        '--baseline',
        'b.json',
        '--fail-on',
        'error',
        '--no-deps-audit',
        '--no-tests',
        '-q',
        '--ignore',
        'fixtures',
      ]),
    ).toEqual({
      command: 'directives',
      root: '/x',
      md: 'A.md',
      json: 'a.json',
      baseline: 'b.json',
      failOn: 'error',
      depsAudit: false,
      runTests: false,
      runTypecheck: true,
      runFormat: true,
      runExpoDoctor: true,
      dryRun: false,
      annotations: false,
      quiet: true,
      ignore: ['fixtures'],
    });
  });

  it('rejects unknown arguments and bad values', () => {
    expect(() => parseArgs(['--wat'])).toThrow('unknown argument: --wat');
    expect(() => parseArgs(['--fail-on', 'sometimes'])).toThrow(
      '--fail-on must be one of',
    );
    expect(() => parseArgs(['--md'])).toThrow('--md needs a value');
  });
});

describe('parseArgs, advice command', () => {
  it('reads the advice command and the expo-doctor opt-out', () => {
    const args = parseArgs(['advice', '--no-expo-doctor']);
    expect(args.command).toBe('advice');
    expect(args.runExpoDoctor).toBe(false);
  });
});

describe('advice skips the slow gates', () => {
  it('leaves typecheck, tests, format and the dependency audit out of it', () => {
    const args = parseArgs(['advice']);
    expect(args.command).toBe('advice');
  });
});
