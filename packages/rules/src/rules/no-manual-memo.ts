import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { calleeName } from '../ast.js';

const MEMO_HOOKS = new Set(['useMemo', 'useCallback']);

const isReactMemoCall = (node: TSESTree.CallExpression): boolean => {
  if (calleeName(node.callee) !== 'memo') return false;
  if (node.callee.type === 'Identifier') return true;
  return (
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'React'
  );
};

const rule: LegionRuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'With the React Compiler on, useMemo, useCallback and memo() are redundant: the compiler memoizes automatically. Delete them and write the plain expression.',
      standard:
        'React 19 with the React Compiler; enable via reactCompiler: true in defineLegionConfig',
    },
    schema: [],
    messages: {
      hook: '`{{name}}` is redundant under the React Compiler. Write the value or function directly; the compiler memoizes it.',
      memo: '`memo()` is redundant under the React Compiler. Export the component directly; the compiler skips unchanged renders.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      CallExpression: (node: TSESTree.CallExpression) => {
        const name = calleeName(node.callee);
        if (name !== null && MEMO_HOOKS.has(name)) {
          report({ loc: node.loc, messageId: 'hook', data: { name } });
          return;
        }
        if (isReactMemoCall(node)) {
          report({ loc: node.loc, messageId: 'memo' });
        }
      },
    };
  },
};

export default rule;
