import rule from './guarded-context-hook.js';
import { runRule } from '../test-utils.js';

runRule('guarded-context-hook', rule, {
  valid: [
    {
      code: 'export const useAppContext = () => { const ctx = useContext(AppContext); if (!ctx) throw new Error("useAppContext must be used within AppProvider"); return ctx; };',
    },
    {
      code: 'export const useTheme = () => { const value = React.useContext(ThemeContext); if (value === null) { throw new Error("no provider"); } return value; };',
    },
    {
      code: 'export const Header = () => { const { user } = useAppContext(); return <header>{user}</header>; };',
    },
  ],
  invalid: [
    {
      code: 'export const useAppContext = () => useContext(AppContext);',
      errors: [{ messageId: 'noGuard', data: { name: 'useAppContext' } }],
    },
    {
      code: 'export const useAppContext = () => { const ctx = useContext(AppContext); return ctx; };',
      errors: [{ messageId: 'noGuard', data: { name: 'useAppContext' } }],
    },
    {
      code: 'export const Header = () => { const ctx = useContext(AppContext); return <header>{ctx?.user}</header>; };',
      errors: [{ messageId: 'notAHook', data: { name: 'Header' } }],
    },
    {
      code: 'export const value = useContext(AppContext);',
      errors: [{ messageId: 'outsideHook' }],
    },
    {
      code: 'export const useApp = () => { const read = () => { throw new Error("x"); }; return useContext(AppContext); };',
      errors: [{ messageId: 'noGuard', data: { name: 'useApp' } }],
    },
  ],
});
