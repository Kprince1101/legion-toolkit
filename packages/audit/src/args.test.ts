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
