# legion-steer

## 0.6.0

### Minor Changes

- 3606c47: `legion-steer hook` now covers every write path Claude Code has, and says so
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

### Patch Changes

- Updated dependencies [3606c47]
  - legion-audit@0.6.0
  - legion-rules@0.6.0

## 0.5.0

### Minor Changes

- 45ef19c: Five changes aimed at the same thing: making the toolkit enforceable in a
  repo that already has debt, rather than only in a new one.
  
  **Autofixers.** None of the rules had one. `button-has-type` and
  `no-target-blank-without-rel` now insert the missing attribute, and
  `no-react-fc` performs the whole transform, moving the type argument onto the
  parameter so props do not silently become untyped. Three rules are
  deliberately left unfixable: `alt=""` is a semantic claim that an image is
  decorative, converting a `function` declaration to a `const` arrow changes
  hoisting, and a hex literal cannot be replaced without knowing the token
  name.
  
  **A suppression ratchet.** `legion-audit suppress` records today's findings
  as accepted, so a repo can move to error level immediately and fail only on
  new violations. This is what `--baseline` never did: that compares two
  reports, this is a budget per rule and file, and a fourth violation in a file
  that recorded three still fails.
  
  **`legion-steer`.** A new package that writes a managed block into
  `AGENTS.md`, `.junie/guidelines.md`, `.cursor/rules/legion.mdc` and
  `.github/copilot-instructions.md`, generated from the resolved lint config.
  A rule the config does not enforce cannot appear in the block, so steering
  cannot drift from enforcement. `legion-steer check` fails CI when it has.
  Only the region between its markers is ever touched.
  
  `legion-steer hook` closes the loop. Lint reports a violation after the file
  exists; the hook runs the same rules on the content Claude Code is about to
  write and exits 2, which blocks the write. `PreToolUse` lints
  `tool_input.content` in a scratch copy beside the intended path, so
  path-based rules see the real directory, and the finding is reported against
  the file the agent tried to write rather than the copy. `PostToolUse` lints
  what just landed and reports without blocking. `init` registers both in
  `.claude/settings.json`, merging with hooks that are already there.
  
  **A dependency check.** Section 10 lists adding a state library under
  automatic rejection and nothing was checking it. The audit now reads
  `package.json` for Redux, MobX, runtime CSS-in-JS and Moment, and nudges with
  what to use instead.
  
  **GitHub annotations.** `legion-audit --annotations` emits workflow commands,
  so findings land on the pull request diff rather than in a log.

### Patch Changes

- Updated dependencies [45ef19c]
- Updated dependencies [7fbbb67]
  - legion-rules@0.5.0
  - legion-audit@0.5.0
