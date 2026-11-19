import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunMeta } from './record.ts';
import { parseStepResult } from './reports.ts';
import { scoreWorkspace, scoringPaths } from './score.ts';
import { claudeArgs, isResultFile, listSteps, stepsFrom } from './steps.ts';

export interface RunOptions {
  runDir: string;
  kitDir: string;
  repoDir: string;
  model: string;
  permissionMode: string;
  from: string | null;
  log: (line: string) => void;
}

const MAX_OUTPUT = 512 * 1024 * 1024;

const lastSession = (resultsDir: string, before: string): string | null => {
  const earlier = readdirSync(resultsDir)
    .filter(isResultFile)
    .filter((file) => file.replace(/\.json$/, '') < before)
    .sort();
  for (const file of earlier.reverse()) {
    const step = parseStepResult(
      file,
      readFileSync(join(resultsDir, file), 'utf8'),
    );
    if (step.sessionId !== null) return step.sessionId;
  }
  return null;
};

export const runSteps = (meta: RunMeta, options: RunOptions): boolean => {
  const promptsDir = join(options.kitDir, 'prompts');
  const resultsDir = join(options.runDir, 'results');
  const steps = stepsFrom(listSteps(readdirSync(promptsDir)), options.from);
  for (const step of steps) {
    const resume = lastSession(resultsDir, step.name);
    const args = claudeArgs({
      model: options.model,
      permissionMode: options.permissionMode,
      resume,
    });
    options.log(`step ${step.name}: claude ${args.join(' ')}`);
    const result = spawnSync('claude', args, {
      cwd: meta.workspace,
      input: readFileSync(join(promptsDir, step.file), 'utf8'),
      encoding: 'utf8',
      maxBuffer: MAX_OUTPUT,
      env: process.env,
    });
    writeFileSync(join(resultsDir, `${step.name}.json`), result.stdout ?? '');
    writeFileSync(
      join(resultsDir, `${step.name}.stderr.txt`),
      result.stderr ?? '',
    );
    const score = scoreWorkspace(
      scoringPaths(
        meta.workspace,
        options.runDir,
        options.kitDir,
        options.repoDir,
      ),
      join(resultsDir, `${step.name}.audit.json`),
    );
    if (score.error !== null) options.log(`step ${step.name}: ${score.error}`);
    const parsed = parseStepResult(step.name, result.stdout ?? '');
    if (result.status !== 0 || !parsed.ok) {
      options.log(
        `step ${step.name} failed (exit ${String(result.status)}, ${parsed.subtype ?? 'no result'}); fix the cause and rerun with --from ${step.name}`,
      );
      return false;
    }
    options.log(`step ${step.name} done`);
  }
  return true;
};
