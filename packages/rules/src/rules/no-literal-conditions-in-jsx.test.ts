import rule from './no-literal-conditions-in-jsx.js';
import { runRule } from '../test-utils.js';

runRule('no-literal-conditions-in-jsx', rule, {
  valid: [
    {
      code: 'export const A = ({ showExitDemo }: AProps) => <div>{showExitDemo && <ExitDemo />}</div>;',
    },
    {
      code: 'export const A = ({ isPrimary }: AProps) => <button className={cn(isPrimary && "primary")} />;',
    },
    {
      code: 'export const A = ({ items }: AProps) => <ul>{items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>;',
    },
    {
      code: 'export const A = () => <div>{count === total && <Done />}</div>;',
    },
    {
      code: 'export const A = () => <input onChange={(event) => { if (event.key === "Enter") submit(); }} />;',
    },
  ],
  invalid: [
    {
      code: 'export const A = ({ slug }: AProps) => <div>{slug === "42-kitchen" && <ExitDemo />}</div>;',
      errors: [
        { messageId: 'literalCondition', data: { literal: '"42-kitchen"' } },
      ],
    },
    {
      code: 'export const A = ({ status }: AProps) => <Badge tone={status !== "won"} />;',
      errors: [{ messageId: 'literalCondition', data: { literal: '"won"' } }],
    },
    {
      code: 'export const A = ({ count }: AProps) => <div>{count > 0 && <List />}</div>;',
      errors: [{ messageId: 'literalCondition', data: { literal: '0' } }],
    },
    {
      code: 'export const A = ({ role }: AProps) => <div>{"admin" === role && <Admin />}</div>;',
      errors: [{ messageId: 'literalCondition', data: { literal: '"admin"' } }],
    },
  ],
});
