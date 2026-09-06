import { useState } from 'react';

export const useLanguage = (initial: string) => {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') ?? initial);
  const [width] = useState(window.innerWidth);
  const [online] = useState(navigator.onLine);
  return { lang, setLang, width, online };
};
