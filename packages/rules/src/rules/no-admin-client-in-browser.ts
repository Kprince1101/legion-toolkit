import type { Rule } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';
import type { LegionRuleModule } from '../types.js';
import { getContext } from '../types.js';

export interface NoAdminClientInBrowserOptions {
  adminModules?: string[];
  browserPaths?: string[];
}

const DEFAULT_ADMIN_MODULES = ['supabase/admin', 'supabase-admin'];

const DEFAULT_BROWSER_PATHS = [
  '/components/',
  '/hooks/',
  'Client.tsx',
  'Client.ts',
];

const hasUseClient = (program: TSESTree.Program): boolean => {
  const first = program.body[0];
  if (!first || first.type !== 'ExpressionStatement') return false;
  if (first.directive === 'use client') return true;
  return (
    first.expression.type === 'Literal' &&
    first.expression.value === 'use client'
  );
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'The service-role (admin) Supabase client never reaches browser-facing code: no import of it in a "use client" file, a component, or a hook.',
      standard: 'LEGION-STANDARDS section 6',
    },
    schema: [
      {
        type: 'object',
        properties: {
          adminModules: { type: 'array', items: { type: 'string' } },
          browserPaths: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      adminInBrowser:
        '`{{source}}` is the service-role client and this file is browser-reachable (LEGION-STANDARDS section 6). Use the browser or server client here, and keep admin queries behind a route handler or server component.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { filename, options, report } = getContext(context);
    const settings = (options[0] ?? {}) as NoAdminClientInBrowserOptions;
    const adminModules = settings.adminModules ?? DEFAULT_ADMIN_MODULES;
    const browserPaths = settings.browserPaths ?? DEFAULT_BROWSER_PATHS;
    const normalized = `/${filename.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    const browserByPath = browserPaths.some((part) =>
      normalized.includes(part),
    );
    let browserByDirective = false;

    return {
      Program: (node: TSESTree.Program) => {
        browserByDirective = hasUseClient(node);
      },
      ImportDeclaration: (node: TSESTree.ImportDeclaration) => {
        if (!browserByPath && !browserByDirective) return;
        const source = String(node.source.value);
        if (!adminModules.some((part) => source.includes(part))) return;
        report({
          loc: node.loc,
          messageId: 'adminInBrowser',
          data: { source },
        });
      },
    };
  },
};

export default rule;
