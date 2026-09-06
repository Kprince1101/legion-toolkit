import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import {
  elementName,
  findAttribute,
  hasAttribute,
  staticValue,
} from '../jsx.js';

const DEAD_HREFS = new Set(['', '#']);

const isDeadHref = (value: string | null): boolean => {
  if (value === null) return false;
  if (DEAD_HREFS.has(value.trim())) return true;
  return /^javascript:/i.test(value.trim());
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'An anchor navigates. A thing that runs a handler and goes nowhere is a button, not an <a href="#">.',
      standard: 'LEGION-STANDARDS section 3',
    },
    schema: [],
    messages: {
      notAnAnchor:
        'This `<a>` runs a handler and navigates nowhere (LEGION-STANDARDS section 3). It is skipped by keyboard navigation, breaks middle-click and opens a junk history entry. Use `<button type="button">` and style it as a link.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      JSXOpeningElement: (node: TSESTree.JSXOpeningElement) => {
        if (elementName(node) !== 'a') return;
        if (!hasAttribute(node, 'onClick')) return;
        const href = findAttribute(node, 'href');
        if (href === null) {
          report({ loc: node.loc, messageId: 'notAnAnchor' });
          return;
        }
        if (!isDeadHref(staticValue(href))) return;
        report({ loc: node.loc, messageId: 'notAnAnchor' });
      },
    };
  },
};

export default rule;
