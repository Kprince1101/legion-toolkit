import type { InitPlan, PlannedAction } from './types.js';

const ICONS: Record<PlannedAction['kind'], string> = {
  create: 'create',
  merge: 'merge ',
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
      'Files marked merge are edited in place; nothing is ever overwritten.',
    );
  }
  lines.push('', 'INSTALL', ...plan.install.map((line) => `  ${line}`), '');
  return lines.join('\n');
};
