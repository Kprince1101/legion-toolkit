import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packagesDir = resolve(root, 'packages');

if (process.env.GITHUB_ACTIONS !== 'true') {
  console.error('publish.ts runs only inside the release workflow');
  process.exit(1);
}

const publishedVersion = (name: string): string | null => {
  const result = spawnSync('npm', ['view', name, 'version'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return result.stdout.trim();
};

const order = [
  'tsconfig',
  'prettier-config',
  'rules',
  'eslint-plugin',
  'audit',
  'toolkit',
];
const dirs = readdirSync(packagesDir).filter((entry) =>
  existsSync(resolve(packagesDir, entry, 'package.json')),
);
const sorted = [...dirs].sort((a, b) => order.indexOf(a) - order.indexOf(b));

let published = 0;
for (const dir of sorted) {
  const pkg = JSON.parse(
    readFileSync(resolve(packagesDir, dir, 'package.json'), 'utf8'),
  ) as { name: string; version: string; private?: boolean };
  if (pkg.private) continue;
  if (publishedVersion(pkg.name) === pkg.version) {
    console.log(`${pkg.name}@${pkg.version} is already on npm`);
    continue;
  }
  const tarball = resolve(tmpdir(), `${pkg.name}-${pkg.version}.tgz`);
  const pack = spawnSync('yarn', ['pack', '--out', tarball], {
    cwd: resolve(packagesDir, dir),
    stdio: 'inherit',
    env: process.env,
  });
  if (pack.status !== 0) process.exit(pack.status ?? 1);
  const publish = spawnSync(
    'npm',
    ['publish', tarball, '--access', 'public', '--provenance'],
    {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    },
  );
  if (publish.status !== 0) process.exit(publish.status ?? 1);
  published += 1;
}
console.log(`published ${published} package(s)`);
