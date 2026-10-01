import { useSiteTranslation } from "../../../ui/siteTranslation";
import { BookOpen, ChevronRight, Globe2, Mic, Play, Plus, RefreshCw, Trophy, UsersRound } from "lucide-react";
import type { GameSession, QuizSet, RecognitionSummary, TeacherUser } from "@quizstrike/shared";

type TeacherHomeProps = {
  teacher: TeacherUser;
  quizSets: QuizSet[];
  sessions: GameSession[];
  recognition?: RecognitionSummary;
  onCreate: () => void;
  onDiscover: () => void;
  onLibrary: () => void;
  onReports: () => void;
  onHost: (quizSetId: string) => void;
  onOpenSession: (session: GameSession) => void;
  onOpenSet: (quizSetId: string) => void;
  onStartQuizStrike: () => void;
  onStartSpeaking: () => void;
  onCreateSpeaking: () => void;
  loading?: boolean;
  error?: string;
  onRetry: () => void;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function TeacherHome({ teacher, quizSets, sessions, recognition, onCreate, onDiscover, onLibrary, onReports, onHost, onOpenSession, onOpenSet, onStartQuizStrike, onStartSpeaking, onCreateSpeaking, loading, error, onRetry }: TeacherHomeProps) {
  const { t } = useSiteTranslation();
  const activeSession = sessions.find((session) => session.status !== "ended");
  const recentSets = [...quizSets].sort((left, right) => (right.updatedAt ?? right.createdAt).localeCompare(left.updatedAt ?? left.createdAt)).slice(0, 3);
  const recentGames = sessions.filter((session) => session.status === "ended").sort((left, right) => (right.endedAt ?? right.createdAt).localeCompare(left.endedAt ?? left.createdAt)).slice(0, 3);

  if (loading || error) return <section className="teacher-home-page">
    <div className="teacher-home-hero"><div><span className="teacher-eyebrow">{t("Teacher home")}</span><h2>{t("Welcome back,")}{" "}{teacher.name.split(" ")[0]}</h2></div></div>
    <div className="teacher-home-empty" role={error ? "alert" : "status"}>
      <RefreshCw size={24} aria-hidden="true" /><div><strong>{error ? t("Your workspace couldn’t load") : t("Loading your classroom workspace…")}</strong><p>{error ? t("Check your connection and try again. Your content is still saved.") : t("Getting your Study Sets and class sessions ready.")}</p></div>
      {error && <button className="secondary-button" type="button" onClick={onRetry}>{t("Try again")}</button>}
    </div>
  </section>;

  return (
    <div className="teacher-home-page">
      <section className="teacher-home-hero" aria-labelledby="teacher-home-title">
        <div>
          <span className="teacher-eyebrow">{t("Teacher home")}</span>
          <h2 id="teacher-home-title">{t("Welcome back,")}{" "}{teacher.name.split(" ")[0]}</h2>
          <p>{t("Choose a QuizStrike game or a Speaking Task session for your class.")}</p>
        </div>
        <div className="teacher-home-hero-actions">
          <button className="primary" onClick={onCreate}><Plus size={18} aria-hidden="true" />{t("Create Study Set")}</button>
          <button className="secondary-button" onClick={onDiscover}><Globe2 size={18} aria-hidden="true" />{t("Browse Discover")}</button>
        </div>
      </section>

      {activeSession && (
        <section className="teacher-active-game" aria-labelledby="active-game-title">
          <div>
            <span className="teacher-eyebrow">{t("Active game")}</span>
            <h3 id="active-game-title">{activeSession.sessionCode} · {activeSession.status === "waiting" ? t("Waiting for your class") : activeSession.controlState === "teacher_paused" ? t("Paused by teacher") : activeSession.status === "active" ? t("Game in progress") : t("Round results")}</h3>
            <p>{activeSession.players.length}{" "}{t("joined ·")}{" "}{activeSession.settings.gameMode === "flag" ? t("Capture the Flag") : activeSession.settings.gameMode === "zombie" ? t("Zombie Survival") : activeSession.settings.gameMode === "athletics" ? t("Athletics Race") : t("Team Tag")}</p>
          </div>
          <button className="primary" onClick={() => onOpenSession(activeSession)}><Play size={17} aria-hidden="true" />{activeSession.status === "waiting" ? t("Open lobby") : t("Return to game")}</button>
        </section>
      )}

      <section className="teacher-home-section teacher-quick-actions" aria-labelledby="teacher-quick-actions-title">
        <div className="teacher-home-section-heading">
          <div>
            <span className="teacher-eyebrow">{t("Start a class activity")}</span>
            <h3 id="teacher-quick-actions-title">{t("What would you like to do with your class?")}</h3>
          </div>
        </div>
        <div className="teacher-action-card-grid">
          <button type="button" className="teacher-action-card teacher-action-card-quizstrike" onClick={onStartQuizStrike}>
            <span className="teacher-action-card-icon"><Play size={20} aria-hidden="true" /></span>
            <span><strong>{t("Start QuizStrike")}</strong><small>{t("Choose a Study Set and open a classroom game.")}</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="teacher-action-card teacher-action-card-speaking" onClick={onStartSpeaking}>
            <span className="teacher-action-card-icon"><Mic size={20} aria-hidden="true" /></span>
            <span><strong>{t("Start Speaking Task")}</strong><small>{t("Choose a task and launch a speaking session.")}</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="teacher-action-card teacher-action-card-quiet" onClick={onCreate}>
            <span className="teacher-action-card-icon"><Plus size={20} aria-hidden="true" /></span>
            <span><strong>{t("Create Study Set")}</strong><small>{t("Build a new set of questions for your next game.")}</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="teacher-action-card teacher-action-card-quiet" onClick={onCreateSpeaking}>
            <span className="teacher-action-card-icon"><Mic size={20} aria-hidden="true" /></span>
            <span><strong>{t("Create speaking task")}</strong><small>{t("Set the situation, rubric, and feedback language.")}</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="teacher-home-section" aria-labelledby="recent-sets-title">
        <div className="teacher-home-section-heading"><div><span className="teacher-eyebrow">{t("Keep playing")}</span><h3 id="recent-sets-title">{t("Recently used")}</h3></div><button className="link-button" onClick={onLibrary}>{t("View library")}{" "}<ChevronRight size={16} aria-hidden="true" /></button></div>
        {recentSets.length > 0 ? <div className="teacher-home-set-grid">{recentSets.map((quiz) => <article className="teacher-home-set-card" key={quiz.id}>
          <button className="teacher-home-set-main" onClick={() => onOpenSet(quiz.id)}>
            <span className="set-card-icon"><BookOpen size={19} aria-hidden="true" /></span>
            <span><strong>{quiz.title}</strong><small>{quiz.questions.length}{" "}{t("questions ·")}{" "}{quiz.visibility === "PUBLIC" ? t("Public") : t("Private")}</small></span>
          </button>
          <button className="set-card-host" disabled={quiz.questions.length === 0} title={quiz.questions.length === 0 ? t("Add a question before hosting") : undefined} onClick={() => onHost(quiz.id)}><Play size={15} aria-hidden="true" />{t("Host")}</button>
        </article>)}</div> : <div className="teacher-home-empty"><BookOpen size={24} aria-hidden="true" /><div><strong>{t("No Study Sets yet")}</strong><p>{t("Start with a public set from Discover, or create your own.")}</p></div><button className="secondary-button" onClick={onDiscover}>{t("Browse Study Sets")}</button></div>}
      </section>

      <section className="teacher-home-section" aria-labelledby="library-preview-title">
        <div className="teacher-home-section-heading"><div><span className="teacher-eyebrow">{t("Your content")}</span><h3 id="library-preview-title">{t("Your Library")}</h3></div><button className="link-button" onClick={onLibrary}>{t("Open library")}{" "}<ChevronRight size={16} aria-hidden="true" /></button></div>
        <div className="teacher-home-library-strip">
          <div><strong>{quizSets.length}</strong><span>{t("Study Sets")}</span></div>
          <div><strong>{quizSets.filter((quiz) => quiz.visibility === "PUBLIC").length}</strong><span>{t("Public")}</span></div>
          <div><strong>{quizSets.reduce((total, quiz) => total + quiz.questions.length, 0)}</strong><span>{t("Questions")}</span></div>
          <button className="secondary-button" onClick={onCreate}><Plus size={16} aria-hidden="true" />{t("Create another")}</button>
        </div>
      </section>

      <div className="teacher-home-lower-grid">
        <section className="teacher-home-section" aria-labelledby="discover-preview-title">
          <div className="teacher-home-section-heading"><div><span className="teacher-eyebrow">{t("Community content")}</span><h3 id="discover-preview-title">{t("Discover")}</h3></div><button className="link-button" onClick={onDiscover}>{t("Find a set")}{" "}<ChevronRight size={16} aria-hidden="true" /></button></div>
          <div className="teacher-discover-callout"><Globe2 size={24} aria-hidden="true" /><div><strong>{t("Ready to host without authoring?")}</strong><p>{t("Search public Study Sets shared by other teachers, then host one directly.")}</p></div><button className="primary" onClick={onDiscover}>{t("Browse")}</button></div>
        </section>
        <section className="teacher-home-section" aria-labelledby="activity-title">
          <div className="teacher-home-section-heading"><div><span className="teacher-eyebrow">{t("Keep track")}</span><h3 id="activity-title">{t("Recent activity")}</h3></div><button className="link-button" onClick={onReports}>{t("Reports")}{" "}<ChevronRight size={16} aria-hidden="true" /></button></div>
          {recentGames.length > 0 ? <ul className="teacher-activity-list">{recentGames.map((session) => <li key={session.id}><span className="activity-icon"><Trophy size={16} aria-hidden="true" /></span><div><strong>{session.sessionCode}</strong><small>{session.players.length}{" "}{t("learners · ended")}{" "}{formatDate(session.endedAt ?? session.createdAt)}</small></div></li>)}</ul> : <div className="teacher-home-empty compact"><UsersRound size={22} aria-hidden="true" /><div><strong>{t("No reports yet")}</strong><p>{t("Completed games will appear here.")}</p></div></div>}
        </section>
      </div>

      {recognition && <p className="teacher-home-recognition"><Trophy size={15} aria-hidden="true" /> {recognition.level} · {recognition.points}{" "}{t("contribution points")}</p>}
    </div>
  );
}
