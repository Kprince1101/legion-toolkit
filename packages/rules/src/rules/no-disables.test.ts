import rule from './no-disables.js';
import { runRule } from '../test-utils.js';

runRule('no-disables', rule, {
  valid: [
    { code: 'export const a = 1;' },
    { code: '// a plain comment\nexport const a = 1;' },
    { code: '// @ts-expect-error\nexport const a: number = "x";' },
  ],
  invalid: [
    {
      code: '// eslint-disable-next-line no-console -- reason\nconsole.log(1);',
      errors: [
        {
          messageId: 'bypass',
          data: { line: '1', directive: 'eslint-disable no-console' },
        },
      ],
    },
    {
      code: '/* oxlint-disable */\nexport const a = 1;',
      errors: [
        {
          messageId: 'bypass',
          data: { line: '1', directive: 'oxlint-disable' },
        },
      ],
    },
    {
      code: '/* eslint-enable no-console */\nexport const a = 1;',
      errors: [{ messageId: 'bypass' }],
    },
  ],
});
