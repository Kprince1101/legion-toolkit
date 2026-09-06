import type {
  Advice,
  ExpoDoctorResult,
  LockfileResult,
  Toolchain,
} from '../types.js';
import type { PackageManager } from '../types.js';

export const TARGET_YARN = 'yarn@4.18.0';

export const yarnMigrationSteps = (found: string[]): string[] => {
  const steps = ['corepack enable', 'yarn set version berry'];
  const stale = found.filter((name) => name !== 'yarn.lock');
  if (stale.length > 0) {
    steps.push(`rm -rf node_modules ${stale.join(' ')}`);
  }
  steps.push('yarn install');
  return steps;
};

const MANAGER_LABEL: Record<PackageManager, string> = {
  npm: 'npm',
  pnpm: 'pnpm',
  bun: 'bun',
  yarn: 'Yarn',
  unknown: 'no package manager',
};

const migrateFromOtherManager = (
  toolchain: Toolchain,
  lockfile: LockfileResult,
): Advice | null => {
  const { packageManager } = toolchain;
  if (packageManager === 'yarn') return null;
  if (packageManager === 'unknown') {
    return {
      id: 'no-lockfile',
      area: 'toolchain',
      title: 'No lockfile is committed.',
      why: 'Without a lockfile every install resolves fresh, so your machine and CI can end up on different versions of the same dependency and only one of them reproduces the bug.',
      fix: yarnMigrationSteps(lockfile.found),
      detail: ['Commit the yarn.lock that install produces.'],
    };
  }
  const label = MANAGER_LABEL[packageManager];
  return {
    id: 'migrate-to-yarn-berry',
    area: 'toolchain',
    title: `This repo runs on ${label}. Legion repos run on Yarn Berry.`,
    why: 'Berry writes a packageManager field into package.json, so Corepack pins the exact Yarn every machine and every CI runner uses. On npm or pnpm the version is whatever each person happens to have installed, which is how a lockfile that works locally fails in CI.',
    fix: yarnMigrationSteps(lockfile.found),
    detail: [
      `Current lockfile: ${lockfile.found.join(', ')}.`,
      'Delete it only after the yarn install succeeds and the app still builds.',
    ],
  };
};

const upgradeClassic = (toolchain: Toolchain): Advice | null => {
  if (toolchain.packageManager !== 'yarn') return null;
  if (toolchain.yarnFlavor !== 'classic') return null;
  return {
    id: 'yarn-classic',
    area: 'toolchain',
    title: 'This is Yarn 1 (Classic), which has been end-of-life since 2023.',
    why: 'Berry gives you the packageManager field for a pinned toolchain, real workspace protocol support, and a lockfile format that does not silently reresolve. Classic gets no more fixes.',
    fix: ['corepack enable', 'yarn set version berry', 'yarn install'],
    detail: [
      'Berry upgrades the v1 yarn.lock in place, so do not delete it first.',
      'Expect a large lockfile diff on the migration commit; that is the format change, not a dependency change.',
    ],
  };
};

const pinTheManager = (toolchain: Toolchain): Advice | null => {
  if (toolchain.packageManager !== 'yarn') return null;
  if (toolchain.yarnFlavor === 'classic') return null;
  if (toolchain.packageManagerField !== null) return null;
  return {
    id: 'no-package-manager-field',
    area: 'toolchain',
    title: 'package.json has no packageManager field.',
    why: 'The field is what makes Corepack install the exact Yarn this repo expects. Without it a new laptop or a CI image runs whatever Yarn it already had.',
    fix: [`npm pkg set packageManager=${TARGET_YARN}`, 'corepack enable'],
    detail: [],
  };
};

const mixedLockfiles = (lockfile: LockfileResult): Advice | null => {
  if (lockfile.status !== 'fail') return null;
  if (lockfile.found.length < 2) return null;
  return {
    id: 'mixed-lockfiles',
    area: 'toolchain',
    title: `Two lockfiles are committed: ${lockfile.found.join(' and ')}.`,
    why: 'Two lockfiles means two dependency trees. Whichever tool ran last wins on your machine, CI picks the other one, and the versions drift apart with nothing failing to tell you.',
    fix: yarnMigrationSteps(lockfile.found),
    detail: [
      'Keep yarn.lock. Delete the rest and never run npm install here again.',
    ],
  };
};

const adoptOxlint = (toolchain: Toolchain): Advice | null => {
  if (toolchain.hasOxlintConfig) return null;
  if (!toolchain.hasEslintConfig) return null;
  return {
    id: 'no-oxlint',
    area: 'toolchain',
    title: 'Linting runs on ESLint only.',
    why: 'oxlint runs the same Legion rules in a fraction of the time, which matters because a lint step slow enough to skip is a lint step people skip. The plugin is proven identical under both in CI, so this is a speed change and not a coverage change.',
    fix: [
      'yarn add -D oxlint',
      'add .oxlintrc.json with "jsPlugins": ["legion-toolkit/eslint-plugin"]',
      'point the lint script at oxlint .',
    ],
    detail: [
      'Keep the ESLint config for the type-aware rules oxlint does not run.',
    ],
  };
};

