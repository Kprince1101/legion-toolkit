import { defineLegionConfig } from './define.js';
import type { LegionConfig, LegionConfigInput } from './define.js';

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
  },
  noTernary: 3,
  noExplicitAny: 3,
};

export const recommended: LegionConfig = defineLegionConfig(recommendedInput);

export const strict: LegionConfig = defineLegionConfig(strictInput);
