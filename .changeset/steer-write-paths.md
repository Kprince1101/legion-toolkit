---
'legion-steer': minor
'legion-audit': minor
---

`legion-steer hook` now covers every write path Claude Code has, and says so
whenever it lets one through unchecked.

`Edit` and `MultiEdit` are checked before they land: the edit is replayed on
the file on disk and the result is linted in a scratch copy, the same as
`Write`. Only violations the write introduces block, so an edit to a file
that already has some is not refused for them.

Bash writes are checked after the command runs: every TypeScript or
JavaScript file git sees changed since it started is linted against what is
committed. That covers redirection, `sed -i`, and scripts.

`.js`, `.jsx`, `.mjs` and `.cjs` are linted. The nearest oxlint config is
used, so monorepo subpackages and sessions started inside one work. A
file-wide `eslint-disable` is blocked by the hook itself.

A broken config, a plugin that will not load, or a path the config ignores
used to pass as clean. Those, oxlint missing, notebooks, lint config changes,
and bypasses the config allows are now announced. Re-run `legion-steer init`
to pick up the wider matchers; it replaces the ones it wrote before.

`legion-audit` exports `OXLINT_CONFIGS` and `ESLINT_CONFIGS`.
