import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { ESLINT_CONFIGS, OXLINT_CONFIGS } from 'legion-audit';
import type { Finding } from 'legion-audit';
import { reviewBypasses } from './bypass.js';
import type { BypassReview } from './bypass.js';
import { changedSince, committedContent, headOf } from './changes.js';
import { errorsOf, introduced } from './delta.js';
import { pendingContent } from './edits.js';
import type { EditInput } from './edits.js';
import { lintContent, lintFile, resolveIn } from './lint.js';
import type { LintOutcome } from './lint.js';
import { takeMarker, writeMarker } from './markers.js';
import { displayPath } from './text.js';

const LINTABLE = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

const LINT_CONFIGS = new Set([
  ...OXLINT_CONFIGS,
  ...ESLINT_CONFIGS,
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yml',
  '.eslintrc.yaml',
]);

export interface ToolInput extends EditInput {
  file_path?: string;
  notebook_path?: string;
  new_source?: string;
  content?: string;
  edits?: EditInput[];
  command?: string;
  run_in_background?: boolean;
}

export interface HookPayload {
  hook_event_name?: string;
  tool_name?: string;
  tool_use_id?: string;
  session_id?: string;
  cwd?: string;
  agent_id?: string;
  agent_type?: string;
  tool_input?: ToolInput;
}

export interface HookVerdict {
  action: 'allow' | 'report' | 'block';
  findings: Finding[];
  reason: string;
  linted: boolean;
  notices: string[];
}

interface Original {
  existed: boolean;
  content: string;
}

export const isLintable = (filePath: string): boolean =>
  LINTABLE.has(extname(filePath));

export const isLintConfig = (filePath: string): boolean =>
  LINT_CONFIGS.has(basename(filePath));

export const parsePayload = (raw: string): HookPayload => {
  try {
    return JSON.parse(raw) as HookPayload;
  } catch {
    return {};
  }
};

export const allow = (
  reason: string,
  notices: string[] = [],
  linted = false,
): HookVerdict => ({ action: 'allow', findings: [], reason, linted, notices });

const stepAside = (reason: string, consequence: string): HookVerdict =>
  allow(reason, [`${reason}, so ${consequence}`]);

const keptNotice = (kept: number): string[] => {
  if (kept === 0) return [];
  return [`${kept} violation(s) already in this file were left as they were`];
};

export const verdictFor = (
  event: string,
  outcome: LintOutcome,
  before: Finding[] = [],
): HookVerdict => {
  if (!outcome.linted) {
    return stepAside(outcome.reason, 'this write was not checked');
  }
  const errors = errorsOf(outcome.findings);
  const fresh = introduced(errors, errorsOf(before));
  const notices = keptNotice(errors.length - fresh.length);
  if (fresh.length === 0) return allow('no blocking findings', notices, true);
  if (event === 'PreToolUse') {
    return {
      action: 'block',
      findings: fresh,
      reason: `${fresh.length} violation(s) would land in this file`,
      linted: true,
      notices,
    };
  }
  return {
    action: 'report',
    findings: fresh,
    reason: `${fresh.length} violation(s) in the file just written`,
    linted: true,
    notices,
  };
};

const withBypasses = (
  verdict: HookVerdict,
  review: BypassReview,
  event: string,
): HookVerdict => {
  const notices = [...verdict.notices, ...review.notices];
  if (review.findings.length === 0) return { ...verdict, notices };
  const findings = [...review.findings, ...verdict.findings];
  if (event === 'PreToolUse') {
    return {
      ...verdict,
      action: 'block',
      findings,
      reason: 'this write adds a lint bypass that blinds the linter',
      notices,
    };
  }
  return {
    ...verdict,
    action: 'report',
    findings,
    reason: 'the file just written has a lint bypass that blinds the linter',
    notices,
  };
};

export const renderFindings = (findings: Finding[]): string =>
  findings
    .map((finding) => `  ${finding.file}:${finding.line}  ${finding.message}`)
    .join('\n');

const readOriginal = (absolute: string): Original => {
  try {
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      return { existed: false, content: '' };
    }
    return { existed: true, content: readFileSync(absolute, 'utf8') };
  } catch {
    return { existed: false, content: '' };
  }
};

const baselineOf = (
  root: string,
  absolute: string,
  before: string | null,
  outcome: LintOutcome,
): Finding[] => {
  if (before === null) return [];
  if (errorsOf(outcome.findings).length === 0) return [];
  const prior = lintContent(root, absolute, before);
  if (!prior.linted) return [];
  return prior.findings;
};

const priorContent = (original: Original): string | null => {
  if (!original.existed) return null;
  return original.content;
};

const workingRoot = (root: string, payload: HookPayload): string => {
  const cwd = payload.cwd;
  if (cwd !== undefined && cwd.length > 0 && existsSync(cwd)) return cwd;
  return root;
};

const configNotices = (root: string, absolute: string): string[] => {
  if (!isLintConfig(absolute)) return [];
  return [
    `${displayPath(root, absolute)} is lint config; legion-steer does not check config changes, and one can turn rules off for every file`,
  ];
};

const withNotices = (verdict: HookVerdict, notices: string[]): HookVerdict => {
  if (notices.length === 0) return verdict;
  return { ...verdict, notices: [...notices, ...verdict.notices] };
};

const defer = (
  payload: HookPayload,
  original: Original,
  reason: string,
): HookVerdict => {
  const marked = writeMarker(payload, {
    status: 'deferred',
    at: Date.now(),
    original: original.content,
  });
  if (marked) {
    return stepAside(
      reason,
      'the edit could not be checked before it lands; legion-steer lints the file right after instead',
    );
  }
  return stepAside(reason, 'this edit was not checked');
};

