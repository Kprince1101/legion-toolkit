import rule from './anchor-is-not-a-button.js';
import { runRule } from '../test-utils.js';

runRule('anchor-is-not-a-button', rule, {
  valid: [
    {
      code: 'export const A = () => <a href="/about" onClick={track}>About</a>;',
    },
    { code: 'export const A = () => <a href={url}>Link</a>;' },
    {
      code: 'export const A = () => <button type="button" onClick={go}>Go</button>;',
    },
  ],
  invalid: [
    {
      code: 'export const A = () => <a href="#" onClick={go}>Go</a>;',
      errors: [{ messageId: 'notAnAnchor' }],
    },
    {
      code: 'export const A = () => <a onClick={go}>Go</a>;',
      errors: [{ messageId: 'notAnAnchor' }],
    },
    {
      code: 'export const A = () => <a href="javascript:void(0)" onClick={go}>Go</a>;',
      errors: [{ messageId: 'notAnAnchor' }],
    },
  ],
});
