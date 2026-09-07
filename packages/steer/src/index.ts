export { renderBlock, START, END } from './block.js';
export type { BlockInput } from './block.js';
export {
  mergeBlock,
  writeManagedBlock,
  checkManagedBlock,
  readFileOrEmpty,
} from './managed.js';
export type { MergeOutcome, MergeResult, WriteTarget } from './managed.js';
export { TARGETS, detectTargets, resolveTargets } from './targets.js';
export {
  evaluate,
  parsePayload,
  verdictFor,
  isLintable,
  lintContent,
  lintFile,
  renderFindings,
  relabel,
} from './hook.js';
export type { HookPayload, HookVerdict } from './hook.js';
export {
  mergeSettings,
  registerHooks,
  readSettings,
  HOOK_COMMAND,
  SETTINGS_FILE,
  WANTED,
} from './settings.js';
export type { SteerTarget } from './targets.js';
