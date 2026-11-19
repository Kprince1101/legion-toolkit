import { isAbsolute, normalize } from 'node:path';
import {
  BYPASS_PENDING,
  BYPASS_WRITTEN,
  HOOK_PREFIX,
  violationsCommandWrote,
  violationsPending,
  violationsWritten,
} from '../../../packages/steer/src/reasons.ts';
import { checkpointAfter, errorsIn } from './lintstate.ts';
import type { LintCheckpoint } from './lintstate.ts';
import { shellWriteTargets } from './shell.ts';
import { toPosix } from './tree.ts';

const FINDING_LINE = /^\s+(\S+):(\d+)\s{2,}(.+)$/;
const BYPASS = /(?:eslint|oxlint)-disable|@ts-(?:ignore|expect-error|nocheck)/;
const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const GUARDRAIL_FILE =
  /(?:^|\/)(?:\.oxlintrc(?:\.jsonc?)?|oxlint\.config\.[cm]?[jt]s|eslint\.config\.[cm]?[jt]s|\.eslintrc(?:\.(?:json|jsonc|js|cjs|mjs|yml|yaml))?|\.claude\/settings(?:\.local)?\.json|CLAUDE(?:\.local)?\.md|AGENTS\.md|playwright\.config\.ts)$|(?:^|\/)acceptance\//;
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const COMMAND_PREVIEW = 200;
const COUNT_PLACEHOLDER = 987654321;

export type HookKind = 'block' | 'report';

export type HookCause = 'lint' | 'bypass';

type HookScope = 'file' | 'command';

interface HookSignal {
  kind: HookKind;
  cause: HookCause;
  scope: HookScope;
  pattern: RegExp;
}

export interface HookMatch {
  kind: HookKind;
  cause: HookCause;
  scope: HookScope;
  count: number | null;
}

const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const counted = (reason: (count: number) => string): RegExp =>
  new RegExp(
    escapeRegex(`${HOOK_PREFIX}${reason(COUNT_PLACEHOLDER)}`).replace(
      String(COUNT_PLACEHOLDER),
      '(\\d+)',
    ),
  );

const literal = (reason: string): RegExp =>
  new RegExp(escapeRegex(`${HOOK_PREFIX}${reason}`));

const SIGNALS: HookSignal[] = [
  {
    kind: 'block',
    cause: 'lint',
    scope: 'file',
    pattern: counted(violationsPending),
  },
  {
    kind: 'block',
    cause: 'bypass',
    scope: 'file',
    pattern: literal(BYPASS_PENDING),
  },
  {
    kind: 'report',
    cause: 'lint',
    scope: 'file',
    pattern: counted(violationsWritten),
  },
  {
    kind: 'report',
    cause: 'bypass',
    scope: 'file',
    pattern: literal(BYPASS_WRITTEN),
  },
  {
    kind: 'report',
    cause: 'lint',
    scope: 'command',
    pattern: counted(violationsCommandWrote),
  },
];

export type Outcome =
  | 'fixed'
  | 'kept'
  | 'bypassed'
  | 'shell-write-unflagged'
  | 'flagged-again'
  | 'abandoned'
  | 'unknown';

export const OUTCOMES: Outcome[] = [
  'fixed',
  'kept',
  'bypassed',
  'shell-write-unflagged',
  'flagged-again',
  'abandoned',
  'unknown',
];

const DECIDED_BY_THE_HOOK = new Set<Outcome>(['flagged-again', 'bypassed']);

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface ToolInput {
  file_path?: string;
  content?: string;
  new_string?: string;
  edits?: Array<{ new_string?: string }>;
  command?: string;
}

