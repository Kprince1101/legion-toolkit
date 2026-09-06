---
'eslint-plugin-legion': minor
'legion-rules': minor
'legion-audit': minor
'legion-toolkit': minor
---

Ten new rules, a platform split, and the React Compiler flag actually working.

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
