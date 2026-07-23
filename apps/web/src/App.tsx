import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  CircleDollarSign,
  ClipboardPaste,
  Copy,
  DoorOpen,
  Download,
  Eye,
  EyeOff,
  Folder,
  GraduationCap,
  HeartPulse,
  LogOut,
  Link2,
  Package,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  ShoppingBag,
  Target,
  Timer,
  Users,
  WifiOff,
  WandSparkles
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import {
  calculateAccuracy,
  canStartRound,
  DEFAULT_SESSION_SETTINGS,
  FLAG_MODE_DEFAULTS,
  GEAR_ITEMS,
  getPlayerPerks,
  getPlayerWeaponId,
  RESPAWN_CORRECT_ANSWERS_REQUIRED,
  getRoundRemainingSeconds,
  isRoundBuyPhase,
  sanitizePlayerAppearance,
  type CharacterCustomizationSettings,
  type ArenaMapId,
  type Choice,
  type GameAnnouncement,
  type GameEvent,
  type GameSession,
  type PlayerSession,
  type PlayerAppearance,
  type PublicQuestion,
  type QuizSet,
  type SessionReport,
  type SessionSettings,
  type Team,
  type TeacherUser
} from "@quizstrike/shared";
import { ApiError, authApi, fetchDecalAsset, getApiUrl, studentApi, teacherApi } from "./api/client";
import { buildStudentJoinUrl, getJoinCodeFromSearch, modeForRoute, normalizeRoutePath, type AppMode } from "./navigation";
import { groupScoreboardRows } from "./scoreboardGroups";
import { getModeScoreSummary, getReadyRoomTitle, getSessionResultText, getZombieCounts } from "./sessionPresentation";
import { formatStudentJoinError } from "./studentJoinErrors";
import { getShopShortcut, getShopShortcutKey } from "./shopShortcuts";
import { sendStudentCommand } from "./studentCommandTransport";
import { StatusMessages } from "./ui/StatusMessages";
import TeacherDecalGallery from "./ui/TeacherDecalGallery";
import { ARENA_MAPS, getArenaMap } from "./game/arenaMaps";
import {
  CHARACTER_STRESS_COUNTS,
  createCharacterDebugSession,
  summarizeCharacterDebugSession,
  type CharacterStressCount
} from "./game/characters/CharacterDebugScenarios";
import { gameAudio, getCombatAudioSpatial, type AudioEventCue, type GameAudioCue } from "./game/GameAudio";
import { readGamePreferences, writeGamePreferences, type ArenaQuality, type GamePreferences } from "./game/gamePreferences";
import { emitArenaVfx, type ArenaVfxKind } from "./game/ArenaVfx";
import { emitArenaAnimation, type ArenaAnimationCue } from "./game/ArenaAnimation";
import {
  getIncomingHitDirection,
  shouldAutoOpenRespawnPractice,
  type IncomingHitDirection
} from "./studentCombatFeedback";

const ArenaPreview = lazy(() => import("./game/ArenaPreview"));
const CharacterCreator = lazy(() => import("./ui/CharacterCreator"));

type DashboardPayload = {
  classes: Array<{ id: string; name: string; description?: string; createdAt: string }>;
  quizSets: QuizSet[];
  sessions: GameSession[];
};

type AuthPayload = { user: TeacherUser; token: string };
type StoredStudentSession = { sessionCode: string; playerId: string; playerToken: string };

const emptyQuestion = {
  prompt: "",
  choiceA: "",
  choiceB: "",
  choiceC: "",
  choiceD: "",
  correctChoice: "A",
  explanation: "",
  difficulty: ""
};

const choices: Choice[] = ["A", "B", "C", "D"];
const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
const STUDENT_SESSION_STORAGE_KEY = "quizstrike_student_session";
const STUDENT_APPEARANCE_STORAGE_KEY = "quizstrike_student_appearance_v1";

const readStoredStudentSession = (): StoredStudentSession | null => {
  try {
    const raw = localStorage.getItem(STUDENT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredStudentSession>;
    return stored.sessionCode && stored.playerId && stored.playerToken
      ? { sessionCode: stored.sessionCode, playerId: stored.playerId, playerToken: stored.playerToken }
      : null;
  } catch {
    return null;
  }
};

const clearStoredStudentSession = () => localStorage.removeItem(STUDENT_SESSION_STORAGE_KEY);

const readStoredAppearance = (): PlayerAppearance | null => {
  try {
    const raw = localStorage.getItem(STUDENT_APPEARANCE_STORAGE_KEY);
    return raw ? sanitizePlayerAppearance(JSON.parse(raw) as Partial<PlayerAppearance>) : null;
  } catch {
    return null;
  }
};

type QuestionDraft = typeof emptyQuestion;
type ArenaPositionPayload = { x: number; z: number; y?: number; facing: number; scoped?: boolean; zoomLevel?: number };
type DamageResultPayload =
  | {
      ok: true;
      attackerId: string;
      targetId: string;
      attackerX: number;
      attackerZ: number;
      targetX: number;
      targetZ: number;
      targetFacing: number;
      damage: number;
      health: number;
      snowballs: number;
      eliminated: boolean;
      moneyAwarded?: number;
    }
  | { ok: false; reason?: string; snowballs?: number };
type EliminationPayload = { attackerId: string; targetId: string; moneyAwarded?: number };

const blockedNicknameTerms = [
  "admin",
  "teacher",
  "moderator",
  "damn",
  "hell",
  "crap",
  "shit",
  "fuck",
  "bitch",
  "asshole",
  "sex",
  "porn",
  "nazi",
  "hitler"
];

const getNicknameError = (value: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return "";
  const blockedTerm = blockedNicknameTerms.find((term) => normalized.includes(term));
  return blockedTerm ? "Please choose a classroom-friendly nickname." : "";
};

const sessionNumberFields = [
  { name: "roundCount", label: "Rounds", min: 1, max: 30, help: "Complete rounds before the session ends." },
  { name: "flagHoldSeconds", label: "Flag Hold Time", min: 5, max: 180, step: 5, unit: "seconds", help: "How long Red protects a placed flag." },
  { name: "initialZombieCount", label: "Starting Zombies", min: 0, max: 20, help: "Students who begin as Zombies." },
  { name: "maxPlayers", label: "Max Players", min: 2, max: 40, unit: "students", help: "Maximum students and test bots in the room." },
  { name: "startingMoney", label: "Starting Money", min: 0, max: 16000, step: 100, unit: "dollars", help: "Money each student receives at the start." },
  { name: "correctAnswerReward", label: "Correct Answer Reward", min: 0, max: 5000, step: 100, unit: "dollars", help: "Money earned for each correct answer." },
  { name: "startingSnowballs", label: "Starting Snowballs", min: 1, max: 99, unit: "snowballs", help: "Starting ammunition for each student." },
  { name: "snowballPackPrice", label: "Snowball Pack Price", min: 0, max: 5000, step: 50, unit: "dollars", help: "Cost of one snowball pack." },
  { name: "snowballsPerPack", label: "Snowballs Per Pack", min: 1, max: 50, unit: "snowballs", help: "Ammunition in each purchased pack." },
  { name: "wrongAnswerPenalty", label: "Wrong Answer Penalty", min: 0, max: 16000, step: 100, unit: "dollars", help: "Money removed for an incorrect answer." },
  { name: "roundDurationSeconds", label: "Round Time Limit", min: 60, max: 3600, step: 30, unit: "seconds", help: "Time available in each round." }
] as const satisfies ReadonlyArray<{
  name: keyof Pick<
    SessionSettings,
    | "maxPlayers"
    | "roundCount"
    | "flagHoldSeconds"
    | "initialZombieCount"
    | "startingMoney"
    | "correctAnswerReward"
    | "startingSnowballs"
    | "snowballPackPrice"
    | "snowballsPerPack"
    | "wrongAnswerPenalty"
    | "roundDurationSeconds"
  >;
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  help: string;
}>;

type SessionNumberField = (typeof sessionNumberFields)[number]["name"];

const createSessionSettingInputs = (settings: SessionSettings): Record<SessionNumberField, string> =>
  sessionNumberFields.reduce(
    (inputs, field) => ({
      ...inputs,
      [field.name]: String(settings[field.name] ?? "")
    }),
    {} as Record<SessionNumberField, string>
  );

const sampleImportText = `photosynthesis - Process plants use to make food from light
evaporation - Liquid water changing into vapor
denominator - The bottom number in a fraction
metaphor - A comparison without using like or as`;

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const splitStudyLine = (line: string) => {
  const separators = ["\t", " | ", " - ", " – ", " — ", ": "];
  separators.push(" -- ", " = ");
  for (const separator of separators) {
    const index = line.indexOf(separator);
    if (index > 0) {
      const term = line.slice(0, index).trim();
      const definition = line.slice(index + separator.length).trim();
      if (term && definition) return { term, definition };
    }
  }
  return { term: line.trim(), definition: "" };
};

const createGeneratedQuestions = (rawText: string): QuestionDraft[] => {
  const entries = rawText
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+[\).]\s*/, ""))
    .filter(Boolean)
    .map(splitStudyLine);

  const pairedEntries = entries.filter((entry) => entry.definition);
  if (pairedEntries.length >= 2) {
    return pairedEntries.map((entry) => {
      const distractors = shuffle(pairedEntries.filter((candidate) => candidate.term !== entry.term))
        .slice(0, 3)
        .map((candidate) => candidate.definition);
      const generatedChoices = shuffle([entry.definition, ...distractors]).slice(0, 4);
      while (generatedChoices.length < 4) generatedChoices.push("Review this item again");
      const correctIndex = generatedChoices.indexOf(entry.definition);
      return {
        prompt: `What matches "${entry.term}"?`,
        choiceA: generatedChoices[0],
        choiceB: generatedChoices[1],
        choiceC: generatedChoices[2],
        choiceD: generatedChoices[3],
        correctChoice: choices[correctIndex] ?? "A",
        explanation: entry.definition,
        difficulty: "Imported"
      };
    });
  }

  const terms = entries.map((entry) => entry.term).filter(Boolean);
  return terms.map((term) => {
    const distractors = shuffle(terms.filter((candidate) => candidate !== term)).slice(0, 3);
    const generatedChoices = shuffle([term, ...distractors]).slice(0, 4);
    while (generatedChoices.length < 4) generatedChoices.push("Not in this study list");
    const correctIndex = generatedChoices.indexOf(term);
    return {
      prompt: "Which item was included in this study list?",
      choiceA: generatedChoices[0],
      choiceB: generatedChoices[1],
      choiceC: generatedChoices[2],
      choiceD: generatedChoices[3],
      correctChoice: choices[correctIndex] ?? "A",
      explanation: `${term} was imported from the pasted list.`,
      difficulty: "Imported"
    };
  });
};

const getDraftChoiceText = (draft: QuestionDraft) => {
  const lookup: Record<string, string> = {
    A: draft.choiceA,
    B: draft.choiceB,
    C: draft.choiceC,
    D: draft.choiceD
  };
  return lookup[draft.correctChoice] ?? draft.choiceA;
};

function useAsyncMessage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const clear = useCallback(() => {
    setMessage("");
    setError("");
  }, []);
  const report = useCallback((err: unknown) => {
    setMessage("");
    setError(err instanceof ApiError || err instanceof Error ? err.message : "Something went wrong.");
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  return useMemo(() => ({ message, error, setMessage, setError, clear, clearError: () => setError(""), report }), [message, error, clear, report]);
}

function accuracy(player: PlayerSession) {
  return calculateAccuracy(player.correctAnswers, player.wrongAnswers);
}

const formatMoney = (value: number) => `$${Math.round(value)}`;

const teamLabel = (team: PlayerSession["team"]) => (team === "blue" ? "Blue Team" : "Red Team");

const sessionStatusLabel = (status: GameSession["status"]) => {
  if (status === "active") return "Round Active";
  if (status === "paused") return "Round Results";
  if (status === "ended") return "Session Ended";
  return "Waiting Room";
};

const gameModeLabel = (mode: SessionSettings["gameMode"]) => {
  if (mode === "flag") return "Flag Mode";
  if (mode === "zombie") return "Zombie Mode";
  return "Classic Tag Practice";
};

const arenaMapLabel = (mapId: ArenaMapId | string | undefined) => getArenaMap(mapId).title;

const flagStatusText = (session: GameSession) => {
  if (session.settings.gameMode !== "flag") return "";
  if (!session.flag) return "Flag available at Red base";
  if (session.flag.state === "carried") return "Flag carried by Red";
  if (session.flag.state === "dropped") return "The flag has been dropped";
  if (session.flag.state === "placed") return "Flag placed. Red protects, Blue captures.";
  if (session.flag.state === "captured") return "Blue captured the flag";
  return "Flag available";
};

const zombieStatusText = (session: GameSession, player?: PlayerSession | null) => {
  if (session.settings.gameMode !== "zombie") return "";
  const humans = session.players.filter((item) => item.role !== "zombie").length;
  const zombies = session.players.filter((item) => item.role === "zombie").length;
  return `Humans ${humans} | Zombies ${zombies} | Role ${player?.role === "zombie" ? "Zombie" : "Human"}`;
};

const getTopLearner = (players: PlayerSession[]) =>
  [...players].sort((a, b) => b.correctAnswers - a.correctAnswers || b.score - a.score)[0];

const getTeamTotals = (players: PlayerSession[]) => ({
  blue: players.filter((player) => player.team === "blue").reduce((total, player) => total + player.score, 0),
  red: players.filter((player) => player.team === "red").reduce((total, player) => total + player.score, 0)
});

const createPresetSettings = (overrides: Partial<SessionSettings>): SessionSettings => ({
  ...DEFAULT_SESSION_SETTINGS,
  ...overrides
});

const SESSION_PRESETS = [
  {
    name: "Quick Warmup",
    description: "Short, low-pressure review for a starter activity.",
    settings: createPresetSettings({
      maxPlayers: 12,
      startingMoney: 300,
      correctAnswerReward: 300,
      startingSnowballs: 8,
      snowballPackPrice: 400,
      snowballsPerPack: 8,
      roundDurationSeconds: 180
    })
  },
  {
    name: "Classic Class",
    description: "Balanced round for whole-class play.",
    settings: createPresetSettings({})
  },
  {
    name: "Review Rush",
    description: "More time and rewards for longer study sessions.",
    settings: createPresetSettings({
      maxPlayers: 30,
      startingMoney: 600,
      correctAnswerReward: 500,
      startingSnowballs: 12,
      snowballPackPrice: 600,
      snowballsPerPack: 12,
      roundDurationSeconds: 480
    })
  }
];

const sessionSettingGroups: Array<{ title: string; description: string; fields: SessionNumberField[] }> = [
  { title: "Classroom and timing", description: "Choose the room size and how long each activity runs.", fields: ["maxPlayers", "roundDurationSeconds", "roundCount", "flagHoldSeconds", "initialZombieCount"] },
  { title: "Rewards and spending", description: "Set what correct answers earn and how much supplies cost.", fields: ["startingMoney", "correctAnswerReward", "wrongAnswerPenalty", "snowballPackPrice"] },
  { title: "Starting supplies", description: "Set the ammunition students start with and receive in a pack.", fields: ["startingSnowballs", "snowballsPerPack"] }
];

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
};

const getPlayerWarmth = (player: PlayerSession) =>
  Math.max(0, Math.round(player.health ?? (player.isAlive ? 100 : 0)));

type FeedbackCue = "success" | "warning" | "error";

const warmFeedbackCue = () => {
  gameAudio.warm();
};

const playFeedbackCue = (cue: FeedbackCue) => {
  const audioCue: Record<FeedbackCue, GameAudioCue> = {
    success: "quiz_correct",
    warning: "player_tagged",
    error: "quiz_wrong"
  };
  gameAudio.play(audioCue[cue]);
};

const feedbackCue = (cue: FeedbackCue) => {
  playFeedbackCue(cue);
  if (readGamePreferences().vibrationEnabled && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    navigator.vibrate?.(cue === "success" ? 24 : cue === "warning" ? [20, 25, 20] : [35, 30, 35]);
  }
};

const queueFeedbackCue = (cue: FeedbackCue) => {
  window.setTimeout(() => feedbackCue(cue), 0);
};

