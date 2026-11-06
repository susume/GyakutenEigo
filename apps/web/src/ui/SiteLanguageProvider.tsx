import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getPublicPage, publicPagePath } from "../seo/publicPages";
import { resolveSiteLanguage, SITE_LANGUAGE_KEY, type SiteLanguage } from "./siteLanguage";

const SiteLanguageContext = createContext<{
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
} | null>(null);

function readLanguage(): SiteLanguage {
  const page = getPublicPage(window.location.pathname);
  if (page) return page.language;
  let saved: string | null = null;
  try { saved = localStorage.getItem(SITE_LANGUAGE_KEY); } catch { /* Session selection still works when storage is unavailable. */ }
  return resolveSiteLanguage(saved, navigator.languages.length ? navigator.languages : [navigator.language]);
}

export function SiteLanguageProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: SiteLanguage }) {
  const [language, updateLanguage] = useState<SiteLanguage>(() => initialLanguage ?? readLanguage());

  const setLanguage = (next: SiteLanguage) => {
    try { localStorage.setItem(SITE_LANGUAGE_KEY, next); } catch { /* Keep the current selection in memory. */ }
    const page = getPublicPage(window.location.pathname);
    if (page && page.language !== next) {
      window.location.assign(`${publicPagePath(page.route, next)}${window.location.search}${window.location.hash}`);
      return;
    }
    updateLanguage(next);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === SITE_LANGUAGE_KEY || event.key === null) updateLanguage(readLanguage());
    };
    const syncRoute = () => {
      const page = getPublicPage(window.location.pathname);
      if (page) updateLanguage(page.language);
    };
    window.addEventListener("storage", sync);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  return <SiteLanguageContext.Provider value={{ language, setLanguage }}>{children}</SiteLanguageContext.Provider>;
}

export function useSiteLanguage() {
  const context = useContext(SiteLanguageContext);
  if (!context) throw new Error("Site language requires SiteLanguageProvider.");
  return context;
}
