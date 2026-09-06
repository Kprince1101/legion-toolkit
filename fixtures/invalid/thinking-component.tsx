import { useEffect, useMemo, useState } from 'react';

interface PanelProps {
  sections: Array<{ id: string; title: string; active: boolean }>;
  onSave: () => void;
}

export const Panel = ({ sections, onSave }: PanelProps) => {
  const [open, setOpen] = useState(false);
  const total = useMemo(() => sections.length, [sections]);
  useEffect(() => {
    document.title = `${total}`;
  }, [total]);
  const handleSave = () => {
    setOpen(false);
    onSave();
  };
  return (
    <section>
      <Nav items={sections.map((s) => ({ key: s.id, name: s.title }))} />
      <ul>
        {sections
          .filter((s) => s.active)
          .map((s) => (
            <li key={s.id}>{s.title}</li>
          ))}
      </ul>
      <button onClick={handleSave}>{open}</button>
    </section>
  );
};
