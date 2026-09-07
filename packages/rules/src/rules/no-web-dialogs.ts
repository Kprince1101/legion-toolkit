import type { Rule, Scope } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { AnyNode, LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';

const DIALOGS = new Set(['alert', 'confirm', 'prompt']);

const MISSING_ENTIRELY = new Set(['confirm', 'prompt']);

const isGlobalCall = (node: TSESTree.CallExpression): string | null => {
  const { callee } = node;
  if (callee.type === 'Identifier' && DIALOGS.has(callee.name)) {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    (callee.object.name === 'window' || callee.object.name === 'globalThis') &&
    callee.property.type === 'Identifier' &&
    DIALOGS.has(callee.property.name)
  ) {
    return callee.property.name;
  }
  return null;
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

const messageFor = (name: string): string => {
  if (MISSING_ENTIRELY.has(name)) return 'missing';
  return 'deprecated';
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'React Native has no browser dialogs. Alert.alert is the user-facing confirmation, and confirm/prompt do not exist at all.',
      standard: 'LEGION-STANDARDS section 3',
    },
    schema: [],
    messages: {
      missing:
        '`{{name}}` does not exist in React Native (LEGION-STANDARDS section 3). This is a runtime crash the moment the line runs, not a style problem. Use `Alert.alert` with buttons for a confirmation.',
      deprecated:
        '`{{name}}` is not the React Native way to talk to a user (LEGION-STANDARDS section 3). It is a shim that behaves differently per platform and is absent on web. Use `Alert.alert`.',
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
        const name = isGlobalCall(node);
        if (name === null) return;
        if (isDeclaredLocally(scopeAt(node as unknown as AnyNode), name))
          return;
        report({
          loc: node.loc,
          messageId: messageFor(name),
          data: { name },
        });
      },
    };
  },
};

export default rule;
