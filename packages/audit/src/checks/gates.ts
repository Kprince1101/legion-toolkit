import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { localBin, packageManagerRun, run } from '../exec.js';
import type { ExecResult } from '../exec.js';
import type { GateResult, PackageManager } from '../types.js';

interface PackageJson {
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

export const readPackageJson = (root: string): PackageJson => {
  try {
    return JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    ) as PackageJson;
  } catch {
    return {};
  }
};

const statusFromCode = (code: number): GateResult['status'] => {
  if (code === 0) return 'pass';
  return 'fail';
};

const TS_ERROR_PATTERN = /error TS\d+/g;

export const countTypeErrors = (output: string): number =>
  (output.match(TS_ERROR_PATTERN) ?? []).length;

export const typecheckGate = (root: string): GateResult => {
  const bin = localBin(root, 'tsc');
  if (!bin || !existsSync(join(root, 'tsconfig.json'))) {
    return {
      name: 'typecheck',
      status: 'skipped',
      summary: 'no tsconfig.json or no local tsc',
    };
  }
  const result = run(bin, ['--noEmit', '-p', 'tsconfig.json'], root);
  const errors = countTypeErrors(result.stdout + result.stderr);
  let summary = 'clean';
  if (result.code !== 0) summary = `${errors} error(s)`;
  return {
    name: 'typecheck',
    status: statusFromCode(result.code),
    summary,
    command: result.command,
    exitCode: result.code,
  };
};

const JEST_TESTS_PATTERN =
  /Tests:\s+(?:(\d+) failed, )?(?:(\d+) skipped, )?(?:(\d+) passed, )?(\d+) total/;
const JEST_SUITES_PATTERN =
  /Test Suites:\s+(?:(\d+) failed, )?(?:(\d+) skipped, )?(?:(\d+) passed, )?(\d+) total/;
const VITEST_PATTERN =
  /Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \| (\d+) skipped)?\s*\((\d+)\)/;

export const summarizeTestOutput = (output: string): string => {
  const jest = JEST_TESTS_PATTERN.exec(output);
  if (jest) {
    const [, failed, , passed, total] = jest;
    const suites = JEST_SUITES_PATTERN.exec(output);
    let suiteText = '';
    if (suites) suiteText = `, ${suites[4]} suite(s)`;
    if (failed)
      return `${failed} failed, ${passed ?? 0}/${total} passed${suiteText}`;
    return `${passed ?? total}/${total} passed${suiteText}`;
  }
  const vitest = VITEST_PATTERN.exec(output);
  if (vitest) {
    const [, failed, passed, , total] = vitest;
    if (failed) return `${failed} failed, ${passed}/${total} passed`;
    return `${passed}/${total} passed`;
  }
  return 'no summary parsed, exit code only';
};

export const testsGate = (
  root: string,
  manager: PackageManager,
): GateResult => {
  const scripts = readPackageJson(root).scripts ?? {};
  let script: string | null = null;
  if (scripts['test:ci']) script = 'test:ci';
  else if (scripts['test']) script = 'test';
  if (!script) {
    return { name: 'tests', status: 'skipped', summary: 'no test script' };
  }
  const { file, args } = packageManagerRun(manager, script);
  const result = run(file, args, root);
  return {
    name: 'tests',
    status: statusFromCode(result.code),
    summary: summarizeTestOutput(result.stdout + result.stderr),
    command: result.command,
    exitCode: result.code,
  };
};

export const formatGate = (root: string): GateResult => {
  const bin = localBin(root, 'prettier');
  if (!bin) {
    return { name: 'format', status: 'skipped', summary: 'no local prettier' };
  }
  const result = run(bin, ['--check', '--no-color', '.'], root);
  const unformatted = (result.stdout + result.stderr)
    .split('\n')
    .filter((line) => line.startsWith('[warn]') && !line.includes('Code style'))
    .filter((line) => !line.includes('Run Prettier')).length;
  let summary = 'clean';
  if (result.code !== 0) summary = `${unformatted} file(s) need formatting`;
  return {
    name: 'format',
    status: statusFromCode(result.code),
    summary,
    command: result.command,
    exitCode: result.code,
  };
};

const NETWORK_FAILURE =
  /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network|offline/i;

const depsAuditCommand = (
  manager: PackageManager,
): { file: string; args: string[] } | null => {
  if (manager === 'yarn') {
    return {
      file: 'yarn',
      args: ['npm', 'audit', '--all', '--severity', 'high'],
    };
  }
  if (manager === 'npm')
    return { file: 'npm', args: ['audit', '--audit-level=high'] };
  if (manager === 'pnpm')
    return { file: 'pnpm', args: ['audit', '--audit-level=high'] };
  return null;
};

const depsAuditSummary = (result: ExecResult): GateResult => {
  const output = result.stdout + result.stderr;
  if (result.code !== 0 && NETWORK_FAILURE.test(output)) {
    return {
      name: 'dependency audit',
      status: 'skipped',
      summary: 'registry unreachable',
      command: result.command,
      exitCode: result.code,
    };
  }
  let summary = 'no high or critical advisories';
  if (result.code !== 0) summary = 'advisories at high severity or above';
  return {
    name: 'dependency audit',
    status: statusFromCode(result.code),
    summary,
    command: result.command,
    exitCode: result.code,
  };
};

export const depsAuditGate = (
  root: string,
  manager: PackageManager,
): GateResult => {
  const command = depsAuditCommand(manager);
  if (!command) {
    return {
      name: 'dependency audit',
      status: 'skipped',
      summary: `no audit command for ${manager}`,
    };
  }
  return depsAuditSummary(run(command.file, command.args, root));
};
