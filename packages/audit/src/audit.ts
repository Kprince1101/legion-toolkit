import { resolve } from 'node:path';
import { buildAdvice } from './advice/index.js';
import { scanDirectives } from './checks/directives.js';
import {
  depsAuditGate,
  formatGate,
  testsGate,
  typecheckGate,
} from './checks/gates.js';
import { prHygiene } from './checks/git.js';
import { runLint } from './checks/lint.js';
import { expoDoctorGate } from './checks/expo.js';
import { lockfileCheck } from './checks/lockfile.js';
import { testCoverage } from './checks/test-coverage.js';
import { dependencyCheck } from './checks/dependencies.js';
import { ruleCoverage } from './checks/rule-coverage.js';
import { applySuppressions, readSuppressions } from './checks/suppressions.js';
import { detectToolchain } from './checks/toolchain.js';
import { workspaceContext } from './workspace.js';
import { listSourceFiles } from './files.js';
import { computeScore } from './report/score.js';
import type {
  AuditOptions,
  AuditResult,
  ExpoDoctorResult,
  GateResult,
} from './types.js';

const SKIPPED_EXPO: ExpoDoctorResult = {
  name: 'expo-doctor',
  status: 'skipped',
  summary: 'skipped by flag',
  patchDrift: [],
  installed: false,
};

const runExpo = (options: AuditOptions, root: string): ExpoDoctorResult => {
  if (!options.runExpoDoctor) return SKIPPED_EXPO;
  return expoDoctorGate(root);
};

export const DEFAULT_OPTIONS: AuditOptions = {
  root: process.cwd(),
  depsAudit: true,
  runTests: true,
  runTypecheck: true,
  runFormat: true,
  runExpoDoctor: true,
  quiet: false,
  commitsToInspect: 80,
  ignore: [],
};

type Logger = (message: string) => void;

const loggerFor = (options: AuditOptions): Logger => {
  if (options.quiet) return () => undefined;
  return (message) => console.error(message);
};

export const probeFile = (root: string, ignore: string[]): string | null => {
  const files = listSourceFiles(root, ignore);
  const preferred = files.find((file) => file.endsWith('.tsx'));
  if (preferred) return preferred;
  return files[0] ?? null;
};

export const runAudit = async (
  partial: Partial<AuditOptions> = {},
): Promise<AuditResult> => {
  const options: AuditOptions = { ...DEFAULT_OPTIONS, ...partial };
  const root = resolve(options.root);
  const log = loggerFor(options);

  log('legion-audit: lockfile');
  const workspace = workspaceContext(root);
  const lockfile = lockfileCheck(workspace.workspaceRoot);
  const { packageManager } = lockfile;

  const gates: GateResult[] = [];
  if (options.runTypecheck) {
    log('legion-audit: typecheck');
    gates.push(typecheckGate(root));
  }
  log('legion-audit: lint');
  const lint = runLint(root);
  const lintGate: GateResult = {
    name: 'lint',
    status: lint.status,
    summary: `${lint.linter}: ${lint.errors} error(s), ${lint.warnings} warning(s)`,
  };
  if (lint.command !== undefined) lintGate.command = lint.command;
  gates.push(lintGate);
  if (options.runTests) {
    log('legion-audit: tests');
    gates.push(testsGate(root, packageManager));
  }
  if (options.runFormat) {
    log('legion-audit: format');
    gates.push(formatGate(root));
  }
  if (options.depsAudit) {
    log('legion-audit: dependency audit');
    gates.push(depsAuditGate(root, packageManager));
  }
  log('legion-audit: expo');
  const expo = runExpo(options, root);
  if (expo.status !== 'skipped') gates.push(expo);

  log('legion-audit: directives');
  const directives = scanDirectives(root, options.ignore);
  log('legion-audit: git history');
  const hygiene = prHygiene(root, options.commitsToInspect);
  log('legion-audit: tests by file');
  const coverage = testCoverage(root, options.ignore);
  log('legion-audit: toolchain');
  const toolchain = detectToolchain(root, packageManager, workspace);
  log('legion-audit: dependencies');
  const dependencies = dependencyCheck(root);
  log('legion-audit: suppressions');
  const suppressions = applySuppressions(lint.legion, readSuppressions(root));
  log('legion-audit: rule coverage');
  const coverageOfRules = await ruleCoverage(
    root,
    probeFile(root, options.ignore),
  );

  const partialResult = {
    root,
    packageManager,
    gates,
    lint,
    directives,
    prHygiene: hygiene,
    testCoverage: coverage,
    lockfile,
    toolchain,
    expo,
    workspace,
    ruleCoverage: coverageOfRules,
    suppressions,
    dependencies,
  };

  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    score: computeScore(partialResult),
    advice: buildAdvice(partialResult),
    ...partialResult,
  };
};
