# How we write code here

These are the house rules for this repo. Follow them in every file you
write or change.

## Components render, they do not think

A React component calls its hooks, returns early for loading or empty
states, and returns JSX. That is all. State, effects, data fetching, event
handlers with a body, calculations and `.map` projections of data all live in
a hook named after the component (`StatsPanel` gets `useStatsPanel`) or in a
plain function under `lib/`. This applies to small components too.

A component file stays under 180 lines. If it is getting close, logic has
leaked into it: move the logic into its hook instead of splitting the file to
fit.

Never put a business condition inline in JSX, such as
`{habit.name === 'Read' && ...}`. Work it out in the hook and return a named
flag, then branch on the flag.

## Next.js

- A `page.tsx` or `layout.tsx` is a server component. It fetches and hands
  props to one client child. It is never `'use client'` itself.
- Never read `window`, `document`, `localStorage`, `sessionStorage` or
  `navigator` inside a `useState` initializer in anything that server-renders.
  Start from a server-safe value and correct it in `useEffect`.
- Context is only ever read through a `use*` hook that throws when the
  provider is missing. No bare `useContext` anywhere else.
- The service-role (admin) database client never reaches browser code: not
  in a `'use client'` file, a component or a hook.

## TypeScript

- No `React.FC`. Write `export const Name = (props: NameProps) => ...` with
  an `interface NameProps`.
- No `enum`. Use a string-literal union, and a `Record` when values need
  mapping.
- No `function` keyword. Components, hooks, handlers and helpers are all
  `const` arrow functions.
- No ternaries, anywhere. Use `??` for defaults, `&&` on a named flag or an
  early return for a render branch, and a `Record` lookup or a child
  component for a two-way choice.
- No explicit `any`.

## Comments

None. The only comments allowed are tool directives: lint and type
suppressions and test-runner pragmas. Name things well enough that the code
does not need explaining.

## Markup

- Every `<button>` declares its `type`.
- `target="_blank"` always comes with `rel="noopener noreferrer"`.
- Something that runs a handler and goes nowhere is a `<button>`, not an
  `<a href="#">`.
- Every image has `alt` text, or `alt=""` when it is decorative.
- No `dangerouslySetInnerHTML`.
- A list `key` identifies the item, never the array index.
- Colors come from design tokens, never a hex literal in a component.

## Bypassing a rule

If a rule genuinely has to be broken on one line, say so on that line:
`eslint-disable-next-line <rule> -- <reason>`. Never disable a whole file,
never leave the rule unnamed, never leave out the reason.
