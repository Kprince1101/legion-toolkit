import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import {
  calleeName,
  containsThrow,
  enclosingFunction,
  functionName,
  isHookName,
} from '../ast.js';

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Consume Context only through a hook named use* whose body throws when the value is missing. Never a raw useContext anywhere else.',
      standard: 'LEGION-STANDARDS section 0.5, 4',
      grade: 'A',
    },
    schema: [],
    messages: {
      outsideHook:
        "`useContext` outside a function is not allowed (LEGION-STANDARDS section 4). Wrap it: `export const useXContext = () => { const ctx = useContext(XContext); if (!ctx) throw new Error('useXContext must be used within XProvider'); return ctx; };`.",
      notAHook:
        '`useContext` inside `{{name}}` is not allowed (LEGION-STANDARDS section 4). Consume the context through a guarded `use*` hook that throws when the provider is missing, and call that hook here instead.',
      noGuard:
        "`{{name}}` calls `useContext` but never throws (LEGION-STANDARDS section 4). Add `if (!ctx) throw new Error('{{name}} must be used within its provider');` before returning.",
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      CallExpression: (node: TSESTree.CallExpression) => {
        if (calleeName(node.callee) !== 'useContext') return;
        const fn = enclosingFunction(node);
        if (!fn) {
          report({ loc: node.loc, messageId: 'outsideHook' });
          return;
        }
        const name = functionName(fn);
        if (!isHookName(name)) {
          report({
            loc: node.loc,
            messageId: 'notAHook',
            data: { name: name ?? 'an anonymous function' },
          });
          return;
        }
        if (containsThrow(fn)) return;
        report({
          loc: node.loc,
          messageId: 'noGuard',
          data: { name: name ?? 'this hook' },
        });
      },
    };
  },
};

export default rule;
