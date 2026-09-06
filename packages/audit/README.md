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
| tests by file      | components (`components/**`, `app/**`) and `use*` hooks without a matching test file  |
| lockfile           | exactly one lockfile at the root                                                      |

A tool that is not installed reports `skipped`, never `pass`.

## Output

`AUDIT.md` opens with the gate table, then per-rule counts, findings with
file and line, the bypass list, PR hygiene, tests by file, and the score
formula. `audit.json` carries the same data (`schema: 1`).

The score starts at 100 and subtracts documented penalties (see the bottom of
any report). It is meant for comparing runs of the same repo over time, not
for comparing repos to each other.

## In CI

```sh
legion-audit --baseline audit.json --json audit.json --md AUDIT.md
```

With `--baseline`, the exit code is non-zero on any regression: a gate that
flipped from pass to fail, more `legion/*` errors, more lint errors, more
file-wide disables, more files without tests, or a lower score. `--fail-on
error` fails on any failed gate or `legion/*` error regardless of baseline;
`--fail-on never` always exits 0.

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
