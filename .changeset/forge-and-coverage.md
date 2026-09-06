---
'legion-audit': minor
'legion-toolkit': minor
---

**Breaking:** `runAudit` is now `async` and returns `Promise<AuditResult>`.
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