const wireThePlugin = (toolchain: Toolchain): Advice | null => {
  if (!toolchain.toolkitInstalled) return null;
  if (toolchain.pluginReferenced) return null;
  return {
    id: 'plugin-unwired',
    area: 'toolchain',
    title: 'legion-toolkit is installed but no lint config references it.',
    why: 'Installing the package runs nothing. Until a config names the plugin, every rule in this toolkit is off and the audit is scoring a repo no rule has ever looked at.',
    fix: [
      'oxlint: add "jsPlugins": ["legion-toolkit/eslint-plugin"] to .oxlintrc.json',
      'eslint: import plugin from "legion-toolkit/eslint-plugin" and spread plugin.configs.recommended',
    ],
    detail: [],
  };
};

const nativePreset = (toolchain: Toolchain): Advice | null => {
  if (
    toolchain.framework !== 'expo' &&
    toolchain.framework !== 'react-native'
  ) {
    return null;
  }
  if (!toolchain.pluginReferenced) return null;
  return {
    id: 'react-native-preset',
    area: 'toolchain',
    title: 'This is a React Native app. Check it is on the reactNative preset.',
    why: 'The web preset leaves two rules on that cannot fire here, and it scopes the service-role client check to components and hooks. On a device every file in the bundle is reachable, so that check has to cover all of them.',
    fix: ['import { reactNative } from "legion-toolkit/rules"'],
    detail: [
      'The preset turns off no-use-client-in-page and no-client-globals-in-state-init, and widens the admin-client check to every file.',
    ],
  };
};

const installDoctor = (
  toolchain: Toolchain,
  expo: ExpoDoctorResult,
): Advice | null => {
  if (toolchain.framework !== 'expo') return null;
  if (expo.installed) return null;
  return {
    id: 'no-expo-doctor',
    area: 'toolchain',
    title: 'This Expo project has no expo-doctor in its gates.',
    why: 'Most Expo breakage is a package on a version the installed SDK does not expect. Doctor catches that in seconds; without it you find out from a red build or a white screen on a device.',
    fix: ['yarn add -D expo-doctor'],
    detail: ['legion-audit runs it automatically once it is installed.'],
  };
};

const patchDrift = (expo: ExpoDoctorResult): Advice | null => {
  if (expo.patchDrift.length === 0) return null;
  return {
    id: 'expo-patch-drift',
    area: 'toolchain',
    title: `${expo.patchDrift.length} Expo package(s) are one patch behind.`,
    why: 'This is not blocking the build and it is deliberately not failing this gate. Expo ships patches faster than a project can consume them, and a gate that goes red for that teaches you to ignore gates. Pick it up on your schedule.',
    fix: ['yarn expo install --fix'],
    detail: expo.patchDrift.map(
      (row) => `${row.name}: expected ${row.expected}, found ${row.found}`,
    ),
  };
};

const compilerWithoutRule = (
  toolchain: Toolchain,
  memoFindings: number,
): Advice | null => {
  if (!toolchain.reactCompiler) return null;
  return {
    id: 'react-compiler-manual-memo',
    area: 'toolchain',
    title: 'The React Compiler is installed, but no-manual-memo is off.',
    why: 'The compiler memoizes for you, so every hand-written useMemo and useCallback is now a dependency array to keep correct for no benefit. A stale dep array is a real bug; no dep array cannot be one.',
    fix: ['set reactCompiler: true in defineLegionConfig'],
    detail: memoCountDetail(memoFindings),
  };
};

const memoCountDetail = (count: number): string[] => {
  if (count === 0) return [];
  return [
    `${count} useMemo/useCallback call(s) in this repo would be flagged.`,
  ];
};

const addPrettier = (toolchain: Toolchain): Advice | null => {
  if (toolchain.hasPrettierConfig) return null;
  return {
    id: 'no-prettier',
    area: 'toolchain',
    title: 'No Prettier config.',
    why: 'Formatting arguments in review are pure waste. One shared config means the diff only ever shows what actually changed.',
    fix: [
      'yarn add -D prettier',
      'npm pkg set prettier=legion-toolkit/prettier',
    ],
    detail: [],
  };
};

const addTsconfig = (toolchain: Toolchain): Advice | null => {
  if (toolchain.hasTsconfig) return null;
  return {
    id: 'no-tsconfig',
    area: 'toolchain',
    title: 'No tsconfig.json at this root.',
    why: 'Section 0.3 wants strict true explicitly. Without a tsconfig the typecheck gate is skipped entirely, so nothing here is type-checked at all.',
    fix: ['extend legion-toolkit/tsconfig/base.json'],
    detail: [],
  };
};

export const toolchainAdvice = (
  toolchain: Toolchain,
  lockfile: LockfileResult,
  expo: ExpoDoctorResult,
  memoFindings = 0,
): Advice[] => {
  const candidates = [
    mixedLockfiles(lockfile),
    migrateFromOtherManager(toolchain, lockfile),
    upgradeClassic(toolchain),
    pinTheManager(toolchain),
    wireThePlugin(toolchain),
    nativePreset(toolchain),
    installDoctor(toolchain, expo),
    patchDrift(expo),
    compilerWithoutRule(toolchain, memoFindings),
    adoptOxlint(toolchain),
    addPrettier(toolchain),
    addTsconfig(toolchain),
  ];
  return candidates.filter((entry): entry is Advice => entry !== null);
};
