import { getErrorMessage } from './errors.js';
import { evaluate, parsePayload, renderFindings } from './hook.js';
import type { HookVerdict } from './hook.js';
import { HOOK_PREFIX } from './reasons.js';

export interface HookResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const ADVICE: Record<'block' | 'report', string> = {
  block:
    'Fix the code rather than bypassing the rule, then write the file again.',
  report: 'The write already landed. Fix these before moving on.',
};

const SILENT: HookResponse = { exitCode: 0, stdout: '', stderr: '' };

const stepAsideOutput = (
  event: string,
  text: string,
): Record<string, unknown> => {
  if (event !== 'PostToolUse') return { systemMessage: text };
  return {
    systemMessage: text,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: text,
    },
  };
};

export const respond = (event: string, verdict: HookVerdict): HookResponse => {
  const noticeText = verdict.notices
    .map((notice) => `${HOOK_PREFIX}${notice}`)
    .join('\n');
  if (verdict.action === 'allow') {
    if (verdict.notices.length === 0) return SILENT;
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(stepAsideOutput(event, noticeText))}\n`,
      stderr: `${noticeText}\n`,
    };
  }
  const lines = [
    `${HOOK_PREFIX}${verdict.reason}`,
    renderFindings(verdict.findings),
    ADVICE[verdict.action],
    noticeText,
  ].filter((line) => line.length > 0);
  return { exitCode: 2, stdout: '', stderr: `${lines.join('\n')}\n` };
};

export const failureResponse = (event: string, message: string): HookResponse =>
  respond(event, {
    action: 'allow',
    findings: [],
    reason: message,
    linted: false,
    notices: [
      `legion-steer failed (${message}), so this write was not checked`,
    ],
  });

export const hookResponse = (root: string, raw: string): HookResponse => {
  const payload = parsePayload(raw);
  const event = payload.hook_event_name ?? '';
  try {
    return respond(event, evaluate(root, payload));
  } catch (error) {
    return failureResponse(event, getErrorMessage(error));
  }
};
