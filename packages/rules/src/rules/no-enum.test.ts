import rule from './no-enum.js';
import { runRule } from '../test-utils.js';

runRule('no-enum', rule, {
  valid: [
    { code: "type LeadStatus = 'unclaimed' | 'claimed';" },
    {
      code: "const STATUS = { unclaimed: 'unclaimed', claimed: 'claimed' } as const;",
    },
  ],
  invalid: [
    {
      code: 'enum LeadStatus { Unclaimed, Claimed }',
      errors: [{ messageId: 'noEnum', data: { name: 'LeadStatus' } }],
    },
    {
      code: 'export const enum Color { Red = "red" }',
      errors: [{ messageId: 'noEnum', data: { name: 'Color' } }],
    },
    {
      code: 'declare enum Mode { A }',
      errors: [{ messageId: 'noEnum', data: { name: 'Mode' } }],
    },
  ],
});
