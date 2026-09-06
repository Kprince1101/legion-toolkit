# legion-tsconfig

Shared strict TypeScript configs for repos that follow
[LEGION-STANDARDS](https://github.com/Kprince1101/legion-toolkit#readme).

```jsonc
// tsconfig.json
{ "extends": "legion-tsconfig/next.json" }
```

| File                | For                                              |
| ------------------- | ------------------------------------------------ |
| `base.json`         | The strict flags every other file extends        |
| `node.json`         | Node libraries and CLIs (NodeNext, declarations) |
| `next.json`         | Next.js App Router apps                          |
| `react-native.json` | Expo / React Native apps                         |

Every file turns on `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `useUnknownInCatchVariables`, and
`verbatimModuleSyntax`. Override in your own `compilerOptions` when a
project needs to.

Also available as `legion-toolkit/tsconfig/<file>` from the umbrella
package.

MIT, Copyright (c) 2026 Veracium LLC.
