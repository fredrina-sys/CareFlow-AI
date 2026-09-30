import { createContext, useContext, useState, ReactNode } from "react";
import en from "./en.json";
import kn from "./kn.json";
// Add a language: create xx.json with the same keys and register it here.
export const LANGS: Record<string, { label: string; dict: Record<string, string> }> = {
  en: { label: "English", dict: en }, kn: { label: "ಕನ್ನಡ", dict: kn },
};
const Ctx = createContext<{ lang: string; setLang: (l: string) => void; t: (k: string) => string }>(null as any);
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setL] = useState(localStorage.getItem("cf_lang") || "en");
  const setLang = (l: string) => { setL(l); localStorage.setItem("cf_lang", l); document.documentElement.lang = l; };
  const t = (k: string) => LANGS[lang]?.dict[k] ?? (en as Record<string, string>)[k] ?? k;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
