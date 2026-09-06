import rule from './no-array-index-key.js';
import { runRule } from '../test-utils.js';

runRule('no-array-index-key', rule, {
  valid: [
    {
      code: 'export const A = ({ items }) => <>{items.map((item) => <Row key={item.id} />)}</>;',
    },
    {
      code: 'export const A = ({ items }) => <>{items.map((item, i) => <Row key={item.id} index={i} />)}</>;',
    },
    {
      code: 'export const A = ({ items }) => <>{items.map((item) => <Row key={`row-${item.id}`} />)}</>;',
    },
    { code: 'export const A = ({ i }) => <Row key={i} />;' },
  ],
  invalid: [
    {
      code: 'export const A = ({ items }) => <>{items.map((item, i) => <Row key={i} />)}</>;',
      errors: [{ messageId: 'indexKey', data: { index: 'i' } }],
    },
    {
      code: 'export const A = ({ items }) => <>{items.map((item, index) => <Row key={`row-${index}`} />)}</>;',
      errors: [{ messageId: 'indexKey', data: { index: 'index' } }],
    },
    {
      code: 'export const A = ({ items }) => <>{items.map((item, i) => <Row key={i + 1} />)}</>;',
      errors: [{ messageId: 'indexKey', data: { index: 'i' } }],
    },
  ],
});
