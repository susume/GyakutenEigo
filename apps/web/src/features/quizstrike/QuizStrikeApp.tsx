import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  Mic,
  Package,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Snowflake,
  Square,
  Target,
  Timer,
  Trash2,
  Trophy,
  Users,
  WifiOff,
  WandSparkles,
  Zap
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import {
  calculateAccuracy,
  calculateClassAccuracy,
  canStartRound,
  DEFAULT_SESSION_SETTINGS,
  GEAR_ITEMS,
  ZOMBIE_HUMAN_CORRECT_ENERGY,
  ZOMBIE_HUMAN_MAX_ENERGY,
  canPlayerFireInMode,
  getCosmeticProgress,
  getArenaGroundHeight,
  ARENA_PLAYER_EYE_HEIGHT,
  ARENA_SCALE,
  DESERT_CITADEL_MAIN_LEVEL_Y,
  DESERT_CITADEL_ROOFTOP_LEVEL_Y,
  IRON_JUNCTION_LOADING_LEVEL_Y,
  IRON_JUNCTION_OVERPASS_LEVEL_Y,
  TEMPLE_RUNOFF_MAIN_LEVEL_Y,
  TEMPLE_RUNOFF_UPPER_LEVEL_Y,
  getPlayerWeaponIdForMode,
  RESPAWN_CORRECT_ANSWERS_REQUIRED,
  getRoundRemainingSeconds,
  isRoundPreparationPhase,
  isZombieSelectionPhase,
  sanitizePlayerAppearance,
  type CharacterCustomizationSettings,
  type ArenaMapId,
  type BotDifficulty,
  type Choice,
  type GameEvent,
  type FlagPlantedEvent,
  type FreezeStreakAnnouncementEvent,
  FREEZE_STREAK_ANNOUNCEMENTS,
  FlagPlantedEventSchema,
  FreezeStreakAnnouncementEventSchema,
  validateSessionSnapshot,
  type GameSession,
  type PlayerSession,
  type PlayerAppearance,
  type PublicQuestion,
  type QuizFolder,
  type QuizSet,
  type ReportMetadata,
  type SessionReport,
  type SessionSettings,
  type Team,
  type TeacherUser
} from "@quizstrike/shared";
import { ApiError, authApi, fetchDecalAsset, getTeacherToken, studentApi, teacherApi } from "../../api/client";
import { createMultiplayerSocket } from "../multiplayer/connection";
import { buildStudentJoinUrl, getJoinCodeFromSearch, getTournamentInvitationCodeFromSearch, modeForRoute, normalizeRoutePath, type AppMode } from "../../navigation";
import { getModeScoreSummary, getSessionResultText, getZombieCounts } from "../../sessionPresentation";
import { formatStudentJoinError } from "../../studentJoinErrors";
import { getShopShortcut } from "../../shopShortcuts";
import { sendStudentCommand } from "../../studentCommandTransport";
import { StatusMessages } from "../../ui/StatusMessages";
import PublicHomepage from "../../ui/PublicHomepage";
import QuizStrikeLogo from "../../ui/QuizStrikeLogo";
import TeacherDecalGallery from "../../ui/TeacherDecalGallery";
import CompetitionHub, { OrganizerWorkspace } from "./competition/CompetitionHub";
import TournamentCenter from "./tournament/TournamentCenter";
import TournamentRegistrationPage from "./tournament/TournamentRegistrationPage";
import TournamentStudyPage from "./tournament/TournamentStudyPage";
import { ARENA_MAPS, getArenaMap } from "../../game/arenaMaps";
import {
  CHARACTER_STRESS_COUNTS,
  createCharacterDebugSession,
  summarizeCharacterDebugSession,
  type CharacterStressCount
} from "../../game/characters/CharacterDebugScenarios";
import { gameAudio, getCombatAudioSpatial, type AudioEventCue, type GameAudioCue } from "../../game/GameAudio";
import { gameplayAnnouncements } from "../../game/GameplayAnnouncements";
import { readGamePreferences, writeGamePreferences, type ArenaQuality, type GamePreferences } from "../../game/gamePreferences";
import { emitArenaVfx, type ArenaVfxKind } from "../../game/ArenaVfx";
import { emitArenaAnimation, type ArenaAnimationCue } from "../../game/ArenaAnimation";
import {
  getIncomingHitDirection,
  shouldAutoOpenRespawnPractice
} from "../../studentCombatFeedback";
import ArenaLoading from "./shared/ArenaLoading";
import GameAnnouncementOverlay from "./shared/GameAnnouncementOverlay";
import BuyPanel from "./student/BuyPanel";
import EventFeed from "./student/EventFeed";
import GamePreferencesPanel from "./student/GamePreferencesPanel";
import QuizPanel from "./student/QuizPanel";
import Scoreboard from "./student/Scoreboard";
import { useStudentGameState } from "./student/useStudentGameState";
import { useSessionControls } from "./teacher/useSessionControls";

const ArenaPreview = lazy(() => import("../../game/ArenaPreview"));
const CharacterCreator = lazy(() => import("../../ui/PremiumCharacterCreator"));

type DashboardPayload = {
  classes: Array<{ id: string; name: string; description?: string; createdAt: string }>;
  quizSets: QuizSet[];
  sessions: GameSession[];
  folders: QuizFolder[];
  reports: ReportMetadata[];
};

type AuthPayload = { user: TeacherUser; token: string };
type StoredStudentSession = { sessionCode: string; playerId: string; playerToken: string };
type ApiWakeState = "waking" | "ready" | "slow";
type SetupSection = "mode" | "arena" | "advanced";

const emptyQuestion = {
  prompt: "",
  choiceA: "",
  choiceB: "",
  choiceC: "",
  choiceD: "",
  correctChoice: "A",
  explanation: "",
  difficulty: "",
  audioUrl: ""
};

const choices: Choice[] = ["A", "B", "C", "D"];
const STUDENT_SESSION_STORAGE_KEY = "quizstrike_student_session";
const STUDENT_APPEARANCE_STORAGE_KEY = "quizstrike_student_appearance_v1";
const COSMETIC_PROGRESS_STORAGE_KEY = "quizstrike_cosmetic_progress_v1";
const TEACHER_FOLDER_SELECTION_STORAGE_KEY = "quizstrike_teacher_folder_selection_v1";
const TOURNAMENT_TEACHER_RETURN_KEY = "quizstrike_tournament_teacher_return";

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

const readCosmeticProgressToken = () => {
  const token = localStorage.getItem(COSMETIC_PROGRESS_STORAGE_KEY);
  return token && token.length <= 2_048 ? token : undefined;
};

const storeCosmeticProgressToken = (token?: string) => {
  if (token && token.length <= 2_048) localStorage.setItem(COSMETIC_PROGRESS_STORAGE_KEY, token);
};

const readStoredAppearance = (): PlayerAppearance | null => {
  try {
    const raw = localStorage.getItem(STUDENT_APPEARANCE_STORAGE_KEY);
    return raw ? sanitizePlayerAppearance(JSON.parse(raw) as Partial<PlayerAppearance>) : null;
  } catch {
    return null;
  }
};

type QuestionDraft = typeof emptyQuestion;
type ArenaPositionPayload = {
  x: number;
  z: number;
  y?: number;
  facing: number;
  pitch?: number;
  scoped?: boolean;
  zoomLevel?: number;
  sprinting?: boolean;
  crouching?: boolean;
  jumping?: boolean;
};
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
      converted?: boolean;
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
  return blockedTerm ? "Choose a classroom-friendly name." : "";
};

