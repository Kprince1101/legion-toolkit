import { createContext, useContext } from 'react';

interface AppContextValue {
  user: string;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useAppContext = () => useContext(AppContext);

export const Header = () => {
  const ctx = useContext(AppContext);
  return <header>{ctx?.user}</header>;
};

export const topLevel = useContext(AppContext);
