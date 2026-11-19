import { isAbsolute, normalize } from 'node:path';
import { shellWriteTargets } from './shell.ts';
import { toPosix } from './tree.ts';

const HOOK_MARK = 'legion-steer:';
const BLOCK_MARK = 'would land in this file';
const REPORT_MARK = 'in the file just written';
const VIOLATIONS = /(\d+) violation\(s\)/;
const FINDING_LINE = /^\s+(\S+):(\d+)\s{2,}(.+)$/;
const BYPASS = /(?:eslint|oxlint)-disable|@ts-(?:ignore|expect-error|nocheck)/;
const TS_FILE = /\.(?:ts|tsx|mts|cts)$/;
const GUARDRAIL_FILE =
  /(?:^|\/)(?:\.oxlintrc\.json|\.claude\/settings(?:\.local)?\.json|CLAUDE(?:\.local)?\.md|AGENTS\.md|playwright\.config\.ts)$|(?:^|\/)acceptance\//;
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit']);
const COMMAND_PREVIEW = 200;

export type HookKind = 'block' | 'report';

export type Outcome =
  | 'fixed'
  | 'bypassed'
  | 'switched-to-edit'
  | 'shell-write'
  | 'flagged-again'
  | 'abandoned'
  | 'unknown';

export const OUTCOMES: Outcome[] = [
  'fixed',
  'bypassed',
  'switched-to-edit',
  'shell-write',
  'flagged-again',
  'abandoned',
  'unknown',
];

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
  kind: HookKind;
  toolUseId: string | null;
  tool: string | null;
  file: string | null;
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
  command: string;
  targets: string[];
  afterCompaction: boolean;
}

export interface GuardrailEdit {
  tool: string;
  targets: string[];
  afterCompaction: boolean;
}

export interface TranscriptReport {
  sessions: string[];
  models: string[];
  toolCalls: number;
  compactions: number;
  tokens: TokenTotals;
  hookEvents: HookEvent[];
  blockOutcomes: Record<Outcome, number>;
  reportOutcomes: Record<Outcome, number>;
  shellWritesToSource: ShellWrite[];
  guardrailEdits: GuardrailEdit[];
}

interface ToolCall {
  id: string;
  name: string;
  input: ToolInput;
  position: number;
  failed: boolean;
}

interface RawHook {
  kind: HookKind;
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

export const hookKind = (text: string): HookKind | null => {
  if (!text.includes(HOOK_MARK)) return null;
  if (text.includes(BLOCK_MARK)) return 'block';
  if (text.includes(REPORT_MARK)) return 'report';
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

const violationsIn = (text: string, findings: HookFinding[]): number => {
  const match = VIOLATIONS.exec(text);
  if (match === null) return findings.length;
  return Number(match[1] ?? '0');
};

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
  return [call.input.content ?? '', call.input.new_string ?? '', ...edits].join(
    '\n',
  );
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
  bypassed: 0,
  'switched-to-edit': 0,
  'shell-write': 0,
  'flagged-again': 0,
  abandoned: 0,
  unknown: 0,
});

interface Scan {
  calls: ToolCall[];
  hooks: RawHook[];
  compactionPositions: number[];
  usage: Map<string, Usage>;
  models: Set<string>;
  sessions: Set<string>;
}

