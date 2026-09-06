import type { InitPlan, PlannedAction } from './types.js';

const ICONS: Record<PlannedAction['kind'], string> = {
  create: 'create',
  merge: 'merge ',
  manual: 'manual',
  skip: 'skip  ',
};

export const renderPlan = (plan: InitPlan): string => {
  const { detection } = plan;
  const lines = [
    '',
    'legion-toolkit init',
    '',
    'DETECTED',
    `  package manager  ${detection.packageManager}`,
    `  framework        ${detection.framework}`,
    `  linter           ${detection.linter}`,
    `  preset           ${detection.preset}`,
    `  agents           ${detection.agents.join(', ') || 'none'}`,
    '',
    'PLAN',
  ];
  for (const action of plan.actions) {
    lines.push(
      `  ${ICONS[action.kind]}  ${action.path.padEnd(20)} ${action.reason}`,
    );
  }
  const merges = plan.actions.filter((action) => action.kind === 'merge');
  if (merges.length > 0) {
    lines.push(
      '',
      'merge  edits the file in place, adding only what is missing. Nothing is overwritten.',
    );
  }
  const manual = plan.actions.filter((action) => action.kind === 'manual');
  if (manual.length > 0) {
    lines.push(
      'manual is yours to apply. init does not rewrite a JavaScript config it did not write.',
    );
  }
  lines.push('', 'INSTALL', ...plan.install.map((line) => `  ${line}`), '');
  return lines.join('\n');
};
