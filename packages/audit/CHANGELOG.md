# legion-audit

## 0.3.0

### Minor Changes

- 649a264: Ten new rules, a platform split, and the React Compiler flag actually working.
  
  Two of the rules were already law in LEGION-STANDARDS with no mechanical
  check, which is the drift §8.1 warns about: `no-hardcoded-hex` (§7, §10 lists
  it under automatic rejection) and `no-rn-button` (§3 mandates
  `TouchableOpacity`, not `Button`). The rest are silent-default bugs rather
  than style: `button-has-type` (HTML defaults a bare button to `submit`, so
  one inside a form reloads the page), `no-target-blank-without-rel`,
  `anchor-is-not-a-button`, `img-has-alt`, `no-dangerous-html`,
  `no-array-index-key`, `touchable-has-accessibility-label` and
  `controlled-text-input`.
  
  Rules now know their platform. `WEB_ONLY_RULES` gained the five DOM rules and
  a mirrored `NATIVE_ONLY_RULES` holds the three React Native ones, so a config
  only runs what can fire on its platform: the DOM rules are off under
  `reactNative`, the native rules off everywhere else, and `no-hardcoded-hex`
  and `no-array-index-key` run in both.
  
  New rules land at level 1 in `recommended` and 3 in `strict`. The cohort is
  exported as `INTRODUCED_AT_WARN`, so promoting them later is one edit and the
  preset tests fail if the policy changes silently. Adding a rule should never
  turn an existing repo's build red for code written before it existed.
  
  `reactCompiler: true` now works when composed with a preset. It only enabled
  `no-manual-memo` when the rule was `undefined`, but both presets set it to
  `0` explicitly, so the flag was inert for every documented way of using it.
  `legion-audit` also detects the compiler now — from
  `babel-plugin-react-compiler`, `eslint-plugin-react-compiler`, or
  `reactCompiler` in a Next config, never from the React version, since React
  19 does not imply the compiler — and nudges when it is on while the rule is
  off.
  
  `no-hardcoded-hex` is off in test files, since a rule's own fixtures have to
  contain the thing it forbids.
- 6c16c00: **Breaking:** `runAudit` is now `async` and returns `Promise<AuditResult>`.
  Reading the consumer's installed plugin needs a dynamic import, which cannot
  be done synchronously. Callers must `await` it. The `legion-audit` CLI does
  this internally, so only code importing `runAudit` directly is affected. The
  version bump stays minor because pre-1.0 that is where a breaking change
  lands; a `major` here would force 1.0.0, which is a decision this change
  should not make on its own.
  
  PR hygiene understands more than GitHub, and the audit reports rules your
  config never picked up.
  
  `prHygiene` matched `/\(#\d+\)/`, which is GitHub's squash-merge subject and
  nothing else. A GitLab, Bitbucket or Azure DevOps repo scored 0% and got a
  nudge telling a team that reviews everything that it reviews nothing. The
  forge is now read from the origin remote, each one gets the pattern it
  actually writes, and the fix command matches the host (`gh pr create`,
  `glab mr create`, `az repos pr create`). GitLab's merge-request reference
  lives in the commit body rather than the subject, so the log format is now
  `%s%n%b`. An unrecognized host skips the check rather than guessing, because
  guessing is what caused this.
  
  New `ruleCoverage` check. A config that enumerates rules by hand stops
  receiving them: the rules added since it was written sit at 0 and nothing
  says so. The audit now reads the rule list from the plugin _the consumer has
  installed_, compares it against what their oxlint config names or what
  `eslint --print-config` resolves, and nudges with the missing rules by name.
  Reading from the installed plugin rather than a list baked into the audit
  keeps `legion-audit` dependency-free and means it reports against the version
  in front of it.

## 0.2.0

### Minor Changes

- 4d0ccf6: React Native support and an advice layer.
  
  `legion-rules` gains a `reactNative` preset and a `reactNative: true` flag on
  `defineLegionConfig`. It turns off the two rules that can only describe a
  server-rendered page, widens `no-admin-client-in-browser` to every file
  because a device bundle has no unreachable half, and adds the `src/`-prefixed
  `any` boundaries. `eslint-plugin-legion` exposes it as
  `configs.reactNative`.
  
  `legion-audit` gains three things. An `expo-doctor` gate on Expo projects
  that keeps a real version incompatibility blocking while demoting
  patch-level drift to a nudge. Workspace awareness, so a package inside a
  monorepo finds the lockfile and the hoisted bins at the workspace root
  instead of reporting them missing. And a nudge layer: every run now ends with
  what the repo could do better, why, and the command, including migrating off
  npm or Yarn Classic to Yarn Berry in whichever package manager is currently
  in use. Nudges never affect the score or the exit code. `legion-audit advice`
  prints only those.
  
  Two scoring changes, both so the number measures what the current code
  controls. PR hygiene no longer scores at all: it reads history on `main`,
  cannot be fixed retroactively, and section 12 only requires a PR on a client
  repo, so it is now a nudge. And the test penalty is the _share_ of components
  and hooks left uncovered rather than the count, so decomposing one oversized
  component into ten presentational children cannot make the score worse than
  the component it replaced. `findRegressions` compares the same share for the
  same reason.
  
  Test coverage is now measured rather than guessed. The audit reads
  `coverage/coverage-summary.json` when it exists, then Istanbul's
  `coverage-final.json` (which is what Jest's default reporters write, so it is
  the more common of the two), then falls back to what the test files actually
  import and `describe`, and only then to matching base names. A single test
  file covering many components now counts for all of them.

## 0.1.0

### Minor Changes

- ecc18df: Initial release: nine grade A rules with tolerance levels, the oxlint/ESLint plugin, the audit CLI with the `directives` subcommand, the Prettier and TypeScript configs, and the umbrella package.
