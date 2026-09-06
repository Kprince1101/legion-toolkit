import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'dangerouslySetInnerHTML puts unescaped markup into the page. Render the value, or sanitize it behind a named helper.',
      standard: 'LEGION-STANDARDS section 5',
    },
    schema: [],
    messages: {
      dangerous:
        '`dangerouslySetInnerHTML` is not allowed here (LEGION-STANDARDS section 5). Anything in that string is executed as markup, so one unescaped value from a user or an API is stored XSS. Render the text, or sanitize behind a named helper and scope a disable to that line.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      JSXAttribute: (node: TSESTree.JSXAttribute) => {
        if (node.name.type !== 'JSXIdentifier') return;
        if (node.name.name !== 'dangerouslySetInnerHTML') return;
        report({ loc: node.loc, messageId: 'dangerous' });
      },
    };
  },
};

export default rule;
