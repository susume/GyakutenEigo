import { Gamepad2, Menu, Mic, UserRound } from "lucide-react";
import { useState } from "react";
import GyakutenEigoBrand from "./GyakutenEigoBrand";

type ProductHubHeaderProps = {
  onNavigate: (path: string) => void;
  onLogin: () => void;
  onGetStarted: () => void;
};

export default function ProductHubHeader({ onNavigate, onLogin, onGetStarted }: ProductHubHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (path: string) => {
    setMenuOpen(false);
    onNavigate(path);
  };

  return (
    <header className="topbar product-hub-topbar">
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
          Menu
        </button>
        <div id="product-hub-actions" className="top-actions" data-open={menuOpen ? "true" : "false"}>
          <div className="product-hub-nav-group">
            <button className="product-hub-nav-link" type="button" onClick={() => go("/speak")}>
              <Mic size={18} aria-hidden="true" />
              SpeakCheck App
            </button>
            <button className="product-hub-nav-link" type="button" onClick={() => go("/quiz-strike")}>
              <Gamepad2 size={18} aria-hidden="true" />
              QuizStrike
            </button>
            <button className="product-hub-nav-link" type="button" onClick={onLogin}>
              <UserRound size={18} aria-hidden="true" />
              Teacher tools
            </button>
          </div>
          <div className="product-hub-auth-group">
            <button className="product-hub-login" type="button" onClick={onLogin}>Log in</button>
            <button className="product-hub-get-started" type="button" onClick={onGetStarted}>Get started</button>
          </div>
        </div>
      </nav>
    </header>
  );
}
