import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const manager = process.argv[2] ?? '';
const MANAGERS = new Set(['yarn', 'npm', 'pnpm']);
if (!MANAGERS.has(manager)) {
  console.error('usage: node scripts/consumer-smoke.ts <yarn|npm|pnpm>');
  process.exit(2);
}

const root = resolve(import.meta.dirname, '..');
const work = join(tmpdir(), `legion-smoke-${manager}-${process.pid}`);
const tarballs = join(work, 'tarballs');
const app = join(work, 'app');
const env = { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' };

const sh = (
  file: string,
  args: string[],
  cwd: string,
  allowFailure = false,
) => {
  const result = spawnSync(file, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0 && !allowFailure) {
    console.error(`${file} ${args.join(' ')} failed in ${cwd}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
  return result;
};

rmSync(work, { recursive: true, force: true });
mkdirSync(tarballs, { recursive: true });
cpSync(resolve(root, 'fixtures', 'consumer'), app, { recursive: true });
renameSync(join(app, 'oxlintrc.template.json'), join(app, '.oxlintrc.json'));

sh(
  'yarn',
  [
    'workspaces',
    'foreach',
    '-A',
    '--no-private',
    'pack',
    '--out',
    join(tarballs, '%s.tgz'),
  ],
  root,
);

const packed = Object.fromEntries(
  readdirSync(tarballs)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => [name.replace(/\.tgz$/, ''), join(tarballs, name)]),
);

interface ConsumerManifest {
  devDependencies?: Record<string, string>;
  resolutions?: Record<string, string>;
  overrides?: Record<string, string>;
  packageManager?: string;
}

const rootPackageJson = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8'),
);
const oxlintVersion = String(rootPackageJson.devDependencies.oxlint);

const packageJson = JSON.parse(
  readFileSync(join(app, 'package.json'), 'utf8'),
) as ConsumerManifest;
const fileSpecs = Object.fromEntries(
  Object.entries(packed).map(([name, path]) => [name, `file:${path}`]),
);
packageJson.devDependencies = {
  ...fileSpecs,
  oxlint: oxlintVersion,
  eslint: '10.10.0',
  '@typescript-eslint/parser': '8.69.0',
  prettier: '3.9.6',
  typescript: '6.0.3',
};
if (manager === 'yarn') {
  packageJson.resolutions = fileSpecs;
  packageJson.packageManager = 'yarn@4.18.0';
  writeFileSync(
    join(app, '.yarnrc.yml'),
    'nodeLinker: node-modules\nenableTelemetry: false\n',
  );
}
if (manager === 'npm') packageJson.overrides = fileSpecs;
if (manager === 'pnpm') {
  packageJson.packageManager = 'pnpm@12.3.4';
  const overrides = Object.entries(fileSpecs)
    .map(([name, spec]) => `  ${name}: '${spec}'`)
    .join('\n');
  writeFileSync(join(app, 'pnpm-workspace.yaml'), `overrides:\n${overrides}\n`);
}
writeFileSync(
  join(app, 'package.json'),
  `${JSON.stringify(packageJson, null, 2)}\n`,
);

const installArgs: Record<string, string[]> = {
  yarn: ['install', '--no-immutable'],
  npm: ['install', '--no-audit', '--no-fund'],
  pnpm: ['install'],
};
sh(manager, installArgs[manager] ?? ['install'], app);

const runScript = (script: string) => {
  if (manager === 'npm')
    return sh('npm', ['run', script, '--silent'], app, true);
  return sh(manager, ['run', script], app, true);
};

const lint = runScript('lint');
const eslint = runScript('lint:eslint');
const audit = runScript('audit');

const expectFinding = (output: string, needle: string): void => {
  if (!output.includes(needle)) {
    console.error(
      `expected "${needle}" in output under ${manager}:\n${output}`,
    );
    process.exit(1);
  }
};

expectFinding(lint.stdout + lint.stderr, 'no-enum');
expectFinding(lint.stdout + lint.stderr, 'no-function-keyword');
expectFinding(eslint.stdout + eslint.stderr, 'legion/no-enum');
if (audit.status !== 0) {
  console.error(
    `legion-audit failed under ${manager}:\n${audit.stdout}\n${audit.stderr}`,
  );
  process.exit(1);
}
const report = readFileSync(join(app, 'AUDIT.md'), 'utf8');
expectFinding(report, 'legion/no-enum');
expectFinding(report, '## Gates');
if (!existsSync(join(app, 'audit.json'))) {
  console.error('audit.json was not written');
  process.exit(1);
}
console.log(
  `consumer smoke under ${manager}: plugin ran under oxlint and ESLint, legion-audit wrote a report`,
);
rmSync(work, { recursive: true, force: true });
