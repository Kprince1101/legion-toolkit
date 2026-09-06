import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { AnyNode, LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { calleeName, isFunctionNode } from '../ast.js';

const ITERATORS = new Set(['map', 'forEach', 'flatMap']);

const indexParamName = (fn: AnyNode): string | null => {
  const params = (fn as { params?: AnyNode[] }).params ?? [];
  const second = params[1];
  if (!second || second.type !== 'Identifier') return null;
  return second.name;
};

const enclosingIterationIndex = (node: AnyNode): string | null => {
  let current: AnyNode | undefined = node.parent;
  while (current) {
    if (isFunctionNode(current)) {
      const parent = current.parent;
      if (
        parent?.type === 'CallExpression' &&
        ITERATORS.has(calleeName(parent.callee) ?? '')
      ) {
        return indexParamName(current);
      }
      return null;
    }
    current = current.parent;
  }
  return null;
};

const referencesIndex = (expression: AnyNode, index: string): boolean => {
  if (expression.type === 'Identifier') return expression.name === index;
  if (expression.type === 'TemplateLiteral') {
    return expression.expressions.some(
      (part: AnyNode) => part.type === 'Identifier' && part.name === index,
    );
  }
  if (expression.type === 'BinaryExpression') {
    return (
      referencesIndex(expression.left as AnyNode, index) ||
      referencesIndex(expression.right as AnyNode, index)
    );
  }
  return false;
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A key identifies the item, not its position. Using the map index makes React reuse the wrong element when the list reorders.',
      standard: 'LEGION-STANDARDS section 3',
    },
    schema: [],
    messages: {
      indexKey:
        '`key` is the iteration index `{{index}}` (LEGION-STANDARDS section 3). The key then names the position rather than the item, so on a reorder or an insert React keeps the old element and its state lands on the wrong row. Key on a stable id from the item.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      JSXAttribute: (node: TSESTree.JSXAttribute) => {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'key') {
          return;
        }
        if (node.value?.type !== 'JSXExpressionContainer') return;
        const index = enclosingIterationIndex(node as unknown as AnyNode);
        if (index === null) return;
        if (!referencesIndex(node.value.expression as AnyNode, index)) return;
        report({ loc: node.loc, messageId: 'indexKey', data: { index } });
      },
    };
  },
};

export default rule;
