import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';

export interface NoHardcodedHexOptions {
  allow?: string[];
  tokenFiles?: string[];
}

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const DEFAULT_TOKEN_FILES = [
  'tokens',
  'theme',
  'colors',
  'palette',
  'globals.css',
  'tailwind.config',
];

const isTokenFile = (filename: string, tokenFiles: string[]): boolean => {
  const normalized = filename.replace(/\\/g, '/').toLowerCase();
  return tokenFiles.some((part) => normalized.includes(part.toLowerCase()));
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Colors come from design tokens. A hex literal outside a token file is a value the theme cannot reach.',
      standard: 'LEGION-STANDARDS section 7, 10',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' } },
          tokenFiles: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      hardcoded:
        '`{{value}}` is a hardcoded color (LEGION-STANDARDS section 7). A token already names this, or should. Dark mode and every rebrand have to find this literal by grep, and one of them will miss it.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { filename, options, report } = getContext(context);
    const settings = (options[0] ?? {}) as NoHardcodedHexOptions;
    const allow = new Set(
      (settings.allow ?? []).map((value) => value.toLowerCase()),
    );
    const tokenFiles = settings.tokenFiles ?? DEFAULT_TOKEN_FILES;
    if (isTokenFile(filename, tokenFiles)) return {};
    return {
      Literal: (node: TSESTree.Literal) => {
        if (typeof node.value !== 'string') return;
        if (!HEX.test(node.value)) return;
        if (allow.has(node.value.toLowerCase())) return;
        report({
          loc: node.loc,
          messageId: 'hardcoded',
          data: { value: node.value },
        });
      },
    };
  },
};

export default rule;
