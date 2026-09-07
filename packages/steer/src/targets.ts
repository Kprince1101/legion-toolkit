import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface SteerTarget {
  id: string;
  label: string;
  file: string;
  detect: string;
}

export const TARGETS: SteerTarget[] = [
  { id: 'agents', label: 'AGENTS.md', file: 'AGENTS.md', detect: 'AGENTS.md' },
  {
    id: 'junie',
    label: 'Junie',
    file: join('.junie', 'guidelines.md'),
    detect: '.junie',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    file: join('.cursor', 'rules', 'legion.mdc'),
    detect: '.cursor',
  },
  {
    id: 'copilot',
    label: 'Copilot',
    file: join('.github', 'copilot-instructions.md'),
    detect: join('.github', 'copilot-instructions.md'),
  },
];

export const detectTargets = (root: string): SteerTarget[] =>
  TARGETS.filter((target) => existsSync(join(root, target.detect)));

export const resolveTargets = (
  root: string,
  requested: string[],
): SteerTarget[] => {
  if (requested.length === 0) {
    const detected = detectTargets(root);
    if (detected.length > 0) return detected;
    return TARGETS.filter((target) => target.id === 'agents');
  }
  return TARGETS.filter((target) => requested.includes(target.id));
};
