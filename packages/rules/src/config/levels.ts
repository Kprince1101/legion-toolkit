import type { Level, Severity } from '../types.js';

export const LEVELS: readonly Level[] = [0, 1, 2, 3];

export const levelToSeverity = (level: Level): Severity => {
  if (level === 0) return 'off';
  if (level === 1) return 'warn';
  return 'error';
};

export const isLocked = (level: Level): boolean => level === 3;

export const isLevel = (value: unknown): value is Level =>
  typeof value === 'number' && LEVELS.includes(value as Level);

export type RuleEntry = Severity | [Severity, ...unknown[]];

export const ruleEntry = (level: Level, options?: unknown): RuleEntry => {
  const severity = levelToSeverity(level);
  if (options === undefined) return severity;
  return [severity, options];
};
