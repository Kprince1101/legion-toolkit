import rule from './no-target-blank-without-rel.js';
import { runRule } from '../test-utils.js';

runRule('no-target-blank-without-rel', rule, {
  valid: [
    {
      code: 'export const A = () => <a href={u} target="_blank" rel="noopener noreferrer">x</a>;',
    },
    {
      code: 'export const A = () => <a href={u} target="_blank" rel="noreferrer">x</a>;',
    },
    { code: 'export const A = () => <a href={u}>x</a>;' },
    { code: 'export const A = () => <a href={u} target="_self">x</a>;' },
    { code: 'export const A = ({ p }) => <a target="_blank" {...p}>x</a>;' },
  ],
  invalid: [
    {
      code: 'export const A = () => <a href={u} target="_blank">x</a>;',
      errors: [{ messageId: 'missingRel' }],
    },
    {
      code: 'export const A = () => <a href={u} target="_blank" rel="nofollow">x</a>;',
      errors: [{ messageId: 'missingRel' }],
    },
    {
      code: 'export const A = () => <form action={u} target="_blank" />;',
      errors: [{ messageId: 'missingRel' }],
    },
  ],
});
