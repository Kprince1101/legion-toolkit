import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { compareGuards, hashGuards } from './guards.ts';
import type { GuardHashes } from './guards.ts';
import { projectSlug } from './isolation.ts';
import type { RunMeta, RunRecord, StepLint } from './record.ts';
import {
  NOT_RUN,
  parseAcceptance,
  parseStepResult,
  summarizeAudit,
  totalCost,
} from './reports.ts';
import type { AcceptanceSummary } from './reports.ts';
import { scoreWorkspace, scoringPaths } from './score.ts';
import { isResultFile } from './steps.ts';
import {
  agentOf,
  analyzeTranscript,
  mergeEntries,
  parseJsonl,
  tagEntries,
} from './transcript.ts';
import { sourceSizes, toPosix, tsSuppressionsIn } from './tree.ts';

export interface CollectOptions {
  runDir: string;
  kitDir: string;
  repoDir: string;
  configDir: string;
  acceptance: boolean;
  log: (line: string) => void;
}

const ACCEPTANCE_PORT = '3199';
const LARGEST = 5;
const CAP = 180;
const SPRAWL = 500;
const MAX_OUTPUT = 256 * 1024 * 1024;

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T;

export const jsonlUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .map(toPosix)
    .filter(
      (file) =>
        file.endsWith('.jsonl') && statSync(join(directory, file)).isFile(),
    )
    .sort();
};

export const gatherTranscripts = (
  runDir: string,
  roots: string[],
  configDir: string,
): string[] => {
  const archive = join(runDir, 'transcripts');
  const sources = [...new Set(roots.map(projectSlug))].map((slug) =>
    join(configDir, 'projects', slug),
  );
  for (const source of sources) {
    for (const file of jsonlUnder(source)) {
      const target = join(archive, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(source, file), target);
    }
  }
  return jsonlUnder(archive);
};

const runAcceptance = (
  kitDir: string,
  workspace: string,
  runDir: string,
): AcceptanceSummary => {
  const pristine = join(workspace, '.kit-acceptance');
  const config = join(workspace, 'playwright.kit.config.ts');
  const report = join(runDir, 'acceptance.json');
  rmSync(pristine, { recursive: true, force: true });
  rmSync(report, { force: true });
  cpSync(join(kitDir, 'template', 'acceptance'), pristine, { recursive: true });
  copyFileSync(join(kitDir, 'template', 'playwright.config.ts'), config);
  const result = spawnSync(
    'npx',
    [
      '--no-install',
      'playwright',
      'test',
      '--config',
      'playwright.kit.config.ts',
      '--reporter=json',
    ],
    {
      cwd: workspace,
      encoding: 'utf8',
      maxBuffer: MAX_OUTPUT,
      env: {
        ...process.env,
        ACCEPTANCE_DIR: './.kit-acceptance',
        ACCEPTANCE_PORT,
        PLAYWRIGHT_JSON_OUTPUT_NAME: report,
      },
    },
  );
  writeFileSync(
    join(runDir, 'acceptance.log'),
    `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  );
  rmSync(pristine, { recursive: true, force: true });
  rmSync(config, { force: true });
  if (!existsSync(report)) {
    return {
      ...NOT_RUN,
      errors: ['Playwright wrote no report; see acceptance.log'],
    };
  }
  return parseAcceptance(readFileSync(report, 'utf8'));
};

const stepFiles = (runDir: string): string[] => {
  const results = join(runDir, 'results');
  if (!existsSync(results)) return [];
  return readdirSync(results).sort();
};

const stepLints = (runDir: string): StepLint[] =>
  stepFiles(runDir)
    .filter((file) => file.endsWith('.audit.json'))
    .map((file) => {
      const audit = summarizeAudit(
        readFileSync(join(runDir, 'results', file), 'utf8'),
      );
      return {
        step: file.replace(/\.audit\.json$/, ''),
        lintErrors: audit.lintErrors,
        legionFindings: audit.legionFindings,
        componentCap: audit.componentCap,
        directives: audit.directives,
      };
    });

const stepResults = (runDir: string) =>
  stepFiles(runDir)
    .filter(isResultFile)
    .map((file) =>
      parseStepResult(
        file.replace(/\.json$/, ''),
        readFileSync(join(runDir, 'results', file), 'utf8'),
      ),
    );

const transcriptOf = (archive: string, files: string[], roots: string[]) => {
  if (files.length === 0) return null;
  const entries = mergeEntries(
    files.map((file) =>
      tagEntries(
        parseJsonl(readFileSync(join(archive, file), 'utf8')),
        agentOf(file),
      ),
    ),
  );
  return analyzeTranscript(entries, roots);
};

export const collectRun = (options: CollectOptions): RunRecord => {
  const meta = readJson<RunMeta>(join(options.runDir, 'run.json'));
  const workspace = meta.workspace;
  const roots = [...new Set([workspace, realpathSync(workspace)])];
  const baseline = readJson<GuardHashes>(join(options.runDir, 'baseline.json'));
  const tampered = compareGuards(baseline, hashGuards(workspace));
  const sizes = sourceSizes(workspace);
  options.log(`scoring ${workspace}`);
  const score = scoreWorkspace(
    scoringPaths(workspace, options.runDir, options.kitDir, options.repoDir),
    join(options.runDir, 'audit.json'),
  );
  let acceptance = NOT_RUN;
  if (options.acceptance) {
    options.log('running the pristine acceptance checks');
    acceptance = runAcceptance(options.kitDir, workspace, options.runDir);
  }
  const transcriptFiles = gatherTranscripts(
    options.runDir,
    roots,
    options.configDir,
  );
  const steps = stepResults(options.runDir);
  const record: RunRecord = {
    schema: 1,
    arm: meta.arm,
    runId: meta.runId,
    collectedAt: new Date().toISOString(),
    acceptance,
    audit: score.summary,
    auditError: score.error,
    tsSuppressions: tsSuppressionsIn(workspace),
    largest: sizes.slice(0, LARGEST),
    tsxOver180: sizes.filter(
      (size) => size.file.endsWith('.tsx') && size.lines > CAP,
    ).length,
    filesOver500: sizes.filter((size) => size.lines > SPRAWL).length,
    transcript: transcriptOf(
      join(options.runDir, 'transcripts'),
      transcriptFiles,
      roots,
    ),
    transcriptFiles: transcriptFiles.map((file) => `transcripts/${file}`),
    steps,
    costUsd: totalCost(steps),
    tampered,
    perStep: stepLints(options.runDir),
  };
  writeFileSync(
    join(options.runDir, 'collected.json'),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  return record;
};

export const loadRecords = (runsDir: string): RunRecord[] =>
  readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(runsDir, entry.name, 'collected.json'))
    .filter((path) => existsSync(path))
    .map((path) => readJson<RunRecord>(path));
