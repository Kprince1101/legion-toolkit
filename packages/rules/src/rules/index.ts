import type { LegionRuleModule } from '../types.js';
import anchorIsNotAButton from './anchor-is-not-a-button.js';
import buttonHasType from './button-has-type.js';
import controlledTextInput from './controlled-text-input.js';
import guardedContextHook from './guarded-context-hook.js';
import imgHasAlt from './img-has-alt.js';
import noArrayIndexKey from './no-array-index-key.js';
import noClientGlobalsInStateInit from './no-client-globals-in-state-init.js';
import noDangerousHtml from './no-dangerous-html.js';
import noHardcodedHex from './no-hardcoded-hex.js';
import noRnButton from './no-rn-button.js';
import noTargetBlankWithoutRel from './no-target-blank-without-rel.js';
import noWebDialogs from './no-web-dialogs.js';
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
import touchableHasAccessibilityLabel from './touchable-has-accessibility-label.js';

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
  'button-has-type': buttonHasType,
  'no-target-blank-without-rel': noTargetBlankWithoutRel,
  'anchor-is-not-a-button': anchorIsNotAButton,
  'img-has-alt': imgHasAlt,
  'no-dangerous-html': noDangerousHtml,
  'no-array-index-key': noArrayIndexKey,
  'no-hardcoded-hex': noHardcodedHex,
  'no-rn-button': noRnButton,
  'touchable-has-accessibility-label': touchableHasAccessibilityLabel,
  'controlled-text-input': controlledTextInput,
  'no-web-dialogs': noWebDialogs,
} satisfies Record<string, LegionRuleModule>;

export type LegionRuleName = keyof typeof rules;

export const RULE_NAMES = Object.keys(rules) as LegionRuleName[];
