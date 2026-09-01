import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, Eye, EyeOff, Footprints, Globe2, GraduationCap, Link2, Minus, Play, Plus, RefreshCw, Trash2, Trophy, WifiOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  calculateClassAccuracy,
  canStartRound,
  DEFAULT_SESSION_SETTINGS,
  ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS,
  getRoundRemainingSeconds,
  isRoundPreparationPhase,
  isZombieSelectionPhase,
  ATHLETICS_ARENA_MAP_ID,
  ATHLETICS_STADIUM_COURSE,
  ATHLETICS_MODES,
  ATHLETICS_MODE_CONFIG,
  resolveAthleticsStandings,
  validateSessionSnapshot,
  type ArenaMapId,
  type BotDifficulty,
  type CharacterCustomizationSettings,
  type GameSession,
  type PlayerSession,
  type QuizFolder,
  type QuizSet,
  type RecognitionSummary,
  type ReportMetadata,
  type SessionReport,
  type SessionSettings,
  type TeacherUser
} from "@quizstrike/shared";
import type { Socket } from "socket.io-client";
import { ApiError, authApi, fetchDecalAsset, getTeacherToken, teacherApi } from "../../../api/client";
import { createMultiplayerSocket } from "../../multiplayer/connection";
import { buildStudentJoinUrl } from "../../../navigation";
import { getModeScoreSummary, getZombieCounts } from "../../../sessionPresentation";
import { StatusMessages } from "../../../ui/StatusMessages";
import TeacherDecalGallery from "../../../ui/TeacherDecalGallery";
import { ARENA_MAPS, getArenaMap } from "../../../game/arenaMapCatalog";
import { gameAudio } from "../../../game/GameAudio";
import { readGamePreferences, writeGamePreferences, type GamePreferences } from "../../../game/gamePreferences";

import ArenaLoading from "../shared/ArenaLoading";
import GameAnnouncementOverlay from "../shared/GameAnnouncementOverlay";
import EventFeed from "../student/EventFeed";
import GamePreferencesPanel from "../student/GamePreferencesPanel";
import Scoreboard from "../student/Scoreboard";
import LearningPulse from "./LearningPulse";
import TeacherPauseControls from "./TeacherPauseControls";
import StudySetLibrary from "./StudySetLibrary";
import StudySetDetail from "./StudySetDetail";
import TeacherHome from "./TeacherHome";
import StudySetEditor from "./StudySetEditor";
import { useSessionControls } from "./useSessionControls";
import TeacherShell from "./TeacherShell";
import { teacherRouteState, teacherSpeakingPath, teacherTabPath, type TeacherPrimaryTab, type TeacherSetupSection, type TeacherTab } from "./teacherRoutes";
const ArenaPreview = lazy(() => import("../../../game/ArenaPreview"));
const TournamentCenter = lazy(() => import("../tournament/TournamentCenter"));
const SpeakingTeacherWorkspace = lazy(() => import("../../speaking/teacher/SpeakingTeacherWorkspace").then((module) => ({ default: module.SpeakingTeacherWorkspace })));


type DashboardPayload = {
  classes: Array<{ id: string; name: string; description?: string; createdAt: string }>;
  quizSets: QuizSet[];
  sessions: GameSession[];
  folders: QuizFolder[];
  reports: ReportMetadata[];
  recognition?: RecognitionSummary;
};
type AuthPayload = { user: TeacherUser; token: string };
export type ApiWakeState = "waking" | "ready" | "slow";
type SetupSection = TeacherSetupSection;
const sessionNumberFields = [
  { name: "roundCount", label: "Number of rounds", min: 1, max: 30, help: "How many rounds the class will play." },
  { name: "flagHoldSeconds", label: "Flag hold time", min: 5, max: 180, step: 5, unit: "seconds", help: "How long Red protects a placed flag." },
  { name: "initialZombieCount", label: "Starting Zombies", min: 1, max: 20, help: "How many students become Zombies after the energy period." },
  { name: "maxPlayers", label: "Student limit", min: 2, max: 40, unit: "students", help: "The largest class size this room can hold, including test bots." },
  { name: "startingMoney", label: "Starting rewards", min: 0, max: 16000, step: 100, unit: "rewards", help: "Rewards each student starts with." },
  { name: "correctAnswerReward", label: "Reward per correct answer", min: 0, max: 5000, step: 100, unit: "rewards", help: "Rewards earned for each correct answer." },
  { name: "startingSnowballs", label: "Starting snowballs", min: 1, max: 99, unit: "snowballs", help: "Ammunition each student starts with." },
  { name: "snowballPackPrice", label: "Snowball pack price", min: 0, max: 5000, step: 50, unit: "rewards", help: "Reward cost of one snowball pack." },
  { name: "snowballsPerPack", label: "Snowballs per pack", min: 1, max: 50, unit: "snowballs", help: "Snowballs in each pack." },
  { name: "wrongAnswerPenalty", label: "Wrong answer penalty", min: 0, max: 16000, step: 100, unit: "rewards", help: "Rewards removed for an incorrect answer." },
  { name: "roundDurationSeconds", label: "Round time", min: 60, max: 3600, step: 30, unit: "seconds", help: "Time available for each round." },
  { name: "athleticsCourseLaps", label: "Course Laps", min: 1, max: 10, help: "How many times must students complete the course?" }
] as const satisfies ReadonlyArray<{ name: keyof Pick<SessionSettings, "maxPlayers" | "roundCount" | "flagHoldSeconds" | "initialZombieCount" | "startingMoney" | "correctAnswerReward" | "startingSnowballs" | "snowballPackPrice" | "snowballsPerPack" | "wrongAnswerPenalty" | "roundDurationSeconds" | "athleticsCourseLaps">; label: string; min: number; max: number; step?: number; unit?: string; help: string; }>;
type SessionNumberField = (typeof sessionNumberFields)[number]["name"];
function useAsyncMessage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const clear = useCallback(() => { setMessage(""); setError(""); }, []);
  const report = useCallback((err: unknown) => { setMessage(""); setError(err instanceof ApiError || err instanceof Error ? err.message : "We couldn't complete that. Try again."); }, []);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);
  return useMemo(() => ({ message, error, setMessage, setError, clear, clearError: () => setError(""), report }), [message, error, clear, report]);
}
const formatRewards = (value: number) => `${Math.round(value)} rewards`;
const teamLabel = (team: PlayerSession["team"]) => (team === "blue" ? "Blue Team" : "Red Team");
const sessionStatusLabel = (status: GameSession["status"]) => status === "active" ? "Round live" : status === "paused" ? "Round results" : status === "ended" ? "Game over" : "Waiting for players";
const gameModeLabel = (mode: SessionSettings["gameMode"]) => mode === "flag" ? "Capture the Flag" : mode === "zombie" ? "Zombie Survival" : mode === "athletics" ? "Athletics Race" : "Team Tag";
const arenaMapLabel = (mapId: ArenaMapId | string | undefined) => getArenaMap(mapId).title;
const sessionGameModeLabel = (session: GameSession) => session.settings.gameMode === "athletics"
  ? ATHLETICS_MODE_CONFIG[session.settings.athleticsMode ?? session.athletics?.mode ?? "classic"].label
  : gameModeLabel(session.settings.gameMode);
