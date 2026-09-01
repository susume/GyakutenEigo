import { BookOpen, ChevronRight, Globe2, Mic, Play, Plus, Trophy, UsersRound } from "lucide-react";
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
};

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function TeacherHome({ teacher, quizSets, sessions, recognition, onCreate, onDiscover, onLibrary, onReports, onHost, onOpenSession, onOpenSet, onStartQuizStrike, onStartSpeaking, onCreateSpeaking }: TeacherHomeProps) {
  const activeSession = sessions.find((session) => session.status !== "ended");
  const recentSets = [...quizSets].sort((left, right) => (right.updatedAt ?? right.createdAt).localeCompare(left.updatedAt ?? left.createdAt)).slice(0, 3);
  const recentGames = sessions.filter((session) => session.status === "ended").slice(0, 3);

  return (
    <div className="teacher-home-page">
      <section className="teacher-home-hero" aria-labelledby="teacher-home-title">
        <div>
          <span className="teacher-eyebrow">Teacher home</span>
          <h2 id="teacher-home-title">Welcome back, {teacher.name.split(" ")[0]}</h2>
          <p>Choose a QuizStrike game or a Speaking Practice session for your class.</p>
        </div>
        <div className="teacher-home-hero-actions">
          <button className="primary" onClick={onCreate}><Plus size={18} aria-hidden="true" />Create Study Set</button>
          <button className="secondary-button" onClick={onDiscover}><Globe2 size={18} aria-hidden="true" />Browse Discover</button>
        </div>
      </section>

      {activeSession && (
        <section className="teacher-active-game" aria-labelledby="active-game-title">
          <div>
            <span className="teacher-eyebrow">Active game</span>
            <h3 id="active-game-title">{activeSession.sessionCode} is waiting for your class</h3>
            <p>{activeSession.players.length} joined · {activeSession.settings.gameMode === "flag" ? "Capture the Flag" : activeSession.settings.gameMode === "zombie" ? "Zombie Survival" : activeSession.settings.gameMode === "athletics" ? "Athletics Race" : "Team Tag"}</p>
          </div>
          <button className="primary" onClick={() => onOpenSession(activeSession)}><Play size={17} aria-hidden="true" />Open lobby</button>
        </section>
      )}

      <section className="teacher-home-section teacher-quick-actions" aria-labelledby="teacher-quick-actions-title">
        <div className="teacher-home-section-heading">
          <div>
            <span className="teacher-eyebrow">Start a class activity</span>
            <h3 id="teacher-quick-actions-title">What would you like to do with your class?</h3>
          </div>
        </div>
        <div className="teacher-action-card-grid">
          <button type="button" className="teacher-action-card teacher-action-card-quizstrike" onClick={onStartQuizStrike}>
            <span className="teacher-action-card-icon"><Play size={20} aria-hidden="true" /></span>
            <span><strong>Start QuizStrike</strong><small>Choose a Study Set and open a classroom game.</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="teacher-action-card teacher-action-card-speaking" onClick={onStartSpeaking}>
            <span className="teacher-action-card-icon"><Mic size={20} aria-hidden="true" /></span>
            <span><strong>Start Speaking Practice</strong><small>Choose an activity and launch a speaking session.</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="teacher-action-card teacher-action-card-quiet" onClick={onCreate}>
            <span className="teacher-action-card-icon"><Plus size={20} aria-hidden="true" /></span>
            <span><strong>Create Study Set</strong><small>Build a new set of questions for your next game.</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="teacher-action-card teacher-action-card-quiet" onClick={onCreateSpeaking}>
            <span className="teacher-action-card-icon"><Mic size={20} aria-hidden="true" /></span>
            <span><strong>Create Speaking Activity</strong><small>Set the situation, rubric, and feedback language.</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="teacher-home-section" aria-labelledby="recent-sets-title">
        <div className="teacher-home-section-heading"><div><span className="teacher-eyebrow">Keep playing</span><h3 id="recent-sets-title">Recently used</h3></div><button className="link-button" onClick={onLibrary}>View library <ChevronRight size={16} aria-hidden="true" /></button></div>
        {recentSets.length > 0 ? <div className="teacher-home-set-grid">{recentSets.map((quiz) => <article className="teacher-home-set-card" key={quiz.id}>
          <button className="teacher-home-set-main" onClick={() => onOpenSet(quiz.id)}>
            <span className="set-card-icon"><BookOpen size={19} aria-hidden="true" /></span>
            <span><strong>{quiz.title}</strong><small>{quiz.questions.length} questions · {quiz.visibility === "PUBLIC" ? "Public" : "Private"}</small></span>
          </button>
          <button className="set-card-host" onClick={() => onHost(quiz.id)}><Play size={15} aria-hidden="true" />Host</button>
        </article>)}</div> : <div className="teacher-home-empty"><BookOpen size={24} aria-hidden="true" /><div><strong>No Study Sets yet</strong><p>Start with a public set from Discover, or create your own.</p></div><button className="secondary-button" onClick={onDiscover}>Browse Study Sets</button></div>}
      </section>

      <section className="teacher-home-section" aria-labelledby="library-preview-title">
        <div className="teacher-home-section-heading"><div><span className="teacher-eyebrow">Your content</span><h3 id="library-preview-title">Your Library</h3></div><button className="link-button" onClick={onLibrary}>Open library <ChevronRight size={16} aria-hidden="true" /></button></div>
        <div className="teacher-home-library-strip">
          <div><strong>{quizSets.length}</strong><span>Study Sets</span></div>
          <div><strong>{quizSets.filter((quiz) => quiz.visibility === "PUBLIC").length}</strong><span>Public</span></div>
          <div><strong>{quizSets.reduce((total, quiz) => total + quiz.questions.length, 0)}</strong><span>Questions</span></div>
          <button className="secondary-button" onClick={onCreate}><Plus size={16} aria-hidden="true" />Create another</button>
        </div>
      </section>

      <div className="teacher-home-lower-grid">
        <section className="teacher-home-section" aria-labelledby="discover-preview-title">
          <div className="teacher-home-section-heading"><div><span className="teacher-eyebrow">Community content</span><h3 id="discover-preview-title">Discover</h3></div><button className="link-button" onClick={onDiscover}>Find a set <ChevronRight size={16} aria-hidden="true" /></button></div>
          <div className="teacher-discover-callout"><Globe2 size={24} aria-hidden="true" /><div><strong>Ready to host without authoring?</strong><p>Search public Study Sets shared by other teachers, then host one directly.</p></div><button className="primary" onClick={onDiscover}>Browse</button></div>
        </section>
        <section className="teacher-home-section" aria-labelledby="activity-title">
          <div className="teacher-home-section-heading"><div><span className="teacher-eyebrow">Keep track</span><h3 id="activity-title">Recent activity</h3></div><button className="link-button" onClick={onReports}>Reports <ChevronRight size={16} aria-hidden="true" /></button></div>
          {recentGames.length > 0 ? <ul className="teacher-activity-list">{recentGames.map((session) => <li key={session.id}><span className="activity-icon"><Trophy size={16} aria-hidden="true" /></span><div><strong>{session.sessionCode}</strong><small>{session.players.length} learners · ended {formatDate(session.endedAt ?? session.createdAt)}</small></div></li>)}</ul> : <div className="teacher-home-empty compact"><UsersRound size={22} aria-hidden="true" /><div><strong>No reports yet</strong><p>Completed games will appear here.</p></div></div>}
        </section>
      </div>

      {recognition && <p className="teacher-home-recognition"><Trophy size={15} aria-hidden="true" /> {recognition.level} · {recognition.points} contribution points</p>}
    </div>
  );
}
