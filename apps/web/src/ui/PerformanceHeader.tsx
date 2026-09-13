import { Menu, ScanLine, Sparkles, UserRound } from "lucide-react";
import { useState } from "react";
import GyakutenEigoBrand from "./GyakutenEigoBrand";
import "./performance-header.css";

type PerformanceHeaderProps = {
  onNavigate: (path: string) => void;
};

export default function PerformanceHeader({ onNavigate }: PerformanceHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (path: string) => {
    setMenuOpen(false);
    onNavigate(path);
  };

  return (
    <header className="topbar performance-topbar performance-route-header">
      <button className="brand-button" type="button" aria-label="GyakutenEigo Speaking Performance home" onClick={() => go("/speak")}>
        <GyakutenEigoBrand />
      </button>
      <nav className="primary-nav" aria-label="Speaking Performance navigation" onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          event.currentTarget.querySelector<HTMLButtonElement>(".nav-menu-toggle")?.focus();
        }
      }} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
      }}>
        <button className="nav-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="performance-actions" onClick={() => setMenuOpen((open) => !open)}>
          <Menu size={18} aria-hidden="true" />
          Menu
        </button>
        <div id="performance-actions" className="top-actions" data-open={menuOpen ? "true" : "false"}>
          <button className="performance-nav-link is-active" type="button" onClick={() => go("/speak")}>
            <Sparkles size={19} aria-hidden="true" />
            Practice
          </button>
          <button className="performance-nav-link" type="button" onClick={() => go("/speak/join")}>
            <ScanLine size={19} aria-hidden="true" />
            Join activity
          </button>
          <button className="performance-nav-link" type="button" onClick={() => go("/speak/teacher")}>
            <UserRound size={19} aria-hidden="true" />
            Teacher tools
          </button>
        </div>
      </nav>
    </header>
  );
}
