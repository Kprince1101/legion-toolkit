# legion-toolkit

One install for the whole toolkit behind
[LEGION-STANDARDS](https://github.com/Kprince1101/legion-toolkit#readme).
Every tool is exposed as a subpath, so a repo never has to know the
individual package names, and every tool added to the toolkit shows up here.

```sh
yarn add -D legion-toolkit oxlint prettier typescript
```

Installing runs nothing. A tool is on only where you reference it.

## Lint (oxlint)

```jsonc
// .oxlintrc.json
{
  "jsPlugins": ["legion-toolkit/eslint-plugin"],
  "rules": { "legion/no-narrative-comments": "error" },
}
```

Or generate a full preset:

```js
import { writeFileSync } from 'node:fs';
import { strict } from 'legion-toolkit/rules';

writeFileSync('.oxlintrc.json', JSON.stringify(strict.oxlint, null, 2));
```

## Lint (ESLint)

```js
import legion from 'legion-toolkit/eslint-plugin';

export default [...legion.configs.strict];
```

## Prettier and TypeScript

```jsonc
// package.json
{ "prettier": "legion-toolkit/prettier" }
```

```jsonc
// tsconfig.json
{ "extends": "legion-toolkit/tsconfig/next.json" }
```

`base.json`, `node.json`, `next.json`, and `react-native.json` are available.

## Audit

```sh
yarn legion-audit --md AUDIT.md --json audit.json
yarn legion-audit directives
```

The `legion-audit` command is provided by this package directly, so it works
under Yarn, npm, and pnpm without relying on transitive bin linking.

## Packages inside

| Subpath                        | Package                  |
| ------------------------------ | ------------------------ |
| `legion-toolkit/eslint-plugin` | `eslint-plugin-legion`   |
| `legion-toolkit/rules`         | `legion-rules`           |
| `legion-toolkit/audit`         | `legion-audit`           |
| `legion-toolkit/prettier`      | `legion-prettier-config` |
| `legion-toolkit/tsconfig/*`    | `legion-tsconfig`        |

Each is also published on its own for repos that want a smaller footprint.

Node 22 or newer. Peers (all optional): `oxlint >= 1.53`, `eslint >= 9`,
`prettier >= 3`.

MIT, Copyright (c) 2026 Veracium LLC.
