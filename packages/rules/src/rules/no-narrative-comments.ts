import type { Rule } from 'eslint';
import type { AnyNode, LegionRuleModule } from '../types.js';
import { commentLocation, getContext } from '../types.js';

export const BUILT_IN_ALLOWED_COMMENT_PATTERNS: readonly RegExp[] = [
  /^eslint-(disable|enable)/,
  /^oxlint-(disable|enable)/,
  /^biome-ignore/,
  /^@ts-(expect-error|ignore|nocheck|check)\b/,
  /^@jest-environment\b/,
  /^@vitest-environment\b/,
  /^istanbul ignore/,
  /^c8 ignore/,
  /^v8 ignore/,
  /^prettier-ignore/,
  /^\/ <reference/,
  /^NOSONAR\b/,
  /^webpack(ChunkName|Mode|Prefetch|Preload|Ignore|Include|Exclude|Exports)\b/,
  /^[@#]__(PURE|NO_SIDE_EFFECTS|INLINE|NOINLINE)__/,
  /^!?\/usr\/bin\/env\b/,
];

const HASHBANG_TYPES = new Set(['Shebang', 'Hashbang']);

export interface NoNarrativeCommentsOptions {
  allowPatterns?: string[];
  allowInEmptyBlocks?: boolean;
}

export const normalizeComment = (value: string): string =>
  value.replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();

const toRegExps = (patterns: string[] | undefined): RegExp[] =>
  (patterns ?? []).map((pattern) => new RegExp(pattern));

const isSoleContentOfEmptyBlock = (
  node: AnyNode | null,
  commentRange: [number, number],
): boolean => {
  if (!node) return false;
  if (node.type !== 'BlockStatement') return false;
  if (node.body.length !== 0) return false;
  const [start, end] = node.range;
  return commentRange[0] > start && commentRange[1] < end;
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Zero comments. The only comments allowed are tool directives (lint and type suppressions, test-runner pragmas, bundler magic comments).',
      standard: 'LEGION-STANDARDS section 13',
      grade: 'A',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowPatterns: { type: 'array', items: { type: 'string' } },
          allowInEmptyBlocks: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      commentNotAllowed:
        'Comments are not allowed (LEGION-STANDARDS section 13). Delete it; if the code needs explaining, rename or extract instead.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { sourceCode, options, report } = getContext(context);
    const settings = (options[0] ?? {}) as NoNarrativeCommentsOptions;
    const allowed = [
      ...BUILT_IN_ALLOWED_COMMENT_PATTERNS,
      ...toRegExps(settings.allowPatterns),
    ];
    const allowInEmptyBlocks = settings.allowInEmptyBlocks === true;

    const isAllowed = (value: string, range: [number, number]): boolean => {
      const normalized = normalizeComment(value);
      if (allowed.some((pattern) => pattern.test(normalized))) return true;
      if (!allowInEmptyBlocks) return false;
      const node = sourceCode.getNodeByRangeIndex(range[0]) as AnyNode | null;
      return isSoleContentOfEmptyBlock(node, range);
    };

    return {
      Program: () => {
        for (const comment of sourceCode.getAllComments()) {
          if (HASHBANG_TYPES.has(String(comment.type))) continue;
          const range = comment.range as [number, number];
          if (isAllowed(comment.value, range)) continue;
          report({
            loc: commentLocation(comment),
            messageId: 'commentNotAllowed',
          });
        }
      },
    };
  },
};

export default rule;
