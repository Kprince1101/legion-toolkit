import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packagesDir = resolve(root, 'packages');
const rootLicense = readFileSync(resolve(root, 'LICENSE'), 'utf8');

const REQUIRED_FIELDS = [
  'name',
  'version',
  'description',
  'license',
  'author',
  'homepage',
  'repository',
  'bugs',
  'keywords',
  'files',
  'publishConfig',
  'engines',
];

interface PackageManifest {
  [field: string]: unknown;
  license?: string;
  author?: string;
  publishConfig?: { access?: string; registry?: string };
  repository?: { directory?: string };
  files?: string[];
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
}

const failures: string[] = [];

for (const entry of readdirSync(packagesDir)) {
  const dir = resolve(packagesDir, entry);
  const file = resolve(dir, 'package.json');
  if (!existsSync(file)) continue;
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as PackageManifest;
  const where = `packages/${entry}`;
  for (const field of REQUIRED_FIELDS) {
    if (pkg[field] === undefined) failures.push(`${where}: missing "${field}"`);
  }
  if (pkg.license !== 'MIT') failures.push(`${where}: license must be MIT`);
  if (pkg.author !== 'Veracium LLC') {
    failures.push(`${where}: author must be "Veracium LLC"`);
  }
  if (pkg.publishConfig?.access !== 'public') {
    failures.push(`${where}: publishConfig.access must be "public"`);
  }
  if (pkg.publishConfig?.registry !== 'https://registry.npmjs.org/') {
    failures.push(`${where}: publishConfig.registry must be npmjs`);
  }
  if (pkg.repository?.directory !== where) {
    failures.push(`${where}: repository.directory must be "${where}"`);
  }
  if (!pkg.files?.includes('LICENSE') || !pkg.files?.includes('README.md')) {
    failures.push(`${where}: files must include LICENSE and README.md`);
  }
  if (!existsSync(resolve(dir, 'README.md'))) {
    failures.push(`${where}: README.md is missing`);
  }
  const licensePath = resolve(dir, 'LICENSE');
  if (existsSync(licensePath)) {
    if (readFileSync(licensePath, 'utf8') !== rootLicense) {
      failures.push(`${where}: LICENSE differs from the root LICENSE`);
    }
  }
  for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
    if (!name.startsWith('legion-') && name !== 'eslint-plugin-legion') {
      failures.push(
        `${where}: runtime dependency "${name}@${range}" is not allowed (zero third-party deps)`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('package metadata: clean');
