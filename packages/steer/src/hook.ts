import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
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
}

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
): Finding[] => {
  const bin = localBin(root, 'oxlint');
  if (!bin) return [];
  const directory = dirname(filePath);
  const scratch = mkdtempSync(join(directory, '.legion-steer-'));
  const target = join(scratch, basename(filePath));
  try {
    writeFileSync(target, content);
    const result = run(bin, ['--format', 'json', target], root);
    return relabel(parseOxlintJson(result.stdout), basename(scratch), filePath);
  } catch {
    return [];
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

export const lintFile = (root: string, filePath: string): Finding[] => {
  const bin = localBin(root, 'oxlint');
  if (!bin) return [];
  const result = run(bin, ['--format', 'json', filePath], root);
  try {
    return parseOxlintJson(result.stdout);
  } catch {
    return [];
  }
};

export const verdictFor = (event: string, findings: Finding[]): HookVerdict => {
  const errors = errorsOf(findings);
  if (errors.length === 0) {
    return { action: 'allow', findings: [], reason: 'no blocking findings' };
  }
  if (event === 'PreToolUse') {
    return {
      action: 'block',
      findings: errors,
      reason: `${errors.length} violation(s) would land in this file`,
    };
  }
  return {
    action: 'report',
    findings: errors,
    reason: `${errors.length} violation(s) in the file just written`,
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
    return { action: 'allow', findings: [], reason: 'not a TypeScript file' };
  }
  if (event === 'PreToolUse') {
    const content = payload.tool_input?.content ?? '';
    if (content.length === 0) {
      return { action: 'allow', findings: [], reason: 'no content to check' };
    }
    return verdictFor(event, lintContent(root, filePath, content));
  }
  return verdictFor(event, lintFile(root, filePath));
};
