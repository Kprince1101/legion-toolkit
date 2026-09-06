import type { TSESTree } from '@typescript-eslint/types';
import type { AnyNode } from './types.js';
import { walk } from './ast.js';

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

export const isTrueAttribute = (
  attribute: TSESTree.JSXAttribute | null,
): boolean => {
  if (attribute === null) return false;
  if (attribute.value === null) return true;
  if (attribute.value.type !== 'JSXExpressionContainer') return false;
  const { expression } = attribute.value;
  return expression.type === 'Literal' && expression.value === true;
};

export const isFalseLiteral = (
  attribute: TSESTree.JSXAttribute | null,
): boolean => {
  if (!attribute?.value) return false;
  if (attribute.value.type !== 'JSXExpressionContainer') return false;
  const { expression } = attribute.value;
  return expression.type === 'Literal' && expression.value === false;
};

export const localNamesFor = (
  program: TSESTree.Program,
  moduleName: string,
  exportedName: string,
): Set<string> => {
  const names = new Set<string>();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    if (String(statement.source.value) !== moduleName) continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type !== 'ImportSpecifier') continue;
      const { imported } = specifier;
      if (imported.type !== 'Identifier') continue;
      if (imported.name !== exportedName) continue;
      names.add(specifier.local.name);
    }
  }
  return names;
};

export const descendantElements = (node: AnyNode): string[] => {
  const names: string[] = [];
  walk(node, (child) => {
    if (child === node) return undefined;
    if (child.type !== 'JSXElement') return undefined;
    const opening = (child as unknown as TSESTree.JSXElement).openingElement;
    const name = elementName(opening);
    if (name) names.push(name);
    return undefined;
  });
  return names;
};
