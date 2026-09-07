import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import { localBin, parseOxlintJson, run } from 'legion-audit';
import type { Finding } from 'legion-audit';

const LINTABLE = new Set(['.ts', '.tsx', '.mts', '.cts']);

export interface HookPayload {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    content?: string;
  };
}

export interface HookVerdict {
  action: 'allow' | 'report' | 'block';
  findings: Finding[];
  reason: string;
  linted: boolean;
}

export interface LintOutcome {
  linted: boolean;
  findings: Finding[];
  reason: string;
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

export const isLintable = (filePath: string): boolean =>
  LINTABLE.has(extname(filePath));

export const parsePayload = (raw: string): HookPayload => {
  try {
    return JSON.parse(raw) as HookPayload;
  } catch {
    return {};
  }
};

const errorsOf = (findings: Finding[]): Finding[] =>
  findings.filter((finding) => finding.severity === 'error');

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
  const bin = localBin(root, 'oxlint');
  if (!bin) {
    return { linted: false, findings: [], reason: 'oxlint is not installed' };
  }
  const directory = dirname(resolveIn(root, filePath));
  const created = missingAncestors(directory);
  let scratch: string | null = null;
  try {
    for (const segment of created) mkdirSync(segment);
    scratch = mkdtempSync(join(directory, '.legion-steer-'));
    const target = join(scratch, basename(filePath));
    writeFileSync(target, content);
    const result = run(bin, ['--format', 'json', target], root);
    return {
      linted: true,
      findings: relabel(
        parseOxlintJson(result.stdout),
        basename(scratch),
        filePath,
      ),
      reason: 'linted',
    };
  } catch (error) {
    return {
      linted: false,
      findings: [],
      reason: `could not lint the pending write: ${String(error)}`,
    };
  } finally {
    if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
    for (const segment of [...created].reverse()) {
      rmSync(segment, { recursive: true, force: true });
    }
  }
};

export const lintFile = (root: string, filePath: string): LintOutcome => {
  const bin = localBin(root, 'oxlint');
  if (!bin) {
    return { linted: false, findings: [], reason: 'oxlint is not installed' };
  }
  const result = run(bin, ['--format', 'json', filePath], root);
  try {
    return {
      linted: true,
      findings: parseOxlintJson(result.stdout),
      reason: 'linted',
    };
  } catch (error) {
    return {
      linted: false,
      findings: [],
      reason: `could not read the lint output: ${String(error)}`,
    };
  }
};

export const verdictFor = (
  event: string,
  outcome: LintOutcome,
): HookVerdict => {
  if (!outcome.linted) {
    return {
      action: 'allow',
      findings: [],
      reason: outcome.reason,
      linted: false,
    };
  }
  const errors = errorsOf(outcome.findings);
  if (errors.length === 0) {
    return {
      action: 'allow',
      findings: [],
      reason: 'no blocking findings',
      linted: true,
    };
  }
  if (event === 'PreToolUse') {
    return {
      action: 'block',
      findings: errors,
      reason: `${errors.length} violation(s) would land in this file`,
      linted: true,
    };
  }
  return {
    action: 'report',
    findings: errors,
    reason: `${errors.length} violation(s) in the file just written`,
    linted: true,
  };
};

export const renderFindings = (findings: Finding[]): string =>
  findings
    .map((finding) => `  ${finding.file}:${finding.line}  ${finding.message}`)
    .join('\n');

export const evaluate = (root: string, payload: HookPayload): HookVerdict => {
  const event = payload.hook_event_name ?? '';
  const filePath = payload.tool_input?.file_path ?? '';
  if (filePath.length === 0 || !isLintable(filePath)) {
    return {
      action: 'allow',
      findings: [],
      reason: 'not a TypeScript file',
      linted: false,
    };
  }
  if (event === 'PreToolUse') {
    const content = payload.tool_input?.content ?? '';
    if (content.length === 0) {
      return {
        action: 'allow',
        findings: [],
        reason: 'no content to check',
        linted: false,
      };
    }
    return verdictFor(event, lintContent(root, filePath, content));
  }
  return verdictFor(event, lintFile(root, resolveIn(root, filePath)));
};
