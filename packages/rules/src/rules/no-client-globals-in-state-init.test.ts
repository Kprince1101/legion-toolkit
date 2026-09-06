import rule from './no-client-globals-in-state-init.js';
import { runRule } from '../test-utils.js';

runRule('no-client-globals-in-state-init', rule, {
  valid: [
    { code: 'const [lang, setLang] = useState(initialLang);' },
    { code: 'const [lang] = useState(() => resolveServerSafeLang(params));' },
    { code: 'const [lang] = useState(props.window);' },
    { code: 'const [config] = useState({ window: 1, navigator: 2 });' },
    {
      code: 'const window = { width: 1 };\nconst [w] = useState(window.width);',
    },
    {
      code: 'useEffect(() => { setLang(localStorage.getItem("lang")); }, []);',
    },
    { code: 'const [w] = React.useState(0);' },
  ],
  invalid: [
    {
      code: 'const [lang] = useState(() => localStorage.getItem("lang"));',
      errors: [{ messageId: 'clientGlobal', data: { name: 'localStorage' } }],
    },
    {
      code: 'const [w] = useState(window.innerWidth);',
      errors: [{ messageId: 'clientGlobal', data: { name: 'window' } }],
    },
    {
      code: 'const [online] = React.useState(navigator.onLine);',
      errors: [{ messageId: 'clientGlobal', data: { name: 'navigator' } }],
    },
    {
      code: 'const [dark] = useState(() => { const m = matchMedia("(prefers-color-scheme: dark)"); return m.matches; });',
      errors: [{ messageId: 'clientGlobal', data: { name: 'matchMedia' } }],
    },
    {
      code: 'const [both] = useState(() => [window.innerWidth, sessionStorage.getItem("a")]);',
      errors: [
        { messageId: 'clientGlobal', data: { name: 'window' } },
        { messageId: 'clientGlobal', data: { name: 'sessionStorage' } },
      ],
    },
  ],
});
