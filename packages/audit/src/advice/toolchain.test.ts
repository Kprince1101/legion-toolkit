import { toolchainAdvice, yarnMigrationSteps } from './toolchain.js';
import type { ExpoDoctorResult, LockfileResult, Toolchain } from '../types.js';

const toolchain = (overrides: Partial<Toolchain> = {}): Toolchain => ({
  packageManager: 'yarn',
  yarnFlavor: 'berry',
  packageManagerField: 'yarn@4.18.0',
  framework: 'next',
  workspaces: false,
  hasOxlintConfig: true,
  hasEslintConfig: false,
  hasOxlintBin: true,
  hasEslintBin: false,
  hasPrettierConfig: true,
  hasTsconfig: true,
  toolkitInstalled: true,
  pluginReferenced: true,
  workspaceRoot: '/repo',
  isWorkspacePackage: false,
  reactCompiler: false,
  scripts: {},
  ...overrides,
});

const lockfile = (
  found: string[],
  status: LockfileResult['status'] = 'pass',
): LockfileResult => ({
  status,
  found,
  packageManager: 'yarn',
});

const NO_EXPO: ExpoDoctorResult = {
  name: 'expo-doctor',
  status: 'skipped',
  summary: 'not an expo project',
  patchDrift: [],
  installed: false,
};

const ids = (entries: { id: string }[]): string[] =>
  entries.map((entry) => entry.id);

describe('yarnMigrationSteps', () => {
  it('removes the foreign lockfile before installing', () => {
    expect(yarnMigrationSteps(['package-lock.json'])).toEqual([
      'corepack enable',
      'yarn set version berry',
      'rm -rf node_modules package-lock.json',
      'yarn install',
    ]);
  });

  it('never deletes yarn.lock, because berry migrates it in place', () => {
    expect(yarnMigrationSteps(['yarn.lock'])).toEqual([
      'corepack enable',
      'yarn set version berry',
      'yarn install',
    ]);
  });

  it('removes every foreign lockfile when more than one is present', () => {
    const steps = yarnMigrationSteps([
      'yarn.lock',
      'package-lock.json',
      'pnpm-lock.yaml',
    ]);
    expect(steps).toContain(
      'rm -rf node_modules package-lock.json pnpm-lock.yaml',
    );
  });
});

describe('toolchainAdvice', () => {
  it('says nothing about a repo already set up the way Legion ships', () => {
    expect(
      toolchainAdvice(toolchain(), lockfile(['yarn.lock']), NO_EXPO),
    ).toEqual([]);
  });

  it('nudges an npm repo to yarn berry with its own lockfile named in the fix', () => {
    const advice = toolchainAdvice(
      toolchain({ packageManager: 'npm', yarnFlavor: 'none' }),
      lockfile(['package-lock.json']),
      NO_EXPO,
    );
    expect(ids(advice)).toContain('migrate-to-yarn-berry');
    const migrate = advice.find(
      (entry) => entry.id === 'migrate-to-yarn-berry',
    );
    expect(migrate?.fix).toContain('rm -rf node_modules package-lock.json');
    expect(migrate?.title).toContain('npm');
  });

  it('nudges yarn classic to berry without deleting the lockfile', () => {
    const advice = toolchainAdvice(
      toolchain({ yarnFlavor: 'classic', packageManagerField: null }),
      lockfile(['yarn.lock']),
      NO_EXPO,
    );
    const classic = advice.find((entry) => entry.id === 'yarn-classic');
    expect(classic?.fix).not.toContain('rm -rf node_modules yarn.lock');
    expect(ids(advice)).not.toContain('no-package-manager-field');
  });

  it('flags two lockfiles', () => {
    const advice = toolchainAdvice(
      toolchain(),
      lockfile(['yarn.lock', 'package-lock.json'], 'fail'),
      NO_EXPO,
    );
    expect(ids(advice)).toContain('mixed-lockfiles');
  });

  it('flags a toolkit that is installed but never referenced', () => {
    const advice = toolchainAdvice(
      toolchain({ pluginReferenced: false }),
      lockfile(['yarn.lock']),
      NO_EXPO,
    );
    expect(ids(advice)).toContain('plugin-unwired');
  });

  it('points a react native repo at the reactNative preset', () => {
    const advice = toolchainAdvice(
      toolchain({ framework: 'expo' }),
      lockfile(['yarn.lock']),
      NO_EXPO,
    );
    expect(ids(advice)).toContain('react-native-preset');
    expect(ids(advice)).toContain('no-expo-doctor');
  });

  it('nudges when the React Compiler is installed and the memo rule reports nothing', () => {
    const advice = toolchainAdvice(
      toolchain({ reactCompiler: true }),
      lockfile(['yarn.lock']),
      NO_EXPO,
      0,
    );
    const nudge = advice.find(
      (entry) => entry.id === 'react-compiler-manual-memo',
    );
    expect(nudge?.fix).toEqual([
      'set reactCompiler: true in defineLegionConfig',
    ]);
  });

  it('stays quiet when the memo rule is already reporting, which proves it is on', () => {
    const advice = toolchainAdvice(
      toolchain({ reactCompiler: true }),
      lockfile(['yarn.lock']),
      NO_EXPO,
      140,
    );
    expect(ids(advice)).not.toContain('react-compiler-manual-memo');
  });

  it('says nothing about the compiler when it is not installed', () => {
    const advice = toolchainAdvice(
      toolchain(),
      lockfile(['yarn.lock']),
      NO_EXPO,
    );
    expect(ids(advice)).not.toContain('react-compiler-manual-memo');
  });

  it('reports expo patch drift as advice and not as a failure', () => {
    const advice = toolchainAdvice(
      toolchain({ framework: 'expo' }),
      lockfile(['yarn.lock']),
      {
        ...NO_EXPO,
        status: 'pass',
        installed: true,
        patchDrift: [
          { name: 'expo-camera', expected: '~57.0.5', found: '57.0.4' },
        ],
      },
    );
    const drift = advice.find((entry) => entry.id === 'expo-patch-drift');
    expect(drift?.fix).toEqual(['yarn expo install --fix']);
    expect(drift?.detail[0]).toContain('expo-camera');
  });
});
