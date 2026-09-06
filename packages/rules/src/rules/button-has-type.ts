import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { elementName, findAttribute, hasSpread, staticValue } from '../jsx.js';

const VALID_TYPES = new Set(['button', 'submit', 'reset']);

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A <button> always declares its type. The HTML default is submit, so a bare button inside a form submits it.',
      standard: 'LEGION-STANDARDS section 3',
    },
    schema: [],
    messages: {
      missingType:
        '`<button>` has no `type` (LEGION-STANDARDS section 3). HTML defaults it to `submit`, so inside a form this reloads the page instead of running the handler. Add `type="button"`.',
      invalidType:
        '`type="{{value}}"` is not a button type (LEGION-STANDARDS section 3). Use `button`, `submit` or `reset`.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      JSXOpeningElement: (node: TSESTree.JSXOpeningElement) => {
        if (elementName(node) !== 'button') return;
        const attribute = findAttribute(node, 'type');
        if (!attribute) {
          if (hasSpread(node)) return;
          report({ loc: node.loc, messageId: 'missingType' });
          return;
        }
        const value = staticValue(attribute);
        if (value === null) return;
        if (VALID_TYPES.has(value)) return;
        report({
          loc: attribute.loc,
          messageId: 'invalidType',
          data: { value },
        });
      },
    };
  },
};

export default rule;
