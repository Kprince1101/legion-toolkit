# legion-rules

The rule engine behind [`eslint-plugin-legion`](https://www.npmjs.com/package/eslint-plugin-legion):
ESLint-format rules that run unchanged under oxlint (`jsPlugins`) and ESLint
v9+, plus `defineLegionConfig`, which turns a set of tolerance levels into
linter config for either runtime.

Most repos want the plugin, not this package. Install this directly only to
build your own plugin or config tooling on the rules.

## Rules

| Rule                              | Standard                  | What it flags                                                                                                                                                                                                                   |
| --------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `presentational-components`       | LEGION-STANDARDS §0.1, §1 | In a component: `useState`/`useReducer`, effects, `useMemo`/`useCallback`, `fetch`, handlers with bodies, and non-JSX projections (`.map` to objects, `.filter`, `.sort`) inside JSX. Options: `allowState`, `allowRenderMaps`. |
| `no-narrative-comments`           | §13                       | Any comment except tool directives. Options: `allowPatterns` (extra regexes), `allowInEmptyBlocks` (Sonar S108/S1186).                                                                                                          |
| `scoped-disables`                 | §13, REACT-PARTNERSHIP    | A lint bypass that is file-wide, unnamed, unexplained (no `-- reason`), or names a locked rule.                                                                                                                                 |
| `no-disables`                     | REACT-PARTNERSHIP         | Every directive, so honored bypasses stay visible. Run at level 1.                                                                                                                                                              |
| `no-react-fc`                     | §0.4, §2                  | `React.FC`, `FC`, `FunctionComponent`, `VFC` annotations.                                                                                                                                                                       |
| `no-enum`                         | §0.4, §2                  | Any `enum`, including `const enum` and `declare enum`.                                                                                                                                                                          |
| `no-function-keyword`             | §0.4, §7                  | Any `function` declaration or expression, except generators and functions that own a `this`.                                                                                                                                    |
| `no-client-globals-in-state-init` | §1 (hydration)            | `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `location`, `matchMedia` inside `useState(...)`.                                                                                                           |
| `no-use-client-in-page`           | §0.6, §3                  | `'use client'` on a `page` or `layout` file under `app/`.                                                                                                                                                                       |
| `guarded-context-hook`            | §0.5, §4                  | `useContext` anywhere except inside a `use*` hook whose body throws.                                                                                                                                                            |
| `no-literal-conditions-in-jsx`    | §1                        | A comparison against a string or number literal inside JSX (`slug === 'x' && ...`). Wants a named flag from the hook.                                                                                                           |
| `no-admin-client-in-browser`      | §6                        | An import of the service-role client in a `'use client'` file, a component, a hook, or a `*Client.tsx`. Options: `adminModules`, `browserPaths`.                                                                                |

Ternaries (§7) and the 180-line component cap (§1) are wired from the linters'
own `no-ternary`, `no-unneeded-ternary` and `max-lines` rules by
`defineLegionConfig`; `any` outside declared boundary paths comes from
`typescript/no-explicit-any`.

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
