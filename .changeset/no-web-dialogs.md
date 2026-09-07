---
'eslint-plugin-legion': minor
'legion-rules': minor
'legion-toolkit': minor
---

New `no-web-dialogs` rule, closing the last LEGION-STANDARDS §3 mandate with
no mechanical check behind it.

§3 asks for `Alert.alert` on user-facing errors and confirmations. Only half
of that is checkable. A linter cannot tell whether an error reached the user:
a catch that logs and rethrows, or sets state for an error banner, is
correct, and flagging it would be the kind of noisy rule that teaches people
to ignore the linter.

What is checkable is the other direction, and it is worth more than it looks.
`confirm()` and `prompt()` do not exist in React Native at all, so either one
is a runtime crash the moment the line runs rather than a style problem, and
`alert()` is a per-platform shim that is absent on web. The rule flags all
three, plus their `window.` and `globalThis.` forms, and leaves a locally
declared binding of the same name alone.

React Native only, off everywhere else, and introduced at warn like every
other new rule.
