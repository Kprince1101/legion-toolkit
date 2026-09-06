import type { TSESTree } from '@typescript-eslint/types';
import type { AnyNode } from './types.js';

export const elementName = (
  node: TSESTree.JSXOpeningElement,
): string | null => {
  const { name } = node;
  if (name.type === 'JSXIdentifier') return name.name;
  if (
    name.type === 'JSXMemberExpression' &&
    name.property.type === 'JSXIdentifier'
  ) {
    return name.property.name;
  }
  return null;
};

export const hasSpread = (node: TSESTree.JSXOpeningElement): boolean =>
  node.attributes.some((attribute) => attribute.type === 'JSXSpreadAttribute');

export const findAttribute = (
  node: TSESTree.JSXOpeningElement,
  name: string,
): TSESTree.JSXAttribute | null => {
  for (const attribute of node.attributes) {
    if (attribute.type !== 'JSXAttribute') continue;
    if (attribute.name.type !== 'JSXIdentifier') continue;
    if (attribute.name.name === name) return attribute;
  }
  return null;
};

export const hasAttribute = (
  node: TSESTree.JSXOpeningElement,
  name: string,
): boolean => findAttribute(node, name) !== null;

export const staticValue = (
  attribute: TSESTree.JSXAttribute | null,
): string | null => {
  if (!attribute?.value) return null;
  if (attribute.value.type === 'Literal') {
    if (typeof attribute.value.value === 'string') return attribute.value.value;
    return null;
  }
  if (attribute.value.type !== 'JSXExpressionContainer') return null;
  const { expression } = attribute.value;
  if (expression.type === 'Literal' && typeof expression.value === 'string') {
    return expression.value;
  }
  if (expression.type === 'TemplateLiteral' && expression.quasis.length === 1) {
    return expression.quasis[0]?.value.cooked ?? null;
  }
  return null;
};

export const isValuelessTrue = (
  attribute: TSESTree.JSXAttribute | null,
): boolean => attribute !== null && attribute.value === null;

export const isFalseLiteral = (
  attribute: TSESTree.JSXAttribute | null,
): boolean => {
  if (!attribute?.value) return false;
  if (attribute.value.type !== 'JSXExpressionContainer') return false;
  const { expression } = attribute.value;
  return expression.type === 'Literal' && expression.value === false;
};

export const importedFrom = (
  program: TSESTree.Program,
  moduleName: string,
): Set<string> => {
  const names = new Set<string>();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    if (String(statement.source.value) !== moduleName) continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportSpecifier') {
        names.add(specifier.local.name);
      }
    }
  }
  return names;
};

export const childElements = (node: AnyNode): string[] => {
  const names: string[] = [];
  const children = (node as { children?: AnyNode[] }).children ?? [];
  for (const child of children) {
    if (child.type === 'JSXElement') {
      const opening = (child as unknown as TSESTree.JSXElement).openingElement;
      const name = elementName(opening);
      if (name) names.push(name);
      names.push(...childElements(child));
    }
  }
  return names;
};
