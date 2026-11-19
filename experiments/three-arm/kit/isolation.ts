import { dirname, join, resolve } from 'node:path';

const INSTRUCTION_FILES = [
  'CLAUDE.md',
  'CLAUDE.local.md',
  'AGENTS.md',
  join('.claude', 'CLAUDE.md'),
  join('.claude', 'settings.json'),
  join('.claude', 'settings.local.json'),
];

export const ancestorsOf = (directory: string): string[] => {
  const found: string[] = [];
  let current = resolve(directory);
  let parent = dirname(current);
  while (parent !== current) {
    found.push(parent);
    current = parent;
    parent = dirname(current);
  }
  return found;
};

export const inheritedInstructions = (
  runDir: string,
  exists: (path: string) => boolean,
  ignore: string[],
): string[] => {
  const skipped = new Set(ignore.map((path) => resolve(path)));
  return [resolve(runDir), ...ancestorsOf(runDir)].flatMap((directory) =>
    INSTRUCTION_FILES.map((file) => join(directory, file)).filter(
      (path) => !skipped.has(path) && exists(path),
    ),
  );
};

export const userConfigWarnings = (
  configDir: string,
  read: (path: string) => string | null,
): string[] => {
  const warnings: string[] = [];
  const memory = read(join(configDir, 'CLAUDE.md'));
  if (memory !== null && memory.trim().length > 0) {
    warnings.push(
      `${join(configDir, 'CLAUDE.md')} is not empty; every arm will read it`,
    );
  }
  const settings = read(join(configDir, 'settings.json'));
  if (settings !== null && settings.includes('"hooks"')) {
    warnings.push(
      `${join(configDir, 'settings.json')} registers hooks; they run in every arm`,
    );
  }
  return warnings;
};

export const projectSlug = (directory: string): string =>
  directory.replace(/[^a-zA-Z0-9]/g, '-');
