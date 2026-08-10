import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  DoorOpen,
  GraduationCap,
  LogOut,
  Play,
  RefreshCw,
  Shield,
  Target,
  Users,
  Zap
} from "lucide-react";
import {
  ARENA_PLAYER_EYE_HEIGHT,
  ARENA_SCALE,
  DESERT_CITADEL_MAIN_LEVEL_Y,
  DESERT_CITADEL_ROOFTOP_LEVEL_Y,
  IRON_JUNCTION_LOADING_LEVEL_Y,
  IRON_JUNCTION_OVERPASS_LEVEL_Y,
  TEMPLE_RUNOFF_MAIN_LEVEL_Y,
  TEMPLE_RUNOFF_UPPER_LEVEL_Y,
  type ArenaMapId,
  type TeacherUser
} from "@quizstrike/shared";
import { authApi } from "../../api/client";
import { getTournamentInvitationCodeFromSearch, modeForRoute, normalizeRoutePath, type AppMode } from "../../navigation";
import PublicHomepage from "../../ui/PublicHomepage";
import QuizStrikeLogo from "../../ui/QuizStrikeLogo";
import {
  CHARACTER_STRESS_COUNTS,
  createCharacterDebugSession,
  summarizeCharacterDebugSession,
  type CharacterStressCount
} from "../../game/characters/CharacterDebugScenarios";
import type { ArenaQuality } from "../../game/gamePreferences";
import ArenaLoading from "./shared/ArenaLoading";

const ArenaPreview = lazy(() => import("../../game/ArenaPreview"));
const CompetitionHub = lazy(() => import("./competition/CompetitionHub"));
const OrganizerWorkspace = lazy(() => import("./competition/CompetitionHub").then((module) => ({ default: module.OrganizerWorkspace })));
const TournamentRegistrationPage = lazy(() => import("./tournament/TournamentRegistrationPage"));
const TournamentStudyPage = lazy(() => import("./tournament/TournamentStudyPage"));
const TeacherWorkspace = lazy(() => import("./teacher/TeacherWorkspace"));
const StudentExperience = lazy(() => import("./student/StudentExperience"));

type ApiWakeState = "waking" | "ready" | "slow";
const TOURNAMENT_TEACHER_RETURN_KEY = "quizstrike_tournament_teacher_return";

