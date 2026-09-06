import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { AnyNode, LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { containsOwnThis } from '../ast.js';

type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;

const isMethodValue = (node: FunctionNode): boolean => {
  const parent = node.parent as AnyNode | undefined;
  if (!parent) return false;
  if (parent.type === 'MethodDefinition') return true;
  if (parent.type === 'TSAbstractMethodDefinition') return true;
  if (parent.type === 'Property') {
    return parent.method || parent.kind === 'get' || parent.kind === 'set';
  }
  return false;
};

const isExempt = (node: FunctionNode): boolean => {
  if (node.generator) return true;
  if (!node.body) return true;
  if (isMethodValue(node)) return true;
  return containsOwnThis(node);
};

const isDefaultExport = (node: FunctionNode): boolean =>
  node.parent?.type === 'ExportDefaultDeclaration';

const rule: LegionRuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Never the function keyword. Components, hooks, handlers and helpers are const arrow functions.',
      standard: 'LEGION-STANDARDS section 0.4, 7',
      grade: 'A',
    },
    schema: [],
    messages: {
      declaration:
        '`function {{name}}` is not allowed (LEGION-STANDARDS section 7). Write `const {{name}} = (...) => { ... }`.',
      defaultExport:
        '`export default function {{name}}` is not allowed (LEGION-STANDARDS section 7). Write `const {{name}} = (...) => { ... };` then `export default {{name}};` so the component keeps its name.',
      expression:
        'A `function` expression is not allowed (LEGION-STANDARDS section 7). Write an arrow function: `(...) => { ... }`.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);

    const check = (node: FunctionNode): void => {
      if (isExempt(node)) return;
      const name = node.id?.name ?? 'Name';
      if (node.type === 'FunctionDeclaration' && isDefaultExport(node)) {
        report({ loc: node.loc, messageId: 'defaultExport', data: { name } });
        return;
      }
      if (node.type === 'FunctionDeclaration') {
        report({ loc: node.loc, messageId: 'declaration', data: { name } });
        return;
      }
      report({ loc: node.loc, messageId: 'expression' });
    };

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
    };
  },
};

export default rule;
