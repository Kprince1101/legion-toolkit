# Contributing

Thanks for looking. This repo is small and opinionated; the opinions are
enforced by the build, so most of what you need to know is what `yarn
validate` checks.

## Setup

Node 22 or newer and Yarn 4 through corepack. Other package managers are
refused at install time on purpose (the published packages work under all
of them; the repo itself is Yarn only).

```sh
corepack enable
yarn install
yarn validate
```

`yarn validate` runs, in order: build, typecheck, the `.oxlintrc.json` sync
check, lint (the repo lints itself with its own plugin), Prettier, the
umbrella and metadata checks, and the tests.

## Rules that apply to this repo

The same rules the packages enforce apply here, at the `strict` preset. In
practice: no comments in source (test files included), no ternaries, no
`function` keyword, `const` arrow functions, tests for every new rule or
check, and no third-party runtime dependencies in any published package.

If a rule stops you from doing something reasonable, that is a bug in the
rule; open an issue rather than a bypass.

## Adding a rule

1. `packages/rules/src/rules/<name>.ts`, ESLint rule format, with `meta.docs`
   naming the standard it enforces.
2. Register it in `packages/rules/src/rules/index.ts` and give it a level in
   both presets.
3. `<name>.test.ts` next to it with `RuleTester` cases, valid and invalid.
4. A fixture under `fixtures/` that exercises it; the equivalence test runs
   oxlint and ESLint on the fixtures and fails if they disagree.
5. A row in `packages/rules/README.md`.

## Pull requests

Branch from `main`, keep the change to one concern, and add a changeset:

```sh
yarn changeset
```

Say what changed, why, and what you verified. CI must be green. A maintainer
reviews and merges; nothing lands on `main` without a review.

## Releases

Maintainers merge the changesets release PR. Publishing happens only from
GitHub Actions with npm provenance; local publishes are blocked.
