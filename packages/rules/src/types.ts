import type { AST, Rule, SourceCode } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';

export type Level = 0 | 1 | 2 | 3;

export type Severity = 'off' | 'warn' | 'error';

export type AnyNode = TSESTree.Node;

export type Listener = (node: never) => void;

export type Listeners = Record<string, Listener>;

export interface RuleDocs {
  description: string;
  standard: string;
  grade: 'A' | 'B';
}

export interface LegionRuleModule {
  meta: {
    type: 'problem' | 'suggestion' | 'layout';
    docs: RuleDocs;
    schema: unknown[];
    messages: Record<string, string>;
  };
  create: (context: Rule.RuleContext) => Listeners;
}

export type Location = AST.SourceLocation | { line: number; column: number };

export interface Report {
  loc: Location;
  messageId: string;
  data?: Record<string, string>;
}

export interface RuleContext {
  sourceCode: SourceCode;
  filename: string;
  options: unknown[];
  report: (descriptor: Report) => void;
}

export const FILE_START: Location = { line: 1, column: 0 };

export const getContext = (context: Rule.RuleContext): RuleContext => ({
  sourceCode: context.sourceCode,
  filename: context.filename,
  options: context.options,
  report: (descriptor) => context.report(descriptor),
});

export const commentLocation = (
  comment: AST.Program['comments'][number],
): Location => comment.loc ?? FILE_START;
