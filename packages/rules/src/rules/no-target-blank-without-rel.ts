import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { elementName, findAttribute, hasSpread, staticValue } from '../jsx.js';

const TARGETED = new Set(['a', 'area', 'form']);

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'target="_blank" always carries noopener or noreferrer in rel. Without one the opened page can navigate the tab it came from.',
      standard: 'LEGION-STANDARDS section 5',
    },
    schema: [],
    messages: {
      missingRel:
        '`target="_blank"` without `noopener` or `noreferrer` in `rel` (LEGION-STANDARDS section 5). The opened page gets a handle on this one through `window.opener` and can redirect it somewhere else while the user is away. Either value closes it; `rel="noopener noreferrer"` also drops the referrer.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      JSXOpeningElement: (node: TSESTree.JSXOpeningElement) => {
        const name = elementName(node);
        if (name === null || !TARGETED.has(name)) return;
        if (staticValue(findAttribute(node, 'target')) !== '_blank') return;
        if (hasSpread(node)) return;
        const attribute = findAttribute(node, 'rel');
        const rel = staticValue(attribute);
        if (attribute !== null && rel === null) return;
        const parts = new Set((rel ?? '').split(/\s+/).filter(Boolean));
        if (parts.has('noopener') || parts.has('noreferrer')) return;
        report({ loc: node.loc, messageId: 'missingRel' });
      },
    };
  },
};

export default rule;
