import type { AST } from 'eslint';

export type DirectiveKind = 'disable' | 'enable';

export type DirectiveScope = 'file' | 'next-line' | 'line';

export interface Directive {
  tool: 'eslint' | 'oxlint';
  kind: DirectiveKind;
  scope: DirectiveScope;
  rules: string[];
  description: string;
  comment: AST.Program['comments'][number];
}

const DIRECTIVE_PATTERN =
  /^(eslint|oxlint)-(disable|enable)(-next-line|-line)?(?:\s+([\s\S]*))?$/;

const scopeFromSuffix = (suffix: string | undefined): DirectiveScope => {
  if (suffix === '-next-line') return 'next-line';
  if (suffix === '-line') return 'line';
  return 'file';
};

const splitRulesAndDescription = (
  rest: string | undefined,
): { rules: string[]; description: string } => {
  const text = (rest ?? '').trim();
  const separator = text.indexOf('--');
  let rulesText = text;
  let description = '';
  if (separator !== -1) {
    rulesText = text.slice(0, separator);
    description = text.slice(separator + 2).trim();
  }
  const rules = rulesText
    .split(',')
    .map((rule) => rule.trim())
    .filter((rule) => rule.length > 0);
  return { rules, description };
};

export const parseDirective = (
  comment: AST.Program['comments'][number],
): Directive | null => {
  const match = DIRECTIVE_PATTERN.exec(comment.value.trim());
  if (!match) return null;
  const [, tool, kind, suffix, rest] = match;
  const { rules, description } = splitRulesAndDescription(rest);
  return {
    tool: tool as Directive['tool'],
    kind: kind as DirectiveKind,
    scope: scopeFromSuffix(suffix),
    rules,
    description,
    comment,
  };
};

export const bareRuleName = (name: string): string => {
  const slash = name.lastIndexOf('/');
  if (slash === -1) return name;
  return name.slice(slash + 1);
};

export const namesRule = (directiveRules: string[], target: string): boolean =>
  directiveRules.some((rule) => bareRuleName(rule) === bareRuleName(target));