const recordAssistant = (scan: Scan, entry: TranscriptEntry, at: number) => {
  const message = entry.message;
  if (message?.id !== undefined && message.usage !== undefined) {
    scan.usage.set(message.id, message.usage);
  }
  if (message?.model !== undefined) scan.models.add(message.model);
  for (const block of blocksOf(entry)) {
    if (block.type !== 'tool_use') continue;
    if (block.id === undefined || block.name === undefined) continue;
    scan.calls.push({
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
  for (const result of results) {
    const call = scan.calls.find((known) => known.id === result.tool_use_id);
    const text = stringsIn(result.content).join('\n');
    const kind = hookKind(text);
    if (kind !== null && call !== undefined && WRITE_TOOLS.has(call.name)) {
      scan.hooks.push({
        kind,
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
  const kind = hookKind(text);
  if (kind === null) return;
  const toolUseId = entry.toolUseID ?? scan.calls.at(-1)?.id ?? null;
  scan.hooks.push({ kind, toolUseId, text, position: at, timestamp });
};

const scanEntries = (entries: TranscriptEntry[]): Scan => {
  const scan: Scan = {
    calls: [],
    hooks: [],
    compactionPositions: [],
    usage: new Map(),
    models: new Set(),
    sessions: new Set(),
  };
  entries.forEach((entry, at) => {
    if (entry.sessionId !== undefined) scan.sessions.add(entry.sessionId);
    if (isCompaction(entry)) scan.compactionPositions.push(at);
    if (entry.type === 'assistant') recordAssistant(scan, entry, at);
    else recordOther(scan, entry, at);
  });
  return scan;
};

const uniqueHooks = (hooks: RawHook[]): RawHook[] => {
  const seen = new Set<string>();
  return hooks.filter((hook) => {
    if (hook.toolUseId === null) return true;
    const key = `${hook.kind}:${hook.toolUseId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const countCompactions = (entries: TranscriptEntry[]): number => {
  const boundaries = entries.filter(
    (entry) => entry.type === 'system' && entry.subtype === 'compact_boundary',
  ).length;
  const summaries = entries.filter(
    (entry) => entry.isCompactSummary === true,
  ).length;
  return Math.max(boundaries, summaries);
};

interface Judged {
  outcome: Outcome;
  nextIndex: number | null;
}

const judge = (
  hook: RawHook,
  callIndex: number,
  key: string,
  context: { calls: ToolCall[]; hooked: Set<string>; roots: string[] },
): Judged => {
  const { calls, hooked, roots } = context;
  const nextIndex = calls.findIndex(
    (call, index) =>
      index > callIndex &&
      targetsOf(call, roots).includes(key) &&
      (!call.failed || hooked.has(call.id)),
  );
  if (nextIndex === -1) return { outcome: 'abandoned', nextIndex: null };
  const next = calls[nextIndex] as ToolCall;
  if (next.name === 'Bash') return { outcome: 'shell-write', nextIndex };
  if (hooked.has(next.id)) return { outcome: 'flagged-again', nextIndex };
  if (BYPASS.test(contentOf(next))) return { outcome: 'bypassed', nextIndex };
  if (hook.kind === 'block' && EDIT_TOOLS.has(next.name)) {
    return { outcome: 'switched-to-edit', nextIndex };
  }
  return { outcome: 'fixed', nextIndex };
};

const touchesGuardrail = (call: ToolCall, roots: string[]): boolean =>
  !call.failed &&
  targetsOf(call, roots).some((target) => GUARDRAIL_FILE.test(target));

const hookEvent = (
  hook: RawHook,
  scan: Scan,
  hooked: Set<string>,
  roots: string[],
): HookEvent => {
  const findings = parseFindings(hook.text);
  const afterCompaction = scan.compactionPositions.some(
    (position) => position < hook.position,
  );
  const callIndex = scan.calls.findIndex((call) => call.id === hook.toolUseId);
  const call = scan.calls[callIndex];
  const base = {
    kind: hook.kind,
    toolUseId: hook.toolUseId,
    violations: violationsIn(hook.text, findings),
    findings,
    afterCompaction,
    timestamp: hook.timestamp,
  };
  if (call === undefined || call.input.file_path === undefined) {
    return {
      ...base,
      tool: call?.name ?? null,
      file: null,
      outcome: 'unknown',
      callsUntilNext: null,
      touchedGuardrails: false,
    };
  }
  const key = pathKey(roots, call.input.file_path);
  const judged = judge(hook, callIndex, key, {
    calls: scan.calls,
    hooked,
    roots,
  });
  const end = judged.nextIndex ?? scan.calls.length;
  const between = scan.calls.slice(callIndex + 1, end);
  let callsUntilNext: number | null = null;
  if (judged.nextIndex !== null) callsUntilNext = judged.nextIndex - callIndex;
  return {
    ...base,
    tool: call.name,
    file: key,
    outcome: judged.outcome,
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

const sumTokens = (usage: Iterable<Usage>): TokenTotals => {
  const totals: TokenTotals = {
    input: 0,
    output: 0,
    cacheCreation: 0,
    cacheRead: 0,
  };
  for (const entry of usage) {
    totals.input += entry.input_tokens ?? 0;
    totals.output += entry.output_tokens ?? 0;
    totals.cacheCreation += entry.cache_creation_input_tokens ?? 0;
    totals.cacheRead += entry.cache_read_input_tokens ?? 0;
  }
  return totals;
};

const isAfter = (positions: number[], at: number): boolean =>
  positions.some((position) => position < at);

const shellWrites = (scan: Scan, roots: string[]): ShellWrite[] =>
  scan.calls
    .filter((call) => call.name === 'Bash' && !call.failed)
    .flatMap((call) => {
      const targets = targetsOf(call, roots).filter((target) =>
        TS_FILE.test(target),
      );
      if (targets.length === 0) return [];
      return [
        {
          command: (call.input.command ?? '').slice(0, COMMAND_PREVIEW),
          targets,
          afterCompaction: isAfter(scan.compactionPositions, call.position),
        },
      ];
    });

const guardrailEdits = (scan: Scan, roots: string[]): GuardrailEdit[] =>
  scan.calls
    .filter((call) => touchesGuardrail(call, roots))
    .map((call) => ({
      tool: call.name,
      targets: targetsOf(call, roots).filter((target) =>
        GUARDRAIL_FILE.test(target),
      ),
      afterCompaction: isAfter(scan.compactionPositions, call.position),
    }));

export const analyzeTranscript = (
  entries: TranscriptEntry[],
  roots: string[],
): TranscriptReport => {
  const scan = scanEntries(entries);
  const hooks = uniqueHooks(scan.hooks);
  const hooked = new Set(
    hooks.flatMap((hook) => {
      if (hook.toolUseId === null) return [];
      return [hook.toolUseId];
    }),
  );
  const hookEvents = hooks.map((hook) => hookEvent(hook, scan, hooked, roots));
  return {
    sessions: [...scan.sessions].sort(),
    models: [...scan.models].sort(),
    toolCalls: scan.calls.length,
    compactions: countCompactions(entries),
    tokens: sumTokens(scan.usage.values()),
    hookEvents,
    blockOutcomes: tally(hookEvents, 'block'),
    reportOutcomes: tally(hookEvents, 'report'),
    shellWritesToSource: shellWrites(scan, roots),
    guardrailEdits: guardrailEdits(scan, roots),
  };
};