const judge = (
  root: string,
  absolute: string,
  event: string,
  before: string | null,
  after: string,
  outcome: LintOutcome,
): HookVerdict =>
  withBypasses(
    verdictFor(event, outcome, baselineOf(root, absolute, before, outcome)),
    reviewBypasses(displayPath(root, absolute), before ?? '', after),
    event,
  );

const preWrite = (
  root: string,
  tool: string,
  payload: HookPayload,
  absolute: string,
): HookVerdict => {
  const original = readOriginal(absolute);
  const pending = pendingContent(
    tool,
    payload.tool_input ?? {},
    original.content,
  );
  if (!pending.ok) return defer(payload, original, pending.reason);
  const verdict = judge(
    root,
    absolute,
    'PreToolUse',
    priorContent(original),
    pending.content,
    lintContent(root, absolute, pending.content),
  );
  if (verdict.action === 'allow') {
    writeMarker(payload, { status: 'checked', at: Date.now(), original: '' });
  }
  return verdict;
};

const readNow = (absolute: string): string => readOriginal(absolute).content;

const postWrite = (
  root: string,
  payload: HookPayload,
  absolute: string,
): HookVerdict => {
  const marker = takeMarker(payload);
  if (marker?.status === 'checked') return allow('checked before the write');
  if (marker?.status === 'deferred') {
    return judge(
      root,
      absolute,
      'PostToolUse',
      marker.original,
      readNow(absolute),
      lintFile(root, absolute),
    );
  }
  return verdictFor('PostToolUse', lintFile(root, absolute));
};

const mergeVerdicts = (verdicts: HookVerdict[]): HookVerdict => {
  const findings = verdicts.flatMap((verdict) => verdict.findings);
  const notices = verdicts.flatMap((verdict) => verdict.notices);
  const linted = verdicts.some((verdict) => verdict.linted);
  if (findings.length === 0)
    return allow('no blocking findings', notices, linted);
  return {
    action: 'report',
    findings,
    reason: `${findings.length} violation(s) in files this command wrote`,
    linted,
    notices,
  };
};

const prefixed = (
  root: string,
  file: string,
  verdict: HookVerdict,
): HookVerdict => ({
  ...verdict,
  notices: verdict.notices.map(
    (notice) => `${displayPath(root, file)}: ${notice}`,
  ),
});

const postBash = (root: string, payload: HookPayload): HookVerdict => {
  const marker = takeMarker(payload);
  if (marker?.status !== 'started') {
    return stepAside(
      'legion-steer did not see this command start',
      'it could not tell which files the command wrote, and they were not checked',
    );
  }
  const changes = changedSince(root, marker.at, marker.head ?? '');
  if (!changes.ok) return stepAside(changes.reason, 'they were not checked');
  const notices = [
    ...changes.notices,
    ...changes.files.flatMap((file) => configNotices(root, file)),
  ];
  const written = changes.files.filter(isLintable);
  if (written.length === 0) {
    return allow('the command wrote no lintable files', notices);
  }
  const verdict = mergeVerdicts(
    written.map((file) =>
      prefixed(
        root,
        file,
        judge(
          root,
          file,
          'PostToolUse',
          committedContent(changes.top, file, changes.base),
          readNow(file),
          lintFile(root, file),
        ),
      ),
    ),
  );
  return withNotices(verdict, notices);
};

const backgroundNotices = (payload: HookPayload): string[] => {
  if (payload.tool_input?.run_in_background !== true) return [];
  return [
    'this command runs in the background, so files it writes after it was launched are not checked',
  ];
};

const evaluateBash = (
  root: string,
  event: string,
  payload: HookPayload,
): HookVerdict => {
  if (event === 'PreToolUse') {
    writeMarker(payload, {
      status: 'started',
      at: Date.now(),
      original: '',
      head: headOf(root) ?? '',
    });
    return allow('noted when the command started');
  }
  if (event === 'PostToolUse') {
    return withNotices(postBash(root, payload), backgroundNotices(payload));
  }
  return stepAside(
    `legion-steer does not handle ${event} for Bash`,
    'nothing was checked',
  );
};

const evaluateFile = (
  root: string,
  event: string,
  tool: string,
  payload: HookPayload,
): HookVerdict => {
  const filePath = payload.tool_input?.file_path ?? '';
  if (filePath.length === 0) {
    return stepAside(
      `the payload for ${tool} has no file_path`,
      'nothing was checked',
    );
  }
  const absolute = resolveIn(root, filePath);
  if (event === 'PreToolUse') {
    const notices = configNotices(root, absolute);
    if (!isLintable(absolute)) {
      return allow('not a file the linter checks', notices);
    }
    return withNotices(preWrite(root, tool, payload, absolute), notices);
  }
  if (!isLintable(absolute)) return allow('not a file the linter checks');
  if (event === 'PostToolUse') return postWrite(root, payload, absolute);
  return stepAside(
    `legion-steer does not handle ${event}`,
    'nothing was checked',
  );
};

export const evaluate = (root: string, payload: HookPayload): HookVerdict => {
  const event = payload.hook_event_name ?? 'an unnamed event';
  const tool = payload.tool_name ?? 'an unnamed tool';
  const base = workingRoot(root, payload);
  if (tool === 'Bash') return evaluateBash(base, event, payload);
  if (tool === 'NotebookEdit') {
    return stepAside(
      'notebooks are not linted',
      'this NotebookEdit was not checked',
    );
  }
  return evaluateFile(base, event, tool, payload);
};
