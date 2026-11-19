import { basename } from 'node:path';

export interface Step {
  name: string;
  file: string;
}

export const listSteps = (files: string[]): Step[] =>
  files
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => ({ name: basename(file, '.md'), file }));

export const stepsFrom = (steps: Step[], from: string | null): Step[] => {
  if (from === null) return steps;
  const start = steps.findIndex(
    (step) => step.name === from || step.name.startsWith(`${from}-`),
  );
  if (start === -1) throw new Error(`no prompt step named ${from}`);
  return steps.slice(start);
};

export interface ClaudeInvocation {
  model: string;
  permissionMode: string;
  resume: string | null;
}

export const claudeArgs = (invocation: ClaudeInvocation): string[] => {
  const args = [
    '-p',
    '--output-format',
    'json',
    '--model',
    invocation.model,
    '--permission-mode',
    invocation.permissionMode,
  ];
  if (invocation.resume !== null) args.push('--resume', invocation.resume);
  return args;
};

export const isResultFile = (file: string): boolean =>
  file.endsWith('.json') && !file.endsWith('.audit.json');
