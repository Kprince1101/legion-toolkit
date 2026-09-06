import rule from './button-has-type.js';
import { runRule } from '../test-utils.js';

runRule('button-has-type', rule, {
  valid: [
    { code: 'export const A = () => <button type="button">Go</button>;' },
    { code: 'export const A = () => <button type="submit">Go</button>;' },
    { code: 'export const A = () => <button type="reset">Go</button>;' },
    { code: 'export const A = ({ p }) => <button {...p}>Go</button>;' },
    { code: 'export const A = ({ t }) => <button type={t}>Go</button>;' },
    { code: 'export const A = () => <Button>Go</Button>;' },
  ],
  invalid: [
    {
      code: 'export const A = () => <button onClick={go}>Go</button>;',
      errors: [{ messageId: 'missingType' }],
    },
    {
      code: 'export const A = () => <button type="buton">Go</button>;',
      errors: [{ messageId: 'invalidType', data: { value: 'buton' } }],
    },
  ],
});
