import type { AnyNode } from './types.js';

type NodeVisitor = (node: AnyNode) => boolean | undefined;

const isNode = (value: unknown): value is AnyNode => {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as { type?: unknown }).type === 'string';
};

const childValues = (node: AnyNode): unknown[] => {
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    values.push(value);
  }
  return values;
};

export const walk = (node: AnyNode, visit: NodeVisitor): void => {
  const stop = visit(node);
  if (stop === true) return;
  for (const value of childValues(node)) {
    if (isNode(value)) {
      walk(value, visit);
      continue;
    }
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (isNode(item)) walk(item, visit);
    }
  }
};

export const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

export const NON_ARROW_FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
]);

export const isFunctionNode = (node: AnyNode): boolean =>
  FUNCTION_TYPES.has(node.type);

export const enclosingFunction = (node: AnyNode): AnyNode | null => {
  let current = node.parent;
  while (current) {
    if (isFunctionNode(current)) return current;
    current = current.parent;
  }
  return null;
};

export const functionName = (node: AnyNode): string | null => {
  if (node.type === 'FunctionDeclaration' && node.id) return node.id.name;
  const parent = node.parent;
  if (!parent) return null;
  if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
    return parent.id.name;
  }
  if (
    parent.type === 'Property' &&
    parent.key.type === 'Identifier' &&
    !parent.computed
  ) {
    return parent.key.name;
  }
  if (
    parent.type === 'AssignmentExpression' &&
    parent.left.type === 'Identifier'
  ) {
    return parent.left.name;
  }
  return null;
};

export const containsOwnThis = (root: AnyNode): boolean => {
  let found = false;
  walk(root, (node) => {
    if (node === root) return undefined;
    if (NON_ARROW_FUNCTION_TYPES.has(node.type)) return true;
    if (node.type === 'ThisExpression' || node.type === 'Super') found = true;
    if (node.type === 'Identifier' && node.name === 'arguments') found = true;
    return found;
  });
  return found;
};

export const containsThrow = (root: AnyNode): boolean => {
  let found = false;
  walk(root, (node) => {
    if (node === root) return undefined;
    if (isFunctionNode(node)) return true;
    if (node.type === 'ThrowStatement') found = true;
    return found;
  });
  return found;
};

export const isHookName = (name: string | null): boolean => {
  if (name === null) return false;
  return /^use[A-Z0-9_]/.test(name);
};

export const calleeName = (callee: AnyNode): string | null => {
  if (callee.type === 'Identifier') return callee.name;
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }
  return null;
};
