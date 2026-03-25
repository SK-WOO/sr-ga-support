import { createContext, useContext, useState } from "react";
import ko from "./ko.json";
import en from "./en.json";

const messages = { ko, en };

const I18nContext = createContext<{ t: (k: string, vars?: Record<string,any>) => string; lang: string; setLang: (l: string) => void }>({ t: (k) => k, lang: "ko", setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("sr_lang") || "ko");

  const t = (key, vars = {}) => {
    const msg = (messages[lang] || messages.ko)[key] || key;
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{{${k}}}`, v), msg);
  };

  const changeLang = (l) => {
    localStorage.setItem("sr_lang", l);
    setLang(l);
  };

  return (
    <I18nContext.Provider value={{ t, lang, setLang: changeLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
