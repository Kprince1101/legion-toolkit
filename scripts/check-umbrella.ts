import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packagesDir = resolve(root, 'packages');
const umbrellaDir = resolve(packagesDir, 'toolkit');

interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
  exports: Record<string, string | Record<string, string>>;
}

const readJson = (file: string): PackageJson =>
  JSON.parse(readFileSync(file, 'utf8')) as PackageJson;

const umbrella = readJson(resolve(umbrellaDir, 'package.json'));
const failures: string[] = [];

const workspacePackages = readdirSync(packagesDir)
  .filter((entry) => entry !== 'toolkit')
  .map((entry) => resolve(packagesDir, entry, 'package.json'))
  .filter((file) => existsSync(file))
  .map((file) => readJson(file));

const targetFiles = (target: string | Record<string, string>): string[] => {
  if (typeof target === 'string') return [target];
  return Object.values(target);
};

const exportTargets = new Set(
  Object.values(umbrella.exports).flatMap(targetFiles),
);

const readsExportFile = (file: string): string => {
  if (!existsSync(resolve(umbrellaDir, file))) return '';
  return readFileSync(resolve(umbrellaDir, file), 'utf8');
};

for (const pkg of workspacePackages) {
  const declared = umbrella.dependencies?.[pkg.name];
  if (!declared) {
    failures.push(`${pkg.name} is missing from legion-toolkit dependencies`);
  }
  const referenced = [...exportTargets].some((target) =>
    readsExportFile(target).includes(pkg.name),
  );
  const tsconfigLike = [...exportTargets].some(
    (target) =>
      target.startsWith('./tsconfig/') &&
      readsExportFile(target).includes(pkg.name),
  );
  if (!referenced && !tsconfigLike) {
    failures.push(
      `${pkg.name} is not re-exported by any legion-toolkit subpath`,
    );
  }
}

for (const [subpath, target] of Object.entries(umbrella.exports)) {
  for (const file of targetFiles(target)) {
    if (!existsSync(resolve(umbrellaDir, file))) {
      failures.push(
        `export ${subpath} points at ${file}, which does not exist`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  `legion-toolkit umbrella covers ${workspacePackages.length} packages`,
);
