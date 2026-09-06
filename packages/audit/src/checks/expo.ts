import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { localBin, run } from '../exec.js';
import type { ExpoDoctorResult, GateResult, VersionDrift } from '../types.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

const APP_CONFIGS = ['app.json', 'app.config.js', 'app.config.ts'];

const readPackageJson = (root: string): PackageJson => {
  try {
    return JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    ) as PackageJson;
  } catch {
    return {};
  }
};

export const isExpoProject = (root: string): boolean => {
  const pkg = readPackageJson(root);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps['expo'] !== undefined) return true;
  return APP_CONFIGS.some((name) => existsSync(join(root, name)));
};

export const isReactNativeProject = (root: string): boolean => {
  const pkg = readPackageJson(root);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return deps['react-native'] !== undefined || isExpoProject(root);
};

const VERSION_PATTERN = /(\d+)\.(\d+)\.(\d+)/;

export const parseVersion = (value: string): SemanticVersion | null => {
  const match = VERSION_PATTERN.exec(value);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

export const isPatchOnlyDrift = (expected: string, found: string): boolean => {
  const a = parseVersion(expected);
  const b = parseVersion(found);
  if (!a || !b) return false;
  if (a.major !== b.major || a.minor !== b.minor) return false;
  return a.patch !== b.patch;
};

const ROW_PATTERN = /^(\S+)\s+(~?\^?[\d.]+)\s+(~?\^?[\d.]+)$/;

export const parseMismatchRows = (output: string): VersionDrift[] => {
  const rows: VersionDrift[] = [];
  for (const rawLine of output.split('\n')) {
    const match = ROW_PATTERN.exec(rawLine.trim());
    if (!match) continue;
    const [, name, expected, found] = match;
    if (name === undefined || name === 'package') continue;
    rows.push({ name, expected: expected ?? '', found: found ?? '' });
  }
  return rows;
};

const FAILED_CHECK_PATTERN = /^✖/gm;

export interface DoctorVerdict {
  blocking: boolean;
  patchDrift: VersionDrift[];
  reason: string;
}

export const classifyDoctorOutput = (
  output: string,
  exitCode: number,
): DoctorVerdict => {
  if (exitCode === 0) {
    return { blocking: false, patchDrift: [], reason: 'all checks passed' };
  }
  const rows = parseMismatchRows(output);
  if (rows.length === 0) {
    return {
      blocking: true,
      patchDrift: [],
      reason: 'a doctor check failed that is not version drift',
    };
  }
  const failedChecks = (output.match(FAILED_CHECK_PATTERN) ?? []).length;
  if (failedChecks > 1) {
    return {
      blocking: true,
      patchDrift: [],
      reason: 'more than one doctor check failed',
    };
  }
  const blocking = rows.filter(
    (row) => !isPatchOnlyDrift(row.expected, row.found),
  );
  if (blocking.length > 0) {
    const names = blocking.map((row) => row.name).join(', ');
    return {
      blocking: true,
      patchDrift: [],
      reason: `major or minor mismatch: ${names}`,
    };
  }
  return {
    blocking: false,
    patchDrift: rows,
    reason: 'patch-level drift only',
  };
};

const NOT_EXPO: ExpoDoctorResult = {
  name: 'expo-doctor',
  status: 'skipped',
  summary: 'not an expo project',
  patchDrift: [],
  installed: false,
};

const statusFor = (verdict: DoctorVerdict): GateResult['status'] => {
  if (verdict.blocking) return 'fail';
  return 'pass';
};

const driftSummary = (verdict: DoctorVerdict): string => {
  if (verdict.patchDrift.length === 0) return verdict.reason;
  const names = verdict.patchDrift.map((row) => row.name).join(', ');
  return `${verdict.patchDrift.length} package(s) one patch behind: ${names}`;
};

export const expoDoctorGate = (root: string): ExpoDoctorResult => {
  if (!isExpoProject(root)) return NOT_EXPO;
  const bin = localBin(root, 'expo-doctor');
  if (!bin) {
    return {
      name: 'expo-doctor',
      status: 'skipped',
      summary: 'expo-doctor is not installed in this project',
      patchDrift: [],
      installed: false,
    };
  }
  const result = run(bin, [], root);
  const verdict = classifyDoctorOutput(
    result.stdout + result.stderr,
    result.code,
  );
  return {
    name: 'expo-doctor',
    status: statusFor(verdict),
    summary: driftSummary(verdict),
    command: result.command,
    exitCode: result.code,
    patchDrift: verdict.patchDrift,
    installed: true,
  };
};
