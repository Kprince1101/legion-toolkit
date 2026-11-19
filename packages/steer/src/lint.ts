import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { OXLINT_CONFIGS, localBin, parseOxlintJson, run } from 'legion-audit';
import type { ExecResult, Finding } from 'legion-audit';
import { displayPath, firstLine } from './text.js';

export interface LintOutcome {
  linted: boolean;
  findings: Finding[];
  reason: string;
}

interface Linter {
  bin: string;
  cwd: string;
}

type LinterLookup =
  { ok: true; linter: Linter } | { ok: false; reason: string };

interface OxlintReport {
  diagnostics?: unknown;
  number_of_files?: number;
}

export const resolveIn = (root: string, filePath: string): string => {
  if (isAbsolute(filePath)) return filePath;
  return join(root, filePath);
};

export const missingAncestors = (directory: string): string[] => {
  const missing: string[] = [];
  let current = directory;
  while (!existsSync(current)) {
    missing.unshift(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return missing;
};

const hasConfig = (directory: string): boolean =>
  OXLINT_CONFIGS.some((name) => existsSync(join(directory, name)));

export const findConfigDir = (directory: string): string | null => {
  let current = directory;
  while (!hasConfig(current)) {
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return current;
};

export const notLinted = (reason: string): LintOutcome => ({
  linted: false,
  findings: [],
  reason,
});

export const linterFor = (root: string, absolute: string): LinterLookup => {
  const directory = dirname(absolute);
  const cwd = findConfigDir(directory);
  if (cwd === null) {
    return {
      ok: false,
      reason: `no oxlint config was found in ${displayPath(root, directory)} or above it`,
    };
  }
  const bin = localBin(cwd, 'oxlint') ?? localBin(root, 'oxlint');
  if (bin === null) return { ok: false, reason: 'oxlint is not installed' };
  return { ok: true, linter: { bin, cwd } };
};

const unreadable = (result: ExecResult): LintOutcome =>
  notLinted(
    `oxlint did not produce a report (${firstLine(`${result.stderr}\n${result.stdout}`)})`,
  );

export const readReport = (result: ExecResult): LintOutcome => {
  const start = result.stdout.indexOf('{');
  if (start === -1) return unreadable(result);
  let report: OxlintReport;
  try {
    report = JSON.parse(result.stdout.slice(start)) as OxlintReport;
  } catch {
    return unreadable(result);
  }
  if (!Array.isArray(report.diagnostics)) return unreadable(result);
  if (report.number_of_files === 0) {
    return notLinted('the lint config ignores this path');
  }
  return {
    linted: true,
    findings: parseOxlintJson(result.stdout),
    reason: 'linted',
  };
};

const rewritten = (
  found: string,
  scratchName: string,
  filePath: string,
): string => {
  if (found.includes(scratchName)) return filePath;
  return found;
};

export const relabel = (
  findings: Finding[],
  scratchName: string,
  filePath: string,
): Finding[] =>
  findings.map((finding) => ({
    ...finding,
    file: rewritten(finding.file, scratchName, filePath),
  }));

export const lintContent = (
  root: string,
  filePath: string,
  content: string,
): LintOutcome => {
  const absolute = resolveIn(root, filePath);
  const lookup = linterFor(root, absolute);
  if (!lookup.ok) return notLinted(lookup.reason);
  const directory = dirname(absolute);
  const created = missingAncestors(directory);
  let scratch: string | null = null;
  try {
    for (const segment of created) mkdirSync(segment);
    scratch = mkdtempSync(join(directory, '.legion-steer-'));
    const target = join(scratch, basename(absolute));
    writeFileSync(target, content);
    const outcome = readReport(
      run(lookup.linter.bin, ['--format', 'json', target], lookup.linter.cwd),
    );
    return {
      ...outcome,
      findings: relabel(
        outcome.findings,
        basename(scratch),
        displayPath(root, absolute),
      ),
    };
  } catch (error) {
    return notLinted(`could not lint the pending write: ${String(error)}`);
  } finally {
    if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
    for (const segment of [...created].reverse()) {
      rmSync(segment, { recursive: true, force: true });
    }
  }
};

export const lintFile = (root: string, filePath: string): LintOutcome => {
  const absolute = resolveIn(root, filePath);
  const lookup = linterFor(root, absolute);
  if (!lookup.ok) return notLinted(lookup.reason);
  const { bin, cwd } = lookup.linter;
  const outcome = readReport(run(bin, ['--format', 'json', absolute], cwd));
  return {
    ...outcome,
    findings: outcome.findings.map((finding) => ({
      ...finding,
      file: displayPath(root, resolve(cwd, finding.file)),
    })),
  };
};