const arenaMapDisplayTitle = (title: string) => title.replace(/\s2\.0$/, "");
const ARENA_MAP_PREVIEW_ASSETS: Record<ArenaMapId, string> = { desert_citadel: "/assets/arena-maps/desert-citadel.png", iron_junction: "/assets/arena-maps/iron-junction.png", temple_runoff: "/assets/arena-maps/temple-runoff.png" };
const getTopLearner = (players: PlayerSession[], mode?: SessionSettings["gameMode"]) => {
  if (mode === "athletics") {
    const winner = resolveAthleticsStandings(players).find((standing) => standing.status === "finished" && players.some((player) => player.id === standing.playerId && !player.isBot));
    return winner ? players.find((player) => player.id === winner.playerId && !player.isBot) : undefined;
  }
  return [...players].filter((player) => !player.isBot && player.correctAnswers + player.wrongAnswers > 0).sort((a, b) => b.correctAnswers - a.correctAnswers || b.score - a.score)[0];
};
const getTeamTotals = (players: PlayerSession[]) => ({ blue: players.filter((player) => player.team === "blue").reduce((total, player) => total + player.score, 0), red: players.filter((player) => player.team === "red").reduce((total, player) => total + player.score, 0) });
const sessionSettingGroups: Array<{ title: string; fields: SessionNumberField[] }> = [
  { title: "Game", fields: ["roundCount", "athleticsCourseLaps", "roundDurationSeconds", "maxPlayers"] },
  { title: "Quiz Economy", fields: ["startingMoney", "correctAnswerReward", "wrongAnswerPenalty", "snowballPackPrice"] },
  { title: "Weapons / Supplies", fields: ["startingSnowballs", "snowballsPerPack"] }
];
const formatDuration = (seconds: number) => `${Math.floor(Math.max(0, Math.round(seconds)) / 60)}:${String(Math.max(0, Math.round(seconds)) % 60).padStart(2, "0")}`;
function useRoundRemaining(session: GameSession | null) {
  const [clientNowMs, setClientNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  useEffect(() => {
    const serverTimeMs = session?.serverTime ? Date.parse(session.serverTime) : Number.NaN;
    setServerOffsetMs(Number.isFinite(serverTimeMs) ? serverTimeMs - Date.now() : 0);
  }, [session?.serverTime]);
  useEffect(() => {
    setClientNowMs(Date.now());
    if (session?.status !== "active" || session.controlState === "teacher_paused") return;
    const interval = window.setInterval(() => setClientNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.status, session?.controlState, session?.teacherPausedAt, session?.startedAt, session?.endsAt]);
  if (!session || session.status === "ended" || session.status === "paused") return 0;
  const at = session.controlState === "teacher_paused"
    ? session.teacherPausedAt ?? session.serverTime
    : new Date(clientNowMs + serverOffsetMs).toISOString();
  return at ? getRoundRemainingSeconds(session, at) : 0;
}

function TeacherAuth({
  onAuthed,
  initialMode,
  apiWakeState
}: {
  onAuthed: (user: TeacherUser) => void;
  initialMode: "login" | "signup";
  apiWakeState: ApiWakeState;
}) {
  const [isSignup, setIsSignup] = useState(initialMode === "signup");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authProgress, setAuthProgress] = useState<"idle" | "connecting" | "retrying">("idle");
  const status = useAsyncMessage();

  useEffect(() => setIsSignup(initialMode === "signup"), [initialMode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    status.clear();
    setIsSubmitting(true);
    setAuthProgress("connecting");
    try {
      const payload = (
        isSignup
          ? await authApi.signup(form)
          : await authApi.login(form, { onRetry: () => setAuthProgress("retrying") })
      ) as AuthPayload;
      localStorage.setItem("quizstrike_token", payload.token);
      onAuthed(payload.user);
    } catch (err) {
      status.report(err);
    } finally {
      setIsSubmitting(false);
      setAuthProgress("idle");
    }
  };

  const wakeDisplay = authProgress === "retrying"
    ? {
        tone: "waking",
        title: "Getting the classroom ready",
        detail: "That took a moment. We’ll try again automatically."
      }
    : apiWakeState === "ready"
      ? {
          tone: "ready",
          title: "Ready to sign in",
            detail: "Your host workspace is ready."
        }
      : apiWakeState === "slow"
        ? {
            tone: "slow",
            title: "Taking a little longer",
            detail: "You can keep going. We’ll retry once if needed."
          }
        : {
            tone: "waking",
            title: "Getting your workspace ready",
            detail: "Enter your details while the host tools start."
          };

  const submitLabel = isSubmitting
    ? authProgress === "retrying"
      ? "Trying again..."
      : isSignup
        ? "Creating your account..."
        : apiWakeState === "ready"
          ? "Signing in..."
          : "Getting things ready..."
    : isSignup
      ? "Create account"
      : "Sign in";

  return (
    <section className="auth-layout quizstrike-auth-layout auth-game-first">
      <aside className="auth-visual" aria-label="GyakutenEigo teacher workspace">
        <img className="auth-visual-art" src="/assets/quizstrike-game-hero.png" alt="" width={1672} height={941} fetchPriority="high" />
        <div className="auth-visual-shade" aria-hidden="true" />
        <div className="auth-visual-content">
          <span className="auth-game-wordmark">GyakutenEigo</span>
          <span className="auth-kicker">Teacher dashboard</span>
          <p className="auth-visual-title">One workspace.<br />Every class.</p>
          <p>Create QuizStrike games and Speaking Practice sessions from the same focused teacher dashboard.</p>
          <span className="auth-tagline">Games ready. Voices heard.</span>
        </div>
      </aside>
      <form className="panel form-panel auth-form-panel" onSubmit={submit}>
        <div className="auth-form-heading">
          <span className="auth-kicker">Teacher account</span>
          <h1>{isSignup ? "Welcome to GyakutenEigo" : "Sign in to GyakutenEigo"}</h1>
          <p>{isSignup ? "Create one teacher workspace for games and speaking practice." : "Open QuizStrike, Speaking Practice, and your class results."}</p>
        </div>
        {isSignup && (
          <label htmlFor="teacher-name">
            Your name
            <input id="teacher-name" autoComplete="name" value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); status.clearError(); }} />
          </label>
        )}
        <label htmlFor="teacher-email">
          Email
          <input
            id="teacher-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            value={form.email}
            onChange={(event) => { setForm({ ...form, email: event.target.value }); status.clearError(); }}
          />
        </label>
        <label htmlFor="teacher-password">
          Password
          <span className="password-field">
            <input
              id="teacher-password"
              type={isPasswordVisible ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              enterKeyHint="go"
              value={form.password}
              onChange={(event) => { setForm({ ...form, password: event.target.value }); status.clearError(); }}
            />
            <button type="button" className="password-toggle" aria-label={isPasswordVisible ? "Hide password" : "Show password"} onClick={() => setIsPasswordVisible((visible) => !visible)}>
              {isPasswordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </span>
        </label>
        <div className={`server-wake-status server-wake-${wakeDisplay.tone}`} role="status" aria-live="polite">
          <RefreshCw size={18} aria-hidden="true" />
          <span><strong>{wakeDisplay.title}</strong><small>{wakeDisplay.detail}</small></span>
        </div>
        <StatusMessages error={status.error} />
        <button className="primary" type="submit" disabled={isSubmitting}>
          <GraduationCap size={18} aria-hidden="true" />
          {submitLabel}
        </button>
        <button className="text-button" type="button" onClick={() => setIsSignup(!isSignup)} disabled={isSubmitting}>
          {isSignup ? "I already have an account" : "Create a teacher account"}
        </button>
      </form>
    </section>
  );
}

function TeacherDashboard({ teacher, onLogout, initialPath, onNavigate }: { teacher: TeacherUser; onLogout: () => void; initialPath: string; onNavigate: (path: string, mode?: "quizStrike" | "teacher") => void }) {
  const initialRoute = useMemo(() => teacherRouteState(initialPath), [initialPath]);
  const [tab, setTab] = useState<TeacherTab>(initialRoute.tab);
  const [activeSetupSection, setActiveSetupSection] = useState<SetupSection>("mode");
  const [quizManagerRequest, setQuizManagerRequest] = useState<{ quizSetId?: string; mode: "create" | "edit" }>({ mode: "create" });
  const [data, setData] = useState<DashboardPayload>({ classes: [], quizSets: [], sessions: [], folders: [], reports: [] });
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null);
  const [launchQuizId, setLaunchQuizId] = useState("");
  const [borrowedStudySet, setBorrowedStudySet] = useState<QuizSet | null>(null);
  const [detailStudySetId, setDetailStudySetId] = useState<string | undefined>(initialRoute.studySetId);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [isSocketReconnecting, setIsSocketReconnecting] = useState(false);
  const [gamePreferences, setGamePreferences] = useState<GamePreferences>(() => readGamePreferences());
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const status = useAsyncMessage();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Teacher Dashboard · GyakutenEigo";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const updateGamePreferences = (update: Partial<GamePreferences>) => {
    setGamePreferences((current) => {
      const next = { ...current, ...update };
      writeGamePreferences(next);
      return next;
    });
  };

  useEffect(() => {
    gameAudio.setMuted(!gamePreferences.soundEnabled);
    gameAudio.setSfxVolume(gamePreferences.sfxVolume);
    gameAudio.setMusicVolume(gamePreferences.musicVolume);
    if (gamePreferences.soundEnabled) gameAudio.warm();
    return () => gameAudio.setMuted(false);
  }, [gamePreferences.soundEnabled, gamePreferences.sfxVolume, gamePreferences.musicVolume]);

  useEffect(() => {
    const syncBgm = () => {
      gameAudio.setBgmActive(Boolean(
        (tab === "settings" || (tab === "sessions" && selectedSession?.status === "active"))
        && selectedSession?.controlState !== "teacher_paused"
        && document.visibilityState === "visible"
      ));
    };
    syncBgm();
    document.addEventListener("visibilitychange", syncBgm);
    return () => {
      document.removeEventListener("visibilitychange", syncBgm);
      gameAudio.setBgmActive(false);
    };
  }, [tab, selectedSession?.id, selectedSession?.status, selectedSession?.controlState]);

  const refresh = useCallback(async () => {
    setIsDashboardLoading(true);
    setDashboardError("");
    try {
      const dashboardPayload = await teacherApi.dashboard();
      const payload = dashboardPayload as DashboardPayload;
      const nextData = { ...payload };
      setData(nextData);
      setSelectedSession((current) => {
        if (!current) return nextData.sessions[0] ?? null;
        return nextData.sessions.find((session) => session.id === current.id) ?? nextData.sessions[0] ?? null;
      });
      try {
        const recognitionPayload = await teacherApi.recognition();
        const recognition = (recognitionPayload as { recognition?: RecognitionSummary }).recognition;
        if (recognition) setData((current) => ({ ...current, recognition }));
      } catch (recognitionError) {
        // Recognition is additive. Older API deployments must not hide the
        // teacher's valid legacy dashboard/library payload.
        if (import.meta.env.DEV) console.warn("Recognition could not be loaded.", recognitionError);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error("Teacher dashboard could not be loaded.", err);
      setDashboardError("We couldn't load your Study Sets. Try again.");
    } finally {
      setIsDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const selectedSessionCode = selectedSession?.sessionCode;
    if (!selectedSessionCode) return;
    const teacherToken = getTeacherToken();
    if (!teacherToken) return;
    const roomJoinPayload = { code: selectedSessionCode, teacherToken };
    const socket: Socket = createMultiplayerSocket(roomJoinPayload);
    socket.on("connect", () => {
      setIsSocketReconnecting(false);
    });
    socket.on("connect_error", () => setIsSocketReconnecting(true));
    socket.on("disconnect", () => setIsSocketReconnecting(true));
    socket.on("session_state", (payload: unknown) => {
      const parsed = validateSessionSnapshot(payload);
      if (!parsed.success) return;
      const session = parsed.data;
      setIsSocketReconnecting(false);
      setSelectedSession(session);
      setData((current) => ({
        ...current,
        sessions: current.sessions.map((item) => (item.id === session.id ? session : item))
      }));
    });
    socket.on("player_state", (payload: { players?: PlayerSession[]; flag?: GameSession["flag"]; recentEvents?: GameSession["events"]; learningPulse?: GameSession["learningPulse"] }) => {
      if (!Array.isArray(payload.players)) return;
      setSelectedSession((current) => current ? {
        ...current,
        players: current.players.map((player) => payload.players?.find((next) => next.id === player.id) ?? player),
        ...(payload.flag ? { flag: payload.flag } : {}),
        ...(payload.recentEvents ? { events: payload.recentEvents } : {}),
        ...(payload.learningPulse ? { learningPulse: payload.learningPulse } : {})
      } : current);
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setIsSocketReconnecting(false);
    };
  }, [selectedSession?.sessionCode]);

  const activeSessions = data.sessions.filter((session) => session.status !== "ended");
  const availableStudySets = useMemo(
    () => borrowedStudySet && !data.quizSets.some((quiz) => quiz.id === borrowedStudySet.id)
      ? [...data.quizSets, borrowedStudySet]
      : data.quizSets,
    [borrowedStudySet, data.quizSets]
  );
  const isLiveSetup = tab === "sessions" && !selectedSession;
  useEffect(() => {
    setTab(initialRoute.tab);
    setDetailStudySetId(initialRoute.studySetId);
    if (initialRoute.studySetId && initialRoute.tab === "sessions") setLaunchQuizId(initialRoute.studySetId);
  }, [initialRoute]);
  const navigateTeacherTab = (nextTab: TeacherPrimaryTab) => {
    setTab(nextTab);
    onNavigate(teacherTabPath(nextTab), "teacher");
  };
  const openStudySet = (quizSetId: string) => {
    setDetailStudySetId(quizSetId);
    onNavigate(`/quiz-strike/teacher/sets/${encodeURIComponent(quizSetId)}`, "teacher");
  };
  const openQuizManager = (quizSetId?: string) => {
    setQuizManagerRequest(quizSetId ? { quizSetId, mode: "edit" } : { mode: "create" });
    setTab("quizzes");
    onNavigate(quizSetId ? `/quiz-strike/teacher/sets/${encodeURIComponent(quizSetId)}/edit` : "/quiz-strike/teacher/create", "teacher");
  };

  const openStudySetForGame = async (quizSetId: string) => {
    try {
      if (!data.quizSets.some((quiz) => quiz.id === quizSetId)) {
        const payload = await teacherApi.studySet(quizSetId) as { studySet?: QuizSet };
        if (!payload.studySet) throw new Error("Study Set could not be loaded.");
        setBorrowedStudySet(payload.studySet);
      } else setBorrowedStudySet(null);
      setLaunchQuizId(quizSetId);
      setSelectedSession(null);
      setActiveSetupSection("mode");
      setTab("sessions");
      onNavigate(`/quiz-strike/teacher/host/${encodeURIComponent(quizSetId)}`, "teacher");
    } catch (error) {
      status.report(error);
    }
  };

  const openGameSession = (session: GameSession) => {
    setSelectedSession(session);
    setLaunchQuizId(session.quizSetId);
    setTab("sessions");
    onNavigate(`/quiz-strike/teacher/host/${encodeURIComponent(session.quizSetId)}`, "teacher");
  };

  return (
    <TeacherShell
      teacher={teacher}
      tab={tab}
      isLiveSetup={isLiveSetup}
      activeSetupSection={activeSetupSection}
      onSetupSectionChange={setActiveSetupSection}
      onNavigateTab={navigateTeacherTab}
      onCreateStudySet={() => openQuizManager()}
      onCreateSpeakingActivity={() => onNavigate(teacherSpeakingPath("create"), "teacher")}
      onLogout={onLogout}
      activeSessions={activeSessions}
      selectedSessionId={selectedSession?.id}
      onOpenSession={openGameSession}
    >
      <StatusMessages error={status.error} message={status.message} />
      {isSocketReconnecting && (
        <p className="connection-banner">
          <WifiOff size={16} aria-hidden="true" />
          Connection paused · trying again...
        </p>
      )}

      {tab === "home" && <TeacherHome teacher={teacher} quizSets={data.quizSets} sessions={data.sessions} recognition={data.recognition} onCreate={() => openQuizManager()} onDiscover={() => navigateTeacherTab("discover")} onLibrary={() => navigateTeacherTab("library")} onReports={() => navigateTeacherTab("reports")} onHost={(quizSetId) => void openStudySetForGame(quizSetId)} onOpenSession={openGameSession} onOpenSet={openStudySet} onStartQuizStrike={() => navigateTeacherTab("library")} onStartSpeaking={() => navigateTeacherTab("speaking")} onCreateSpeaking={() => onNavigate(teacherSpeakingPath("create"), "teacher")} />}
      {tab === "quizzes" && (
        <StudySetEditor
          key={`${quizManagerRequest.mode}:${quizManagerRequest.quizSetId ?? "new"}`}
          data={data}
          onRefresh={refresh}
          initialQuizSetId={quizManagerRequest.quizSetId}
          startInCreateMode={quizManagerRequest.mode === "create"}
        />
      )}
      {tab === "discover" && <StudySetLibrary data={data} scope="public" dashboardLoading={isDashboardLoading} dashboardError={dashboardError} onRefresh={refresh} onEditQuiz={openQuizManager} onPlayLive={openStudySetForGame} onOpenStudySet={openStudySet} />}
      {tab === "library" && <StudySetLibrary data={data} scope="mine" dashboardLoading={isDashboardLoading} dashboardError={dashboardError} onRefresh={refresh} onEditQuiz={openQuizManager} onPlayLive={openStudySetForGame} onOpenStudySet={openStudySet} />}
      {tab === "detail" && detailStudySetId && <StudySetDetail studySetId={detailStudySetId} isOwner={data.quizSets.some((quiz) => quiz.id === detailStudySetId)} onBack={() => navigateTeacherTab(data.quizSets.some((quiz) => quiz.id === detailStudySetId) ? "library" : "discover")} onHost={(quizSetId) => void openStudySetForGame(quizSetId)} onEdit={openQuizManager} onCopy={async (quizSetId) => { try { await teacherApi.duplicateStudySet(quizSetId); await refresh(); navigateTeacherTab("library"); } catch (error) { status.report(error); } }} />}
      {tab === "sessions" && (
        <SessionManager
          data={data}
          availableStudySets={availableStudySets}
          selectedSession={selectedSession}
          setSelectedSession={setSelectedSession}
          onRefresh={refresh}
          onReport={setReport}
          onOpenReports={() => navigateTeacherTab("reports")}
          onBrowseStudySets={() => navigateTeacherTab("discover")}
          initialQuizSetId={launchQuizId}
          activeSetupSection={activeSetupSection}
        />
      )}
      {tab === "reports" && (
        <ReportsPanel
          sessions={data.sessions}
          quizSets={data.quizSets}
          reports={data.reports}
          report={report}
          setReport={setReport}
          setTab={setTab}
          onRefresh={refresh}
        />
      )}
      {tab === "settings" && (
        <GamePreferencesPanel
          preferences={gamePreferences}
          onChange={updateGamePreferences}
          audioOnly
        />
      )}
      {tab === "tournaments" && <Suspense fallback={<ArenaLoading label="Loading tournament center" />}><TournamentCenter teacher={teacher} quizSets={data.quizSets.map((quiz) => ({ id: quiz.id, title: quiz.title }))} /></Suspense>}
      {tab === "speaking" && (
        <Suspense fallback={<ArenaLoading label="Loading Speaking Practice" />}>
          <SpeakingTeacherWorkspace initialPath={initialPath} onNavigate={(path) => onNavigate(path, "teacher")} />
        </Suspense>
      )}
    </TeacherShell>
  );
}

function SessionManager({
  data,
  availableStudySets,
  selectedSession,
  setSelectedSession,
  onRefresh,
  onReport,
  onOpenReports,
  onBrowseStudySets,
  initialQuizSetId,
  activeSetupSection
}: {
  data: DashboardPayload;
  availableStudySets: QuizSet[];
  selectedSession: GameSession | null;
  setSelectedSession: (session: GameSession | null) => void;
  onRefresh: () => Promise<void>;
  onReport: (report: SessionReport | null) => void;
  onOpenReports: () => void;
  onBrowseStudySets: () => void;
  initialQuizSetId?: string;
  activeSetupSection: SetupSection;
}) {
  const {
    quizSetId, setQuizSetId,
    settings, setSettings,
    settingInputs, setSettingInputs,
    invalidSettings, setInvalidSettings,
    isCreatingSession, setIsCreatingSession,
    isStartingSession, setIsStartingSession,
    isEndingRound, setIsEndingRound,
    isEndingSession, setIsEndingSession,
    isAddingBot, setIsAddingBot,
    removingPlayerId, setRemovingPlayerId,
    botCount, setBotCount,
    botDifficulty, setBotDifficulty,
    isJoinLinkCopied, setIsJoinLinkCopied,
    isEndConfirmOpen, setIsEndConfirmOpen,
    isProjectorOpen, setIsProjectorOpen
  } = useSessionControls({ initialQuizSetId, firstQuizSetId: availableStudySets[0]?.id });
  const [isChangingPause, setIsChangingPause] = useState(false);
  const [isTeacherSpectatorOpen, setIsTeacherSpectatorOpen] = useState(false);
  const [teacherSpectatorPlayerId, setTeacherSpectatorPlayerId] = useState("");
  const [isTeacherSpectatorPickerOpen, setIsTeacherSpectatorPickerOpen] = useState(false);
  const endSessionTriggerRef = useRef<HTMLButtonElement>(null);
  const endSessionDialogRef = useRef<HTMLDivElement>(null);
  const keepSessionOpenRef = useRef<HTMLButtonElement>(null);
  const projectorDialogRef = useRef<HTMLElement>(null);
  const projectorCloseRef = useRef<HTMLButtonElement>(null);
  const teacherSpectatorDialogRef = useRef<HTMLElement>(null);
  const teacherSpectatorCloseRef = useRef<HTMLButtonElement>(null);
  const teacherSpectatorPickerRef = useRef<HTMLDivElement>(null);
  const status = useAsyncMessage();
  const remainingSeconds = useRoundRemaining(selectedSession);
  const selectedMap = getArenaMap(settings.mapId);
  const selectedAthleticsMode = settings.athleticsMode ?? "classic";
  const selectedAthleticsModeConfig = ATHLETICS_MODE_CONFIG[selectedAthleticsMode];
  const selectedQuiz = availableStudySets.find((quiz) => quiz.id === quizSetId);
  const sessionQuiz = selectedSession
    ? availableStudySets.find((quiz) => quiz.id === selectedSession.quizSetId)
    : undefined;
  const displayedPresetName = "Classroom game";
  const studentJoinLink = selectedSession
    ? buildStudentJoinUrl(window.location.origin, selectedSession.sessionCode)
    : "";
  const isLocalOnlyJoinLink = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const hasSelectedSession = Boolean(selectedSession);
  const selectedSessionBotDifficulty = selectedSession?.settings.botDifficulty;
  const selectedSessionCode = selectedSession?.sessionCode;
  const teacherSpectatorPlayers = useMemo(
    () => selectedSession?.players
      .filter((player) => !player.isBot && player.isAlive && player.connectionState !== "disconnected")
      .sort((a, b) => a.nickname.localeCompare(b.nickname)) ?? [],
    [selectedSession]
  );
  const teacherSpectatorPlayer = teacherSpectatorPlayers.find((player) => player.id === teacherSpectatorPlayerId)
    ?? teacherSpectatorPlayers[0];

  useEffect(() => {
    if (!quizSetId && availableStudySets[0]) setQuizSetId(availableStudySets[0].id);
  }, [availableStudySets, quizSetId, setQuizSetId]);

  useEffect(() => {
    if (hasSelectedSession || !initialQuizSetId || !availableStudySets.some((quiz) => quiz.id === initialQuizSetId)) return;
    setQuizSetId(initialQuizSetId);
  }, [availableStudySets, hasSelectedSession, initialQuizSetId, setQuizSetId]);

  useEffect(() => {
    if (!hasSelectedSession) return;
    setBotDifficulty(selectedSessionBotDifficulty ?? DEFAULT_SESSION_SETTINGS.botDifficulty);
  }, [hasSelectedSession, selectedSessionBotDifficulty, setBotDifficulty]);

  useEffect(() => {
    if (!isEndConfirmOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => keepSessionOpenRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsEndConfirmOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        endSessionDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isEndConfirmOpen, setIsEndConfirmOpen]);

  useEffect(() => {
    if (!isProjectorOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => projectorCloseRef.current?.focus(), 0);
    const handleProjectorKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProjectorOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        projectorDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleProjectorKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleProjectorKeys);
      previousFocus?.focus();
    };
  }, [isProjectorOpen, setIsProjectorOpen]);

  useEffect(() => {
    if (!teacherSpectatorPlayers.length) {
      setTeacherSpectatorPlayerId("");
      return;
    }
    if (!teacherSpectatorPlayers.some((player) => player.id === teacherSpectatorPlayerId)) {
      setTeacherSpectatorPlayerId(teacherSpectatorPlayers[0].id);
    }
  }, [teacherSpectatorPlayerId, teacherSpectatorPlayers]);

  useEffect(() => {
    if (selectedSession?.status === "active" || selectedSession?.status === "paused") return;
    setIsTeacherSpectatorOpen(false);
    setIsTeacherSpectatorPickerOpen(false);
  }, [selectedSession?.status]);

  useEffect(() => {
    if (!isTeacherSpectatorOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => teacherSpectatorCloseRef.current?.focus(), 0);

    const handleSpectatorKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isTeacherSpectatorPickerOpen) {
          setIsTeacherSpectatorPickerOpen(false);
          return;
        }
        setIsTeacherSpectatorOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        teacherSpectatorDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleSpectatorKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleSpectatorKeys);
      previousFocus?.focus();
    };
  }, [isTeacherSpectatorOpen, isTeacherSpectatorPickerOpen]);

  useEffect(() => {
    if (!isTeacherSpectatorPickerOpen) return;
    const closePicker = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && teacherSpectatorPickerRef.current?.contains(target)) return;
      setIsTeacherSpectatorPickerOpen(false);
    };
    document.addEventListener("pointerdown", closePicker);
    return () => document.removeEventListener("pointerdown", closePicker);
  }, [isTeacherSpectatorPickerOpen]);

  const hasInvalidSettings = Object.values(invalidSettings).some(Boolean);

  const updateNumberSetting = (field: SessionNumberField, rawValue: string) => {
    setSettingInputs((current) => ({ ...current, [field]: rawValue }));
    const fieldConfig = sessionNumberFields.find((item) => item.name === field);
    const trimmedValue = rawValue.trim();
    if (field === "initialZombieCount" && !trimmedValue) {
      setInvalidSettings((current) => ({ ...current, [field]: false }));
      setSettings((current) => ({ ...current, initialZombieCount: undefined }));
      return;
    }
    const numericValue = Number(trimmedValue);
    if (
      !trimmedValue ||
      Number.isNaN(numericValue) ||
      !Number.isInteger(numericValue) ||
      (fieldConfig ? numericValue < fieldConfig.min || numericValue > fieldConfig.max : false)
    ) {
      setInvalidSettings((current) => ({ ...current, [field]: true }));
      setSettings((current) =>
        Number.isFinite(current[field]) ? current : { ...current, [field]: 0 }
      );
      return;
    }

    setInvalidSettings((current) => ({ ...current, [field]: false }));
    setSettings((current) => ({ ...current, [field]: numericValue }));
  };

  const createSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCreatingSession || hasInvalidSettings) return;
    status.clear();
    setIsCreatingSession(true);
    try {
      const payload = (await teacherApi.createSession({
        quizSetId,
        settings
      })) as { session: GameSession };
      setSelectedSession(payload.session);
      await onRefresh();
      status.setMessage(`Game room ${payload.session.sessionCode} is ready. Share the code with your class.`);
    } catch (err) {
      status.report(err);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const start = async () => {
    if (!selectedSession || isStartingSession) return;
    const startCheck = canStartRound(selectedSession);
    if (!startCheck.ok) {
      status.setError(
        startCheck.reason === "session_ended"
          ? "This game has ended."
          : selectedSession.players.some((player) => player.isBot)
            ? "Test players are ready. Add at least one student to begin."
            : "Add at least one student to begin."
      );
      return;
    }
    status.clear();
    setIsStartingSession(true);
    try {
      const payload = (await teacherApi.startSession(selectedSession.sessionCode)) as { session: GameSession };
      setSelectedSession(payload.session);
      setIsProjectorOpen(false);
      await onRefresh();
      status.setMessage("The round is live.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setSelectedSession(null);
        await onRefresh();
        status.setError("This local room expired when the game server restarted. Create a new room, then have players join with its new code.");
      } else {
        status.report(err);
      }
    } finally {
      setIsStartingSession(false);
    }
  };

  const end = async () => {
    if (!selectedSession || isEndingSession) return;
    setIsEndConfirmOpen(false);
    status.clear();
    setIsEndingSession(true);
    try {
      const payload = (await teacherApi.endSession(selectedSession.sessionCode)) as { report: SessionReport };
      onReport(payload.report);
      setSelectedSession(payload.report.session);
      await onRefresh();
      status.setMessage("Game finished. Your learning report is ready.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsEndingSession(false);
    }
  };

  const topLearner = selectedSession ? getTopLearner(selectedSession.players, selectedSession.settings.gameMode) : undefined;
  const teamTotals = selectedSession ? getTeamTotals(selectedSession.players) : { blue: 0, red: 0 };
  const zombieCounts = selectedSession ? getZombieCounts(selectedSession.players) : { humans: 0, zombies: 0 };
  const activePlayers = selectedSession?.players.filter((player) => player.connectionState !== "disconnected" && player.isAlive).length ?? 0;
  const learnerPlayers = selectedSession?.players.filter((player) => !player.isBot) ?? [];
  const botPlayers = selectedSession?.players.filter((player) => player.isBot) ?? [];
  const activeLearners = learnerPlayers.filter((player) => player.connectionState !== "disconnected" && player.isAlive).length;
  const startCheck = selectedSession ? canStartRound(selectedSession) : undefined;
  const startBlockedReason =
    startCheck && !startCheck.ok
      ? startCheck.reason === "session_ended"
        ? "This game has ended."
        : botPlayers.length > 0
          ? "Test players are ready. Add at least one student to begin."
          : "Add at least one student to begin."
      : "";
  const shouldShowSetup = !selectedSession;
  const isSessionEnded = selectedSession?.status === "ended";
  const visibleNumberFields = sessionNumberFields.filter((field) => {
    if (settings.gameMode === "flag") return field.name !== "initialZombieCount";
    if (settings.gameMode === "zombie") return field.name !== "roundCount" && field.name !== "flagHoldSeconds";
    if (settings.gameMode === "athletics") return field.name === "athleticsCourseLaps" || field.name === "roundDurationSeconds" || field.name === "maxPlayers";
    return field.name !== "flagHoldSeconds" && field.name !== "initialZombieCount";
  });

  const availableBotSlots = selectedSession ? Math.max(0, selectedSession.maxPlayers - selectedSession.players.length) : 0;

  const addBots = async () => {
    if (!selectedSession || isAddingBot || availableBotSlots <= 0) return;
    const count = Math.max(1, Math.min(availableBotSlots, Math.floor(botCount)));
    status.clear();
    setIsAddingBot(true);
    try {
      const payload = (await teacherApi.addBots(selectedSession.sessionCode, { count, difficulty: botDifficulty })) as { session: GameSession; bots: PlayerSession[] };
      setSelectedSession(payload.session);
      await onRefresh();
      status.setMessage(`${payload.bots.length} ${botDifficulty} test player${payload.bots.length === 1 ? "" : "s"} added.`);
    } catch (err) {
      status.report(err);
    } finally {
      setIsAddingBot(false);
    }
  };

  const endRound = async () => {
    if (!selectedSession || selectedSession.status !== "active" || selectedSession.settings.gameMode === "zombie" || selectedSession.settings.gameMode === "athletics" || isEndingRound) return;
    if (!window.confirm("Finish this round early? The room will stay open and the next round will prepare.")) return;
    status.clear();
    setIsEndingRound(true);
    try {
      const payload = (await teacherApi.endRound(selectedSession.sessionCode)) as {
        session: GameSession;
        report?: SessionReport;
      };
      setSelectedSession(payload.session);
      if (payload.report) onReport(payload.report);
      await onRefresh();
      status.setMessage(payload.session.status === "ended"
        ? "Final round finished. The learning report is ready."
        : "Round finished. The next round will prepare shortly.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsEndingRound(false);
    }
  };

  const toggleTeacherPause = async () => {
    if (!selectedSession || selectedSession.status === "waiting" || selectedSession.status === "ended" || isChangingPause) return;
    status.clear();
    setIsChangingPause(true);
    const paused = selectedSession.controlState === "teacher_paused";
    try {
      const payload = (await (paused
        ? teacherApi.resumeSession(selectedSession.sessionCode)
        : teacherApi.pauseSession(selectedSession.sessionCode))) as { session: GameSession };
      setSelectedSession(payload.session);
      await onRefresh();
      status.setMessage(paused ? "Game resumed. The match is live again." : "Game paused. Students can listen now.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsChangingPause(false);
    }
  };

  const removePlayer = async (playerId: string) => {
    if (!selectedSession || removingPlayerId) return;
    const player = selectedSession.players.find((candidate) => candidate.id === playerId);
    if (!player) return;
    const confirmed = window.confirm(
      `Remove ${player.nickname} from this game? They can join again with a new name.`
    );
    if (!confirmed) return;

    status.clear();
    setRemovingPlayerId(playerId);
    try {
      const payload = await teacherApi.removePlayer(selectedSession.sessionCode, playerId) as { session: GameSession };
      setSelectedSession(payload.session);
      await onRefresh();
      status.setMessage(`${player.nickname} was removed from the game.`);
    } catch (err) {
      status.report(err);
    } finally {
      setRemovingPlayerId(null);
    }
  };

  const updateLiveCustomization = async (next: CharacterCustomizationSettings) => {
    if (!selectedSession) return;
    status.clear();
    try {
      const payload = await teacherApi.updateCustomization(selectedSession.sessionCode, next) as { session: GameSession };
      setSelectedSession(payload.session);
      status.setMessage("Player style settings updated.");
    } catch (err) {
      status.report(err);
    }
  };

  const clearPlayerAppearance = async (playerId: string) => {
    if (!selectedSession) return;
    try {
      const payload = await teacherApi.clearPlayerAppearance(selectedSession.sessionCode, playerId) as { session: GameSession };
      setSelectedSession(payload.session);
      status.setMessage("Player style reset.");
    } catch (err) {
      status.report(err);
    }
  };

  const resetAllAppearances = async () => {
    if (!selectedSession) return;
    try {
      const payload = await teacherApi.resetAppearances(selectedSession.sessionCode) as { session: GameSession };
      setSelectedSession(payload.session);
      status.setMessage("All player styles reset.");
    } catch (err) {
      status.report(err);
    }
  };

  const removePlayerDecal = async (playerId: string) => {
    if (!selectedSession) return;
    try {
      const payload = await teacherApi.removePlayerDecal(selectedSession.sessionCode, playerId) as { session: GameSession };
      setSelectedSession(payload.session);
      status.setMessage("Player sticker removed.");
    } catch (err) {
      status.report(err);
    }
  };

  const removeDecalAsset = async (assetId: string) => {
    if (!selectedSession) return;
    const payload = await teacherApi.removeDecalAsset(selectedSession.sessionCode, assetId) as { session: GameSession };
    setSelectedSession(payload.session);
    status.setMessage("Sticker removed from this game.");
  };

  const loadTeacherDecal = useCallback(
    (assetId: string) => selectedSessionCode
      ? fetchDecalAsset(selectedSessionCode, assetId)
      : Promise.reject(new Error("There is no active game room.")),
    [selectedSessionCode]
  );

  const copyStudentJoinLink = async () => {
    if (!studentJoinLink) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(studentJoinLink);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = studentJoinLink;
        textArea.setAttribute("readonly", "true");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("Copy was not available.");
      }
      setIsJoinLinkCopied(true);
      window.setTimeout(() => setIsJoinLinkCopied(false), 2200);
      status.setMessage("Join link copied. Share it with your class.");
    } catch {
      status.setError("We couldn’t copy the link. Select it and copy it manually.");
    }
  };

  const cycleTeacherSpectator = (direction: -1 | 1) => {
    if (!teacherSpectatorPlayers.length) return;
    setTeacherSpectatorPlayerId((currentId) => {
      const currentIndex = Math.max(0, teacherSpectatorPlayers.findIndex((player) => player.id === currentId));
      const nextIndex = (currentIndex + direction + teacherSpectatorPlayers.length) % teacherSpectatorPlayers.length;
      return teacherSpectatorPlayers[nextIndex].id;
    });
  };

  return (
    <div className={shouldShowSetup ? "two-column session-grid" : "session-grid live-first-grid"}>
      <form className={shouldShowSetup ? "panel form-panel live-game-setup" : "panel form-panel session-setup-minimized"} onSubmit={createSession}>
        {shouldShowSetup ? (
          <>
            <header className="setup-flow-header">
              <div className="setup-flow-title">
                <h2>Choose a game mode</h2>
              </div>
              <div className="setup-quiz-summary">
                <BookOpen size={22} aria-hidden="true" />
                <strong>{selectedQuiz?.title ?? "Choose a question set"}</strong>
                <small>{selectedQuiz?.questions.length ?? 0} questions</small>
              </div>
            </header>

            {initialQuizSetId && selectedQuiz ? <section className="setup-study-set-lock" aria-labelledby="study-set-lock-title">
              <div><span className="eyebrow">Study Set</span><h3 id="study-set-lock-title">{selectedQuiz.title}</h3><p>{selectedQuiz.questions.length} questions · ready to host</p></div>
              <span className="study-set-lock-note">Selected from your content library</span>
            </section> : <section className="setup-study-set-picker" aria-labelledby="study-set-picker-title">
              <div>
                <span className="eyebrow">Study Set</span>
                <h3 id="study-set-picker-title">Choose what your class will practice</h3>
                <p>Use one of your sets or browse the public library for a ready-to-play set.</p>
              </div>
              <div className="setup-study-set-controls">
                <label htmlFor="session-study-set">Question set</label>
                <select
                  id="session-study-set"
                  value={quizSetId}
                  onChange={(event) => setQuizSetId(event.target.value)}
                  disabled={hasSelectedSession || availableStudySets.length === 0}
                >
                  <option value="">Choose a question set</option>
                  {availableStudySets.map((quiz) => (
                    <option key={quiz.id} value={quiz.id}>{quiz.title} ({quiz.questions.length} questions){data.quizSets.some((owned) => owned.id === quiz.id) ? "" : " · Public Library"}</option>
                  ))}
                </select>
                <button type="button" className="secondary setup-study-set-browse" onClick={onBrowseStudySets} disabled={hasSelectedSession}>
                  <Globe2 size={17} aria-hidden="true" />
                  Browse Study Sets
                </button>
              </div>
            </section>}

            {activeSetupSection === "mode" && (
              <section className="setup-choice-section setup-panel-section mode-choice-section" aria-labelledby="mode-title">
              <div className="setup-panel-heading"><h3 id="mode-title">Choose the game</h3><span>Pick a mode to continue</span></div>
                <div className="mode-choice-grid" aria-label="Game modes">
                  {([
                    { id: "zombie", title: "Zombie Survival", description: "Answer for energy, stay alive, and keep the team moving.", icon: <img src="/assets/zombie/zombie-head.png" alt="" /> },
                    { id: "classic", title: "Team Tag", description: "Answer questions, move through the arena, and tag the other team.", icon: <img src="/assets/mode-icons/tag.png" alt="" /> },
                    { id: "flag", title: "Capture the Flag", description: "Answer to earn an advantage, then capture the flag as a team.", icon: <img src="/assets/mode-icons/flag.png" alt="" /> },
                    { id: "athletics", title: "Athletics Race", description: "Jump through a vertical amusement park. Answer anytime to refill movement energy.", icon: <Footprints className="mode-choice-icon-athletics" size={22} aria-hidden="true" /> }
                  ] as const).map((mode) => {
                    const selected = settings.gameMode === mode.id;
                    return (
                      <button
                        type="button"
                        key={mode.id}
                        className={`mode-choice mode-${mode.id}${selected ? " selected" : ""}`}
                        aria-label={`${mode.title}: ${mode.description}`}
                        aria-pressed={selected}
                        onClick={() => {
                          const switchingToAthletics = mode.id === "athletics" && settings.gameMode !== "athletics";
                          setSettings({
                            ...settings,
                            gameMode: mode.id,
                            mapId: mode.id === "athletics"
                              ? ATHLETICS_ARENA_MAP_ID
                              : settings.mapId === ATHLETICS_ARENA_MAP_ID
                                ? "desert_citadel"
                                : settings.mapId,
                            roundDurationSeconds: switchingToAthletics
                              ? ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS
                              : settings.roundDurationSeconds
                          });
                          if (switchingToAthletics) {
                            setSettingInputs((current) => ({ ...current, roundDurationSeconds: String(ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS) }));
                            setInvalidSettings((current) => ({ ...current, roundDurationSeconds: false }));
                          }
                        }}
                      >
                        <span className="mode-choice-art" aria-hidden="true">{mode.icon}</span>
                        <strong>{mode.title}</strong>
                        {selected && <span className="mode-choice-check" aria-hidden="true"><Check size={18} /></span>}
                      </button>
                    );
                  })}
                </div>
                {settings.gameMode === "athletics" && (
                  <div className="athletics-mode-picker" aria-label="Athletics modes">
                    <div className="athletics-mode-picker-heading">
                      <div><span className="eyebrow">Athletics variant</span><strong>Choose how the climb plays</strong></div>
                      <small>Classic keeps the original race rules.</small>
                    </div>
                    <div className="athletics-mode-grid">
                      {ATHLETICS_MODES.map((modeId) => {
                        const mode = ATHLETICS_MODE_CONFIG[modeId];
                        const selectedAthletics = selectedAthleticsMode === modeId;
                        return (
                          <button
                            type="button"
                            key={modeId}
                            className={`athletics-mode-choice athletics-mode-choice-${modeId}${selectedAthletics ? " selected" : ""}`}
                            aria-label={`${mode.label}: ${mode.description}`}
                            aria-pressed={selectedAthletics}
                            onClick={() => setSettings({ ...settings, athleticsMode: modeId })}
                          >
                            <span className="athletics-mode-choice-top"><strong>{mode.shortLabel}</strong>{selectedAthletics && <Check size={16} aria-hidden="true" />}</span>
                            <small>{mode.description}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeSetupSection === "arena" && (
              <section className="setup-choice-section setup-panel-section" aria-labelledby="arena-title">
              <div className="setup-panel-heading"><h3 id="arena-title">Game options</h3><span>{settings.gameMode === "athletics" ? "Course and race rules" : "Map and team rules"}</span></div>
                {settings.gameMode === "athletics" ? (
                  <div className="athletics-course-card">
                    <div className="athletics-course-card-heading">
                      <div><span className="eyebrow">Selected course</span><h4>{ATHLETICS_STADIUM_COURSE.title}</h4><p>{ATHLETICS_STADIUM_COURSE.subtitle}</p></div>
                      <span className="athletics-course-badge">{ATHLETICS_STADIUM_COURSE.sections.length} chapters · {ATHLETICS_STADIUM_COURSE.checkpoints.length} checkpoints · {ATHLETICS_STADIUM_COURSE.shortcuts.length} shortcuts</span>
                    </div>
                    <div className={`athletics-mode-brief athletics-mode-${selectedAthleticsMode}`}>
                      <div><span className="eyebrow">{selectedAthleticsModeConfig.label}</span><strong>{selectedAthleticsModeConfig.description}</strong></div>
                      <ul>{selectedAthleticsModeConfig.instructionLines.map((line) => <li key={line}>{line}</li>)}</ul>
                    </div>
                    <div className="athletics-course-sections" aria-label="Skyline Adventure Park chapters">
                      {ATHLETICS_STADIUM_COURSE.sections.map((section, index) => (
                        <div key={section.id} className={`athletics-course-section athletics-accent-${section.accent}`}>
                          <span>{String(index + 1).padStart(2, "0")}</span><strong>{section.label}</strong><small>{section.description}</small>
                        </div>
                      ))}
                    </div>
                    <p className="athletics-course-note"><Trophy size={15} aria-hidden="true" />Correct answers refill movement energy. Wrong answers cost no energy; a fall returns the runner to their last safe checkpoint.</p>
                  </div>
                ) : <div className="arena-choice-grid">
                  {ARENA_MAPS.map((map) => {
                    const selected = settings.mapId === map.id;
                    const displayTitle = arenaMapDisplayTitle(map.title);
                    return (
                      <button
                        type="button"
                        key={map.id}
                        className={`arena-choice map-${map.id}${selected ? " selected" : ""}`}
                        aria-label={`${displayTitle}: ${map.districts.slice(0, 2).join(" · ")}`}
                        aria-pressed={selected}
                        onClick={() => setSettings({ ...settings, mapId: map.id })}
                      >
                        <img
                          className="arena-choice-image"
                          src={ARENA_MAP_PREVIEW_ASSETS[map.id]}
                          alt={`Top-down preview of ${displayTitle}`}
                          loading="lazy"
                        />
                        <span className="arena-choice-title"><strong>{displayTitle}</strong></span>
                        {selected && <Check className="arena-selected-check" size={20} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>}
                {(settings.gameMode === "flag" || settings.gameMode === "zombie") && (
                  <div className="arena-rules-panel">
                    <div className="arena-rules-heading"><h4>Game rules</h4><span>{gameModeLabel(settings.gameMode)}</span></div>
                    <div className="arena-rules-grid">
                      {settings.gameMode === "flag" && (
                        <label>
                          <span>How teams are chosen</span>
                          <select
                            value={settings.teamAssignment}
                            onChange={(event) => setSettings({ ...settings, teamAssignment: event.target.value as SessionSettings["teamAssignment"] })}
                          >
                            <option value="players_choose">Students choose</option>
                            <option value="random">Assign randomly</option>
                          </select>
                        </label>
                      )}
                      {(["flagHoldSeconds", "initialZombieCount"] as const).map((name) => {
                        const field = sessionNumberFields.find((item) => item.name === name);
                        if (!field || !visibleNumberFields.some((item) => item.name === field.name)) return null;
                        const errorId = `session-setting-${field.name}-error`;
                        const unit = "unit" in field ? field.unit : undefined;
                        return (
                          <label key={field.name} title={field.help}>
                            <span>{field.label}{unit ? ` (${unit})` : ""}</span>
                            <input
                              type="number"
                              min={field.min}
                              max={field.max}
                              step={"step" in field ? field.step : undefined}
                              inputMode="numeric"
                              value={settingInputs[field.name]}
                              aria-invalid={invalidSettings[field.name] ? "true" : undefined}
                              aria-describedby={invalidSettings[field.name] ? errorId : undefined}
                              onChange={(event) => updateNumberSetting(field.name, event.target.value)}
                            />
                            {invalidSettings[field.name] && <small id={errorId} className="field-error" role="alert">Use {field.min}–{field.max}{unit ? ` ${unit}` : ""}.</small>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeSetupSection === "advanced" && (
              <section className="setup-choice-section setup-panel-section setup-advanced-section" aria-labelledby="advanced-title">
              <div className="setup-panel-heading"><h3 id="advanced-title">Advanced settings</h3><span>Optional</span></div>
                <div className="advanced-settings-content">
                {sessionSettingGroups.map((group) => {
                  const fields = group.fields
                    .map((name) => sessionNumberFields.find((field) => field.name === name))
                    .filter((field): field is (typeof sessionNumberFields)[number] => Boolean(field && visibleNumberFields.includes(field)));
                  if (fields.length === 0) return null;
                  return (
                    <fieldset key={group.title}>
                      <legend>{group.title}</legend>
                      <div className="session-setting-grid">
                        {fields.map((field) => {
                          const errorId = `session-setting-${field.name}-error`;
                          const unit = "unit" in field ? field.unit : undefined;
                          return (
                            <label key={field.name} title={field.help}>
                              <span>{field.label}{unit ? ` (${unit})` : ""}</span>
                              {field.name === "athleticsCourseLaps" ? (
                                <div className="course-laps-setting">
                                  <div className="course-laps-stepper">
                                    <button type="button" aria-label="Decrease course laps" disabled={(settings.athleticsCourseLaps ?? 1) <= field.min} onClick={() => updateNumberSetting(field.name, String(Math.max(field.min, (settings.athleticsCourseLaps ?? 1) - 1)))}><Minus size={17} aria-hidden="true" /></button>
                                    <input type="number" min={field.min} max={field.max} step={1} inputMode="numeric" value={settingInputs[field.name]} aria-invalid={invalidSettings[field.name] ? "true" : undefined} aria-describedby={errorId} onChange={(event) => updateNumberSetting(field.name, event.target.value)} />
                                    <button type="button" aria-label="Increase course laps" disabled={(settings.athleticsCourseLaps ?? 1) >= field.max} onClick={() => updateNumberSetting(field.name, String(Math.min(field.max, (settings.athleticsCourseLaps ?? 1) + 1)))}><Plus size={17} aria-hidden="true" /></button>
                                  </div>
                                  <small id={errorId} role={invalidSettings[field.name] ? "alert" : undefined} className={invalidSettings[field.name] ? "field-error" : "session-setting-help"}>{invalidSettings[field.name] ? `Use ${field.min}–${field.max}.` : `Students must complete the course ${settings.athleticsCourseLaps ?? 1} ${(settings.athleticsCourseLaps ?? 1) === 1 ? "time" : "times"}.`}</small>
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  min={field.min}
                                  max={field.max}
                                  step={"step" in field ? field.step : undefined}
                                  inputMode="numeric"
                                  value={settingInputs[field.name]}
                                  aria-invalid={invalidSettings[field.name] ? "true" : undefined}
                                  aria-describedby={invalidSettings[field.name] ? errorId : undefined}
                                  onChange={(event) => updateNumberSetting(field.name, event.target.value)}
                                />
                              )}
                              {field.name !== "athleticsCourseLaps" && invalidSettings[field.name] && <small id={errorId} className="field-error" role="alert">Use {field.min}–{field.max}{unit ? ` ${unit}` : ""}.</small>}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}

                <fieldset>
                  <legend>Make the game welcoming</legend>
                  {settings.gameMode !== "athletics" && <label className="toggle-row"><input type="checkbox" checked={settings.deadPlayersCanPractice} onChange={(event) => setSettings({ ...settings, deadPlayersCanPractice: event.target.checked })} />Let students practice while out</label>}
                  {settings.gameMode !== "athletics" && <label className="toggle-row"><input type="checkbox" checked={settings.deadPlayersEarnMoney} onChange={(event) => setSettings({ ...settings, deadPlayersEarnMoney: event.target.checked })} />Keep rewards going while out</label>}
                  <label className="toggle-row"><input type="checkbox" checked={settings.characterCustomization.enabled} onChange={(event) => setSettings({ ...settings, characterCustomization: { ...settings.characterCustomization, enabled: event.target.checked } })} />Let students style their players</label>
                  <label className="toggle-row"><input type="checkbox" checked={settings.characterCustomization.uploadsEnabled} disabled={!settings.characterCustomization.enabled} onChange={(event) => setSettings({ ...settings, characterCustomization: { ...settings.characterCustomization, uploadsEnabled: event.target.checked } })} />Allow student stickers</label>
                  <label className="toggle-row"><input type="checkbox" checked={settings.characterCustomization.persistAcrossSessions} disabled={!settings.characterCustomization.enabled} onChange={(event) => setSettings({ ...settings, characterCustomization: { ...settings.characterCustomization, persistAcrossSessions: event.target.checked } })} />Remember player choices</label>
                </fieldset>
                </div>
              </section>
            )}

            {hasInvalidSettings && <p className="error-text">Check the highlighted settings before creating the game.</p>}
            <div className="setup-create-bar">
              <span><strong>Ready to create</strong><small>{settings.gameMode === "athletics" ? ATHLETICS_STADIUM_COURSE.title : selectedMap.title} · {settings.gameMode === "athletics" ? selectedAthleticsModeConfig.label : gameModeLabel(settings.gameMode)} · your settings are saved with this room</small></span>
              <button className="primary create-game-button" type="submit" disabled={!quizSetId || hasInvalidSettings || isCreatingSession}>
                <Play size={20} aria-hidden="true" />
                {isCreatingSession ? "Creating lobby..." : "Continue to Lobby"}
              </button>
            </div>
            <StatusMessages error={status.error} message={status.message} />
          </>
        ) : (
          <p className="setup-lock-note">This room is live. Use the controls beside it to keep the game moving.</p>
        )}
      </form>

      <div className={`panel live-session${selectedSession ? "" : " empty-live-session"}${selectedSession?.status === "waiting" ? " waiting-room-panel" : ""}`}>
        {selectedSession && <GameAnnouncementOverlay announcement={selectedSession.announcement} serverTime={selectedSession.serverTime} />}
        {selectedSession ? isSessionEnded ? (
          <div className="session-ended-summary">
            <span className="status-pill status-ended">Game complete</span>
            <h3>{sessionGameModeLabel(selectedSession)} has ended</h3>
            <p>The room is closed. Students can view their summary, and the full class learning report is ready.</p>
            <dl>
              <div><dt>Final learners</dt><dd>{learnerPlayers.length}</dd></div>
              <div><dt>Test bots</dt><dd>{botPlayers.length}</dd></div>
              <div><dt>Final outcome</dt><dd>{getModeScoreSummary(selectedSession)}</dd></div>
              <div><dt>Top learner</dt><dd>{topLearner?.nickname ?? "No answers recorded"}</dd></div>
            </dl>
            {selectedSession.settings.gameMode === "athletics" && (
              <section className="athletics-teacher-results" aria-label="Athletics race results">
                <div className="athletics-teacher-results-heading"><Trophy size={18} aria-hidden="true" /><strong>Skyline Adventure Park finishers</strong></div>
                <ol>
                  {resolveAthleticsStandings(selectedSession.players).slice(0, 3).map((standing) => {
                    const racer = selectedSession.players.find((player) => player.id === standing.playerId);
                    const requiredLaps = selectedSession.athletics?.requiredLaps ?? selectedSession.settings.athleticsCourseLaps ?? 1;
                    return racer ? <li key={racer.id}><span>#{standing.rank}</span><strong>{racer.nickname}</strong><small>{standing.completedLaps}/{requiredLaps} {requiredLaps === 1 ? "lap" : "laps"} · {standing.status === "finished" && racer.athletics?.finishTimeMs !== undefined ? formatDuration(racer.athletics.finishTimeMs / 1000) : standing.status.toUpperCase()}</small></li> : null;
                  })}
                </ol>
              </section>
            )}
            <div className="button-row">
              <button className="primary teacher-report-button" onClick={onOpenReports}><Download size={18} aria-hidden="true" />See the learning report</button>
              <button onClick={() => setSelectedSession(null)}>Start another game</button>
            </div>
          </div>
        ) : selectedSession.status === "waiting" ? (
          <div className="teacher-waiting-room">
            <header className="waiting-room-header">
              <div>
                <span className="flow-step">Lobby · Invite students</span>
                <h2>{sessionQuiz?.title ?? "Live Game"}</h2>
                <p>{selectedSession.settings.gameMode === "athletics" ? ATHLETICS_STADIUM_COURSE.title : arenaMapLabel(selectedSession.settings.mapId)} · {displayedPresetName} · {selectedSession.settings.gameMode === "athletics" ? `${selectedSession.settings.athleticsCourseLaps ?? 1} ${(selectedSession.settings.athleticsCourseLaps ?? 1) === 1 ? "Lap" : "Laps"}` : `${selectedSession.settings.roundCount} Rounds`} · {formatDuration(selectedSession.settings.roundDurationSeconds)} time limit</p>
              </div>
                    <div className="waiting-header-actions">
                <details className="waiting-settings-summary">
                  <summary>View game details</summary>
                  <dl>
                    <div><dt>Mode</dt><dd>{sessionGameModeLabel(selectedSession)}</dd></div>
                    <div><dt>{selectedSession.settings.gameMode === "athletics" ? "Course" : "Teams"}</dt><dd>{selectedSession.settings.gameMode === "athletics" ? ATHLETICS_STADIUM_COURSE.title : selectedSession.settings.teamAssignment === "players_choose" ? "Players Choose" : "Random Teams"}</dd></div>
                    <div><dt>Players</dt><dd>Up to {selectedSession.maxPlayers}</dd></div>
                  </dl>
                </details>
                <button type="button" className="projector-button" onClick={() => setIsProjectorOpen(true)}>
                  <Eye size={18} aria-hidden="true" />
                  Projector View
                </button>
                <button ref={endSessionTriggerRef} className="text-button danger-text" onClick={() => setIsEndConfirmOpen(true)} disabled={isEndingSession}>End game</button>
              </div>
            </header>

            <section className="invite-students-panel" aria-labelledby="join-game-title">
              <div className="invite-code-block">
                <span id="join-game-title">Invite students</span>
                <strong>{selectedSession.sessionCode}</strong>
                <small>Enter this code at {new URL(studentJoinLink).host}/join</small>
              </div>
              <div className="invite-link-grid">
                <div className="invite-link-copy">
                  <span><Link2 size={17} aria-hidden="true" />Student Join Link</span>
                  <p>{studentJoinLink.replace(/^https?:\/\//, "")}</p>
                  <button type="button" onClick={copyStudentJoinLink} aria-label="Copy student join link" aria-live="polite">
                    {isJoinLinkCopied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                    {isJoinLinkCopied ? "✓ Link copied" : "Copy join link"}
                  </button>
                </div>
                <div className="invite-qr">
                  <QRCodeSVG
                    value={studentJoinLink}
                    size={220}
                    level="M"
                    marginSize={2}
                    title={`Join QuizStrike game ${selectedSession.sessionCode}`}
                  />
                  <span>Scan to join</span>
                </div>
              </div>
            </section>

            {isLocalOnlyJoinLink && (
              <p className="network-share-warning" role="status">
                This preview link works only on this computer. Use the classroom Wi-Fi address before sharing with students.
              </p>
            )}

            <section className="waiting-student-roster" aria-labelledby="students-title" aria-live="polite">
              <header>
                <div><h3 id="students-title">Students</h3><span>{learnerPlayers.length} / {selectedSession.maxPlayers} joined</span></div>
                {botPlayers.length > 0 && <small>{botPlayers.length} bot{botPlayers.length === 1 ? "" : "s"} added</small>}
              </header>
              {learnerPlayers.length > 0 ? (
                <div className="waiting-student-grid">
                  {learnerPlayers.map((learner) => (
                    <article key={learner.id}>
                      <span className={`readiness-dot ${learner.connectionState === "connected" ? "is-connected" : "is-away"}`} aria-hidden="true" />
                      <strong>{learner.nickname}</strong>
                      <em className={`team-label team-${learner.team}`}>{learner.team}</em>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="waiting-students-empty">Students will appear here as they join.</p>
              )}
            </section>

            <details className="waiting-optional-control bot-control-card">
              <summary><Bot size={19} aria-hidden="true" /><span>+ Add test players</span><small>{availableBotSlots} seats available</small></summary>
              <div className="bot-control-fields">
                <label><span>Number of bots</span><input type="number" min={1} max={Math.max(1, availableBotSlots)} value={botCount} disabled={availableBotSlots === 0 || isAddingBot} onChange={(event) => setBotCount(Math.max(1, Number(event.target.value) || 1))} /></label>
                <label>
                  <span>Difficulty</span>
                  <select value={botDifficulty} disabled={isAddingBot} onChange={(event) => setBotDifficulty(event.target.value as BotDifficulty)}>
                    <option value="beginner">Beginner</option>
                    <option value="standard">Standard</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </label>
                <button type="button" onClick={addBots} disabled={availableBotSlots === 0 || isAddingBot}>
                  {isAddingBot ? "Adding..." : `Add ${Math.min(botCount, availableBotSlots)} Bot${Math.min(botCount, availableBotSlots) === 1 ? "" : "s"}`}
                </button>
              </div>
            </details>

            <details className="teacher-customization-controls" aria-label="Character customization controls" open={selectedSession.players.some((item) => !item.isBot && item.appearance?.decalAssetId)}>
              <summary><span><strong>Player style</strong><small>Optional character and sticker controls</small></span><span className="details-summary-action">Manage</span></summary>
              <div className="teacher-customization-toggles">
                <label className="toggle-row"><input type="checkbox" checked={selectedSession.settings.characterCustomization.enabled} onChange={(event) => void updateLiveCustomization({ ...selectedSession.settings.characterCustomization, enabled: event.target.checked })} />Creator enabled</label>
                <label className="toggle-row"><input type="checkbox" checked={selectedSession.settings.characterCustomization.uploadsEnabled} disabled={!selectedSession.settings.characterCustomization.enabled} onChange={(event) => void updateLiveCustomization({ ...selectedSession.settings.characterCustomization, uploadsEnabled: event.target.checked })} />Artwork uploads</label>
                <label className="toggle-row"><input type="checkbox" checked={selectedSession.settings.characterCustomization.persistAcrossSessions} disabled={!selectedSession.settings.characterCustomization.enabled} onChange={(event) => void updateLiveCustomization({ ...selectedSession.settings.characterCustomization, persistAcrossSessions: event.target.checked })} />Remember choices</label>
              </div>
              <button type="button" onClick={() => void resetAllAppearances()}>Reset everyone</button>
              <div className="appearance-moderation-list">
                {learnerPlayers.map((item) => (
                  <div key={item.id}><span>{item.nickname}{item.appearance?.decalAssetId ? " · sticker submitted" : ""}</span><span>{item.appearance?.decalAssetId && <button type="button" onClick={() => void removePlayerDecal(item.id)}>Remove Sticker</button>}<button type="button" onClick={() => void clearPlayerAppearance(item.id)}>Clear Player</button></span></div>
                ))}
              </div>
              <TeacherDecalGallery sessionCode={selectedSession.sessionCode} refreshKey={selectedSession.players.map((item) => `${item.id}:${item.appearance?.decalAssetId ?? "none"}`).join("|")} loadAsset={loadTeacherDecal} onRemove={removeDecalAsset} />
            </details>

            <StatusMessages error={status.error} message={status.message} />
            <div className="waiting-start-bar">
              <div>
                <strong>{learnerPlayers.length > 0 ? `${learnerPlayers.length} student${learnerPlayers.length === 1 ? "" : "s"} ready` : "Waiting for students…"}</strong>
                {learnerPlayers.length > 0 && <small>Everyone can join until the room is full.</small>}
              </div>
              <button className="primary" type="button" onClick={start} disabled={Boolean(startBlockedReason) || isStartingSession}>
                <Play size={22} aria-hidden="true" />
                {isStartingSession ? "Starting…" : "Start game"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="live-control-heading">
              <div><span className="flow-step">Live game</span><h2>Run the live game</h2></div>
              <div className="button-row">
                <TeacherPauseControls
                  paused={selectedSession.controlState === "teacher_paused"}
                  busy={isChangingPause}
                  disabled={selectedSession.status === "ended" || isEndingRound || isEndingSession}
                  onToggle={() => void toggleTeacherPause()}
                />
                <button
                  type="button"
                  className="spectator-launch-button"
                  onClick={() => {
                    setIsTeacherSpectatorPickerOpen(false);
                    setIsTeacherSpectatorOpen(true);
                  }}
                  disabled={!teacherSpectatorPlayers.length}
                  title={teacherSpectatorPlayers.length ? "Watch the live game from a learner's point of view" : "A connected learner is needed to spectate"}
                >
                  <Eye size={18} aria-hidden="true" />
                  Spectator View
                </button>
                {selectedSession.settings.gameMode !== "zombie" && selectedSession.settings.gameMode !== "athletics" && (
                  <button
                    type="button"
                    className="end-round-button"
                    onClick={() => void endRound()}
                    disabled={selectedSession.status !== "active" || selectedSession.controlState === "teacher_paused" || isEndingRound || isEndingSession}
                  >
                    {isEndingRound ? "Ending Round..." : "End Round"}
                  </button>
                )}
                <button ref={endSessionTriggerRef} className="end-game-button" onClick={() => setIsEndConfirmOpen(true)} disabled={isEndingSession}>{isEndingSession ? "Finishing…" : "End game"}</button>
              </div>
            </header>
            <div className="live-summary">
              <span className={`status-pill status-${selectedSession.status}${selectedSession.controlState === "teacher_paused" ? " teacher-paused-status" : ""}`}>{selectedSession.controlState === "teacher_paused" ? "Game paused" : isRoundPreparationPhase(selectedSession) ? "Preparation" : isZombieSelectionPhase(selectedSession) ? "Choosing Zombies" : sessionStatusLabel(selectedSession.status)}</span>
              <span>{sessionGameModeLabel(selectedSession)}</span>
              <span>{selectedSession.settings.gameMode === "athletics" ? ATHLETICS_STADIUM_COURSE.title : arenaMapLabel(selectedSession.settings.mapId)}</span>
              {selectedSession.settings.gameMode === "flag" && <span>Round {selectedSession.currentRound}/{selectedSession.settings.roundCount}</span>}
              <span>{selectedSession.settings.gameMode === "athletics" ? `${sessionGameModeLabel(selectedSession)} · Race · ${selectedSession.athletics?.requiredLaps ?? selectedSession.settings.athleticsCourseLaps ?? 1} ${(selectedSession.athletics?.requiredLaps ?? selectedSession.settings.athleticsCourseLaps ?? 1) === 1 ? "lap" : "laps"} · ${ATHLETICS_STADIUM_COURSE.sections.length} chapters` : `Time ${formatDuration(remainingSeconds)}`}</span>
              <span>{activePlayers}/{selectedSession.players.length || 0} active</span>
              <span>{activeLearners} learner{activeLearners === 1 ? "" : "s"}</span>
              {botPlayers.length > 0 && <span>{botPlayers.length} bot{botPlayers.length === 1 ? "" : "s"}</span>}
              <span>{selectedSession.settings.gameMode === "athletics" ? `${resolveAthleticsStandings(selectedSession.players).filter((standing) => standing.status === "finished").length} finished` : selectedSession.settings.gameMode === "zombie" ? `Humans ${zombieCounts.humans} - Zombies ${zombieCounts.zombies}` : `Blue ${teamTotals.blue} - Red ${teamTotals.red}`}</span>
            </div>
            {selectedSession.settings.gameMode === "athletics" && (selectedSession.settings.athleticsMode ?? selectedSession.athletics?.mode ?? "classic") !== "classic" && (
              <div className="athletics-teacher-monitor" aria-label="Athletics mode monitor">
                <strong>{sessionGameModeLabel(selectedSession)}</strong>
                {(selectedSession.settings.athleticsMode ?? selectedSession.athletics?.mode) === "zeus" && <span>Phase: {selectedSession.athletics?.zeus?.phase ?? "idle"} · Attack {selectedSession.athletics?.zeus?.attackIndex ?? 0}</span>}
                {(selectedSession.settings.athleticsMode ?? selectedSession.athletics?.mode) === "hunters-runners" && <span>Round {selectedSession.athletics?.modeRound ?? 1}/{selectedSession.athletics?.modeRoundsTotal ?? 2} · {selectedSession.athletics?.hunterIds?.length ?? 0} hunters · {selectedSession.athletics?.runnerIds?.length ?? 0} runners</span>}
                {(selectedSession.settings.athleticsMode ?? selectedSession.athletics?.mode) === "chaos-climb" && <span>Wave {selectedSession.athletics?.chaos?.waveIndex ?? 0} · {selectedSession.athletics?.chaos?.activeHazards.length ?? 0} hazards active{selectedSession.athletics?.chaos?.currentEvent ? ` · ${selectedSession.athletics.chaos.currentEvent.label}` : ""}</span>}
              </div>
            )}
            <Suspense fallback={<ArenaLoading label="Loading live arena" />}>
              <ArenaPreview key={`${selectedSession.id}:${selectedSession.startedAt ?? "waiting"}:overview`} session={selectedSession} loadDecalAsset={loadTeacherDecal} />
            </Suspense>
            <LearningPulse pulse={selectedSession.learningPulse} />
            <Scoreboard players={selectedSession.players} gameMode={selectedSession.settings.gameMode} athleticsRequiredLaps={selectedSession.athletics?.requiredLaps ?? selectedSession.settings.athleticsCourseLaps ?? 1} onRemovePlayer={(playerId) => void removePlayer(playerId)} removingPlayerId={removingPlayerId} />
            <EventFeed events={selectedSession.events ?? []} />
          </>
        ) : (
          <p>Create a game to invite students.</p>
        )}

        {selectedSession && isEndConfirmOpen && (
          <div className="modal-backdrop" role="presentation">
            <div ref={endSessionDialogRef} className="panel confirm-modal" role="dialog" aria-modal="true" aria-labelledby="end-session-title">
              <h2 id="end-session-title">Finish this game?</h2>
              <p>This closes the room and prepares the learning report. Students won’t be able to rejoin afterward.</p>
              <div className="button-row">
                <button className="primary" onClick={end} disabled={isEndingSession}>{isEndingSession ? "Finishing..." : "Finish and see report"}</button>
                <button ref={keepSessionOpenRef} onClick={() => setIsEndConfirmOpen(false)}>Keep game open</button>
              </div>
            </div>
          </div>
        )}

        {selectedSession && isProjectorOpen && selectedSession.status === "waiting" && (
          <div className="projector-backdrop" role="presentation">
            <section ref={projectorDialogRef} className="projector-waiting-room" role="dialog" aria-modal="true" aria-labelledby="projector-title">
              <header>
                 <div><span className="projector-kicker">{sessionQuiz?.title ?? "QuizStrike"}</span><h2 id="projector-title">Join the game</h2></div>
                <button ref={projectorCloseRef} type="button" onClick={() => setIsProjectorOpen(false)} aria-label="Close projector view">Close</button>
              </header>
              <div className="projector-content">
                 <div className="projector-join-code"><span>Game code</span><strong>{selectedSession.sessionCode}</strong><small>{studentJoinLink.replace(/^https?:\/\//, "")}</small></div>
                <div className="projector-qr">
                  <QRCodeSVG value={studentJoinLink} size={260} level="M" marginSize={2} title={`Join QuizStrike game ${selectedSession.sessionCode}`} />
                  <span>Scan to join</span>
                </div>
              </div>
              <div className="projector-roster" aria-live="polite">
                <strong>{learnerPlayers.length} student{learnerPlayers.length === 1 ? "" : "s"} joined</strong>
                <div>
                  {learnerPlayers.map((item) => <span key={item.id}>{item.nickname} · {item.team.toUpperCase()}</span>)}
                   {learnerPlayers.length === 0 && <span>Students will appear as they join.</span>}
                </div>
              </div>
              <footer>
                 <button type="button" onClick={copyStudentJoinLink}>{isJoinLinkCopied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}{isJoinLinkCopied ? "✓ Link copied" : "Copy join link"}</button>
                 <button className="primary" type="button" onClick={start} disabled={Boolean(startBlockedReason) || isStartingSession}><Play size={22} aria-hidden="true" />{isStartingSession ? "Starting…" : "Start game"}</button>
              </footer>
            </section>
          </div>
        )}

        {selectedSession && isTeacherSpectatorOpen && teacherSpectatorPlayer && (selectedSession.status === "active" || selectedSession.status === "paused") && (
          <div className="teacher-spectator-backdrop" role="presentation">
            <section ref={teacherSpectatorDialogRef} className="teacher-spectator-dialog" role="dialog" aria-modal="true" aria-labelledby="teacher-spectator-title">
              <header className="teacher-spectator-header">
                <div>
                  <span className="teacher-spectator-kicker"><Eye size={15} aria-hidden="true" /> Read-only live view</span>
                  <h2 id="teacher-spectator-title">Watch the game</h2>
              <p>{selectedSession.settings.gameMode === "athletics" ? ATHLETICS_STADIUM_COURSE.title : arenaMapLabel(selectedSession.settings.mapId)} <span aria-hidden="true">{"\u00B7"}</span> {sessionGameModeLabel(selectedSession)} <span aria-hidden="true">{"\u00B7"}</span> Follow a learner</p>
                </div>
                <button
                  ref={teacherSpectatorCloseRef}
                  type="button"
                  className="teacher-spectator-close"
                  onClick={() => {
                    setIsTeacherSpectatorPickerOpen(false);
                    setIsTeacherSpectatorOpen(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setIsTeacherSpectatorPickerOpen(false);
                    setIsTeacherSpectatorOpen(false);
                  }}
                >
                  Close View
                </button>
              </header>
              <div className="teacher-spectator-arena">
                <Suspense fallback={<ArenaLoading label="Loading spectator view" />}>
                  <ArenaPreview
                    key={`${selectedSession.id}:${teacherSpectatorPlayer.id}:spectator`}
                    session={selectedSession}
                    currentPlayer={teacherSpectatorPlayer}
                    view="fps"
                    controlsDisabled
                    inputPaused
                    suppressHint
                    loadDecalAsset={loadTeacherDecal}
                  />
                </Suspense>
                <span className="teacher-spectator-readonly"><Eye size={15} aria-hidden="true" /> Teacher view {"\u00B7"} controls locked</span>
              </div>
              <footer className="teacher-spectator-footer">
                <button
                  type="button"
                  onClick={() => cycleTeacherSpectator(-1)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    cycleTeacherSpectator(-1);
                  }}
                  disabled={teacherSpectatorPlayers.length < 2}
                >
                  <ChevronLeft size={18} aria-hidden="true" /> Previous player
                </button>
                <div className="teacher-spectator-target">
                  <div ref={teacherSpectatorPickerRef} className="teacher-spectator-picker">
                    <span className="teacher-spectator-picker-label">Select learner</span>
                    <button
                      type="button"
                      className="teacher-spectator-picker-trigger"
                      aria-haspopup="listbox"
                      aria-expanded={isTeacherSpectatorPickerOpen}
                      aria-controls="teacher-spectator-player-list"
                      onClick={() => setIsTeacherSpectatorPickerOpen((open) => !open)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setIsTeacherSpectatorPickerOpen(false);
                          return;
                        }
                        if (event.key !== "Enter" && event.key !== " " && event.key !== "ArrowDown") return;
                        event.preventDefault();
                        setIsTeacherSpectatorPickerOpen(true);
                      }}
                    >
                      <span>{teacherSpectatorPlayer.nickname}</span>
                      <ChevronDown size={17} aria-hidden="true" />
                    </button>
                    {isTeacherSpectatorPickerOpen && (
                      <div id="teacher-spectator-player-list" className="teacher-spectator-picker-menu" role="listbox" aria-label="Learners available to spectate">
                        {teacherSpectatorPlayers.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            role="option"
                            aria-selected={player.id === teacherSpectatorPlayer.id}
                            className={player.id === teacherSpectatorPlayer.id ? "is-selected" : undefined}
                            onClick={() => {
                              setTeacherSpectatorPlayerId(player.id);
                              setIsTeacherSpectatorPickerOpen(false);
                            }}
                          >
                            <span>{player.nickname}</span>
                            <small>{player.team.toUpperCase()}</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <small>{teacherSpectatorPlayer.team.toUpperCase()} team {"\u00B7"} choose a learner to follow</small>
                </div>
                <button
                  type="button"
                  onClick={() => cycleTeacherSpectator(1)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    cycleTeacherSpectator(1);
                  }}
                  disabled={teacherSpectatorPlayers.length < 2}
                >
                  Next player <ChevronRight size={18} aria-hidden="true" />
                </button>
              </footer>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportsPanel({
  sessions,
  quizSets,
  reports,
  report,
  setReport,
  setTab,
  onRefresh
}: {
  sessions: GameSession[];
  quizSets: QuizSet[];
  reports: ReportMetadata[];
  report: SessionReport | null;
  setReport: (report: SessionReport | null) => void;
  setTab: (tab: "sessions") => void;
  onRefresh: () => Promise<void>;
}) {
  const [code, setCode] = useState(reports[0]?.sessionCode ?? "");
  const [selectedReportId, setSelectedReportId] = useState(reports[0]?.id ?? "");
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const status = useAsyncMessage();

  const endedSessions = useMemo(
    () => sessions
      .filter((session) => session.status === "ended")
      .sort((left, right) => Date.parse(right.endedAt ?? right.createdAt) - Date.parse(left.endedAt ?? left.createdAt)),
    [sessions]
  );
  const quizSetById = useMemo(() => new Map(quizSets.map((quiz) => [quiz.id, quiz])), [quizSets]);
  const reportBySessionId = useMemo(() => new Map(reports.map((metadata) => [metadata.sessionId, metadata])), [reports]);
  const endedSessionIds = useMemo(() => new Set(endedSessions.map((session) => session.id)), [endedSessions]);

  useEffect(() => {
    const hasCurrentCode = sessions.some((session) => session.sessionCode === code) || reports.some((metadata) => metadata.sessionCode === code);
    if (!hasCurrentCode) setCode(reports[0]?.sessionCode ?? endedSessions[0]?.sessionCode ?? "");
    if (!selectedReportId && reports[0]?.id) setSelectedReportId(reports[0].id);
  }, [code, endedSessions, reports, selectedReportId, sessions]);

  const selectedSession = sessions.find((session) => session.sessionCode === code) ?? report?.session;
  const selectedMetadata = selectedSession
    ? reportBySessionId.get(selectedSession.id)
    : reports.find((metadata) => metadata.sessionCode === code);
  const selectedQuizTitle = selectedMetadata?.quizSetName
    ?? (selectedSession ? quizSetById.get(selectedSession.quizSetId)?.title : undefined)
    ?? "Game report";
  const reportAthleticsMode = report?.session.settings.gameMode === "athletics"
    ? report.session.settings.athleticsMode ?? report.session.athletics?.mode ?? "classic"
    : undefined;
  const reportHasAthleticsModeStats = reportAthleticsMode !== undefined && reportAthleticsMode !== "classic";

  const load = async (requestedCode = code) => {
    if (!requestedCode || isLoadingReport) return;
    status.clear();
    setCode(requestedCode);
    const matchingMetadata = reports.find((metadata) => metadata.sessionCode === requestedCode);
    setSelectedReportId(matchingMetadata?.id ?? "");
    setIsLoadingReport(true);
    try {
      const payload = (await teacherApi.report(requestedCode)) as { report: SessionReport };
      setReport(payload.report);
      status.setMessage("Learning report loaded.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const loadSavedReport = async (metadata: ReportMetadata) => {
    if (isLoadingReport) return;
    status.clear();
    setSelectedReportId(metadata.id);
    setCode(metadata.sessionCode);
    setIsLoadingReport(true);
    try {
      const payload = (await teacherApi.reportById(metadata.id)) as { report: SessionReport };
      setReport(payload.report);
      status.setMessage(`${metadata.displayName} is ready to review.`);
    } catch (err) {
      status.report(err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const deleteSavedReport = async (metadata: ReportMetadata) => {
    if (isDeletingReport || !window.confirm(`Delete report "${metadata.displayName}"?`)) return;
    setIsDeletingReport(true);
    status.clear();
    try {
      await teacherApi.deleteReport(metadata.id);
      if (selectedReportId === metadata.id) {
        setSelectedReportId("");
        setReport(null);
      }
      await onRefresh();
      status.setMessage("Saved report deleted.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsDeletingReport(false);
    }
  };

  const clearHistory = async () => {
    if (isClearingHistory || endedSessions.length === 0) return;
    const gameLabel = endedSessions.length === 1 ? "completed game" : "completed games";
    if (!window.confirm(`Clear ${endedSessions.length} ${gameLabel} and their saved reports? You can’t undo this. Live games won’t be affected.`)) return;
    setIsClearingHistory(true);
    status.clear();
    try {
      const payload = (await teacherApi.deleteSessionHistory()) as { deletedSessions?: number };
      setCode("");
      setSelectedReportId("");
      setReport(null);
      await onRefresh();
      const deletedCount = payload.deletedSessions ?? endedSessions.length;
      status.setMessage(`${deletedCount} completed ${deletedCount === 1 ? "game" : "games"} cleared from history.`);
    } catch (err) {
      status.report(err);
    } finally {
      setIsClearingHistory(false);
    }
  };

  const exportCsv = async () => {
    if (!code || isExportingCsv) return;
    status.clear();
    setIsExportingCsv(true);
    try {
      const blob = await teacherApi.reportCsv(code);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `quizstrike-${code}-report.csv`;
      link.click();
      URL.revokeObjectURL(url);
      status.setMessage("CSV export started.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="report-panel reports-page">
      <header className="reports-page-heading">
        <div>
          <span className="eyebrow">Learning reports</span>
          <h2>See what to teach next</h2>
          <p>Review completed games, spot difficult questions, and plan the next lesson with less guesswork.</p>
        </div>
        <div className="reports-page-actions">
          <span className="reports-count">{endedSessions.length} completed {endedSessions.length === 1 ? "game" : "games"}</span>
          <button onClick={() => setTab("sessions")}>Open live games</button>
        </div>
      </header>
      <StatusMessages error={status.error} message={status.message} />

      <div className="reports-layout">
        <section className="report-history-card" aria-label="Completed game history">
          <div className="report-card-heading">
            <div>
              <span className="report-card-kicker">Game history</span>
              <h3>Finished games</h3>
            </div>
            <button className="report-danger-button" onClick={() => void clearHistory()} disabled={isClearingHistory || endedSessions.length === 0}>
              <Trash2 size={16} aria-hidden="true" />
              {isClearingHistory ? "Clearing..." : "Clear history"}
            </button>
          </div>
          <p className="report-card-note">Select a game to open its learning report. Live games stay separate.</p>
          <div className="report-history-list" role="listbox" aria-label="Completed games">
            {endedSessions.map((session) => {
              const metadata = reportBySessionId.get(session.id);
              const quizTitle = metadata?.quizSetName ?? quizSetById.get(session.quizSetId)?.title ?? "Quiz set";
              const date = new Date(session.endedAt ?? session.createdAt).toLocaleDateString();
              const isSelected = code === session.sessionCode;
              return (
                <div className={`report-history-row${isSelected ? " selected" : ""}`} key={session.id}>
                  <button
                    className="report-history-item"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => void load(session.sessionCode)}
                    disabled={isLoadingReport}
                  >
                    <span className="report-history-status" aria-hidden="true" />
                    <span className="report-history-copy">
                      <strong>{quizTitle}</strong>
                      <small>{session.sessionCode} · {date}</small>
                    </span>
                    <span className="report-history-meta">{metadata ? "Saved" : "Open"}</span>
                  </button>
                  {metadata && <button className="report-history-delete" aria-label={`Delete saved report ${metadata.displayName}`} onClick={() => void deleteSavedReport(metadata)} disabled={isDeletingReport}><Trash2 size={15} aria-hidden="true" /></button>}
                </div>
              );
            })}
            {reports.filter((metadata) => !endedSessionIds.has(metadata.sessionId)).map((metadata) => (
              <div className={`report-history-row${selectedReportId === metadata.id ? " selected" : ""}`} key={metadata.id}>
                <button className="report-history-item" role="option" aria-selected={selectedReportId === metadata.id} onClick={() => void loadSavedReport(metadata)} disabled={isLoadingReport}>
                  <span className="report-history-status" aria-hidden="true" />
                  <span className="report-history-copy"><strong>{metadata.quizSetName}</strong><small>{metadata.sessionCode} · Saved report</small></span>
                  <span className="report-history-meta">Saved</span>
                </button>
                <button className="report-history-delete" aria-label={`Delete saved report ${metadata.displayName}`} onClick={() => void deleteSavedReport(metadata)} disabled={isDeletingReport}><Trash2 size={15} aria-hidden="true" /></button>
              </div>
            ))}
          </div>
          {endedSessions.length === 0 && reports.length === 0 && <div className="report-empty-state"><strong>No finished games yet</strong><span>Finish a live game and its report will appear here.</span></div>}
          <div className="report-history-footer"><span>{reports.length}/15 saved reports retained</span><span>Completed game data can be cleared at any time.</span></div>
        </section>

        <section className="report-detail-card" aria-label="Selected game report">
          <div className="report-detail-heading">
            <div>
              <span className="report-card-kicker">Selected game</span>
              <h3>{selectedQuizTitle}</h3>
              <p>{code ? `${code} · ${selectedSession ? new Date(selectedSession.endedAt ?? selectedSession.createdAt).toLocaleString() : "Saved report"}` : "Choose a finished game from the history panel."}</p>
            </div>
            <div className="report-detail-actions">
              <button onClick={() => void load()} disabled={!code || isLoadingReport}>
                <Download size={17} aria-hidden="true" />
                {isLoadingReport ? "Loading..." : "Open report"}
              </button>
              <button onClick={exportCsv} disabled={!code || isExportingCsv}>
                <Download size={17} aria-hidden="true" />
                {isExportingCsv ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          </div>
          {!report && <div className="report-empty-state report-detail-empty"><strong>Your report will appear here</strong><span>Select a finished game, then open the report to see class accuracy, rewards, and questions to revisit.</span></div>}
          {report && (
            <>
              {(() => {
                const classAccuracy = calculateClassAccuracy(report.rows);
                const attemptedStudents = report.rows.filter((row) => row.correctAnswers + row.wrongAnswers > 0).length;
                return (
                  <div className="report-summary-grid">
                    <div className="metric"><span>Class accuracy</span><strong>{classAccuracy === null ? "-" : `${classAccuracy}%`}</strong><small>{attemptedStudents} of {report.rows.length} students answered</small></div>
                    {report.session.settings.gameMode === "athletics" ? (
                      <div className="metric"><span>Finishers</span><strong>{report.rows.filter((row) => row.raceStatus === "finished").length}</strong><small>Students who crossed the tape</small></div>
                    ) : (
                      <div className="metric"><span>Rewards earned</span><strong>{formatRewards(report.rows.reduce((total, row) => total + row.quizMoney, 0))}</strong><small>Rewards from correct answers</small></div>
                    )}
                    <div className="metric"><span>Questions to revisit</span><strong>{report.missedQuestions.length}</strong><small>Questions missed by students</small></div>
                  </div>
                );
              })()}
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead><tr><th>Student</th>{report.session.settings.gameMode === "athletics" ? <><th>Place</th><th>Race time</th><th>Status</th><th>Laps</th><th>Falls</th><th>Checkpoint</th>{reportHasAthleticsModeStats && <><th>Role</th><th>Hits</th><th>Score</th></>}</> : <th>Team</th>}<th>Correct</th><th>Wrong</th><th>Accuracy</th>{report.session.settings.gameMode !== "athletics" && <><th>Rewards</th><th>Score</th></>}</tr></thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.nickname}>
                        <td data-label="Student">{row.nickname}</td>
                        {report.session.settings.gameMode === "athletics" ? <>
                          <td data-label="Place">{row.racePlace ? `#${row.racePlace}` : "—"}</td>
                          <td data-label="Race time">{row.raceTimeMs === undefined ? "—" : formatDuration(row.raceTimeMs / 1000)}</td>
                          <td data-label="Status">{row.raceStatus === "finished" ? "Finished" : row.raceStatus === "hunter" ? "Hunter" : "DNF"}</td>
                          <td data-label="Laps">{row.raceLapsCompleted ?? 0}/{row.raceLapsRequired ?? 1}</td>
                          <td data-label="Falls">{row.raceFalls ?? 0}</td>
                          <td data-label="Checkpoint">{row.raceCheckpoint ?? 0}</td>
                          {reportHasAthleticsModeStats && <>
                            <td data-label="Role">{row.athleticsRole === "hunter" ? "Hunter" : "Runner"}</td>
                            <td data-label="Hits">{row.athleticsHunterHits ?? "—"}</td>
                            <td data-label="Score">{row.score}</td>
                          </>}
                        </> : <td data-label="Team">{teamLabel(row.team)}</td>}
                        <td data-label="Correct">{row.correctAnswers}</td>
                        <td data-label="Wrong">{row.wrongAnswers}</td>
                        <td data-label="Accuracy">{row.correctAnswers + row.wrongAnswers > 0 ? `${row.accuracy}%` : "-"}</td>
                        {report.session.settings.gameMode !== "athletics" && <>
                          <td data-label="Rewards">{formatRewards(row.quizMoney)}</td>
                          <td data-label="Score">{row.score}</td>
                        </>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <section className="report-reteach-section" aria-labelledby="reteach-title">
                <div className="report-section-heading"><div><span className="report-card-kicker">Next lesson</span><h3 id="reteach-title">Questions to revisit</h3></div><span>{report.missedQuestions.length} item{report.missedQuestions.length === 1 ? "" : "s"}</span></div>
                <ul className="plain-list">
                  {report.missedQuestions.map((item) => <li key={item.questionId}><span>{item.prompt}</span><small>{item.misses} misses</small></li>)}
                  {report.missedQuestions.length === 0 && <li>No questions to revisit yet. This group is ready for the next challenge.</li>}
                </ul>
              </section>
            </>
          )}
        </section>
      </div>
    </div>
  );
}


export default function TeacherWorkspace({
  teacher,
  apiWakeState,
  initialMode,
  initialPath,
  onNavigate,
  onLogout,
  onAuthed
}: {
  teacher: TeacherUser | null;
  apiWakeState: ApiWakeState;
  initialMode: "login" | "signup";
  initialPath: string;
  onNavigate: (path: string, mode?: "quizStrike" | "teacher") => void;
  onLogout: () => void;
  onAuthed: (user: TeacherUser) => void;
}) {
  return teacher ? <TeacherDashboard teacher={teacher} initialPath={initialPath} onNavigate={onNavigate} onLogout={onLogout} /> : <TeacherAuth apiWakeState={apiWakeState} initialMode={initialMode} onAuthed={onAuthed} />;
}
