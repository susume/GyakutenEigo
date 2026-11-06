import { StrictMode } from "react";
import BrowserApp from "./BrowserApp";
import { SiteLanguageProvider } from "./ui/SiteLanguageProvider";
import type { SiteLanguage } from "./ui/siteLanguage";

export default function SiteApp({ initialPath, initialLanguage }: { initialPath?: string; initialLanguage?: SiteLanguage }) {
  return (
    <StrictMode>
      <SiteLanguageProvider initialLanguage={initialLanguage}>
        <div className="ge-site"><BrowserApp initialPath={initialPath} /></div>
      </SiteLanguageProvider>
    </StrictMode>
  );
}
