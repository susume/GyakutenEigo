import { useCallback } from "react";
import { useSiteLanguage } from "./SiteLanguageProvider";
import type { SiteLanguage } from "./siteLanguage";
import japaneseMessages from "./locales/ja.json";

type Values = Record<string, string | number | undefined | null>;
const messages: Readonly<Record<string, string>> = japaneseMessages;
const normalizedMessages = new Map(Object.entries(messages).map(([key, value]) => [key.trim().toLowerCase(), value]));
const templateMessages = Object.entries(messages).flatMap(([source, translation]) => {
  const tokens = [...source.matchAll(/\{(\w+)\}/gu)];
  // Support messages assembled by shared validation/status helpers. Numeric
  // formats and generic value-only templates must never match arbitrary content.
  if (!tokens.length || source.replace(/\{\w+\}/gu, "").replace(/[^a-z]/giu, "").length < 8) return [];
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  let pattern = "";
  let end = 0;
  for (const token of tokens) {
    pattern += escape(source.slice(end, token.index)) + "(.*?)";
    end = token.index! + token[0].length;
  }
  pattern += escape(source.slice(end));
  return [{ pattern: new RegExp(`^${pattern}$`, "iu"), keys: tokens.map((token) => token[1]!), translation }];
});

// Translate only interface copy. Stored tasks, questions and user input remain untouched.
export function translateSiteText(language: SiteLanguage, text: string | undefined | null, values: Values = {}): string {
  const source = text ?? "";
  let translated = language === "ja" ? messages[source] ?? normalizedMessages.get(source.trim().toLowerCase()) : source;
  let substitutions = values;
  if (language === "ja" && translated === undefined) {
    for (const template of templateMessages) {
      const match = template.pattern.exec(source);
      if (!match) continue;
      translated = template.translation;
      substitutions = { ...Object.fromEntries(template.keys.map((key, index) => [key, match[index + 1]])), ...values };
      break;
    }
  }
  translated ??= source;
  return translated.replace(/\{(\w+)\}/gu, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(substitutions, key) ? String(substitutions[key] ?? "") : placeholder);
}

export function useSiteTranslation() {
  const { language } = useSiteLanguage();
  const t = useCallback((text: string | undefined | null, values?: Values) => translateSiteText(language, text, values), [language]);
  return { language, locale: language === "ja" ? "ja-JP" : "en-GB", t };
}

export function SiteText({ text }: { text: string }) {
  const { t } = useSiteTranslation();
  return <>{t(text)}</>;
}
