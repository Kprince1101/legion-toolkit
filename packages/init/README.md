# legion-init

The front door for the Legion toolkit. One command wires a repo's lint
config, Prettier, tsconfig and audit script, and it never overwrites anything.

```sh
npx legion-toolkit init --dry-run   # look first
npx legion-toolkit init --yes       # apply
```

## What it detects

Without asking: the package manager (from the lockfile, at the workspace root
when this is a monorepo package), the linter (an existing oxlint or ESLint
config, oxlint for a new repo), the framework (`expo`, `react-native`,
`next`, `vite`, `node`), and which agents are present (`.claude/`, `.junie/`,
`.cursor/`, `AGENTS.md`, Copilot instructions).

The framework picks the preset: an Expo or React Native repo gets
`reactNative`, everything else gets `recommended`. Override with `--preset`.

## What it writes

| File                                   | Behaviour                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `.oxlintrc.json` / `eslint.config.mjs` | created when absent; **skipped** when it already references the plugin; reported as `merge` when it exists without it      |
| `tsconfig.json`                        | created when absent, extending the base for the detected framework; never touched if present                               |
| `package.json`                         | `prettier` set only when no Prettier config exists; `lint` and `audit` scripts **added only when missing**, never replaced |

Nothing is overwritten. An existing `lint` script you wrote yourself survives
untouched; `init` only fills in what is not there.

## The generated lint config extends, it does not enumerate

```jsonc
{
  "extends": ["./node_modules/legion-toolkit/presets/recommended.json"],
}
```

This matters. A config that lists every rule by hand stops receiving them:
rules added in a later version sit at 0 and nothing says so. Extending the
shipped preset means an upgrade brings the new rules with it.
`legion-audit` will nudge you if it finds a config that enumerates instead.

## Options

```
--root <dir>       repo root (default: cwd)
--preset <name>    recommended | strict | reactNative (default: detected)
--linter <name>    oxlint | eslint (default: detected)
--yes, -y          apply the plan without prompting (for CI and agents)
--dry-run          print the plan and stop
```

`init` prints the plan and stops unless `--yes` is passed, so an agent that
runs it without the flag cannot change anything and cannot hang on a prompt.
