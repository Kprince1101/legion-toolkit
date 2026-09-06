export interface Lesson {
  why: string;
  fix: string[];
}

export const RULE_LESSONS: Record<string, Lesson> = {
  'legion/no-function-keyword': {
    why: 'A default export written as `export default function App` loses its name in React DevTools and in stack traces, so a crash report points at Anonymous. Arrow consts also hoist the way you expect instead of silently working before their definition.',
    fix: ['const App = () => { ... };', 'export default App;'],
  },
  'legion/presentational-components': {
    why: 'A component that holds state, effects or a handler body cannot be rendered in a test without also standing up everything it fetches. Moving the logic into use<Component> gives you a plain function to unit test and a component that is only markup.',
    fix: [
      'create lib/hooks/use<Component>.ts',
      'move the state, effects and handlers into it',
      'return a flat object of values and handleX functions',
      'the component becomes: call the hook, early return, render children',
    ],
  },
  'legion/no-literal-conditions-in-jsx': {
    why: 'A comparison in the markup is a business rule hidden where nobody greps for it. When the rule changes you have to find every JSX file that encoded it, and you will miss one.',
    fix: [
      'derive the flag in the hook: const showBanner = status === "expired";',
      'render with the flag: {showBanner && <Banner />}',
    ],
  },
  'legion/no-narrative-comments': {
    why: 'Comments drift. The code changes, the comment does not, and now the file actively lies to the next reader. Names and small functions cannot drift because they are the thing being executed.',
    fix: [
      'delete the comment',
      'if it explained what, rename until the name says it',
      'if it explained why, that belongs in the PR description',
    ],
  },
  'legion/no-react-fc': {
    why: 'React.FC adds an implicit children prop to components that do not take children, and it gets in the way of generics. A plain typed props parameter says exactly what the component accepts.',
    fix: ['const Card = ({ title }: CardProps) => { ... }'],
  },
  'legion/no-enum': {
    why: 'A TypeScript enum emits a runtime object, so it survives into the bundle and is not erasable. A string-literal union is compile-time only and narrows better.',
    fix: ["type Status = 'idle' | 'loading' | 'done';"],
  },
  'legion/guarded-context-hook': {
    why: 'A raw useContext returns undefined outside its provider, so the failure surfaces later as a property access on undefined, somewhere unrelated. A guarded hook fails at the call site with the provider name in the message.',
    fix: [
      'export const useAppContext = () => {',
      '  const ctx = useContext(AppContext);',
      '  if (!ctx) throw new Error("useAppContext must be used within AppProvider");',
      '  return ctx;',
      '};',
    ],
  },
  'legion/no-client-globals-in-state-init': {
    why: 'The server has no localStorage, so it renders one value and the browser hydrates with another. React throws away the server markup and you get a flash of the wrong content.',
    fix: [
      'initialize from a prop or a URL value',
      'read the client-only preference in a useEffect and reconcile',
    ],
  },
  'legion/no-use-client-in-page': {
    why: 'A "use client" page ships the whole route to the browser and gives up server-side data fetching for it. The point of the app router is that the page fetches and only the interactive leaf is client.',
    fix: [
      'keep page.tsx a server component that fetches',
      'move the interactivity into <Route>Client.tsx with the directive',
      'pass the fetched data down as props',
    ],
  },
  'legion/no-admin-client-in-browser': {
    why: 'The service-role key bypasses row level security. Anything that reaches the browser or a device bundle can be read out of it, and then the key is not a secret any more.',
    fix: [
      'use the browser or server client here',
      'keep admin queries behind a route handler or a server component',
    ],
  },
  'legion/scoped-disables': {
    why: 'A file-wide disable turns the rule off for every line in the file, including the code nobody has written yet. A scoped disable with a reason turns it off for exactly the line that needed it and tells the next reader why.',
    fix: ['eslint-disable-next-line <rule> -- <the reason>'],
  },
  'legion/no-manual-memo': {
    why: 'Under the React Compiler the memoization is automatic, so a hand-written useMemo is a dependency array to keep correct for no gain. A wrong dep array is a real bug; no dep array cannot be.',
    fix: ['drop the useMemo and write the value directly'],
  },
  'no-ternary': {
    why: 'Nested ternaries are where render logic goes to hide. A named flag reads as the rule it encodes, and a two-way branch is usually a child component or a Record lookup.',
    fix: [
      'default: value ?? fallback',
      'render branch: {isReady && <Ready />} or an early return',
      'two-way: a child component, or a Record keyed by the value',
    ],
  },
  'max-lines': {
    why: 'The cap is a symptom check, not the rule. A component over 180 lines has almost always absorbed logic that belongs in a hook, and the length is just how you noticed.',
    fix: [
      'move state, effects and handlers into use<Component>',
      'extract each section of the markup into its own child component',
    ],
  },
};
