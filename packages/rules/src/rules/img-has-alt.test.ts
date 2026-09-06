import rule from './img-has-alt.js';
import { runRule } from '../test-utils.js';

runRule('img-has-alt', rule, {
  valid: [
    { code: 'export const A = () => <img src={s} alt="A cat" />;' },
    { code: 'export const A = () => <img src={s} alt="" />;' },
    { code: 'export const A = ({ p }) => <img {...p} />;' },
    { code: 'export const A = () => <Image src={s} alt="x" />;' },
  ],
  invalid: [
    {
      code: 'export const A = () => <img src={s} />;',
      errors: [{ messageId: 'missingAlt', data: { name: 'img' } }],
    },
    {
      code: 'export const A = () => <Image src={s} />;',
      errors: [{ messageId: 'missingAlt', data: { name: 'Image' } }],
    },
  ],
});
