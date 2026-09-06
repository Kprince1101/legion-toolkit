import rule from './no-hardcoded-hex.js';
import { runRule } from '../test-utils.js';

runRule('no-hardcoded-hex', rule, {
  valid: [
    {
      code: "export const styles = { color: 'var(--brand)' };",
      filename: 'components/Card.tsx',
    },
    {
      code: "export const BRAND = '#0A84FF';",
      filename: 'lib/tokens.ts',
    },
    {
      code: "export const BRAND = '#0A84FF';",
      filename: 'styles/theme.ts',
    },
    {
      code: "export const anchor = '#section-one';",
      filename: 'components/Card.tsx',
    },
    {
      code: "export const BRAND = '#0A84FF';",
      filename: 'components/Card.tsx',
      options: [{ allow: ['#0a84ff'] }],
    },
  ],
  invalid: [
    {
      code: "export const style = { color: '#0A84FF' };",
      filename: 'components/Card.tsx',
      errors: [{ messageId: 'hardcoded', data: { value: '#0A84FF' } }],
    },
    {
      code: "export const style = { color: '#fff' };",
      filename: 'src/screens/Feed.tsx',
      errors: [{ messageId: 'hardcoded', data: { value: '#fff' } }],
    },
  ],
});
