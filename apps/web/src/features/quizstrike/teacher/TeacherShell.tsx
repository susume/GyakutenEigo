import {
  BookOpen,
  ChevronLeft,
  Globe2,
  Mic,
  Plus,
  Settings,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { GameSession, TeacherUser } from "@quizstrike/shared";
import type { ReactNode } from "react";
import type {
  TeacherPrimaryTab,
  TeacherSetupSection,
  TeacherTab,
} from "./teacherRoutes";

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
  const activeTab = contentTab(tab);

  return (
    <section className="workspace" aria-label="GyakutenEigo teacher dashboard">
      <header className="dashboard-brand-row">
        <h1>
          <span className="dashboard-wordmark">GyakutenEigo</span>
          <small>Teacher dashboard</small>
        </h1>
        <div className="dashboard-account-area">
          <span className="dashboard-product-pair">
            QuizStrike + Speaking Practice
          </span>
          <strong>{teacher.name}</strong>
          <button type="button" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <aside
        className={`sidebar${isLiveSetup ? " setup-sidebar" : ""}`}
        aria-label={
          isLiveSetup ? "Live game setup sections" : "Teacher sections"
        }
      >
        {isLiveSetup ? (
          <div className="setup-sidebar-menu">
            <span className="setup-sidebar-kicker">Host this Study Set</span>
            <button
              type="button"
              className={activeSetupSection === "mode" ? "active" : ""}
              aria-current={activeSetupSection === "mode" ? "step" : undefined}
              onClick={() => onSetupSectionChange("mode")}
            >
              <strong>Game Mode</strong>
            </button>
            <button
              type="button"
              className={activeSetupSection === "arena" ? "active" : ""}
              aria-current={activeSetupSection === "arena" ? "step" : undefined}
              onClick={() => onSetupSectionChange("arena")}
            >
              <strong>Arena</strong>
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
              <strong>Advanced</strong>
            </button>
            <button
              type="button"
              className="setup-sidebar-back"
              onClick={() => onNavigateTab("library")}
            >
              <ChevronLeft size={17} aria-hidden="true" />
              Back to Library
            </button>
          </div>
        ) : (
          <nav className="teacher-sidebar-nav" aria-label="Teacher navigation">
            <span className="sidebar-section-label">Workspace</span>
            <button
              type="button"
              aria-current={activeTab === "home" ? "page" : undefined}
              className={activeTab === "home" ? "active" : ""}
              onClick={() => onNavigateTab("home")}
            >
              <BookOpen size={17} aria-hidden="true" />
              Home
            </button>
            <span className="sidebar-divider" />
            <span className="sidebar-section-label">QuizStrike</span>
            <button
              type="button"
              aria-current={activeTab === "discover" ? "page" : undefined}
              className={activeTab === "discover" ? "active" : ""}
              onClick={() => onNavigateTab("discover")}
            >
              <Globe2 size={17} aria-hidden="true" />
              Discover
            </button>
            <button
              type="button"
              aria-current={activeTab === "library" ? "page" : undefined}
              className={activeTab === "library" ? "active" : ""}
              onClick={() => onNavigateTab("library")}
            >
              <Sparkles size={17} aria-hidden="true" />
              Library
            </button>
            <button
              type="button"
              aria-current={activeTab === "reports" ? "page" : undefined}
              className={activeTab === "reports" ? "active" : ""}
              onClick={() => onNavigateTab("reports")}
            >
              Reports
            </button>
            <button
              type="button"
              className="sidebar-create-button"
              aria-label="Create Study Set"
              onClick={onCreateStudySet}
            >
              <Plus size={17} aria-hidden="true" />
              Create
            </button>

            <span className="sidebar-divider" />
            <span className="sidebar-section-label">Speaking Practice</span>
            <button
              type="button"
              aria-current={activeTab === "speaking" ? "page" : undefined}
              className={activeTab === "speaking" ? "active" : ""}
              onClick={() => onNavigateTab("speaking")}
            >
              <Mic size={17} aria-hidden="true" />
              Speaking Practice
            </button>
            <button
              type="button"
              className="sidebar-secondary-action"
              onClick={onCreateSpeakingActivity}
            >
              <Plus size={15} aria-hidden="true" />
              New activity
            </button>

            <span className="sidebar-divider" />
            <button
              type="button"
              aria-current={activeTab === "tournaments" ? "page" : undefined}
              className={activeTab === "tournaments" ? "active" : ""}
              onClick={() => onNavigateTab("tournaments")}
            >
              <Trophy size={17} aria-hidden="true" />
              Competitions
            </button>
            <button
              type="button"
              aria-current={activeTab === "settings" ? "page" : undefined}
              className={activeTab === "settings" ? "active" : ""}
              onClick={() => onNavigateTab("settings")}
            >
              <Settings size={17} aria-hidden="true" />
              Settings
            </button>
          </nav>
        )}
      </aside>

      <div className="main-panel">
        {children}
        {activeSessions.length > 0 && (
          <div className="live-rail" aria-label="Active QuizStrike sessions">
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
                <small>{session.players.length} players</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
