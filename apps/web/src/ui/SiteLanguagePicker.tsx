import { Globe2 } from "lucide-react";
import { useSiteLanguage } from "./SiteLanguageProvider";

export default function SiteLanguagePicker() {
  const { language, setLanguage } = useSiteLanguage();
  return <label className="ge-language-picker">
    <Globe2 size={16} aria-hidden="true" />
    <select aria-label="Language / 言語" value={language} onChange={(event) => setLanguage(event.target.value === "ja" ? "ja" : "en")}>
      <option value="en">English</option><option value="ja">日本語</option>
    </select>
  </label>;
}
