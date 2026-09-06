import rule from './no-dangerous-html.js';
import { runRule } from '../test-utils.js';

runRule('no-dangerous-html', rule, {
  valid: [
    { code: 'export const A = ({ body }) => <div>{body}</div>;' },
    { code: 'export const A = () => <div className="x" />;' },
  ],
  invalid: [
    {
      code: 'export const A = ({ body }) => <div dangerouslySetInnerHTML={{ __html: body }} />;',
      errors: [{ messageId: 'dangerous' }],
    },
  ],
});
