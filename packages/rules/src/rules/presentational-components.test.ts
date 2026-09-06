import rule from './presentational-components.js';
import { runRule } from '../test-utils.js';

runRule('presentational-components', rule, {
  valid: [
    {
      code: [
        'export const MenuPanel = ({ slug }: MenuPanelProps) => {',
        '  const { sections, activeId, handleSelect, isLoading } = useMenuPanel(slug);',
        '  if (isLoading) return <Spinner />;',
        '  return (',
        '    <section>',
        '      <MenuNav sections={sections} activeId={activeId} onSelect={handleSelect} />',
        '      {sections.map((section) => <MenuItem key={section.id} item={section} />)}',
        '    </section>',
        '  );',
        '};',
      ].join('\n'),
    },
    {
      code: 'export const Row = ({ id, onSelect }: RowProps) => <tr onClick={() => onSelect(id)}>{id}</tr>;',
    },
    {
      code: 'export const useMenuPanel = (slug: string) => { const [state, setState] = useState(0); useEffect(() => { setState(1); }, [slug]); return { state }; };',
    },
    {
      code: 'const Page = async () => { const data = await getData(); return <RouteClient data={data} />; };\nexport default Page;',
    },
    {
      code: 'export const Badge = () => { const [open, setOpen] = useState(false); return <span>{open}</span>; };',
      options: [{ allowState: true }],
    },
    {
      code: 'export const Toggle = ({ onToggle }: ToggleProps) => { const handleClick = () => { onToggle(); }; return <button onClick={handleClick} />; };',
    },
  ],
  invalid: [
    {
      code: 'export const Panel = () => { useEffect(() => { document.title = "x"; }, []); return <div />; };',
      errors: [
        {
          messageId: 'effect',
          data: { hook: 'useEffect', component: 'Panel' },
        },
      ],
    },
    {
      code: 'export const Panel = () => { const [open, setOpen] = useState(false); return <div>{open}</div>; };',
      errors: [
        { messageId: 'state', data: { hook: 'useState', component: 'Panel' } },
      ],
    },
    {
      code: 'export const Panel = ({ items }: PanelProps) => { const total = useMemo(() => items.length, [items]); return <div>{total}</div>; };',
      errors: [
        {
          messageId: 'derivation',
          data: { hook: 'useMemo', component: 'Panel' },
        },
      ],
    },
    {
      code: 'export const Panel = () => { const load = async () => { const res = await fetch("/api"); return res.json(); }; return <button onClick={load} />; };',
      errors: [{ messageId: 'handlerBody' }, { messageId: 'fetching' }],
    },
    {
      code: 'export const Panel = ({ onSave }: PanelProps) => { const handleSave = () => { setSaving(true); onSave(); }; return <button onClick={handleSave} />; };',
      errors: [
        {
          messageId: 'handlerBody',
          data: { handler: 'handleSave', component: 'Panel' },
        },
      ],
    },
    {
      code: 'export const Panel = ({ sections }: PanelProps) => <Nav items={sections.map((s) => ({ key: s.id, name: s.title }))} />;',
      errors: [
        {
          messageId: 'projection',
          data: { method: 'map', component: 'Panel' },
        },
      ],
    },
    {
      code: 'export const Panel = ({ items }: PanelProps) => <ul>{items.filter((i) => i.active).map((i) => <li key={i.id} />)}</ul>;',
      errors: [
        {
          messageId: 'projection',
          data: { method: 'filter', component: 'Panel' },
        },
      ],
    },
    {
      code: 'function Panel() { const [n] = useState(0); return <div>{n}</div>; }',
      errors: [{ messageId: 'state' }],
    },
  ],
});
