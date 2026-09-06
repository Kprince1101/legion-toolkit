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

const assertAuthenticated = (): void => {
  if (process.env.LEGION_PUBLISH_OIDC === '1') {
    console.log('skipping the auth check; publishing via trusted publishing');
    return;
  }
  const result = spawnSync('npm', ['whoami'], { encoding: 'utf8' });
  if (result.status === 0) {
    console.log(`npm authenticated as ${result.stdout.trim()}`);
    return;
  }
  const hasToken = (process.env.NODE_AUTH_TOKEN ?? '').length > 0;
  console.error('npm is not authenticated, so nothing was published.');
  if (hasToken) {
    console.error(
      'NODE_AUTH_TOKEN is set but npm rejected it. The token is expired, revoked, or lacks publish rights.',
    );
  } else {
    console.error(
      'NODE_AUTH_TOKEN is empty. Set the NPM_TOKEN repository secret, or set LEGION_PUBLISH_OIDC=1 if these packages use npm trusted publishing.',
    );
  }
  console.error(
    'Without this check npm answers an unauthenticated publish with a 404 that reads as if the package does not exist.',
  );
  process.exit(1);
};

const publishedVersion = (name: string): string | null => {
  const result = spawnSync('npm', ['view', name, 'version'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return result.stdout.trim();
};

assertAuthenticated();

const order = [
  'tsconfig',
  'prettier-config',
  'rules',
  'eslint-plugin',
  'audit',
  'init',
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
