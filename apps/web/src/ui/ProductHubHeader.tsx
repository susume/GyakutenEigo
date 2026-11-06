import { Gamepad2, Menu, Mic, UserRound } from "lucide-react";
import { useState } from "react";
import { publicPagePath } from "../seo/publicPages";
import GyakutenEigoBrand from "./GyakutenEigoBrand";
import "./product-hub.css";
import { useSiteTranslation } from "./siteTranslation";
import SiteLanguagePicker from "./SiteLanguagePicker";
import { useHydrated } from "./useHydrated";

type ProductHubHeaderProps = {
  onLogin: () => void;
  onGetStarted: () => void;
  active?: "speaking" | "quiz" | "teacher" | "about";
};

export default function ProductHubHeader({ onLogin, onGetStarted, active }: ProductHubHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hydrated = useHydrated();
  const { language, t } = useSiteTranslation();
  const japanese = language === "ja";

  return (
    <header className="topbar product-hub-topbar" lang={language}>
      <a className="brand-button" href={publicPagePath("/", language)} aria-label={t("GyakutenEigo home")}>
        <GyakutenEigoBrand />
      </a>
      <nav className="primary-nav" aria-label={t("Primary navigation")} onKeyDown={(event) => {
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
          disabled={!hydrated}
          aria-expanded={menuOpen}
          aria-controls="product-hub-actions"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu size={18} aria-hidden="true" />
          {japanese ? "メニュー" : "Menu"}
        </button>
        <div id="product-hub-actions" className="top-actions" data-open={menuOpen ? "true" : "false"}>
          <div className="product-hub-nav-group">
            <a className="product-hub-nav-link" aria-current={active === "speaking" ? "page" : undefined} href={publicPagePath("/speak", language)}>
              <Mic size={18} aria-hidden="true" />
              SpeakCheck
            </a>
            <a className="product-hub-nav-link" aria-current={active === "quiz" ? "page" : undefined} href={publicPagePath("/quiz-strike", language)}>
              <Gamepad2 size={18} aria-hidden="true" />
              QuizStrike
            </a>
            <button className="product-hub-nav-link" aria-current={active === "teacher" ? "page" : undefined} type="button" disabled={!hydrated} onClick={() => { setMenuOpen(false); onLogin(); }}>
              <UserRound size={18} aria-hidden="true" />
              {japanese ? "先生用ツール" : "Teacher tools"}
            </button>
            <a className="product-hub-nav-link" aria-current={active === "about" ? "page" : undefined} href={publicPagePath("/about", language)}>
              {japanese ? "講師紹介" : "About"}
            </a>
          </div>
          <div className="product-hub-auth-group">
            <SiteLanguagePicker />
            <button className="product-hub-login" type="button" disabled={!hydrated} onClick={() => { setMenuOpen(false); onLogin(); }}>{japanese ? "ログイン" : "Log in"}</button>
            <button className="product-hub-get-started" type="button" disabled={!hydrated} onClick={() => { setMenuOpen(false); onGetStarted(); }}>{japanese ? "はじめる" : "Get started"}</button>
          </div>
        </div>
      </nav>
    </header>
  );
}
