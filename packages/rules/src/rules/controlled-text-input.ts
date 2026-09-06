import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import {
  elementName,
  findAttribute,
  hasAttribute,
  hasSpread,
  isFalseLiteral,
  isTrueAttribute,
} from '../jsx.js';

const INPUTS = new Set(['TextInput', 'ThemedTextInput']);

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A TextInput with a value and no onChangeText renders a field that cannot be typed into.',
      standard: 'LEGION-STANDARDS section 3',
    },
    schema: [],
    messages: {
      frozen:
        '`<{{name}}>` has `value` and no `onChangeText` (LEGION-STANDARDS section 3). React Native holds the field at that value, so typing does nothing and it looks like a bug in the keyboard. Add `onChangeText`, or use `defaultValue` for an uncontrolled field, or set `editable={false}` if it really is read-only.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      JSXOpeningElement: (node: TSESTree.JSXOpeningElement) => {
        const name = elementName(node);
        if (name === null || !INPUTS.has(name)) return;
        if (hasSpread(node)) return;
        if (!hasAttribute(node, 'value')) return;
        if (hasAttribute(node, 'onChangeText')) return;
        if (hasAttribute(node, 'onChange')) return;
        const editable = findAttribute(node, 'editable');
        if (isFalseLiteral(editable)) return;
        if (isTrueAttribute(findAttribute(node, 'readOnly'))) return;
        report({ loc: node.loc, messageId: 'frozen', data: { name } });
      },
    };
  },
};

export default rule;