interface ContentBlock {
  type?: string;
  id?: string;
  name?: string;
  input?: ToolInput;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

export interface TranscriptEntry {
  type?: string;
  subtype?: string;
  uuid?: string;
  timestamp?: string;
  sessionId?: string;
  isCompactSummary?: boolean;
  toolUseID?: string;
  kitAgent?: string;
  message?: {
    id?: string;
    role?: string;
    model?: string;
    content?: unknown;
    usage?: Usage;
  };
  content?: unknown;
}

export interface HookFinding {
  file: string;
  line: number;
  message: string;
}

export interface HookEvent {
  agent: string;
  kind: HookKind;
  cause: HookCause;
  toolUseId: string | null;
  tool: string | null;
  file: string | null;
  files: string[];
  violations: number;
  findings: HookFinding[];
  outcome: Outcome;
  callsUntilNext: number | null;
  touchedGuardrails: boolean;
  afterCompaction: boolean;
  timestamp: string | null;
}

export interface TokenTotals {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
}

export interface ShellWrite {
  agent: string;
  command: string;
  targets: string[];
  flagged: boolean;
  afterCompaction: boolean;
}

export interface GuardrailEdit {
  agent: string;
  tool: string;
  targets: string[];
  afterCompaction: boolean;
}

export interface TranscriptReport {
  sessions: string[];
  models: string[];
  agents: string[];
  toolCalls: number;
  compactions: number;
  tokens: TokenTotals;
  tokensByAgent: Record<string, TokenTotals>;
  hookEvents: HookEvent[];
  blockOutcomes: Record<Outcome, number>;
  reportOutcomes: Record<Outcome, number>;
  shellWritesToSource: ShellWrite[];
  guardrailEdits: GuardrailEdit[];
}

interface ToolCall {
  agent: string;
  id: string;
  name: string;
  input: ToolInput;
  position: number;
  failed: boolean;
}

interface RawHook {
  agent: string;
  match: HookMatch;
  toolUseId: string | null;
  text: string;
  position: number;
  timestamp: string | null;
}

export const parseJsonl = (text: string): TranscriptEntry[] => {
  const entries: TranscriptEntry[] = [];
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (parsed !== null && typeof parsed === 'object') {
        entries.push(parsed as TranscriptEntry);
      }
    } catch {
      continue;
    }
  }
  return entries;
};

export const MAIN_AGENT = 'main';

const SUBAGENT_FILE = /(?:^|\/)subagents\/[^/]+\.jsonl$/;

export const agentOf = (relativePath: string): string => {
  const posix = toPosix(relativePath);
  if (!SUBAGENT_FILE.test(posix)) return MAIN_AGENT;
  return posix.replace(/\.jsonl$/, '');
};

export const tagEntries = (
  entries: TranscriptEntry[],
  agent: string,
): TranscriptEntry[] => entries.map((entry) => ({ ...entry, kitAgent: agent }));

const agentFor = (entry: TranscriptEntry): string =>
  entry.kitAgent ?? MAIN_AGENT;

const byTime = (
  a: { entry: TranscriptEntry; order: number },
  b: { entry: TranscriptEntry; order: number },
): number => {
  const left = a.entry.timestamp;
  const right = b.entry.timestamp;
  if (left !== undefined && right !== undefined && left !== right) {
    return left.localeCompare(right);
  }
  return a.order - b.order;
};

export const mergeEntries = (files: TranscriptEntry[][]): TranscriptEntry[] => {
  const seen = new Set<string>();
  const kept: Array<{ entry: TranscriptEntry; order: number }> = [];
  files.flat().forEach((entry, order) => {
    if (entry.uuid !== undefined) {
      if (seen.has(entry.uuid)) return;
      seen.add(entry.uuid);
    }
    kept.push({ entry, order });
  });
  return kept.sort(byTime).map(({ entry }) => entry);
};

const stringsIn = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
};

const blocksOf = (entry: TranscriptEntry): ContentBlock[] => {
  const content = entry.message?.content;
  if (!Array.isArray(content)) return [];
  return content.filter(
    (block): block is ContentBlock =>
      block !== null && typeof block === 'object',
  );
};

export const hookMatch = (text: string): HookMatch | null => {
  for (const signal of SIGNALS) {
    const found = signal.pattern.exec(text);
    if (found === null) continue;
    let count: number | null = null;
    if (found[1] !== undefined) count = Number(found[1]);
    return {
      kind: signal.kind,
      cause: signal.cause,
      scope: signal.scope,
      count,
    };
  }
  return null;
};

export const hookKind = (text: string): HookKind | null =>
  hookMatch(text)?.kind ?? null;

const scopeOf = (tool: string): HookScope | null => {
  if (WRITE_TOOLS.has(tool)) return 'file';
  if (tool === 'Bash') return 'command';
  return null;
};

export const parseFindings = (text: string): HookFinding[] =>
  text.split('\n').flatMap((line) => {
    const match = FINDING_LINE.exec(line);
    if (match === null) return [];
    return [
      {
        file: match[1] ?? '',
        line: Number(match[2] ?? '0'),
        message: (match[3] ?? '').trim(),
      },
    ];
  });

