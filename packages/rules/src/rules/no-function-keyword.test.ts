import rule from './no-function-keyword.js';
import { runRule } from '../test-utils.js';

runRule('no-function-keyword', rule, {
  valid: [
    { code: 'export const format = (cents: number) => `$${cents / 100}`;' },
    { code: 'const Page = async () => null;\nexport default Page;' },
    { code: 'class Boundary { render() { return null; } }' },
    {
      code: 'const obj = { method() { return 1; }, get value() { return 2; } };',
    },
    { code: 'function* ids() { yield 1; }' },
    { code: 'const counter = function () { return this.count; };' },
    { code: 'function legacy() { return arguments.length; }' },
    { code: 'declare function external(id: string): void;' },
    {
      code: 'export function overload(a: string): string;\nexport function overload(a: number): number;\nexport function overload(a: unknown) { return this; }',
    },
  ],
  invalid: [
    {
      code: 'export function format(cents: number) { return cents; }',
      errors: [{ messageId: 'declaration', data: { name: 'format' } }],
    },
    {
      code: 'export default function Page() { return null; }',
      errors: [{ messageId: 'defaultExport', data: { name: 'Page' } }],
    },
    {
      code: 'const handlers = { onSelect: function (id: string) { return id; } };',
      errors: [{ messageId: 'expression' }],
    },
    {
      code: 'items.map(function (item) { return item.id; });',
      errors: [{ messageId: 'expression' }],
    },
    {
      code: 'export const useThing = () => { function inner() { return 1; } return inner; };',
      errors: [{ messageId: 'declaration', data: { name: 'inner' } }],
    },
  ],
});
