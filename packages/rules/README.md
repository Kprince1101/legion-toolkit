# legion-rules

The rule engine behind [`eslint-plugin-legion`](https://www.npmjs.com/package/eslint-plugin-legion):
ESLint-format rules that run unchanged under oxlint (`jsPlugins`) and ESLint
v9+, plus `defineLegionConfig`, which turns a set of tolerance levels into
linter config for either runtime.

Most repos want the plugin, not this package. Install this directly only to
build your own plugin or config tooling on the rules.

## Rules

| Rule                                | Standard                  | What it flags                                                                                                                                                                                                                   |
| ----------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `presentational-components`         | LEGION-STANDARDS §0.1, §1 | In a component: `useState`/`useReducer`, effects, `useMemo`/`useCallback`, `fetch`, handlers with bodies, and non-JSX projections (`.map` to objects, `.filter`, `.sort`) inside JSX. Options: `allowState`, `allowRenderMaps`. |
| `no-narrative-comments`             | §13                       | Any comment except tool directives. Options: `allowPatterns` (extra regexes), `allowInEmptyBlocks` (Sonar S108/S1186).                                                                                                          |
| `scoped-disables`                   | §13, REACT-PARTNERSHIP    | A lint bypass that is file-wide, unnamed, unexplained (no `-- reason`), or names a locked rule.                                                                                                                                 |
| `no-disables`                       | REACT-PARTNERSHIP         | Every directive, so honored bypasses stay visible. Run at level 1.                                                                                                                                                              |
| `no-react-fc`                       | §0.4, §2                  | `React.FC`, `FC`, `FunctionComponent`, `VFC` annotations.                                                                                                                                                                       |
| `no-enum`                           | §0.4, §2                  | Any `enum`, including `const enum` and `declare enum`.                                                                                                                                                                          |
| `no-function-keyword`               | §0.4, §7                  | Any `function` declaration or expression, except generators and functions that own a `this`.                                                                                                                                    |
| `no-client-globals-in-state-init`   | §1 (hydration)            | `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `location`, `matchMedia` inside `useState(...)`.                                                                                                           |
| `no-use-client-in-page`             | §0.6, §3                  | `'use client'` on a `page` or `layout` file under `app/`.                                                                                                                                                                       |
| `guarded-context-hook`              | §0.5, §4                  | `useContext` anywhere except inside a `use*` hook whose body throws.                                                                                                                                                            |
| `no-literal-conditions-in-jsx`      | §1                        | A comparison against a string or number literal inside JSX (`slug === 'x' && ...`). Wants a named flag from the hook.                                                                                                           |
| `no-admin-client-in-browser`        | §6                        | An import of the service-role client in a `'use client'` file, a component, a hook, or a `*Client.tsx`. Options: `adminModules`, `browserPaths`.                                                                                |
| `no-hardcoded-hex`                  | §7, §10                   | A hex color literal outside a token file. Options: `allow`, `tokenFiles`. Off in test files.                                                                                                                                    |
| `no-array-index-key`                | §3                        | `key={i}` where `i` is the index parameter of the enclosing `.map`, including `` `row-${i}` `` and `i + 1`.                                                                                                                     |
| `button-has-type`                   | §3                        | A `<button>` with no `type`, or a `type` that is not `button`/`submit`/`reset`. Web only.                                                                                                                                       |
| `no-target-blank-without-rel`       | §5                        | `target="_blank"` on `a`/`area`/`form` without `noopener` or `noreferrer` in `rel`. Web only.                                                                                                                                   |
| `anchor-is-not-a-button`            | §3                        | An `<a>` with `onClick` and no `href`, or `href="#"` / `javascript:`. Web only.                                                                                                                                                 |
| `img-has-alt`                       | §3                        | `<img>` or `<Image>` with no `alt`. Pass `alt=""` for decorative. Web only.                                                                                                                                                     |
| `no-dangerous-html`                 | §5                        | Any `dangerouslySetInnerHTML`. Web only.                                                                                                                                                                                        |
| `no-rn-button`                      | §3                        | `<Button>` imported from `react-native`. React Native only.                                                                                                                                                                     |
| `touchable-has-accessibility-label` | §3                        | A touchable with `onPress`, no `accessibilityLabel`, and no `<Text>` inside it. Options: `components`. React Native only.                                                                                                       |
| `controlled-text-input`             | §3                        | `<TextInput value>` with no `onChangeText`, unless `editable={false}` or `readOnly`. React Native only.                                                                                                                         |

Web-only rules are off under the `reactNative` preset and native-only rules
are off everywhere else, so a config only ever runs the rules that can
actually fire on its platform.

New rules are introduced at level 1 in `recommended` (`INTRODUCED_AT_WARN`)
so that adding one cannot turn an existing repo's build red for code written
before the rule existed. They are at 3 in `strict` from the start.

Ternaries (§7) and the 180-line component cap (§1) are wired from the linters'
own `no-ternary`, `no-unneeded-ternary` and `max-lines` rules by
`defineLegionConfig`; `any` outside declared boundary paths comes from
`typescript/no-explicit-any`.

## Presets

`recommended` runs every rule at level 2, `strict` at 3, and `reactNative` is
`recommended` with the web assumptions removed. Any of them composes with
`defineLegionConfig`:

```ts
import { defineLegionConfig, recommendedInput } from 'legion-rules';

export const config = defineLegionConfig({
  ...recommendedInput,
  reactNative: true,
});
```

`reactNative: true` does three things. It turns off `no-use-client-in-page`
and `no-client-globals-in-state-init`, which describe failures that only
exist on a server-rendered page. It widens
`no-admin-client-in-browser` to every file, because a React Native bundle has
no server half and a service-role key in it is readable by anyone with the
app. And it adds the `src/`-prefixed paths to the `any` boundaries, since
that is where a React Native project keeps `lib/supabase`.

Everything else is unchanged: the rules are AST rules about React, and React
Native is React.

## Tolerance levels

Every rule takes one number, 0 to 3.

| Level | Meaning                                                                          |
| ----- | -------------------------------------------------------------------------------- |
| 0     | off                                                                              |
| 1     | warns                                                                            |
| 2     | fails lint; a scoped, named, explained `disable-next-line` is honored            |
| 3     | fails lint; locked. `scoped-disables` reports any directive that names the rule. |

```ts
import { defineLegionConfig } from 'legion-rules';

const config = defineLegionConfig({
  rules: {
    'no-narrative-comments': 3,
    'no-enum': 3,
    'no-function-keyword': 2,
    'no-disables': 1,
  },
  noTernary: 3,
  noExplicitAny: 2,
  anyBoundaries: ['lib/supabase/**', '**/*.d.ts'],
  componentMaxLines: 180,
  comments: { allowInEmptyBlocks: false, allowPatterns: [] },
  reactCompiler: true,
});

config.oxlint; // object for .oxlintrc.json
config.eslint(plugin); // flat config array
config.locked; // rule names at level 3
```

Presets: `recommended` (rules at 2, `no-disables` off) and `strict` (rules at
3, `no-disables` at 1).

## Zero dependencies

This package has no runtime dependencies. `eslint` and `oxlint` are optional
peers of the plugin, not of this package.

MIT, Copyright (c) 2026 Veracium LLC.