function useRoundRemaining(session: GameSession | null) {
  const [clientNowMs, setClientNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  useEffect(() => {
    const serverTimeMs = session?.serverTime ? Date.parse(session.serverTime) : Number.NaN;
    setServerOffsetMs(Number.isFinite(serverTimeMs) ? serverTimeMs - Date.now() : 0);
  }, [session?.serverTime]);

  useEffect(() => {
    if (session?.status !== "active") {
      setClientNowMs(Date.now());
      return;
    }

    const interval = window.setInterval(() => setClientNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.status, session?.startedAt, session?.endsAt]);

  if (!session || session.status === "ended" || session.status === "paused") return 0;
  return getRoundRemainingSeconds(session, new Date(clientNowMs + serverOffsetMs).toISOString());
}

function useDeadlineRemainingSeconds(deadline?: string, serverTime?: string) {
  const [clientNowMs, setClientNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  useEffect(() => {
    const serverTimeMs = serverTime ? Date.parse(serverTime) : Number.NaN;
    setServerOffsetMs(Number.isFinite(serverTimeMs) ? serverTimeMs - Date.now() : 0);
  }, [serverTime]);

  useEffect(() => {
    setClientNowMs(Date.now());
    if (!deadline) return;
    const interval = window.setInterval(() => setClientNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [deadline, serverTime]);

  if (!deadline) return 0;
  return Math.max(0, Math.ceil((Date.parse(deadline) - (clientNowMs + serverOffsetMs)) / 1000));
}

function GameAnnouncementOverlay({
  announcement,
  serverTime
}: {
  announcement?: GameAnnouncement;
  serverTime?: string;
}) {
  const [visible, setVisible] = useState(Boolean(announcement));

  useEffect(() => {
    if (!announcement) {
      setVisible(false);
      return;
    }
    if (!announcement.expiresAt) {
      setVisible(true);
      return;
    }

    const serverTimeMs = serverTime ? Date.parse(serverTime) : Number.NaN;
    const serverOffsetMs = Number.isFinite(serverTimeMs) ? serverTimeMs - Date.now() : 0;
    const remainingMs = Date.parse(announcement.expiresAt) - (Date.now() + serverOffsetMs);
    setVisible(remainingMs > 0);
    if (remainingMs <= 0) return;
    const timeout = window.setTimeout(() => setVisible(false), remainingMs);
    return () => window.clearTimeout(timeout);
  }, [announcement?.id, announcement?.expiresAt, serverTime]);

  if (!announcement || !visible) return null;
  return (
    <div className={`game-announcement game-announcement-${announcement.kind}`} role="alert" aria-live="assertive" aria-atomic="true">
      <div className="game-announcement-card">
        <span>{announcement.kind === "game_over" ? "Final result" : announcement.kind === "round_result" ? "Round complete" : announcement.kind === "buy_phase" ? "Shop open" : "Get ready"}</span>
        <h2>{announcement.title}</h2>
        <p>{announcement.message}</p>
        {announcement.detail && <strong>{announcement.detail}</strong>}
      </div>
    </div>
  );
}

function ArenaLoading({ label = "Loading arena" }: { label?: string }) {
  return (
    <div className="arena-frame arena-loading" role="status" aria-live="polite">
      <div className="arena-canvas">
        <strong>{label}</strong>
        <span>Preparing the fast web player...</span>
      </div>
    </div>
  );
}

export default function App() {
  const [routePath, setRoutePath] = useState(() => normalizeRoutePath(window.location.pathname));
  const isJoinRoute = routePath === "/join";
  const isGameRoute = routePath === "/game";
  const isQuizStrikeRoute = routePath === "/quiz-strike";
  const isCharacterLabRoute = routePath === "/character-lab";
  const isCharacterLabAvailable = import.meta.env.DEV;
  const [mode, setMode] = useState<AppMode>(() => modeForRoute(routePath));
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [teacherAuthMode, setTeacherAuthMode] = useState<"login" | "signup">("login");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navigateTo = useCallback((nextPath: string, nextMode = modeForRoute(normalizeRoutePath(nextPath))) => {
    const normalizedPath = normalizeRoutePath(nextPath);
    if (window.location.pathname !== normalizedPath) window.history.pushState(null, "", normalizedPath);
    setRoutePath(normalizedPath);
    setMode(nextMode);
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
    if (isJoinRoute || isGameRoute || isCharacterLabRoute || !isQuizStrikeRoute) return;
    if (!localStorage.getItem("quizstrike_token")) return;
    authApi
      .me()
      .then((payload) => {
        const data = payload as { user: TeacherUser };
        setTeacher(data.user);
        setMode("teacher");
      })
      .catch(() => localStorage.removeItem("quizstrike_token"));
  }, [isJoinRoute, isGameRoute, isQuizStrikeRoute, isCharacterLabRoute]);

  const logout = () => {
    localStorage.removeItem("quizstrike_token");
    setTeacher(null);
    navigateTo("/", "home");
  };

  return (
    <main id="main-content" className="app-shell" tabIndex={-1}>
      <a className={`skip-link skip-link-${mode}`} href="#main-content">Skip to main content</a>
      <header className={`topbar topbar-${mode}${teacher ? " teacher-authenticated" : ""}`}>
        <button className="brand-button" onClick={() => navigateTo("/", "home")}>
          <span>QuizStrike</span>
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
              <button onClick={() => { setTeacherAuthMode("signup"); navigateTo("/quiz-strike", "teacher"); }}>Sign Up</button>
              <button onClick={() => navigateTo("/join", "student")}>Join Game</button>
              <button className="nav-login" onClick={() => { setTeacherAuthMode("login"); navigateTo("/quiz-strike", "teacher"); }}>Login</button>
            </>
          ) : <>
          <button className={mode === "quizStrike" ? "active" : ""} onClick={() => navigateTo("/quiz-strike", "quizStrike")}>
            <Play size={18} aria-hidden="true" />
            Quiz-Strike
          </button>
          <button className={mode === "student" ? "active" : ""} onClick={() => navigateTo("/join", "student")}>
            <DoorOpen size={18} aria-hidden="true" />
            Join Game
          </button>
          {teacher ? (
            <>
              <button className={mode === "teacher" ? "active" : ""} onClick={() => navigateTo("/quiz-strike", "teacher")}>
                <GraduationCap size={18} aria-hidden="true" />
                Teacher Dashboard
              </button>
              <button onClick={logout}>
                <LogOut size={18} aria-hidden="true" />
                Sign Out
              </button>
            </>
          ) : (
            <button className={mode === "teacher" ? "active" : ""} onClick={() => { setTeacherAuthMode("login"); navigateTo("/quiz-strike", "teacher"); }}>
              <GraduationCap size={18} aria-hidden="true" />
              Teacher Login
            </button>
          )}
          </>}
          </div>
        </nav>
      </header>

      {mode === "home" && <GyakutenEigoHome onOpenGame={() => navigateTo("/quiz-strike", "quizStrike")} onJoinGame={() => navigateTo("/join", "student")} />}
      {mode === "quizStrike" && <QuizStrikeLanding onTeacherLogin={() => { setTeacherAuthMode("login"); navigateTo("/quiz-strike", "teacher"); }} onTeacherSignup={() => { setTeacherAuthMode("signup"); navigateTo("/quiz-strike", "teacher"); }} onStudent={() => navigateTo("/join", "student")} />}
      {mode === "characterLab" && (isCharacterLabAvailable ? <CharacterLab /> : <InternalToolNotice onReturn={() => navigateTo("/quiz-strike", "quizStrike")} />)}
      {mode === "teacher" &&
        (teacher ? <TeacherDashboard teacher={teacher} onLogout={logout} /> : <TeacherAuth initialMode={teacherAuthMode} onAuthed={(user) => {
          setTeacher(user);
          navigateTo("/quiz-strike", "teacher");
        }} />)}
      {mode === "student" && <StudentExperience onExit={() => navigateTo("/quiz-strike", "quizStrike")} />}
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
  const [count, setCount] = useState<CharacterStressCount>(40);
  const [isMoving, setIsMoving] = useState(true);
  const [tick, setTick] = useState(0);
  const [labMapId, setLabMapId] = useState<ArenaMapId>("desert_citadel");
  const [labQuality, setLabQuality] = useState<ArenaQuality>("balanced");
  const session = useMemo(() => {
    const generated = createCharacterDebugSession({ count, tick });
    return { ...generated, settings: { ...generated.settings, mapId: labMapId } };
  }, [count, tick, labMapId]);
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
          </div>
          <div className="button-row" aria-label="Character lab quality">
            <button className={labQuality === "performance" ? "active" : ""} onClick={() => setLabQuality("performance")}>Low</button>
            <button className={labQuality === "balanced" ? "active" : ""} onClick={() => setLabQuality("balanced")}>Medium</button>
            <button className={labQuality === "high" ? "active" : ""} onClick={() => setLabQuality("high")}>High</button>
          </div>
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
              session={session}
              debugOverlay
              debugLabel={`${count}-player character stress`}
              quality={labQuality}
            />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

function GyakutenEigoHome({ onOpenGame, onJoinGame }: { onOpenGame: () => void; onJoinGame: () => void }) {
  return (
    <div className="product-home rescued-home">
      <section className="site-home">
        <div className="site-home-copy">
          <span className="eyebrow">GyakutenEigo · classroom game lab</span>
          <h1>Make every answer change the match.</h1>
          <p>Launch a private team arena where quiz progress powers the action.</p>
          <div className="hero-proof-row" aria-label="Product qualities">
            <span><Shield size={16} aria-hidden="true" />Private room codes</span>
            <span><BookOpen size={16} aria-hidden="true" />Teacher-made questions</span>
            <span><Users size={16} aria-hidden="true" />Team competition</span>
          </div>
          <div className="button-row">
            <button className="primary" onClick={onOpenGame}>
              <Play size={18} aria-hidden="true" />
              Open Teacher Workspace
            </button>
            <button onClick={onJoinGame}>
              <DoorOpen size={18} aria-hidden="true" />
              Student Join
            </button>
          </div>
        </div>
        <article className="game-host-card">
          <span className="game-host-card-label">Live classroom game · QuizStrike</span>
          <div className="hero-arena-preview" aria-hidden="true">
            <img className="game-host-card-art" src="/assets/quizstrike-classroom-hero.png" alt="" />
          </div>
          <span className="game-preview-objective"><Target size={16} aria-hidden="true" />Answer · earn · capture</span>
          <strong>Desert Citadel</strong>
          <small>Ramparts. Waterworks. Caravan Quarter. Two gate courts.</small>
        </article>
      </section>

      <section className="landing-section product-intro" aria-labelledby="why-play-title">
        <div className="section-kicker">Built for the classroom moment</div>
        <h2 id="why-play-title">Fast to launch. Hard to tune out.</h2>
        <div className="value-card-grid">
          <article><BookOpen size={22} aria-hidden="true" /><h3>Fast setup</h3><p>Pick a quiz. Open a room.</p></article>
          <article><Target size={22} aria-hidden="true" /><h3>Team energy</h3><p>Every learner affects the round.</p></article>
          <article><Shield size={22} aria-hidden="true" /><h3>Clear control</h3><p>Run the match from one workspace.</p></article>
        </div>
      </section>

      <section className="landing-section mode-section" aria-labelledby="modes-title">
        <div>
          <span className="eyebrow">More than a quiz screen</span>
          <h2 id="modes-title">Three ways to turn review into a round.</h2>
        </div>
        <div className="mode-card-grid">
          <article className="mode-card flag-mode-card"><span>01</span><h3>Flag Mode</h3><p>Red delivers and protects the flag. Blue defends and captures. The scoreboard keeps the objective visible.</p></article>
          <article className="mode-card zombie-mode-card"><span>02</span><h3>Zombie Mode</h3><p>Humans hold the arena while conversions change the teams. Roles are visible in the game and scoreboards.</p></article>
          <article className="mode-card classic-mode-card"><span>03</span><h3>Classic Practice</h3><p>A simple team round for introducing the controls, reviewing a set, or running a quick warmup.</p></article>
        </div>
      </section>

      <section className="landing-section classroom-flow-section" aria-labelledby="classroom-flow-title">
        <div>
          <span className="eyebrow">A simple classroom flow</span>
          <h2 id="classroom-flow-title">From question set to game recap in four clear steps.</h2>
        </div>
        <ol className="classroom-flow">
          <li><span>1</span><strong>Create a quiz set</strong><p>Paste study terms or add your own multiple-choice questions.</p></li>
          <li><span>2</span><strong>Open a private room</strong><p>Choose a mode, timing, rewards, and classroom settings.</p></li>
          <li><span>3</span><strong>Share the join code</strong><p>Students join from a browser with a nickname—no student email required.</p></li>
          <li><span>4</span><strong>Review the round</strong><p>Use participation, accuracy, and missed-question data to guide the next lesson.</p></li>
        </ol>
      </section>

      <section className="landing-section faq-section" aria-labelledby="faq-title">
        <div><span className="eyebrow">Teacher questions</span><h2 id="faq-title">Ready for a real classroom, not a demo carousel.</h2></div>
        <div className="faq-list">
          <details open><summary>What do students need?</summary><p>A current desktop, Chromebook, or laptop browser and the private code from their teacher.</p></details>
          <details><summary>Can a teacher control the room?</summary><p>Yes. Teachers create and start sessions, select modes and settings, monitor the roster, and end a session when the class is ready.</p></details>
          <details><summary>What happens after the game?</summary><p>The teacher dashboard keeps a session report with participation and question-accuracy information for follow-up review.</p></details>
        </div>
      </section>

      <section className="landing-final-cta">
        <span className="eyebrow">Start the next review round</span>
        <h2>Bring the questions. We’ll bring the game loop.</h2>
        <div className="button-row"><button className="primary" onClick={onOpenGame}><Play size={18} aria-hidden="true" />Open Teacher Workspace</button></div>
      </section>
    </div>
  );
}

function QuizStrikeLanding({ onTeacherSignup }: { onTeacherLogin: () => void; onTeacherSignup: () => void; onStudent: () => void }) {
  return (
    <div className="quizstrike-page">
      <section className="landing-grid landing-story">
        <article className="founder-card">
          <p>Hi! I’m Peter</p>
          <p>I started <strong>QuizStrike</strong> because I wanted to bring esports and classroom learning together.</p>
          <p>Esports taught me valuable skills that I never learned in school, and it opened my world to new experiences, communities, and opportunities. I also saw how games can keep students motivated, focused, and actively involved in the learning process.</p>
          <p>That inspired me to build <strong>QuizStrike</strong>—a new bridge between esports and education, designed to make classroom learning more engaging, competitive, and fun.</p>
          <p>I can’t wait for you to try it!</p>
        </article>
        <button className="landing-signup" onClick={onTeacherSignup}>Sign Up for Free</button>
      </section>
    </div>
  );
}

function TeacherAuth({ onAuthed, initialMode }: { onAuthed: (user: TeacherUser) => void; initialMode: "login" | "signup" }) {
  const [isSignup, setIsSignup] = useState(initialMode === "signup");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const status = useAsyncMessage();

  useEffect(() => setIsSignup(initialMode === "signup"), [initialMode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    status.clear();
    setIsSubmitting(true);
    try {
      const payload = (isSignup ? await authApi.signup(form) : await authApi.login(form)) as AuthPayload;
      localStorage.setItem("quizstrike_token", payload.token);
      onAuthed(payload.user);
    } catch (err) {
      status.report(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-layout">
      <div>
        <h1>{isSignup ? "Teacher Sign Up" : "Teacher Login"}</h1>
        <p>Create quiz sets, start private sessions, and review student results from one calm classroom workspace.</p>
      </div>
      <form className="panel form-panel" onSubmit={submit}>
        {isSignup && (
          <label>
            Name
            <input autoComplete="name" value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); status.clearError(); }} />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            value={form.email}
            onChange={(event) => { setForm({ ...form, email: event.target.value }); status.clearError(); }}
          />
        </label>
        <label>
          Password
          <span className="password-field">
            <input
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
        <StatusMessages error={status.error} />
        <button className="primary" type="submit" disabled={isSubmitting}>
          <GraduationCap size={18} aria-hidden="true" />
          {isSubmitting ? "Working..." : isSignup ? "Create Account" : "Log In"}
        </button>
        <button className="text-button" type="button" onClick={() => setIsSignup(!isSignup)} disabled={isSubmitting}>
          {isSignup ? "Use existing account" : "Create a teacher account"}
        </button>
      </form>
    </section>
  );
}

function TeacherDashboard({ teacher, onLogout }: { teacher: TeacherUser; onLogout: () => void }) {
  const [tab, setTab] = useState<"home" | "quizzes" | "sessions" | "reports">("home");
  const [data, setData] = useState<DashboardPayload>({ classes: [], quizSets: [], sessions: [] });
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [isSocketReconnecting, setIsSocketReconnecting] = useState(false);
  const status = useAsyncMessage();

  const refresh = useCallback(async () => {
    try {
      const payload = (await teacherApi.dashboard()) as DashboardPayload;
      setData(payload);
      setSelectedSession((current) => {
        if (!current) return payload.sessions[0] ?? null;
        return payload.sessions.find((session) => session.id === current.id) ?? payload.sessions[0] ?? null;
      });
    } catch (err) {
      status.report(err);
    }
  }, [status.report]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedSession) return;
    const socket: Socket = io(getApiUrl());
    socket.emit("join_session_room", selectedSession.sessionCode);
    socket.on("connect", () => {
      setIsSocketReconnecting(false);
      socket.emit("join_session_room", selectedSession.sessionCode);
    });
    socket.on("connect_error", () => setIsSocketReconnecting(true));
    socket.on("disconnect", () => setIsSocketReconnecting(true));
    socket.on("session_state", (session: GameSession) => {
      setIsSocketReconnecting(false);
      setSelectedSession(session);
      setData((current) => ({
        ...current,
        sessions: current.sessions.map((item) => (item.id === session.id ? session : item))
      }));
    });
    return () => {
      setIsSocketReconnecting(false);
      socket.disconnect();
    };
  }, [selectedSession?.sessionCode]);

  const activeSessions = data.sessions.filter((session) => session.status !== "ended");

  return (
    <section className="workspace">
      <div className="dashboard-brand-row">
        <h1>Quiz Strike</h1>
        <div><strong>{teacher.name}</strong><button onClick={onLogout}>Sign Out</button></div>
      </div>
      <aside className="sidebar" aria-label="Teacher sections">
        <button aria-current={tab === "home" ? "page" : undefined} className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>
          Folders
        </button>
        <button aria-current={tab === "reports" ? "page" : undefined} className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>
          Reports
        </button>
      </aside>

      <div className="main-panel">
        <div className="section-heading dashboard-section-heading">
          <div>
            <span className="eyebrow">Teacher control center</span>
            <h1>Classroom command center</h1>
            <p>Build, launch, and monitor every round.</p>
          </div>
          <button onClick={refresh}>
            <RefreshCw size={18} aria-hidden="true" />
            Refresh
          </button>
        </div>
        <StatusMessages error={status.error} message={status.message} />
        {isSocketReconnecting && (
          <p className="connection-banner">
            <WifiOff size={16} aria-hidden="true" />
            Reconnecting...
          </p>
        )}

        {tab === "home" && <TeacherFolders data={data} onTab={setTab} />}
        {tab === "quizzes" && <QuizManager data={data} onRefresh={refresh} />}
        {tab === "sessions" && (
          <SessionManager
            data={data}
            selectedSession={selectedSession}
            setSelectedSession={setSelectedSession}
            onRefresh={refresh}
            onReport={setReport}
            onOpenReports={() => setTab("reports")}
          />
        )}
        {tab === "reports" && (
          <ReportsPanel sessions={data.sessions} report={report} setReport={setReport} setTab={setTab} />
        )}

        {activeSessions.length > 0 && (
          <div className="live-rail">
            {activeSessions.map((session) => (
              <button
                key={session.id}
                className={selectedSession?.id === session.id ? "active session-chip" : "session-chip"}
                onClick={() => {
                  setSelectedSession(session);
                  setTab("sessions");
                }}
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

function TeacherFolders({ data, onTab }: { data: DashboardPayload; onTab: (tab: "quizzes" | "sessions") => void }) {
  return (
    <section className="teacher-folders">
      <div className="folders-heading">
        <h2>Folders</h2>
        <button className="folder-new" onClick={() => onTab("quizzes")}>New <Plus size={22} aria-hidden="true" /></button>
      </div>
      <div className="folder-chips" aria-label="Quiz folders">
        <button className="active"><Folder size={15} aria-hidden="true" />All kits</button>
        {data.classes.map((klass) => <button key={klass.id}><Folder size={15} aria-hidden="true" />{klass.name}</button>)}
        {data.classes.length === 0 && <><button><Folder size={15} aria-hidden="true" />1st Grade</button><button><Folder size={15} aria-hidden="true" />2nd Grade</button><button><Folder size={15} aria-hidden="true" />MISC</button></>}
      </div>
      <div className="folder-quiz-list">
        {data.quizSets.map((quiz) => (
          <article className="folder-quiz-row" key={quiz.id}>
            <div className="quiz-cover"><BookOpen size={26} aria-hidden="true" /></div>
            <div><h3>{quiz.title}</h3><small>{quiz.questions.length} questions · Created {new Date(quiz.createdAt).toLocaleDateString()}</small></div>
            <div className="folder-row-actions">
              <button className="play-live" onClick={() => onTab("sessions")}>Play Live</button>
              <button className="edit-set" onClick={() => onTab("quizzes")}>Edit Set</button>
            </div>
          </article>
        ))}
        {data.quizSets.length === 0 && (
          <div className="folder-empty"><BookOpen size={34} aria-hidden="true" /><h3>Your quiz sets will appear here</h3><p>Create the first set, then launch it live for your class.</p><button className="folder-new" onClick={() => onTab("quizzes")}>New Quiz <Plus size={18} aria-hidden="true" /></button></div>
        )}
      </div>
    </section>
  );
}

function DashboardHome({ data, onTab }: { data: DashboardPayload; onTab: (tab: "quizzes" | "sessions") => void }) {
  const activeSession = data.sessions.find((session) => session.status !== "ended");
  const totalQuestions = data.quizSets.reduce((total, quiz) => total + quiz.questions.length, 0);
  const studentsConnected = data.sessions.reduce((total, session) => total + session.players.length, 0);
  const recentSessions = data.sessions.slice(0, 4);
  const topLearner = activeSession ? getTopLearner(activeSession.players) : undefined;
  return (
    <div className="dashboard-home-grid">
      <section className="panel dashboard-command-card">
        <div>
          <span className={activeSession ? "dashboard-live-label active" : "dashboard-live-label"}>{activeSession ? "Live classroom room" : "Next classroom action"}</span>
          <h2>{activeSession ? `${activeSession.sessionCode} is ${sessionStatusLabel(activeSession.status).toLowerCase()}` : "Create a room when your quiz is ready."}</h2>
          <p>{activeSession ? `${gameModeLabel(activeSession.settings.gameMode)} · ${arenaMapLabel(activeSession.settings.mapId)} · ${activeSession.players.length} joined · ${topLearner ? `Top learner: ${topLearner.nickname}` : "Waiting for the first answer"}` : "Start with a quiz set, then choose the game mode and share one private code with the class."}</p>
        </div>
        <div className="button-row">
          <button className="primary" onClick={() => onTab(activeSession ? "sessions" : "quizzes")}>
            {activeSession ? <Play size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
            {activeSession ? "Open Live Control" : "Create New Quiz"}
          </button>
          {!activeSession && <button onClick={() => onTab("sessions")}><Target size={18} aria-hidden="true" />Create Session</button>}
        </div>
      </section>

      <section className="dashboard-metrics" aria-label="Classroom overview">
        <div className="metric"><span>Quiz sets</span><strong>{data.quizSets.length}</strong><small>{totalQuestions} total questions</small></div>
        <div className="metric"><span>Live rooms</span><strong>{data.sessions.filter((session) => session.status !== "ended").length}</strong><small>{activeSession ? gameModeLabel(activeSession.settings.gameMode) : "No room open"}</small></div>
        <div className="metric"><span>Students joined</span><strong>{studentsConnected}</strong><small>Across available sessions</small></div>
      </section>

      <section className="panel dashboard-workflow-card">
        <div className="panel-title"><h2>Classroom workflow</h2><span>Keep the next step obvious</span></div>
        <ol className="teacher-flow-list">
          <li><span>01</span><div><strong>Prepare questions</strong><small>Build a quiz set or turn pasted study terms into questions.</small></div><button onClick={() => onTab("quizzes")}>Quiz Sets</button></li>
          <li><span>02</span><div><strong>Open a private room</strong><small>Set the mode, timing, rewards, and student capacity.</small></div><button onClick={() => onTab("sessions")}>Sessions</button></li>
          <li><span>03</span><div><strong>Guide and review</strong><small>Watch the live roster, then use the report to follow up.</small></div><button onClick={() => onTab("sessions")}>Live Control</button></li>
        </ol>
      </section>

      <section className="panel dashboard-list-card">
        <div className="panel-title"><h2>Recent sessions</h2><span>{recentSessions.length ? `${recentSessions.length} available` : "No sessions yet"}</span></div>
        <ul className="dashboard-session-list">
          {recentSessions.map((session) => <li key={session.id}><div><strong>{session.sessionCode}</strong><small>{gameModeLabel(session.settings.gameMode)} · {arenaMapLabel(session.settings.mapId)} · {session.players.length} joined</small></div><span className={`status-pill status-${session.status}`}>{sessionStatusLabel(session.status)}</span></li>)}
          {recentSessions.length === 0 && <li className="dashboard-empty-state"><Target size={22} aria-hidden="true" /><div><strong>No sessions yet</strong><small>Your first private room will appear here after you create one.</small></div></li>}
        </ul>
      </section>

      <section className="panel dashboard-list-card">
        <div className="panel-title"><h2>Ready quiz sets</h2><span>{data.quizSets.length} saved</span></div>
        <ul className="dashboard-session-list">
          {data.quizSets.slice(0, 4).map((quiz) => <li key={quiz.id}><div><strong>{quiz.title}</strong><small>{quiz.questions.length} questions{quiz.description ? ` · ${quiz.description}` : ""}</small></div><button onClick={() => onTab("sessions")}>Host</button></li>)}
          {data.quizSets.length === 0 && <li className="dashboard-empty-state"><BookOpen size={22} aria-hidden="true" /><div><strong>No quiz sets yet</strong><small>Create a set first, then turn it into a game room.</small></div></li>}
        </ul>
      </section>
    </div>
  );
}

function QuizManager({ data, onRefresh }: { data: DashboardPayload; onRefresh: () => Promise<void> }) {
  const [selectedQuizId, setSelectedQuizId] = useState(data.quizSets[0]?.id ?? "");
  const [quizForm, setQuizForm] = useState({ title: "", description: "" });
  const [questionForm, setQuestionForm] = useState(emptyQuestion);
  const [bulkText, setBulkText] = useState("");
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const status = useAsyncMessage();

  useEffect(() => {
    if (!selectedQuizId && data.quizSets[0]) setSelectedQuizId(data.quizSets[0].id);
  }, [data.quizSets, selectedQuizId]);

  const selectedQuiz = data.quizSets.find((quiz) => quiz.id === selectedQuizId);
  const generatedQuestions = useMemo(() => createGeneratedQuestions(bulkText).slice(0, 80), [bulkText]);
  const importBadge = bulkText.trim() ? `${generatedQuestions.length} ready` : `${selectedQuiz?.questions.length ?? 0} in quiz`;

  const createQuiz = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCreatingQuiz) return;
    status.clear();
    setIsCreatingQuiz(true);
    try {
      const payload = (await teacherApi.createQuizSet(quizForm)) as { quizSet: QuizSet };
      setSelectedQuizId(payload.quizSet.id);
      setQuizForm({ title: "", description: "" });
      await onRefresh();
      status.setMessage("Quiz set created.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  const addQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedQuiz || isAddingQuestion) return;
    status.clear();
    setIsAddingQuestion(true);
    try {
      await teacherApi.addQuestion(selectedQuiz.id, questionForm);
      setQuestionForm(emptyQuestion);
      await onRefresh();
      status.setMessage("Question added.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsAddingQuestion(false);
    }
  };

  const importQuestions = async () => {
    if (!selectedQuiz || isImporting) return;
    status.clear();
    if (generatedQuestions.length === 0) {
      status.setError("Paste at least two study items first.");
      return;
    }

    setIsImporting(true);
    try {
      for (const draft of generatedQuestions) {
        await teacherApi.addQuestion(selectedQuiz.id, draft);
      }
      setBulkText("");
      await onRefresh();
      status.setMessage(`${generatedQuestions.length} questions generated from pasted study items.`);
    } catch (err) {
      status.report(err);
    } finally {
      setIsImporting(false);
    }
  };

  const importStudyFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    status.clear();
    try {
      setBulkText(await file.text());
      status.setMessage(`${file.name} loaded. Review the preview, then generate questions.`);
    } catch (err) {
      status.report(err);
    } finally {
      event.currentTarget.value = "";
    }
  };

  return (
    <div className="two-column">
      <form className="panel form-panel" onSubmit={createQuiz}>
        <h2>Create Quiz Set</h2>
        <label>
          Title
          <input value={quizForm.title} onChange={(event) => setQuizForm({ ...quizForm, title: event.target.value })} />
        </label>
        <label>
          Description
          <textarea
            value={quizForm.description}
            onChange={(event) => setQuizForm({ ...quizForm, description: event.target.value })}
          />
        </label>
        <button className="primary" type="submit" disabled={isCreatingQuiz}>
          <Plus size={18} aria-hidden="true" />
          {isCreatingQuiz ? "Working..." : "Create Quiz Set"}
        </button>
      </form>

      <div className="panel">
        <h2>Quiz Editor</h2>
        <label>
          Quiz Sets
          <select value={selectedQuizId} onChange={(event) => setSelectedQuizId(event.target.value)}>
            {data.quizSets.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </select>
        </label>
        {selectedQuiz ? (
          <>
            <div className="import-builder">
              <div className="panel-title">
                <h3>Paste-to-Quiz Builder</h3>
                <span>{importBadge}</span>
              </div>
              <p>
                Paste terms, vocabulary, or term-definition pairs. Each line can use a dash, colon, vertical bar, or tab.
              </p>
              <textarea
                className="bulk-textarea"
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                placeholder={sampleImportText}
              />
              <div className="button-row">
                <label className="file-import-button">
                  <input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" onChange={importStudyFile} />
                  <ClipboardPaste size={18} aria-hidden="true" />
                  Upload File
                </label>
                <button type="button" onClick={() => setBulkText(sampleImportText)}>
                  <ClipboardPaste size={18} aria-hidden="true" />
                  Use Sample
                </button>
                <button className="primary" type="button" onClick={importQuestions} disabled={isImporting}>
                  <WandSparkles size={18} aria-hidden="true" />
                  {isImporting ? "Working..." : "Generate Questions"}
                </button>
              </div>
              {generatedQuestions.length > 0 && (
                <div className="import-preview">
                  <strong>Preview {Math.min(5, generatedQuestions.length)} generated cards</strong>
                  <div className="import-preview-list">
                    {generatedQuestions.slice(0, 5).map((draft, index) => (
                      <div key={`${draft.prompt}-${index}`} className="import-preview-item">
                        <span>{index + 1}. {draft.prompt}</span>
                        <small>Correct answer: {getDraftChoiceText(draft)}</small>
                      </div>
                    ))}
                  </div>
                  <small>{generatedQuestions.length} questions will be added to this quiz.</small>
                </div>
              )}
            </div>

            <form className="question-form" onSubmit={addQuestion}>
              <label>
                Question Prompt
                <textarea
                  value={questionForm.prompt}
                  onChange={(event) => setQuestionForm({ ...questionForm, prompt: event.target.value })}
                />
              </label>
              <div className="choice-grid">
                {choices.map((choice) => (
                  <label key={choice}>
                    Choice {choice}
                    <input
                      value={questionForm[`choice${choice}` as keyof typeof questionForm]}
                      onChange={(event) => setQuestionForm({ ...questionForm, [`choice${choice}`]: event.target.value })}
                    />
                  </label>
                ))}
              </div>
              <div className="choice-grid">
                <label>
                  Correct Answer
                  <select
                    value={questionForm.correctChoice}
                    onChange={(event) => setQuestionForm({ ...questionForm, correctChoice: event.target.value })}
                  >
                    {choices.map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Difficulty
                  <input
                    value={questionForm.difficulty}
                    onChange={(event) => setQuestionForm({ ...questionForm, difficulty: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Explanation
                <textarea
                  value={questionForm.explanation}
                  onChange={(event) => setQuestionForm({ ...questionForm, explanation: event.target.value })}
                />
              </label>
              <button className="primary" type="submit" disabled={isAddingQuestion}>
                <Plus size={18} aria-hidden="true" />
                {isAddingQuestion ? "Working..." : "Add Question"}
              </button>
            </form>
            <ul className="question-list">
              {selectedQuiz.questions.map((question, index) => (
                <li key={question.id}>
                  <strong>{index + 1}. {question.prompt}</strong>
                  <span>Answer {question.correctChoice}</span>
                </li>
              ))}
              {selectedQuiz.questions.length === 0 && <li>No questions yet.</li>}
            </ul>
          </>
        ) : (
          <p>Create a quiz set to begin adding questions.</p>
        )}
        <StatusMessages error={status.error} message={status.message} />
      </div>
    </div>
  );
}

function SessionManager({
  data,
  selectedSession,
  setSelectedSession,
  onRefresh,
  onReport,
  onOpenReports
}: {
  data: DashboardPayload;
  selectedSession: GameSession | null;
  setSelectedSession: (session: GameSession | null) => void;
  onRefresh: () => Promise<void>;
  onReport: (report: SessionReport | null) => void;
  onOpenReports: () => void;
}) {
  const [quizSetId, setQuizSetId] = useState(data.quizSets[0]?.id ?? "");
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SESSION_SETTINGS);
  const [settingInputs, setSettingInputs] = useState<Record<SessionNumberField, string>>(() =>
    createSessionSettingInputs(DEFAULT_SESSION_SETTINGS)
  );
  const [invalidSettings, setInvalidSettings] = useState<Partial<Record<SessionNumberField, boolean>>>({});
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [isJoinLinkCopied, setIsJoinLinkCopied] = useState(false);
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false);
  const [isProjectorOpen, setIsProjectorOpen] = useState(false);
  const endSessionTriggerRef = useRef<HTMLButtonElement>(null);
  const endSessionDialogRef = useRef<HTMLDivElement>(null);
  const keepSessionOpenRef = useRef<HTMLButtonElement>(null);
  const projectorDialogRef = useRef<HTMLElement>(null);
  const projectorCloseRef = useRef<HTMLButtonElement>(null);
  const status = useAsyncMessage();
  const remainingSeconds = useRoundRemaining(selectedSession);
  const selectedMap = getArenaMap(settings.mapId);
  const studentJoinLink = selectedSession
    ? buildStudentJoinUrl(window.location.origin, selectedSession.sessionCode)
    : "";
  const isLocalOnlyJoinLink = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  useEffect(() => {
    if (!quizSetId && data.quizSets[0]) setQuizSetId(data.quizSets[0].id);
  }, [data.quizSets, quizSetId]);

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
  }, [isEndConfirmOpen]);

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
  }, [isProjectorOpen]);

  const hasInvalidSettings = Object.values(invalidSettings).some(Boolean);

  const applyPreset = (presetSettings: SessionSettings) => {
    const nextSettings = { ...presetSettings, mapId: settings.mapId };
    setSettings(nextSettings);
    setSettingInputs(createSessionSettingInputs(nextSettings));
    setInvalidSettings({});
  };

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
      status.setMessage(`Session ${payload.session.sessionCode} created.`);
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
      status.setError(startCheck.reason === "session_ended" ? "This session has ended." : "Add at least one student before starting.");
      return;
    }
    status.clear();
    setIsStartingSession(true);
    try {
      const payload = (await teacherApi.startSession(selectedSession.sessionCode)) as { session: GameSession };
      setSelectedSession(payload.session);
      setIsProjectorOpen(false);
      await onRefresh();
      status.setMessage("Round started.");
    } catch (err) {
      status.report(err);
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
      status.setMessage("Session ended. Report is ready.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsEndingSession(false);
    }
  };

  const topLearner = selectedSession ? getTopLearner(selectedSession.players) : undefined;
  const teamTotals = selectedSession ? getTeamTotals(selectedSession.players) : { blue: 0, red: 0 };
  const zombieCounts = selectedSession ? getZombieCounts(selectedSession.players) : { humans: 0, zombies: 0 };
  const activePlayers = selectedSession?.players.filter((player) => player.connectionState !== "disconnected" && player.isAlive).length ?? 0;
  const startCheck = selectedSession ? canStartRound(selectedSession) : undefined;
  const startBlockedReason =
    startCheck && !startCheck.ok
      ? startCheck.reason === "session_ended"
        ? "This session has ended."
        : "Add at least one student before starting."
      : "";
  const shouldShowSetup = !selectedSession || selectedSession.status === "ended";
  const isSessionEnded = selectedSession?.status === "ended";
  const visibleNumberFields = sessionNumberFields.filter((field) => {
    if (settings.gameMode === "flag") return field.name !== "initialZombieCount";
    if (settings.gameMode === "zombie") return field.name !== "roundCount" && field.name !== "flagHoldSeconds";
    return field.name !== "flagHoldSeconds" && field.name !== "initialZombieCount";
  });

  const addBot = async () => {
    if (!selectedSession || isAddingBot) return;
    status.clear();
    setIsAddingBot(true);
    try {
      const payload = (await teacherApi.addBot(selectedSession.sessionCode)) as { session: GameSession };
      setSelectedSession(payload.session);
      await onRefresh();
      status.setMessage("Bot added for testing.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsAddingBot(false);
    }
  };

  const updateLiveCustomization = async (next: CharacterCustomizationSettings) => {
    if (!selectedSession) return;
    status.clear();
    try {
      const payload = await teacherApi.updateCustomization(selectedSession.sessionCode, next) as { session: GameSession };
      setSelectedSession(payload.session);
      status.setMessage("Character rules updated.");
    } catch (err) {
      status.report(err);
    }
  };

  const clearPlayerAppearance = async (playerId: string) => {
    if (!selectedSession) return;
    try {
      const payload = await teacherApi.clearPlayerAppearance(selectedSession.sessionCode, playerId) as { session: GameSession };
      setSelectedSession(payload.session);
      status.setMessage("Player appearance reset.");
    } catch (err) {
      status.report(err);
    }
  };

  const resetAllAppearances = async () => {
    if (!selectedSession) return;
    try {
      const payload = await teacherApi.resetAppearances(selectedSession.sessionCode) as { session: GameSession };
      setSelectedSession(payload.session);
      status.setMessage("All player appearances reset.");
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
    status.setMessage("Sticker removed from the room.");
  };

  const loadTeacherDecal = useCallback(
    (assetId: string) => selectedSession
      ? fetchDecalAsset(selectedSession.sessionCode, assetId)
      : Promise.reject(new Error("No active room.")),
    [selectedSession?.sessionCode]
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
      status.setMessage("Student join link copied.");
    } catch {
      status.setError("Copy was not available. Select the link and copy it manually.");
    }
  };

  return (
    <div className={shouldShowSetup ? "two-column session-grid" : "session-grid live-first-grid"}>
      <form className={shouldShowSetup ? "panel form-panel" : "panel form-panel session-setup-minimized"} onSubmit={createSession}>
        <h2>Create Session</h2>
        {!shouldShowSetup && (
          <p className="setup-lock-note">Live room is in focus. End this session before creating another room.</p>
        )}
        <label>
          Quiz Set
          <select value={quizSetId} onChange={(event) => setQuizSetId(event.target.value)}>
            {data.quizSets.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title} ({quiz.questions.length})
              </option>
            ))}
          </select>
        </label>
        <label>
          Game Mode
          <select
            value={settings.gameMode}
            onChange={(event) => {
              const gameMode = event.target.value as SessionSettings["gameMode"];
              const nextSettings: SessionSettings = {
                ...settings,
                gameMode,
                roundDurationSeconds: gameMode === "flag" ? FLAG_MODE_DEFAULTS.roundDurationSeconds : settings.roundDurationSeconds
              };
              setSettings(nextSettings);
              setSettingInputs(createSessionSettingInputs(nextSettings));
            }}
          >
            <option value="flag">Flag Mode</option>
            <option value="zombie">Zombie Mode</option>
            <option value="classic">Classic Tag Practice</option>
          </select>
        </label>
        <label>
          Battlefield Map
          <select
            value={settings.mapId}
            onChange={(event) => setSettings({ ...settings, mapId: event.target.value as ArenaMapId })}
          >
            {ARENA_MAPS.map((map) => (
              <option key={map.id} value={map.id}>
                {map.title}
              </option>
            ))}
          </select>
          <small className="field-help">{selectedMap.description}</small>
        </label>
        <div className={`map-selection-card map-${selectedMap.id}`} aria-live="polite">
          <div className="map-selection-card__eyebrow">Selected battlefield</div>
          <strong>{selectedMap.title}</strong>
          <span>{selectedMap.districts.slice(0, 3).join(" · ")}</span>
          {selectedMap.id === "iron_junction" && <small>Generated from the Iron Junction industrial railway brief · three lanes · balanced East/West spawns</small>}
        </div>
        {settings.gameMode === "flag" && (
          <label>
            Team Assignment
            <select
              value={settings.teamAssignment}
              onChange={(event) => setSettings({ ...settings, teamAssignment: event.target.value as SessionSettings["teamAssignment"] })}
            >
              <option value="players_choose">Players Choose</option>
              <option value="random">Randomize Teams</option>
            </select>
          </label>
        )}
        <div className="preset-grid" aria-label="Session presets">
          {SESSION_PRESETS.map((preset) => (
            <button type="button" key={preset.name} onClick={() => { applyPreset(preset.settings); status.setMessage(`${preset.name} applied: ${preset.description}`); }}>
              <strong>{preset.name}</strong>
              <small>{preset.description}</small>
            </button>
          ))}
        </div>
        <div className="session-setting-groups">
          {sessionSettingGroups.map((group) => {
            const fields = group.fields
              .map((name) => sessionNumberFields.find((field) => field.name === name))
              .filter((field): field is (typeof sessionNumberFields)[number] => Boolean(field && visibleNumberFields.includes(field)));
            if (fields.length === 0) return null;
            return (
              <fieldset key={group.title}>
                <legend>{group.title}</legend>
                <p>{group.description}</p>
                <div className="session-setting-grid">
                  {fields.map((field) => {
                    const errorId = `session-setting-${field.name}-error`;
                    const unit = "unit" in field ? field.unit : undefined;
                    return (
                      <label key={field.name}>
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
                        <small>{field.help}</small>
                        {invalidSettings[field.name] && <small id={errorId} className="field-error" role="alert">Use a value from {field.min} to {field.max}{unit ? ` ${unit}` : ""}.</small>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.deadPlayersCanPractice}
            onChange={(event) => setSettings({ ...settings, deadPlayersCanPractice: event.target.checked })}
          />
          Allow practice questions while out for the round
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.deadPlayersEarnMoney}
            onChange={(event) => setSettings({ ...settings, deadPlayersEarnMoney: event.target.checked })}
          />
          Students out for the round can earn money
        </label>
        <fieldset className="customization-settings">
          <legend>Lobby Characters</legend>
          <p>School-safe presets are always available. Image uploads start off.</p>
          <label className="toggle-row"><input type="checkbox" checked={settings.characterCustomization.enabled} onChange={(event) => setSettings({ ...settings, characterCustomization: { ...settings.characterCustomization, enabled: event.target.checked } })} />Enable character creator</label>
          <label className="toggle-row"><input type="checkbox" checked={settings.characterCustomization.uploadsEnabled} disabled={!settings.characterCustomization.enabled} onChange={(event) => setSettings({ ...settings, characterCustomization: { ...settings.characterCustomization, uploadsEnabled: event.target.checked } })} />Allow processed artwork stickers</label>
          <label className="toggle-row"><input type="checkbox" checked={settings.characterCustomization.presetsOnly} disabled={!settings.characterCustomization.enabled} onChange={(event) => setSettings({ ...settings, characterCustomization: { ...settings.characterCustomization, presetsOnly: event.target.checked } })} />Approved presets only</label>
          <label className="toggle-row"><input type="checkbox" checked={settings.characterCustomization.persistAcrossSessions} disabled={!settings.characterCustomization.enabled} onChange={(event) => setSettings({ ...settings, characterCustomization: { ...settings.characterCustomization, persistAcrossSessions: event.target.checked } })} />Let this browser remember non-image choices</label>
          <label className="toggle-row"><input type="checkbox" checked={false} disabled />AI designs (secure provider not configured)</label>
        </fieldset>
        {hasInvalidSettings && <p className="error-text">Check the number fields before starting a game.</p>}
        <button className="primary" type="submit" disabled={!shouldShowSetup || !quizSetId || hasInvalidSettings || isCreatingSession}>
          <Play size={18} aria-hidden="true" />
          {isCreatingSession ? "Working..." : "Create Session"}
        </button>
        <StatusMessages error={status.error} message={status.message} />
      </form>

      <div className={`panel live-session${selectedSession ? "" : " empty-live-session"}`}>
        <h2>Live Session Control</h2>
        {selectedSession && <GameAnnouncementOverlay announcement={selectedSession.announcement} serverTime={selectedSession.serverTime} />}
        {selectedSession ? isSessionEnded ? (
          <div className="session-ended-summary">
            <span className="status-pill status-ended">Session complete</span>
            <h3>{gameModeLabel(selectedSession.settings.gameMode)} has ended</h3>
            <p>The room is closed. Students can view their summary, and the full class learning report is ready.</p>
            <dl>
              <div><dt>Final players</dt><dd>{selectedSession.players.length}</dd></div>
              <div><dt>Final outcome</dt><dd>{getModeScoreSummary(selectedSession)}</dd></div>
              <div><dt>Top learner</dt><dd>{topLearner?.nickname ?? "No answers recorded"}</dd></div>
            </dl>
            <div className="button-row">
              <button className="primary" onClick={onOpenReports}><Download size={18} aria-hidden="true" />View Learning Report</button>
              <button onClick={() => setSelectedSession(null)}>Create Another Session</button>
            </div>
          </div>
        ) : (
          <>
            <div className="live-summary">
              <span className={`status-pill status-${selectedSession.status}`}>{isRoundBuyPhase(selectedSession) ? "Buy Phase" : sessionStatusLabel(selectedSession.status)}</span>
              <span>{gameModeLabel(selectedSession.settings.gameMode)}</span>
              <span>{arenaMapLabel(selectedSession.settings.mapId)}</span>
              {selectedSession.settings.gameMode === "flag" && <span>Round {selectedSession.currentRound}/{selectedSession.settings.roundCount}</span>}
              <span>Time {formatDuration(remainingSeconds)}</span>
              <span>{activePlayers}/{selectedSession.players.length || 0} active</span>
              <span>
                {selectedSession.settings.gameMode === "zombie"
                  ? `Humans ${zombieCounts.humans} - Zombies ${zombieCounts.zombies}`
                  : `Blue ${teamTotals.blue} - Red ${teamTotals.red}`}
              </span>
              <span>{topLearner ? `Top learner: ${topLearner.nickname}` : "No learners yet"}</span>
            </div>
            <div className="join-code">
              <span>Join Code</span>
              <strong>{selectedSession.sessionCode}</strong>
            </div>
            <div className="join-link-share">
              <div className="join-link-content">
                <span className="join-link-label"><Link2 size={16} aria-hidden="true" />Student Join Link</span>
                <div className="join-link-url-row">
                  <input
                    aria-label="Student join link"
                    value={studentJoinLink}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                    onClick={(event) => event.currentTarget.select()}
                  />
                  <a href={studentJoinLink} target="_blank" rel="noreferrer" aria-label="Open student join link">Open</a>
                </div>
                <small>Students open this link and enter only their name.</small>
              </div>
              <button type="button" onClick={copyStudentJoinLink} aria-label="Copy student join link">
                {isJoinLinkCopied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                {isJoinLinkCopied ? "Copied" : "Copy Link"}
              </button>
            </div>
            {isLocalOnlyJoinLink && (
              <p className="network-share-warning" role="status">
                This link works only on this computer. For student devices, open this teacher page using the Wi-Fi address shown by the app server, then share the new link.
              </p>
            )}
            <p className="mini-copy">
              If a player is frozen out, they can answer {RESPAWN_CORRECT_ANSWERS_REQUIRED} correct practice questions to respawn.
            </p>
            {selectedSession.status === "waiting" && startBlockedReason && <p className="mini-copy">{startBlockedReason}</p>}
            <div className="button-row">
              {selectedSession.status === "waiting" && (
                <button type="button" className="projector-button" onClick={() => setIsProjectorOpen(true)}>
                  <Eye size={18} aria-hidden="true" />
                  Project Waiting Room
                </button>
              )}
              {selectedSession.status === "active" ? (
                <span className="status-pill status-active">Round Active</span>
              ) : selectedSession.status === "paused" ? (
                <span className="status-pill status-paused">{isRoundBuyPhase(selectedSession) ? "Buy phase..." : "Next round starting..."}</span>
              ) : (
                <button className="primary" onClick={start} disabled={selectedSession.status === "ended" || Boolean(startBlockedReason) || isStartingSession}>
                  <Play size={18} aria-hidden="true" />
                  {isStartingSession ? "Working..." : startBlockedReason ? "Waiting for Students" : "Begin Round"}
                </button>
              )}
              <button ref={endSessionTriggerRef} onClick={() => setIsEndConfirmOpen(true)} disabled={selectedSession.status === "ended" || isEndingSession}>
                {isEndingSession ? "Working..." : "End Session"}
              </button>
              <button onClick={addBot} disabled={selectedSession.players.length >= selectedSession.maxPlayers || isAddingBot}>
                <Plus size={18} aria-hidden="true" />
                {isAddingBot ? "Working..." : "Add Bot"}
              </button>
            </div>
            <section className="teacher-customization-controls" aria-label="Character customization controls">
                <div><h3>Lobby Characters</h3><p>Uploads are room-only and disabled unless you approve them.</p></div>
                <div className="teacher-customization-toggles">
                  <label className="toggle-row"><input type="checkbox" checked={selectedSession.settings.characterCustomization.enabled} disabled={selectedSession.status !== "waiting"} onChange={(event) => void updateLiveCustomization({ ...selectedSession.settings.characterCustomization, enabled: event.target.checked })} />Creator enabled</label>
                  <label className="toggle-row"><input type="checkbox" checked={selectedSession.settings.characterCustomization.uploadsEnabled} disabled={selectedSession.status !== "waiting" || !selectedSession.settings.characterCustomization.enabled} onChange={(event) => void updateLiveCustomization({ ...selectedSession.settings.characterCustomization, uploadsEnabled: event.target.checked })} />Artwork uploads</label>
                  <label className="toggle-row"><input type="checkbox" checked={selectedSession.settings.characterCustomization.presetsOnly} disabled={selectedSession.status !== "waiting" || !selectedSession.settings.characterCustomization.enabled} onChange={(event) => void updateLiveCustomization({ ...selectedSession.settings.characterCustomization, presetsOnly: event.target.checked })} />Presets only</label>
                  <label className="toggle-row"><input type="checkbox" checked={selectedSession.settings.characterCustomization.persistAcrossSessions} disabled={selectedSession.status !== "waiting" || !selectedSession.settings.characterCustomization.enabled} onChange={(event) => void updateLiveCustomization({ ...selectedSession.settings.characterCustomization, persistAcrossSessions: event.target.checked })} />Remember choices</label>
                  <label className="toggle-row"><input type="checkbox" checked={false} disabled />AI unavailable</label>
                </div>
                <button type="button" onClick={() => void resetAllAppearances()}>Reset Everyone</button>
                <div className="appearance-moderation-list">
                  {selectedSession.players.filter((item) => !item.isBot).map((item) => (
                    <div key={item.id}><span>{item.nickname}{item.appearance?.decalAssetId ? " · sticker submitted" : ""}</span><span>{item.appearance?.decalAssetId && <button type="button" onClick={() => void removePlayerDecal(item.id)}>Remove Sticker</button>}<button type="button" onClick={() => void clearPlayerAppearance(item.id)}>Clear Player</button></span></div>
                  ))}
                </div>
                <TeacherDecalGallery
                  sessionCode={selectedSession.sessionCode}
                  refreshKey={selectedSession.players.map((item) => `${item.id}:${item.appearance?.decalAssetId ?? "none"}`).join("|")}
                  loadAsset={loadTeacherDecal}
                  onRemove={removeDecalAsset}
                />
            </section>
            <Suspense fallback={<ArenaLoading label="Loading live arena" />}>
              <ArenaPreview
                key={`${selectedSession.id}:${selectedSession.startedAt ?? "waiting"}:overview`}
                session={selectedSession}
                loadDecalAsset={loadTeacherDecal}
              />
            </Suspense>
            <Scoreboard players={selectedSession.players} gameMode={selectedSession.settings.gameMode} />
            <EventFeed events={selectedSession.events ?? []} />
            {isEndConfirmOpen && (
              <div className="modal-backdrop" role="presentation">
                <div ref={endSessionDialogRef} className="panel confirm-modal" role="dialog" aria-modal="true" aria-labelledby="end-session-title">
                  <h2 id="end-session-title">End Session?</h2>
                  <p>This will close the round and prepare the learning report. Students cannot rejoin this session.</p>
                  <div className="button-row">
                    <button className="primary" onClick={end} disabled={isEndingSession}>
                      {isEndingSession ? "Working..." : "End and Create Report"}
                    </button>
                    <button ref={keepSessionOpenRef} onClick={() => setIsEndConfirmOpen(false)}>Keep Session Open</button>
                  </div>
                </div>
              </div>
            )}
            {isProjectorOpen && selectedSession.status === "waiting" && (
              <div className="projector-backdrop" role="presentation">
                <section ref={projectorDialogRef} className="projector-waiting-room" role="dialog" aria-modal="true" aria-labelledby="projector-title">
                  <header>
                    <div>
                      <span className="projector-kicker">QuizStrike classroom lobby</span>
                      <h2 id="projector-title">Join the game</h2>
                    </div>
                    <button ref={projectorCloseRef} type="button" onClick={() => setIsProjectorOpen(false)} aria-label="Close projector waiting room">Close</button>
                  </header>
                  <div className="projector-content">
                    <div className="projector-join-code">
                      <span>Game code</span>
                      <strong>{selectedSession.sessionCode}</strong>
                      <small>{studentJoinLink.replace(/^https?:\/\//, "")}</small>
                    </div>
                    <div className="projector-qr">
                      <QRCodeSVG
                        value={studentJoinLink}
                        size={260}
                        level="M"
                        marginSize={2}
                        title={`Join QuizStrike session ${selectedSession.sessionCode}`}
                      />
                      <span>Scan to join</span>
                    </div>
                  </div>
                  <div className="projector-roster" aria-live="polite">
                    <strong>{selectedSession.players.filter((item) => !item.isBot).length} students joined</strong>
                    <div>
                      {selectedSession.players.filter((item) => !item.isBot).map((item) => <span key={item.id}>{item.nickname}</span>)}
                      {selectedSession.players.every((item) => item.isBot) && <span>Waiting for the class...</span>}
                    </div>
                  </div>
                  <footer>
                    <button type="button" onClick={copyStudentJoinLink}><Copy size={20} aria-hidden="true" />Copy Link</button>
                    <button className="primary" type="button" onClick={start} disabled={Boolean(startBlockedReason) || isStartingSession}>
                      <Play size={22} aria-hidden="true" />
                      {isStartingSession ? "Starting..." : startBlockedReason ? "Waiting for Students" : "Begin Round"}
                    </button>
                  </footer>
                </section>
              </div>
            )}
          </>
        ) : (
          <p>Create a session to see live student progress.</p>
        )}
      </div>
    </div>
  );
}

function ReportsPanel({
  sessions,
  report,
  setReport,
  setTab
}: {
  sessions: GameSession[];
  report: SessionReport | null;
  setReport: (report: SessionReport | null) => void;
  setTab: (tab: "sessions") => void;
}) {
  const [code, setCode] = useState(sessions[0]?.sessionCode ?? "");
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const status = useAsyncMessage();

  const load = async () => {
    if (isLoadingReport) return;
    status.clear();
    setIsLoadingReport(true);
    try {
      const payload = (await teacherApi.report(code)) as { report: SessionReport };
      setReport(payload.report);
      status.setMessage("Report loaded.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsLoadingReport(false);
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
    <div className="panel report-panel">
      <div className="section-heading compact">
        <div>
          <h2>Session Results</h2>
          <p>Review accuracy, money earned from quizzes, and missed questions.</p>
        </div>
        <button onClick={() => setTab("sessions")}>Open Live Session</button>
      </div>
      <div className="inline-form">
        <select value={code} onChange={(event) => setCode(event.target.value)}>
          {sessions.map((session) => (
            <option key={session.id} value={session.sessionCode}>
              {session.sessionCode} - {session.status}
            </option>
          ))}
        </select>
        <button onClick={load} disabled={!code || isLoadingReport}>
          <Download size={18} aria-hidden="true" />
          {isLoadingReport ? "Working..." : "Load Report"}
        </button>
        <button onClick={exportCsv} disabled={!code || isExportingCsv}>
          <Download size={18} aria-hidden="true" />
          {isExportingCsv ? "Working..." : "Export CSV"}
        </button>
      </div>
      <StatusMessages error={status.error} message={status.message} />
      {report && (
        <>
          <div className="report-summary-grid">
            <div className="metric">
              <span>Class Accuracy</span>
              <strong>
                {report.rows.length
                  ? Math.round(report.rows.reduce((total, row) => total + row.accuracy, 0) / report.rows.length)
                  : 0}%
              </strong>
            </div>
            <div className="metric">
              <span>Quiz Money Earned</span>
              <strong>{formatMoney(report.rows.reduce((total, row) => total + row.quizMoney, 0))}</strong>
            </div>
            <div className="metric">
              <span>Reteach Signals</span>
              <strong>{report.missedQuestions.length}</strong>
            </div>
          </div>
          <table className="report-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Team</th>
                <th>Correct</th>
                <th>Wrong</th>
                <th>Accuracy</th>
                <th>Quiz Money</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.nickname}>
                  <td data-label="Student">{row.nickname}</td>
                  <td data-label="Team">{teamLabel(row.team)}</td>
                  <td data-label="Correct">{row.correctAnswers}</td>
                  <td data-label="Wrong">{row.wrongAnswers}</td>
                  <td data-label="Accuracy">{row.accuracy}%</td>
                  <td data-label="Quiz Money">{formatMoney(row.quizMoney)}</td>
                  <td data-label="Score">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Reteach Queue</h3>
          <ul className="plain-list">
            {report.missedQuestions.map((item) => (
              <li key={item.questionId}>
                <span>{item.prompt}</span>
                <small>{item.misses} misses</small>
              </li>
            ))}
            {report.missedQuestions.length === 0 && <li>No missed questions yet. This group is ready for the next challenge.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function StudentExperience({ onExit }: { onExit: () => void }) {
  const [joinCodeFromLink] = useState(() => getJoinCodeFromSearch(window.location.search));
  const [joinCode, setJoinCode] = useState(joinCodeFromLink);
  const [nickname, setNickname] = useState("");
  const [session, setSession] = useState<GameSession | null>(null);
  const [player, setPlayer] = useState<PlayerSession | null>(null);
  const [playerToken, setPlayerToken] = useState("");
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gamePreferences, setGamePreferences] = useState<GamePreferences>(() => readGamePreferences());
  const [feedback, setFeedback] = useState("");
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [isSocketReconnecting, setIsSocketReconnecting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [answeringChoice, setAnsweringChoice] = useState<Choice | null>(null);
  const [buyingGearId, setBuyingGearId] = useState<string | null>(null);
  const [isBuyingSnowballs, setIsBuyingSnowballs] = useState(false);
  const [isRestoringStudentSession, setIsRestoringStudentSession] = useState(true);
  const [rewardPulse, setRewardPulse] = useState("");
  const [spectatorPlayerId, setSpectatorPlayerId] = useState("");
  const [incomingHitCue, setIncomingHitCue] = useState<{
    id: number;
    direction: IncomingHitDirection;
    eliminated: boolean;
  } | null>(null);
  const status = useAsyncMessage();
  const remainingSeconds = useRoundRemaining(session);
  const flagBuyPhase = Boolean(session && isRoundBuyPhase(session));
  const buyPhaseRemainingSeconds = useDeadlineRemainingSeconds(
    flagBuyPhase ? session?.roundTransition?.startsAt : undefined,
    session?.serverTime
  );
  const socketRef = useRef<Socket | null>(null);
  const previousAliveRef = useRef<boolean | null>(null);
  const previousFlagBuyPhaseRef = useRef(false);
  const lastCountdownCueRef = useRef("");

  const isCompactViewport = viewportWidth <= 780;
  const nicknameError = useMemo(() => getNicknameError(nickname), [nickname]);
  const spectatorCandidates = useMemo(() => {
    if (!session || !player || player.isAlive || session.settings.gameMode !== "flag") return [];
    return session.players
      .filter((candidate) => candidate.id !== player.id && candidate.isAlive && candidate.connectionState !== "disconnected")
      .sort((left, right) => Number(right.team === player.team) - Number(left.team === player.team));
  }, [session?.players, session?.settings.gameMode, player?.id, player?.isAlive, player?.team]);
  const spectatorPlayer = spectatorCandidates.find((candidate) => candidate.id === spectatorPlayerId) ?? spectatorCandidates[0];

  useEffect(() => {
    if (spectatorCandidates.length === 0) {
      setSpectatorPlayerId("");
      return;
    }
    if (!spectatorCandidates.some((candidate) => candidate.id === spectatorPlayerId)) {
      setSpectatorPlayerId(spectatorCandidates[0].id);
    }
  }, [spectatorCandidates, spectatorPlayerId]);

  const updateGamePreferences = (update: Partial<GamePreferences>) => {
    setGamePreferences((current) => {
      const next = { ...current, ...update };
      writeGamePreferences(next);
      if (update.soundEnabled !== undefined || update.gamepadEnabled !== undefined || update.vibrationEnabled !== undefined) {
        gameAudio.playEvent("settings_saved");
      }
      return next;
    });
  };

  useEffect(() => {
    gameAudio.setMuted(!gamePreferences.soundEnabled);
    gameAudio.setMusicVolume(gamePreferences.musicVolume);
    if (gamePreferences.soundEnabled) gameAudio.warm();
    return () => gameAudio.setMuted(false);
  }, [gamePreferences.soundEnabled, gamePreferences.musicVolume]);

  useEffect(() => {
    const stored = readStoredStudentSession();
    if (stored && joinCodeFromLink && stored.sessionCode !== joinCodeFromLink) {
      clearStoredStudentSession();
      setIsRestoringStudentSession(false);
      return;
    }
    if (!stored) {
      setIsRestoringStudentSession(false);
      return;
    }

    let cancelled = false;
    void studentApi
      .rejoin(stored.sessionCode, stored.playerId, stored.playerToken)
      .then((payload) => {
        if (cancelled) return;
        const data = payload as { session: GameSession; player: PlayerSession; question?: PublicQuestion };
        setSession(data.session);
        setPlayer(data.player);
        setPlayerToken(stored.playerToken);
        setQuestion(data.question ?? null);
        setFeedback("Your student session was restored.");
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
          clearStoredStudentSession();
          return;
        }
        setJoinCode(stored.sessionCode);
        status.setError("Your connection dropped while restoring the game. Reconnect, then reload or join again with the same name.");
      })
      .finally(() => {
        if (!cancelled) setIsRestoringStudentSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [joinCodeFromLink]);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", updateViewportWidth);
    window.addEventListener("orientationchange", updateViewportWidth);
    return () => {
      window.removeEventListener("resize", updateViewportWidth);
      window.removeEventListener("orientationchange", updateViewportWidth);
    };
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!session || session.status !== "active") {
      lastCountdownCueRef.current = "";
      return;
    }
    const cueKey = `${session.currentRound}:${remainingSeconds}`;
    if ([10, 5, 3, 2, 1].includes(remainingSeconds) && lastCountdownCueRef.current !== cueKey) {
      lastCountdownCueRef.current = cueKey;
      gameAudio.playEvent(remainingSeconds <= 5 ? "quiz_timer_warning" : "round_ending");
    }
  }, [remainingSeconds, session?.currentRound, session?.status]);

  useEffect(() => {
    if (quizOpen && question) gameAudio.playEvent("quiz_timer_start");
  }, [quizOpen, question?.id]);

  useEffect(() => {
    const syncBgm = () => {
      gameAudio.setBgmActive(Boolean(session && player && session.status === "active" && document.visibilityState === "visible"));
    };
    syncBgm();
    document.addEventListener("visibilitychange", syncBgm);
    return () => {
      document.removeEventListener("visibilitychange", syncBgm);
      gameAudio.setBgmActive(false);
    };
  }, [session?.id, session?.status, player?.id]);

  const openRespawnPractice = useCallback(() => {
    setQuizOpen(true);
    setBuyOpen(false);
    setScoreboardOpen(false);
  }, []);

  useEffect(() => {
    if (!session || !player?.id || !playerToken) return;
    const activePlayerId = player.id;
    const socket = io(getApiUrl());
    socketRef.current = socket;
    const roomJoinPayload = { code: session.sessionCode, playerId: activePlayerId, playerToken };
    const pendingPositions = new Map<string, { x: number; z: number; facing: number }>();
    const lastRemotePositions = new Map<string, { x: number; z: number }>();
    let lastVisualSession = session;
    const emitPlayerVfx = (kind: ArenaVfxKind, playerId = activePlayerId, source = lastVisualSession) => {
      const target = source.players.find((candidate) => candidate.id === playerId);
      emitArenaVfx({ kind, x: target?.x ?? 0, z: target?.z ?? 0, team: target?.team });
    };
    const emitPlayerAnimation = (kind: ArenaAnimationCue, playerId?: string, team?: Team) => {
      emitArenaAnimation({ kind, playerId, team });
    };
    let positionFlushTimer: number | undefined;
    const flushPositions = () => {
      positionFlushTimer = undefined;
      if (pendingPositions.size === 0) return;
      const updates = new Map(pendingPositions);
      pendingPositions.clear();
      setSession((current) => current ? {
        ...current,
        players: current.players.map((candidate) => {
          const update = updates.get(candidate.id);
          return update ? { ...candidate, ...update } : candidate;
        })
      } : current);
      const ownUpdate = updates.get(activePlayerId);
      if (ownUpdate) setPlayer((current) => current ? { ...current, ...ownUpdate } : current);
    };
    socket.emit("join_session_room", roomJoinPayload);
    socket.on("connect", () => {
      setIsSocketReconnecting(false);
      socket.emit("join_session_room", roomJoinPayload);
    });
    socket.on("connect_error", () => setIsSocketReconnecting(true));
    socket.on("disconnect", () => setIsSocketReconnecting(true));
    socket.on("session_state", (nextSession: GameSession) => {
      const previousSession = lastVisualSession;
      const previousLocal = previousSession.players.find((candidate) => candidate.id === activePlayerId);
      const nextLocal = nextSession.players.find((candidate) => candidate.id === activePlayerId);
      if (nextSession.players.length > previousSession.players.length) gameAudio.playEvent("player_join");
      if (nextSession.players.length < previousSession.players.length) gameAudio.playEvent("player_leave");
      if (previousSession.status !== "active" && nextSession.status === "active") gameAudio.playEvent("round_start");
      if (previousSession.status === "active" && nextSession.status === "paused") gameAudio.playEvent("round_ending");
      if (nextSession.status === "ended" && previousSession.status !== "ended") {
        const title = nextSession.announcement?.title?.toLowerCase() ?? "";
        gameAudio.playEvent(title.includes("draw") ? "draw" : title.includes(player.team) ? "match_victory" : "match_defeat");
      }
      if ((previousLocal?.health ?? 100) > 25 && (nextLocal?.health ?? 100) <= 25 && nextLocal?.isAlive) gameAudio.playEvent("low_health");
      if (previousLocal?.isAlive === false && nextLocal?.isAlive) gameAudio.playEvent("temporary_invulnerability");
      const previousFlagState = previousSession.flag?.state;
      const nextFlagState = nextSession.flag?.state;
      if (nextFlagState && nextFlagState !== previousFlagState) {
        const localPoint = nextLocal && Number.isFinite(nextLocal.x) && Number.isFinite(nextLocal.z)
          ? { x: nextLocal.x!, z: nextLocal.z!, facing: nextLocal.facing ?? 0 }
          : undefined;
        const flagPoint = nextSession.flag?.position;
        const spatial = localPoint && flagPoint
          ? getCombatAudioSpatial({ attacker: flagPoint, target: localPoint })
          : {};
        const carrier = nextSession.players.find((candidate) => candidate.id === nextSession.flag?.carrierId);
        const flagCue: AudioEventCue = nextFlagState === "carried"
          ? carrier?.id === activePlayerId ? "flag_pickup" : carrier?.team === player.team ? "flag_teammate" : "flag_enemy"
          : nextFlagState === "dropped"
            ? "flag_drop"
            : nextFlagState === "placed"
              ? "flag_planted"
              : nextFlagState === "being_placed"
                ? "flag_plant_start"
                : nextFlagState === "being_captured"
                  ? "objective_countdown"
                  : nextFlagState === "captured"
                    ? "flag_capture"
                    : previousFlagState === "carried" && nextFlagState === "available"
                      ? "flag_return"
                      : "flag_reset";
        gameAudio.playEvent(flagCue, flagCue === "flag_capture" ? {} : spatial);
      }
      setIsSocketReconnecting(false);
      lastVisualSession = nextSession;
      setSession(nextSession);
      setPlayer((current) => nextSession.players.find((item) => item.id === (current?.id ?? activePlayerId)) ?? current);
    });
    socket.on("remote_weapon_fire", (payload: { playerId?: string; x?: number; z?: number; facing?: number; gearId?: string }) => {
      if (payload.playerId === activePlayerId || !Number.isFinite(payload.x) || !Number.isFinite(payload.z)) return;
      const local = lastVisualSession.players.find((candidate) => candidate.id === activePlayerId);
      if (!local || !Number.isFinite(local.x) || !Number.isFinite(local.z)) return;
      const cue: AudioEventCue = payload.gearId === "power_blaster"
        ? "weapon_fire_heavy_remote"
        : payload.gearId === "quick_blaster"
          ? "weapon_fire_quick_remote"
          : "weapon_fire_basic_remote";
      gameAudio.playEvent(cue, getCombatAudioSpatial({
        attacker: { x: payload.x!, z: payload.z! },
        target: { x: local.x!, z: local.z!, facing: local.facing ?? 0 }
      }));
      if (cue === "weapon_fire_heavy_remote") {
        const spatial = getCombatAudioSpatial({
          attacker: { x: payload.x!, z: payload.z! },
          target: { x: local.x!, z: local.z!, facing: local.facing ?? 0 }
        });
        window.setTimeout(() => gameAudio.playEvent("projectile_pass", spatial), 160);
      }
    });
    socket.on("world_impact", (payload: { attackerId?: string; targetId?: string; x?: number; z?: number; shield?: boolean }) => {
      if (payload.attackerId === activePlayerId || payload.targetId === activePlayerId || !Number.isFinite(payload.x) || !Number.isFinite(payload.z)) return;
      const local = lastVisualSession.players.find((candidate) => candidate.id === activePlayerId);
      if (!local || !Number.isFinite(local.x) || !Number.isFinite(local.z)) return;
      gameAudio.playEvent(payload.shield ? "shield_impact" : "world_impact", getCombatAudioSpatial({
        attacker: { x: payload.x!, z: payload.z! },
        target: { x: local.x!, z: local.z!, facing: local.facing ?? 0 }
      }));
    });
    socket.on("game_event", (event: GameEvent) => {
      if (event.type === "join") gameAudio.playEvent("player_join");
      if (event.type === "start") gameAudio.playEvent("round_start");
      if (event.type === "buy") gameAudio.playEvent("results_confirm");
      if (event.type === "answer") gameAudio.playEvent("answer_reveal");
      if (event.type === "timer") gameAudio.playEvent("objective_countdown");
      if (event.type === "elimination" || event.playerId === activePlayerId || event.targetId === activePlayerId) {
        setFeedback(event.message);
      }
      if (event.type === "respawn") {
        gameAudio.playEvent("temporary_invulnerability");
        const respawnedId = event.playerId ?? event.targetId;
        emitPlayerVfx("healing", respawnedId);
        emitPlayerAnimation("respawn", respawnedId, event.team);
      }
      if (event.type === "elimination") {
        if (event.playerId === activePlayerId || event.targetId === activePlayerId) gameAudio.playEvent("low_health");
        const eliminatedId = event.targetId ?? event.playerId;
        emitPlayerAnimation("defeat", eliminatedId);
      }
      if (event.type === "end" && lastVisualSession.settings.gameMode === "zombie") {
        const humansWon = /humans survive/i.test(event.message);
        const zombiesWon = /zombie|converted/i.test(event.message) && !humansWon;
        const localWon = humansWon
          ? player.role !== "zombie"
          : zombiesWon
            ? player.role === "zombie"
            : false;
        emitPlayerVfx(localWon ? "victory" : "defeat");
        emitPlayerAnimation(localWon ? "victory" : "defeat", activePlayerId, player.team);
      }
    });
    socket.on("player_position", (position: { playerId?: string; x?: number; z?: number; facing?: number }) => {
      if (!position.playerId || !Number.isFinite(position.x) || !Number.isFinite(position.z) || !Number.isFinite(position.facing)) return;
      if (position.playerId !== activePlayerId) {
        const previous = lastRemotePositions.get(position.playerId);
        const local = lastVisualSession.players.find((candidate) => candidate.id === activePlayerId);
        if (previous && local && Number.isFinite(local.x) && Number.isFinite(local.z) && Math.hypot(position.x! - previous.x, position.z! - previous.z) > 0.45) {
          gameAudio.playRemoteFootstep(
            position.playerId,
            getCombatAudioSpatial({
              attacker: { x: position.x!, z: position.z! },
              target: { x: local.x!, z: local.z!, facing: local.facing ?? 0 }
            }),
            lastVisualSession.settings.mapId === "iron_junction" ? "metal" : "sand"
          );
        }
        lastRemotePositions.set(position.playerId, { x: position.x!, z: position.z! });
      }
      pendingPositions.set(position.playerId, {
        x: position.x!,
        z: position.z!,
        facing: position.facing!
      });
      positionFlushTimer ??= window.setTimeout(flushPositions, 50);
    });
    socket.on("damage_result", (result: DamageResultPayload) => {
      if (typeof result.snowballs === "number" && (!result.ok || result.attackerId === activePlayerId)) {
        setPlayer((current) => current && current.id === activePlayerId ? { ...current, snowballs: result.snowballs } : current);
      }
      if (!result.ok) {
        const messages: Record<string, string> = {
          attacker_eliminated: "You are frozen out. Answer practice questions to respawn.",
          out_of_snowballs: "Out of snowballs. Answer questions and buy a refill.",
          no_valid_target: "Snowball launched. No opponent was in the shot path.",
          blocked_by_cover: "Snowball blocked by cover.",
          invalid_target: "That snowball target was no longer valid.",
          invalid_projectile: "That shot was rejected. Try firing again.",
          duplicate_projectile: "That shot was already counted.",
          fire_cooldown: "Launcher is cooling down."
        };
        queueFeedbackCue(result.reason === "no_valid_target" ? "warning" : "error");
        if (result.reason === "fire_cooldown") emitPlayerVfx("cooldown");
        setFeedback(messages[result.reason ?? ""] ?? "Snowball launched.");
        return;
      }
      const targetTeam = session.players.find((candidate) => candidate.id === result.targetId)?.team;
      emitArenaVfx({ kind: "impact", x: result.targetX, z: result.targetZ, team: targetTeam });
      emitPlayerAnimation("hit", result.targetId, targetTeam);
      if (!result.eliminated) emitArenaVfx({ kind: "shield", x: result.targetX, z: result.targetZ, team: targetTeam });
      if (result.eliminated) emitArenaVfx({ kind: "elimination", x: result.targetX, z: result.targetZ, team: targetTeam });
      if (result.attackerId === activePlayerId) {
        gameAudio.play(result.eliminated ? "eliminated" : "hit_confirm");
        setFeedback(
          result.eliminated
            ? `Freeze! Opponent out. ${result.moneyAwarded ? `+${formatMoney(result.moneyAwarded)} bonus.` : ""}`
            : `Hit for ${result.damage} warmth.`
        );
        if (result.eliminated) setRewardPulse("Freeze!");
      }
      if (result.targetId === activePlayerId) {
        const incomingSpatial = getCombatAudioSpatial({
          attacker: { x: result.attackerX, z: result.attackerZ },
          target: { x: result.targetX, z: result.targetZ, facing: result.targetFacing }
        });
        if (result.eliminated) gameAudio.play("eliminated", incomingSpatial);
        else if (player.perks?.includes("shield_vest")) gameAudio.playEvent("shield_impact", incomingSpatial);
        else gameAudio.play("player_tagged", incomingSpatial);
        setIncomingHitCue({
          id: Date.now(),
          direction: getIncomingHitDirection({
            attacker: { x: result.attackerX, z: result.attackerZ },
            target: { x: result.targetX, z: result.targetZ, facing: result.targetFacing }
          }),
          eliminated: result.eliminated
        });
        setFeedback(result.eliminated ? "Frozen out. Answer three practice questions to respawn." : `Tagged for ${result.damage} warmth.`);
        if (result.eliminated && session.settings.deadPlayersCanPractice && session.settings.gameMode !== "flag") {
          openRespawnPractice();
        }
      }
    });
    socket.on("elimination_update", (event: EliminationPayload) => {
      if (event.attackerId === activePlayerId) setRewardPulse(event.moneyAwarded ? `+${formatMoney(event.moneyAwarded)}` : "Freeze!");
      if (event.targetId === activePlayerId) setRewardPulse("Frozen");
    });
    socket.on("error_message", (payload: { error?: string }) => {
      queueFeedbackCue("error");
      setFeedback(payload.error ?? "Action failed.");
    });
    return () => {
      if (positionFlushTimer !== undefined) window.clearTimeout(positionFlushTimer);
      setIsSocketReconnecting(false);
      if (socketRef.current === socket) socketRef.current = null;
      socket.disconnect();
    };
  }, [session?.sessionCode, session?.settings.deadPlayersCanPractice, player?.id, playerToken, openRespawnPractice]);

  useEffect(() => {
    if (!session || !player?.id || session.status !== "waiting") return;
    const sessionCode = session.sessionCode;
    const activePlayerId = player.id;
    let cancelled = false;

    const syncWaitingRoom = async () => {
      try {
        const payload = (await studentApi.session(sessionCode)) as { session: GameSession };
        if (cancelled) return;
        setSession(payload.session);
        setPlayer((current) => payload.session.players.find((item) => item.id === (current?.id ?? activePlayerId)) ?? current);
      } catch {
        // The socket remains the primary transport; the next poll retries transient failures.
      }
    };

    const interval = window.setInterval(() => void syncWaitingRoom(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session?.sessionCode, session?.status, player?.id]);

  useEffect(() => {
    if (flagBuyPhase && player?.isAlive) {
      gameAudio.play("menu_toggle");
      setBuyOpen(true);
      setQuizOpen(false);
      setScoreboardOpen(false);
      setSettingsOpen(false);
    } else if (previousFlagBuyPhaseRef.current) {
      setBuyOpen(false);
    }
    previousFlagBuyPhaseRef.current = flagBuyPhase;
  }, [flagBuyPhase, session?.roundTransition?.startsAt, player?.id, player?.isAlive]);

  const panelsOpen = quizOpen || buyOpen || scoreboardOpen || settingsOpen;
  const gameplayInputPaused = quizOpen || buyOpen || settingsOpen;

  useEffect(() => {
    if (!gameplayInputPaused || !document.pointerLockElement) return;
    document.exitPointerLock();
  }, [gameplayInputPaused]);

  useEffect(() => {
    if (!player) {
      previousAliveRef.current = null;
      return;
    }
    if (
      shouldAutoOpenRespawnPractice({
        wasAlive: previousAliveRef.current,
        isAlive: player.isAlive,
        canPractice: Boolean(session?.settings.deadPlayersCanPractice)
          && session?.settings.gameMode !== "flag"
      })
    ) {
      openRespawnPractice();
    }
    previousAliveRef.current = player.isAlive;
  }, [player?.id, player?.isAlive, session?.settings.deadPlayersCanPractice, session?.settings.gameMode, openRespawnPractice]);

  const sendArenaPosition = useCallback(
    (position: ArenaPositionPayload) => {
      if (!session || !player || !playerToken) return;
      socketRef.current?.volatile.emit("player_position", {
        code: session.sessionCode,
        playerId: player.id,
        playerToken,
        ...position
      });
    },
    [session?.sessionCode, player?.id, playerToken]
  );

  const sendArenaFire = useCallback(
    (position: ArenaPositionPayload) => {
      if (!session || !player || !playerToken) return;
      const requestId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      socketRef.current?.emit("fire_action", {
        code: session.sessionCode,
        playerId: player.id,
        playerToken,
        requestId,
        ...position
      });
    },
    [session?.sessionCode, player?.id, playerToken]
  );

  const sendFlagAction = useCallback(
    (position: ArenaPositionPayload) => {
      if (!session || !player || !playerToken || session.settings.gameMode !== "flag") return;
      socketRef.current?.emit("flag_action", {
        code: session.sessionCode,
        playerId: player.id,
        playerToken,
        ...position
      });
    },
    [session?.sessionCode, session?.settings.gameMode, player?.id, playerToken]
  );

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isJoining) return;
    warmFeedbackCue();
    status.clear();
    setFeedback("");
    const inlineNicknameError = getNicknameError(nickname);
    if (inlineNicknameError) {
      status.setError(inlineNicknameError);
      return;
    }
    setIsJoining(true);
    try {
      const payload = (await studentApi.join(joinCode.trim().toUpperCase(), nickname)) as {
        session: GameSession;
        player: PlayerSession;
        playerToken: string;
        question?: PublicQuestion;
      };
      setSession(payload.session);
      setPlayer(payload.player);
      setPlayerToken(payload.playerToken);
      setQuestion(payload.question ?? null);
      setQuizOpen(false);
      setBuyOpen(false);
      setScoreboardOpen(false);
      setSettingsOpen(false);
      setAnsweringChoice(null);
      localStorage.setItem(STUDENT_SESSION_STORAGE_KEY, JSON.stringify({
        sessionCode: payload.session.sessionCode,
        playerId: payload.player.id,
        playerToken: payload.playerToken
      } satisfies StoredStudentSession));
      const rememberedAppearance = payload.session.settings.characterCustomization.persistAcrossSessions
        ? readStoredAppearance()
        : null;
      if (rememberedAppearance && payload.session.settings.characterCustomization.enabled) {
        void studentApi.saveAppearance(
          payload.session.sessionCode,
          payload.player.id,
          payload.playerToken,
          rememberedAppearance
        ).then((saved) => {
          const result = saved as { session: GameSession; player: PlayerSession };
          setSession(result.session);
          setPlayer(result.player);
        }).catch(() => undefined);
      }
      setFeedback("Joined. Click the arena to aim, or use the touch controls on smaller screens.");
      gameAudio.playEvent("room_joined");
    } catch (err) {
      status.setError(formatStudentJoinError(err));
      gameAudio.playEvent("room_join_failed");
    } finally {
      setIsJoining(false);
    }
  };

  const returnToJoin = () => {
    gameAudio.playEvent("lobby_return");
    socketRef.current?.disconnect();
    clearStoredStudentSession();
    setSession(null);
    setPlayer(null);
    setPlayerToken("");
    setQuestion(null);
    setQuizOpen(false);
    setBuyOpen(false);
    setScoreboardOpen(false);
    setSettingsOpen(false);
    setAnsweringChoice(null);
    setFeedback("");
    status.clear();
  };

  const answer = async (choice: Choice) => {
    if (!session || !player || !question || !playerToken || answeringChoice) return;
    status.clear();
    setFeedback("Answer selected...");
    setAnsweringChoice(choice);
    gameAudio.playEvent("quiz_select");
    gameAudio.playEvent("quiz_lock");
    try {
      type AnswerPayload = {
        result: {
          feedback: string;
          explanation?: string;
          player: PlayerSession;
          nextQuestion?: PublicQuestion;
          respawned?: boolean;
        };
      };
      const command = { questionId: question.id, selectedChoice: choice };
      const payload = await sendStudentCommand<AnswerPayload>(
        socketRef.current,
        "answer_question",
        command,
        () => studentApi.answer(session.sessionCode, player.id, playerToken, command) as Promise<AnswerPayload>
      );
      setPlayer(payload.result.player);
      setFeedback(`${payload.result.feedback}${payload.result.explanation ? ` ${payload.result.explanation}` : ""}`);
      const wasWrong = payload.result.player.wrongAnswers > player.wrongAnswers;
      gameAudio.play(wasWrong ? "quiz_wrong" : "quiz_correct");
      gameAudio.playEvent("answer_reveal");
      if (!wasWrong && payload.result.player.money > player.money) gameAudio.playEvent("score_awarded");
      if (payload.result.respawned) {
        emitArenaVfx({ kind: "healing", x: payload.result.player.x ?? 0, z: payload.result.player.z ?? 0, team: payload.result.player.team });
        emitArenaVfx({ kind: "spawn", x: payload.result.player.x ?? 0, z: payload.result.player.z ?? 0, team: payload.result.player.team });
        emitArenaAnimation({ kind: "respawn", playerId: payload.result.player.id, team: payload.result.player.team });
        setRewardPulse("Respawned!");
        setQuizOpen(false);
      } else if (payload.result.player.money > player.money) {
        setRewardPulse(`+${formatMoney(payload.result.player.money - player.money)}`);
      }
      setQuestion(payload.result.nextQuestion ?? null);
    } catch (err) {
      status.report(err);
    } finally {
      setAnsweringChoice(null);
    }
  };

  useEffect(() => {
    if (!session || session.status !== "ended") return;
    setQuizOpen(false);
    setBuyOpen(false);
    setScoreboardOpen(false);
    setSettingsOpen(false);
    setAnsweringChoice(null);
    if (document.pointerLockElement) document.exitPointerLock();
  }, [session?.id, session?.status]);

  const buy = async (gearId: string) => {
    if (!session || !player || !playerToken || buyingGearId || isBuyingSnowballs) return;
    status.clear();
    setFeedback("Purchasing gear...");
    setBuyingGearId(gearId);
    try {
      type BuyPayload = { player: PlayerSession; message: string };
      const payload = await sendStudentCommand<BuyPayload>(
        socketRef.current,
        "buy_gear",
        { gearId },
        () => studentApi.buy(session.sessionCode, player.id, playerToken, gearId) as Promise<BuyPayload>
      );
      setPlayer(payload.player);
      setFeedback(payload.message);
      setRewardPulse(payload.message);
      gameAudio.playEvent(gearId.endsWith("_blaster") ? "weapon_equip" : "results_confirm");
    } catch (err) {
      status.report(err);
    } finally {
      setBuyingGearId(null);
    }
  };

  const buySnowballs = async () => {
    if (!session || !player || !playerToken || isBuyingSnowballs || buyingGearId) return;
    status.clear();
    setFeedback("Purchasing snowballs...");
    setIsBuyingSnowballs(true);
    try {
      type BuySnowballsPayload = { player: PlayerSession; message: string };
      const payload = await sendStudentCommand<BuySnowballsPayload>(
        socketRef.current,
        "buy_snowballs",
        {},
        () => studentApi.buySnowballs(session.sessionCode, player.id, playerToken) as Promise<BuySnowballsPayload>
      );
      setPlayer(payload.player);
      setFeedback(payload.message);
      setRewardPulse(payload.message);
      gameAudio.play("buy");
    } catch (err) {
      status.report(err);
    } finally {
      setIsBuyingSnowballs(false);
    }
  };

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target instanceof HTMLElement ? target : null;
      if (!element) return false;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) || element.isContentEditable;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!player || !session || isTypingTarget(event.target)) return;
      if (event.key.toLowerCase() === "q") {
        gameAudio.playEvent(quizOpen ? "modal_close" : "quiz_open");
        setQuizOpen((open) => !open);
        setBuyOpen(false);
        setScoreboardOpen(false);
        setSettingsOpen(false);
      }
      if (event.key.toLowerCase() === "b") {
        gameAudio.play("menu_toggle");
        setBuyOpen((open) => !open);
        setQuizOpen(false);
        setScoreboardOpen(false);
        setSettingsOpen(false);
      }
      if (event.key === "Tab") {
        event.preventDefault();
        if (!scoreboardOpen) gameAudio.play("menu_toggle");
        setScoreboardOpen(true);
        setQuizOpen(false);
        setBuyOpen(false);
        setSettingsOpen(false);
      }
      const index = Number(event.key) - 1;
      if (quizOpen && question && index >= 0 && index < choices.length) {
        event.preventDefault();
        void answer(choices[index]);
        return;
      }
      if (buyOpen && !event.repeat) {
        const shortcut = getShopShortcut(event.key);
        if (!shortcut) return;
        event.preventDefault();
        if (shortcut.item === "snowballs") void buySnowballs();
        else void buy(shortcut.item);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !player || !session || isTypingTarget(event.target)) return;
      event.preventDefault();
      setScoreboardOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    player,
    session,
    playerToken,
    quizOpen,
    buyOpen,
    question,
    scoreboardOpen,
    answeringChoice,
    buyingGearId,
    isBuyingSnowballs
  ]);

  const chooseTeam = async (team: Team) => {
    if (!session || !player || !playerToken || session.status !== "waiting") return;
    status.clear();
    try {
      const payload = (await studentApi.chooseTeam(session.sessionCode, player.id, playerToken, team)) as {
        session: GameSession;
        player: PlayerSession;
      };
      setSession(payload.session);
      setPlayer(payload.player);
      setFeedback(`You are on ${team === "red" ? "Red Team" : "Blue Team"}.`);
      gameAudio.playEvent("team_select");
    } catch (err) {
      status.report(err);
    }
  };

  const savePlayerAppearance = async (appearance: PlayerAppearance) => {
    if (!session || !player || !playerToken) throw new Error("Reconnect before saving your character.");
    const payload = await studentApi.saveAppearance(session.sessionCode, player.id, playerToken, appearance) as {
      session: GameSession;
      player: PlayerSession;
    };
    setSession(payload.session);
    setPlayer(payload.player);
    if (session.settings.characterCustomization.persistAcrossSessions) {
      const stored = { ...appearance, decalAssetId: undefined };
      localStorage.setItem(STUDENT_APPEARANCE_STORAGE_KEY, JSON.stringify(stored));
    }
  };

  const uploadPlayerDecal = async (blob: Blob) => {
    if (!session || !player || !playerToken) throw new Error("Reconnect before uploading a sticker.");
    const payload = await studentApi.uploadDecal(session.sessionCode, player.id, playerToken, blob) as { assetId: string };
    return payload.assetId;
  };

  const loadStudentDecal = useCallback(
    (assetId: string) => session
      ? fetchDecalAsset(session.sessionCode, assetId, playerToken)
      : Promise.reject(new Error("No active room.")),
    [session?.sessionCode, playerToken]
  );

  if (!session || !player) {
    if (isRestoringStudentSession) {
      return (
        <section className="auth-layout student-join-screen">
          <ArenaLoading label="Restoring your student session" />
        </section>
      );
    }
    return (
      <section className="auth-layout student-join-screen">
        <div className="student-join-help">
          <h1>Join Game</h1>
          <p>Enter your teacher's private session code and a classroom nickname. No student email account is needed.</p>
          <div className="panel how-to-card">
            <h2>How to Play</h2>
            <p>Answer questions to earn money, buy snowballs and gear, then tag the other team in the arena.</p>
            <p>Fast web arena: use WASD to move, arrow keys or a swipe on the arena to look around, F or left click to fire, and E for the flag. Press C or right click to cycle the Heavy Snowball Launcher through 2× scope, 4× scope, and normal view. Q opens quiz, B opens buy, number keys 1–5 purchase shop items, and hold Tab for the scoreboard.</p>
            <p>If you are frozen out, keep practicing. Three correct answers respawn you back into the round.</p>
          </div>
        </div>
        <form className="panel form-panel student-join-form" onSubmit={join}>
          {joinCodeFromLink ? (
            <div className="linked-join-code" aria-label={`Join session ${joinCode}`}>
              <span><Link2 size={17} aria-hidden="true" />Session link ready</span>
              <strong>{joinCode}</strong>
              <small>Enter your name below to join.</small>
            </div>
          ) : (
            <label className="join-field">
              <span className="join-field-label">Game code</span>
              <input
                value={joinCode}
                onChange={(event) => {
                  setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
                  status.clearError();
                }}
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                autoFocus
                inputMode="text"
                enterKeyHint="next"
                aria-invalid={Boolean(status.error)}
                aria-describedby={status.error ? "join-error join-code-help" : "join-code-help"}
                placeholder="ABC123"
              />
              <small id="join-code-help">Enter the 6-character code on your teacher's screen.</small>
            </label>
          )}
          <label className="join-field">
            <span className="join-field-label">Your name</span>
            <input placeholder="Student name" autoComplete="nickname" autoFocus={Boolean(joinCodeFromLink)} enterKeyHint="done" value={nickname} onChange={(event) => { setNickname(event.target.value); status.clearError(); }} maxLength={20} aria-invalid={Boolean(nicknameError)} aria-describedby={nicknameError ? "nickname-error nickname-help" : "nickname-help"} />
            <small id="nickname-help">Use the classroom name your teacher will recognize.</small>
          </label>
          {nicknameError && <p id="nickname-error" className="error-text" role="alert">{nicknameError}</p>}
          {status.error && <p id="join-error" className="error-text" role="alert">{status.error}</p>}
          <button className="primary" type="submit" disabled={isJoining || Boolean(nicknameError)}>
            {isJoining ? "Working..." : "Join"}
          </button>
        </form>
      </section>
    );
  }

  const gear = GEAR_ITEMS.find((item) => item.id === getPlayerWeaponId(player)) ?? GEAR_ITEMS[0];
  const snowballs = player.snowballs ?? session.settings.startingSnowballs;
  const warmth = getPlayerWarmth(player);
  const topLearner = getTopLearner(session.players);
  const respawnProgress = player.respawnCorrectAnswers ?? 0;
  const canPracticeToRespawn = !player.isAlive && session.settings.deadPlayersCanPractice && session.settings.gameMode !== "flag";
  const roundActive = session.status === "active";
  const roundEnded = session.status === "ended";
  const menuTitle = canPracticeToRespawn && quizOpen ? "Practice to Respawn" : quizOpen ? "Quiz" : buyOpen ? "Buy Menu" : settingsOpen ? "Game Settings" : "Scoreboard";
  const roundTimeLabel = formatDuration(remainingSeconds);
  const roundCountdownClassName = [
    "round-countdown",
    roundActive ? "round-countdown-active" : "",
    roundActive && remainingSeconds <= 30 ? "round-countdown-low" : ""
  ].filter(Boolean).join(" ");
  const objectiveText = session.settings.gameMode === "flag"
    ? flagStatusText(session)
    : session.settings.gameMode === "zombie"
      ? zombieStatusText(session, player)
      : "Answer questions, earn supplies, and tag the other team.";
  const sessionResult = getSessionResultText(session);
  const arenaPlayer = spectatorPlayer ?? player;
  const cycleSpectator = (direction: -1 | 1) => {
    if (spectatorCandidates.length < 2) return;
    const currentIndex = Math.max(0, spectatorCandidates.findIndex((candidate) => candidate.id === arenaPlayer.id));
    const nextIndex = (currentIndex + direction + spectatorCandidates.length) % spectatorCandidates.length;
    setSpectatorPlayerId(spectatorCandidates[nextIndex].id);
  };

  return (
    <section className={isCompactViewport ? "game-layout compact-game-layout" : "game-layout"}>
      <div className="game-stage">
        <GameAnnouncementOverlay announcement={flagBuyPhase ? undefined : session.announcement} serverTime={session.serverTime} />
        <div className="game-utility-bar">
          <span>{gameModeLabel(session.settings.gameMode)}</span>
          <button type="button" onClick={() => { setSettingsOpen(true); setQuizOpen(false); setBuyOpen(false); setScoreboardOpen(false); }}><Settings size={16} aria-hidden="true" />Settings</button>
          <button type="button" onClick={onExit}>Exit Game</button>
        </div>
        {session.status === "waiting" ? (
          <div className="arena-waiting-surface" aria-hidden="true" />
        ) : (
          <Suspense fallback={<ArenaLoading />}>
            <ArenaPreview
              key={`${session.id}:${session.startedAt ?? "waiting"}:${player.id}`}
              session={session}
              currentPlayer={arenaPlayer}
              view="fps"
              suppressHint
              quality={gamePreferences.arenaQuality}
              gamepadEnabled={gamePreferences.gamepadEnabled}
              controlsDisabled={!roundActive || !player.isAlive}
              inputPaused={gameplayInputPaused}
              onMove={roundActive && player.isAlive ? sendArenaPosition : undefined}
              onFire={roundActive && player.isAlive ? sendArenaFire : undefined}
              onInteract={roundActive && player.isAlive ? sendFlagAction : undefined}
              loadDecalAsset={loadStudentDecal}
            />
          </Suspense>
        )}
        <div className={roundCountdownClassName} role="timer" aria-label={`Round time remaining ${roundTimeLabel}`}>
          <Timer size={18} aria-hidden="true" />
          <span>Round Timer</span>
          <strong>{roundTimeLabel}</strong>
        </div>
        <div className="arena-objective-strip">
          <span className={`status-pill status-${session.status}`}>{flagBuyPhase ? "Buy Phase" : sessionStatusLabel(session.status)}</span>
          <span className="objective-primary">{objectiveText}</span>
          <span className={`mode-pill mode-${session.settings.gameMode}`}>
            {gameModeLabel(session.settings.gameMode)}
            {session.settings.gameMode === "flag" ? ` · Round ${session.currentRound}/${session.settings.roundCount}` : ""}
          </span>
        </div>
        <div className="hud player-status-hud">
          <span className={player.isAlive ? "hud-stat hud-warmth" : "hud-stat hud-warmth low"}>
            <HeartPulse size={18} aria-hidden="true" />
            <span>
              <small>Warmth</small>
              <strong>{warmth}</strong>
            </span>
          </span>
          <span className="hud-stat">
            <CircleDollarSign size={18} aria-hidden="true" />
            <span>
              <small>Money</small>
              <strong>${player.money}</strong>
            </span>
          </span>
          <span className={`hud-stat team-${player.team}`}>
            <Users size={18} aria-hidden="true" />
            <span>
              <small>Team</small>
              <strong>{session.settings.gameMode === "zombie" ? (player.role === "zombie" ? "Zombie" : "Human") : player.team === "blue" ? "Blue Team" : "Red Team"}</strong>
            </span>
          </span>
          <span className="hud-stat weapon">
            <Package size={18} aria-hidden="true" />
            <span>
              <small>Gear · {((gear.fireCooldownMs ?? 160) / 1000).toFixed(2)}s cadence</small>
              <strong>{gear.name}</strong>
            </span>
          </span>
          <span className="hud-stat">
            <Target size={18} aria-hidden="true" />
            <span>
              <small>Snowballs</small>
              <strong>{snowballs}</strong>
            </span>
          </span>
        </div>
        {incomingHitCue && (
          <div
            key={incomingHitCue.id}
            className={`incoming-hit-flash incoming-hit-flash-${incomingHitCue.direction}${incomingHitCue.eliminated ? " incoming-hit-flash-eliminated" : ""}`}
            data-testid="incoming-hit-flash"
            aria-hidden="true"
            onAnimationEnd={() => setIncomingHitCue(null)}
          />
        )}
        {rewardPulse && <div className="reward-toast" onAnimationEnd={() => setRewardPulse("")}>{rewardPulse}</div>}
        {panelsOpen && (
          <div className="game-menu-overlay" role="dialog" aria-modal="false" aria-label="Arena menu">
            <div className="game-menu-bar">
              <strong>{menuTitle}</strong>
              <button type="button" onClick={() => { gameAudio.play("menu_toggle"); setQuizOpen(false); setBuyOpen(false); setScoreboardOpen(false); setSettingsOpen(false); }}>
                Return to Arena
              </button>
            </div>
            {quizOpen && (
              <>
                {canPracticeToRespawn && (
                  <div className="panel respawn-card respawn-card-overlay">
                    <div className="panel-title">
                      <h2>Answer 3 to Respawn</h2>
                      <span>{respawnProgress}/{RESPAWN_CORRECT_ANSWERS_REQUIRED}</span>
                    </div>
                    <div className="respawn-meter" aria-label="Respawn progress">
                      <span style={{ width: `${Math.min(100, (respawnProgress / RESPAWN_CORRECT_ANSWERS_REQUIRED) * 100)}%` }} />
                    </div>
                    <p>Get three practice answers correct to return with full warmth and fresh snowballs.</p>
                  </div>
                )}
                <QuizPanel question={question} player={player} session={session} onAnswer={answer} answeringChoice={answeringChoice} />
              </>
            )}
            {buyOpen && (
              <BuyPanel
                player={player}
                session={session}
                onBuy={buy}
                onBuySnowballs={buySnowballs}
                buyingGearId={buyingGearId}
                isBuyingSnowballs={isBuyingSnowballs}
                buyPhaseSeconds={flagBuyPhase ? buyPhaseRemainingSeconds : undefined}
              />
            )}
            {scoreboardOpen && <Scoreboard players={session.players} localPlayerId={player.id} gameMode={session.settings.gameMode} />}
            {settingsOpen && <GamePreferencesPanel preferences={gamePreferences} onChange={updateGamePreferences} />}
          </div>
        )}
        {(session.status === "waiting" || roundEnded || isSocketReconnecting || !player.isAlive || status.error || feedback) && (
          <div className="student-alerts" aria-live="polite">
            {session.status === "waiting" && (
              <div className="panel pre-round-card">
                <h2>{getReadyRoomTitle(session, player)}</h2>
                <p>Wait for the teacher to start the round.</p>
                {session.settings.gameMode === "flag" && session.settings.teamAssignment === "players_choose" && (
                  <div className="button-row">
                    <button className={player.team === "red" ? "active" : ""} onClick={() => chooseTeam("red")}>
                      Red Team
                    </button>
                    <button className={player.team === "blue" ? "active" : ""} onClick={() => chooseTeam("blue")}>
                      Blue Team
                    </button>
                  </div>
                )}
                <div className="live-summary">
                  <span>{session.players.length} joined</span>
                  <span>Top learner: {topLearner?.nickname ?? "not yet"}</span>
                </div>
                <Suspense fallback={<ArenaLoading label="Loading character creator" />}>
                  <CharacterCreator
                    appearance={player.appearance}
                    team={player.team}
                    policy={session.settings.characterCustomization}
                    disabled={session.status !== "waiting" || isSocketReconnecting}
                    onSave={savePlayerAppearance}
                    onUploadDecal={uploadPlayerDecal}
                    loadDecalAsset={loadStudentDecal}
                  />
                </Suspense>
              </div>
            )}
            {roundEnded && (
              <div className="panel pre-round-card student-end-summary">
                <h2>Session Ended</h2>
                <p>{sessionResult}</p>
                <div className="student-summary-metrics">
                  <span><strong>{accuracy(player)}%</strong> question accuracy</span>
                  <span><strong>{formatMoney(player.money)}</strong> earned</span>
                  <span><strong>{player.score}</strong> final score</span>
                </div>
                <div className="button-row">
                  <button className="primary" onClick={returnToJoin}>Join Another Game</button>
                  <button onClick={onExit}>Return to Quiz-Strike</button>
                </div>
              </div>
            )}
            {isSocketReconnecting && (
              <p className="connection-banner">
                <WifiOff size={16} aria-hidden="true" />
                Reconnecting...
              </p>
            )}
            {!player.isAlive && session.settings.gameMode === "flag" && (
              <div className="panel respawn-card">
                <div className="panel-title">
                  <h2>Frozen · Spectator Mode</h2>
                  <span>{spectatorPlayer ? `Watching ${spectatorPlayer.nickname}` : "Waiting"}</span>
                </div>
                <p>You are frozen for this round. Watch another active student until time runs out; you will return at the start of the next round.</p>
                {spectatorCandidates.length > 1 && (
                  <div className="button-row">
                    <button type="button" onClick={() => cycleSpectator(-1)}>Previous Player</button>
                    <button type="button" onClick={() => cycleSpectator(1)}>Next Player</button>
                  </div>
                )}
              </div>
            )}
            {!player.isAlive && session.settings.gameMode !== "flag" && (
              <div className="panel respawn-card">
                <div className="panel-title">
                  <h2>{canPracticeToRespawn ? "Practice to Respawn" : "Waiting for Next Round"}</h2>
                  <span>{respawnProgress}/{RESPAWN_CORRECT_ANSWERS_REQUIRED}</span>
                </div>
                <div className="respawn-meter" aria-label="Respawn progress">
                  <span style={{ width: `${Math.min(100, (respawnProgress / RESPAWN_CORRECT_ANSWERS_REQUIRED) * 100)}%` }} />
                </div>
                <p>{canPracticeToRespawn
                  ? `Answer ${Math.max(0, RESPAWN_CORRECT_ANSWERS_REQUIRED - respawnProgress)} more correctly to rejoin at your team base with full warmth and fresh snowballs.`
                  : "Practice questions are off for this session, so watch the scoreboard and get ready for the next round."}</p>
              </div>
            )}
          </div>
        )}
        {(status.error || feedback) && (
          <div className="notification-layer" aria-live="polite">
            <StatusMessages error={status.error} message={feedback} />
          </div>
        )}
      </div>
      <div className="action-bar control-prompts">
        <button disabled={roundEnded} onClick={() => { gameAudio.playEvent(quizOpen ? "modal_close" : "quiz_open"); setQuizOpen(!quizOpen); setBuyOpen(false); setScoreboardOpen(false); }}>Q Quiz</button>
        <button disabled={roundEnded || !player.isAlive} onClick={() => { gameAudio.play("menu_toggle"); setBuyOpen(!buyOpen); setQuizOpen(false); setScoreboardOpen(false); }}>B Buy · 1-5</button>
        <button onMouseDown={() => { gameAudio.play("menu_toggle"); setScoreboardOpen(true); setQuizOpen(false); setBuyOpen(false); setSettingsOpen(false); }} onMouseUp={() => setScoreboardOpen(false)} onBlur={() => setScoreboardOpen(false)}>Hold Tab · Scoreboard</button>
        <button onClick={() => { gameAudio.play("menu_toggle"); setSettingsOpen((open) => !open); setQuizOpen(false); setBuyOpen(false); setScoreboardOpen(false); }}><Settings size={18} aria-hidden="true" />Settings</button>
      </div>
    </section>
  );
}

function QuizPanel({
  question,
  player,
  session,
  onAnswer,
  answeringChoice
}: {
  question: PublicQuestion | null;
  player: PlayerSession;
  session: GameSession;
  onAnswer: (choice: Choice) => void;
  answeringChoice: Choice | null;
}) {
  if (!question) return <div className="panel"><p>No quiz question is available yet.</p></div>;
  const reward = player.isAlive || session.settings.deadPlayersEarnMoney
    ? `$${session.settings.correctAnswerReward}`
    : session.settings.deadPlayersCanPractice
      ? `Respawn ${player.respawnCorrectAnswers ?? 0}/${RESPAWN_CORRECT_ANSWERS_REQUIRED}`
      : "Practice disabled";
  const labels = {
    A: question.choiceA,
    B: question.choiceB,
    C: question.choiceC,
    D: question.choiceD
  };
  return (
    <div className="panel quiz-panel">
      <div className="panel-title">
        <h2>Quiz Panel</h2>
        <span>{reward}</span>
      </div>
      <p className="question-text">{question.prompt}</p>
      <div className="answer-grid">
        {choices.map((choice, index) => (
          <button key={choice} onClick={() => onAnswer(choice)} disabled={Boolean(answeringChoice)}>
            <strong>{index + 1}</strong>
            {answeringChoice === choice ? "Working..." : labels[choice]}
          </button>
        ))}
      </div>
    </div>
  );
}

function BuyPanel({
  player,
  session,
  onBuy,
  onBuySnowballs,
  buyingGearId,
  isBuyingSnowballs,
  buyPhaseSeconds
}: {
  player: PlayerSession;
  session: GameSession;
  onBuy: (gearId: string) => void;
  onBuySnowballs: () => void;
  buyingGearId: string | null;
  isBuyingSnowballs: boolean;
  buyPhaseSeconds?: number;
}) {
  const GearGlyph = ({ gearId }: { gearId: string }) => {
    if (gearId === "starter_blaster") return <span className="gear-glyph launcher-starter" aria-hidden="true" />;
    if (gearId === "quick_blaster") return <span className="gear-glyph launcher-quick" aria-hidden="true" />;
    if (gearId === "power_blaster") return <span className="gear-glyph launcher-heavy" aria-hidden="true" />;
    return <ShoppingBag size={18} aria-hidden="true" />;
  };

  const snowballPrice = session.settings.snowballPackPrice;
  const snowballCount = session.settings.snowballsPerPack;
  const isBuyingGear = Boolean(buyingGearId);
  const gearLockReason = (cost: number) => {
    if (!player.isAlive) return "Round only";
    if (player.money < cost) return `Need ${formatMoney(cost - player.money)}`;
    return "Base required";
  };
  return (
    <div className="panel buy-panel">
      <div className="panel-title">
        <h2>{buyPhaseSeconds === undefined ? "Buy Menu" : `Buy Phase · ${buyPhaseSeconds}s`}</h2>
        <span>{formatMoney(player.money)}</span>
      </div>
      <p className="buy-shortcut-help">Press 1–5 to buy instantly. Press B to open or close this menu.</p>
      <button
        className="gear-row"
        onClick={onBuySnowballs}
        aria-keyshortcuts="1"
        disabled={!player.isAlive || player.money < snowballPrice || isBuyingSnowballs || isBuyingGear}
      >
        <kbd className="buy-shortcut-key">1</kbd>
        <GearGlyph gearId="snowballs" />
        <span>
          <strong>{isBuyingSnowballs ? "Working..." : `${snowballCount} Snowballs`}</strong>
          <small>Restock ammunition anywhere on the map.</small>
          <small className="gear-status">{player.money < snowballPrice ? `Need ${formatMoney(snowballPrice - player.money)} more` : player.isAlive ? "Ready to buy" : "Available next round"}</small>
        </span>
        <em>{formatMoney(snowballPrice)}</em>
      </button>
      {GEAR_ITEMS.filter((gear) => gear.id !== "starter_blaster").map((gear) => (
        <button
          key={gear.id}
          className="gear-row"
          onClick={() => onBuy(gear.id)}
          aria-keyshortcuts={getShopShortcutKey(gear.id)}
          disabled={!player.isAlive || player.money < gear.cost || isBuyingSnowballs || isBuyingGear}
        >
          <kbd className="buy-shortcut-key">{getShopShortcutKey(gear.id)}</kbd>
          <GearGlyph gearId={gear.id} />
          <span>
            <strong>{buyingGearId === gear.id ? "Working..." : gear.name}</strong>
            <small>{gear.description}</small>
            <small className="gear-status">{(getPlayerWeaponId(player) === gear.id || getPlayerPerks(player).includes(gear.id)) ? "Equipped" : player.money < gear.cost || !player.isAlive ? gearLockReason(gear.cost) : "Ready to buy"}</small>
          </span>
          <em>{formatMoney(gear.cost)}</em>
        </button>
      ))}
    </div>
  );
}

function GamePreferencesPanel({
  preferences,
  onChange
}: {
  preferences: GamePreferences;
  onChange: (update: Partial<GamePreferences>) => void;
}) {
  const [gamepadDetected, setGamepadDetected] = useState(() => Boolean(navigator.getGamepads?.().some((gamepad) => gamepad?.connected)));

  useEffect(() => {
    const sync = () => setGamepadDetected(Boolean(navigator.getGamepads?.().some((gamepad) => gamepad?.connected)));
    window.addEventListener("gamepadconnected", sync);
    window.addEventListener("gamepaddisconnected", sync);
    return () => {
      window.removeEventListener("gamepadconnected", sync);
      window.removeEventListener("gamepaddisconnected", sync);
    };
  }, []);

  return (
    <div className="panel game-preferences-panel">
      <div className="panel-title">
        <h2>Game Settings</h2>
        <span>Saved on this device</span>
      </div>
      <label>
        Graphics quality
        <select value={preferences.arenaQuality} onChange={(event) => onChange({ arenaQuality: event.target.value as GamePreferences["arenaQuality"] })}>
          <option value="auto">Auto (recommended)</option>
          <option value="performance">Low — school device</option>
          <option value="balanced">Medium — balanced</option>
          <option value="high">High — full detail</option>
        </select>
        <small>Low reduces pixel density and decorative detail; team colors, objectives, and route landmarks remain visible.</small>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={preferences.gamepadEnabled} onChange={(event) => onChange({ gamepadEnabled: event.target.checked })} />
        <span>Enable standard controller controls {gamepadDetected ? "(controller connected)" : "(connect a controller to use)"}</span>
      </label>
      <p className="settings-help">Controller: left stick moves, right stick looks, A or right trigger fires, and X interacts.</p>
      <label className="toggle-row">
        <input type="checkbox" checked={preferences.soundEnabled} onChange={(event) => onChange({ soundEnabled: event.target.checked })} />
        <span>Sound effects and background audio</span>
      </label>
      <label>
        Music volume
        <input
          type="range"
          min="0"
          max="0.4"
          step="0.01"
          value={preferences.musicVolume}
          onChange={(event) => onChange({ musicVolume: Number(event.target.value) })}
        />
        <small>{Math.round(preferences.musicVolume * 100)}% arena bed level. Music remains secondary to gameplay feedback.</small>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={preferences.vibrationEnabled} onChange={(event) => onChange({ vibrationEnabled: event.target.checked })} />
        <span>Vibration feedback when available</span>
      </label>
    </div>
  );
}

function ScoreboardLegacy({ players }: { players: PlayerSession[] }) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score || b.correctAnswers - a.correctAnswers);
  const totals = getTeamTotals(players);
  return (
    <div className="scoreboard">
      <div className="panel-title">
        <h2>Scoreboard</h2>
        <span>{players.length} players</span>
      </div>
      <div className="team-score-row">
        <span className="team-score blue-team">Blue {totals.blue}</span>
        <span className="team-score red-team">Red {totals.red}</span>
      </div>
      <div className="score-card-list">
        {sortedPlayers.map((player, index) => (
          <div className={`score-card ${player.team}-team`} key={player.id}>
            <strong>#{index + 1} {player.nickname}{player.isBot ? " Bot" : ""}</strong>
            <span>{teamLabel(player.team)} · {player.isAlive ? "Active" : "Out for round"}</span>
            <small>{player.correctAnswers} correct · {accuracy(player)}% · {formatMoney(player.money)} · Score {player.score}</small>
          </div>
        ))}
        {players.length === 0 && <p>No students connected yet.</p>}
      </div>
    </div>
  );
}

function Scoreboard({
  players,
  localPlayerId,
  gameMode
}: {
  players: PlayerSession[];
  localPlayerId?: string;
  gameMode: SessionSettings["gameMode"];
}) {
  const grouped = groupScoreboardRows(players, gameMode, localPlayerId);
  const totals = getTeamTotals(players);
  const zombieCounts = getZombieCounts(players);
  return (
    <div className="scoreboard">
      <div className="panel-title">
        <h2>Scoreboard</h2>
        <span>{players.length} players</span>
      </div>
      <div className="team-score-row">
        {gameMode === "zombie" ? (
          <>
            <span className="team-score blue-team">Humans {zombieCounts.humans}</span>
            <span className="team-score red-team">Zombies {zombieCounts.zombies}</span>
          </>
        ) : (
          <>
            <span className="team-score blue-team">Blue {totals.blue}</span>
            <span className="team-score red-team">Red {totals.red}</span>
          </>
        )}
      </div>
      <div className="scoreboard-table-wrap">
        {grouped.map((group) => (
          <div className="scoreboard-group" key={group.id}>
            <h3>{group.label} <span>{group.rows.length}</span></h3>
            <table className="scoreboard-table">
              <caption>{group.label} scoreboard</caption>
              <thead>
                <tr className="scoreboard-row scoreboard-head">
                  <th scope="col">Player Name</th>
                  <th scope="col">Tags</th>
                  <th scope="col">Respawns</th>
                  <th scope="col">Question Accuracy</th>
                </tr>
              </thead>
              <tbody>
              {group.rows.map((row) => (
                <tr className={`scoreboard-row ${row.teamId}-team`} key={row.playerId}>
                  <th scope="row" title={row.displayName}>
                    {row.displayName}
                    {row.isBot ? " Bot" : ""}
                    {row.isLocalPlayer ? " You" : ""}
                    {row.connectionState === "disconnected" ? " Offline" : ""}
                    <small>{gameMode === "zombie" ? (row.role === "zombie" ? "Zombie" : "Human") : teamLabel(row.teamId)}</small>
                  </th>
                  <td>{row.tags}</td>
                  <td>{row.respawns}</td>
                  <td>{row.questionAccuracy}</td>
                </tr>
              ))}
              {group.rows.length === 0 && <tr><td colSpan={4}>No players in this group.</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventFeed({ events }: { events: GameEvent[] }) {
  const recentEvents = events.slice(0, 8);
  return (
    <div className="event-feed">
      <div className="panel-title">
        <h2>Live Feed</h2>
        <span>{recentEvents.length ? "Latest actions" : "Waiting"}</span>
      </div>
      <div className="event-list" aria-live="polite">
        {recentEvents.map((event) => (
          <div className={`event-item event-${event.type}`} key={event.id}>
            <strong>{event.type}</strong>
            <span>{event.message}</span>
            <small>{new Date(event.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>
          </div>
        ))}
        {recentEvents.length === 0 && <p>No live actions yet.</p>}
      </div>
    </div>
  );
}
