# legion-toolkit

Your AI agent writes the code, and lint catches the violation after it is
already written. By then the oversized component exists and the fix is a
refactor nobody asked for. `legion-steer` moves the rules earlier: into the
agent's context before it writes, and into a Claude Code hook that blocks the
write.

```sh
npx legion-steer init
```

That one command does two things:

- **Writes the rules into your agent instruction files**: `AGENTS.md`,
  `.cursor/rules/legion.mdc`, `.github/copilot-instructions.md` and
  `.junie/guidelines.md`, whichever the repo already has (`AGENTS.md` if it
  has none). The block is generated from a Legion lint preset (`--preset`),
  never hand-written, so what the agents are told matches what the linter
  enforces, as long as your lint config uses the same preset.
- **Registers a Claude Code hook** in `.claude/settings.json`. Before Claude
  writes a TypeScript file, the hook lints the content it is about to write
  and blocks the write if the file would contain a lint error. Claude gets the reason
  and writes it again.

<!-- DEMO GIF PLACEHOLDER: Legion is recording this. Replace this comment and the quote below with the GIF of a blocked write and the rewrite. -->

> **[Demo GIF placeholder]** Claude Code writes a component with `useState`
> inline, the hook blocks the write, and Claude rewrites it with the state
> moved into a `use*` hook. Legion is recording this.

What Claude sees when a write is blocked:

```
legion-steer: 1 violation(s) would land in this file
  src/Panel.tsx:2  `useState` inside `Panel` is state in a component
                   (LEGION-STANDARDS section 1). Own it in `usePanel` and
                   return the value and a `handleX` setter.
Move the logic into a use<Component> hook or lib/, then write the file again.
```

### What the hook does not block

- **Edits.** The check that blocks runs on `Write` only. `Edit` is linted
  after it lands and Claude is told about the error, but the edit itself is
  not stopped.
- **Writes that do not go through Claude Code's `Write` or `Edit` tools**:
  shell commands such as `sed -i` or `cat > file`, scripts, and any other
  file tool.
- **Other agents.** Cursor, Copilot and Junie get the rules in their
  instruction files. Nothing blocks their writes.
- **Files that are not TypeScript.** Only `.ts`, `.tsx`, `.mts` and `.cts`
  are checked. JavaScript and JSX pass straight through.
- **Warnings.** Only lint errors block.
- **Repos without the lint set up.** The hook runs your local `oxlint` with
  your config. If `oxlint` is not installed, or the check cannot run, the
  write is allowed. It only blocks rules your config turns on, so set up the
  lint below.

Run lint in CI to catch what the hook lets through, and
`npx legion-steer check` to fail when the steering block falls out of date.
The [legion-steer README](packages/steer) has the options.

## The rules behind it

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

## Lint quick start

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
built and tested here with pnpm 10, and CI installs the packed tarballs into a
fixture app under Yarn, npm, and pnpm and runs the plugin and the audit in
each.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: pnpm 10, `pnpm
validate` must be green, PRs need a changeset, and the rules apply to this
repo too (it lints itself with its own plugin).

## License

MIT, Copyright (c) 2026 Veracium LLC. See [LICENSE](LICENSE).