const violationsIn = (match: HookMatch, findings: HookFinding[]): number =>
  match.count ?? findings.length;

const isCompaction = (entry: TranscriptEntry): boolean =>
  (entry.type === 'system' && entry.subtype === 'compact_boundary') ||
  entry.isCompactSummary === true;

export const pathKey = (roots: string[], filePath: string): string => {
  const posix = toPosix(filePath);
  for (const root of roots) {
    const prefix = `${toPosix(root).replace(/\/$/, '')}/`;
    if (posix.startsWith(prefix)) return posix.slice(prefix.length);
  }
  if (isAbsolute(filePath)) return posix;
  return toPosix(normalize(filePath));
};

const contentOf = (call: ToolCall): string => {
  const edits = (call.input.edits ?? []).map((edit) => edit.new_string ?? '');
  return [
    call.input.content ?? '',
    call.input.new_string ?? '',
    call.input.command ?? '',
    ...edits,
  ].join('\n');
};

const targetsOf = (call: ToolCall, roots: string[]): string[] => {
  if (WRITE_TOOLS.has(call.name)) {
    const filePath = call.input.file_path;
    if (filePath === undefined) return [];
    return [pathKey(roots, filePath)];
  }
  if (call.name === 'Bash') {
    return shellWriteTargets(call.input.command ?? '').map((target) =>
      pathKey(roots, target),
    );
  }
  return [];
};

export const emptyOutcomes = (): Record<Outcome, number> => ({
  fixed: 0,
  kept: 0,
  bypassed: 0,
  'shell-write-unflagged': 0,
  'flagged-again': 0,
  abandoned: 0,
  unknown: 0,
});

interface Scan {
  calls: ToolCall[];
  hooks: RawHook[];
  compactionPositions: number[];
  usage: Map<string, { agent: string; usage: Usage }>;
  models: Set<string>;
  sessions: Set<string>;
  agents: Set<string>;
}

const recordAssistant = (scan: Scan, entry: TranscriptEntry, at: number) => {
  const message = entry.message;
  const agent = agentFor(entry);
  if (message?.id !== undefined && message.usage !== undefined) {
    scan.usage.set(message.id, { agent, usage: message.usage });
  }
  if (message?.model !== undefined) scan.models.add(message.model);
  for (const block of blocksOf(entry)) {
    if (block.type !== 'tool_use') continue;
    if (block.id === undefined || block.name === undefined) continue;
    scan.calls.push({
      agent,
      id: block.id,
      name: block.name,
      input: block.input ?? {},
      position: at,
      failed: false,
    });
  }
};

const recordOther = (scan: Scan, entry: TranscriptEntry, at: number) => {
  const results = blocksOf(entry).filter(
    (block) => block.type === 'tool_result',
  );
  const timestamp = entry.timestamp ?? null;
  const agent = agentFor(entry);
  for (const result of results) {
    const call = scan.calls.find((known) => known.id === result.tool_use_id);
    const text = stringsIn(result.content).join('\n');
    const match = hookMatch(text);
    if (
      match !== null &&
      call !== undefined &&
      scopeOf(call.name) === match.scope
    ) {
      scan.hooks.push({
        agent: call.agent,
        match,
        toolUseId: call.id,
        text,
        position: at,
        timestamp,
      });
    } else if (result.is_error === true && call !== undefined) {
      call.failed = true;
    }
  }
  if (results.length > 0 || isCompaction(entry)) return;
  if (entry.type === 'summary') return;
  const text = stringsIn(entry).join('\n');
  const match = hookMatch(text);
  if (match === null) return;
  const lastOwnCall = scan.calls.findLast((known) => known.agent === agent);
  const toolUseId = entry.toolUseID ?? lastOwnCall?.id ?? null;
  scan.hooks.push({ agent, match, toolUseId, text, position: at, timestamp });
};

const isMainCompaction = (entry: TranscriptEntry): boolean =>
  isCompaction(entry) && agentFor(entry) === MAIN_AGENT;

const scanEntries = (entries: TranscriptEntry[]): Scan => {
  const scan: Scan = {
    calls: [],
    hooks: [],
    compactionPositions: [],
    usage: new Map(),
    models: new Set(),
    sessions: new Set(),
    agents: new Set(),
  };
  entries.forEach((entry, at) => {
    scan.agents.add(agentFor(entry));
    if (entry.sessionId !== undefined) scan.sessions.add(entry.sessionId);
    if (isMainCompaction(entry)) scan.compactionPositions.push(at);
    if (entry.type === 'assistant') recordAssistant(scan, entry, at);
    else recordOther(scan, entry, at);
  });
  return scan;
};

