import { toPosix } from './tree.ts';

export interface LintCheckpoint {
  at: string;
  errors: Record<string, number>;
}

interface OxlintDiagnostic {
  severity?: string;
  filename?: string;
}

const relativeTo = (root: string, file: string): string => {
  const posix = toPosix(file);
  const prefix = `${toPosix(root).replace(/\/$/, '')}/`;
  if (posix.startsWith(prefix)) return posix.slice(prefix.length);
  return posix.replace(/^\.\//, '');
};

export const errorsByFile = (
  oxlintJson: string,
  root: string,
): Record<string, number> => {
  const start = oxlintJson.indexOf('{');
  if (start === -1) return {};
  const parsed = JSON.parse(oxlintJson.slice(start)) as {
    diagnostics?: OxlintDiagnostic[];
  };
  const errors: Record<string, number> = {};
  for (const diagnostic of parsed.diagnostics ?? []) {
    if (diagnostic.severity === 'warning') continue;
    const file = relativeTo(root, diagnostic.filename ?? '');
    errors[file] = (errors[file] ?? 0) + 1;
  }
  return errors;
};

export const checkpointAfter = (
  checkpoints: LintCheckpoint[],
  timestamp: string | null,
): LintCheckpoint | null => {
  const sorted = [...checkpoints].sort((a, b) => a.at.localeCompare(b.at));
  if (timestamp === null) return sorted.at(-1) ?? null;
  return (
    sorted.find((checkpoint) => checkpoint.at > timestamp) ??
    sorted.at(-1) ??
    null
  );
};

export const errorsIn = (checkpoint: LintCheckpoint, files: string[]): number =>
  files.reduce((total, file) => total + (checkpoint.errors[file] ?? 0), 0);
