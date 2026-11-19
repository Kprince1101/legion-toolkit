import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCheckpoint, scoreWorkspace, scoringPaths } from './score.ts';

const REPO = process.cwd();
const KIT = join(REPO, 'experiments', 'three-arm');
const TOOLS = [
  join(REPO, 'node_modules', '.bin', 'legion-audit'),
  join(REPO, 'node_modules', '.bin', 'oxlint'),
  join(REPO, 'packages', 'audit', 'dist', 'cli.js'),
  join(REPO, 'packages', 'eslint-plugin', 'dist', 'index.js'),
  join(REPO, 'packages', 'toolkit', 'presets', 'recommended.json'),
];
const HAS_TOOLS = TOOLS.every((tool) => existsSync(tool));
const IN_CI = process.env['CI'] !== undefined;
const SLOW = 120_000;

const withTools = (name: string, body: () => void): void => {
  if (HAS_TOOLS) {
    describe(name, body);
    return;
  }
  if (IN_CI) {
    describe(name, () => {
      it('needs the built toolkit and oxlint, which CI must provide', () => {
        expect(TOOLS.filter((tool) => !existsSync(tool))).toEqual([]);
      });
    });
    return;
  }
  describe.skip(name, body);
};

const VIOLATIONS = [
  'export enum Status {',
  '  Open,',
  '}',
  '',
  'export function pick(value: any): number {',
  '  return value ? 1 : 2;',
  '}',
  '',
].join('\n');

withTools('scoring with the real legion-audit', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'three-arm-score-'));
    mkdirSync(join(root, 'workspace', 'app'), { recursive: true });
    writeFileSync(
      join(root, 'workspace', 'package.json'),
      '{"name":"habit-tracker","private":true}\n',
    );
    writeFileSync(join(root, 'workspace', 'app', 'pick.ts'), VIOLATIONS);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const score = (name: string) => {
    const out = join(root, `${name}.json`);
    const result = scoreWorkspace(
      scoringPaths(join(root, 'workspace'), root, KIT, REPO),
      out,
    );
    expect(result.error).toBeNull();
    return {
      lintErrors: result.summary?.lintErrors ?? -1,
      errors: readCheckpoint(out)?.errors ?? {},
    };
  };

  const ignoreEverything = '{"ignorePatterns":["**/*"]}\n';

  it(
    'ignores a nested .oxlintrc.json that ignores everything',
    () => {
      const before = score('before');
      expect(before.lintErrors).toBeGreaterThan(0);
      writeFileSync(
        join(root, 'workspace', 'app', '.oxlintrc.json'),
        ignoreEverything,
      );
      const after = score('after');
      expect(after.lintErrors).toBe(before.lintErrors);
      expect(after.errors['app/pick.ts']).toBe(before.errors['app/pick.ts']);
    },
    SLOW,
  );

  it(
    'ignores a top-level oxlint.config.ts',
    () => {
      const before = score('before');
      writeFileSync(
        join(root, 'workspace', 'oxlint.config.ts'),
        "export default { ignorePatterns: ['**/*'], rules: {} };\n",
      );
      const after = score('after');
      expect(after.lintErrors).toBe(before.lintErrors);
      expect(after.errors['app/pick.ts']).toBe(before.errors['app/pick.ts']);
    },
    SLOW,
  );
});
