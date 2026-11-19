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

## The hook: catching it before it lands

Lint tells you after the file exists. `legion-steer hook` runs the same rules
on the content Claude Code is _about to write_, and blocks the write when it
would introduce an error.

`init` registers it in `.claude/settings.json`, merging with whatever is
already there and replacing the narrower matchers an older `init` wrote:

| event         | matcher                                      | behaviour                                                                                                                                                                                                                                                                               |
| ------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PreToolUse`  | `Write\|Edit\|MultiEdit\|NotebookEdit\|Bash` | Works out the file as it will be after the write (Write content, or Edit and MultiEdit replayed on the file on disk) and lints it in a scratch copy beside the target, so path-based rules see the real directory. Exit 2 blocks the write. For Bash it notes when the command started. |
| `PostToolUse` | `Write\|Edit\|MultiEdit\|Bash`               | For Bash, lints every TypeScript or JavaScript file git sees changed since the command started and reports. For a file write, only acts when the pre-check could not run.                                                                                                               |

Only errors block, and only the ones the write introduces: a violation that
was already in the file is counted and named, not blocked, so an edit to a
legacy file is not held hostage by its history. The config used is the
nearest oxlint config above the target, which is what oxlint itself does in
a monorepo.

What the agent actually sees:

```
legion-steer: 1 violation(s) would land in this file
  src/Panel.tsx:2  `useState` inside `Panel` is state in a component
                   (LEGION-STANDARDS section 1). Own it in `usePanel` and
                   return the value and a `handleX` setter.
Fix the code rather than bypassing the rule, then write the file again.
```

The path is the file it tried to write, not the scratch copy, and the message
says what to do rather than only what is wrong.

### It never steps aside quietly

When the hook lets a write through without checking it, it says so: a
`systemMessage` the user sees, the same text on stderr, and after a Bash
command the text is also handed to the agent as `additionalContext`. That
covers oxlint missing, no config, a config oxlint cannot load, a path the
config ignores, an edit it cannot replay, notebooks, lint config files, a
bypass the agent adds that the config allows, and the hook itself crashing.
A clean write of a checked file produces no output at all.

### Coverage by write path

Each row has a test in `src/coverage.test.ts`.

| write path                                         | status         | how                                                                                                                                      |
| -------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `Write`                                            | covered        | content linted before it lands                                                                                                           |
| `Edit`                                             | covered        | edit replayed on the file on disk, result linted before it lands                                                                         |
| `MultiEdit`                                        | covered        | edits replayed in order, result linted before it lands                                                                                   |
| `Edit` or `MultiEdit` the hook cannot replay       | after the fact | announced, then the file is linted right after it lands                                                                                  |
| `NotebookEdit`                                     | not covered    | announced every time                                                                                                                     |
| writes made by subagents                           | covered        | Claude Code fires the same hooks for a subagent's tool calls; the payload is judged identically                                          |
| Bash: `echo` or `cat` redirection, heredoc, append | after the fact | files git sees changed since the command started are linted and reported                                                                 |
| Bash: `sed -i`                                     | after the fact | same                                                                                                                                     |
| Bash: a node or python script writing a file       | after the fact | same                                                                                                                                     |
| Bash: write and `git commit` in one command        | after the fact | files changed since the commit the command started from are linted against that commit; if HEAD moved and that commit is gone, announced |
| `.js`, `.jsx`, `.mjs`, `.cjs`                      | covered        | linted like TypeScript                                                                                                                   |
| lint config (`.oxlintrc.json`, `eslint.config.*`)  | not covered    | announced, from Write, Edit or Bash; a JavaScript config is still linted as code, but what it turns off is not judged                    |
| oxlint missing                                     | not covered    | announced                                                                                                                                |
| broken lint config, or a plugin that will not load | not covered    | announced; before this, it passed as clean                                                                                               |
| a path the lint config ignores                     | not covered    | announced; before this, it passed as clean                                                                                               |
| a new directory                                    | covered        | created for the scratch copy, then removed                                                                                               |
| a fresh git worktree with no install               | not covered    | announced as oxlint missing                                                                                                              |
| a monorepo subpackage                              | covered        | nearest config wins, including when the session starts inside the subpackage                                                             |
| scoped bypass of a locked rule, or with no reason  | covered        | `legion/scoped-disables` blocks it                                                                                                       |
| scoped, explained bypass of an unlocked rule       | allowed        | the config permits it; the hook announces it                                                                                             |
| file-wide bypass (`/* eslint-disable */`)          | covered        | blocked by the hook itself, whatever the config says, from Write, Edit or Bash                                                           |

### What it does not catch

- **Notebook cells.** oxlint does not read `.ipynb`.
- **What a lint config change does.** Turning a rule off in
  `.oxlintrc.json` is announced, not judged.
- **Bash writes before they land.** A command's output cannot be seen until
  it runs, so Bash writes are reported after the fact, not blocked.
- **Bash writes git cannot see**: files under a gitignored path, files
  outside the repository, and any Bash write in a directory that is not a
  git repository (announced).
- **Files a background command writes after it was launched.** The hook
  runs when Claude Code gets the command back, which for
  `run_in_background` is at launch (announced).
- **Bash attribution is by modification time.** A file another process
  touches while the command runs is checked as if the command wrote it,
  and reported against the commit the command started from.
- **Commits rewritten out from under the hook.** If a command moves HEAD
  and the commit it started from no longer exists (an amend followed by
  `git gc --prune=now`), files it committed are not listed (announced).
- **Anything when oxlint cannot run**: not installed, including a fresh
  worktree before `install`; no config; a config it cannot load; a path the
  config ignores. Each is announced.
- **A bypass the config allows.** A scoped, explained
  `eslint-disable-next-line` of a rule that is not locked lands, announced.
- **ESLint-only repos.** The hook runs oxlint; with no oxlint config it
  announces that it checked nothing.
- **Edits the hook cannot replay**, for example when Claude Code matches
  `old_string` loosely. They are linted right after they land instead.
- **Cost.** Every Bash command now runs the hook twice, once on each side.
  `init --no-hooks` skips registration.

Skip registration with `--no-hooks`.

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
