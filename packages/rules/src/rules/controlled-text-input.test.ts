import rule from './controlled-text-input.js';
import { runRule } from '../test-utils.js';

runRule('controlled-text-input', rule, {
  valid: [
    {
      code: 'export const A = () => <TextInput value={name} onChangeText={setName} />;',
    },
    { code: 'export const A = () => <TextInput defaultValue={name} />;' },
    {
      code: 'export const A = () => <TextInput value={name} editable={false} />;',
    },
    { code: 'export const A = () => <TextInput value={name} readOnly />;' },
    { code: 'export const A = ({ p }) => <TextInput value={name} {...p} />;' },
    { code: 'export const A = () => <TextInput placeholder="Name" />;' },
  ],
  invalid: [
    {
      code: 'export const A = () => <TextInput value={name} />;',
      errors: [{ messageId: 'frozen', data: { name: 'TextInput' } }],
    },
    {
      code: 'export const A = () => <TextInput value={name} editable={true} />;',
      errors: [{ messageId: 'frozen', data: { name: 'TextInput' } }],
    },
  ],
});
