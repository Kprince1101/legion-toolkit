import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { elementName, localNamesFor } from '../jsx.js';

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "React Native's Button renders a different control on each platform and takes almost no styling. Use TouchableOpacity or Pressable.",
      standard: 'LEGION-STANDARDS section 3',
    },
    schema: [],
    messages: {
      rnButton:
        '`Button` from react-native is not allowed (LEGION-STANDARDS section 3). It renders a different native control per platform and accepts no `style`, so it can never match the design. Use `TouchableOpacity` or `Pressable` wrapping a `<Text>`.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { report } = getContext(context);
    let localNames = new Set<string>();
    return {
      Program: (node: TSESTree.Program) => {
        localNames = localNamesFor(node, 'react-native', 'Button');
      },
      JSXOpeningElement: (node: TSESTree.JSXOpeningElement) => {
        const name = elementName(node);
        if (name === null || !localNames.has(name)) return;
        report({ loc: node.loc, messageId: 'rnButton' });
      },
    };
  },
};

export default rule;
