import { defineLegionConfig } from './define.js';
import {
  reactNative,
  reactNativeInput,
  recommended,
  recommendedInput,
} from './presets.js';
import {
  NATIVE_ONLY_RULES,
  REACT_NATIVE_ANY_BOUNDARIES,
  REACT_NATIVE_BROWSER_PATHS,
  WEB_ONLY_RULES,
} from './define.js';
import adminRule from '../rules/no-admin-client-in-browser.js';
import { runRule } from '../test-utils.js';

describe('reactNative', () => {
  it('turns off the rules that can only fire on a server-rendered web app', () => {
    for (const name of WEB_ONLY_RULES) {
      expect(recommendedInput.rules?.[name]).toBeGreaterThan(0);
      expect(reactNative.levels[name]).toBe(0);
      expect(reactNative.oxlint.rules[`legion/${name}`]).toBe('off');
    }
  });

  it('covers section 3 Alert.alert with the part of it a linter can check', () => {
    expect(reactNative.levels['no-web-dialogs']).toBeGreaterThan(0);
    expect(recommended.levels['no-web-dialogs']).toBe(0);
  });

  it('turns the native-only rules on, and only here', () => {
    for (const name of NATIVE_ONLY_RULES) {
      expect(reactNative.levels[name]).toBeGreaterThan(0);
      expect(recommended.levels[name]).toBe(0);
    }
  });

  it('treats every file as browser-reachable, because the whole bundle ships to the device', () => {
    expect(
      reactNative.oxlint.rules['legion/no-admin-client-in-browser'],
    ).toEqual(['error', { browserPaths: REACT_NATIVE_BROWSER_PATHS }]);
  });

  it('lets an explicit browserPaths win over the react native default', () => {
    const config = defineLegionConfig({
      ...reactNativeInput,
      adminClient: { browserPaths: ['/screens/'] },
    });
    expect(config.oxlint.rules['legion/no-admin-client-in-browser']).toEqual([
      'error',
      { browserPaths: ['/screens/'] },
    ]);
  });

  it('widens the any boundaries to the src-prefixed paths react native uses', () => {
    const boundaries = reactNative.oxlint.overrides.find(
      (override) => override.rules['typescript/no-explicit-any'] === 'off',
    );
    expect(boundaries?.files).toEqual(REACT_NATIVE_ANY_BOUNDARIES);
    expect(boundaries?.files).toContain('src/lib/supabase/**');
  });

  it('keeps every framework-agnostic rule at the level the base preset set', () => {
    expect(reactNative.levels['presentational-components']).toBe(2);
    expect(reactNative.levels['no-function-keyword']).toBe(2);
    expect(reactNative.levels['guarded-context-hook']).toBe(2);
    expect(reactNative.levels['no-narrative-comments']).toBe(2);
  });

  it('composes with strict, so a locked react native config is one call', () => {
    const config = defineLegionConfig({
      rules: { ...recommendedInput.rules, 'no-enum': 3 },
      reactNative: true,
    });
    expect(config.levels['no-use-client-in-page']).toBe(0);
    expect(config.locked).toContain('no-enum');
    expect(config.locked).not.toContain('no-use-client-in-page');
  });
});

const ADMIN_IMPORT =
  "import { createAdminClient } from '@/lib/supabase/admin';\nexport const load = () => createAdminClient();";

runRule('no-admin-client-in-browser (react native)', adminRule, {
  valid: [
    {
      code: "import { createClient } from '@/lib/supabase/client';\nexport const load = () => createClient();",
      filename: 'src/lib/feed.ts',
      options: [{ browserPaths: REACT_NATIVE_BROWSER_PATHS }],
    },
  ],
  invalid: [
    {
      code: ADMIN_IMPORT,
      filename: 'src/lib/feed.ts',
      options: [{ browserPaths: REACT_NATIVE_BROWSER_PATHS }],
      errors: [
        {
          messageId: 'adminInBrowser',
          data: { source: '@/lib/supabase/admin' },
        },
      ],
    },
    {
      code: ADMIN_IMPORT,
      filename: 'src/screens/FeedScreen.tsx',
      options: [{ browserPaths: REACT_NATIVE_BROWSER_PATHS }],
      errors: [
        {
          messageId: 'adminInBrowser',
          data: { source: '@/lib/supabase/admin' },
        },
      ],
    },
  ],
});
