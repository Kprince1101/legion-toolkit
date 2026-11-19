import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const SETTINGS_FILE = join('.claude', 'settings.json');

export const HOOK_COMMAND = 'npx legion-steer hook';

interface HookEntry {
  type?: string;
  command?: string;
}

interface Matcher {
  matcher?: string;
  hooks?: HookEntry[];
}

interface Settings {
  hooks?: Record<string, Matcher[]>;
  [key: string]: unknown;
}

export const WANTED: Array<[string, string]> = [
  ['PreToolUse', 'Write|Edit|MultiEdit|NotebookEdit|Bash'],
  ['PostToolUse', 'Write|Edit|MultiEdit|Bash'],
];

export interface HookChanges {
  added: string[];
  removed: string[];
}

const isOurs = (hook: HookEntry): boolean => hook.command === HOOK_COMMAND;

const hasCommand = (matchers: Matcher[], matcher: string): boolean =>
  matchers.some(
    (entry) => entry.matcher === matcher && (entry.hooks ?? []).some(isOurs),
  );

const withoutStale = (
  event: string,
  matchers: Matcher[],
  keep: string,
): { matchers: Matcher[]; removed: string[] } => {
  const removed: string[] = [];
  const kept: Matcher[] = [];
  for (const entry of matchers) {
    const hooks = entry.hooks ?? [];
    if (entry.matcher === keep || !hooks.some(isOurs)) {
      kept.push(entry);
      continue;
    }
    removed.push(`${event} ${entry.matcher ?? '*'}`);
    const others = hooks.filter((hook) => !isOurs(hook));
    if (others.length > 0) kept.push({ ...entry, hooks: others });
  }
  return { matchers: kept, removed };
};

export const mergeSettings = (
  settings: Settings,
): { settings: Settings } & HookChanges => {
  const hooks = { ...(settings.hooks ?? {}) };
  const added: string[] = [];
  const removed: string[] = [];
  for (const [event, matcher] of WANTED) {
    const pruned = withoutStale(event, hooks[event] ?? [], matcher);
    removed.push(...pruned.removed);
    const existing = [...pruned.matchers];
    if (!hasCommand(existing, matcher)) {
      existing.push({
        matcher,
        hooks: [{ type: 'command', command: HOOK_COMMAND }],
      });
      added.push(`${event} ${matcher}`);
    }
    hooks[event] = existing;
  }
  return { settings: { ...settings, hooks }, added, removed };
};

export const readSettings = (root: string): Settings => {
  const path = join(root, SETTINGS_FILE);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Settings;
  } catch {
    throw new Error(
      `${SETTINGS_FILE} could not be parsed as JSON, so it was left untouched.`,
    );
  }
};

export const registerHooks = (root: string): HookChanges => {
  const current = readSettings(root);
  const { settings, added, removed } = mergeSettings(current);
  if (added.length === 0 && removed.length === 0) return { added, removed };
  const path = join(root, SETTINGS_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
  return { added, removed };
};
