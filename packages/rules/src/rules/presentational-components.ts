import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { AnyNode, LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';
import { calleeName, functionName, isFunctionNode, walk } from '../ast.js';

export interface PresentationalComponentsOptions {
  allowState?: boolean;
  allowRenderMaps?: boolean;
  reactCompiler?: boolean;
}

type FunctionLike =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

const EFFECT_HOOKS = new Set([
  'useEffect',
  'useLayoutEffect',
  'useInsertionEffect',
]);
const STATE_HOOKS = new Set(['useState', 'useReducer']);
const DERIVATION_HOOKS = new Set(['useMemo', 'useCallback']);
const FETCHERS = new Set(['fetch']);
const PROJECTION_METHODS = new Set([
  'map',
  'filter',
  'reduce',
  'sort',
  'flatMap',
  'find',
]);

const isPascalCase = (name: string | null): boolean =>
  name !== null && /^[A-Z][A-Za-z0-9]*$/.test(name);

const isJsx = (node: AnyNode | null | undefined): boolean =>
  node?.type === 'JSXElement' || node?.type === 'JSXFragment';

const containsJsx = (root: AnyNode): boolean => {
  let found = false;
  walk(root, (node) => {
    if (isJsx(node)) found = true;
    return found;
  });
  return found;
};

const returnsJsx = (fn: FunctionLike): boolean => {
  if (fn.body.type !== 'BlockStatement') return isJsx(fn.body);
  let found = false;
  walk(fn.body, (node) => {
    if (isFunctionNode(node)) return true;
    if (node.type === 'ReturnStatement' && isJsx(node.argument)) found = true;
    return found;
  });
  return found;
};

const isComponent = (fn: FunctionLike): boolean =>
  isPascalCase(functionName(fn)) && containsJsx(fn);

const isDelegatingHandler = (fn: FunctionLike): boolean => {
  if (fn.body.type !== 'BlockStatement') return true;
  const statements = fn.body.body;
  if (statements.length === 0) return true;
  if (statements.length > 1) return false;
  const [only] = statements;
  if (!only) return true;
  if (only.type === 'ReturnStatement') return true;
  return (
    only.type === 'ExpressionStatement' &&
    only.expression.type === 'CallExpression'
  );
};

const isCallbackArgument = (fn: FunctionLike): boolean =>
  fn.parent?.type === 'CallExpression' &&
  (fn.parent.arguments as AnyNode[]).includes(fn);

const isInsideJsx = (node: AnyNode): boolean => {
  let current = node.parent;
  while (current) {
    if (current.type === 'JSXExpressionContainer') return true;
    if (isFunctionNode(current)) return false;
    current = current.parent;
  }
  return false;
};

const isRenderLoop = (
  call: TSESTree.CallExpression,
  method: string,
): boolean => {
  if (method !== 'map') return false;
  const callback = call.arguments[0];
  if (!callback || !isFunctionNode(callback)) return false;
  return returnsJsx(callback as unknown as FunctionLike);
};

const derivationMessage = (reactCompiler: boolean): string => {
  if (reactCompiler) return 'derivationCompiler';
  return 'derivation';
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A component renders and never thinks. State, effects, fetching, handler bodies, derivation and projections belong in its use<Component> hook or in lib/.',
      standard: 'LEGION-STANDARDS section 0.1, 1',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowState: { type: 'boolean' },
          allowRenderMaps: { type: 'boolean' },
          reactCompiler: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      effect:
        '`{{hook}}` inside `{{component}}` is logic in a component (LEGION-STANDARDS section 1). Move it into `use{{component}}` and have the component consume the result.',
      state:
        '`{{hook}}` inside `{{component}}` is state in a component (LEGION-STANDARDS section 1). Own it in `use{{component}}` and return the value and a `handleX` setter.',
      derivation:
        '`{{hook}}` inside `{{component}}` is derivation in a component (LEGION-STANDARDS section 1). Compute it in `use{{component}}` and return a named value.',
      derivationCompiler:
        '`{{hook}}` inside `{{component}}` is derivation in a component (LEGION-STANDARDS section 1), and the React Compiler already memoizes. Compute the plain value in `use{{component}}` and drop the `{{hook}}`.',
      fetching:
        'Data fetching inside `{{component}}` is not allowed (LEGION-STANDARDS section 1). Fetch in a server component or in `use{{component}}`.',
      handlerBody:
        '`{{handler}}` has a body inside `{{component}}` (LEGION-STANDARDS section 1). Define it in `use{{component}}` and pass it down; the component only wires handlers through.',
      projection:
        '`.{{method}}` producing a non-JSX value inside JSX is a projection in `{{component}}` (LEGION-STANDARDS section 1). Derive it in `use{{component}}` and render the named result.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { options, report } = getContext(context);
    const settings = (options[0] ?? {}) as PresentationalComponentsOptions;
    const allowState = settings.allowState === true;
    const allowRenderMaps = settings.allowRenderMaps !== false;
    const reactCompiler = settings.reactCompiler === true;

    const checkNestedFunction = (fn: FunctionLike, component: string): void => {
      if (returnsJsx(fn)) return;
      if (isCallbackArgument(fn)) return;
      if (isDelegatingHandler(fn)) return;
      report({
        loc: fn.loc,
        messageId: 'handlerBody',
        data: { component, handler: functionName(fn) ?? 'This handler' },
      });
    };

    const checkCall = (
      call: TSESTree.CallExpression,
      component: string,
    ): void => {
      const name = calleeName(call.callee);
      if (name === null) return;
      const data = { component, hook: name, method: name };
      if (EFFECT_HOOKS.has(name)) {
        report({ loc: call.loc, messageId: 'effect', data });
        return;
      }
      if (STATE_HOOKS.has(name) && !allowState) {
        report({ loc: call.loc, messageId: 'state', data });
        return;
      }
      if (DERIVATION_HOOKS.has(name)) {
        report({
          loc: call.loc,
          messageId: derivationMessage(reactCompiler),
          data,
        });
        return;
      }
      if (FETCHERS.has(name) && call.callee.type === 'Identifier') {
        report({ loc: call.loc, messageId: 'fetching', data });
        return;
      }
      if (call.callee.type !== 'MemberExpression') return;
      if (!PROJECTION_METHODS.has(name) || !isInsideJsx(call)) return;
      if (allowRenderMaps && isRenderLoop(call, name)) return;
      report({ loc: call.loc, messageId: 'projection', data });
    };

    const checkComponent = (fn: FunctionLike): void => {
      if (!isComponent(fn)) return;
      const component = functionName(fn) ?? 'Component';
      walk(fn.body, (node) => {
        if (isFunctionNode(node)) {
          checkNestedFunction(node as FunctionLike, component);
          return undefined;
        }
        if (node.type === 'CallExpression') checkCall(node, component);
        return undefined;
      });
    };

    return {
      FunctionDeclaration: checkComponent,
      FunctionExpression: checkComponent,
      ArrowFunctionExpression: checkComponent,
    };
  },
};

export default rule;
