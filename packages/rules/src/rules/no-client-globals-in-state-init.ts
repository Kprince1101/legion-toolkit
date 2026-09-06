import type { Rule, Scope } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { AnyNode, LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { calleeName, walk } from '../ast.js';

const CLIENT_GLOBALS = new Set([
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'matchMedia',
]);

const isPropertyName = (node: TSESTree.Identifier): boolean => {
  const parent = node.parent as AnyNode | undefined;
  if (!parent) return false;
  if (
    parent.type === 'MemberExpression' &&
    parent.property === node &&
    !parent.computed
  ) {
    return true;
  }
  if (parent.type === 'Property' && parent.key === node && !parent.computed) {
    return true;
  }
  return parent.type.startsWith('TS');
};

const isDeclaredLocally = (
  scope: Scope.Scope | null,
  name: string,
): boolean => {
  let current = scope;
  while (current) {
    const variable = current.set.get(name);
    if (variable && variable.defs.length > 0) return true;
    current = current.upper;
  }
  return false;
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Never read window, document, localStorage, sessionStorage or navigator inside a useState initializer in code that server-renders. Initialize from a server-safe value and reconcile in useEffect.',
      standard: 'LEGION-STANDARDS section 1 (hydration-safe initialization)',
      grade: 'A',
    },
    schema: [],
    messages: {
      clientGlobal:
        '`{{name}}` inside a `useState` initializer causes a hydration mismatch (LEGION-STANDARDS section 1). Initialize from a prop or URL value, then read `{{name}}` in a `useEffect` and reconcile.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { sourceCode, report } = getContext(context);

    const scopeAt = (node: AnyNode): Scope.Scope | null => {
      try {
        return sourceCode.getScope(node as never);
      } catch {
        return null;
      }
    };

    return {
      CallExpression: (node: TSESTree.CallExpression) => {
        if (calleeName(node.callee) !== 'useState') return;
        const initializer = node.arguments[0];
        if (!initializer) return;
        walk(initializer, (child) => {
          if (child.type !== 'Identifier') return undefined;
          if (!CLIENT_GLOBALS.has(child.name)) return undefined;
          if (isPropertyName(child)) return undefined;
          if (isDeclaredLocally(scopeAt(child), child.name)) return undefined;
          report({
            loc: child.loc,
            messageId: 'clientGlobal',
            data: { name: child.name },
          });
          return undefined;
        });
      },
    };
  },
};

export default rule;
