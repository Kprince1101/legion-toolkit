import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { summarizeAudit } from './reports.ts';
import type { AuditSummary } from './reports.ts';
import { copySource } from './tree.ts';

export interface ScoringPaths {
  workspace: string;
  scoringDir: string;
  repoDir: string;
  referenceConfig: string;
}

export const scoringPaths = (
  workspace: string,
  runDir: string,
  kitDir: string,
  repoDir: string,
): ScoringPaths => ({
  workspace,
  scoringDir: join(runDir, 'scoring'),
  repoDir,
  referenceConfig: join(kitDir, 'arms', 'steered', 'oxlintrc.json'),
});

export const AUDIT_FLAGS = [
  '--no-deps-audit',
  '--no-tests',
  '--no-typecheck',
  '--no-format',
  '--no-expo-doctor',
  '--quiet',
];

const clearScoring = (scoringDir: string): void => {
  const link = join(scoringDir, 'node_modules');
  const stat = lstatSync(link, { throwIfNoEntry: false });
  if (stat?.isSymbolicLink() === true) unlinkSync(link);
  rmSync(scoringDir, { recursive: true, force: true });
};

export const prepareScoring = (paths: ScoringPaths): void => {
  clearScoring(paths.scoringDir);
  copySource(paths.workspace, paths.scoringDir);
  copyFileSync(paths.referenceConfig, join(paths.scoringDir, '.oxlintrc.json'));
  symlinkSync(
    join(paths.repoDir, 'node_modules'),
    join(paths.scoringDir, 'node_modules'),
    'dir',
  );
};

export interface ScoreResult {
  summary: AuditSummary | null;
  error: string | null;
}

export const scoreWorkspace = (
  paths: ScoringPaths,
  outFile: string,
): ScoreResult => {
  const bin = join(paths.repoDir, 'node_modules', '.bin', 'legion-audit');
  if (!existsSync(bin)) {
    return {
      summary: null,
      error: `${bin} is missing; run pnpm install && pnpm build in the kit's repo`,
    };
  }
  rmSync(outFile, { force: true });
  prepareScoring(paths);
  const result = spawnSync(
    bin,
    ['--root', paths.scoringDir, '--json', outFile, ...AUDIT_FLAGS],
    { cwd: paths.scoringDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  clearScoring(paths.scoringDir);
  if (!existsSync(outFile)) {
    return {
      summary: null,
      error: `legion-audit wrote no report: ${result.stderr.slice(0, 500)}`,
    };
  }
  return {
    summary: summarizeAudit(readFileSync(outFile, 'utf8')),
    error: null,
  };
};
