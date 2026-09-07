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
export type { SteerTarget } from './targets.js';
