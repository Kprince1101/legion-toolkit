import type { LegionRuleModule } from '../types.js';
import guardedContextHook from './guarded-context-hook.js';
import noClientGlobalsInStateInit from './no-client-globals-in-state-init.js';
import noDisables from './no-disables.js';
import noAdminClientInBrowser from './no-admin-client-in-browser.js';
import noEnum from './no-enum.js';
import noFunctionKeyword from './no-function-keyword.js';
import noLiteralConditionsInJsx from './no-literal-conditions-in-jsx.js';
import noManualMemo from './no-manual-memo.js';
import noNarrativeComments from './no-narrative-comments.js';
import noReactFc from './no-react-fc.js';
import noUseClientInPage from './no-use-client-in-page.js';
import presentationalComponents from './presentational-components.js';
import scopedDisables from './scoped-disables.js';

export const rules = {
  'no-narrative-comments': noNarrativeComments,
  'scoped-disables': scopedDisables,
  'no-disables': noDisables,
  'no-react-fc': noReactFc,
  'no-enum': noEnum,
  'no-function-keyword': noFunctionKeyword,
  'no-client-globals-in-state-init': noClientGlobalsInStateInit,
  'no-use-client-in-page': noUseClientInPage,
  'guarded-context-hook': guardedContextHook,
  'presentational-components': presentationalComponents,
  'no-literal-conditions-in-jsx': noLiteralConditionsInJsx,
  'no-admin-client-in-browser': noAdminClientInBrowser,
  'no-manual-memo': noManualMemo,
} satisfies Record<string, LegionRuleModule>;

export type LegionRuleName = keyof typeof rules;

export const RULE_NAMES = Object.keys(rules) as LegionRuleName[];
