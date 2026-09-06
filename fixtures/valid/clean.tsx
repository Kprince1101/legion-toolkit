import { createContext, useContext, useEffect, useState } from 'react';

interface MenuPanelProps {
  slug: string;
}

interface AppContextValue {
  user: string;
}

type LeadStatus = 'unclaimed' | 'claimed' | 'won' | 'lost';

const LEAD_LABELS: Record<LeadStatus, string> = {
  unclaimed: 'Unclaimed',
  claimed: 'Claimed',
  won: 'Won',
  lost: 'Lost',
};

const AppContext = createContext<AppContextValue | null>(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};

export const useMenuPanel = (slug: string, initialLang: string) => {
  const [lang, setLang] = useState(initialLang);
  useEffect(() => {
    const preferred = localStorage.getItem(`lang:${slug}`);
    if (preferred) setLang(preferred);
  }, [slug]);
  const label = LEAD_LABELS.claimed;
  return { lang, label, handleLangChange: setLang };
};

export const MenuPanel = ({ slug }: MenuPanelProps) => {
  const { lang, label } = useMenuPanel(slug, 'en');
  const { user } = useAppContext();
  return (
    <section>
      <span>{lang}</span>
      <span>{label}</span>
      <span>{user}</span>
    </section>
  );
};

export const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return 'Unknown error';
};

export const isReady = (value: string | undefined) => value ?? 'pending';