const sessionNumberFields = [
  { name: "roundCount", label: "Number of rounds", min: 1, max: 30, help: "How many rounds the class will play." },
  { name: "flagHoldSeconds", label: "Flag hold time", min: 5, max: 180, step: 5, unit: "seconds", help: "How long Red protects a placed flag." },
  { name: "initialZombieCount", label: "Starting Zombies", min: 1, max: 20, help: "How many students become Zombies after the energy period." },
  { name: "maxPlayers", label: "Student limit", min: 2, max: 40, unit: "students", help: "The largest class size this room can hold, including test bots." },
  { name: "startingMoney", label: "Starting rewards", min: 0, max: 16000, step: 100, unit: "rewards", help: "Rewards each student starts with." },
  { name: "correctAnswerReward", label: "Reward per correct answer", min: 0, max: 5000, step: 100, unit: "rewards", help: "Rewards earned for each correct answer." },
  { name: "startingSnowballs", label: "Starting snowballs", min: 1, max: 99, unit: "snowballs", help: "Ammunition each student starts with." },
  { name: "snowballPackPrice", label: "Snowball pack price", min: 0, max: 5000, step: 50, unit: "rewards", help: "Reward cost of one snowball pack." },
  { name: "snowballsPerPack", label: "Snowballs per pack", min: 1, max: 50, unit: "snowballs", help: "Ammunition in each pack." },
  { name: "wrongAnswerPenalty", label: "Wrong answer penalty", min: 0, max: 16000, step: 100, unit: "rewards", help: "Rewards removed for an incorrect answer." },
  { name: "roundDurationSeconds", label: "Round time", min: 60, max: 3600, step: 30, unit: "seconds", help: "Time available for each round." }
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

// Retained for the legacy session settings panel, which is currently hidden from the public route.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    .map((line) => line.trim().replace(/^\d+[).]\s*/, ""))
    .filter(Boolean)
    .map(splitStudyLine);

  const pairedEntries = entries.filter((entry) => entry.definition);
  if (pairedEntries.length >= 2) {
    return pairedEntries.map((entry) => {
      const distractors = shuffle(pairedEntries.filter((candidate) => candidate.term !== entry.term))
        .slice(0, 3)
        .map((candidate) => candidate.definition);
      const generatedChoices = shuffle([entry.definition, ...distractors]).slice(0, 4);
      while (generatedChoices.length < 4) generatedChoices.push("Review this term again");
      const correctIndex = generatedChoices.indexOf(entry.definition);
      return {
        prompt: `What matches "${entry.term}"?`,
        choiceA: generatedChoices[0],
        choiceB: generatedChoices[1],
        choiceC: generatedChoices[2],
        choiceD: generatedChoices[3],
        correctChoice: choices[correctIndex] ?? "A",
        explanation: entry.definition,
        difficulty: "Imported",
        audioUrl: ""
      };
    });
  }

  const terms = entries.map((entry) => entry.term).filter(Boolean);
  return terms.map((term) => {
    const distractors = shuffle(terms.filter((candidate) => candidate !== term)).slice(0, 3);
    const generatedChoices = shuffle([term, ...distractors]).slice(0, 4);
    while (generatedChoices.length < 4) generatedChoices.push("Not in this list");
    const correctIndex = generatedChoices.indexOf(term);
    return {
      prompt: "Which item was included in this study list?",
      choiceA: generatedChoices[0],
      choiceB: generatedChoices[1],
      choiceC: generatedChoices[2],
      choiceD: generatedChoices[3],
      correctChoice: choices[correctIndex] ?? "A",
      explanation: `${term} was imported from the pasted list.`,
      difficulty: "Imported",
      audioUrl: ""
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
    setError(err instanceof ApiError || err instanceof Error ? err.message : "We couldn't complete that. Try again.");
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

const formatRewards = (value: number) => `${Math.round(value)} rewards`;

const teamLabel = (team: PlayerSession["team"]) => (team === "blue" ? "Blue Team" : "Red Team");

const sessionStatusLabel = (status: GameSession["status"]) => {
  if (status === "active") return "Round live";
  if (status === "paused") return "Round results";
  if (status === "ended") return "Game over";
  return "Waiting for players";
};

const gameModeLabel = (mode: SessionSettings["gameMode"]) => {
  if (mode === "flag") return "Capture the Flag";
  if (mode === "zombie") return "Zombie Survival";
  return "Team Tag";
};

const arenaMapLabel = (mapId: ArenaMapId | string | undefined) => getArenaMap(mapId).title;
const arenaMapDisplayTitle = (title: string) => title.replace(/\s2\.0$/, "");

const ARENA_MAP_PREVIEW_ASSETS: Record<ArenaMapId, string> = {
  desert_citadel: "/assets/arena-maps/desert-citadel.png",
  iron_junction: "/assets/arena-maps/iron-junction.png",
  temple_runoff: "/assets/arena-maps/temple-runoff.png"
};

const flagStatusText = (session: GameSession) => {
  if (session.settings.gameMode !== "flag") return "";
  if (!session.flag) return "Flag ready at Red base";
  if (session.flag.state === "carried") return "Red is carrying the flag";
  if (session.flag.state === "dropped") return "The flag is down";
  if (session.flag.state === "placed") return "Flag placed. Red protects. Blue captures.";
  if (session.flag.state === "captured") return "Blue captured the flag";
  return "Flag ready";
};

const zombieStatusText = (session: GameSession, player?: PlayerSession | null) => {
  if (session.settings.gameMode !== "zombie") return "";
  const humans = session.players.filter((item) => item.role !== "zombie").length;
  const zombies = session.players.filter((item) => item.role === "zombie").length;
  return player?.role === "zombie"
    ? `Humans ${humans} · Zombies ${zombies} · Find the Blue humans`
    : `Humans ${humans} · Zombies ${zombies} · Answer for energy, then run`;
};

const getTopLearner = (players: PlayerSession[]) =>
  [...players]
    .filter((player) => !player.isBot && player.correctAnswers + player.wrongAnswers > 0)
    .sort((a, b) => b.correctAnswers - a.correctAnswers || b.score - a.score)[0];

const getTeamTotals = (players: PlayerSession[]) => ({
  blue: players.filter((player) => player.team === "blue").reduce((total, player) => total + player.score, 0),
  red: players.filter((player) => player.team === "red").reduce((total, player) => total + player.score, 0)
});

const sessionSettingGroups: Array<{ title: string; fields: SessionNumberField[] }> = [
  { title: "Game", fields: ["roundCount", "roundDurationSeconds", "maxPlayers"] },
  { title: "Quiz Economy", fields: ["startingMoney", "correctAnswerReward", "wrongAnswerPenalty", "snowballPackPrice"] },
  { title: "Weapons / Supplies", fields: ["startingSnowballs", "snowballsPerPack"] }
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

function useFlagRemainingSeconds(session: GameSession | null) {
  const [clientNowMs, setClientNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const expiresAtMs = session?.flag?.state === "placed" ? session.flag.expiresAtMs : undefined;

  useEffect(() => {
    const serverTimeMs = session?.serverTime ? Date.parse(session.serverTime) : Number.NaN;
    setServerOffsetMs(Number.isFinite(serverTimeMs) ? serverTimeMs - Date.now() : 0);
  }, [session?.serverTime]);

  useEffect(() => {
    setClientNowMs(Date.now());
    if (expiresAtMs === undefined) return;
    const interval = window.setInterval(() => setClientNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [expiresAtMs, session?.serverTime]);

  if (expiresAtMs === undefined) return 0;
  return Math.max(0, Math.ceil((expiresAtMs - (clientNowMs + serverOffsetMs)) / 1000));
}

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
        <button className="brand-button" type="button" aria-label="QuizStrike Classroom home" onClick={() => navigateTo("/", "home")}>
          <QuizStrikeLogo />
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
      {mode === "quizStrike" && routePath === "/quiz-strike/organizer" && <OrganizerWorkspace teacher={teacher} onNavigate={navigateTo} />}
      {mode === "quizStrike" && isTournamentRegistrationRoute && <TournamentRegistrationPage
        tournamentId={decodeURIComponent(tournamentRegistrationId)}
        invitationCode={getTournamentInvitationCodeFromSearch(window.location.search)}
        teacher={teacher}
        onTeacherLogin={() => { sessionStorage.setItem(TOURNAMENT_TEACHER_RETURN_KEY, `${window.location.pathname}${window.location.search}`); setTeacherAuthMode("login"); navigateTo("/quiz-strike", "teacher"); }}
      />}
      {mode === "quizStrike" && routePath !== "/quiz-strike/organizer" && !isTournamentRegistrationRoute && <QuizStrikeLanding
        teacher={teacher}
        slug={routePath.startsWith("/quiz-strike/competitions/") ? decodeURIComponent(routePath.slice("/quiz-strike/competitions/".length)) : undefined}
        onNavigate={navigateTo}
        onTeacherLogin={() => { setTeacherAuthMode("login"); navigateTo("/quiz-strike", "teacher"); }}
      />}
      {mode === "tournamentStudy" && <TournamentStudyPage tournamentId={decodeURIComponent(routePath.slice("/tournament-study/".length))} />}
      {mode === "characterLab" && (isCharacterLabAvailable ? <CharacterLab /> : <InternalToolNotice onReturn={() => navigateTo("/quiz-strike", "quizStrike")} />)}
      {mode === "teacher" &&
        (teacher ? <TeacherDashboard teacher={teacher} onLogout={logout} /> : <TeacherAuth apiWakeState={apiWakeState} initialMode={teacherAuthMode} onAuthed={(user) => {
          setTeacher(user);
          const returnTo = sessionStorage.getItem(TOURNAMENT_TEACHER_RETURN_KEY);
          sessionStorage.removeItem(TOURNAMENT_TEACHER_RETURN_KEY);
          navigateTo(returnTo ?? "/quiz-strike", returnTo ? "quizStrike" : "teacher");
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
            lower: { x: -140 * ARENA_SCALE, y: ARENA_PLAYER_EYE_HEIGHT, z: 0, facing: -Math.PI / 2 },
            main: { x: -45 * ARENA_SCALE, y: DESERT_CITADEL_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: 10 * ARENA_SCALE, facing: -Math.PI / 2 },
            upper: { x: 138 * ARENA_SCALE, y: DESERT_CITADEL_ROOFTOP_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: 81 * ARENA_SCALE, facing: Math.PI / 2 }
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
        <article className="game-host-card" aria-label="QuizStrike Classroom game preview">
          <div className="hero-arena-preview">
            <img className="game-host-card-art" src="/assets/quizstrike-classroom-cover.webp" alt="QuizStrike Classroom cover art showing red and blue teams answering questions in a desert arena." width={1672} height={941} fetchPriority="high" />
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

function QuizStrikeLanding({ teacher, slug, onNavigate, onTeacherLogin }: { teacher?: TeacherUser | null; slug?: string; onNavigate: (path: string, mode?: "quizStrike" | "teacher") => void; onTeacherLogin: () => void }) {
  return <CompetitionHub teacher={teacher} slug={slug} onNavigate={onNavigate} onTeacherLogin={onTeacherLogin} />;
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
          detail: "Your teacher workspace is ready."
        }
      : apiWakeState === "slow"
        ? {
            tone: "slow",
            title: "Taking a little longer",
            detail: "You can keep going. We’ll retry once if needed."
          }
        : {
            tone: "waking",
            title: "Getting the classroom ready",
            detail: "Enter your details while your teacher workspace starts."
          };

  const submitLabel = isSubmitting
    ? authProgress === "retrying"
      ? "Trying again..."
      : isSignup
        ? "Creating your workspace..."
        : apiWakeState === "ready"
          ? "Signing in..."
          : "Getting things ready..."
    : isSignup
      ? "Create teacher workspace"
      : "Sign in";

  return (
    <section className="auth-layout quizstrike-auth-layout">
      <aside className="auth-visual" aria-label="QuizStrike Classroom teacher workspace">
        <img className="auth-visual-art" src="/assets/quizstrike-classroom-cover.webp" alt="" width={1672} height={941} fetchPriority="high" />
        <div className="auth-visual-shade" aria-hidden="true" />
        <div className="auth-visual-content">
          <QuizStrikeLogo size="auth" />
          <span className="auth-kicker">A clear home for your next class game</span>
          <p className="auth-visual-title">Choose the questions.<br />Start the game.</p>
          <p>Build a question set, open a private room, and keep the class focused from one simple workspace.</p>
          <span className="auth-tagline">Ready in minutes. Built for classrooms.</span>
        </div>
      </aside>
      <form className="panel form-panel auth-form-panel" onSubmit={submit}>
        <div className="auth-form-heading">
          <span className="auth-kicker">Teacher workspace</span>
          <h1>{isSignup ? "Create your teacher workspace" : "Welcome back"}</h1>
          <p>{isSignup ? "Set up your workspace and host your first classroom game." : "Sign in to open your question library and live rooms."}</p>
        </div>
        {isSignup && (
          <label htmlFor="teacher-name">
            Your name
            <input id="teacher-name" autoComplete="name" value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); status.clearError(); }} />
          </label>
        )}
        <label htmlFor="teacher-email">
          School email
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
          {isSignup ? "I already have an account" : "Create a teacher workspace"}
        </button>
      </form>
    </section>
  );
}

function TeacherDashboard({ teacher, onLogout }: { teacher: TeacherUser; onLogout: () => void }) {
  const [tab, setTab] = useState<"home" | "quizzes" | "sessions" | "reports" | "settings" | "tournaments">("home");
  const [activeSetupSection, setActiveSetupSection] = useState<SetupSection>("mode");
  const [quizManagerRequest, setQuizManagerRequest] = useState<{ quizSetId?: string; mode: "create" | "edit" }>({ mode: "create" });
  const [data, setData] = useState<DashboardPayload>({ classes: [], quizSets: [], sessions: [], folders: [], reports: [] });
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null);
  const [launchQuizId, setLaunchQuizId] = useState("");
  const [report, setReport] = useState<SessionReport | null>(null);
  const [isSocketReconnecting, setIsSocketReconnecting] = useState(false);
  const [gamePreferences, setGamePreferences] = useState<GamePreferences>(() => readGamePreferences());
  const status = useAsyncMessage();
  const reportStatus = status.report;

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
        && document.visibilityState === "visible"
      ));
    };
    syncBgm();
    document.addEventListener("visibilitychange", syncBgm);
    return () => {
      document.removeEventListener("visibilitychange", syncBgm);
      gameAudio.setBgmActive(false);
    };
  }, [tab, selectedSession?.id, selectedSession?.status]);

  const refresh = useCallback(async () => {
    try {
      const payload = (await teacherApi.dashboard()) as DashboardPayload;
      setData(payload);
      setSelectedSession((current) => {
        if (!current) return payload.sessions[0] ?? null;
        return payload.sessions.find((session) => session.id === current.id) ?? payload.sessions[0] ?? null;
      });
    } catch (err) {
      reportStatus(err);
    }
  }, [reportStatus]);

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
    socket.on("player_state", (payload: { players?: PlayerSession[]; flag?: GameSession["flag"]; recentEvents?: GameSession["events"] }) => {
      if (!Array.isArray(payload.players)) return;
      setSelectedSession((current) => current ? {
        ...current,
        players: current.players.map((player) => payload.players?.find((next) => next.id === player.id) ?? player),
        ...(payload.flag ? { flag: payload.flag } : {}),
        ...(payload.recentEvents ? { events: payload.recentEvents } : {})
      } : current);
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setIsSocketReconnecting(false);
    };
  }, [selectedSession?.sessionCode]);

  const activeSessions = data.sessions.filter((session) => session.status !== "ended");
  const isLiveSetup = tab === "sessions" && !selectedSession;
  const openQuizManager = (quizSetId?: string) => {
    setQuizManagerRequest(quizSetId ? { quizSetId, mode: "edit" } : { mode: "create" });
    setTab("quizzes");
  };

  return (
    <section className="workspace">
      <div className="dashboard-brand-row">
        <h1><QuizStrikeLogo size="dashboard" /></h1>
        <div><strong>{teacher.name}</strong><button onClick={onLogout}>Sign Out</button></div>
      </div>
      <aside className={`sidebar${isLiveSetup ? " setup-sidebar" : ""}`} aria-label={isLiveSetup ? "Live game setup sections" : "Teacher sections"}>
        {isLiveSetup ? (
          <div className="setup-sidebar-menu">
            <span className="setup-sidebar-kicker">Live game setup</span>
            <button className={activeSetupSection === "mode" ? "active" : ""} aria-current={activeSetupSection === "mode" ? "step" : undefined} onClick={() => setActiveSetupSection("mode")}>
              <span className="setup-sidebar-index">1</span>
              <strong>Game Mode</strong>
            </button>
            <button className={activeSetupSection === "arena" ? "active" : ""} aria-current={activeSetupSection === "arena" ? "step" : undefined} onClick={() => setActiveSetupSection("arena")}>
              <span className="setup-sidebar-index">2</span>
              <strong>Arena</strong>
            </button>
            <button className={activeSetupSection === "advanced" ? "active" : ""} aria-current={activeSetupSection === "advanced" ? "step" : undefined} onClick={() => setActiveSetupSection("advanced")}>
              <span className="setup-sidebar-index">3</span>
              <Settings size={17} aria-hidden="true" />
              <strong>Game details</strong>
            </button>
            <button className="setup-sidebar-back" onClick={() => setTab("home")}>
              <ChevronLeft size={17} aria-hidden="true" />
              Back to question library
            </button>
          </div>
        ) : (
          <>
            <button aria-current={tab === "home" ? "page" : undefined} className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>
              <BookOpen size={17} aria-hidden="true" />
              Question library
            </button>
            <button aria-current={tab === "reports" ? "page" : undefined} className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>
              Reports
            </button>
            <button aria-current={tab === "tournaments" ? "page" : undefined} className={tab === "tournaments" ? "active" : ""} onClick={() => setTab("tournaments")}>
              <Trophy size={17} aria-hidden="true" />
              Competitions
            </button>
            <button aria-current={tab === "settings" ? "page" : undefined} className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
              <Settings size={17} aria-hidden="true" />
              Settings
            </button>
          </>
        )}
      </aside>

      <div className="main-panel">
        <div className="section-heading dashboard-section-heading">
          <div>
            <span className="eyebrow">Teacher workspace</span>
            <p>Prepare the questions, start the game, and see what to revisit.</p>
          </div>
          <button onClick={refresh}>
            <RefreshCw size={18} aria-hidden="true" />
            Refresh data
          </button>
        </div>
        <StatusMessages error={status.error} message={status.message} />
        {isSocketReconnecting && (
          <p className="connection-banner">
            <WifiOff size={16} aria-hidden="true" />
            Connection paused · trying again...
          </p>
        )}

        {tab === "home" && (
          <TeacherFolders
            data={data}
            onEditQuiz={openQuizManager}
            onRefresh={refresh}
            onPlayLive={(quizSetId) => {
              setLaunchQuizId(quizSetId);
              setSelectedSession(null);
              setActiveSetupSection("mode");
              setTab("sessions");
            }}
          />
        )}
        {tab === "quizzes" && (
          <QuizManager
            key={`${quizManagerRequest.mode}:${quizManagerRequest.quizSetId ?? "new"}`}
            data={data}
            onRefresh={refresh}
            initialQuizSetId={quizManagerRequest.quizSetId}
            startInCreateMode={quizManagerRequest.mode === "create"}
          />
        )}
        {tab === "sessions" && (
          <SessionManager
            data={data}
            selectedSession={selectedSession}
            setSelectedSession={setSelectedSession}
            onRefresh={refresh}
            onReport={setReport}
            onOpenReports={() => setTab("reports")}
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
        {tab === "tournaments" && <TournamentCenter teacher={teacher} quizSets={data.quizSets.map((quiz) => ({ id: quiz.id, title: quiz.title }))} />}

        {activeSessions.length > 0 && (
          <div className="live-rail">
            {activeSessions.map((session) => (
              <button
                key={session.id}
                className={selectedSession?.id === session.id ? "active session-chip" : "session-chip"}
                onClick={() => {
                  setSelectedSession(session);
                  setLaunchQuizId(session.quizSetId);
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

function TeacherFolders({
  data,
  onEditQuiz,
  onPlayLive,
  onRefresh
}: {
  data: DashboardPayload;
  onEditQuiz: (quizSetId?: string) => void;
  onPlayLive: (quizSetId: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(() => localStorage.getItem(TEACHER_FOLDER_SELECTION_STORAGE_KEY) || undefined);
  const [draggedQuizId, setDraggedQuizId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const folderById = useMemo(() => new Map(data.folders.map((folder) => [folder.id, folder])), [data.folders]);
  const selectedFolder = selectedFolderId ? folderById.get(selectedFolderId) : undefined;
  const childFolders = useMemo(
    () => data.folders.filter((folder) => folder.parentId === selectedFolderId).sort((left, right) => left.name.localeCompare(right.name)),
    [data.folders, selectedFolderId]
  );
  const visibleQuizSets = useMemo(
    () => data.quizSets.filter((quiz) => quiz.folderId === selectedFolderId).sort((left, right) => left.title.localeCompare(right.title)),
    [data.quizSets, selectedFolderId]
  );
  const filteredQuizSets = useMemo(
    () => visibleQuizSets.filter((quiz) => quiz.title.toLowerCase().includes(searchTerm.trim().toLowerCase())),
    [searchTerm, visibleQuizSets]
  );
  const featuredQuiz = filteredQuizSets[0];
  useEffect(() => {
    if (selectedFolderId && !folderById.has(selectedFolderId)) {
      setSelectedFolderId(undefined);
      return;
    }
    if (selectedFolderId) localStorage.setItem(TEACHER_FOLDER_SELECTION_STORAGE_KEY, selectedFolderId);
    else localStorage.removeItem(TEACHER_FOLDER_SELECTION_STORAGE_KEY);
  }, [folderById, selectedFolderId]);
  const folderPath = (folder: QuizFolder) => {
    const path: QuizFolder[] = [];
    let current: QuizFolder | undefined = folder;
    while (current) {
      path.unshift(current);
      current = current.parentId ? folderById.get(current.parentId) : undefined;
    }
    return path;
  };
  const runAction = async (action: () => Promise<unknown>) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await action();
      await onRefresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The library action failed.");
    } finally {
      setIsBusy(false);
    }
  };
  const createFolder = () => {
    const name = window.prompt("Name this folder", "New folder")?.trim();
    if (!name) return;
    void runAction(() => teacherApi.createFolder({ name, ...(selectedFolderId ? { parentId: selectedFolderId } : {}) }));
  };
  const renameFolder = (folder: QuizFolder) => {
    const name = window.prompt("Rename this folder", folder.name)?.trim();
    if (!name || name === folder.name) return;
    void runAction(() => teacherApi.updateFolder(folder.id, { name }));
  };
  const moveFolder = (folder: QuizFolder) => {
    const destinations = [
      { id: "", label: "All question sets" },
      ...data.folders
        .filter((candidate) => candidate.id !== folder.id && !folderPath(candidate).some((ancestor) => ancestor.id === folder.id))
        .map((candidate) => ({ id: candidate.id, label: folderPath(candidate).map((item) => item.name).join(" / ") }))
    ];
    const choice = window.prompt(`Move “${folder.name}” to:\n${destinations.map((item, index) => `${index + 1}. ${item.label}`).join("\n")}\nEnter a number.`);
    if (choice === null) return;
    const destination = destinations[Number(choice) - 1];
    if (!destination) {
      window.alert("Choose one of the folder numbers listed.");
      return;
    }
    void runAction(() => teacherApi.updateFolder(folder.id, { parentId: destination.id || null }));
  };
  const deleteFolder = (folder: QuizFolder) => {
    if (!window.confirm(`Delete the empty folder “${folder.name}”?`)) return;
    void runAction(async () => {
      await teacherApi.deleteFolder(folder.id);
      if (selectedFolderId === folder.id) setSelectedFolderId(folder.parentId);
    });
  };
  const moveQuiz = (quiz: QuizSet, folderId: string | undefined) => {
    if (quiz.folderId === folderId) return;
    void runAction(() => teacherApi.moveQuizSet(quiz.id, folderId));
  };
  const dropQuizIntoFolder = (quizId: string | null, folderId: string | undefined) => {
    if (!quizId) return;
    const quiz = data.quizSets.find((item) => item.id === quizId);
    if (quiz) moveQuiz(quiz, folderId);
    setDraggedQuizId(null);
  };
  const renameQuiz = (quiz: QuizSet) => {
    const title = window.prompt("Rename this question set", quiz.title)?.trim();
    if (!title || title === quiz.title) return;
    void runAction(() => teacherApi.renameQuizSet(quiz.id, title));
  };
  const deleteQuiz = (quiz: QuizSet) => {
    if (!window.confirm(`Delete “${quiz.title}”? This cannot be undone.`)) return;
    void runAction(() => teacherApi.deleteQuizSet(quiz.id));
  };
  return (
    <section className="teacher-folders">
      <div className="folders-heading">
        <div><span className="teacher-eyebrow">Question library</span><h2>Keep your best questions close</h2><p>Choose a set, then start the right game for your class.</p></div>
        <div className="folder-heading-actions">
          <button className="folder-new" onClick={createFolder} disabled={isBusy}>New folder <Plus size={18} aria-hidden="true" /></button>
          <button className="folder-new" onClick={() => onEditQuiz()}><BookOpen size={18} aria-hidden="true" />Create question set</button>
        </div>
      </div>
      <div className="folder-breadcrumbs" aria-label="Folder path">
        <button className={!selectedFolderId ? "active" : ""} onClick={() => setSelectedFolderId(undefined)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); dropQuizIntoFolder(draggedQuizId, undefined); }}><Folder size={15} aria-hidden="true" />All question sets</button>
        {(selectedFolder ? folderPath(selectedFolder) : []).map((folder) => <span key={folder.id}><ChevronRight size={14} aria-hidden="true" /><button className={folder.id === selectedFolderId ? "active" : ""} onClick={() => setSelectedFolderId(folder.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); dropQuizIntoFolder(draggedQuizId, folder.id); }}>{folder.name}</button></span>)}
      </div>
      <div className="folder-chips" aria-label="Quiz folders">
        {data.folders.length === 0 && <span className="folder-library-note">No folders yet. Add one when your question library starts to grow.</span>}
        {childFolders.map((folder) => <div className="folder-chip-item" key={folder.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); dropQuizIntoFolder(draggedQuizId, folder.id); }}>
          <button onClick={() => setSelectedFolderId(folder.id)}><Folder size={15} aria-hidden="true" />{folder.name}</button>
          <button className="folder-chip-action" onClick={() => renameFolder(folder)}>Rename</button>
          <button className="folder-chip-action" onClick={() => moveFolder(folder)}>Move</button>
          <button className="folder-chip-action danger" aria-label={`Delete ${folder.name}`} onClick={() => deleteFolder(folder)}><Trash2 size={13} aria-hidden="true" /></button>
        </div>)}
      </div>
      {featuredQuiz && (
        <section className="teacher-featured-card" aria-labelledby="featured-quiz-title">
          <div className="teacher-featured-art" aria-hidden="true"><Zap size={64} /></div>
          <div className="teacher-featured-copy">
            <span className="featured-badge">Featured set</span>
            <h3 id="featured-quiz-title">{featuredQuiz.title}</h3>
            <p>{featuredQuiz.description || "A ready-to-play question set for your next class game."}</p>
            <div className="teacher-featured-meta"><span>{featuredQuiz.questions.length} questions</span><span>Last edited {new Date(featuredQuiz.createdAt).toLocaleDateString()}</span></div>
          </div>
          <div className="teacher-featured-action"><button className="play-live" onClick={() => onPlayLive(featuredQuiz.id)}><Play size={18} aria-hidden="true" />Start a game</button><small>Choose the mode next</small></div>
        </section>
      )}
      <div className="folder-quiz-list">
        {visibleQuizSets.length > 0 && <div className="folder-list-toolbar">
          <label className="quiz-search"><span className="sr-only">Search question sets</span><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search question sets..." /></label>
          <span>{filteredQuizSets.length} question set{filteredQuizSets.length === 1 ? "" : "s"}</span>
          <small className="folder-list-hint">Drag a row to move it into a folder.</small>
        </div>}
        {filteredQuizSets.map((quiz) => (
          <article
            className={`folder-quiz-row${draggedQuizId === quiz.id ? " is-dragged" : ""}`}
            key={quiz.id}
            draggable
            onDragStart={() => setDraggedQuizId(quiz.id)}
            onDragEnd={() => setDraggedQuizId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedQuizId && draggedQuizId !== quiz.id) {
                const dragged = data.quizSets.find((item) => item.id === draggedQuizId);
                if (dragged) moveQuiz(dragged, quiz.folderId);
              }
              setDraggedQuizId(null);
            }}
          >
            <div className="quiz-cover"><BookOpen size={26} aria-hidden="true" /></div>
            <div><h3>{quiz.title}</h3><small>{quiz.questions.length} questions · Created {new Date(quiz.createdAt).toLocaleDateString()}</small></div>
            <div className="folder-row-actions">
              <button className="play-live" onClick={() => onPlayLive(quiz.id)}><Play size={17} aria-hidden="true" />Start a game</button>
              <button className="edit-set" onClick={() => onEditQuiz(quiz.id)}>Edit set</button>
              <button className="edit-set" onClick={() => renameQuiz(quiz)}>Rename</button>
              <button className="delete-set" onClick={() => deleteQuiz(quiz)}><Trash2 size={16} aria-hidden="true" />Delete set</button>
            </div>
          </article>
        ))}
        {filteredQuizSets.length === 0 && (
          <div className="folder-empty"><BookOpen size={34} aria-hidden="true" /><h3>{data.quizSets.length === 0 ? "Your question sets will appear here" : "No question sets match that search"}</h3><p>{data.quizSets.length === 0 ? "Create your first set, then start a game for your class." : "Try another search or create a new set."}</p><button className="folder-new" onClick={() => onEditQuiz()}>Create question set <Plus size={18} aria-hidden="true" /></button></div>
        )}
      </div>
      <p className="folder-library-note">Reports save automatically when a game ends. We keep your 15 newest reports.</p>
    </section>
  );
}

function _DashboardHome({ data, onTab }: { data: DashboardPayload; onTab: (tab: "quizzes" | "sessions") => void }) {
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
          {!activeSession && <button onClick={() => onTab("sessions")}><Target size={18} aria-hidden="true" />Create game</button>}
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
        <div className="panel-title"><h2>Recent games</h2><span>{recentSessions.length ? `${recentSessions.length} available` : "No games yet"}</span></div>
        <ul className="dashboard-session-list">
          {recentSessions.map((session) => <li key={session.id}><div><strong>{session.sessionCode}</strong><small>{gameModeLabel(session.settings.gameMode)} · {arenaMapLabel(session.settings.mapId)} · {session.players.length} joined</small></div><span className={`status-pill status-${session.status}`}>{sessionStatusLabel(session.status)}</span></li>)}
          {recentSessions.length === 0 && <li className="dashboard-empty-state"><Target size={22} aria-hidden="true" /><div><strong>No games yet</strong><small>Your first private room will appear here after you create one.</small></div></li>}
        </ul>
      </section>

      <section className="panel dashboard-list-card">
        <div className="panel-title"><h2>Ready quiz sets</h2><span>{data.quizSets.length} saved</span></div>
        <ul className="dashboard-session-list">
          {data.quizSets.slice(0, 4).map((quiz) => <li key={quiz.id}><div><strong>{quiz.title}</strong><small>{quiz.questions.length} questions{quiz.description ? ` · ${quiz.description}` : ""}</small></div><button onClick={() => onTab("sessions")}>Host</button></li>)}
          {data.quizSets.length === 0 && <li className="dashboard-empty-state"><BookOpen size={22} aria-hidden="true" /><div><strong>No question sets yet</strong><small>Create a set first, then turn it into a game room.</small></div></li>}
        </ul>
      </section>
    </div>
  );
}

function QuizManager({ data, onRefresh, initialQuizSetId, startInCreateMode = false }: { data: DashboardPayload; onRefresh: () => Promise<void>; initialQuizSetId?: string; startInCreateMode?: boolean }) {
  const [selectedQuizId, setSelectedQuizId] = useState(() => startInCreateMode ? "" : initialQuizSetId ?? data.quizSets[0]?.id ?? "");
  const [quizForm, setQuizForm] = useState({ title: "", description: "" });
  const [questionForm, setQuestionForm] = useState(emptyQuestion);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "ready">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState("");
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingLimitTimerRef = useRef<number | null>(null);
  const status = useAsyncMessage();

  const clearRecordingTimers = () => {
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    if (recordingLimitTimerRef.current !== null) window.clearTimeout(recordingLimitTimerRef.current);
    recordingTimerRef.current = null;
    recordingLimitTimerRef.current = null;
  };

  const discardRecordedAudio = () => {
    setRecordedAudio((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    setRecordingState("idle");
    setRecordingSeconds(0);
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  };

  const startVoiceRecording = async () => {
    if (recordingState === "recording") {
      stopVoiceRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("Voice recording is not supported by this browser.");
      return;
    }

    setRecordingError("");
    discardRecordedAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
        .find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setRecordingError("The browser could not finish this recording. Please try again.");
      };
      recorder.onstop = () => {
        clearRecordingTimers();
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        const chunks = recordingChunksRef.current;
        recordingChunksRef.current = [];
        if (chunks.length === 0) {
          setRecordingState("idle");
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        setRecordedAudio({ blob, previewUrl: URL.createObjectURL(blob) });
        setRecordingState("ready");
      };
      recorder.start();
      setRecordingSeconds(0);
      setRecordingState("recording");
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1_000);
      recordingLimitTimerRef.current = window.setTimeout(stopVoiceRecording, 60_000);
    } catch {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      setRecordingState("idle");
      setRecordingError("Microphone access was denied or unavailable. Check the browser permission and try again.");
    }
  };

  useEffect(() => () => {
    clearRecordingTimers();
    mediaRecorderRef.current?.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordedAudio) URL.revokeObjectURL(recordedAudio.previewUrl);
  }, [recordedAudio]);

  useEffect(() => {
    if (initialQuizSetId) {
      setSelectedQuizId(initialQuizSetId);
      return;
    }
    if (!startInCreateMode && !selectedQuizId && data.quizSets[0]) setSelectedQuizId(data.quizSets[0].id);
  }, [data.quizSets, initialQuizSetId, selectedQuizId, startInCreateMode]);

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
      status.setMessage("Question set created. It’s ready for questions.");
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
      const wasEditing = Boolean(editingQuestionId);
      const payload = wasEditing
        ? await teacherApi.updateQuestion(editingQuestionId!, questionForm)
        : await teacherApi.addQuestion(selectedQuiz.id, questionForm);
      const savedQuestion = (payload as { question?: QuizSet["questions"][number] }).question;
      if (recordedAudio && savedQuestion) {
        // Saving the question first gives a new question a stable ID for its
        // durable audio asset. If upload fails, leave the form and recording
        // in place so the teacher can retry without losing the clip.
        if (!wasEditing) setEditingQuestionId(savedQuestion.id);
        await teacherApi.uploadQuestionAudio(savedQuestion.id, recordedAudio.blob);
      }
      setQuestionForm(emptyQuestion);
      setEditingQuestionId(null);
      discardRecordedAudio();
      await onRefresh();
      status.setMessage(wasEditing ? "Question updated." : "Question added.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsAddingQuestion(false);
    }
  };

  const beginEditingQuestion = (question: QuizSet["questions"][number]) => {
    discardRecordedAudio();
    setRecordingError("");
    setEditingQuestionId(question.id);
    setQuestionForm({
      prompt: question.prompt,
      choiceA: question.choiceA,
      choiceB: question.choiceB,
      choiceC: question.choiceC,
      choiceD: question.choiceD,
      correctChoice: question.correctChoice,
      difficulty: question.difficulty ?? "",
      explanation: question.explanation ?? "",
      audioUrl: question.audioUrl ?? ""
    });
  };

  const deleteQuestion = async (questionId: string) => {
    if (!window.confirm("Delete this question? This cannot be undone.")) return;
    status.clear();
    try {
      await teacherApi.deleteQuestion(questionId);
      if (editingQuestionId === questionId) {
        setEditingQuestionId(null);
        setQuestionForm(emptyQuestion);
        discardRecordedAudio();
      }
      await onRefresh();
      status.setMessage("Question deleted.");
    } catch (err) {
      status.report(err);
    }
  };

  const importQuestions = async () => {
    if (!selectedQuiz || isImporting) return;
    status.clear();
    if (generatedQuestions.length === 0) {
      status.setError("Paste at least two study items to build questions.");
      return;
    }

    setIsImporting(true);
    try {
      for (const draft of generatedQuestions) {
        await teacherApi.addQuestion(selectedQuiz.id, draft);
      }
      setBulkText("");
      await onRefresh();
      status.setMessage(`${generatedQuestions.length} questions are ready to review.`);
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
      status.setMessage(`${file.name} is ready. Review the preview, then add the questions.`);
    } catch (err) {
      status.report(err);
    } finally {
      event.currentTarget.value = "";
    }
  };

  return (
    <div className={`two-column quiz-manager-shell ${startInCreateMode ? "quiz-create-mode" : "quiz-edit-mode"}`}>
      {startInCreateMode ? <form className="panel form-panel" onSubmit={createQuiz}>
        <h2>Create a question set</h2>
        <label>
          Set name
          <input value={quizForm.title} onChange={(event) => setQuizForm({ ...quizForm, title: event.target.value })} />
        </label>
        <label>
          What will students practice?
          <textarea
            value={quizForm.description}
            onChange={(event) => setQuizForm({ ...quizForm, description: event.target.value })}
          />
        </label>
        <button className="primary" type="submit" disabled={isCreatingQuiz}>
          <Plus size={18} aria-hidden="true" />
          {isCreatingQuiz ? "Creating..." : "Create question set"}
        </button>
      </form> : (
        <aside className="panel quiz-context-panel">
          <span className="teacher-eyebrow">Question workspace</span>
          <h2>{selectedQuiz ? `Editing: ${selectedQuiz.title}` : "Quiz workspace"}</h2>
          <p>Keep the set in view while you review questions and prepare the next class game.</p>
          <div className="quiz-context-stat"><strong>{selectedQuiz?.questions.length ?? 0}</strong><span>questions in this set</span></div>
          <div className="quiz-context-note"><Zap size={18} aria-hidden="true" /><span>When you are ready, host this set and choose Capture the Flag, Zombie Survival, or Team Tag.</span></div>
        </aside>
      )}

      <div className="panel quiz-editor-panel">
        <div className="quiz-editor-heading">
          <div>
            <span className="teacher-eyebrow">Question workspace</span>
            <h2>{selectedQuiz ? `Editing: ${selectedQuiz.title}` : "Create your next question set"}</h2>
            {selectedQuiz && <p>{selectedQuiz.questions.length} questions · Keep the active set in view while you build.</p>}
          </div>
          {selectedQuiz && <span className="quiz-save-status"><Check size={15} aria-hidden="true" />Ready to host</span>}
        </div>
        <label>
          Question sets
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
                <h3>Build from a study list</h3>
                <span>{importBadge}</span>
              </div>
              <p>
                Paste terms, vocabulary, or term-definition pairs. Put one item on each line. Use a dash, colon, vertical bar, or tab between a term and its meaning.
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
                  Upload a study list
                </label>
                <button type="button" onClick={() => setBulkText(sampleImportText)}>
                  <ClipboardPaste size={18} aria-hidden="true" />
                  Try a sample
                </button>
                <button className="primary" type="button" onClick={importQuestions} disabled={isImporting}>
                  <WandSparkles size={18} aria-hidden="true" />
                  {isImporting ? "Building..." : "Build questions"}
                </button>
              </div>
              {generatedQuestions.length > 0 && (
                <div className="import-preview">
                  <strong>Preview {Math.min(5, generatedQuestions.length)} questions</strong>
                  <div className="import-preview-list">
                    {generatedQuestions.slice(0, 5).map((draft, index) => (
                      <div key={`${draft.prompt}-${index}`} className="import-preview-item">
                        <span>{index + 1}. {draft.prompt}</span>
                        <small>Answer: {getDraftChoiceText(draft)}</small>
                      </div>
                    ))}
                  </div>
                  <small>{generatedQuestions.length} questions will be added to this quiz.</small>
                </div>
              )}
            </div>

            <form className="question-form" onSubmit={addQuestion}>
              <label>
                Question
                <textarea
                  value={questionForm.prompt}
                  onChange={(event) => setQuestionForm({ ...questionForm, prompt: event.target.value })}
                />
              </label>
              <div className="choice-grid">
                {choices.map((choice) => (
                  <label key={choice}>
                    Answer {choice}
                    <input
                      value={questionForm[`choice${choice}` as keyof typeof questionForm]}
                      onChange={(event) => setQuestionForm({ ...questionForm, [`choice${choice}`]: event.target.value })}
                    />
                  </label>
                ))}
              </div>
              <div className="choice-grid">
                <label>
                  Correct answer
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
              <label>
                  Question audio <small>(optional)</small>
                <input
                  type="text"
                  inputMode="url"
                  value={questionForm.audioUrl}
                  onChange={(event) => setQuestionForm({ ...questionForm, audioUrl: event.target.value })}
                  placeholder="Paste an audio link, or leave this blank"
                />
              </label>
              <div className="question-audio-recorder">
                <div className="question-audio-recorder-actions">
                  <button
                    type="button"
                    className={recordingState === "recording" ? "recording-button" : ""}
                    onClick={() => void startVoiceRecording()}
                    disabled={isAddingQuestion || recordingState === "ready"}
                  >
                    {recordingState === "recording" ? <Square size={16} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
                    {recordingState === "recording" ? `Stop recording (${String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:${String(recordingSeconds % 60).padStart(2, "0")})` : "Record the question"}
                  </button>
                  {recordedAudio && (
                    <button type="button" onClick={discardRecordedAudio} disabled={isAddingQuestion}>
                      <Trash2 size={16} aria-hidden="true" />
                      Remove recording
                    </button>
                  )}
                </div>
                <small>Record up to 60 seconds. The clip saves with the question.</small>
                {recordedAudio && <audio controls preload="metadata" src={recordedAudio.previewUrl} aria-label="Recorded question audio preview" />}
                {recordingError && <span className="field-error">{recordingError}</span>}
              </div>
              <div className="question-form-actions">
                <button className="primary" type="submit" disabled={isAddingQuestion}>
                  <Plus size={18} aria-hidden="true" />
                  {isAddingQuestion ? "Saving..." : editingQuestionId ? "Save question" : "Add question"}
                </button>
                {editingQuestionId && <button type="button" onClick={() => { setEditingQuestionId(null); setQuestionForm(emptyQuestion); discardRecordedAudio(); }}>Cancel</button>}
              </div>
            </form>
            <ul className="question-list">
              {selectedQuiz.questions.map((question, index) => (
                <li key={question.id}>
                  <div className="question-list-copy">
                    <strong>{index + 1}. {question.prompt}</strong>
                    <span>Answer {question.correctChoice} · {question.difficulty || "Standard"} · {question.explanation ? "Explanation added" : "No explanation yet"}{question.audioUrl ? " · Audio added" : ""}</span>
                  </div>
                  <div className="question-list-actions">
                    <button type="button" onClick={() => beginEditingQuestion(question)}>Edit</button>
                    <button type="button" className="danger-text" onClick={() => void deleteQuestion(question.id)}>Delete</button>
                  </div>
                </li>
              ))}
              {selectedQuiz.questions.length === 0 && <li>No questions yet.</li>}
            </ul>
          </>
        ) : (
          <p>Create a question set to start adding questions.</p>
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
  onOpenReports,
  initialQuizSetId,
  activeSetupSection
}: {
  data: DashboardPayload;
  selectedSession: GameSession | null;
  setSelectedSession: (session: GameSession | null) => void;
  onRefresh: () => Promise<void>;
  onReport: (report: SessionReport | null) => void;
  onOpenReports: () => void;
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
  } = useSessionControls({ initialQuizSetId, firstQuizSetId: data.quizSets[0]?.id });
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
  const selectedQuiz = data.quizSets.find((quiz) => quiz.id === quizSetId);
  const sessionQuiz = selectedSession
    ? data.quizSets.find((quiz) => quiz.id === selectedSession.quizSetId)
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
    if (!quizSetId && data.quizSets[0]) setQuizSetId(data.quizSets[0].id);
  }, [data.quizSets, quizSetId, setQuizSetId]);

  useEffect(() => {
    if (hasSelectedSession || !initialQuizSetId || !data.quizSets.some((quiz) => quiz.id === initialQuizSetId)) return;
    setQuizSetId(initialQuizSetId);
  }, [data.quizSets, hasSelectedSession, initialQuizSetId, setQuizSetId]);

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
      status.setMessage("Game finished. Your learning report is ready.");
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
    if (!selectedSession || selectedSession.status !== "active" || selectedSession.settings.gameMode === "zombie" || isEndingRound) return;
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
                <h2>Set up a classroom game</h2>
              </div>
              <div className="setup-quiz-summary">
                <BookOpen size={22} aria-hidden="true" />
                <strong>{selectedQuiz?.title ?? "Choose a question set"}</strong>
                <small>{selectedQuiz?.questions.length ?? 0} questions</small>
              </div>
            </header>

            {activeSetupSection === "mode" && (
              <section className="setup-choice-section setup-panel-section mode-choice-section" aria-labelledby="mode-title">
                <div className="setup-panel-heading"><h3 id="mode-title">Choose the game</h3></div>
                <div className="mode-choice-grid" aria-label="Game modes">
                  {([
                    { id: "zombie", title: "Zombie Survival", description: "Answer for energy, stay alive, and keep the team moving.", icon: <img src="/assets/zombie/zombie-head.png" alt="" /> },
                    { id: "classic", title: "Team Tag", description: "Answer questions, move through the arena, and tag the other team.", icon: <img src="/assets/mode-icons/tag.png" alt="" /> },
                    { id: "flag", title: "Capture the Flag", description: "Answer to earn an advantage, then capture the flag as a team.", icon: <img src="/assets/mode-icons/flag.png" alt="" /> }
                  ] as const).map((mode) => {
                    const selected = settings.gameMode === mode.id;
                    return (
                      <button
                        type="button"
                        key={mode.id}
                        className={`mode-choice mode-${mode.id}${selected ? " selected" : ""}`}
                        aria-label={`${mode.title}: ${mode.description}`}
                        aria-pressed={selected}
                        onClick={() => setSettings({ ...settings, gameMode: mode.id })}
                      >
                        <span className="mode-choice-art" aria-hidden="true">{mode.icon}</span>
                        <strong>{mode.title}</strong>
                        {selected && <span className="mode-choice-check" aria-hidden="true"><Check size={18} /></span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {activeSetupSection === "arena" && (
              <section className="setup-choice-section setup-panel-section" aria-labelledby="arena-title">
                <div className="setup-panel-heading"><h3 id="arena-title">Choose a map</h3></div>
                <div className="arena-choice-grid">
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
                </div>
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
                <div className="setup-panel-heading"><h3 id="advanced-title">Game details</h3><span>Optional</span></div>
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
                    </fieldset>
                  );
                })}

                <fieldset>
                  <legend>Make the game welcoming</legend>
                  <label className="toggle-row"><input type="checkbox" checked={settings.deadPlayersCanPractice} onChange={(event) => setSettings({ ...settings, deadPlayersCanPractice: event.target.checked })} />Let students practice while out</label>
                  <label className="toggle-row"><input type="checkbox" checked={settings.deadPlayersEarnMoney} onChange={(event) => setSettings({ ...settings, deadPlayersEarnMoney: event.target.checked })} />Keep rewards going while out</label>
                  <label className="toggle-row"><input type="checkbox" checked={settings.characterCustomization.enabled} onChange={(event) => setSettings({ ...settings, characterCustomization: { ...settings.characterCustomization, enabled: event.target.checked } })} />Let students style their players</label>
                  <label className="toggle-row"><input type="checkbox" checked={settings.characterCustomization.uploadsEnabled} disabled={!settings.characterCustomization.enabled} onChange={(event) => setSettings({ ...settings, characterCustomization: { ...settings.characterCustomization, uploadsEnabled: event.target.checked } })} />Allow student stickers</label>
                  <label className="toggle-row"><input type="checkbox" checked={settings.characterCustomization.persistAcrossSessions} disabled={!settings.characterCustomization.enabled} onChange={(event) => setSettings({ ...settings, characterCustomization: { ...settings.characterCustomization, persistAcrossSessions: event.target.checked } })} />Remember player choices</label>
                </fieldset>
                </div>
              </section>
            )}

            {hasInvalidSettings && <p className="error-text">Check the highlighted settings before creating the game.</p>}
            <div className="setup-create-bar">
              <span><strong>Ready to create</strong><small>{selectedMap.title} · {gameModeLabel(settings.gameMode)} · your settings are saved with this room</small></span>
              <button className="primary create-game-button" type="submit" disabled={!quizSetId || hasInvalidSettings || isCreatingSession}>
                <Play size={20} aria-hidden="true" />
                {isCreatingSession ? "Creating game..." : "Create game"}
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
            <h3>{gameModeLabel(selectedSession.settings.gameMode)} has ended</h3>
            <p>The room is closed. Students can view their summary, and the full class learning report is ready.</p>
            <dl>
              <div><dt>Final learners</dt><dd>{learnerPlayers.length}</dd></div>
              <div><dt>Test bots</dt><dd>{botPlayers.length}</dd></div>
              <div><dt>Final outcome</dt><dd>{getModeScoreSummary(selectedSession)}</dd></div>
              <div><dt>Top learner</dt><dd>{topLearner?.nickname ?? "No answers recorded"}</dd></div>
            </dl>
            <div className="button-row">
              <button className="primary teacher-report-button" onClick={onOpenReports}><Download size={18} aria-hidden="true" />See the learning report</button>
              <button onClick={() => setSelectedSession(null)}>Start another game</button>
            </div>
          </div>
        ) : selectedSession.status === "waiting" ? (
          <div className="teacher-waiting-room">
            <header className="waiting-room-header">
              <div>
                <span className="flow-step">Step 3 of 4 · Invite students</span>
                <h2>{sessionQuiz?.title ?? "Live Game"}</h2>
                <p>{arenaMapLabel(selectedSession.settings.mapId)} · {displayedPresetName} · {selectedSession.settings.roundCount} Rounds · {formatDuration(selectedSession.settings.roundDurationSeconds)} per round</p>
              </div>
              <div className="waiting-header-actions">
                <details className="waiting-settings-summary">
                  <summary>View game details</summary>
                  <dl>
                    <div><dt>Mode</dt><dd>{gameModeLabel(selectedSession.settings.gameMode)}</dd></div>
                    <div><dt>Teams</dt><dd>{selectedSession.settings.teamAssignment === "players_choose" ? "Players Choose" : "Random Teams"}</dd></div>
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
              <div><span className="flow-step">Step 4 of 4</span><h2>Run the live game</h2></div>
              <div className="button-row">
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
                {selectedSession.settings.gameMode !== "zombie" && (
                  <button
                    type="button"
                    className="end-round-button"
                    onClick={() => void endRound()}
                    disabled={selectedSession.status !== "active" || isEndingRound || isEndingSession}
                  >
                    {isEndingRound ? "Ending Round..." : "End Round"}
                  </button>
                )}
                <button ref={endSessionTriggerRef} className="end-game-button" onClick={() => setIsEndConfirmOpen(true)} disabled={isEndingSession}>{isEndingSession ? "Finishing…" : "End game"}</button>
              </div>
            </header>
            <div className="live-summary">
              <span className={`status-pill status-${selectedSession.status}`}>{isRoundPreparationPhase(selectedSession) ? "Preparation" : isZombieSelectionPhase(selectedSession) ? "Choosing Zombies" : sessionStatusLabel(selectedSession.status)}</span>
              <span>{gameModeLabel(selectedSession.settings.gameMode)}</span>
              <span>{arenaMapLabel(selectedSession.settings.mapId)}</span>
              {selectedSession.settings.gameMode === "flag" && <span>Round {selectedSession.currentRound}/{selectedSession.settings.roundCount}</span>}
              <span>Time {formatDuration(remainingSeconds)}</span>
              <span>{activePlayers}/{selectedSession.players.length || 0} active</span>
              <span>{activeLearners} learner{activeLearners === 1 ? "" : "s"}</span>
              {botPlayers.length > 0 && <span>{botPlayers.length} bot{botPlayers.length === 1 ? "" : "s"}</span>}
              <span>{selectedSession.settings.gameMode === "zombie" ? `Humans ${zombieCounts.humans} - Zombies ${zombieCounts.zombies}` : `Blue ${teamTotals.blue} - Red ${teamTotals.red}`}</span>
            </div>
            <Suspense fallback={<ArenaLoading label="Loading live arena" />}>
              <ArenaPreview key={`${selectedSession.id}:${selectedSession.startedAt ?? "waiting"}:overview`} session={selectedSession} loadDecalAsset={loadTeacherDecal} />
            </Suspense>
            <Scoreboard players={selectedSession.players} gameMode={selectedSession.settings.gameMode} onRemovePlayer={(playerId) => void removePlayer(playerId)} removingPlayerId={removingPlayerId} />
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
                 <div><span className="projector-kicker">{sessionQuiz?.title ?? "QuizStrike Classroom"}</span><h2 id="projector-title">Join the game</h2></div>
                <button ref={projectorCloseRef} type="button" onClick={() => setIsProjectorOpen(false)} aria-label="Close projector view">Close</button>
              </header>
              <div className="projector-content">
                 <div className="projector-join-code"><span>Classroom code</span><strong>{selectedSession.sessionCode}</strong><small>{studentJoinLink.replace(/^https?:\/\//, "")}</small></div>
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
                  <p>{arenaMapLabel(selectedSession.settings.mapId)} <span aria-hidden="true">{"\u00B7"}</span> {gameModeLabel(selectedSession.settings.gameMode)} <span aria-hidden="true">{"\u00B7"}</span> Follow a learner</p>
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
                    <div className="metric"><span>Rewards earned</span><strong>{formatRewards(report.rows.reduce((total, row) => total + row.quizMoney, 0))}</strong><small>Rewards from correct answers</small></div>
                    <div className="metric"><span>Questions to revisit</span><strong>{report.missedQuestions.length}</strong><small>Questions missed by students</small></div>
                  </div>
                );
              })()}
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead><tr><th>Student</th><th>Team</th><th>Correct</th><th>Wrong</th><th>Accuracy</th><th>Rewards</th><th>Score</th></tr></thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.nickname}>
                        <td data-label="Student">{row.nickname}</td>
                        <td data-label="Team">{teamLabel(row.team)}</td>
                        <td data-label="Correct">{row.correctAnswers}</td>
                        <td data-label="Wrong">{row.wrongAnswers}</td>
                        <td data-label="Accuracy">{row.correctAnswers + row.wrongAnswers > 0 ? `${row.accuracy}%` : "-"}</td>
                        <td data-label="Rewards">{formatRewards(row.quizMoney)}</td>
                        <td data-label="Score">{row.score}</td>
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

// Retained for the legacy report surface while the teacher workspace uses the normalized report panel.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyReportsPanel({
  sessions,
  reports,
  report,
  setReport,
  setTab,
  onRefresh
}: {
  sessions: GameSession[];
  reports: ReportMetadata[];
  report: SessionReport | null;
  setReport: (report: SessionReport | null) => void;
  setTab: (tab: "sessions") => void;
  onRefresh: () => Promise<void>;
}) {
  const [code, setCode] = useState(reports[0]?.sessionCode ?? sessions[0]?.sessionCode ?? "");
  const [selectedReportId, setSelectedReportId] = useState(reports[0]?.id ?? "");
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
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

  const loadSavedReport = async (metadata: ReportMetadata) => {
    if (isLoadingReport) return;
    status.clear();
    setSelectedReportId(metadata.id);
    setCode(metadata.sessionCode);
    setIsLoadingReport(true);
    try {
      const payload = (await teacherApi.reportById(metadata.id)) as { report: SessionReport };
      setReport(payload.report);
      status.setMessage(`${metadata.displayName} loaded.`);
    } catch (err) {
      status.report(err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const deleteSavedReport = async (metadata: ReportMetadata) => {
    if (isDeletingReport || !window.confirm(`Delete report “${metadata.displayName}”?`)) return;
    setIsDeletingReport(true);
    status.clear();
    try {
      await teacherApi.deleteReport(metadata.id);
      if (selectedReportId === metadata.id) {
        setSelectedReportId("");
        setReport(null);
      }
      await onRefresh();
      status.setMessage("Report deleted.");
    } catch (err) {
      status.report(err);
    } finally {
      setIsDeletingReport(false);
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
          <h2>Game report</h2>
          <p>Review answers, rewards, and the questions students should revisit.</p>
        </div>
        <button onClick={() => setTab("sessions")}>Open live games</button>
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
          {isLoadingReport ? "Loading…" : "Load report"}
        </button>
        <button onClick={exportCsv} disabled={!code || isExportingCsv}>
          <Download size={18} aria-hidden="true" />
          {isExportingCsv ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      <StatusMessages error={status.error} message={status.message} />
      <section className="saved-reports" aria-label="Saved reports">
        <div className="panel-title"><h3>Saved reports</h3><span>{reports.length}/15 retained</span></div>
        {reports.length === 0 && <p className="folder-library-note">Completed sessions will appear here automatically.</p>}
        {reports.map((metadata) => <div className={`saved-report-row${selectedReportId === metadata.id ? " active" : ""}`} key={metadata.id}>
          <button className="saved-report-open" onClick={() => void loadSavedReport(metadata)} disabled={isLoadingReport}>
            <strong>{metadata.displayName}</strong>
            <small>{metadata.quizSetName} · {new Date(metadata.createdAt).toLocaleString()}</small>
          </button>
          <button className="saved-report-delete" aria-label={`Delete ${metadata.displayName}`} onClick={() => void deleteSavedReport(metadata)} disabled={isDeletingReport}><Trash2 size={16} aria-hidden="true" /></button>
        </div>)}
      </section>
      {report && (
        <>
          {(() => {
            const classAccuracy = calculateClassAccuracy(report.rows);
            const attemptedStudents = report.rows.filter((row) => row.correctAnswers + row.wrongAnswers > 0).length;
            return (
          <div className="report-summary-grid">
            <div className="metric">
              <span>Class accuracy</span>
              <strong>{classAccuracy === null ? "—" : `${classAccuracy}%`}</strong>
              <small>{attemptedStudents} of {report.rows.length} learners answered</small>
            </div>
            <div className="metric">
              <span>Rewards earned</span>
              <strong>{formatRewards(report.rows.reduce((total, row) => total + row.quizMoney, 0))}</strong>
              <small>Rewards from correct answers</small>
            </div>
            <div className="metric">
              <span>Questions to revisit</span>
              <strong>{report.missedQuestions.length}</strong>
              <small>Questions missed by learners</small>
            </div>
          </div>
            );
          })()}
          <table className="report-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Team</th>
                <th>Correct</th>
                <th>Wrong</th>
                <th>Accuracy</th>
                <th>Rewards</th>
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
                  <td data-label="Accuracy">{row.correctAnswers + row.wrongAnswers > 0 ? `${row.accuracy}%` : "—"}</td>
                  <td data-label="Rewards">{formatRewards(row.quizMoney)}</td>
                  <td data-label="Score">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Questions to revisit</h3>
          <ul className="plain-list">
            {report.missedQuestions.map((item) => (
              <li key={item.questionId}>
                <span>{item.prompt}</span>
                <small>{item.misses} misses</small>
              </li>
            ))}
            {report.missedQuestions.length === 0 && <li>No questions to revisit yet. This group is ready for the next challenge.</li>}
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
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const {
    quizOpen, setQuizOpen,
    buyOpen, setBuyOpen,
    scoreboardOpen, setScoreboardOpen,
    settingsOpen, setSettingsOpen,
    gamePreferences, setGamePreferences,
    feedback, setFeedback,
    isSocketReconnecting, setIsSocketReconnecting,
    isJoining, setIsJoining,
    answeringChoice, setAnsweringChoice,
    buyingGearId, setBuyingGearId,
    isBuyingSnowballs, setIsBuyingSnowballs,
    isSwitchingTeam, setIsSwitchingTeam,
    isRestoringStudentSession, setIsRestoringStudentSession,
    rewardPulse, setRewardPulse,
    spectatorPlayerId, setSpectatorPlayerId,
    incomingHitCue, setIncomingHitCue,
    openRespawnPractice
  } = useStudentGameState();
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const status = useAsyncMessage();
  const remainingSeconds = useRoundRemaining(session);
  const flagRemainingSeconds = useFlagRemainingSeconds(session);
  const roundPreparation = Boolean(session && isRoundPreparationPhase(session));
  const zombieSelection = Boolean(session && isZombieSelectionPhase(session));
  const preparationRemainingSeconds = useDeadlineRemainingSeconds(
    roundPreparation || zombieSelection ? session?.roundTransition?.startsAt : undefined,
    session?.serverTime
  );
  const socketRef = useRef<Socket | null>(null);
  const previousAliveRef = useRef<boolean | null>(null);
  const previousPreparationRef = useRef(false);
  const lastCountdownCueRef = useRef("");
  const lastTeamSwitchAtRef = useRef(0);
  const currentSessionRef = useRef<GameSession | null>(session);
  const currentPlayerRef = useRef<PlayerSession | null>(player);
  const answerActionRef = useRef<(choice: Choice) => Promise<void>>(async () => undefined);
  const buyActionRef = useRef<(gearId: string) => Promise<void>>(async () => undefined);
  const buySnowballsActionRef = useRef<() => Promise<void>>(async () => undefined);
  const setStatusError = status.setError;
  currentSessionRef.current = session;
  currentPlayerRef.current = player;

  const isCompactViewport = viewportWidth <= 780;
  const sessionCode = session?.sessionCode;
  const sessionId = session?.id;
  const sessionCurrentRound = session?.currentRound;
  const sessionStatus = session?.status;
  const sessionDeadPlayersCanPractice = session?.settings.deadPlayersCanPractice;
  const sessionGameMode = session?.settings.gameMode;
  const playerId = player?.id;
  const playerIsAlive = player?.isAlive;
  const hasPlayer = Boolean(player);
  const hasSession = Boolean(session);
  const hasActiveArenaConnection = Boolean(session && player && playerToken);
  const hasQuestion = Boolean(question);
  const questionId = question?.id;
  const hasActiveStudentSession = Boolean(session && player && session.status === "active");
  const nicknameError = useMemo(() => getNicknameError(nickname), [nickname]);
  const spectatorCandidates = useMemo(() => {
    if (!session || !player || player.isAlive || session.settings.gameMode !== "flag") return [];
    return session.players
      .filter((candidate) => candidate.id !== player.id && candidate.isAlive && candidate.connectionState !== "disconnected")
      .sort((left, right) => Number(right.team === player.team) - Number(left.team === player.team));
  }, [session, player]);
  const spectatorPlayer = spectatorCandidates.find((candidate) => candidate.id === spectatorPlayerId) ?? spectatorCandidates[0];

  useEffect(() => {
    if (spectatorCandidates.length === 0) {
      setSpectatorPlayerId("");
      return;
    }
    if (!spectatorCandidates.some((candidate) => candidate.id === spectatorPlayerId)) {
      setSpectatorPlayerId(spectatorCandidates[0].id);
    }
  }, [spectatorCandidates, spectatorPlayerId, setSpectatorPlayerId]);

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
    gameAudio.setSfxVolume(gamePreferences.sfxVolume);
    gameAudio.setMusicVolume(gamePreferences.musicVolume);
    if (gamePreferences.soundEnabled) gameAudio.warm();
    return () => gameAudio.setMuted(false);
  }, [gamePreferences.soundEnabled, gamePreferences.sfxVolume, gamePreferences.musicVolume]);

  useEffect(() => {
    gameplayAnnouncements.setMuted(!gamePreferences.soundEnabled);
    gameplayAnnouncements.setVolume(gamePreferences.sfxVolume);
    if (gamePreferences.soundEnabled) gameplayAnnouncements.preload();
    return () => gameplayAnnouncements.clear();
  }, [gamePreferences.soundEnabled, gamePreferences.sfxVolume]);

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
        const data = payload as {
          session: GameSession;
          player: PlayerSession;
          cosmeticProgressToken?: string;
          question?: PublicQuestion;
        };
        setRestoreFailed(false);
        setSession(data.session);
        setPlayer(data.player);
        storeCosmeticProgressToken(data.cosmeticProgressToken);
        setPlayerToken(stored.playerToken);
        setQuestion(data.question ?? null);
        setFeedback("You’re back in the game.");
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
          clearStoredStudentSession();
          return;
        }
        setJoinCode(stored.sessionCode);
        setRestoreFailed(true);
        setStatusError("We couldn’t reopen your previous game. Check your connection, then join again with the same name.");
      })
      .finally(() => {
        if (!cancelled) setIsRestoringStudentSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [joinCodeFromLink, setFeedback, setIsRestoringStudentSession, setStatusError]);

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
  }, [feedback, setFeedback]);

  useEffect(() => {
    if (!hasSession || sessionStatus !== "active") {
      lastCountdownCueRef.current = "";
      return;
    }
    const cueKey = `${sessionCurrentRound}:${remainingSeconds}`;
    if ([10, 5, 3, 2, 1].includes(remainingSeconds) && lastCountdownCueRef.current !== cueKey) {
      lastCountdownCueRef.current = cueKey;
      gameAudio.playEvent(remainingSeconds <= 5 ? "quiz_timer_warning" : "round_ending");
    }
  }, [hasSession, remainingSeconds, sessionCurrentRound, sessionStatus]);

  useEffect(() => {
    if (quizOpen && questionId) gameAudio.playEvent("quiz_timer_start");
  }, [questionId, quizOpen]);

  useEffect(() => {
    if (!sessionCode || !playerId || !playerToken || hasQuestion) return;
    const questionPhase = sessionStatus === "waiting" || sessionStatus === "active" || roundPreparation || zombieSelection;
    if (!questionPhase || (!playerIsAlive && !sessionDeadPlayersCanPractice)) return;

    let cancelled = false;
    void studentApi
      .question(sessionCode, playerId, playerToken)
      .then((payload) => {
        if (cancelled) return;
        const data = payload as { question?: PublicQuestion };
        setQuestion(data.question ?? null);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [sessionCode, sessionStatus, session?.roundTransition?.phase, roundPreparation, zombieSelection, playerId, playerIsAlive, playerToken, sessionDeadPlayersCanPractice, hasQuestion]);

  useEffect(() => {
    const syncBgm = () => {
      gameAudio.setBgmActive(Boolean(hasActiveStudentSession && document.visibilityState === "visible"));
    };
    syncBgm();
    document.addEventListener("visibilitychange", syncBgm);
    return () => {
      document.removeEventListener("visibilitychange", syncBgm);
      gameAudio.setBgmActive(false);
    };
  }, [hasActiveStudentSession]);

  useEffect(() => {
    const activeSession = currentSessionRef.current;
    const activePlayer = currentPlayerRef.current;
    if (!activeSession || !activePlayer?.id || !playerToken) return;
    const activePlayerId = activePlayer.id;
    const roomJoinPayload = { code: activeSession.sessionCode, playerId: activePlayerId, playerToken };
    const socket = createMultiplayerSocket(roomJoinPayload, {
      onProtocolError: (error) => setFeedback(error.message)
    });
    socketRef.current = socket;
    const pendingPositions = new Map<string, {
      x: number;
      y?: number;
      z: number;
      facing: number;
      energy?: number;
      crouching?: boolean;
      jumping?: boolean;
    }>();
    const lastRemotePositions = new Map<string, { x: number; y?: number; z: number }>();
    let lastVisualSession = activeSession;
    let removedByTeacher = false;
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
    socket.on("connect", () => {
      setIsSocketReconnecting(false);
    });
    socket.on("connect_error", () => setIsSocketReconnecting(true));
    socket.on("disconnect", () => {
      if (!removedByTeacher) setIsSocketReconnecting(true);
    });
    socket.on("flag_planted", (payload: unknown) => {
      const parsed = FlagPlantedEventSchema.safeParse(payload);
      if (!parsed.success) return;
      const event: FlagPlantedEvent = parsed.data;
      gameplayAnnouncements.enqueue({
        eventId: event.eventId,
        announcementKey: "FLAG_PLANTED",
        occurredAt: event.plantedAt
      });
    });
    socket.on("freeze_streak_announcement", (payload: unknown) => {
      const parsed = FreezeStreakAnnouncementEventSchema.safeParse(payload);
      if (!parsed.success) return;
      const event: FreezeStreakAnnouncementEvent = parsed.data;
      const definition = FREEZE_STREAK_ANNOUNCEMENTS[event.streak];
      gameplayAnnouncements.enqueue({
        eventId: event.eventId,
        announcementKey: event.announcementKey,
        occurredAt: event.occurredAt,
        subtitle: definition?.phrase
      });
      if (definition) setFeedback(`${event.playerName}: ${definition.phrase}`);
    });
    socket.on("session_state", (payload: unknown) => {
      const parsed = validateSessionSnapshot(payload);
      if (!parsed.success) {
        setFeedback("The server sent an invalid session update. Reconnecting may help.");
        return;
      }
      const nextSession = parsed.data;
      const previousSession = lastVisualSession;
      const previousLocal = previousSession.players.find((candidate) => candidate.id === activePlayerId);
      const nextLocal = nextSession.players.find((candidate) => candidate.id === activePlayerId);
      if (nextSession.players.length > previousSession.players.length) gameAudio.playEvent("player_join");
      if (nextSession.players.length < previousSession.players.length) gameAudio.playEvent("player_leave");
      if (previousSession.status !== "active" && nextSession.status === "active") gameAudio.playEvent("round_start");
      if (previousSession.status === "active" && nextSession.status === "paused") gameAudio.playEvent("round_ending");
      if (nextSession.status === "ended" && previousSession.status !== "ended") {
        const title = nextSession.announcement?.title?.toLowerCase() ?? "";
        const currentTeam = currentPlayerRef.current?.team;
        gameAudio.playEvent(title.includes("draw") ? "draw" : currentTeam && title.includes(currentTeam) ? "match_victory" : "match_defeat");
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
        const flagCue: AudioEventCue | undefined = nextFlagState === "carried"
          ? carrier?.id === activePlayerId ? "flag_pickup" : carrier?.team === currentPlayerRef.current?.team ? "flag_teammate" : "flag_enemy"
          : nextFlagState === "dropped"
            ? "flag_drop"
            : nextFlagState === "placed"
              ? undefined
              : nextFlagState === "being_placed"
                ? "flag_plant_start"
            : nextFlagState === "being_captured"
              ? "objective_countdown"
              : nextFlagState === "captured"
                ? "flag_capture"
                : previousFlagState === "carried" && nextFlagState === "available"
                  ? "flag_return"
                  : "flag_reset";
        if (flagCue) gameAudio.playEvent(flagCue, flagCue === "flag_capture" ? {} : spatial);
      }
      setIsSocketReconnecting(false);
      lastVisualSession = nextSession;
      setSession(nextSession);
      setPlayer((current) => nextSession.players.find((item) => item.id === (current?.id ?? activePlayerId)) ?? current);
    });
    socket.on("player_state", (payload: { players?: PlayerSession[]; flag?: GameSession["flag"]; recentEvents?: GameSession["events"] }) => {
      if (!Array.isArray(payload.players)) return;
      setSession((current) => current ? {
        ...current,
        players: current.players.map((candidate) => payload.players?.find((next) => next.id === candidate.id) ?? candidate),
        ...(payload.flag ? { flag: payload.flag } : {}),
        ...(payload.recentEvents ? { events: payload.recentEvents } : {})
      } : current);
      setPlayer((current) => current ? payload.players?.find((next) => next.id === current.id) ?? current : current);
    });
    socket.on("remote_weapon_fire", (payload: { playerId?: string; x?: number; y?: number; z?: number; facing?: number; pitch?: number; gearId?: string }) => {
      if (payload.playerId === activePlayerId || !Number.isFinite(payload.x) || !Number.isFinite(payload.z)) return;
      const attacker = lastVisualSession.players.find((candidate) => candidate.id === payload.playerId);
      emitPlayerAnimation("fire", payload.playerId, attacker?.team);
      emitArenaVfx({
        kind: "weapon_fire",
        x: payload.x!,
        z: payload.z!,
        y: Number.isFinite(payload.y)
          ? Math.max(0.12, payload.y! - ARENA_PLAYER_EYE_HEIGHT + 1.15)
          : 1.15,
        team: attacker?.team,
        playerId: payload.playerId
      });
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
        const currentPlayer = currentPlayerRef.current;
        const localWon = humansWon
          ? currentPlayer?.role !== "zombie"
          : zombiesWon
            ? currentPlayer?.role === "zombie"
            : false;
        emitPlayerVfx(localWon ? "victory" : "defeat");
        emitPlayerAnimation(localWon ? "victory" : "defeat", activePlayerId, currentPlayer?.team);
      }
    });
    type LivePositionUpdate = {
      playerId?: string;
      x?: number;
      y?: number;
      z?: number;
      facing?: number;
      energy?: number;
      crouching?: boolean;
      jumping?: boolean;
    };
    const receivePlayerPosition = (position: LivePositionUpdate) => {
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
            lastVisualSession.settings.mapId === "iron_junction"
              ? "metal"
              : lastVisualSession.settings.mapId === "temple_runoff"
                ? getArenaGroundHeight("temple_runoff", position.x!, position.z!) < 1 ? "water" : "stone"
                : "sand"
          );
        }
        lastRemotePositions.set(position.playerId, { x: position.x!, y: position.y, z: position.z! });
      }
      pendingPositions.set(position.playerId, {
        x: position.x!,
        y: Number.isFinite(position.y) ? position.y : undefined,
        z: position.z!,
        facing: position.facing!,
        ...(Number.isFinite(position.energy) ? { energy: position.energy } : {}),
        crouching: position.crouching === true,
        jumping: position.jumping === true
      });
      positionFlushTimer ??= window.setTimeout(flushPositions, 50);
    };
    socket.on("player_position", receivePlayerPosition);
    socket.on("player_positions", (positions: LivePositionUpdate[]) => {
      if (!Array.isArray(positions)) return;
      positions.forEach(receivePlayerPosition);
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
          humans_cannot_fire: "Humans cannot shoot in Zombie Survival. Answer questions for running energy and escape.",
          fire_cooldown: "Launcher is cooling down."
        };
        queueFeedbackCue(result.reason === "no_valid_target" ? "warning" : "error");
        if (result.reason === "fire_cooldown") emitPlayerVfx("cooldown");
        setFeedback(messages[result.reason ?? ""] ?? "Snowball launched.");
        return;
      }
      const targetTeam = currentSessionRef.current?.players.find((candidate) => candidate.id === result.targetId)?.team;
      emitArenaVfx({ kind: "impact", x: result.targetX, z: result.targetZ, team: targetTeam });
      emitPlayerAnimation("hit", result.targetId, targetTeam);
      if (!result.eliminated) emitArenaVfx({ kind: "shield", x: result.targetX, z: result.targetZ, team: targetTeam });
      if (result.eliminated) emitArenaVfx({ kind: "elimination", x: result.targetX, z: result.targetZ, team: targetTeam });
      if (result.attackerId === activePlayerId) {
        gameAudio.play(result.eliminated ? "eliminated" : "hit_confirm");
        setFeedback(
          result.converted
            ? "Human knocked out and converted to a Red Zombie!"
            : result.eliminated
            ? `Freeze! Opponent out. ${result.moneyAwarded ? `+${formatRewards(result.moneyAwarded)} bonus.` : ""}`
            : `Hit for ${result.damage} warmth.`
        );
        if (result.eliminated) setRewardPulse(result.converted ? "Converted!" : "Freeze!");
      }
      if (result.targetId === activePlayerId) {
        const attackerName = lastVisualSession.players.find((candidate) => candidate.id === result.attackerId)?.nickname ?? "Opponent";
        const incomingSpatial = getCombatAudioSpatial({
          attacker: { x: result.attackerX, z: result.attackerZ },
          target: { x: result.targetX, z: result.targetZ, facing: result.targetFacing }
        });
        if (result.eliminated) gameAudio.play("eliminated", incomingSpatial);
        else if (currentPlayerRef.current?.perks?.includes("shield_vest")) gameAudio.playEvent("shield_impact", incomingSpatial);
        else gameAudio.play("player_tagged", incomingSpatial);
        setIncomingHitCue({
          id: Date.now(),
          direction: getIncomingHitDirection({
            attacker: { x: result.attackerX, z: result.attackerZ },
            target: { x: result.targetX, z: result.targetZ, facing: result.targetFacing }
          }),
          eliminated: result.eliminated,
          attackerName
        });
        setFeedback(
          result.converted
            ? `${attackerName} knocked you out. You are now a Red Zombie—hunt the Blue humans!`
            : result.eliminated
            ? `${attackerName} froze you out. Answer three practice questions to respawn.`
            : `${attackerName} tagged you for ${result.damage} warmth.`
        );
        const currentSession = currentSessionRef.current;
        if (result.eliminated && !result.converted && currentSession?.settings.deadPlayersCanPractice && currentSession.settings.gameMode !== "flag") {
          openRespawnPractice();
        }
      }
    });
    socket.on("elimination_update", (event: EliminationPayload) => {
      if (event.attackerId === activePlayerId) setRewardPulse(event.moneyAwarded ? `+${formatRewards(event.moneyAwarded)}` : "Freeze!");
      if (event.targetId === activePlayerId) setRewardPulse("Frozen");
    });
    socket.on("error_message", (payload: { error?: string }) => {
      queueFeedbackCue("error");
      setFeedback(payload.error ?? "Action failed.");
    });
    socket.on("player_removed", (payload: { message?: string }) => {
      removedByTeacher = true;
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
      setIsSocketReconnecting(false);
      setStatusError(payload.message ?? "Your teacher removed you from this game.");
      socket.disconnect();
    });
    return () => {
      if (positionFlushTimer !== undefined) window.clearTimeout(positionFlushTimer);
      setIsSocketReconnecting(false);
      if (socketRef.current === socket) socketRef.current = null;
      socket.disconnect();
    };
  }, [sessionCode, playerId, playerToken, openRespawnPractice, setAnsweringChoice, setBuyOpen, setFeedback, setIncomingHitCue, setIsSocketReconnecting, setQuizOpen, setRewardPulse, setScoreboardOpen, setSettingsOpen, setStatusError]);

  useEffect(() => {
    if (!sessionCode || !playerId || !playerToken || sessionStatus !== "waiting" || !isSocketReconnecting) return;
    const activePlayerId = playerId;
    let cancelled = false;

    const syncWaitingRoom = async () => {
      try {
        const payload = (await studentApi.session(sessionCode, playerToken)) as { session: GameSession };
        if (cancelled) return;
        setSession(payload.session);
        setPlayer((current) => payload.session.players.find((item) => item.id === (current?.id ?? activePlayerId)) ?? current);
      } catch {
        // The socket remains the primary transport; the next poll retries transient failures.
      }
    };

    const interval = window.setInterval(() => void syncWaitingRoom(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionCode, sessionStatus, playerId, playerToken, isSocketReconnecting]);

  useEffect(() => {
    if (roundPreparation && playerIsAlive) {
      gameAudio.play("menu_toggle");
      setBuyOpen(true);
      setQuizOpen(false);
      setScoreboardOpen(false);
      setSettingsOpen(false);
    } else if (zombieSelection && playerIsAlive) {
      gameAudio.playEvent("quiz_open");
      setQuizOpen(true);
      setBuyOpen(false);
      setScoreboardOpen(false);
      setSettingsOpen(false);
    } else if (previousPreparationRef.current) {
      setBuyOpen(false);
      setQuizOpen(false);
    }
    previousPreparationRef.current = roundPreparation || zombieSelection;
  }, [roundPreparation, zombieSelection, session?.roundTransition?.startsAt, playerId, playerIsAlive, setBuyOpen, setQuizOpen, setScoreboardOpen, setSettingsOpen]);

  const panelsOpen = quizOpen || buyOpen || scoreboardOpen || settingsOpen;
  const gameplayInputPaused = quizOpen || buyOpen || settingsOpen;

  useEffect(() => {
    if (!gameplayInputPaused || !document.pointerLockElement) return;
    document.exitPointerLock();
  }, [gameplayInputPaused]);

  useEffect(() => {
    if (!hasPlayer) {
      previousAliveRef.current = null;
      return;
    }
    if (
      shouldAutoOpenRespawnPractice({
        wasAlive: previousAliveRef.current,
        isAlive: playerIsAlive ?? false,
        canPractice: Boolean(sessionDeadPlayersCanPractice)
          && sessionGameMode !== "flag"
      })
    ) {
      openRespawnPractice();
    }
    previousAliveRef.current = playerIsAlive ?? false;
  }, [hasPlayer, playerId, playerIsAlive, sessionDeadPlayersCanPractice, sessionGameMode, openRespawnPractice]);

  const sendArenaPosition = useCallback(
    (position: ArenaPositionPayload) => {
      if (!hasActiveArenaConnection) return;
      socketRef.current?.volatile.emit("player_position", {
        ...position
      });
    },
    [hasActiveArenaConnection]
  );

  const sendArenaFire = useCallback(
    (position: ArenaPositionPayload) => {
      if (!hasActiveArenaConnection) return;
      const requestId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      socketRef.current?.emit("fire_action", {
        requestId,
        ...position
      });
    },
    [hasActiveArenaConnection]
  );

  const sendFlagAction = useCallback(
    (position: ArenaPositionPayload) => {
      if (!hasActiveArenaConnection || sessionGameMode !== "flag") return;
      socketRef.current?.emit("flag_action", {
        ...position
      });
    },
    [hasActiveArenaConnection, sessionGameMode]
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
      const payload = (await studentApi.join(
        joinCode.trim().toUpperCase(),
        nickname,
        readCosmeticProgressToken()
      )) as {
        session: GameSession;
        player: PlayerSession;
        playerToken: string;
        cosmeticProgressToken?: string;
        question?: PublicQuestion;
      };
      setRestoreFailed(false);
      setSession(payload.session);
      setPlayer(payload.player);
      setPlayerToken(payload.playerToken);
      setQuestion(payload.question ?? null);
      setQuizOpen(false);
      setBuyOpen(false);
      setScoreboardOpen(false);
      setSettingsOpen(false);
      setAnsweringChoice(null);
      storeCosmeticProgressToken(payload.cosmeticProgressToken);
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
      setFeedback("You’re in. Click the game to look around, or use touch controls on a smaller screen.");
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
    setFeedback("Answer locked in...");
    setAnsweringChoice(choice);
    gameAudio.playEvent("quiz_select");
    gameAudio.playEvent("quiz_lock");
    try {
      type AnswerPayload = {
        cosmeticProgressToken?: string;
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
      storeCosmeticProgressToken(payload.cosmeticProgressToken);
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
        setRewardPulse(`+${formatRewards(payload.result.player.money - player.money)}`);
      }
      setQuestion(payload.result.nextQuestion ?? null);
    } catch (err) {
      status.report(err);
    } finally {
      setAnsweringChoice(null);
    }
  };

  useEffect(() => {
    if (!hasSession || sessionStatus !== "ended") return;
    setQuizOpen(false);
    setBuyOpen(false);
    setScoreboardOpen(false);
    setSettingsOpen(false);
    setAnsweringChoice(null);
    if (document.pointerLockElement) document.exitPointerLock();
  }, [hasSession, sessionId, sessionStatus, setAnsweringChoice, setBuyOpen, setQuizOpen, setScoreboardOpen, setSettingsOpen]);

  const buy = async (gearId: string) => {
    if (!session || !player || !playerToken || buyingGearId || isBuyingSnowballs) return;
    status.clear();
    setFeedback("Choosing gear...");
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
    setFeedback("Restocking snowballs...");
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

  answerActionRef.current = answer;
  buyActionRef.current = buy;
  buySnowballsActionRef.current = buySnowballs;

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target instanceof HTMLElement ? target : null;
      if (!element) return false;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) || element.isContentEditable;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!hasActiveArenaConnection || isTypingTarget(event.target)) return;
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
        void answerActionRef.current(choices[index]);
        return;
      }
      if (buyOpen && !event.repeat) {
        const shortcut = getShopShortcut(event.key);
        if (!shortcut) return;
        event.preventDefault();
        if (shortcut.item === "snowballs") void buySnowballsActionRef.current();
        else void buyActionRef.current(shortcut.item);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !hasActiveArenaConnection || isTypingTarget(event.target)) return;
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
    hasActiveArenaConnection,
    playerToken,
    quizOpen,
    buyOpen,
    question,
    scoreboardOpen,
    answeringChoice,
    buyingGearId,
    isBuyingSnowballs,
    setBuyOpen,
    setQuizOpen,
    setScoreboardOpen,
    setSettingsOpen,
    setAnsweringChoice
  ]);

  const chooseTeam = async (team: Team) => {
    if (!session || !player || !playerToken || session.status !== "waiting" || isSwitchingTeam || player.team === team) return;
    const now = performance.now();
    if (now - lastTeamSwitchAtRef.current < 900) return;
    lastTeamSwitchAtRef.current = now;
    setIsSwitchingTeam(true);
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
    } finally {
      setIsSwitchingTeam(false);
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
    (assetId: string) => sessionCode
      ? fetchDecalAsset(sessionCode, assetId, playerToken)
      : Promise.reject(new Error("There is no active game room.")),
    [sessionCode, playerToken]
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
          <QuizStrikeLogo size="auth" />
          <span className="auth-kicker">Join your classroom game</span>
          <h1>Join with your code</h1>
          <p>Enter the code from your teacher, choose a name your class will recognize, and get ready to play.</p>
          <div className="panel how-to-card">
            <h2>How the game works</h2>
            <p>Answer questions to earn rewards, choose snowballs or gear, then help your team tag opponents or capture the flag.</p>
            <p>Use WASD to move, arrow keys or a swipe to look around, and F or click to play. Press E for the flag. Press C or right click to change your launcher view. Q opens questions, B opens gear, 1–5 choose gear, and hold Tab to see the scoreboard.</p>
            <p>If you’re frozen out, keep practicing. Three correct answers bring you back into the round.</p>
          </div>
        </div>
        <form className="panel form-panel student-join-form" onSubmit={join}>
          {joinCodeFromLink ? (
            <div className="linked-join-code" aria-label={`Join session ${joinCode}`}>
              <span><Link2 size={17} aria-hidden="true" />Game link ready</span>
              <strong>{joinCode}</strong>
              <small>Add your name below and you’re ready to join.</small>
            </div>
          ) : (
            <label className="join-field">
              <span className="join-field-label">Classroom code</span>
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
              <small id="join-code-help">Enter the 6-character code on your teacher’s screen.</small>
            </label>
          )}
          <details className="student-join-tips">
            <summary>How to play</summary>
            <p>Answer questions to earn rewards, choose your gear, then use WASD and F or click to play.</p>
          </details>
          <label className="join-field">
            <span className="join-field-label">Your name</span>
            <input placeholder="Name your teacher will recognize" autoComplete="nickname" autoFocus={Boolean(joinCodeFromLink)} enterKeyHint="done" value={nickname} onChange={(event) => { setNickname(event.target.value); status.clearError(); }} maxLength={20} aria-invalid={Boolean(nicknameError)} aria-describedby={nicknameError ? "nickname-error nickname-help" : "nickname-help"} />
            <small id="nickname-help">Use the name your teacher expects to see.</small>
          </label>
          {nicknameError && <p id="nickname-error" className="error-text" role="alert">{nicknameError}</p>}
          {status.error && <p id="join-error" className="error-text" role="alert">{status.error}</p>}
          {restoreFailed && (
            <button
              className="text-button join-recovery-button"
              type="button"
              onClick={() => {
                clearStoredStudentSession();
                setRestoreFailed(false);
                setJoinCode(joinCodeFromLink);
                setNickname("");
                status.clear();
              }}
            >
              Start over with a new join
            </button>
          )}
          <button className="primary" type="submit" disabled={isJoining || Boolean(nicknameError)}>
            {isJoining ? "Joining..." : "Join the game"}
          </button>
        </form>
      </section>
    );
  }

  const gear = GEAR_ITEMS.find((item) => item.id === getPlayerWeaponIdForMode(session.settings.gameMode, player)) ?? GEAR_ITEMS[0];
  const snowballs = player.snowballs ?? session.settings.startingSnowballs;
  const warmth = getPlayerWarmth(player);
  const isZombieHuman = session.settings.gameMode === "zombie" && player.role !== "zombie";
  const canFire = canPlayerFireInMode(session.settings.gameMode, player.role);
  const runningEnergy = Math.round(Math.max(0, Math.min(ZOMBIE_HUMAN_MAX_ENERGY, player.energy ?? 0)));
  const connectedPlayers = session.players.filter((candidate) => candidate.connectionState !== "disconnected");
  const redTeamCount = connectedPlayers.filter((candidate) => candidate.team === "red").length;
  const blueTeamCount = connectedPlayers.filter((candidate) => candidate.team === "blue").length;
  const respawnProgress = player.respawnCorrectAnswers ?? 0;
  const canPracticeToRespawn = !player.isAlive && session.settings.deadPlayersCanPractice && session.settings.gameMode !== "flag";
  const roundActive = session.status === "active";
  const roundEnded = session.status === "ended";
  const menuTitle = canPracticeToRespawn && quizOpen ? "Practice to return" : quizOpen ? "Questions" : buyOpen ? "Choose gear" : settingsOpen ? "Game settings" : "Scoreboard";
  const roundTimeLabel = formatDuration(roundPreparation || zombieSelection ? preparationRemainingSeconds : remainingSeconds);
  const roundCountdownClassName = [
    "round-countdown",
    roundActive ? "round-countdown-active" : "",
    roundActive && remainingSeconds <= 30 ? "round-countdown-low" : ""
  ].filter(Boolean).join(" ");
  const objectiveText = roundPreparation
    ? "Choose gear or answer questions for rewards before the round starts."
    : zombieSelection
      ? `Everyone is Human. Answer questions for energy; Zombies are chosen in ${preparationRemainingSeconds}s.`
    : session.settings.gameMode === "flag"
      ? flagStatusText(session)
    : session.settings.gameMode === "zombie"
      ? zombieStatusText(session, player)
      : "Most tags wins. Respawns come next, then answer accuracy breaks ties.";
  const sessionResult = getSessionResultText(session);
  const arenaPlayer = spectatorPlayer ?? player;
  const isFlagSpectator = !player.isAlive && session.settings.gameMode === "flag";
  const spectatorIndex = spectatorPlayer
    ? spectatorCandidates.findIndex((candidate) => candidate.id === spectatorPlayer.id) + 1
    : 0;
  const spectatorGear = spectatorPlayer
    ? GEAR_ITEMS.find((item) => item.id === getPlayerWeaponIdForMode(session.settings.gameMode, spectatorPlayer)) ?? GEAR_ITEMS[0]
    : undefined;
  const cycleSpectator = (direction: -1 | 1) => {
    if (spectatorCandidates.length < 2) return;
    const currentIndex = Math.max(0, spectatorCandidates.findIndex((candidate) => candidate.id === arenaPlayer.id));
    const nextIndex = (currentIndex + direction + spectatorCandidates.length) % spectatorCandidates.length;
    setSpectatorPlayerId(spectatorCandidates[nextIndex].id);
  };

  return (
    <section className={[
      "game-layout",
      isCompactViewport ? "compact-game-layout" : "",
      gamePreferences.highContrastHud ? "high-contrast-hud" : "",
      session.status === "waiting" ? "waiting-game-layout" : ""
    ].filter(Boolean).join(" ")}>
      <div className="game-stage">
        {session.status !== "waiting" && <GameAnnouncementOverlay announcement={roundPreparation || zombieSelection ? undefined : session.announcement} serverTime={session.serverTime} />}
        <div className={`game-utility-bar${session.status === "waiting" ? " lobby-utility-bar" : ""}`}>
          {session.status === "waiting" ? (
            <div className="lobby-brand">
              <QuizStrikeLogo size="lobby" />
              <small>{gameModeLabel(session.settings.gameMode)} · Room {session.sessionCode}</small>
            </div>
          ) : <span>{gameModeLabel(session.settings.gameMode)}</span>}
          <button type="button" onClick={() => { setSettingsOpen(true); setQuizOpen(false); setBuyOpen(false); setScoreboardOpen(false); }}><Settings size={16} aria-hidden="true" />Settings</button>
          <button type="button" onClick={onExit}>Leave game</button>
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
              onFire={roundActive && player.isAlive && canFire ? sendArenaFire : undefined}
              onInteract={roundActive && player.isAlive ? sendFlagAction : undefined}
              loadDecalAsset={loadStudentDecal}
            />
          </Suspense>
        )}
        {session.status !== "waiting" && (<>
        <div className={roundCountdownClassName} role="timer" aria-label={`Round time remaining ${roundTimeLabel}`}>
          <Timer size={18} aria-hidden="true" />
          <span>{roundPreparation ? "Get ready" : zombieSelection ? "Choose Zombies" : "Time left"}</span>
          <strong>{roundTimeLabel}</strong>
        </div>
        <div className="arena-objective-strip">
          <span className={`status-pill status-${session.status}`}>{roundPreparation ? "Get ready" : zombieSelection ? "Choosing Zombies" : sessionStatusLabel(session.status)}</span>
          <span className="objective-primary">{objectiveText}</span>
          {session.settings.gameMode === "flag" && session.flag?.state === "placed" && (
            <span className={`flag-objective-countdown${flagRemainingSeconds <= 10 ? " urgent" : ""}`} role="timer" aria-label={`Active flag time remaining ${formatDuration(flagRemainingSeconds)}`}>
              <Timer size={14} aria-hidden="true" />
              <strong>{formatDuration(flagRemainingSeconds)}</strong>
            </span>
          )}
          <span className={`mode-pill mode-${session.settings.gameMode}`}>
            {gameModeLabel(session.settings.gameMode)}
            {session.settings.gameMode === "flag" ? ` · Round ${session.currentRound}/${session.settings.roundCount}` : ""}
          </span>
        </div>
        {isFlagSpectator ? (
          <section className="spectator-dock" aria-label="Spectator controls" data-testid="spectator-dock">
            <div className="spectator-state">
              <span className="spectator-state-icon"><Snowflake size={20} aria-hidden="true" /></span>
              <span>
                <small>Frozen for this round</small>
                <strong>Back in the next round</strong>
              </span>
            </div>
            <button
              className="spectator-cycle-button"
              type="button"
              onClick={() => cycleSpectator(-1)}
              disabled={spectatorCandidates.length < 2}
              aria-label="Watch the previous player"
            >
              <ChevronLeft size={22} aria-hidden="true" />
              <span>Previous</span>
            </button>
            <div className="spectator-focus" aria-live="polite" aria-atomic="true">
              <small><Eye size={15} aria-hidden="true" />Watching{spectatorCandidates.length > 0 ? ` ${spectatorIndex} of ${spectatorCandidates.length}` : ""}</small>
              <div>
                <strong>{spectatorPlayer?.nickname ?? "Waiting for an active player"}</strong>
                {spectatorPlayer && (
                  <span className={`spectator-team spectator-team-${spectatorPlayer.team}`}>
                    {spectatorPlayer.team === "blue" ? "Blue Team" : "Red Team"}
                  </span>
                )}
              </div>
            </div>
            <button
              className="spectator-cycle-button"
              type="button"
              onClick={() => cycleSpectator(1)}
              disabled={spectatorCandidates.length < 2}
              aria-label="Watch the next player"
            >
              <span>Next</span>
              <ChevronRight size={22} aria-hidden="true" />
            </button>
            {spectatorPlayer && spectatorGear ? (
              <div className="spectator-player-stats" aria-label={`${spectatorPlayer.nickname} status`}>
                <span>
                  <HeartPulse size={16} aria-hidden="true" />
                  <span><small>Health</small><strong>{getPlayerWarmth(spectatorPlayer)}</strong></span>
                </span>
                <span>
                  <Target size={16} aria-hidden="true" />
                  <span><small>Snowballs</small><strong>{spectatorPlayer.snowballs ?? session.settings.startingSnowballs}</strong></span>
                </span>
                <span className="spectator-gear">
                  <Package size={16} aria-hidden="true" />
                  <span><small>Gear</small><strong>{spectatorGear.name}</strong></span>
                </span>
              </div>
            ) : (
              <p className="spectator-waiting-copy">The camera will switch when a student is active.</p>
            )}
          </section>
        ) : (
        <div className="hud player-status-hud">
          <span className={player.isAlive ? "hud-stat hud-warmth" : "hud-stat hud-warmth low"}>
            <HeartPulse size={18} aria-hidden="true" />
            <span>
              <small>Health</small>
              <strong>{warmth}</strong>
            </span>
          </span>
          {isZombieHuman ? (
            <span className={`hud-stat hud-energy${runningEnergy <= 20 ? " low" : ""}`}>
              <Zap size={18} aria-hidden="true" />
              <span>
                <small>Energy</small>
                <strong>{runningEnergy}/{ZOMBIE_HUMAN_MAX_ENERGY}</strong>
              </span>
            </span>
          ) : (
            <span className="hud-stat">
              <CircleDollarSign size={18} aria-hidden="true" />
              <span>
                <small>Money</small>
                <strong>${player.money}</strong>
              </span>
            </span>
          )}
          <span className={`hud-stat team-${player.team}`}>
            {session.settings.gameMode === "zombie" && player.role === "zombie"
              ? <img className="zombie-head-icon" src="/assets/zombie/zombie-head.png" alt="" aria-hidden="true" />
              : <Users size={18} aria-hidden="true" />}
            <span>
              <small>{session.settings.gameMode === "zombie" ? "Role and look" : "Team"}</small>
              <strong>{session.settings.gameMode === "zombie" ? (player.role === "zombie" ? "Zombie · Red" : "Human · Blue") : player.team === "blue" ? "Blue Team" : "Red Team"}</strong>
            </span>
          </span>
          {isZombieHuman ? (
            <>
              <span className="hud-stat weapon">
                <BookOpen size={18} aria-hidden="true" />
                <span>
                  <small>Recharge</small>
                  <strong>Correct answer = +{ZOMBIE_HUMAN_CORRECT_ENERGY}</strong>
                </span>
              </span>
              <span className="hud-stat">
                <Shield size={18} aria-hidden="true" />
                <span>
                  <small>Human goal</small>
                  <strong>{runningEnergy > 0 ? "Run and survive" : "Answer to move"}</strong>
                </span>
              </span>
            </>
          ) : (<>
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
              <small>Snowballs left</small>
              <strong>{snowballs}</strong>
            </span>
          </span>
          </>)}
        </div>
        )}
        </>)}
        {incomingHitCue && (
          <div
            key={incomingHitCue.id}
            className={`incoming-hit-flash incoming-hit-flash-${incomingHitCue.direction}${incomingHitCue.eliminated ? " incoming-hit-flash-eliminated" : ""}`}
            data-testid="incoming-hit-flash"
            role="status"
            aria-live="assertive"
            onAnimationEnd={() => setIncomingHitCue(null)}
          >
            <span className="incoming-attacker-label">
              <strong>{incomingHitCue.attackerName}</strong>
              <small>
                {incomingHitCue.eliminated ? "froze you" : "attacking"} from{" "}
                {incomingHitCue.direction === "front"
                  ? "ahead"
                  : incomingHitCue.direction === "back"
                    ? "behind"
                    : incomingHitCue.direction}
              </small>
            </span>
          </div>
        )}
        {rewardPulse && <div className="reward-toast" onAnimationEnd={() => setRewardPulse("")}>{rewardPulse}</div>}
        {panelsOpen && (
          <div className="game-menu-overlay" role="dialog" aria-modal="false" aria-label="Arena menu">
            <div className="game-menu-bar">
              <strong>{menuTitle}</strong>
              <button type="button" onClick={() => { gameAudio.play("menu_toggle"); setQuizOpen(false); setBuyOpen(false); setScoreboardOpen(false); setSettingsOpen(false); }}>
                Back to the game
              </button>
            </div>
            {quizOpen && (
              <>
                {canPracticeToRespawn && (
                  <div className="panel respawn-card respawn-card-overlay">
                    <div className="panel-title">
                      <h2>Answer 3 to return</h2>
                      <span>{respawnProgress}/{RESPAWN_CORRECT_ANSWERS_REQUIRED}</span>
                    </div>
                    <div className="respawn-meter" aria-label="Respawn progress">
                      <span style={{ width: `${Math.min(100, (respawnProgress / RESPAWN_CORRECT_ANSWERS_REQUIRED) * 100)}%` }} />
                    </div>
                    <p>Get three practice answers correct to return with full health and fresh snowballs.</p>
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
                buyPhaseSeconds={roundPreparation ? preparationRemainingSeconds : undefined}
              />
            )}
            {scoreboardOpen && <Scoreboard players={session.players} localPlayerId={player.id} gameMode={session.settings.gameMode} />}
            {settingsOpen && <GamePreferencesPanel preferences={gamePreferences} onChange={updateGamePreferences} />}
          </div>
        )}
        {(session.status === "waiting" || roundEnded || isSocketReconnecting || (!player.isAlive && session.settings.gameMode !== "flag") || status.error || feedback) && (
          <div className={`student-alerts${session.status === "waiting" ? " has-character-creator" : ""}`} aria-live="polite">
            {session.status === "waiting" && (
              <div className="panel pre-round-card creator-ready-room">
                <header className="lobby-selection-header">
                  <div className="lobby-instruction">
                    <span>Before the game</span>
                    <h2>Choose your team, then wait for the teacher to start.</h2>
                    <p className="lobby-ready-note">You’re connected. Pick a team and style your player while the class joins.</p>
                    <div className="lobby-status-row">
                      <span className="waiting-status"><span className="waiting-pulse" />Waiting for teacher…</span>
                      <span className="lobby-player-count"><Users size={15} />{connectedPlayers.length} {connectedPlayers.length === 1 ? "player" : "players"} joined</span>
                    </div>
                  </div>
                  <div className="team-choice-grid" aria-label="Choose your team">
                    <button
                      type="button"
                      className={`team-choice team-choice-red${player.team === "red" ? " selected" : ""}`}
                      onClick={() => void chooseTeam("red")}
                      disabled={isSwitchingTeam || session.settings.teamAssignment !== "players_choose" || session.settings.gameMode === "zombie"}
                      aria-pressed={player.team === "red"}
                    >
                      <span className="team-choice-emblem"><Shield size={20} /></span>
                      <span><small>Red team</small><strong>{redTeamCount} playing</strong></span>
                      {player.team === "red" && <Check className="team-choice-check" size={18} />}
                    </button>
                    <button
                      type="button"
                      className={`team-choice team-choice-blue${player.team === "blue" ? " selected" : ""}`}
                      onClick={() => void chooseTeam("blue")}
                      disabled={isSwitchingTeam || session.settings.teamAssignment !== "players_choose" || session.settings.gameMode === "zombie"}
                      aria-pressed={player.team === "blue"}
                    >
                      <span className="team-choice-emblem"><Shield size={20} /></span>
                      <span><small>Blue team</small><strong>{blueTeamCount} playing</strong></span>
                      {player.team === "blue" && <Check className="team-choice-check" size={18} />}
                    </button>
                    {session.settings.teamAssignment !== "players_choose" && <small className="team-lock-note">Your teacher is assigning the teams.</small>}
                  </div>
                </header>
                <Suspense fallback={<ArenaLoading label="Loading character creator" />}>
                  <CharacterCreator
                    appearance={player.appearance}
                    team={player.team}
                    policy={session.settings.characterCustomization}
                    progress={getCosmeticProgress(player)}
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
                <h2>Game over</h2>
                <p>{sessionResult}</p>
                <div className="student-summary-metrics">
                  <span><strong>{player.correctAnswers + player.wrongAnswers > 0 ? `${accuracy(player)}%` : "—"}</strong> answer accuracy</span>
                  <span><strong>{Math.round(player.quizMoneyEarned ?? 0)}</strong> rewards earned</span>
                  <span><strong>{formatRewards(player.moneySpent ?? 0)}</strong> spent on gear</span>
                  <span><strong>{Math.round(player.money)}</strong> rewards left</span>
                  <span><strong>{player.score}</strong> final score</span>
                </div>
                <div className="button-row">
                  <button className="primary" onClick={returnToJoin}>Join another game</button>
                  <button onClick={onExit}>Back to QuizStrike</button>
                </div>
              </div>
            )}
            {isSocketReconnecting && (
              <p className="connection-banner">
                <WifiOff size={16} aria-hidden="true" />
                Reconnecting...
              </p>
            )}
            {!player.isAlive && session.settings.gameMode !== "flag" && (
              <div className="panel respawn-card">
                <div className="panel-title">
                  <h2>{canPracticeToRespawn ? "Practice to return" : "Waiting for the next round"}</h2>
                  <span>{respawnProgress}/{RESPAWN_CORRECT_ANSWERS_REQUIRED}</span>
                </div>
                <div className="respawn-meter" aria-label="Respawn progress">
                  <span style={{ width: `${Math.min(100, (respawnProgress / RESPAWN_CORRECT_ANSWERS_REQUIRED) * 100)}%` }} />
                </div>
                <p>{canPracticeToRespawn
                  ? `Answer ${Math.max(0, RESPAWN_CORRECT_ANSWERS_REQUIRED - respawnProgress)} more correctly to return at your team base with full health and fresh snowballs.`
                  : "Practice questions are off for this game. Watch the scoreboard and get ready for the next round."}</p>
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
      {session.status !== "waiting" && <div className="action-bar control-prompts">
        <button disabled={roundEnded} onClick={() => { gameAudio.playEvent(quizOpen ? "modal_close" : "quiz_open"); setQuizOpen(!quizOpen); setBuyOpen(false); setScoreboardOpen(false); }}>Q Questions</button>
        <button disabled={roundEnded || !player.isAlive} onClick={() => { gameAudio.play("menu_toggle"); setBuyOpen(!buyOpen); setQuizOpen(false); setScoreboardOpen(false); }}>B Gear · 1–5 choose</button>
        <button onMouseDown={() => { gameAudio.play("menu_toggle"); setScoreboardOpen(true); setQuizOpen(false); setBuyOpen(false); setSettingsOpen(false); }} onMouseUp={() => setScoreboardOpen(false)} onBlur={() => setScoreboardOpen(false)}>Hold Tab · Scoreboard</button>
        <button onClick={() => { gameAudio.play("menu_toggle"); setSettingsOpen((open) => !open); setQuizOpen(false); setBuyOpen(false); setScoreboardOpen(false); }}><Settings size={18} aria-hidden="true" />Settings</button>
      </div>}
    </section>
  );
}

