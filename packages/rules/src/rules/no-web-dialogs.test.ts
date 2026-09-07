import rule from './no-web-dialogs.js';
import { runRule } from '../test-utils.js';

runRule('no-web-dialogs', rule, {
  valid: [
    {
      code: "import { Alert } from 'react-native';\nexport const a = () => Alert.alert('Saved');",
    },
    {
      code: "import { Alert } from 'react-native';\nexport const a = () => Alert.alert('Delete?', '', [{ text: 'Cancel' }, { text: 'Delete', onPress: go }]);",
    },
    { code: 'export const a = ({ alert }) => alert("hi");' },
    {
      code: 'export const a = () => { const confirm = () => true; return confirm(); };',
    },
    { code: 'export const a = () => toast.alert("hi");' },
  ],
  invalid: [
    {
      code: 'export const a = () => alert("Saved");',
      errors: [{ messageId: 'deprecated', data: { name: 'alert' } }],
    },
    {
      code: 'export const a = () => window.alert("Saved");',
      errors: [{ messageId: 'deprecated', data: { name: 'alert' } }],
    },
    {
      code: 'export const a = () => { if (confirm("Delete?")) go(); };',
      errors: [{ messageId: 'missing', data: { name: 'confirm' } }],
    },
    {
      code: 'export const a = () => prompt("Name?");',
      errors: [{ messageId: 'missing', data: { name: 'prompt' } }],
    },
    {
      code: 'export const a = () => globalThis.confirm("Delete?");',
      errors: [{ messageId: 'missing', data: { name: 'confirm' } }],
    },
  ],
});
