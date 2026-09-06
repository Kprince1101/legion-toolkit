export { detect, detectAgents, presetFor, linterFor } from './detect.js';
export { buildPlan, missingScripts } from './plan.js';
export { applyPlan, applyManifest } from './apply.js';
export { renderPlan } from './report.js';
export {
  oxlintConfig,
  eslintConfig,
  tsconfigFor,
  tsconfigBase,
  lintScript,
  devDependencies,
  installCommand,
  presetPath,
  PRESET_FILE,
} from './templates.js';
export type * from './types.js';