const uniqueHooks = (hooks: RawHook[]): RawHook[] => {
  const seen = new Set<string>();
  return hooks.filter((hook) => {
    if (hook.toolUseId === null) return true;
    const key = `${hook.match.kind}:${hook.toolUseId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const countCompactions = (entries: TranscriptEntry[]): number => {
  const main = entries.filter((entry) => agentFor(entry) === MAIN_AGENT);
  const boundaries = main.filter(
    (entry) => entry.type === 'system' && entry.subtype === 'compact_boundary',
  ).length;
  const summaries = main.filter(
    (entry) => entry.isCompactSummary === true,
  ).length;
  return Math.max(boundaries, summaries);
};

interface Judged {
  outcome: Outcome;
  nextIndex: number | null;
}

const judge = (
  callIndex: number,
  keys: string[],
  context: { calls: ToolCall[]; hooked: Set<string>; roots: string[] },
): Judged => {
  const { calls, hooked, roots } = context;
  const nextIndex = calls.findIndex(
    (call, index) =>
      index > callIndex &&
      targetsOf(call, roots).some((target) => keys.includes(target)) &&
      (!call.failed || hooked.has(call.id)),
  );
  if (nextIndex === -1) return { outcome: 'abandoned', nextIndex: null };
  const next = calls[nextIndex] as ToolCall;
  if (hooked.has(next.id)) return { outcome: 'flagged-again', nextIndex };
  if (BYPASS.test(contentOf(next))) return { outcome: 'bypassed', nextIndex };
  if (next.name === 'Bash') {
    return { outcome: 'shell-write-unflagged', nextIndex };
  }
  return { outcome: 'fixed', nextIndex };
};

const findingFiles = (findings: HookFinding[], roots: string[]): string[] => [
  ...new Set(findings.map((finding) => pathKey(roots, finding.file))),
];

const filesOf = (
  call: ToolCall,
  findings: HookFinding[],
  roots: string[],
): string[] => {
  if (call.input.file_path !== undefined) {
    return [pathKey(roots, call.input.file_path)];
  }
  return findingFiles(findings, roots);
};

const touchesGuardrail = (call: ToolCall, roots: string[]): boolean =>
  !call.failed &&
  targetsOf(call, roots).some((target) => GUARDRAIL_FILE.test(target));

const reportOutcome = (
  judged: Outcome,
  files: string[],
  timestamp: string | null,
  checkpoints: LintCheckpoint[],
): Outcome => {
  if (DECIDED_BY_THE_HOOK.has(judged)) return judged;
  const checkpoint = checkpointAfter(checkpoints, timestamp);
  if (checkpoint === null) return 'unknown';
  if (errorsIn(checkpoint, files) > 0) return 'kept';
  return 'fixed';
};

const hookEvent = (
  hook: RawHook,
  scan: Scan,
  context: {
    hooked: Set<string>;
    roots: string[];
    checkpoints: LintCheckpoint[];
  },
): HookEvent => {
  const { hooked, roots, checkpoints } = context;
  const findings = parseFindings(hook.text);
  const afterCompaction = scan.compactionPositions.some(
    (position) => position < hook.position,
  );
  const callIndex = scan.calls.findIndex((call) => call.id === hook.toolUseId);
  const call = scan.calls[callIndex];
  const base = {
    agent: hook.agent,
    kind: hook.match.kind,
    cause: hook.match.cause,
    toolUseId: hook.toolUseId,
    violations: violationsIn(hook.match, findings),
    findings,
    afterCompaction,
    timestamp: hook.timestamp,
  };
  if (call === undefined) {
    const files = findingFiles(findings, roots);
    let outcome: Outcome = 'unknown';
    if (hook.match.kind === 'report' && files.length > 0) {
      outcome = reportOutcome('unknown', files, hook.timestamp, checkpoints);
    }
    return {
      ...base,
      tool: null,
      file: files[0] ?? null,
      files,
      outcome,
      callsUntilNext: null,
      touchedGuardrails: false,
    };
  }
  const files = filesOf(call, findings, roots);
  if (files.length === 0) {
    return {
      ...base,
      tool: call.name,
      file: null,
      files,
      outcome: 'unknown',
      callsUntilNext: null,
      touchedGuardrails: false,
    };
  }
  const judged = judge(callIndex, files, {
    calls: scan.calls,
    hooked,
    roots,
  });
  const end = judged.nextIndex ?? scan.calls.length;
  const between = scan.calls.slice(callIndex + 1, end);
  let callsUntilNext: number | null = null;
  if (judged.nextIndex !== null) callsUntilNext = judged.nextIndex - callIndex;
  let outcome = judged.outcome;
  if (hook.match.kind === 'report') {
    outcome = reportOutcome(outcome, files, hook.timestamp, checkpoints);
  }
  return {
    ...base,
    tool: call.name,
    file: files[0] ?? null,
    files,
    outcome,
    callsUntilNext,
    touchedGuardrails: between.some((other) => touchesGuardrail(other, roots)),
  };
};

const tally = (
  events: HookEvent[],
  kind: HookKind,
): Record<Outcome, number> => {
  const counts = emptyOutcomes();
  for (const event of events) {
    if (event.kind === kind) counts[event.outcome] += 1;
  }
  return counts;
};

const zeroTokens = (): TokenTotals => ({
  input: 0,
  output: 0,
  cacheCreation: 0,
  cacheRead: 0,
});

const addUsage = (totals: TokenTotals, usage: Usage): void => {
  totals.input += usage.input_tokens ?? 0;
  totals.output += usage.output_tokens ?? 0;
  totals.cacheCreation += usage.cache_creation_input_tokens ?? 0;
  totals.cacheRead += usage.cache_read_input_tokens ?? 0;
};

const sumTokens = (scan: Scan): TokenTotals => {
  const totals = zeroTokens();
  for (const { usage } of scan.usage.values()) addUsage(totals, usage);
  return totals;
};

const tokensByAgent = (scan: Scan): Record<string, TokenTotals> => {
  const byAgent: Record<string, TokenTotals> = {};
  for (const { agent, usage } of scan.usage.values()) {
    const totals = byAgent[agent] ?? zeroTokens();
    addUsage(totals, usage);
    byAgent[agent] = totals;
  }
  return byAgent;
};

const isAfter = (positions: number[], at: number): boolean =>
  positions.some((position) => position < at);

const shellWrites = (
  scan: Scan,
  hooked: Set<string>,
  roots: string[],
): ShellWrite[] =>
  scan.calls
    .filter((call) => call.name === 'Bash' && !call.failed)
    .flatMap((call) => {
      const targets = targetsOf(call, roots).filter((target) =>
        SOURCE_FILE.test(target),
      );
      if (targets.length === 0) return [];
      return [
        {
          agent: call.agent,
          command: (call.input.command ?? '').slice(0, COMMAND_PREVIEW),
          targets,
          flagged: hooked.has(call.id),
          afterCompaction: isAfter(scan.compactionPositions, call.position),
        },
      ];
    });

const guardrailEdits = (scan: Scan, roots: string[]): GuardrailEdit[] =>
  scan.calls
    .filter((call) => touchesGuardrail(call, roots))
    .map((call) => ({
      agent: call.agent,
      tool: call.name,
      targets: targetsOf(call, roots).filter((target) =>
        GUARDRAIL_FILE.test(target),
      ),
      afterCompaction: isAfter(scan.compactionPositions, call.position),
    }));

export const analyzeTranscript = (
  entries: TranscriptEntry[],
  roots: string[],
  checkpoints: LintCheckpoint[] = [],
): TranscriptReport => {
  const scan = scanEntries(entries);
  const hooks = uniqueHooks(scan.hooks);
  const hooked = new Set(
    hooks.flatMap((hook) => {
      if (hook.toolUseId === null) return [];
      return [hook.toolUseId];
    }),
  );
  const hookEvents = hooks.map((hook) =>
    hookEvent(hook, scan, { hooked, roots, checkpoints }),
  );
  return {
    sessions: [...scan.sessions].sort(),
    models: [...scan.models].sort(),
    agents: [...scan.agents].sort(),
    toolCalls: scan.calls.length,
    compactions: countCompactions(entries),
    tokens: sumTokens(scan),
    tokensByAgent: tokensByAgent(scan),
    hookEvents,
    blockOutcomes: tally(hookEvents, 'block'),
    reportOutcomes: tally(hookEvents, 'report'),
    shellWritesToSource: shellWrites(scan, hooked, roots),
    guardrailEdits: guardrailEdits(scan, roots),
  };
};
