export const HOOK_PREFIX = 'legion-steer: ';

export const violationsPending = (count: number): string =>
  `${count} violation(s) would land in this file`;

export const violationsWritten = (count: number): string =>
  `${count} violation(s) in the file just written`;

export const violationsCommandWrote = (count: number): string =>
  `${count} violation(s) in files this command wrote`;

export const BYPASS_PENDING =
  'this write adds a lint bypass that blinds the linter';

export const BYPASS_WRITTEN =
  'the file just written has a lint bypass that blinds the linter';
