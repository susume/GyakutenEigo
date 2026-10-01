import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { resolveSiteLanguage, SITE_LANGUAGE_KEY, type SiteLanguage } from "./siteLanguage";

const SiteLanguageContext = createContext<{
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
} | null>(null);

function readLanguage(): SiteLanguage {
  let saved: string | null = null;
  try { saved = localStorage.getItem(SITE_LANGUAGE_KEY); } catch { /* Session selection still works when storage is unavailable. */ }
  return resolveSiteLanguage(saved, navigator.languages.length ? navigator.languages : [navigator.language]);
}

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<SiteLanguage>(readLanguage);

  const setLanguage = (next: SiteLanguage) => {
    updateLanguage(next);
    try { localStorage.setItem(SITE_LANGUAGE_KEY, next); } catch { /* Keep the current selection in memory. */ }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === SITE_LANGUAGE_KEY || event.key === null) updateLanguage(readLanguage());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return <SiteLanguageContext.Provider value={{ language, setLanguage }}>{children}</SiteLanguageContext.Provider>;
}

export function useSiteLanguage() {
  const context = useContext(SiteLanguageContext);
  if (!context) throw new Error("Site language requires SiteLanguageProvider.");
  return context;
}
