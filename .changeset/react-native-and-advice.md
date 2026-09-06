---
'eslint-plugin-legion': minor
'legion-rules': minor
'legion-audit': minor
'legion-toolkit': minor
---

React Native support and an advice layer.

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
