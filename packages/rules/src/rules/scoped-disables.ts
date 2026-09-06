import type { Rule } from 'eslint';
import type { LegionRuleModule } from '../types.js';
import { FILE_START, commentLocation, getContext } from '../types.js';
import { bareRuleName, namesRule, parseDirective } from '../directives.js';
import type { Directive } from '../directives.js';

export interface ScopedDisablesOptions {
  locked?: string[];
}

const SELF = 'scoped-disables';

const locationFor = (directive: Directive) => {
  if (directive.scope === 'next-line')
    return commentLocation(directive.comment);
  return FILE_START;
};

const rule: LegionRuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A lint bypass must be a next-line directive that names its rules and explains itself after "--". Rules at tolerance 3 are locked and cannot be bypassed at all.',
      standard: 'LEGION-STANDARDS section 13, REACT-PARTNERSHIP',
      grade: 'A',
    },
    schema: [
      {
        type: 'object',
        properties: {
          locked: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unscoped:
        'Line {{line}}: a file-wide or block-level "{{tool}}-disable" is not allowed. Use "{{tool}}-disable-next-line <rule> -- <reason>" on the one line that needs it.',
      lineForm:
        'Line {{line}}: "{{tool}}-disable-line" is not allowed because it can hide its own violation. Use "{{tool}}-disable-next-line <rule> -- <reason>".',
      unnamed:
        'Line {{line}}: a disable directive must name the rule(s) it bypasses.',
      unexplained:
        'Line {{line}}: a disable directive must carry a reason after "--".',
      locked:
        'Line {{line}}: "{{rule}}" is locked at tolerance 3 and cannot be bypassed. Fix the code.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { sourceCode, options, report } = getContext(context);
    const settings = (options[0] ?? {}) as ScopedDisablesOptions;
    const locked = new Set(
      [...(settings.locked ?? []), SELF].map(bareRuleName),
    );

    const check = (directive: Directive): void => {
      if (directive.kind !== 'disable') return;
      const line = String(directive.comment.loc?.start.line ?? 0);
      const tool = directive.tool;
      const loc = locationFor(directive);
      if (directive.scope === 'file') {
        report({ loc, messageId: 'unscoped', data: { line, tool } });
        return;
      }
      if (directive.scope === 'line') {
        report({ loc, messageId: 'lineForm', data: { line, tool } });
        return;
      }
      if (directive.rules.length === 0) {
        report({ loc, messageId: 'unnamed', data: { line } });
        return;
      }
      for (const name of directive.rules) {
        if (!namesRule([...locked], name)) continue;
        report({ loc, messageId: 'locked', data: { line, rule: name } });
        return;
      }
      if (directive.description.length === 0) {
        report({ loc, messageId: 'unexplained', data: { line } });
      }
    };

    return {
      Program: () => {
        for (const comment of sourceCode.getAllComments()) {
          const directive = parseDirective(comment);
          if (directive) check(directive);
        }
      },
    };
  },
};

export default rule;
