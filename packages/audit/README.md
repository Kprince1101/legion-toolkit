# legion-audit

A read-only scorecard of a repo against
[LEGION-STANDARDS](https://github.com/Kprince1101/legion-toolkit#readme). It
runs the gates your CI already runs, counts what the
[`legion/*` rules](https://www.npmjs.com/package/eslint-plugin-legion) find,
lists every lint bypass, checks PR hygiene and which components and hooks
have no test file, and writes the result as Markdown and JSON. Nothing is
modified.

```sh
yarn add -D legion-audit
yarn legion-audit --md AUDIT.md --json audit.json
```

## What it checks

| Check              | Source of truth                                                                       |
| ------------------ | ------------------------------------------------------------------------------------- |
| typecheck          | `tsc --noEmit -p tsconfig.json` (skipped when there is no tsconfig or local tsc)      |
| lint               | the repo's oxlint or ESLint, `--format json`; counts per rule, `legion/*` findings    |
| tests              | the `test:ci` or `test` script, run through the detected package manager              |
| format             | `prettier --check .` (skipped when prettier is not installed)                         |
| dependency audit   | `yarn npm audit` / `npm audit` / `pnpm audit` at high severity (skipped when offline) |
| lint bypasses      | every `eslint-disable` / `oxlint-disable` directive and `NOSONAR`, counted per rule   |
| file-wide disables | a bare `/* eslint-disable */` or `/* oxlint-disable */`; always a hard fail           |
| PR hygiene         | share of the last 80 commits whose subject carries a `(#123)` PR number               |
| expo-doctor        | `expo-doctor` on an Expo project; patch-level drift is a nudge, not a failure         |
| test coverage      | the coverage report when there is one, otherwise what the test files actually import  |
| lockfile           | exactly one lockfile, found at the workspace root when this is a monorepo package     |
| toolchain          | package manager and Yarn flavor, framework, whether the plugin is actually wired in   |

A tool that is not installed reports `skipped`, never `pass`.

### Test coverage, in order of preference

The question is which components and hooks are actually exercised, and there
are three ways to answer it. The audit uses the best one available and says
which in the report:

1. **`coverage/coverage-summary.json`** if it exists. Real per-file line
   coverage, which is a measurement rather than a guess. Run the suite once
   with `--coverage --coverageReporters=json-summary` to get it.
2. **What the test files import and `describe`.** One file covering thirteen
   components counts for all thirteen. Group your tests however reads best;
   the audit is not a reason to split them.
3. **Matching base names**, only when there is nothing better to go on.

### expo-doctor

On an Expo project the doctor runs as a gate, but not every doctor failure is
equal. A wrong major or minor against the installed SDK breaks builds and
fails the gate. A newer patch existing does not break anything, and Expo
ships patches faster than a project can consume them, so that is reported as
a nudge with the exact `expo install --fix` to run. A gate that goes red for
something unrelated to your code is a gate people learn to ignore.

## Output

`AUDIT.md` opens with the gate table, then per-rule counts, findings with
file and line, the bypass list, PR hygiene, tests by file, and the score
formula. `audit.json` carries the same data (`schema: 1`).

The score starts at 100 and subtracts documented penalties (see the bottom of
any report). It is meant for comparing runs of the same repo over time, not
for comparing repos to each other.

Two things deliberately do not score, because a score should measure what the
current state of the code controls:

- **PR hygiene is a nudge, not a penalty.** It reads commit history on `main`,
  which cannot be fixed retroactively and corrects itself as PR-tagged commits
  land. Section 12 requires a PR on a client repo; on your own repo it is your
  call, and the audit is not the place to argue about it.
- **The test penalty is a share, not a count.** Decomposing one oversized
  component into ten presentational children is exactly what section 1 asks
  for, and it triples the denominator. Scoring the count would mean the score
  got worse for doing the right thing.

## In CI

```sh
legion-audit --baseline audit.json --json audit.json --md AUDIT.md
```

With `--baseline`, the exit code is non-zero on any regression: a gate that
flipped from pass to fail, more `legion/*` errors, more lint errors, more
file-wide disables, more files without tests, or a lower score. `--fail-on
error` fails on any failed gate or `legion/*` error regardless of baseline;
`--fail-on never` always exits 0.

## Nudges

Every run ends with the nudges: what this repo could do better, why it
matters, and the command to do it. They are advisory. They never change the
score and never change the exit code, because advice that can fail your build
is not advice.

```
legion-audit: score 71/100, all gates green

TOOLCHAIN
  This repo runs on npm. Legion repos run on Yarn Berry.
    why  Berry writes a packageManager field into package.json, so
         Corepack pins the exact Yarn every machine and every CI runner
         uses.
    fix  corepack enable
    fix  yarn set version berry
    fix  rm -rf node_modules package-lock.json
    fix  yarn install
```

`legion-audit advice` prints only that, skipping the slow gates. The nudges
also land in `AUDIT.md` under `## Nudges` and in the JSON as `advice`.

## `legion-audit directives`

The fast subcommand: only the file-wide disable scan, exit 1 if any. A
file-wide disable suppresses every rule in the file including the one that
would report it, so no lint rule can catch it. Put this in front of the
linter:

```jsonc
{ "scripts": { "lint": "legion-audit directives && oxlint ." } }
```

## Options

```
--root <dir>       repo root (default: cwd)
--md <file>        write the Markdown report (default: stdout)
--json <file>      write the JSON report
--baseline <file>  previous JSON report to diff against
--fail-on <mode>   regression | error | never
--ignore <path>    skip a directory for the directive scan and tests-by-file (repeatable)
--no-deps-audit    skip the dependency audit
--no-tests         skip the test script
--no-typecheck     skip tsc
--no-format        skip prettier
--quiet, -q        no progress on stderr
```

Node 22 or newer. No runtime dependencies.

MIT, Copyright (c) 2026 Veracium LLC.
