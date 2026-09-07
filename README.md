# legion-toolkit

Coding standards that live in the build, not in a document.

This repo publishes the tooling behind LEGION-STANDARDS, a set of rules for
React, Next.js, and React Native codebases: components render and never
think, logic lives in `use*` hooks, zero comments, no `React.FC`, no `enum`,
no ternaries, no `function` keyword, guarded context hooks, hydration-safe
state, server-first pages, a 180-line component cap, and lint bypasses that
are scoped, named, explained, and impossible for locked rules. Every one of
those is a mechanical check here, because a rule that only lives in a
document drifts.

| Package                                              | What it is                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`legion-toolkit`](packages/toolkit)                 | One install, every tool as a subpath. Start here.                                                  |
| [`legion-init`](packages/init)                       | `npx legion-toolkit init`: detects the repo and wires all of this up without overwriting anything. |
| [`eslint-plugin-legion`](packages/eslint-plugin)     | The rules as a plugin. Runs under oxlint (`jsPlugins`) and ESLint v9+, identically, proven in CI.  |
| [`legion-rules`](packages/rules)                     | The rule engine and `defineLegionConfig`, which maps tolerance levels 0 to 3 onto either linter.   |
| [`legion-audit`](packages/audit)                     | A read-only scorecard: gates, per-rule counts, bypasses, PR hygiene, coverage. Plus the nudges.    |
| [`legion-steer`](packages/steer)                     | Agent instructions generated from the resolved lint config, so what agents are told cannot drift.  |
| [`legion-prettier-config`](packages/prettier-config) | Single quotes, trailing commas, 80 columns.                                                        |
| [`legion-tsconfig`](packages/tsconfig)               | Strict base plus node, next, and react-native variants.                                            |

## Quick start

```sh
yarn add -D legion-toolkit oxlint prettier typescript
```

```jsonc
// .oxlintrc.json
{
  "jsPlugins": ["legion-toolkit/eslint-plugin"],
  "rules": { "legion/no-enum": "error" },
}
```

```jsonc
// package.json
{
  "prettier": "legion-toolkit/prettier",
  "scripts": { "lint": "legion-audit directives && oxlint ." },
}
```

Each package README has the full setup, including ESLint and the tolerance
levels.

## React Native

`reactNative` is `recommended` with the web assumptions removed: the two
rules that can only fire on a server-rendered page are off, and the
service-role client check widens to every file, because on a device the whole
bundle ships and there is no such thing as a file the user cannot reach.

```js
import legion from 'legion-toolkit/eslint-plugin';

export default [...legion.configs.reactNative];
```

On an Expo project `legion-audit` also runs `expo-doctor` as a gate, with
patch-level version drift demoted to a nudge.

## Nudges

`legion-audit` ends every run by saying what the repo could do better, why it
matters, and the exact command: migrate off npm to Yarn Berry, delete the
second lockfile, wire up the plugin you installed but never referenced, add
the coverage report so the audit measures instead of guesses. Advisory only,
never affecting the score or the exit code. `legion-audit advice` prints just
those.

## Tolerance levels

Every rule is configured with one number. `0` off, `1` warn, `2` error with a
scoped and explained `disable-next-line` honored, `3` error and locked: any
directive naming the rule is itself a violation. `recommended` runs the rules
at 2, `strict` at 3.

## Zero dependencies, three package managers

No published package has a third-party runtime dependency. The packages are
built and tested here with Yarn 4, and CI installs the packed tarballs into a
fixture app under Yarn, npm, and pnpm and runs the plugin and the audit in
each.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: Yarn 4, `yarn
validate` must be green, PRs need a changeset, and the rules apply to this
repo too (it lints itself with its own plugin).

## License

MIT, Copyright (c) 2026 Veracium LLC. See [LICENSE](LICENSE).
