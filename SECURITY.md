# Security

These packages run at development time (lint, audit, config) and have no
runtime dependencies, which keeps the surface small. Two things still matter:
`legion-audit` spawns your repo's own tools (`tsc`, `oxlint`/`eslint`, the
test script, `prettier`, `git`, the package manager's audit) with your repo
as the working directory, and the lint plugin executes inside your linter.
Neither reads or sends anything off the machine.

## Reporting

Email kristopher.prince@gmail.com with the package name, version, and steps to
reproduce. You will get a reply within 5 business days. Please do not open a
public issue for a vulnerability until a fix is published.

## Supported versions

The latest minor of each package. Security fixes are released as patches on
that line.

## Provenance

Every published version is built and published by this repo's release
workflow on GitHub Actions with npm provenance. `npm view <package>` shows the
attestation, and a package without one did not come from here.
