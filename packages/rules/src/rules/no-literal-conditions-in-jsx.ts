import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { AnyNode, LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { isFunctionNode, walk } from '../ast.js';

const COMPARISONS = new Set(['===', '!==', '==', '!=', '>', '<', '>=', '<=']);

const isLiteral = (node: AnyNode): boolean => {
  if (node.type === 'Literal')
    return typeof node.value === 'string' || typeof node.value === 'number';
  return node.type === 'TemplateLiteral' && node.expressions.length === 0;
};

const describe = (node: TSESTree.BinaryExpression): string => {
  const literal = [node.left, node.right].find((side) => isLiteral(side));
  if (!literal || literal.type !== 'Literal') return 'a literal';
  return JSON.stringify(literal.value);
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A business condition never drives UI inline in JSX. Compare in the hook, return a named flag, and branch on the flag.',
      standard: 'LEGION-STANDARDS section 1',
    },
    schema: [],
    messages: {
      literalCondition:
        'Comparing against {{literal}} inside JSX is a business rule in the markup (LEGION-STANDARDS section 1). Derive a named flag in the hook (`showExitDemo`, `isPrimary`) and branch on that instead.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      JSXExpressionContainer: (node: TSESTree.JSXExpressionContainer) => {
        walk(node.expression, (child) => {
          if (isFunctionNode(child)) return true;
          if (child.type !== 'BinaryExpression') return undefined;
          if (!COMPARISONS.has(child.operator)) return undefined;
          if (!isLiteral(child.left) && !isLiteral(child.right))
            return undefined;
          report({
            loc: child.loc,
            messageId: 'literalCondition',
            data: { literal: describe(child) },
          });
          return true;
        });
      },
    };
  },
};

export default rule;