export default function App() {
  const [routePath, setRoutePath] = useState(() => normalizeRoutePath(window.location.pathname));
  const isJoinRoute = routePath === "/join";
  const isGameRoute = routePath === "/game";
  const isQuizStrikeRoute = routePath === "/quiz-strike" || routePath.startsWith("/quiz-strike/");
  const isCharacterLabRoute = routePath === "/character-lab";
  const isTournamentStudyRoute = routePath.startsWith("/tournament-study/");
  const isTournamentRegistrationRoute = /^\/quiz-strike\/tournaments\/[^/]+\/register$/.test(routePath);
  const tournamentRegistrationId = isTournamentRegistrationRoute ? routePath.split("/")[3] ?? "" : "";
  const isCharacterLabAvailable = import.meta.env.DEV;
  const [mode, setMode] = useState<AppMode>(() => modeForRoute(routePath));
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [teacherAuthMode, setTeacherAuthMode] = useState<"login" | "signup">("login");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [apiWakeState, setApiWakeState] = useState<ApiWakeState>("waking");

  const navigateTo = useCallback((nextPath: string, nextMode?: AppMode) => {
    const target = new URL(nextPath, window.location.origin);
    const normalizedPath = normalizeRoutePath(target.pathname);
    const targetUrl = `${normalizedPath}${target.search}${target.hash}`;
    if (window.location.pathname !== normalizedPath || window.location.search !== target.search || window.location.hash !== target.hash) window.history.pushState(null, "", targetUrl);
    setRoutePath(normalizedPath);
    setMode(nextMode ?? modeForRoute(normalizedPath));
    setIsMobileNavOpen(false);
  }, []);

  useEffect(() => {
    const syncRouteFromHistory = () => {
      const nextRoutePath = normalizeRoutePath(window.location.pathname);
      setRoutePath(nextRoutePath);
      setMode(modeForRoute(nextRoutePath));
      setIsMobileNavOpen(false);
    };
    window.addEventListener("popstate", syncRouteFromHistory);
    return () => window.removeEventListener("popstate", syncRouteFromHistory);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("gameplay-body-lock", isGameRoute);
    return () => document.body.classList.remove("gameplay-body-lock");
  }, [isGameRoute]);

  useEffect(() => {
    let cancelled = false;
    void authApi
      .warmUp()
      .then(() => {
        if (!cancelled) setApiWakeState("ready");
      })
      .catch(() => {
        if (!cancelled) setApiWakeState("slow");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isJoinRoute || isGameRoute || isCharacterLabRoute || isTournamentStudyRoute || !isQuizStrikeRoute) return;
    if (!localStorage.getItem("quizstrike_token")) return;
    authApi
      .me()
      .then((payload) => {
        const data = payload as { user: TeacherUser };
        setTeacher(data.user);
      })
      .catch(() => localStorage.removeItem("quizstrike_token"));
  }, [isJoinRoute, isGameRoute, isQuizStrikeRoute, isCharacterLabRoute, isTournamentStudyRoute]);

  const logout = () => {
    localStorage.removeItem("quizstrike_token");
    setTeacher(null);
    navigateTo("/", "home");
  };

  return (
    <main id="main-content" className="app-shell" tabIndex={-1}>
      <a className={`skip-link skip-link-${mode}`} href="#main-content">Skip to main content</a>
        <header className={`topbar topbar-${mode}${teacher ? " teacher-authenticated" : ""}`}>
        <button className="brand-button" type="button" aria-label="QuizStrike home" onClick={() => navigateTo("/", "home")}>
          {mode === "home" || mode === "teacher" ? <span className="public-wordmark">QuizStrike</span> : <QuizStrikeLogo />}
        </button>
        <nav className="primary-nav" aria-label="Primary">
          <button
            className="nav-menu-toggle"
            type="button"
            aria-expanded={isMobileNavOpen}
            aria-controls="primary-actions"
            onClick={() => setIsMobileNavOpen((open) => !open)}
          >
            Menu
          </button>
          <div id="primary-actions" className="top-actions" data-open={isMobileNavOpen ? "true" : "false"}>
          {mode === "quizStrike" && !teacher ? (
            <>
              <button onClick={() => { setTeacherAuthMode("signup"); navigateTo("/quiz-strike", "teacher"); }}>Create a teacher account</button>
              <button onClick={() => navigateTo("/join", "student")}>Join with code</button>
              <button className="nav-login" onClick={() => { setTeacherAuthMode("login"); navigateTo("/quiz-strike", "teacher"); }}>Teacher login</button>
            </>
          ) : <>
          <button className={mode === "quizStrike" ? "active" : ""} onClick={() => navigateTo("/quiz-strike", "quizStrike")}>
            <Play size={18} aria-hidden="true" />
            QuizStrike
          </button>
          <button className={mode === "student" ? "active" : ""} onClick={() => navigateTo("/join", "student")}>
            <DoorOpen size={18} aria-hidden="true" />
            Join with code
          </button>
          {teacher ? (
            <>
              <button className={mode === "teacher" ? "active" : ""} onClick={() => navigateTo("/quiz-strike", "teacher")}>
                <GraduationCap size={18} aria-hidden="true" />
                Teacher workspace
              </button>
              <button onClick={logout}>
                <LogOut size={18} aria-hidden="true" />
                Sign out
              </button>
            </>
          ) : (
            <button className={mode === "teacher" ? "active" : ""} onClick={() => { setTeacherAuthMode("login"); navigateTo("/quiz-strike", "teacher"); }}>
              <GraduationCap size={18} aria-hidden="true" />
              Teacher login
            </button>
          )}
          </>}
          </div>
        </nav>
      </header>

      {mode === "home" && <PublicHomepage
        onCreateMatch={() => { setTeacherAuthMode("signup"); navigateTo("/quiz-strike", "teacher"); }}
        onJoinGame={() => navigateTo("/join", "student")}
        onTeacherLogin={() => { setTeacherAuthMode("login"); navigateTo("/quiz-strike", "teacher"); }}
        onOpenCompetitions={() => navigateTo("/quiz-strike", "quizStrike")}
      />}
      {mode === "quizStrike" && routePath === "/quiz-strike/organizer" && <Suspense fallback={<FeatureLoading label="Loading organizer workspace" />}><OrganizerWorkspace teacher={teacher} onNavigate={navigateTo} /></Suspense>}
      {mode === "quizStrike" && isTournamentRegistrationRoute && <Suspense fallback={<FeatureLoading label="Loading tournament registration" />}><TournamentRegistrationPage
        tournamentId={decodeURIComponent(tournamentRegistrationId)}
        invitationCode={getTournamentInvitationCodeFromSearch(window.location.search)}
        teacher={teacher}
        onTeacherLogin={() => { sessionStorage.setItem(TOURNAMENT_TEACHER_RETURN_KEY, `${window.location.pathname}${window.location.search}`); setTeacherAuthMode("login"); navigateTo("/quiz-strike", "teacher"); }}
      /></Suspense>}
      {mode === "quizStrike" && routePath !== "/quiz-strike/organizer" && !isTournamentRegistrationRoute && <QuizStrikeLanding
        teacher={teacher}
        slug={routePath.startsWith("/quiz-strike/competitions/") ? decodeURIComponent(routePath.slice("/quiz-strike/competitions/".length)) : undefined}
        onNavigate={navigateTo}
        onTeacherLogin={() => { setTeacherAuthMode("login"); navigateTo("/quiz-strike", "teacher"); }}
      />}
      {mode === "tournamentStudy" && <Suspense fallback={<FeatureLoading label="Loading tournament study" />}><TournamentStudyPage tournamentId={decodeURIComponent(routePath.slice("/tournament-study/".length))} /></Suspense>}
      {mode === "characterLab" && (isCharacterLabAvailable ? <CharacterLab /> : <InternalToolNotice onReturn={() => navigateTo("/quiz-strike", "quizStrike")} />)}
      {mode === "teacher" && <Suspense fallback={<FeatureLoading label="Loading teacher workspace" />}><TeacherWorkspace teacher={teacher} apiWakeState={apiWakeState} initialMode={teacherAuthMode} onLogout={logout} onAuthed={(user) => {
          setTeacher(user);
          const returnTo = sessionStorage.getItem(TOURNAMENT_TEACHER_RETURN_KEY);
          sessionStorage.removeItem(TOURNAMENT_TEACHER_RETURN_KEY);
          navigateTo(returnTo ?? "/quiz-strike", returnTo ? "quizStrike" : "teacher");
        }} /></Suspense>}
      {mode === "student" && <Suspense fallback={<FeatureLoading label="Loading game" />}><StudentExperience onExit={() => navigateTo("/quiz-strike", "quizStrike")} /></Suspense>}
    </main>
  );
}

function InternalToolNotice({ onReturn }: { onReturn: () => void }) {
  return (
    <section className="notice-panel">
      <h1>Internal diagnostic</h1>
      <p>Character Lab is available only in local development. It is not a supported public game mode.</p>
      <button className="primary" onClick={onReturn}>Return to Quiz-Strike</button>
    </section>
  );
}

function CharacterLab() {
  const cleanPreview = new URLSearchParams(window.location.search).get("cleanPreview") === "1";
  const [count, setCount] = useState<CharacterStressCount>(40);
  const [isMoving, setIsMoving] = useState(true);
  const [tick, setTick] = useState(0);
  const [labMapId, setLabMapId] = useState<ArenaMapId>("desert_citadel");
  const [labQuality, setLabQuality] = useState<ArenaQuality>("balanced");
  const [labView, setLabView] = useState<"overview" | "fps">("overview");
  const [labLevel, setLabLevel] = useState<"lower" | "main" | "upper">("main");
  const session = useMemo(() => {
    const generated = createCharacterDebugSession({ count, tick });
    const testPositions = labMapId === "temple_runoff"
      ? {
          lower: { x: 0, y: ARENA_PLAYER_EYE_HEIGHT, z: 0, facing: -Math.PI / 2 },
          main: { x: -52 * ARENA_SCALE, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: 100 * ARENA_SCALE, facing: 0 },
          upper: { x: 0, y: TEMPLE_RUNOFF_UPPER_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: 40 * ARENA_SCALE, facing: 0 }
        }
      : labMapId === "iron_junction"
        ? {
            lower: { x: 10 * ARENA_SCALE, y: ARENA_PLAYER_EYE_HEIGHT, z: 25 * ARENA_SCALE, facing: -Math.PI / 2 },
            main: { x: -140 * ARENA_SCALE, y: IRON_JUNCTION_LOADING_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: -57 * ARENA_SCALE, facing: Math.PI },
            upper: { x: -40 * ARENA_SCALE, y: IRON_JUNCTION_OVERPASS_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: 25 * ARENA_SCALE, facing: -Math.PI / 2 }
          }
        : {
            lower: { x: -60 * ARENA_SCALE, y: ARENA_PLAYER_EYE_HEIGHT, z: 120 * ARENA_SCALE, facing: -Math.PI / 2 },
            main: { x: -80 * ARENA_SCALE, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: 0, facing: -Math.PI / 2 },
            upper: { x: 30 * ARENA_SCALE, y: DESERT_CITADEL_ROOFTOP_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: -156 * ARENA_SCALE, facing: Math.PI / 2 }
          };
    return {
      ...generated,
      settings: { ...generated.settings, mapId: labMapId },
      players: generated.players.map((player, index) => index === 0 ? { ...player, ...testPositions[labLevel] } : player)
    };
  }, [count, tick, labMapId, labLevel]);
  const summary = useMemo(() => summarizeCharacterDebugSession(session), [session]);

  useEffect(() => {
    if (!isMoving) return;
    const interval = window.setInterval(() => setTick((value) => value + 1), 220);
    return () => window.clearInterval(interval);
  }, [isMoving]);

  return (
    <section className="character-lab">
      <div className="section-heading">
        <div>
          <h1>Character Lab</h1>
          <p>Development test arena for multiplayer character readability, LOD, and stress checks.</p>
        </div>
        <div className="button-row" aria-label="Stress test presets">
          {CHARACTER_STRESS_COUNTS.map((preset) => (
            <button
              key={preset}
              className={count === preset ? "active" : ""}
              onClick={() => setCount(preset)}
            >
              {preset} players
            </button>
          ))}
        </div>
      </div>

      <div className="character-lab-grid">
        <div className="panel character-lab-controls">
          <h2>Scenario</h2>
          <div className="button-row" aria-label="Character lab map">
            <button className={labMapId === "desert_citadel" ? "active" : ""} onClick={() => setLabMapId("desert_citadel")}>Desert Citadel</button>
            <button className={labMapId === "iron_junction" ? "active" : ""} onClick={() => setLabMapId("iron_junction")}>Iron Junction</button>
            <button className={labMapId === "temple_runoff" ? "active" : ""} onClick={() => setLabMapId("temple_runoff")}>Temple Runoff</button>
          </div>
          <div className="button-row" aria-label="Character lab quality">
            <button className={labQuality === "performance" ? "active" : ""} onClick={() => setLabQuality("performance")}>Low</button>
            <button className={labQuality === "balanced" ? "active" : ""} onClick={() => setLabQuality("balanced")}>Medium</button>
            <button className={labQuality === "high" ? "active" : ""} onClick={() => setLabQuality("high")}>High</button>
          </div>
          <div className="button-row" aria-label="Character lab camera">
            <button className={labView === "overview" ? "active" : ""} onClick={() => setLabView("overview")}>Overview</button>
            <button className={labView === "fps" ? "active" : ""} onClick={() => setLabView("fps")}>Playable FPS</button>
          </div>
          {labView === "fps" && (
            <div className="button-row" aria-label="Map test level">
              <button className={labLevel === "lower" ? "active" : ""} onClick={() => setLabLevel("lower")}>{labMapId === "temple_runoff" ? "River ↓" : labMapId === "iron_junction" ? "Ground •" : "Ground •"}</button>
              <button className={labLevel === "main" ? "active" : ""} onClick={() => setLabLevel("main")}>{labMapId === "temple_runoff" ? "Main •" : labMapId === "iron_junction" ? "Loading ↑" : "Citadel ↑"}</button>
              <button className={labLevel === "upper" ? "active" : ""} onClick={() => setLabLevel("upper")}>{labMapId === "temple_runoff" ? "Bridge ↑" : labMapId === "iron_junction" ? "Overpass ↑" : "Lookout ↑↑"}</button>
            </div>
          )}
          <div className="lab-metrics">
            <span><strong>{summary.total}</strong>Total</span>
            <span><strong>{summary.alive}</strong>Alive</span>
            <span><strong>{summary.teams.blue}</strong>Alpha</span>
            <span><strong>{summary.teams.red}</strong>Bravo</span>
            <span><strong>{summary.gearTypes}</strong>Gear sets</span>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={isMoving}
              onChange={(event) => setIsMoving(event.target.checked)}
            />
            Simulate network movement
          </label>
          <button onClick={() => setTick((value) => value + 1)}>
            <RefreshCw size={18} aria-hidden="true" />
            Step Simulation
          </button>
          <p className="mini-copy">
            This route uses generated session data only. It does not create a classroom session or affect student gameplay.
          </p>
        </div>

        <div className="character-lab-arena">
          <Suspense fallback={<ArenaLoading label="Loading character lab" />}>
            <ArenaPreview
              key={`${labMapId}:${labView}:${labLevel}`}
              session={session}
              currentPlayer={labView === "fps" ? session.players[0] : undefined}
              view={labView}
              suppressHint={labView === "fps"}
              debugOverlay={!cleanPreview}
              debugLabel={`${count}-player character stress`}
              quality={labQuality}
            />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

export function GyakutenEigoHome({ onOpenGame, onJoinGame }: { onOpenGame: () => void; onJoinGame: () => void }) {
  return (
    <div className="product-home rescued-home">
      <section className="site-home site-home-esports" aria-labelledby="quizstrike-home-title">
        <div className="site-home-copy">
          <span className="eyebrow">A teacher-led classroom game</span>
          <h1 id="quizstrike-home-title">Make every correct answer matter.</h1>
          <p>QuizStrike turns review into a live team game. Students answer questions, make choices, and help their team while teachers stay in control.</p>
          <span className="hero-tagline">Learn together. Play together.</span>
          <div className="hero-proof-row" aria-label="Product qualities">
            <span><Users size={16} aria-hidden="true" />Class vs. class energy</span>
            <span><Zap size={16} aria-hidden="true" />School vs. school spirit</span>
            <span><Shield size={16} aria-hidden="true" />Teacher-controlled matches</span>
          </div>
          <div className="button-row">
            <button className="primary" onClick={onOpenGame}>
              <Play size={18} aria-hidden="true" />
              Create your first game
            </button>
            <button onClick={onJoinGame}>
              <DoorOpen size={18} aria-hidden="true" />
              Join with a code
            </button>
          </div>
        </div>
        <article className="game-host-card" aria-label="QuizStrike game preview">
          <div className="hero-arena-preview">
            <img className="game-host-card-art" src="/assets/quizstrike-classroom-cover.webp" alt="QuizStrike cover art showing red and blue teams answering questions in a desert arena." width={1672} height={941} fetchPriority="high" />
            <span className="game-host-card-label">Live game · Desert Citadel</span>
          </div>
          <div className="game-preview-meta">
            <span className="game-preview-objective game-preview-objective-new"><Target size={16} aria-hidden="true" />Answer · earn · outplay</span>
            <span className="game-preview-objective"><Target size={16} aria-hidden="true" />Answer · earn · capture</span>
            <strong>Every question changes the scoreboard.</strong>
            <small>Build momentum. Make the comeback. Take the round.</small>
          </div>
          <div className="game-preview-signal-row" aria-label="Match highlights">
            <span><strong>2</strong><small>rival teams</small></span>
            <span><strong>Live</strong><small>teacher-hosted</small></span>
            <span><strong>All in</strong><small>student focus</small></span>
          </div>
        </article>
      </section>

      <section className="landing-section product-intro esports-proof-section" aria-labelledby="why-play-title">
        <div className="section-kicker">Why students lean in</div>
        <h2 id="why-play-title">Review that feels like game day.</h2>
        <p className="section-lede">A correct answer is more than a point. It powers the next move, gives the team a reason to communicate, and keeps the whole class watching the scoreboard.</p>
        <div className="value-card-grid">
          <article><Zap size={22} aria-hidden="true" /><h3>Every answer has impact</h3><p>Correct answers create momentum students can feel immediately.</p></article>
          <article><Users size={22} aria-hidden="true" /><h3>Classroom rivalry, real teamwork</h3><p>Compete as a class, communicate under pressure, and celebrate the comeback together.</p></article>
          <article><Shield size={22} aria-hidden="true" /><h3>Teachers run the match</h3><p>Choose the questions, rules, pace, and finish line from one focused workspace.</p></article>
        </div>
      </section>

      <section className="landing-section founder-story-section" aria-labelledby="founder-story-title">
        <div className="founder-story-intro">
          <span className="eyebrow">The story behind QuizStrike</span>
          <h2 id="founder-story-title">Built for real classroom time.</h2>
          <span className="founder-story-signoff">Peter · Founder, QuizStrike</span>
        </div>
        <div className="founder-story-card">
          <p className="founder-greeting">Hi! I’m Peter.</p>
          <p>I started <strong>QuizStrike</strong> because I wanted review to feel active, social, and worth showing up for.</p>
          <p>Teachers need a game they can start quickly, guide clearly, and connect back to learning. Students need a reason to talk, think, and try again.</p>
          <p>That is what <strong>QuizStrike</strong> is for: a classroom game where every answer helps the team make its next move.</p>
          <p className="founder-closing">I hope it gives your next lesson a little more energy.</p>
        </div>
      </section>

      <section className="landing-section mode-section" aria-labelledby="modes-title">
        <div>
          <span className="eyebrow">Choose your matchup</span>
          <h2 id="modes-title">One question can swing the whole round.</h2>
        </div>
        <div className="mode-card-grid">
          <article className="mode-card flag-mode-card"><span>01</span><h3>Class vs. class tactics</h3><p>Push the objective, protect your lead, and make every answer count when the other team is closing in.</p></article>
          <article className="mode-card zombie-mode-card"><span>02</span><h3>Team survival mode</h3><p>Answer quickly, keep your team moving, and turn a pressure-filled review into a shared mission.</p></article>
          <article className="mode-card classic-mode-card"><span>03</span><h3>Quick start, full focus</h3><p>Run a clean warmup or a school-day showdown with a simple mode that gets everyone playing fast.</p></article>
        </div>
      </section>

      <section className="landing-section classroom-flow-section" aria-labelledby="classroom-flow-title">
        <div>
          <span className="eyebrow">From lesson plan to leaderboard</span>
          <h2 id="classroom-flow-title">Set the matchup in minutes.</h2>
        </div>
        <ol className="classroom-flow">
          <li><span>1</span><strong>Load the questions</strong><p>Paste study terms or build a custom set for the lesson you are teaching.</p></li>
          <li><span>2</span><strong>Choose the matchup</strong><p>Set the mode, pace, rewards, and rules for your classroom showdown.</p></li>
          <li><span>3</span><strong>Share the join code</strong><p>Students join from a browser with a nickname—no student email required.</p></li>
          <li><span>4</span><strong>Recap the result</strong><p>Use participation, accuracy, and missed-question data to plan the next play.</p></li>
        </ol>
      </section>

      <section className="landing-section faq-section" aria-labelledby="faq-title">
        <div><span className="eyebrow">Built for the real classroom</span><h2 id="faq-title">Live competition. Lasting learning.</h2></div>
        <div className="faq-list">
          <details open><summary>Is this only for high-stakes competition?</summary><p>No. Use it for a five-minute warmup, a focused review, or a full class-vs-class event.</p></details>
           <details><summary>Can teachers keep the game on track?</summary><p>Yes. Teachers create and start games, choose the mode and settings, watch the roster, and end the game when the lesson is ready.</p></details>
          <details><summary>What happens after the matchup?</summary><p>The teacher workspace keeps participation and question-accuracy information ready for the next lesson and the next rematch.</p></details>
        </div>
      </section>

      <section className="landing-final-cta">
        <span className="eyebrow">Ready for the next matchup?</span>
        <h2 className="landing-final-cta-title">Turn your next review into the main event.</h2>
        <h2>Bring the questions. We’ll bring the game loop.</h2>
         <div className="button-row"><button className="primary" onClick={onOpenGame}><Play size={18} aria-hidden="true" />Create your first game</button></div>
      </section>
    </div>
  );
}

function FeatureLoading({ label }: { label: string }) {
  return <section className="notice-panel" role="status"><p>{label}…</p></section>;
}

function QuizStrikeLanding({ teacher, slug, onNavigate, onTeacherLogin }: { teacher?: TeacherUser | null; slug?: string; onNavigate: (path: string, mode?: "quizStrike" | "teacher") => void; onTeacherLogin: () => void }) {
  return <Suspense fallback={<FeatureLoading label="Loading QuizStrike" />}><CompetitionHub teacher={teacher} slug={slug} onNavigate={onNavigate} onTeacherLogin={onTeacherLogin} /></Suspense>;
}

