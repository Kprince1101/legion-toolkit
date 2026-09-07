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
  ['PreToolUse', 'Write'],
  ['PostToolUse', 'Edit|Write'],
];

const hasCommand = (matchers: Matcher[], matcher: string): boolean =>
  matchers.some(
    (entry) =>
      entry.matcher === matcher &&
      (entry.hooks ?? []).some((hook) => hook.command === HOOK_COMMAND),
  );

export const mergeSettings = (
  settings: Settings,
): { settings: Settings; added: string[] } => {
  const hooks = { ...(settings.hooks ?? {}) };
  const added: string[] = [];
  for (const [event, matcher] of WANTED) {
    const existing = [...(hooks[event] ?? [])];
    if (hasCommand(existing, matcher)) continue;
    existing.push({
      matcher,
      hooks: [{ type: 'command', command: HOOK_COMMAND }],
    });
    hooks[event] = existing;
    added.push(`${event} ${matcher}`);
  }
  return { settings: { ...settings, hooks }, added };
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

export const registerHooks = (root: string): string[] => {
  const current = readSettings(root);
  const { settings, added } = mergeSettings(current);
  if (added.length === 0) return [];
  const path = join(root, SETTINGS_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
  return added;
};
