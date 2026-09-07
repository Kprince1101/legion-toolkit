# legion-steer

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
