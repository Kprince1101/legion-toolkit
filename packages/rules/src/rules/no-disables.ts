import type { Rule } from 'eslint';
import type { LegionRuleModule } from '../types.js';
import { FILE_START, commentLocation, getContext } from '../types.js';
import { parseDirective } from '../directives.js';
import type { Directive } from '../directives.js';

const locationFor = (directive: Directive) => {
  if (directive.scope === 'next-line')
    return commentLocation(directive.comment);
  return FILE_START;
};

const describe = (directive: Directive): string => {
  const rules = directive.rules.join(', ');
  if (rules.length === 0) return `${directive.tool}-${directive.kind}`;
  return `${directive.tool}-${directive.kind} ${rules}`;
};

const rule: LegionRuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Reports every lint directive so that honored bypasses stay visible in lint output. Run at tolerance 1 to see them as warnings.',
      standard: 'REACT-PARTNERSHIP',
      grade: 'A',
    },
    schema: [],
    messages: {
      bypass: 'Lint bypass on line {{line}}: {{directive}}.',
    },
  },
  create: (context: Rule.RuleContext) => {
    const { sourceCode, report } = getContext(context);
    return {
      Program: () => {
        for (const comment of sourceCode.getAllComments()) {
          const directive = parseDirective(comment);
          if (!directive) continue;
          report({
            loc: locationFor(directive),
            messageId: 'bypass',
            data: {
              line: String(comment.loc?.start.line ?? 0),
              directive: describe(directive),
            },
          });
        }
      },
    };
  },
};

export default rule;
