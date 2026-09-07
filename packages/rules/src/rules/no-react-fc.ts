import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { AnyNode, FixResult, Fixer, LegionRuleModule } from '../types.js';
import { fixTarget, getContext } from '../types.js';

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
    fixable: 'code',
    schema: [],
    messages: {
      noReactFc:
        '`{{name}}` is not allowed (LEGION-STANDARDS section 2). Write `export const Name = (props: NameProps) => ...` and type the props with an interface.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { sourceCode, report } = getContext(context);

    const annotatedArrow = (
      node: TSESTree.TSTypeReference,
    ): {
      annotation: AnyNode;
      arrow: TSESTree.ArrowFunctionExpression;
    } | null => {
      const annotation = node.parent;
      if (!annotation || annotation.type !== 'TSTypeAnnotation') return null;
      const identifier = annotation.parent;
      if (!identifier || identifier.type !== 'Identifier') return null;
      const declarator = identifier.parent;
      if (!declarator || declarator.type !== 'VariableDeclarator') return null;
      const { init } = declarator;
      if (!init || init.type !== 'ArrowFunctionExpression') return null;
      return { annotation: annotation as AnyNode, arrow: init };
    };

    const buildFix = (node: TSESTree.TSTypeReference) => {
      const target = annotatedArrow(node);
      if (target === null) return undefined;
      const args = node.typeArguments?.params ?? [];
      if (args.length > 1) return undefined;
      const { arrow } = target;
      if (arrow.params.length > 1) return undefined;
      const [param] = arrow.params;
      if (param && 'typeAnnotation' in param && param.typeAnnotation) {
        return undefined;
      }
      if (args.length === 1 && !param) return undefined;
      return (fixer: Fixer): FixResult => {
        const fixes = [fixer.remove(fixTarget(target.annotation))];
        const [typeArg] = args;
        if (typeArg && param) {
          const text = sourceCode.getText(typeArg as never);
          fixes.push(fixer.insertTextAfter(fixTarget(param), `: ${text}`));
        }
        return fixes;
      };
    };

    return {
      TSTypeReference: (node: TSESTree.TSTypeReference) => {
        const name = referencedName(node.typeName);
        if (name === null || !FC_NAMES.has(name)) return;
        const fix = buildFix(node);
        if (fix === undefined) {
          report({ loc: node.loc, messageId: 'noReactFc', data: { name } });
          return;
        }
        report({ loc: node.loc, messageId: 'noReactFc', data: { name }, fix });
      },
    };
  },
};

export default rule;
