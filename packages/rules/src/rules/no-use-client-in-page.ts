import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';

const ROUTE_FILES = new Set([
  'page.tsx',
  'page.ts',
  'page.jsx',
  'page.js',
  'layout.tsx',
  'layout.ts',
  'layout.jsx',
  'layout.js',
]);

export const isAppRouteFile = (filename: string): boolean => {
  const normalized = filename.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const base = segments[segments.length - 1] ?? '';
  if (!ROUTE_FILES.has(base)) return false;
  return segments.slice(0, -1).includes('app');
};

const isUseClientDirective = (
  statement: TSESTree.ProgramStatement | undefined,
): boolean => {
  if (!statement || statement.type !== 'ExpressionStatement') return false;
  if (statement.directive === 'use client') return true;
  const { expression } = statement;
  return expression.type === 'Literal' && expression.value === 'use client';
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Server-first. A page.tsx or layout.tsx under app/ fetches in a server component and hands props to one client child; it is never itself "use client".',
      standard: 'LEGION-STANDARDS section 0.6, 3',
      grade: 'A',
    },
    schema: [],
    messages: {
      useClientInPage:
        "`'use client'` on a route file is not allowed (LEGION-STANDARDS section 3). Keep this file a server component, move the interactivity into a `<Route>Client.tsx` child with the directive, and pass fetched data down as props.",
    },
  },
  create: (context: Rule.RuleContext) => {
    const { filename, report } = getContext(context);
    if (!isAppRouteFile(filename)) return {};
    return {
      Program: (node: TSESTree.Program) => {
        const first = node.body[0];
        if (!isUseClientDirective(first) || !first) return;
        report({ loc: first.loc, messageId: 'useClientInPage' });
      },
    };
  },
};

export default rule;
