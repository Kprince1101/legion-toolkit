import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { AnyNode, LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { childElements, elementName, hasAttribute, hasSpread } from '../jsx.js';

export interface TouchableOptions {
  components?: string[];
}

const DEFAULT_TOUCHABLES = [
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
];

const TEXT_ELEMENTS = new Set(['Text', 'ThemedText']);

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A touchable with no visible text needs an accessibilityLabel, or a screen reader announces nothing useful.',
      standard: 'LEGION-STANDARDS section 3',
    },
    schema: [
      {
        type: 'object',
        properties: {
          components: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingLabel:
        '`<{{name}}>` has an `onPress` and no text inside it (LEGION-STANDARDS section 3). VoiceOver and TalkBack announce it as an unnamed button, so the control is unusable without sight. Add `accessibilityLabel`.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { options, report } = getContext(context);
    const settings = (options[0] ?? {}) as TouchableOptions;
    const touchables = new Set(settings.components ?? DEFAULT_TOUCHABLES);
    return {
      JSXElement: (node: TSESTree.JSXElement) => {
        const opening = node.openingElement;
        const name = elementName(opening);
        if (name === null || !touchables.has(name)) return;
        if (!hasAttribute(opening, 'onPress')) return;
        if (hasSpread(opening)) return;
        if (hasAttribute(opening, 'accessibilityLabel')) return;
        if (hasAttribute(opening, 'aria-label')) return;
        const children = childElements(node as unknown as AnyNode);
        if (children.some((child) => TEXT_ELEMENTS.has(child))) return;
        report({ loc: opening.loc, messageId: 'missingLabel', data: { name } });
      },
    };
  },
};

export default rule;
