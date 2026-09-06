---
'legion-init': minor
'legion-toolkit': minor
---

`legion-toolkit init`, the front door.

One command wires a repo's lint config, Prettier, tsconfig and audit script.
It detects the package manager from the lockfile (at the workspace root when
this is a monorepo package), the linter from an existing config, the
framework, and which agents are present, then prints the plan and stops.
Nothing is written without `--yes`, so an agent that runs it cannot change
anything by accident and cannot hang on a prompt.

Nothing is ever overwritten. An existing lint config that already references
the plugin is skipped and one that does not is reported as a merge rather
than replaced; an existing `tsconfig.json` or Prettier config is left alone;
and `lint` and `audit` scripts are added only when missing, so a `lint`
script you wrote yourself survives untouched.

The generated lint config extends a preset rather than enumerating rules:

```jsonc
{ "extends": ["./node_modules/legion-toolkit/presets/recommended.json"] }
```

`legion-toolkit` now ships those presets as oxlint configs, generated from
`legion-rules` at build time. This is the difference between a repo that
receives new rules on upgrade and one that freezes at whatever existed the
day it was set up, which is the drift `legion-audit`'s rule-coverage nudge
exists to report.
