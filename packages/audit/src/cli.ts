#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HELP, parseArgs } from './args.js';
import type { CliArgs, FailOn } from './args.js';
import { runAudit } from './audit.js';
import { scanDirectives } from './checks/directives.js';
import { findRegressions } from './report/baseline.js';
import { renderConsole } from './report/console.js';
import { renderMarkdown } from './report/markdown.js';
import type { AuditOptions, AuditResult, Regression } from './types.js';

const readBaseline = (file: string): AuditResult =>
  JSON.parse(readFileSync(resolve(file), 'utf8')) as AuditResult;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const effectiveFailOn = (args: CliArgs): FailOn => {
  if (args.failOn) return args.failOn;
  if (args.baseline) return 'regression';
  return 'never';
};

const hasErrors = (result: AuditResult): boolean => {
  if (result.gates.some((gate) => gate.status === 'fail')) return true;
  if (result.lint.legion.some((finding) => finding.severity === 'error'))
    return true;
  if (result.directives.fileWide.length > 0) return true;
  return result.lockfile.status === 'fail';
};

const exitCodeFor = (
  mode: FailOn,
  result: AuditResult,
  regressions: Regression[] | null,
): number => {
  if (mode === 'never') return 0;
  if (mode === 'regression') {
    if (regressions && regressions.length > 0) return 1;
    return 0;
  }
  if (hasErrors(result)) return 1;
  return 0;
};

const runDirectives = (args: CliArgs): number => {
  const result = scanDirectives(resolve(args.root), args.ignore);
  if (result.fileWide.length === 0) {
    if (!args.quiet)
      console.log('legion-audit directives: no file-wide lint disables');
    return 0;
  }
  console.error(
    'legion-audit directives: file-wide lint disables are not allowed',
  );
  for (const hit of result.fileWide) {
    console.error(`  ${hit.file}:${hit.line}  ${hit.tool}-disable`);
  }
  return 1;
};

const auditFor = (args: CliArgs, overrides: Partial<AuditOptions> = {}) =>
  runAudit({
    root: args.root,
    depsAudit: args.depsAudit,
    runTests: args.runTests,
    runTypecheck: args.runTypecheck,
    runFormat: args.runFormat,
    runExpoDoctor: args.runExpoDoctor,
    quiet: args.quiet,
    ignore: args.ignore,
    ...overrides,
  });

const runAdvice = async (args: CliArgs): Promise<number> => {
  const result = await auditFor(args, {
    depsAudit: false,
    runTests: false,
    runFormat: false,
    runTypecheck: false,
  });
  console.log(renderConsole(result));
  return 0;
};

const runFull = async (args: CliArgs): Promise<number> => {
  const result = await auditFor(args);
  let regressions: Regression[] | null = null;
  if (args.baseline)
    regressions = findRegressions(readBaseline(args.baseline), result);
  const markdown = renderMarkdown(result, regressions);
  if (args.md) writeFileSync(resolve(args.md), markdown);
  else console.log(markdown);
  if (args.json)
    writeFileSync(resolve(args.json), `${JSON.stringify(result, null, 2)}\n`);
  if (!args.quiet) console.error(renderConsole(result));
  if (args.md && !args.quiet) {
    console.error(`legion-audit: report written to ${args.md}`);
  }
  return exitCodeFor(effectiveFailOn(args), result, regressions);
};

const main = async (): Promise<number> => {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`legion-audit: ${getErrorMessage(error)}`);
    console.error(HELP);
    return 2;
  }
  if (args.command === 'help') {
    console.log(HELP);
    return 0;
  }
  if (args.command === 'directives') return runDirectives(args);
  if (args.command === 'advice') return runAdvice(args);
  return runFull(args);
};

process.exitCode = await main();
