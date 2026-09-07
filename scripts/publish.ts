import { spawnSync } from 'node:child_process';
import {
  readdirSync,
  readFileSync,
  existsSync,
  appendFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packagesDir = resolve(root, 'packages');

if (process.env.GITHUB_ACTIONS !== 'true') {
  console.error('publish.ts runs only inside the release workflow');
  process.exit(1);
}

const hasToken = (): boolean => (process.env.NODE_AUTH_TOKEN ?? '').length > 0;

const hasOidc = (): boolean =>
  (process.env.ACTIONS_ID_TOKEN_REQUEST_URL ?? '').length > 0;

const assertAuthenticated = (): void => {
  if (!hasToken() && hasOidc()) {
    console.log(
      'no NODE_AUTH_TOKEN and OIDC is available; publishing via npm trusted publishing',
    );
    return;
  }
  const result = spawnSync('npm', ['whoami'], { encoding: 'utf8' });
  if (result.status === 0) {
    console.log(`npm authenticated as ${result.stdout.trim()}`);
    return;
  }
  console.error('npm is not authenticated, so nothing was published.');
  if (hasToken()) {
    console.error(
      'NODE_AUTH_TOKEN is set but npm rejected it. The token is expired, revoked, or lacks publish rights.',
    );
  } else {
    console.error(
      'NODE_AUTH_TOKEN is empty and no OIDC token endpoint is available. Set the NPM_TOKEN secret, or configure trusted publishing and grant id-token: write.',
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

const packageTag = (pkg: { name: string; version: string }): string =>
  `${pkg.name}@${pkg.version}`;

const localGitTagExists = (tag: string): boolean => {
  const result = spawnSync(
    'git',
    ['rev-parse', '-q', '--verify', `refs/tags/${tag}`],
    {
      cwd: root,
      stdio: 'pipe',
    },
  );
  return result.status === 0;
};

const createLocalGitTag = (tag: string): void => {
  const result = spawnSync('git', ['tag', tag], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const appendChangesetsGitTagEvent = (
  pkg: { name: string },
  tag: string,
): void => {
  const outputPath = process.env.CHANGESETS_OUTPUT;
  if (!outputPath) return;
  const event = { type: 'git-tag' as const, tag, packageName: pkg.name };
  appendFileSync(outputPath, `${JSON.stringify(event)}\n`, 'utf8');
};

const recordReleasedPackage = (pkg: {
  name: string;
  version: string;
}): void => {
  const tag = packageTag(pkg);
  if (localGitTagExists(tag)) {
    console.log(`${tag} is already tagged and released; leaving it alone`);
    return;
  }
  createLocalGitTag(tag);
  appendChangesetsGitTagEvent(pkg, tag);
};

const initializeChangesetsOutputFileSoAnEmptyRunStillReadsCleanly =
  (): void => {
    const outputPath = process.env.CHANGESETS_OUTPUT;
    if (!outputPath) return;
    writeFileSync(outputPath, '', 'utf8');
  };

assertAuthenticated();
initializeChangesetsOutputFileSoAnEmptyRunStillReadsCleanly();

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
    recordReleasedPackage(pkg);
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
  recordReleasedPackage(pkg);
  published += 1;
}
console.log(`published ${published} package(s)`);
