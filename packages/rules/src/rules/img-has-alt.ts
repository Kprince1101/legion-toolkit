import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { elementName, findAttribute, hasSpread } from '../jsx.js';

const IMAGE_ELEMENTS = new Set(['img', 'Image']);

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every image carries alt text, or an explicit empty alt when it is decorative.',
      standard: 'LEGION-STANDARDS section 3',
    },
    schema: [],
    messages: {
      missingAlt:
        '`<{{name}}>` has no `alt` (LEGION-STANDARDS section 3). A screen reader falls back to reading the file name. Describe the image, or pass `alt=""` to mark it decorative.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      JSXOpeningElement: (node: TSESTree.JSXOpeningElement) => {
        const name = elementName(node);
        if (name === null || !IMAGE_ELEMENTS.has(name)) return;
        if (hasSpread(node)) return;
        if (findAttribute(node, 'alt') !== null) return;
        report({ loc: node.loc, messageId: 'missingAlt', data: { name } });
      },
    };
  },
};

export default rule;
