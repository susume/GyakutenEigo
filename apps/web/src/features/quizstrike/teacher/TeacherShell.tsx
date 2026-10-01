import { useSiteTranslation } from "../../../ui/siteTranslation";
import {
  BookOpen,
  ChevronLeft,
  Globe2,
  Mic,
  Menu,
  X,
  BarChart3,
  Plus,
  Settings,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { GameSession, TeacherUser } from "@quizstrike/shared";
import { useId, useRef, useState, type ReactNode } from "react";
import "./teacher-navigation.css";
import type {
  TeacherPrimaryTab,
  TeacherSetupSection,
  TeacherTab,
} from "./teacherRoutes";
import GyakutenEigoBrand from "../../../ui/GyakutenEigoBrand";
import SiteLanguagePicker from "../../../ui/SiteLanguagePicker";

type TeacherShellProps = {
  teacher: TeacherUser;
  tab: TeacherTab;
  isLiveSetup: boolean;
  activeSetupSection: TeacherSetupSection;
  onSetupSectionChange: (section: TeacherSetupSection) => void;
  onNavigateTab: (tab: TeacherPrimaryTab) => void;
  onCreateStudySet: () => void;
  onCreateSpeakingActivity: () => void;
  onLogout: () => void;
  activeSessions: GameSession[];
  selectedSessionId?: string;
  onOpenSession: (session: GameSession) => void;
  children: ReactNode;
};

const contentTab = (tab: TeacherTab): TeacherPrimaryTab => {
  if (tab === "detail" || tab === "quizzes") return "library";
  if (tab === "sessions") return "library";
  return tab;
};

export default function TeacherShell({
  teacher,
  tab,
  isLiveSetup,
  activeSetupSection,
  onSetupSectionChange,
  onNavigateTab,
  onCreateStudySet,
  onCreateSpeakingActivity,
  onLogout,
  activeSessions,
  selectedSessionId,
  onOpenSession,
  children,
}: TeacherShellProps) {
  const { t } = useSiteTranslation();
  const activeTab = contentTab(tab);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const sectionLabels: Record<TeacherPrimaryTab, string> = {
    home: "Home", discover: "Discover", library: "Library", reports: "Reports",
    speaking: "SpeakCheck · Speaking Tasks", tournaments: "Competitions", settings: "Settings"
  };

  return (
    <section className="workspace" aria-label={t("GyakutenEigo teacher dashboard")} onKeyDown={(event) => {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }}>
      <header className="dashboard-brand-row">
        <h1>
          <GyakutenEigoBrand className="dashboard-brand-logo" />
          <small>{t("Teacher dashboard")}</small>
        </h1>
        <div className="dashboard-account-area">
          <SiteLanguagePicker />
          <span className="dashboard-product-pair">{t("QuizStrike + SpeakCheck")}</span>
          <strong>{teacher.name}</strong>
          <button type="button" onClick={onLogout}>{t("Sign Out")}</button>
        </div>
      </header>

      <div className="teacher-mobile-navigation">
        <span>{isLiveSetup ? t("Game setup") : t(sectionLabels[activeTab])}</span>
        <button ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          {menuOpen ? t("Close") : t("Sections")}
        </button>
      </div>

      <aside
        id={menuId}
        data-open={menuOpen}
        className={`sidebar teacher-navigation-sidebar${isLiveSetup ? " setup-sidebar" : ""}`}
        onClickCapture={(event) => {
          if (menuOpen && (event.target as HTMLElement).closest("button")) {
            setMenuOpen(false);
            window.requestAnimationFrame(() => content.current?.focus());
          }
        }}
        aria-label={
          isLiveSetup ? t("Live game setup sections") : t("Teacher sections")
        }
      >
        {isLiveSetup ? (
          <div className="setup-sidebar-menu">
            <span className="setup-sidebar-kicker">{t("Host this Study Set")}</span>
            <button
              type="button"
              className={activeSetupSection === "mode" ? "active" : ""}
              aria-current={activeSetupSection === "mode" ? "step" : undefined}
              onClick={() => onSetupSectionChange("mode")}
            >
              <strong>{t("Game Mode")}</strong>
            </button>
            <button
              type="button"
              className={activeSetupSection === "arena" ? "active" : ""}
              aria-current={activeSetupSection === "arena" ? "step" : undefined}
              onClick={() => onSetupSectionChange("arena")}
            >
              <strong>{t("Arena")}</strong>
            </button>
            <button
              type="button"
              className={activeSetupSection === "advanced" ? "active" : ""}
              aria-current={
                activeSetupSection === "advanced" ? "step" : undefined
              }
              onClick={() => onSetupSectionChange("advanced")}
            >
              <Settings size={17} aria-hidden="true" />
              <strong>{t("Advanced")}</strong>
            </button>
            <button
              type="button"
              className="setup-sidebar-back"
              onClick={() => onNavigateTab("library")}
            >
              <ChevronLeft size={17} aria-hidden="true" />{t("Back to Library")}</button>
          </div>
        ) : (
          <nav className="teacher-sidebar-nav" aria-label={t("Teacher navigation")}>
            <span className="sidebar-section-label">{t("Workspace")}</span>
            <button
              type="button"
              aria-current={activeTab === "home" ? "page" : undefined}
              className={activeTab === "home" ? "active" : ""}
              onClick={() => onNavigateTab("home")}
            >
              <BookOpen size={17} aria-hidden="true" />{t("Home")}</button>
            <span className="sidebar-divider" />
            <span className="sidebar-section-label">QuizStrike</span>
            <button
              type="button"
              aria-current={activeTab === "discover" ? "page" : undefined}
              className={activeTab === "discover" ? "active" : ""}
              onClick={() => onNavigateTab("discover")}
            >
              <Globe2 size={17} aria-hidden="true" />{t("Discover")}</button>
            <button
              type="button"
              aria-current={activeTab === "library" ? "page" : undefined}
              className={activeTab === "library" ? "active" : ""}
              onClick={() => onNavigateTab("library")}
            >
              <Sparkles size={17} aria-hidden="true" />{t("Library")}</button>
            <button
              type="button"
              aria-current={activeTab === "reports" ? "page" : undefined}
              className={activeTab === "reports" ? "active" : ""}
              onClick={() => onNavigateTab("reports")}
            >
              <BarChart3 size={17} aria-hidden="true" />{t("Reports")}</button>
            <button
              type="button"
              className="sidebar-create-button"
              aria-label={t("Create Study Set")}
              onClick={onCreateStudySet}
            >
              <Plus size={17} aria-hidden="true" />{t("Create")}</button>

            <span className="sidebar-divider" />
            <span className="sidebar-section-label">SpeakCheck</span>
            <button
              type="button"
              aria-current={activeTab === "speaking" ? "page" : undefined}
              className={activeTab === "speaking" ? "active" : ""}
              onClick={() => onNavigateTab("speaking")}
            >
              <Mic size={17} aria-hidden="true" />{t("Speaking Tasks")}</button>
            <button
              type="button"
              className="sidebar-secondary-action"
              onClick={onCreateSpeakingActivity}
            >
              <Plus size={15} aria-hidden="true" />{t("New task")}</button>

            <span className="sidebar-divider" />
            <button
              type="button"
              aria-current={activeTab === "tournaments" ? "page" : undefined}
              className={activeTab === "tournaments" ? "active" : ""}
              onClick={() => onNavigateTab("tournaments")}
            >
              <Trophy size={17} aria-hidden="true" />{t("Competitions")}</button>
            <button
              type="button"
              aria-current={activeTab === "settings" ? "page" : undefined}
              className={activeTab === "settings" ? "active" : ""}
              onClick={() => onNavigateTab("settings")}
            >
              <Settings size={17} aria-hidden="true" />{t("Settings")}</button>
          </nav>
        )}
      </aside>

      <div ref={content} className="main-panel" tabIndex={-1}>
        {children}
        {activeSessions.length > 0 && (
          <div className="live-rail" aria-label={t("Active QuizStrike sessions")}>
            {activeSessions.map((session) => (
              <button
                type="button"
                key={session.id}
                className={
                  selectedSessionId === session.id
                    ? "active session-chip"
                    : "session-chip"
                }
                onClick={() => onOpenSession(session)}
              >
                <span>{session.sessionCode}</span>
                <small>{session.players.length}{" "}{t("players")}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
