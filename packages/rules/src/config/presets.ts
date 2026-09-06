import { defineLegionConfig } from './define.js';
import type { LegionConfig, LegionConfigInput } from './define.js';
import type { LegionRuleName } from '../rules/index.js';

export const INTRODUCED_AT_WARN: LegionRuleName[] = [
  'button-has-type',
  'no-target-blank-without-rel',
  'anchor-is-not-a-button',
  'img-has-alt',
  'no-dangerous-html',
  'no-array-index-key',
  'no-hardcoded-hex',
  'no-rn-button',
  'touchable-has-accessibility-label',
  'controlled-text-input',
];

export const recommendedInput: LegionConfigInput = {
  rules: {
    'no-narrative-comments': 2,
    'scoped-disables': 2,
    'no-disables': 0,
    'no-react-fc': 2,
    'no-enum': 2,
    'no-function-keyword': 2,
    'no-client-globals-in-state-init': 2,
    'no-use-client-in-page': 2,
    'guarded-context-hook': 2,
    'presentational-components': 2,
    'no-literal-conditions-in-jsx': 2,
    'no-admin-client-in-browser': 2,
    'no-manual-memo': 0,
    'button-has-type': 1,
    'no-target-blank-without-rel': 1,
    'anchor-is-not-a-button': 1,
    'img-has-alt': 1,
    'no-dangerous-html': 1,
    'no-array-index-key': 1,
    'no-hardcoded-hex': 1,
    'no-rn-button': 1,
    'touchable-has-accessibility-label': 1,
    'controlled-text-input': 1,
  },
  noTernary: 2,
  noExplicitAny: 2,
};

export const strictInput: LegionConfigInput = {
  rules: {
    'no-narrative-comments': 3,
    'scoped-disables': 3,
    'no-disables': 1,
    'no-react-fc': 3,
    'no-enum': 3,
    'no-function-keyword': 3,
    'no-client-globals-in-state-init': 3,
    'no-use-client-in-page': 3,
    'guarded-context-hook': 3,
    'presentational-components': 3,
    'no-literal-conditions-in-jsx': 3,
    'no-admin-client-in-browser': 3,
    'no-manual-memo': 0,
    'button-has-type': 3,
    'no-target-blank-without-rel': 3,
    'anchor-is-not-a-button': 3,
    'img-has-alt': 3,
    'no-dangerous-html': 3,
    'no-array-index-key': 3,
    'no-hardcoded-hex': 3,
    'no-rn-button': 3,
    'touchable-has-accessibility-label': 3,
    'controlled-text-input': 3,
  },
  noTernary: 3,
  noExplicitAny: 3,
};

export const recommended: LegionConfig = defineLegionConfig(recommendedInput);

export const strict: LegionConfig = defineLegionConfig(strictInput);

export const reactNativeInput: LegionConfigInput = {
  ...recommendedInput,
  reactNative: true,
};

export const reactNative: LegionConfig = defineLegionConfig(reactNativeInput);
