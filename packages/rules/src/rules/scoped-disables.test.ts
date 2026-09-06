import rule from './scoped-disables.js';
import { runRule } from '../test-utils.js';

runRule('scoped-disables', rule, {
  valid: [
    { code: 'export const a = 1;' },
    {
      code: '// eslint-disable-next-line no-console -- cli prints usage\nconsole.log(1);',
    },
    {
      code: '// oxlint-disable-next-line no-console, no-alert -- both needed here\nconsole.log(1);',
    },
    { code: '/* eslint-enable no-console */\nexport const a = 1;' },
    {
      code: '// eslint-disable-next-line no-console -- allowed rule\nconsole.log(1);',
      options: [{ locked: ['no-enum'] }],
    },
  ],
  invalid: [
    {
      code: '/* eslint-disable no-console */\nconsole.log(1);',
      errors: [{ messageId: 'unscoped' }],
    },
    {
      code: 'console.log(1); // eslint-disable-line no-console -- same line',
      errors: [{ messageId: 'lineForm' }],
    },
    {
      code: '// eslint-disable-next-line\nconsole.log(1);',
      errors: [{ messageId: 'unnamed' }],
    },
    {
      code: '// eslint-disable-next-line no-console\nconsole.log(1);',
      errors: [{ messageId: 'unexplained' }],
    },
    {
      code: '// oxlint-disable-next-line legion/no-enum -- vendor types\nexport const a = 1;',
      options: [{ locked: ['no-enum'] }],
      errors: [
        { messageId: 'locked', data: { line: '1', rule: 'legion/no-enum' } },
      ],
    },
    {
      code: '// eslint-disable-next-line rule-to-test/scoped-disables -- trying to escape\nexport const a = 1;',
      errors: [
        {
          messageId: 'locked',
          data: { line: '1', rule: 'rule-to-test/scoped-disables' },
        },
      ],
    },
  ],
});
