export type SiteLanguage = "en" | "ja";

export const SITE_LANGUAGE_KEY = "gyakuteneigo.language";

export function resolveSiteLanguage(saved: string | null, browserLanguages: readonly string[]): SiteLanguage {
  if (saved === "en" || saved === "ja") return saved;
  // Use the visitor's first supported language, then fall back to English.
  for (const locale of browserLanguages) {
    const code = locale.toLowerCase().split(/[-_]/u)[0];
    if (code === "en" || code === "ja") return code;
  }
  return "en";
}
