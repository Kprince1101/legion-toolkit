import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { AnyNode, LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { calleeName, enclosingFunction, functionName } from '../ast.js';

const REQUEST_STATE_NAME =
  /^(is)?(loading|loaded|error|errored|success|succeeded|fetching|fetched|pending|submitting|submitted|saving|saved|failed|failure|done|complete|completed|busy)$/i;

const stateName = (call: TSESTree.CallExpression): string | null => {
  const declarator = call.parent;
  if (!declarator || declarator.type !== 'VariableDeclarator') return null;
  if (declarator.id.type === 'Identifier') return declarator.id.name;
  if (declarator.id.type !== 'ArrayPattern') return null;
  const [first] = declarator.id.elements;
  if (!first || first.type !== 'Identifier') return null;
  return first.name;
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Request state is one tagged union (idle | loading | success | error), never separate booleans and error slots that can all be true at once.',
      standard: 'REACT-PARTNERSHIP',
    },
    schema: [],
    messages: {
      booleans:
        "`{{name}}` is the {{count}} request-state slot in `{{owner}}` (alongside {{others}}). Model the request as one tagged union: `type RequestState = { status: 'idle' } | { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; message: string }` in a single `useState<RequestState>`.",
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    const seen = new Map<AnyNode, string[]>();

    return {
      CallExpression: (node: TSESTree.CallExpression) => {
        if (calleeName(node.callee) !== 'useState') return;
        const name = stateName(node);
        if (name === null || !REQUEST_STATE_NAME.test(name)) return;
        const owner = enclosingFunction(node);
        if (!owner) return;
        const names = seen.get(owner) ?? [];
        names.push(name);
        seen.set(owner, names);
        if (names.length < 2) return;
        report({
          loc: node.loc,
          messageId: 'booleans',
          data: {
            name,
            count: `${names.length}${suffix(names.length)}`,
            owner: functionName(owner) ?? 'this function',
            others: names
              .slice(0, -1)
              .map((other) => `\`${other}\``)
              .join(', '),
          },
        });
      },
    };
  },
};

const suffix = (count: number): string => {
  if (count === 2) return 'nd';
  if (count === 3) return 'rd';
  return 'th';
};

export default rule;
