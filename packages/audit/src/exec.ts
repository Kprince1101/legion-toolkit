import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PackageManager } from './types.js';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  command: string;
}

const MAX_BUFFER = 64 * 1024 * 1024;

const ESCAPE = String.fromCharCode(27);

const ANSI_PATTERN = new RegExp(`${ESCAPE}\\[[0-9;]*[A-Za-z]`, 'g');

export const stripAnsi = (text: string): string =>
  text.replace(ANSI_PATTERN, '');

export const run = (
  file: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): ExecResult => {
  const result = spawnSync(file, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    env: { ...process.env, CI: process.env.CI ?? 'true', ...env },
    shell: false,
  });
  return {
    code: result.status ?? 1,
    stdout: stripAnsi(result.stdout ?? ''),
    stderr: stripAnsi(result.stderr ?? ''),
    command: [file, ...args].join(' '),
  };
};

const binSuffix = (): string => {
  if (process.platform === 'win32') return '.cmd';
  return '';
};

export const localBin = (root: string, name: string): string | null => {
  const candidate = join(root, 'node_modules', '.bin', `${name}${binSuffix()}`);
  if (existsSync(candidate)) return candidate;
  return null;
};

export const packageManagerRun = (
  manager: PackageManager,
  script: string,
): { file: string; args: string[] } => {
  if (manager === 'yarn') return { file: 'yarn', args: ['run', script] };
  if (manager === 'pnpm') return { file: 'pnpm', args: ['run', script] };
  if (manager === 'bun') return { file: 'bun', args: ['run', script] };
  return { file: 'npm', args: ['run', script, '--silent'] };
};
