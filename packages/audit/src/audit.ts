import { resolve } from 'node:path';
import { scanDirectives } from './checks/directives.js';
import {
  depsAuditGate,
  formatGate,
  testsGate,
  typecheckGate,
} from './checks/gates.js';
import { prHygiene } from './checks/git.js';
import { runLint } from './checks/lint.js';
import { lockfileCheck } from './checks/lockfile.js';
import { testCoverage } from './checks/test-coverage.js';
import { computeScore } from './report/score.js';
import type { AuditOptions, AuditResult, GateResult } from './types.js';

export const DEFAULT_OPTIONS: AuditOptions = {
  root: process.cwd(),
  depsAudit: true,
  runTests: true,
  runTypecheck: true,
  runFormat: true,
  quiet: false,
  commitsToInspect: 80,
  ignore: [],
};

type Logger = (message: string) => void;

const loggerFor = (options: AuditOptions): Logger => {
  if (options.quiet) return () => undefined;
  return (message) => console.error(message);
};

export const runAudit = (partial: Partial<AuditOptions> = {}): AuditResult => {
  const options: AuditOptions = { ...DEFAULT_OPTIONS, ...partial };
  const root = resolve(options.root);
  const log = loggerFor(options);

  log('legion-audit: lockfile');
  const lockfile = lockfileCheck(root);
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

  log('legion-audit: directives');
  const directives = scanDirectives(root, options.ignore);
  log('legion-audit: git history');
  const hygiene = prHygiene(root, options.commitsToInspect);
  log('legion-audit: tests by file');
  const coverage = testCoverage(root, options.ignore);

  const partialResult = {
    root,
    packageManager,
    gates,
    lint,
    directives,
    prHygiene: hygiene,
    testCoverage: coverage,
    lockfile,
  };

  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    score: computeScore(partialResult),
    ...partialResult,
  };
};
