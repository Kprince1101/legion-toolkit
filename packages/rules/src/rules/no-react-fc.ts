import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';

const FC_NAMES = new Set([
  'FC',
  'FunctionComponent',
  'VFC',
  'VoidFunctionComponent',
]);

const referencedName = (typeName: TSESTree.EntityName): string | null => {
  if (typeName.type === 'Identifier') return typeName.name;
  if (
    typeName.type === 'TSQualifiedName' &&
    typeName.left.type === 'Identifier' &&
    typeName.left.name === 'React'
  ) {
    return typeName.right.name;
  }
  return null;
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Never React.FC. Declare a component as `export const Name = (props: NameProps) => ...` with a named props interface.',
      standard: 'LEGION-STANDARDS section 0.4, 2',
    },
    schema: [],
    messages: {
      noReactFc:
        '`{{name}}` is not allowed (LEGION-STANDARDS section 2). Write `export const Name = (props: NameProps) => ...` and type the props with an interface.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      TSTypeReference: (node: TSESTree.TSTypeReference) => {
        const name = referencedName(node.typeName);
        if (name === null || !FC_NAMES.has(name)) return;
        report({
          loc: node.loc,
          messageId: 'noReactFc',
          data: { name },
        });
      },
    };
  },
};

export default rule;
