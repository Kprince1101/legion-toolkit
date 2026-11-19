import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { errorsByFile } from './lintstate.ts';
import type { LintCheckpoint } from './lintstate.ts';
import { summarizeAudit } from './reports.ts';
import type { AuditSummary } from './reports.ts';
import { stripDirectivesIn } from './strip.ts';
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

const MAX_OUTPUT = 64 * 1024 * 1024;

export interface ScoreFiles {
  stripped: string;
  asWritten: string;
  errors: string;
}

export const scoreFiles = (outFile: string): ScoreFiles => ({
  stripped: outFile,
  asWritten: outFile.replace(/\.json$/, '.as-written.json'),
  errors: outFile.replace(/\.json$/, '.errors.json'),
});

export const clearScoring = (scoringDir: string): void => {
  const link = join(scoringDir, 'node_modules');
  const stat = lstatSync(link, { throwIfNoEntry: false });
  if (stat?.isSymbolicLink() === true) unlinkSync(link);
  rmSync(scoringDir, { recursive: true, force: true });
};

export const prepareScoring = (
  paths: ScoringPaths,
  stripBypasses: boolean,
): string[] => {
  clearScoring(paths.scoringDir);
  copySource(paths.workspace, paths.scoringDir);
  let stripped: string[] = [];
  if (stripBypasses) stripped = stripDirectivesIn(paths.scoringDir);
  copyFileSync(paths.referenceConfig, join(paths.scoringDir, '.oxlintrc.json'));
  symlinkSync(
    join(paths.repoDir, 'node_modules'),
    join(paths.scoringDir, 'node_modules'),
    'dir',
  );
  return stripped;
};

export const withDirectivesFrom = (
  stripped: AuditSummary,
  asWritten: AuditSummary,
): AuditSummary => ({
  ...stripped,
  directives: asWritten.directives,
  fileWideDirectives: asWritten.fileWideDirectives,
  directivesByRule: asWritten.directivesByRule,
  lintErrorsAsWritten: asWritten.lintErrors,
});

export const readScore = (outFile: string): AuditSummary => {
  const files = scoreFiles(outFile);
  const stripped = summarizeAudit(readFileSync(files.stripped, 'utf8'));
  if (!existsSync(files.asWritten)) return stripped;
  return withDirectivesFrom(
    stripped,
    summarizeAudit(readFileSync(files.asWritten, 'utf8')),
  );
};

export const readCheckpoint = (outFile: string): LintCheckpoint | null => {
  const path = scoreFiles(outFile).errors;
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as LintCheckpoint;
};

const audit = (
  bin: string,
  paths: ScoringPaths,
  outFile: string,
  stripBypasses: boolean,
): string => {
  rmSync(outFile, { force: true });
  prepareScoring(paths, stripBypasses);
  const result = spawnSync(
    bin,
    ['--root', paths.scoringDir, '--json', outFile, ...AUDIT_FLAGS],
    { cwd: paths.scoringDir, encoding: 'utf8', maxBuffer: MAX_OUTPUT },
  );
  return result.stderr ?? '';
};

const recordErrors = (paths: ScoringPaths, outFile: string): void => {
  const oxlint = join(paths.repoDir, 'node_modules', '.bin', 'oxlint');
  if (!existsSync(oxlint)) return;
  const result = spawnSync(oxlint, ['--format', 'json', '.'], {
    cwd: paths.scoringDir,
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT,
  });
  const checkpoint: LintCheckpoint = {
    at: new Date().toISOString(),
    errors: errorsByFile(result.stdout ?? '', paths.scoringDir),
  };
  writeFileSync(outFile, `${JSON.stringify(checkpoint, null, 2)}\n`);
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
  const files = scoreFiles(outFile);
  rmSync(files.errors, { force: true });
  const writtenErrors = audit(bin, paths, files.asWritten, false);
  const strippedErrors = audit(bin, paths, files.stripped, true);
  recordErrors(paths, files.errors);
  clearScoring(paths.scoringDir);
  if (!existsSync(files.stripped) || !existsSync(files.asWritten)) {
    return {
      summary: null,
      error: `legion-audit wrote no report: ${`${writtenErrors}${strippedErrors}`.slice(0, 500)}`,
    };
  }
  return { summary: readScore(outFile), error: null };
};
