import { Gamepad2, Globe2, Menu, Mic, UserRound } from "lucide-react";
import { useState } from "react";
import GyakutenEigoBrand from "./GyakutenEigoBrand";
import "./product-hub.css";
import { useSiteLanguage } from "./SiteLanguageProvider";

type ProductHubHeaderProps = {
  onNavigate: (path: string) => void;
  onLogin: () => void;
  onGetStarted: () => void;
  active?: "speaking" | "quiz" | "teacher" | "about";
};

export default function ProductHubHeader({ onNavigate, onLogin, onGetStarted, active }: ProductHubHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, setLanguage } = useSiteLanguage();
  const japanese = language === "ja";

  const go = (path: string) => {
    setMenuOpen(false);
    onNavigate(path);
  };

  return (
    <header className="topbar product-hub-topbar" lang={language}>
      <button className="brand-button" type="button" aria-label="GyakutenEigo home" onClick={() => go("/")}>
        <GyakutenEigoBrand />
      </button>
      <nav className="primary-nav" aria-label="Primary" onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          event.currentTarget.querySelector<HTMLButtonElement>(".nav-menu-toggle")?.focus();
        }
      }} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
      }}>
        <button
          className="nav-menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="product-hub-actions"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu size={18} aria-hidden="true" />
          {japanese ? "メニュー" : "Menu"}
        </button>
        <div id="product-hub-actions" className="top-actions" data-open={menuOpen ? "true" : "false"}>
          <div className="product-hub-nav-group">
            <button className="product-hub-nav-link" aria-current={active === "speaking" ? "page" : undefined} type="button" onClick={() => go("/speak")}>
              <Mic size={18} aria-hidden="true" />
              SpeakCheck
            </button>
            <button className="product-hub-nav-link" aria-current={active === "quiz" ? "page" : undefined} type="button" onClick={() => go("/quiz-strike")}>
              <Gamepad2 size={18} aria-hidden="true" />
              QuizStrike
            </button>
            <button className="product-hub-nav-link" aria-current={active === "teacher" ? "page" : undefined} type="button" onClick={() => { setMenuOpen(false); onLogin(); }}>
              <UserRound size={18} aria-hidden="true" />
              {japanese ? "先生用ツール" : "Teacher tools"}
            </button>
            <button className="product-hub-nav-link" aria-current={active === "about" ? "page" : undefined} type="button" onClick={() => go("/about")}>
              {japanese ? "講師紹介" : "About"}
            </button>
          </div>
          <div className="product-hub-auth-group">
            <label className="ge-language-picker">
              <Globe2 size={16} aria-hidden="true" />
              <select aria-label="Language / 言語" value={language} onChange={(event) => setLanguage(event.target.value === "ja" ? "ja" : "en")}>
                <option value="en">English</option><option value="ja">日本語</option>
              </select>
            </label>
            <button className="product-hub-login" type="button" onClick={() => { setMenuOpen(false); onLogin(); }}>{japanese ? "ログイン" : "Log in"}</button>
            <button className="product-hub-get-started" type="button" onClick={() => { setMenuOpen(false); onGetStarted(); }}>{japanese ? "はじめる" : "Get started"}</button>
          </div>
        </div>
      </nav>
    </header>
  );
}
