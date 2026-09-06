import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Never enum. Use a string-literal union type, and a Record lookup when values need mapping.',
      standard: 'LEGION-STANDARDS section 0.4, 2',
      grade: 'A',
    },
    schema: [],
    messages: {
      noEnum:
        "`enum {{name}}` is not allowed (LEGION-STANDARDS section 2). Use `type {{name}} = 'a' | 'b'` and a `Record<{{name}}, ...>` for lookups.",
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    return {
      TSEnumDeclaration: (node: TSESTree.TSEnumDeclaration) => {
        report({
          loc: node.loc,
          messageId: 'noEnum',
          data: { name: node.id.name },
        });
      },
    };
  },
};

export default rule;
