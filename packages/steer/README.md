# legion-steer

Lint catches a violation after the agent has already written it. By then the
oversized component exists and the fix is a refactor nobody asked for.
`legion-steer` moves the rules earlier: into the agent's context, before it
writes.

```sh
npx legion-steer init            # write or refresh the block
npx legion-steer check           # exit 1 on drift, for CI
```

## The block is generated, never hand-written

It comes from the repo's **resolved lint config** — the rules that are on,
each at its level, what a bypass looks like, which rules are locked, and the
lint command.

That is the whole point. A rule the config does not enforce cannot appear in
the block, so what the agents are told cannot drift from what the linter
does. The same argument LEGION-STANDARDS §8.1 makes about documented rules
applies to agent instructions, which until now were hand-maintained prose in
every repo.

Steering for a React Native repo names `no-rn-button` and
`controlled-text-input` and omits `button-has-type`, because that is what
the `reactNative` preset actually enforces. Nobody has to remember to keep
the two in step.

## Targets

Detected automatically, or chosen with `--targets`:

| id        | file                              |
| --------- | --------------------------------- |
| `agents`  | `AGENTS.md`                       |
| `junie`   | `.junie/guidelines.md`            |
| `cursor`  | `.cursor/rules/legion.mdc`        |
| `copilot` | `.github/copilot-instructions.md` |

With none present it writes `AGENTS.md`.

## It only owns what is between the markers

```md
<!-- legion-steer:start -->

...generated...
<!-- legion-steer:end -->
```

Content outside them is never touched. A file that already exists gets the
block appended; a file that already has the markers gets only that region
replaced; a file already current is left alone entirely.

## Relationship to LEGION-STANDARDS

The block states **what this repo enforces** and points at
LEGION-STANDARDS.md for why. It deliberately does not reproduce or condense
the standards, which §14 rules out — one file, one location, read by every
repo underneath.

## `check` in CI

```sh
legion-steer check || exit 1
```

Regenerates the block in memory and compares. Non-zero when a repo's steering
has fallen behind its own lint config.

## Options

```
--root <dir>       repo root (default: cwd)
--preset <name>    recommended | strict | reactNative
--targets <ids>    comma separated (default: whichever are present)
--lint <command>   the lint command to name in the block
```
