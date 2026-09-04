import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  Footprints,
  HeartPulse,
  Link2,
  Package,
  Settings,
  Shield,
  Snowflake,
  Target,
  Timer,
  Trophy,
  Users,
  WifiOff,
  Zap
} from "lucide-react";
import type { Socket } from "socket.io-client";
import {
  buildPracticeWorksheetFilename,
  buildStudentLearningSummary,
  buildStudentPracticeQuestions,
  GEAR_ITEMS,
  type SnowballPackSize,
  ZOMBIE_HUMAN_CORRECT_ENERGY,
  ZOMBIE_HUMAN_MAX_ENERGY,
  ATHLETICS_CRITICAL_ENERGY,
  ATHLETICS_MAX_ENERGY,
  ATHLETICS_MODE_CONFIG,
  getChaosAbilityLabel,
  canPlayerFireInMode,
  getCosmeticProgress,
  getArenaGroundHeight,
  ARENA_PLAYER_EYE_HEIGHT,
  getPlayerWeaponIdForMode,
  ATHLETICS_STADIUM_COURSE,
  resolveAthleticsStandings,
  RESPAWN_CORRECT_ANSWERS_REQUIRED,
  getRoundRemainingSeconds,
  isRoundPreparationPhase,
  isZombieSelectionPhase,
  FlagPlantedEventSchema,
  FreezeStreakAnnouncementEventSchema,
  FREEZE_STREAK_ANNOUNCEMENTS,
  sanitizePlayerAppearance,
  validateSessionSnapshot,
  type Choice,
  type AthleticsAbility,
  type AthleticsMode,
  type AthleticsRecoveryReason,
  type GameEvent,
  type FlagPlantedEvent,
  type FreezeStreakAnnouncementEvent,
  type GameSession,
  type PlayerSession,
  type PlayerAppearance,
  type PublicQuestion,
  type SessionSettings,
  type StudentAnswerAttempt,
  type StudentLearningReport,
  type StudentPracticeQuestion,
  type Team
} from "@quizstrike/shared";
import { ApiError, fetchDecalAsset, studentApi } from "../../../api/client";
import { getJoinCodeFromSearch } from "../../../navigation";
import { getSessionResultText } from "../../../sessionPresentation";
import { formatStudentJoinError } from "../../../studentJoinErrors";
import { getShopShortcut } from "../../../shopShortcuts";
import { sendStudentCommand } from "../../../studentCommandTransport";
import { StatusMessages } from "../../../ui/StatusMessages";
import QuizStrikeLogo from "../../../ui/QuizStrikeLogo";
import { gameAudio, getCombatAudioSpatial, type AudioEventCue, type GameAudioCue } from "../../../game/GameAudio";
import { gameplayAnnouncements } from "../../../game/GameplayAnnouncements";
import { readGamePreferences, writeGamePreferences, type GamePreferences } from "../../../game/gamePreferences";
import type { ArenaVfxEvent, ArenaVfxKind } from "../../../game/ArenaVfx";
import { emitArenaAnimation, type ArenaAnimationCue } from "../../../game/ArenaAnimation";
import { getIncomingHitDirection, shouldAutoOpenRespawnPractice } from "../../../studentCombatFeedback";
import ArenaLoading from "../shared/ArenaLoading";
import GameAnnouncementOverlay from "../shared/GameAnnouncementOverlay";
import BuyPanel from "./BuyPanel";
import GamePreferencesPanel from "./GamePreferencesPanel";
import QuizPanel, { type QuizAnswerFeedback } from "./QuizPanel";
import RewardVfxOverlay, { type RewardVfxCue } from "./RewardVfxOverlay";
import Scoreboard from "./Scoreboard";
import TeacherPauseOverlay from "./TeacherPauseOverlay";
import { useStudentGameState } from "./useStudentGameState";
import { getAnswerFeedbackDurationMs } from "./feedback";
import {
  clearStoredStudentSession,
  consumeStoredAppearanceForSession,
  readCosmeticProgressToken,
  readStoredStudentSession,
  storeCosmeticProgressToken,
  storeStudentSession,
  type StoredStudentSession
} from "./studentSessionStorage";
import { getNicknameError, validateStudentJoin } from "./studentJoinValidation";
import { buildSnowballPurchaseCommand } from "./snowballPurchaseCommand";

const ArenaPreview = lazy(() => import("../../../game/ArenaPreview"));
const CharacterCreator = lazy(() => import("../../../ui/PremiumCharacterCreator"));

const loadArenaVfx = () => import("../../../game/ArenaVfx");
const emitArenaVfx = (event: ArenaVfxEvent) => {
  void loadArenaVfx().then(({ emitArenaVfx: emit }) => emit(event));
};

const choices: Choice[] = ["A", "B", "C", "D"];
const STUDENT_APPEARANCE_STORAGE_KEY = "quizstrike_student_appearance_v1";

const readStoredAppearance = (): PlayerAppearance | null => {
  try {
    const raw = localStorage.getItem(STUDENT_APPEARANCE_STORAGE_KEY);
    return raw ? sanitizePlayerAppearance(JSON.parse(raw) as Partial<PlayerAppearance>) : null;
  } catch {
    return null;
  }
};

type StudentAttemptSnapshot = StudentAnswerAttempt & { question: StudentPracticeQuestion };
type ArenaPositionPayload = {
  x: number;
  z: number;
  y?: number;
  facing: number;
  pitch?: number;
  scoped?: boolean;
  zoomLevel?: number;
  crouching?: boolean;
  jumping?: boolean;
  movementSequence?: number;
  movementEpoch?: number;
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

const formatRewards = (value: number) => `${Math.round(value)} rewards`;


const sessionStatusLabel = (status: GameSession["status"]) => {
  if (status === "active") return "Round live";
  if (status === "paused") return "Round results";
  if (status === "ended") return "Game over";
  return "Waiting for players";
};

const gameModeLabel = (mode: SessionSettings["gameMode"]) => {
  if (mode === "flag") return "Capture the Flag";
  if (mode === "zombie") return "Zombie Survival";
  if (mode === "athletics") return "Athletics Race";
  return "Team Tag";
};

const athleticsModeForSession = (session: Pick<GameSession, "settings" | "athletics">): AthleticsMode =>
  session.settings.athleticsMode ?? session.athletics?.mode ?? "classic";

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

const getPlayerWarmth = (player: PlayerSession) => Math.max(0, Math.round(player.health ?? (player.isAlive ? 100 : 0)));

type FeedbackCue = "success" | "warning" | "error";

type AthleticsWarning = {
  attackId: string;
  tier: string;
  targeted: boolean;
  position?: { x: number; y: number; z: number };
  strikeAt: string;
};

const warmFeedbackCue = () => gameAudio.warm();
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
const queueFeedbackCue = (cue: FeedbackCue) => window.setTimeout(() => feedbackCue(cue), 0);


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
    : `Humans ${humans} · Zombies ${zombies} · Answer for energy, then move`;
};



function useRoundRemaining(session: GameSession | null) {
  const [clientNowMs, setClientNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  useEffect(() => {
    const serverTimeMs = session?.serverTime ? Date.parse(session.serverTime) : Number.NaN;
    setServerOffsetMs(Number.isFinite(serverTimeMs) ? serverTimeMs - Date.now() : 0);
  }, [session?.serverTime]);

  useEffect(() => {
    setClientNowMs(Date.now());
    if (session?.status !== "active" || session.controlState === "teacher_paused") {
      return;
    }

    const interval = window.setInterval(() => setClientNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.status, session?.controlState, session?.teacherPausedAt, session?.startedAt, session?.endsAt]);

  if (!session || session.status === "ended" || session.status === "paused") return 0;
  const at = session.controlState === "teacher_paused"
    ? session.teacherPausedAt ?? session.serverTime
    : new Date(clientNowMs + serverOffsetMs).toISOString();
  return at ? getRoundRemainingSeconds(session, at) : 0;
}

function useDeadlineRemainingSeconds(deadline?: string, serverTime?: string, pausedAt?: string) {
  const [clientNowMs, setClientNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  useEffect(() => {
    const serverTimeMs = serverTime ? Date.parse(serverTime) : Number.NaN;
    setServerOffsetMs(Number.isFinite(serverTimeMs) ? serverTimeMs - Date.now() : 0);
  }, [serverTime]);

  useEffect(() => {
    setClientNowMs(Date.now());
    if (!deadline || pausedAt) return;
    const interval = window.setInterval(() => setClientNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [deadline, serverTime, pausedAt]);

  if (!deadline) return 0;
  const nowMs = pausedAt ? Date.parse(pausedAt) : clientNowMs + serverOffsetMs;
  return Math.max(0, Math.ceil((Date.parse(deadline) - nowMs) / 1000));
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
    if (expiresAtMs === undefined || session?.controlState === "teacher_paused") return;
    const interval = window.setInterval(() => setClientNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [expiresAtMs, session?.serverTime, session?.controlState, session?.teacherPausedAt]);

  if (expiresAtMs === undefined) return 0;
  const nowMs = session?.controlState === "teacher_paused" && session.teacherPausedAt
    ? Date.parse(session.teacherPausedAt)
    : clientNowMs + serverOffsetMs;
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
}


export default function StudentExperience({ onExit }: { onExit: () => void }) {
  const [joinCodeFromLink] = useState(() => getJoinCodeFromSearch(window.location.search));
  const [joinCode, setJoinCode] = useState(joinCodeFromLink);
  const [nickname, setNickname] = useState("");
  const [session, setSession] = useState<GameSession | null>(null);
  const [player, setPlayer] = useState<PlayerSession | null>(null);
  const [playerToken, setPlayerToken] = useState("");
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [answerHistory, setAnswerHistory] = useState<StudentAttemptSnapshot[]>([]);
  const [answerFeedback, setAnswerFeedback] = useState<QuizAnswerFeedback | null>(null);
  const [rewardVfx, setRewardVfx] = useState<RewardVfxCue | null>(null);
  const [currencyPulse, setCurrencyPulse] = useState(0);
  const [hitConfirmPulse, setHitConfirmPulse] = useState(0);
  const [athleticsWarning, setAthleticsWarning] = useState<AthleticsWarning | null>(null);
  const [learningReport, setLearningReport] = useState<StudentLearningReport | null>(null);
  const [isLearningReportLoading, setIsLearningReportLoading] = useState(false);
  const [learningReportError, setLearningReportError] = useState("");
  const [isDownloadingWorksheet, setIsDownloadingWorksheet] = useState(false);
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
  const athleticsRace = session?.settings.gameMode === "athletics";
  const athleticsMode = athleticsRace && session ? athleticsModeForSession(session) : "classic";
  const athleticsWarningRemainingSeconds = useDeadlineRemainingSeconds(
    athleticsWarning?.strikeAt,
    session?.serverTime,
    session?.controlState === "teacher_paused" ? session.teacherPausedAt : undefined
  );
  const athleticsStartRemainingSeconds = useDeadlineRemainingSeconds(
    athleticsRace ? session?.athletics?.startAt : undefined,
    session?.serverTime,
    session?.controlState === "teacher_paused" ? session.teacherPausedAt : undefined
  );
  const athleticsRemainingSeconds = useDeadlineRemainingSeconds(
    athleticsRace ? session?.endsAt : undefined,
    session?.serverTime,
    session?.controlState === "teacher_paused" ? session.teacherPausedAt : undefined
  );
  const athleticsStandings = useMemo(
    () => athleticsRace && session ? resolveAthleticsStandings(session.players) : [],
    [athleticsRace, session]
  );
  const preparationRemainingSeconds = useDeadlineRemainingSeconds(
    roundPreparation || zombieSelection ? session?.roundTransition?.startsAt : undefined,
    session?.serverTime,
    session?.controlState === "teacher_paused" ? session.teacherPausedAt : undefined
  );
  const socketRef = useRef<Socket | null>(null);
  const previousAliveRef = useRef<boolean | null>(null);
  const previousPreparationRef = useRef(false);
  const lastCountdownCueRef = useRef("");
  const lastAthleticsCountdownCueRef = useRef("");
  const answerFeedbackTimerRef = useRef<number | undefined>(undefined);
  // State updates are asynchronous; this synchronous guard closes the small
  // keyboard/pointer window before `answeringChoice` re-renders.
  const answerSubmissionLockRef = useRef(false);
  const answerOperationRef = useRef(0);
  const purchaseOperationRef = useRef(0);
  const purchaseLockRef = useRef(false);
  const roundScopedUiKeyRef = useRef("");
  const learningReportRequestKeyRef = useRef("");
  const lastTeamSwitchAtRef = useRef(0);
  const movementSequenceRef = useRef(0);
  const athleticsMovementEpochRef = useRef(0);
  const currentSessionRef = useRef<GameSession | null>(session);
  const currentPlayerRef = useRef<PlayerSession | null>(player);
  const questionFetchInFlightRef = useRef(false);
  const answerActionRef = useRef<(choice: Choice) => Promise<void>>(async () => undefined);
  const buyActionRef = useRef<(gearId: string) => Promise<void>>(async () => undefined);
  const buySnowballsActionRef = useRef<(packSize: SnowballPackSize) => Promise<void>>(async () => undefined);
  const setStatusError = status.setError;
  const roundScopedUiKey = session ? `${session.id}:${session.currentRound}` : "";
  currentSessionRef.current = session;
  currentPlayerRef.current = player;

  const resetRoundScopedStudentUi = useCallback(() => {
    if (answerFeedbackTimerRef.current !== undefined) {
      window.clearTimeout(answerFeedbackTimerRef.current);
      answerFeedbackTimerRef.current = undefined;
    }
    answerSubmissionLockRef.current = false;
    answerOperationRef.current += 1;
    purchaseOperationRef.current += 1;
    purchaseLockRef.current = false;
    setAnsweringChoice(null);
    setAnswerFeedback(null);
    setQuestion(null);
    setAthleticsWarning(null);
    setBuyingGearId(null);
    setIsBuyingSnowballs(false);
    setQuizOpen(false);
    setBuyOpen(false);
    setScoreboardOpen(false);
    setSettingsOpen(false);
  }, [setAnsweringChoice, setBuyingGearId, setBuyOpen, setIsBuyingSnowballs, setQuizOpen, setScoreboardOpen, setSettingsOpen]);

  useEffect(() => {
    if (!roundScopedUiKey) {
      roundScopedUiKeyRef.current = "";
      return;
    }
    if (roundScopedUiKeyRef.current && roundScopedUiKeyRef.current !== roundScopedUiKey) {
      // A student can spend the result/preparation pause with a suspended tab.
      // Clear answer locks and stale feedback before the next round's question
      // fetch so touch menus do not reopen in a dead state after iPad resume.
      resetRoundScopedStudentUi();
    }
    roundScopedUiKeyRef.current = roundScopedUiKey;
  }, [roundScopedUiKey, resetRoundScopedStudentUi]);

  const isCompactViewport = viewportWidth <= 780;
  const sessionCode = session?.sessionCode;
  const sessionId = session?.id;
  const sessionCurrentRound = session?.currentRound;
  const sessionStatus = session?.status;
  const sessionDeadPlayersCanPractice = session?.settings.deadPlayersCanPractice;
  const sessionGameMode = session?.settings.gameMode;
  const playerId = player?.id;
  const playerIsAlive = player?.isAlive;
  const athleticsRecoveryActive = athleticsRace && player?.athletics?.recoveryActive === true;
  const athleticsZeusFrozen = athleticsMode === "zeus" && player?.athletics?.zeusFrozen === true;
  const hasPlayer = Boolean(player);
  const hasSession = Boolean(session);
  const hasActiveArenaConnection = Boolean(session && player && playerToken);
  const hasQuestion = Boolean(question);
  const questionId = question?.id;
  const hasActiveStudentSession = Boolean(session && player && session.status === "active");
  const teacherPaused = session?.controlState === "teacher_paused";
  const nicknameError = useMemo(() => getNicknameError(nickname), [nickname]);

  useEffect(() => {
    movementSequenceRef.current = 0;
  }, [sessionId, playerId]);

  useEffect(() => {
    athleticsMovementEpochRef.current = player?.athletics?.movementEpoch ?? 0;
  }, [player?.athletics?.movementEpoch, sessionId, playerId]);
  const spectatorCandidates = useMemo(() => {
    const isAthleticsFinished = session?.settings.gameMode === "athletics" && player?.athletics?.status === "finished";
    if (!session || !player || (player.isAlive && !isAthleticsFinished) || (session.settings.gameMode !== "flag" && !isAthleticsFinished)) return [];
    return session.players
      .filter((candidate) => candidate.id !== player.id
        && candidate.connectionState !== "disconnected"
        && (session.settings.gameMode === "flag" ? candidate.isAlive : candidate.athletics?.status === "racing"))
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
        const rememberedAppearance = consumeStoredAppearanceForSession(data.session.sessionCode, data.player.id)
          && data.session.settings.characterCustomization.persistAcrossSessions
          ? readStoredAppearance()
          : null;
        if (rememberedAppearance && data.session.settings.characterCustomization.enabled) {
          void studentApi.saveAppearance(
            data.session.sessionCode,
            data.player.id,
            stored.playerToken,
            rememberedAppearance
          ).then((saved) => {
            if (cancelled) return;
            const result = saved as { session: GameSession; player: PlayerSession };
            setPlayer((current) => current?.id === result.player.id
              ? { ...current, appearance: result.player.appearance }
              : current);
            setSession((current) => current
              ? {
                  ...current,
                  players: current.players.map((candidate) => candidate.id === result.player.id
                    ? { ...candidate, appearance: result.player.appearance }
                    : candidate)
                }
              : result.session);
          }).catch(() => undefined);
        }
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

  useEffect(() => () => {
    if (answerFeedbackTimerRef.current !== undefined) window.clearTimeout(answerFeedbackTimerRef.current);
    answerSubmissionLockRef.current = false;
  }, []);

  useEffect(() => {
    if (!sessionCode || !playerId || !playerToken || sessionStatus !== "ended") return;
    const requestKey = `${sessionId ?? sessionCode}:${playerId}`;
    if (learningReportRequestKeyRef.current === requestKey) return;
    learningReportRequestKeyRef.current = requestKey;
    let cancelled = false;
    setIsLearningReportLoading(true);
    setLearningReportError("");
    void studentApi.learningReport(sessionCode, playerId, playerToken)
      .then((payload) => {
        if (cancelled) return;
        const data = payload as { learningReport?: StudentLearningReport };
        setLearningReport(data.learningReport ?? null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLearningReportError(error instanceof Error ? error.message : "The learning report could not be loaded yet.");
      })
      .finally(() => {
        if (!cancelled) setIsLearningReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, playerToken, sessionCode, sessionId, sessionStatus]);

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
    if (!athleticsRace || !hasSession || sessionStatus !== "active" || athleticsStartRemainingSeconds <= 0) {
      lastAthleticsCountdownCueRef.current = "";
      return;
    }
    const cueKey = `${sessionCurrentRound}:${athleticsStartRemainingSeconds}`;
    if (athleticsStartRemainingSeconds <= 3 && lastAthleticsCountdownCueRef.current !== cueKey) {
      lastAthleticsCountdownCueRef.current = cueKey;
      gameAudio.playEvent("athletics_countdown");
    }
  }, [athleticsRace, athleticsStartRemainingSeconds, hasSession, sessionCurrentRound, sessionStatus]);

  useEffect(() => {
    if (quizOpen && questionId) gameAudio.playEvent("quiz_timer_start");
  }, [questionId, quizOpen]);

  useEffect(() => {
    if (!sessionCode || !playerId || !playerToken || hasQuestion) return;
    const questionPhase = sessionStatus === "waiting" || sessionStatus === "active" || roundPreparation || zombieSelection;
    if (!questionPhase || (!playerIsAlive && !sessionDeadPlayersCanPractice && !athleticsRecoveryActive && !athleticsZeusFrozen)) return;

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
  }, [sessionCode, sessionStatus, session?.roundTransition?.phase, roundPreparation, zombieSelection, playerId, playerIsAlive, playerToken, sessionDeadPlayersCanPractice, athleticsRecoveryActive, athleticsZeusFrozen, hasQuestion]);

  useEffect(() => {
    if (!athleticsZeusFrozen || quizOpen || !question) return;
    setBuyOpen(false);
    setScoreboardOpen(false);
    setSettingsOpen(false);
    setQuizOpen(true);
  }, [athleticsZeusFrozen, question, quizOpen, setBuyOpen, setQuizOpen, setScoreboardOpen, setSettingsOpen]);

  useEffect(() => {
    const syncBgm = () => {
      gameAudio.setBgmActive(Boolean(hasActiveStudentSession && !teacherPaused && document.visibilityState === "visible"));
    };
    syncBgm();
    document.addEventListener("visibilitychange", syncBgm);
    return () => {
      document.removeEventListener("visibilitychange", syncBgm);
      gameAudio.setBgmActive(false);
    };
  }, [hasActiveStudentSession, teacherPaused]);

  useEffect(() => {
    const activeSession = currentSessionRef.current;
    const activePlayer = currentPlayerRef.current;
    if (!activeSession || !activePlayer?.id || !playerToken) return;
    const activePlayerId = activePlayer.id;
    const roomJoinPayload = { code: activeSession.sessionCode, playerId: activePlayerId, playerToken };
    let disposed = false;
    let socket: Socket | null = null;
    let positionFlushTimer: number | undefined;
    let modeProjectileTimers: number[] = [];
    let hasConnected = false;
    let removePageRestoreListeners: (() => void) | undefined;
    const setupSocket = async () => {
      const { createMultiplayerSocket } = await import("../../multiplayer/connection");
      if (disposed) return;
      const connectedSocket = createMultiplayerSocket(roomJoinPayload, {
        onProtocolError: (error) => setFeedback(error.message)
      });
      socket = connectedSocket;
      socketRef.current = connectedSocket;
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
    let pageRestoreSyncInFlight = false;
    const reconnectAfterPageRestore = () => {
      if (disposed || removedByTeacher || document.visibilityState === "hidden") return;
      if (!connectedSocket.connected) {
        setIsSocketReconnecting(true);
        connectedSocket.connect();
        return;
      }
      if (pageRestoreSyncInFlight) return;
      pageRestoreSyncInFlight = true;
      void studentApi.session(activeSession.sessionCode, playerToken)
        .then((payload) => {
          if (disposed || removedByTeacher) return;
          const refreshedSession = (payload as { session: GameSession }).session;
          lastVisualSession = refreshedSession;
          setSession(refreshedSession);
          setPlayer((current) => refreshedSession.players.find((item) => item.id === (current?.id ?? activePlayerId)) ?? current);
          setIsSocketReconnecting(false);
        })
        .catch(() => {
          if (disposed || removedByTeacher) return;
          setIsSocketReconnecting(true);
          if (connectedSocket.connected) connectedSocket.disconnect();
          connectedSocket.connect();
        })
        .finally(() => {
          pageRestoreSyncInFlight = false;
        });
    };
    window.addEventListener("pageshow", reconnectAfterPageRestore);
    document.addEventListener("visibilitychange", reconnectAfterPageRestore);
    removePageRestoreListeners = () => {
      window.removeEventListener("pageshow", reconnectAfterPageRestore);
      document.removeEventListener("visibilitychange", reconnectAfterPageRestore);
    };
    const emitPlayerVfx = (kind: ArenaVfxKind, playerId = activePlayerId, source = lastVisualSession) => {
      const target = source.players.find((candidate) => candidate.id === playerId);
      emitArenaVfx({ kind, x: target?.x ?? 0, y: target?.y, z: target?.z ?? 0, playerId, team: target?.team, local: playerId === activePlayerId });
    };
    const emitPlayerAnimation = (kind: ArenaAnimationCue, playerId?: string, team?: Team) => {
      emitArenaAnimation({ kind, playerId, team });
    };
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
    connectedSocket.on("connect", () => {
      if (hasConnected) {
        // A timed-out acknowledgement may still have advanced the server's
        // question gate. Drop stale local feedback/question state so the
        // existing question-fetch effect requests a fresh assignment.
        if (answerFeedbackTimerRef.current !== undefined) {
          window.clearTimeout(answerFeedbackTimerRef.current);
          answerFeedbackTimerRef.current = undefined;
        }
        answerSubmissionLockRef.current = false;
        answerOperationRef.current += 1;
        purchaseOperationRef.current += 1;
        purchaseLockRef.current = false;
        setAnsweringChoice(null);
        setAnswerFeedback(null);
        setQuestion(null);
        setBuyingGearId(null);
        setIsBuyingSnowballs(false);
      }
      hasConnected = true;
      setIsSocketReconnecting(false);
    });
    connectedSocket.on("connect_error", () => setIsSocketReconnecting(true));
    connectedSocket.on("disconnect", () => {
      if (!removedByTeacher) setIsSocketReconnecting(true);
    });
    connectedSocket.on("athletics_checkpoint", (payload: {
      checkpointIndex?: number;
      questionIndex?: number;
      question?: PublicQuestion;
      message?: string;
    }) => {
      if (lastVisualSession.settings.gameMode !== "athletics") return;
      if (payload.question) setQuestion(payload.question);
      setAnswerFeedback(null);
      setBuyOpen(false);
      setScoreboardOpen(false);
      setSettingsOpen(false);
      gameAudio.playEvent("athletics_checkpoint");
      setFeedback(payload.message ?? "Checkpoint reached. Answer anytime to refill movement energy.");
    });
    connectedSocket.on("athletics_respawn", (payload: {
      falls?: number;
      checkpointIndex?: number;
      position?: { x?: number; y?: number; z?: number; facing?: number };
      delayMs?: number;
      penaltyUntil?: string;
    }) => {
      if (lastVisualSession.settings.gameMode !== "athletics") return;
      gameAudio.playEvent("athletics_fall");
      setFeedback(`Back to checkpoint ${payload.checkpointIndex ?? 0}. Keep your line and try again.`);
      const position = payload.position;
      if (position && Number.isFinite(position.x) && Number.isFinite(position.z)) {
        setPlayer((current) => current ? {
          ...current,
          x: position.x,
          y: position.y,
          z: position.z,
          facing: position.facing ?? current.facing,
          athletics: current.athletics
            ? { ...current.athletics, falls: payload.falls ?? current.athletics.falls, checkpointIndex: payload.checkpointIndex ?? current.athletics.checkpointIndex, routeProgress: current.athletics.routeProgress, respawnPenaltyUntil: payload.penaltyUntil }
            : current.athletics
        } : current);
      }
    });
    connectedSocket.on("athletics_recovery_start", (payload: {
      falls?: number;
      checkpointIndex?: number;
      recoveryCorrectAnswers?: number;
      recoveryRequiredAnswers?: number;
      recoverySurfaceId?: string;
      recoveryReason?: AthleticsRecoveryReason;
      movementEpoch?: number;
      question?: PublicQuestion;
      message?: string;
    }) => {
      if (lastVisualSession.settings.gameMode !== "athletics") return;
      if (payload.movementEpoch !== undefined) athleticsMovementEpochRef.current = payload.movementEpoch;
      setQuestion(payload.question ?? null);
      setAnswerFeedback(null);
      setBuyOpen(false);
      setScoreboardOpen(false);
      setSettingsOpen(false);
      setQuizOpen(true);
      setFeedback(payload.message ?? "You fell! Answer 3 questions to get back on the course.");
      gameAudio.playEvent("athletics_fall");
      setPlayer((current) => current?.athletics ? {
        ...current,
        isAlive: false,
        health: 0,
        athletics: {
          ...current.athletics,
          falls: payload.falls ?? current.athletics.falls,
          checkpointIndex: payload.checkpointIndex ?? current.athletics.checkpointIndex,
          recoveryActive: true,
          recoveryCorrectAnswers: payload.recoveryCorrectAnswers ?? 0,
          recoveryRequiredAnswers: payload.recoveryRequiredAnswers ?? 3,
          recoverySurfaceId: payload.recoverySurfaceId ?? current.athletics.recoverySurfaceId,
          recoveryReason: payload.recoveryReason ?? current.athletics.recoveryReason,
          movementEpoch: payload.movementEpoch ?? current.athletics.movementEpoch
        }
      } : current);
    });
    connectedSocket.on("athletics_recovery_complete", (payload: {
      position?: { x?: number; y?: number; z?: number; facing?: number };
      checkpointIndex?: number;
      currentSupportedSurfaceIndex?: number;
      routeProgress?: number;
      energy?: number;
      recoveryReason?: AthleticsRecoveryReason;
      movementEpoch?: number;
      question?: PublicQuestion;
      message?: string;
    }) => {
      if (lastVisualSession.settings.gameMode !== "athletics") return;
      if (payload.movementEpoch !== undefined) athleticsMovementEpochRef.current = payload.movementEpoch;
      if (payload.question) setQuestion(payload.question);
      setFeedback(payload.message ?? "Recovery complete! Back to the course.");
      gameAudio.playEvent("athletics_checkpoint");
      const position = payload.position;
      setPlayer((current) => current?.athletics ? {
        ...current,
        ...(position ?? {}),
        isAlive: true,
        health: 100,
        energy: payload.energy ?? current.energy,
        jumping: false,
        crouching: false,
        athletics: {
          ...current.athletics,
          checkpointIndex: payload.checkpointIndex ?? current.athletics.checkpointIndex,
          currentSupportedSurfaceIndex: payload.currentSupportedSurfaceIndex ?? current.athletics.currentSupportedSurfaceIndex,
          currentSupportKind: "main_surface",
          routeProgress: Math.min(current.athletics.routeProgress, payload.routeProgress ?? current.athletics.routeProgress),
          recoveryReason: payload.recoveryReason ?? current.athletics.recoveryReason,
          movementEpoch: payload.movementEpoch ?? current.athletics.movementEpoch,
          recoveryActive: false,
          recoveryCorrectAnswers: 0,
          recoveryRequiredAnswers: 3,
          recoverySurfaceId: undefined,
          recoveryRouteProgress: undefined
        }
      } : current);
    });
    connectedSocket.on("athletics_lap_complete", (payload: {
      completedLaps?: number;
      requiredLaps?: number;
      position?: { x?: number; y?: number; z?: number; facing?: number };
      movementEpoch?: number;
      transitionUntil?: string;
    }) => {
      if (lastVisualSession.settings.gameMode !== "athletics") return;
      if (payload.movementEpoch !== undefined) athleticsMovementEpochRef.current = payload.movementEpoch;
      setQuestion(null);
      setQuizOpen(false);
      const completedLaps = payload.completedLaps ?? 0;
      const requiredLaps = payload.requiredLaps ?? lastVisualSession.athletics?.requiredLaps ?? 1;
      setRewardPulse(`Lap ${completedLaps} complete`);
      setFeedback(`${Math.max(0, requiredLaps - completedLaps)} ${requiredLaps - completedLaps === 1 ? "lap" : "laps"} to go.`);
      gameAudio.playEvent("athletics_checkpoint");
      setPlayer((current) => current ? {
        ...current,
        ...(payload.position ?? {}),
        jumping: false,
        crouching: false,
        athletics: current.athletics ? {
          ...current.athletics,
          completedLaps,
          checkpointIndex: 0,
          lastSafeCheckpointIndex: 0,
          currentSupportedSurfaceIndex: 0,
          currentSupportKind: "main_surface",
          movementEpoch: payload.movementEpoch ?? current.athletics.movementEpoch,
          routeProgress: 0,
          gateOpen: true,
          lapTransitionUntil: payload.transitionUntil
        } : current.athletics
      } : current);
    });
    connectedSocket.on("athletics_lap_start", (payload: { question?: PublicQuestion }) => {
      if (lastVisualSession.settings.gameMode !== "athletics") return;
      setPlayer((current) => current?.athletics ? { ...current, athletics: { ...current.athletics, lapTransitionUntil: undefined } } : current);
      if (payload.question) setQuestion(payload.question);
      setAnswerFeedback(null);
      setFeedback("New lap ready. Answer anytime to refill movement energy.");
    });
    connectedSocket.on("athletics_finish", (payload: { finishPosition?: number; finishTimeMs?: number }) => {
      if (lastVisualSession.settings.gameMode !== "athletics") return;
      setQuestion(null);
      setQuizOpen(false);
      setBuyOpen(false);
      setScoreboardOpen(false);
      setRewardPulse(`Finished #${payload.finishPosition ?? "—"}`);
      setFeedback(`Finish line crossed in ${formatDuration((payload.finishTimeMs ?? 0) / 1000)}.`);
      gameAudio.playEvent("athletics_finish");
    });
    connectedSocket.on("zeus_warning", (payload: {
      attackId?: string;
      tier?: string;
      targetIds?: string[];
      warningPositions?: Record<string, { x: number; y: number; z: number }>;
      strikeAt?: string;
    }) => {
      if (lastVisualSession.settings.gameMode !== "athletics" || athleticsModeForSession(lastVisualSession) !== "zeus") return;
      if (!payload.attackId || !payload.strikeAt) return;
      const position = payload.warningPositions?.[activePlayerId];
      const targeted = payload.targetIds?.includes(activePlayerId) === true;
      setAthleticsWarning({
        attackId: payload.attackId,
        tier: payload.tier ?? "lower",
        targeted,
        strikeAt: payload.strikeAt,
        ...(position ? { position } : {})
      });
      setFeedback(targeted ? "⚡ Dodge the warning ring! Move before lightning strikes." : "Zeus is charging. Watch the course.");
      gameAudio.playEvent("ui_warning");
      if (position && targeted) {
        emitArenaVfx({ kind: "objective", x: position.x, y: position.y, z: position.z, color: "#b697ff", local: true, intensity: 1.1 });
      }
    });
    connectedSocket.on("zeus_strike", (payload: {
      playerId?: string;
      hit?: boolean;
      position?: { x: number; y: number; z: number };
      frozenUntil?: string;
      question?: PublicQuestion;
      message?: string;
    }) => {
      if (lastVisualSession.settings.gameMode !== "athletics" || athleticsModeForSession(lastVisualSession) !== "zeus") return;
      setAthleticsWarning(null);
      if (payload.playerId !== activePlayerId) return;
      if (payload.hit) {
        if (payload.question) setQuestion(payload.question);
        setQuizOpen(true);
        setBuyOpen(false);
        setScoreboardOpen(false);
        setSettingsOpen(false);
        setFeedback(payload.message ?? "Lightning caught you! Answer correctly to break the freeze.");
        setPlayer((current) => current?.athletics ? {
          ...current,
          isAlive: true,
          athletics: { ...current.athletics, zeusFrozen: true, zeusFrozenUntil: payload.frozenUntil }
        } : current);
        const currentPlayer = currentPlayerRef.current;
        emitArenaVfx({ kind: "player_hit", x: payload.position?.x ?? currentPlayer?.x ?? 0, y: payload.position?.y ?? currentPlayer?.y, z: payload.position?.z ?? currentPlayer?.z ?? 0, color: "#b697ff", local: true, intensity: 1.25 });
        gameAudio.playEvent("ui_warning");
      } else {
        setFeedback(payload.message ?? "You dodged Zeus's lightning!");
        gameAudio.playEvent("athletics_checkpoint");
      }
    });
    connectedSocket.on("zeus_freeze_extended", (payload: { playerId?: string; frozenUntil?: string; message?: string }) => {
      if (lastVisualSession.settings.gameMode !== "athletics" || payload.playerId !== activePlayerId) return;
      setFeedback(payload.message ?? "The lightning charge lasts longer.");
      setPlayer((current) => current?.athletics ? {
        ...current,
        athletics: { ...current.athletics, zeusFrozen: true, zeusFrozenUntil: payload.frozenUntil }
      } : current);
      gameAudio.playEvent("ui_warning");
    });
    connectedSocket.on("zeus_freeze_break", (payload: { playerId?: string; automatic?: boolean; message?: string }) => {
      if (lastVisualSession.settings.gameMode !== "athletics" || payload.playerId !== activePlayerId) return;
      setPlayer((current) => current?.athletics ? {
        ...current,
        athletics: { ...current.athletics, zeusFrozen: false, zeusFrozenUntil: undefined }
      } : current);
      if (payload.automatic) setQuizOpen(false);
      setFeedback(payload.message ?? "Lightning freeze broken. Keep climbing.");
      gameAudio.playEvent("athletics_checkpoint");
    });
    connectedSocket.on("zeus_defeated", (payload: { winnerId?: string; message?: string }) => {
      if (lastVisualSession.settings.gameMode !== "athletics" || athleticsModeForSession(lastVisualSession) !== "zeus") return;
      setAthleticsWarning(null);
      setFeedback(payload.message ?? "ZEUS HAS BEEN DEFEATED!");
      emitPlayerVfx("victory", payload.winnerId ?? activePlayerId);
      gameAudio.playEvent("athletics_finish");
    });
    connectedSocket.on("athletics_projectile", (payload: {
      projectileId?: string;
      hunterId?: string;
      targetId?: string;
      origin?: { x: number; y: number; z: number };
      targetAtLaunch?: { x: number; y: number; z: number };
      travelMs?: number;
    }) => {
      if (lastVisualSession.settings.gameMode !== "athletics" || athleticsModeForSession(lastVisualSession) !== "hunters-runners") return;
      if (!payload.origin || !payload.targetAtLaunch) return;
      const travelMs = Math.max(180, Math.min(1_500, payload.travelMs ?? 520));
      const steps = 5;
      for (let step = 0; step <= steps; step += 1) {
        const delay = Math.round((travelMs * step) / steps);
        const timer = window.setTimeout(() => {
          modeProjectileTimers = modeProjectileTimers.filter((item) => item !== timer);
          const amount = step / steps;
          emitArenaVfx({
            kind: "tracer",
            x: payload.origin!.x + (payload.targetAtLaunch!.x - payload.origin!.x) * amount,
            y: payload.origin!.y + (payload.targetAtLaunch!.y - payload.origin!.y) * amount,
            z: payload.origin!.z + (payload.targetAtLaunch!.z - payload.origin!.z) * amount,
            color: "#ff9c54",
            playerId: payload.hunterId,
            local: payload.targetId === activePlayerId
          });
        }, delay);
        modeProjectileTimers.push(timer);
      }
      if (payload.hunterId === activePlayerId) gameAudio.playEvent("weapon_fire_basic");
      if (payload.targetId === activePlayerId) setFeedback("Foam ball incoming — keep moving!");
    });
    connectedSocket.on("athletics_projectile_impact", (payload: {
      projectileId?: string;
      hunterId?: string;
      targetId?: string;
      x?: number;
      y?: number;
      z?: number;
      shielded?: boolean;
      knockback?: number;
    }) => {
      if (lastVisualSession.settings.gameMode !== "athletics" || athleticsModeForSession(lastVisualSession) !== "hunters-runners") return;
      if (!Number.isFinite(payload.x) || !Number.isFinite(payload.z)) return;
      const target = lastVisualSession.players.find((candidate) => candidate.id === payload.targetId);
      emitArenaVfx({ kind: "snowball_impact", x: payload.x!, y: payload.y, z: payload.z!, color: "#ff9c54", playerId: payload.targetId, local: payload.targetId === activePlayerId, intensity: 0.86 });
      if (payload.shielded) emitArenaVfx({ kind: "shield", x: payload.x!, y: payload.y, z: payload.z!, color: "#40d9ff", playerId: payload.targetId, local: payload.targetId === activePlayerId });
      else emitArenaVfx({ kind: "player_hit", x: payload.x!, y: payload.y, z: payload.z!, color: "#ff9c54", playerId: payload.targetId, local: payload.targetId === activePlayerId });
      emitPlayerAnimation("hit", payload.targetId, target?.team);
      if (payload.targetId === activePlayerId) {
        setFeedback(payload.shielded ? "Shield absorbed the foam hit." : `Foam hit — staggered${payload.knockback ? ` and pushed ${payload.knockback.toFixed(1)}m` : ""}.`);
        if (payload.shielded) gameAudio.playEvent("shield_impact");
        else gameAudio.play("player_tagged");
      }
    });
    connectedSocket.on("athletics_ability", (payload: { playerId?: string; ability?: AthleticsAbility; nextAbility?: AthleticsAbility; charge?: number; shieldCharges?: number }) => {
      if (lastVisualSession.settings.gameMode !== "athletics" || payload.playerId !== activePlayerId) return;
      if (payload.ability === "shield") emitPlayerVfx("shield", activePlayerId);
      setRewardPulse(`${getChaosAbilityLabel(payload.ability)} ready`);
      setFeedback(`${getChaosAbilityLabel(payload.ability)} activated. ${payload.nextAbility ? `${getChaosAbilityLabel(payload.nextAbility)} next.` : ""}`);
      gameAudio.playEvent("score_awarded");
    });
    connectedSocket.on("chaos_wave", (payload: { waveIndex?: number; event?: { label?: string } }) => {
      if (lastVisualSession.settings.gameMode !== "athletics" || athleticsModeForSession(lastVisualSession) !== "chaos-climb") return;
      if (payload.event?.label) {
        setFeedback(`CHAOS EVENT: ${payload.event.label}. Watch the path.`);
        gameAudio.playEvent("ui_warning");
      }
    });
    connectedSocket.on("chaos_hazard_impact", (payload: { playerId?: string; x?: number; y?: number; z?: number; shielded?: boolean; hazardType?: string }) => {
      if (lastVisualSession.settings.gameMode !== "athletics" || athleticsModeForSession(lastVisualSession) !== "chaos-climb") return;
      if (!Number.isFinite(payload.x) || !Number.isFinite(payload.z)) return;
      emitArenaVfx({ kind: payload.shielded ? "shield" : "player_hit", x: payload.x!, y: payload.y, z: payload.z!, color: "#ff7fb4", playerId: payload.playerId, local: payload.playerId === activePlayerId, intensity: 0.92 });
      if (payload.playerId === activePlayerId) {
        setFeedback(payload.shielded ? "Shield absorbed the chaos hazard." : `${payload.hazardType ?? "Hazard"} bounced you. Recover your line.`);
        if (payload.shielded) gameAudio.playEvent("shield_impact");
        else gameAudio.play("player_tagged");
      }
    });
    connectedSocket.on("athletics_role_swap", (payload: { modeRound?: number; modeRoundsTotal?: number }) => {
      if (lastVisualSession.settings.gameMode !== "athletics" || athleticsModeForSession(lastVisualSession) !== "hunters-runners") return;
      setAthleticsWarning(null);
      setQuestion(null);
      setQuizOpen(false);
      setFeedback(`Roles swapped — round ${payload.modeRound ?? 2}/${payload.modeRoundsTotal ?? 2} is loading.`);
      gameAudio.playEvent("round_start");
    });
    connectedSocket.on("flag_planted", (payload: unknown) => {
      const parsed = FlagPlantedEventSchema.safeParse(payload);
      if (!parsed.success) return;
      const event: FlagPlantedEvent = parsed.data;
      gameplayAnnouncements.enqueue({
        eventId: event.eventId,
        announcementKey: "FLAG_PLANTED",
        occurredAt: event.plantedAt
      });
    });
    connectedSocket.on("freeze_streak_announcement", (payload: unknown) => {
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
    connectedSocket.on("session_state", (payload: unknown) => {
      const parsed = validateSessionSnapshot(payload);
      if (!parsed.success) {
        setFeedback("The server sent an invalid session update. Reconnecting may help.");
        return;
      }
      const nextSession = parsed.data;
      const previousSession = lastVisualSession;
      const previousLocal = previousSession.players.find((candidate) => candidate.id === activePlayerId);
      const nextLocal = nextSession.players.find((candidate) => candidate.id === activePlayerId);
      if (nextLocal?.athletics?.movementEpoch !== undefined) {
        athleticsMovementEpochRef.current = nextLocal.athletics.movementEpoch;
      }
      if (nextSession.players.length > previousSession.players.length) gameAudio.playEvent("player_join");
      if (nextSession.players.length < previousSession.players.length) gameAudio.playEvent("player_leave");
      if (previousSession.status !== "active" && nextSession.status === "active") {
        if (nextSession.settings.gameMode !== "athletics") gameAudio.playEvent("round_start");
      }
      if (nextSession.settings.gameMode === "athletics"
        && previousSession.athletics?.status !== nextSession.athletics?.status
        && nextSession.athletics?.status === "running") {
        gameAudio.playEvent("athletics_start");
      }
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
    connectedSocket.on("player_state", (payload: { players?: PlayerSession[]; flag?: GameSession["flag"]; recentEvents?: GameSession["events"] }) => {
      if (!Array.isArray(payload.players)) return;
      const ownUpdate = payload.players.find((next) => next.id === activePlayerId);
      if (ownUpdate?.athletics?.movementEpoch !== undefined) {
        athleticsMovementEpochRef.current = ownUpdate.athletics.movementEpoch;
      }
      setSession((current) => current ? {
        ...current,
        players: current.players.map((candidate) => payload.players?.find((next) => next.id === candidate.id) ?? candidate),
        ...(payload.flag ? { flag: payload.flag } : {}),
        ...(payload.recentEvents ? { events: payload.recentEvents } : {})
      } : current);
      setPlayer((current) => current ? payload.players?.find((next) => next.id === current.id) ?? current : current);
    });
    connectedSocket.on("remote_weapon_fire", (payload: { playerId?: string; x?: number; y?: number; z?: number; facing?: number; pitch?: number; gearId?: string }) => {
      if (lastVisualSession.settings.gameMode === "athletics") return;
      if (payload.playerId === activePlayerId || !Number.isFinite(payload.x) || !Number.isFinite(payload.z)) return;
      const attacker = lastVisualSession.players.find((candidate) => candidate.id === payload.playerId);
      emitPlayerAnimation("fire", payload.playerId, attacker?.team);
      emitArenaVfx({
        kind: payload.gearId === "power_blaster" ? "heavy_fire" : payload.gearId === "quick_blaster" ? "quick_fire" : "weapon_fire",
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
    connectedSocket.on("world_impact", (payload: { attackerId?: string; targetId?: string; x?: number; z?: number; shield?: boolean; eliminated?: boolean }) => {
      if (lastVisualSession.settings.gameMode === "athletics") return;
      if (payload.attackerId === activePlayerId || payload.targetId === activePlayerId || !Number.isFinite(payload.x) || !Number.isFinite(payload.z)) return;
      const local = lastVisualSession.players.find((candidate) => candidate.id === activePlayerId);
      if (!local || !Number.isFinite(local.x) || !Number.isFinite(local.z)) return;
      const targetTeam = lastVisualSession.players.find((candidate) => candidate.id === payload.targetId)?.team;
      // This is already an authoritative world-space impact. Do not re-anchor
      // it to the target's current animated model: a moving target may have
      // left the hit location, and an eliminated target has already respawned.
      emitArenaVfx({ kind: "snowball_impact", x: payload.x!, z: payload.z!, team: targetTeam, surface: "snow", intensity: 0.72 });
      emitArenaVfx({ kind: "player_hit", x: payload.x!, z: payload.z!, team: targetTeam, surface: "player", intensity: 0.72 });
      if (payload.shield) emitArenaVfx({ kind: "shield", x: payload.x!, z: payload.z!, team: targetTeam, intensity: 0.66 });
      if (payload.eliminated) {
        emitArenaVfx({ kind: "elimination", x: payload.x!, z: payload.z!, team: targetTeam, intensity: 0.92 });
        emitPlayerAnimation("defeat", payload.targetId, targetTeam);
      }
      gameAudio.playEvent(payload.shield ? "shield_impact" : "world_impact", getCombatAudioSpatial({
        attacker: { x: payload.x!, z: payload.z! },
        target: { x: local.x!, z: local.z!, facing: local.facing ?? 0 }
      }));
    });
    connectedSocket.on("game_event", (event: GameEvent) => {
      if (event.type === "join") gameAudio.playEvent("player_join");
      if (event.type === "start" && lastVisualSession.settings.gameMode !== "athletics") gameAudio.playEvent("round_start");
      if (event.type === "buy" && lastVisualSession.settings.gameMode !== "athletics") gameAudio.playEvent("results_confirm");
      const isLocalAnswerEvent = event.type === "answer" && event.playerId === activePlayerId;
      if (event.type === "answer" && !isLocalAnswerEvent) gameAudio.playEvent("answer_reveal");
      if (event.type === "timer") gameAudio.playEvent("objective_countdown");
      if (!isLocalAnswerEvent && (event.type === "elimination" || event.playerId === activePlayerId || event.targetId === activePlayerId)) {
        setFeedback(event.message);
      }
      if (event.type === "respawn") {
        gameAudio.playEvent("temporary_invulnerability");
        const respawnedId = event.playerId ?? event.targetId;
        emitPlayerVfx("healing", respawnedId);
        emitPlayerAnimation("respawn", respawnedId, event.team);
      }
      if (event.type === "elimination" && lastVisualSession.settings.gameMode !== "athletics") {
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
    connectedSocket.on("player_position", receivePlayerPosition);
    connectedSocket.on("player_positions", (positions: LivePositionUpdate[]) => {
      if (!Array.isArray(positions)) return;
      positions.forEach(receivePlayerPosition);
    });
    connectedSocket.on("damage_result", (result: DamageResultPayload) => {
      if (lastVisualSession.settings.gameMode === "athletics") return;
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
          humans_cannot_fire: "Humans cannot shoot in Zombie Survival. Answer questions for movement energy and escape.",
          fire_cooldown: "Launcher is cooling down."
        };
        queueFeedbackCue(result.reason === "no_valid_target" ? "warning" : "error");
        setFeedback(messages[result.reason ?? ""] ?? "Snowball launched.");
        return;
      }
      const targetTeam = currentSessionRef.current?.players.find((candidate) => candidate.id === result.targetId)?.team;
      const combatCueIsLocal = result.attackerId === activePlayerId || result.targetId === activePlayerId;
      const impactPlayerId = result.eliminated ? undefined : result.targetId;
      emitArenaVfx({ kind: "snowball_impact", x: result.targetX, z: result.targetZ, playerId: impactPlayerId, team: targetTeam, surface: "snow", local: combatCueIsLocal });
      emitArenaVfx({ kind: "player_hit", x: result.targetX, z: result.targetZ, playerId: impactPlayerId, team: targetTeam, surface: "player", local: combatCueIsLocal });
      emitPlayerAnimation("hit", result.targetId, targetTeam);
      if (!result.eliminated) emitArenaVfx({ kind: "shield", x: result.targetX, z: result.targetZ, playerId: result.targetId, team: targetTeam });
      if (result.eliminated) emitArenaVfx({ kind: "elimination", x: result.targetX, z: result.targetZ, team: targetTeam, local: combatCueIsLocal });
      if (result.attackerId === activePlayerId) {
        setHitConfirmPulse((value) => value + 1);
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
    connectedSocket.on("elimination_update", (event: EliminationPayload) => {
      if (lastVisualSession.settings.gameMode === "athletics") return;
      if (event.attackerId === activePlayerId) setRewardPulse(event.moneyAwarded ? `+${formatRewards(event.moneyAwarded)}` : "Freeze!");
      if (event.targetId === activePlayerId) setRewardPulse("Frozen");
    });
    connectedSocket.on("error_message", (payload: { error?: string }) => {
      queueFeedbackCue("error");
      setFeedback(payload.error ?? "Action failed.");
    });
    connectedSocket.on("player_removed", (payload: { message?: string }) => {
      removedByTeacher = true;
      if (answerFeedbackTimerRef.current !== undefined) {
        window.clearTimeout(answerFeedbackTimerRef.current);
        answerFeedbackTimerRef.current = undefined;
      }
      clearStoredStudentSession();
      setSession(null);
      setPlayer(null);
      setPlayerToken("");
      setQuestion(null);
      setAnswerHistory([]);
      setAnswerFeedback(null);
      setLearningReport(null);
      setLearningReportError("");
      learningReportRequestKeyRef.current = "";
      setQuizOpen(false);
      setBuyOpen(false);
      setScoreboardOpen(false);
      setSettingsOpen(false);
      setAnsweringChoice(null);
      answerSubmissionLockRef.current = false;
      answerOperationRef.current += 1;
      purchaseOperationRef.current += 1;
      purchaseLockRef.current = false;
      setBuyingGearId(null);
      setIsBuyingSnowballs(false);
      setFeedback("");
      setIsSocketReconnecting(false);
      setStatusError(payload.message ?? "The host removed you from this game.");
      connectedSocket.disconnect();
    });

    };
    void setupSocket();
    return () => {
      disposed = true;
      removePageRestoreListeners?.();
      if (positionFlushTimer !== undefined) window.clearTimeout(positionFlushTimer);
      modeProjectileTimers.forEach((timer) => window.clearTimeout(timer));
      modeProjectileTimers = [];
      setIsSocketReconnecting(false);
      if (socketRef.current === socket) socketRef.current = null;
      socket?.disconnect();
    };
  }, [sessionCode, playerId, playerToken, openRespawnPractice, setAnsweringChoice, setBuyingGearId, setBuyOpen, setFeedback, setIncomingHitCue, setIsBuyingSnowballs, setIsSocketReconnecting, setQuizOpen, setRewardPulse, setScoreboardOpen, setSettingsOpen, setStatusError]);

  useEffect(() => {
    if (!sessionCode || !playerId || !playerToken || sessionStatus !== "waiting") return;
    const activePlayerId = playerId;
    let cancelled = false;

    const syncWaitingRoom = async () => {
      try {
        const payload = (await studentApi.session(sessionCode, playerToken)) as { session: GameSession };
        if (cancelled) return;
        setSession(payload.session);
        setPlayer((current) => payload.session.players.find((item) => item.id === (current?.id ?? activePlayerId)) ?? current);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          clearStoredStudentSession();
          setJoinCode(sessionCode);
          setSession(null);
          setPlayer(null);
          setPlayerToken("");
          setQuestion(null);
          setIsSocketReconnecting(false);
          setStatusError("This local room expired when the game server restarted. Ask the host to create a new room, then join with its new code.");
        }
        // The socket remains the primary transport; the next poll retries transient failures.
      }
    };

    void syncWaitingRoom();
    const interval = window.setInterval(() => void syncWaitingRoom(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionCode, sessionStatus, playerId, playerToken, setIsSocketReconnecting, setStatusError]);

  // Warm the arena while the student is in the waiting room so game entry does
  // not pay the Three.js download cost after the host starts the round.
  useEffect(() => {
    if (!sessionCode || !playerToken || sessionStatus !== "waiting") return;
      void import("../../../game/ArenaPreview");
  }, [sessionCode, playerToken, sessionStatus]);

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
  const gameplayInputPaused = quizOpen || buyOpen || settingsOpen || isSocketReconnecting || teacherPaused;

  useEffect(() => {
    if (!teacherPaused) return;
    setQuizOpen(false);
    setBuyOpen(false);
    setScoreboardOpen(false);
    setSettingsOpen(false);
  }, [teacherPaused, setBuyOpen, setQuizOpen, setScoreboardOpen, setSettingsOpen]);

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

  useEffect(() => {
    if (!athleticsRecoveryActive) return;
    setQuizOpen(true);
    setBuyOpen(false);
    setScoreboardOpen(false);
    setSettingsOpen(false);
    if (document.pointerLockElement) document.exitPointerLock();
  }, [athleticsRecoveryActive, setBuyOpen, setQuizOpen, setScoreboardOpen, setSettingsOpen]);

  const sendArenaPosition = useCallback(
    (position: ArenaPositionPayload) => {
      if (!hasActiveArenaConnection) return;
      movementSequenceRef.current += 1;
      socketRef.current?.volatile.emit("player_position", {
        ...position,
        movementSequence: movementSequenceRef.current,
        movementEpoch: athleticsMovementEpochRef.current
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

  const join = async (event: FormEvent) => {
    event.preventDefault();
    if (isJoining) return;
    warmFeedbackCue();
    status.clear();
    setFeedback("");
    const validation = validateStudentJoin(joinCode, nickname);
    if (validation.error) {
      status.setError(validation.error);
      return;
    }
    setIsJoining(true);
    try {
      const payload = (await studentApi.join(
        validation.code,
        validation.nickname,
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
      if (answerFeedbackTimerRef.current !== undefined) {
        window.clearTimeout(answerFeedbackTimerRef.current);
        answerFeedbackTimerRef.current = undefined;
      }
      setAnswerHistory([]);
      setAnswerFeedback(null);
      setLearningReport(null);
      setLearningReportError("");
      learningReportRequestKeyRef.current = "";
      setQuizOpen(false);
      setBuyOpen(false);
      setScoreboardOpen(false);
      setSettingsOpen(false);
      setAnsweringChoice(null);
      answerSubmissionLockRef.current = false;
      storeCosmeticProgressToken(payload.cosmeticProgressToken);
      storeStudentSession({
        sessionCode: payload.session.sessionCode,
        playerId: payload.player.id,
        playerToken: payload.playerToken
      } satisfies StoredStudentSession);
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
          setPlayer((current) => current?.id === result.player.id
            ? { ...current, appearance: result.player.appearance }
            : current);
          setSession((current) => current
            ? {
                ...current,
                players: current.players.map((candidate) => candidate.id === result.player.id
                  ? { ...candidate, appearance: result.player.appearance }
                  : candidate)
              }
            : result.session);
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
    setAthleticsWarning(null);
    if (answerFeedbackTimerRef.current !== undefined) {
      window.clearTimeout(answerFeedbackTimerRef.current);
      answerFeedbackTimerRef.current = undefined;
    }
    setAnswerHistory([]);
    setAnswerFeedback(null);
    setLearningReport(null);
    setLearningReportError("");
    learningReportRequestKeyRef.current = "";
    setQuizOpen(false);
    setBuyOpen(false);
    setScoreboardOpen(false);
    setSettingsOpen(false);
    setAnsweringChoice(null);
    answerSubmissionLockRef.current = false;
    answerOperationRef.current += 1;
    purchaseOperationRef.current += 1;
    purchaseLockRef.current = false;
    setBuyingGearId(null);
    setIsBuyingSnowballs(false);
    setFeedback("");
    status.clear();
  };

  const openAthleticsQuestion = useCallback(() => {
    if (!athleticsRace || teacherPaused || !session || !player || !playerToken) return;
    if (player.athletics?.recoveryActive) {
      if (!quizOpen) {
        setBuyOpen(false);
        setScoreboardOpen(false);
        setSettingsOpen(false);
        setQuizOpen(true);
      }
      return;
    }
    if (player.athletics?.zeusFrozen) {
      if (!quizOpen) {
        setBuyOpen(false);
        setScoreboardOpen(false);
        setSettingsOpen(false);
        setQuizOpen(true);
        gameAudio.playEvent("quiz_open");
      }
      return;
    }
    if (quizOpen) {
      gameAudio.playEvent("modal_close");
      setQuizOpen(false);
      return;
    }
    if (player.athletics?.status !== "racing") return;
    if (player.jumping) {
      setFeedback("Land on a platform before opening a question.");
      return;
    }
    setBuyOpen(false);
    setScoreboardOpen(false);
    setSettingsOpen(false);
    setQuizOpen(true);
    gameAudio.playEvent("quiz_open");
    if (question || questionFetchInFlightRef.current) return;
    questionFetchInFlightRef.current = true;
    void studentApi.question(session.sessionCode, player.id, playerToken)
      .then((payload) => {
        const data = payload as { question?: PublicQuestion };
        setQuestion(data.question ?? null);
      })
      .catch((error) => status.report(error))
      .finally(() => {
        questionFetchInFlightRef.current = false;
      });
  }, [
    athleticsRace,
    player,
    playerToken,
    question,
    quizOpen,
    session,
    setBuyOpen,
    setFeedback,
    setQuizOpen,
    setScoreboardOpen,
    setSettingsOpen,
    status,
    teacherPaused
  ]);

  const sendAthleticsAction = useCallback(async (
    action: "fire" | "ability",
    position: ArenaPositionPayload,
    ability?: AthleticsAbility
  ) => {
    if (!athleticsRace || teacherPaused || !session || !player || !playerToken || !socketRef.current?.connected) {
      setFeedback("Reconnect to the room before using that Athletics action.");
      return;
    }
    const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const command = {
      type: "athletics_action" as const,
      requestId,
      action,
      ...(ability ? { ability } : {}),
      x: position.x,
      z: position.z,
      ...(position.y === undefined ? {} : { y: position.y }),
      facing: position.facing,
      ...(position.pitch === undefined ? {} : { pitch: position.pitch })
    };
    try {
      const payload = await sendStudentCommand<{ player: PlayerSession; message: string }>(
        socketRef.current,
        "athletics_action",
        command,
        async () => { throw new Error("The Athletics action requires a live game connection."); }
      );
      setPlayer(payload.player);
      setFeedback(payload.message);
    } catch (error) {
      status.report(error);
    }
  }, [athleticsRace, player, playerToken, session, setFeedback, status, teacherPaused]);

  const answer = async (choice: Choice) => {
    if (teacherPaused || !session || !player || !question || !playerToken || answeringChoice || answerFeedback || answerSubmissionLockRef.current) return;
    const operationId = answerOperationRef.current + 1;
    answerOperationRef.current = operationId;
    answerSubmissionLockRef.current = true;
    const answeredQuestion = question;
    const answeringPlayer = player;
    status.clear();
    setFeedback("");
    setAnsweringChoice(choice);
    gameAudio.playEvent("quiz_select");
    gameAudio.playEvent("quiz_lock");
    try {
      type AnswerPayload = {
        cosmeticProgressToken?: string;
        result: {
          feedback: string;
          explanation?: string;
          isCorrect: boolean;
          correctChoice: Choice;
          moneyAwarded: number;
          rewardLabel?: string;
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
      if (answerOperationRef.current !== operationId) return;
      storeCosmeticProgressToken(payload.cosmeticProgressToken);
      setPlayer(payload.result.player);
      if (payload.result.respawned && answeringPlayer.athletics?.recoveryActive === true) {
        setFeedback("Recovery complete! Back to the course with enough energy to retry.");
      }
      const wasWrong = !payload.result.isCorrect;
      const answeredAt = new Date().toISOString();
      const questionSnapshot = {
        ...answeredQuestion,
        correctChoice: payload.result.correctChoice
      } satisfies StudentPracticeQuestion;
      setAnswerHistory((current) => [...current, {
        id: `${answeredQuestion.id}:${answeredAt}:${current.length}`,
        questionId: answeredQuestion.id,
        quizSetId: session.quizSetId,
        selectedChoice: choice,
        correctChoice: payload.result.correctChoice,
        isCorrect: payload.result.isCorrect,
        answeredAt,
        moneyAwarded: payload.result.moneyAwarded,
        context: answeringPlayer.isAlive ? "main" : "practice",
        question: questionSnapshot
      }]);
      const supportingText = payload.result.feedback
        .replace(/^(Correct!|Incorrect\.)\s*/i, "")
        .trim();
      setAnswerFeedback({
        selectedChoice: choice,
        correctChoice: payload.result.correctChoice,
        isCorrect: payload.result.isCorrect,
        rewardLabel: payload.result.rewardLabel,
        explanation: payload.result.explanation,
        supportingText: payload.result.isCorrect && supportingText && supportingText !== payload.result.rewardLabel
          ? supportingText
          : undefined
      });
      gameAudio.play(wasWrong ? "quiz_wrong" : "quiz_correct");
      gameAudio.playEvent("answer_reveal");
      if (!wasWrong && payload.result.moneyAwarded > 0) gameAudio.playEvent("score_awarded");
      const answerPosition = payload.result.player;
      if (!wasWrong) {
        setCurrencyPulse((value) => value + 1);
        setRewardVfx({
          id: Date.now(),
          amount: payload.result.moneyAwarded > 0 ? payload.result.moneyAwarded : undefined,
          label: payload.result.rewardLabel ?? (payload.result.moneyAwarded > 0 ? `+$${payload.result.moneyAwarded}` : "Correct answer"),
          kind: "correct"
        });
        emitArenaVfx({
          kind: "reward_burst",
          x: answerPosition.x ?? 0,
          y: answerPosition.y,
          z: answerPosition.z ?? 0,
          playerId: answerPosition.id,
          team: answerPosition.team,
          local: true,
          intensity: payload.result.moneyAwarded > 0 ? 1.15 : 0.95,
          amount: payload.result.moneyAwarded
        });
      }
      if (payload.result.respawned) {
        emitArenaVfx({ kind: "healing", x: payload.result.player.x ?? 0, z: payload.result.player.z ?? 0, playerId: payload.result.player.id, team: payload.result.player.team });
        emitArenaVfx({ kind: "spawn", x: payload.result.player.x ?? 0, z: payload.result.player.z ?? 0, playerId: payload.result.player.id, team: payload.result.player.team });
        emitArenaAnimation({ kind: "respawn", playerId: payload.result.player.id, team: payload.result.player.team });
      }
      if (answerFeedbackTimerRef.current !== undefined) window.clearTimeout(answerFeedbackTimerRef.current);
      answerFeedbackTimerRef.current = window.setTimeout(() => {
        if (answerOperationRef.current !== operationId) return;
        answerFeedbackTimerRef.current = undefined;
        answerSubmissionLockRef.current = false;
        setAnswerFeedback(null);
        setQuestion(payload.result.nextQuestion ?? null);
        if (payload.result.respawned) setQuizOpen(false);
      }, getAnswerFeedbackDurationMs({
        isCorrect: payload.result.isCorrect,
        selectedText: answeredQuestion[`choice${choice}`],
        correctText: answeredQuestion[`choice${payload.result.correctChoice}`],
        explanation: payload.result.explanation,
        supportingText
      }));
    } catch (err) {
      if (answerOperationRef.current === operationId) {
        answerSubmissionLockRef.current = false;
        status.report(err);
      }
    } finally {
      if (answerOperationRef.current === operationId) setAnsweringChoice(null);
    }
  };

  useEffect(() => {
    if (!hasSession || sessionStatus !== "ended") return;
    if (answerFeedbackTimerRef.current !== undefined) {
      window.clearTimeout(answerFeedbackTimerRef.current);
      answerFeedbackTimerRef.current = undefined;
    }
    setAnswerFeedback(null);
    setQuizOpen(false);
    setBuyOpen(false);
    setScoreboardOpen(false);
    setSettingsOpen(false);
    setAnsweringChoice(null);
    answerSubmissionLockRef.current = false;
    answerOperationRef.current += 1;
    purchaseOperationRef.current += 1;
    purchaseLockRef.current = false;
    setBuyingGearId(null);
    setIsBuyingSnowballs(false);
    if (document.pointerLockElement) document.exitPointerLock();
  }, [hasSession, sessionId, sessionStatus, setAnsweringChoice, setBuyingGearId, setBuyOpen, setIsBuyingSnowballs, setQuizOpen, setScoreboardOpen, setSettingsOpen]);

  const buy = async (gearId: string) => {
    if (teacherPaused || !session || !player || !playerToken || buyingGearId || isBuyingSnowballs || purchaseLockRef.current) return;
    const operationId = purchaseOperationRef.current + 1;
    purchaseOperationRef.current = operationId;
    purchaseLockRef.current = true;
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
      if (purchaseOperationRef.current !== operationId) return;
      setPlayer(payload.player);
      setFeedback(payload.message);
      setRewardPulse(payload.message);
      setRewardVfx({ id: Date.now(), label: "Purchase ready", kind: "purchase" });
      emitArenaVfx({ kind: "purchase", x: payload.player.x ?? 0, y: payload.player.y, z: payload.player.z ?? 0, playerId: payload.player.id, team: payload.player.team, local: true });
      gameAudio.playEvent(gearId.endsWith("_blaster") ? "weapon_equip" : "results_confirm");
    } catch (err) {
      if (purchaseOperationRef.current === operationId) status.report(err);
    } finally {
      if (purchaseOperationRef.current === operationId) {
        purchaseLockRef.current = false;
        setBuyingGearId(null);
      }
    }
  };

  const buySnowballs = async (packSize: SnowballPackSize) => {
    if (teacherPaused || !session || !player || !playerToken || isBuyingSnowballs || buyingGearId || purchaseLockRef.current) return;
    const operationId = purchaseOperationRef.current + 1;
    purchaseOperationRef.current = operationId;
    purchaseLockRef.current = true;
    status.clear();
    setFeedback("Restocking snowballs...");
    setIsBuyingSnowballs(true);
    try {
      type BuySnowballsPayload = { player: PlayerSession; message: string };
      // Keep the long-standing 10-pack wire shape compatible with servers
      // that were deployed before bulk packs added the optional field. The
      // large pack still opts into the newer command contract explicitly.
      const command = buildSnowballPurchaseCommand(packSize);
      const payload = await sendStudentCommand<BuySnowballsPayload>(
        socketRef.current,
        "buy_snowballs",
        command,
        () => studentApi.buySnowballs(
          session.sessionCode,
          player.id,
          playerToken,
          packSize === "large" ? packSize : undefined
        ) as Promise<BuySnowballsPayload>
      );
      if (purchaseOperationRef.current !== operationId) return;
      setPlayer(payload.player);
      setFeedback(payload.message);
      setRewardPulse(payload.message);
      setRewardVfx({ id: Date.now(), label: "Snowballs restocked", kind: "purchase" });
      emitArenaVfx({ kind: "purchase", x: payload.player.x ?? 0, y: payload.player.y, z: payload.player.z ?? 0, playerId: payload.player.id, team: payload.player.team, local: true });
      gameAudio.play("buy");
    } catch (err) {
      if (purchaseOperationRef.current === operationId) status.report(err);
    } finally {
      if (purchaseOperationRef.current === operationId) {
        purchaseLockRef.current = false;
        setIsBuyingSnowballs(false);
      }
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
        if (athleticsRace) {
          openAthleticsQuestion();
        } else {
          gameAudio.playEvent(quizOpen ? "modal_close" : "quiz_open");
          setQuizOpen((open) => !open);
          setBuyOpen(false);
          setScoreboardOpen(false);
          setSettingsOpen(false);
        }
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
        if (shortcut.item === "snowballs") void buySnowballsActionRef.current("standard");
        else if (shortcut.item === "snowballs_large") void buySnowballsActionRef.current("large");
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
    athleticsRace,
    openAthleticsQuestion,
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
    try {
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
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        clearStoredStudentSession();
        setJoinCode(session.sessionCode);
        setSession(null);
        setPlayer(null);
        setPlayerToken("");
        setQuestion(null);
        setIsSocketReconnecting(false);
        setStatusError("This local room expired when the game server restarted. Ask the host to create a new room, then join with its new code.");
      }
      throw error;
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

  const learningData = useMemo(() => {
    const localAttempts = answerHistory.map(({ question: _question, ...attempt }) => attempt);
    const reportForCurrentPlayer = learningReport
      && learningReport.sessionId === sessionId
      && learningReport.sessionCode === sessionCode
      && learningReport.playerId === playerId
      ? learningReport
      : null;
    const attempts = reportForCurrentPlayer && reportForCurrentPlayer.attempts.length >= localAttempts.length
      ? reportForCurrentPlayer.attempts
      : localAttempts;
    const questionsById = new Map<string, StudentPracticeQuestion>();
    for (const source of reportForCurrentPlayer?.quizSet?.questions ?? []) questionsById.set(source.id, source);
    for (const snapshot of answerHistory) {
      questionsById.set(snapshot.question.id, snapshot.question);
    }
    const questions = [...questionsById.values()];
    const summary = buildStudentLearningSummary(attempts);
    return {
      summary,
      practiceQuestions: buildStudentPracticeQuestions({
        attempts,
        questions,
        maxQuestions: 20,
        seed: `${sessionId ?? "no-session"}:${playerId ?? "no-player"}`
      }),
      worksheetSetName: reportForCurrentPlayer?.quizSet?.title ?? "QuizStrike question set"
    };
  }, [answerHistory, learningReport, playerId, sessionCode, sessionId]);

  if (!session || !player) {
    if (isRestoringStudentSession) {
      return (
        <section className="auth-layout student-join-screen">
          <ArenaLoading label="Restoring your student session" />
        </section>
      );
    }
    return (
      <section className="auth-layout student-join-screen game-join-screen">
        <div className="student-join-help">
          <div className="panel how-to-card controls-card" aria-labelledby="student-controls-heading">
            <div className="controls-card-heading"><h2 id="student-controls-heading">Quick controls</h2><span>Keyboard + touch</span></div>
            <div className="student-controls-grid">
              <div className="student-control"><kbd>WASD</kbd><span>Move at full speed</span></div>
              <div className="student-control"><kbd>Shift</kbd><span>Crouch</span></div>
              <div className="student-control"><kbd>Space</kbd><span>Jump</span></div>
              <div className="student-control"><kbd>Arrow keys / swipe</kbd><span>Look around</span></div>
              <div className="student-control"><kbd>F</kbd><span>Fire</span></div>
              <div className="student-control"><kbd>C</kbd><span>Zoom</span></div>
              <div className="student-control"><kbd>E</kbd><span>Environment button</span></div>
              <div className="student-control"><kbd>Q</kbd><span>Questions</span></div>
              <div className="student-control"><kbd>B / 1-6</kbd><span>Open and choose gear</span></div>
              <div className="student-control"><kbd>Tab</kbd><span>Scoreboard</span></div>
            </div>
          </div>
        </div>
        <form className="panel form-panel student-join-form" onSubmit={join}>
          <div className="game-join-form-heading">
            <span className="auth-kicker">Player join</span>
            <h1>Enter QuizStrike</h1>
            <p>Use the game code from the host, then choose your player name.</p>
          </div>
          {joinCodeFromLink ? (
            <div className="linked-join-code" aria-label={`Join session ${joinCode}`}>
              <span><Link2 size={17} aria-hidden="true" />Game link ready</span>
              <strong>{joinCode}</strong>
              <small>Add your player name below to join.</small>
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
                required
                autoComplete="off"
                autoCapitalize="characters"
                autoFocus
                inputMode="text"
                enterKeyHint="next"
                aria-invalid={Boolean(status.error)}
                aria-describedby={status.error ? "join-error join-code-help" : "join-code-help"}
                placeholder="ABC123"
              />
              <small id="join-code-help">Enter the 6-character code on the host's screen.</small>
            </label>
          )}
          <label className="join-field">
            <span className="join-field-label">Player name</span>
            <input required placeholder="Player name" autoComplete="nickname" autoFocus={Boolean(joinCodeFromLink)} enterKeyHint="done" value={nickname} onChange={(event) => { setNickname(event.target.value); status.clearError(); }} maxLength={20} aria-invalid={Boolean(nicknameError)} aria-describedby={nicknameError ? "nickname-error nickname-help" : "nickname-help"} />
            <small id="nickname-help">Use a name other players will recognize.</small>
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
            {isJoining ? "Joining..." : "Join game"}
          </button>
        </form>
      </section>
    );
  }

  const {
    summary: learningSummary,
    practiceQuestions,
    worksheetSetName
  } = learningData;
  const snowballs = player.snowballs ?? session.settings.startingSnowballs;
  const warmth = getPlayerWarmth(player);
  const athleticsPlayer = player.athletics;
  const athleticsModeConfig = ATHLETICS_MODE_CONFIG[athleticsMode];
  const athleticsQuestionCount = Math.max(1, session.athletics?.questionCount ?? athleticsPlayer?.questionIndex ?? 1);
  const athleticsRequiredLaps = Math.max(1, session.athletics?.requiredLaps ?? session.settings.athleticsCourseLaps ?? 1);
  const athleticsStanding = athleticsStandings.find((standing) => standing.playerId === player.id);
  const athleticsSpectatorStanding = spectatorPlayer
    ? athleticsStandings.find((standing) => standing.playerId === spectatorPlayer.id)
    : undefined;
  const isZombieHuman = session.settings.gameMode === "zombie" && player.role !== "zombie";
  const canFire = canPlayerFireInMode(session.settings.gameMode, player.role);
  const movementEnergy = Math.round(Math.max(0, Math.min(ZOMBIE_HUMAN_MAX_ENERGY, player.energy ?? 0)));
  const athleticsEnergy = Math.round(Math.max(0, Math.min(ATHLETICS_MAX_ENERGY, player.energy ?? 0)));
  const athleticsAbility = athleticsPlayer?.abilityReady;
  const athleticsAbilityCharged = (athleticsPlayer?.abilityCharge ?? 0) >= 3 && Boolean(athleticsAbility);
  const chaosEventLabel = athleticsMode === "chaos-climb" ? session.athletics?.chaos?.currentEvent?.label : undefined;
  const athleticsRemainingRunners = athleticsRace
    ? (session.athletics?.runnerIds ?? session.players.filter((candidate) => candidate.athletics?.role === "runner").map((candidate) => candidate.id))
      .filter((runnerId) => session.players.find((candidate) => candidate.id === runnerId)?.athletics?.status === "racing").length
    : 0;
  const connectedPlayers = session.players.filter((candidate) => candidate.connectionState !== "disconnected");
  const redTeamCount = connectedPlayers.filter((candidate) => candidate.team === "red").length;
  const blueTeamCount = connectedPlayers.filter((candidate) => candidate.team === "blue").length;
  const respawnProgress = player.respawnCorrectAnswers ?? 0;
  const canPracticeToRespawn = !player.isAlive && session.settings.deadPlayersCanPractice && session.settings.gameMode !== "flag" && !athleticsRace;
  const roundActive = session.status === "active" && !teacherPaused;
  const roundEnded = session.status === "ended";
  const menuTitle = athleticsRecoveryActive && quizOpen
    ? "Recover after fall"
    : canPracticeToRespawn && quizOpen
      ? "Practice to return"
      : quizOpen ? "Questions" : buyOpen ? "Choose gear" : settingsOpen ? "Game settings" : "Scoreboard";
  const roundTimeLabel = athleticsRace
    ? formatDuration(athleticsRemainingSeconds)
    : formatDuration(roundPreparation || zombieSelection ? preparationRemainingSeconds : remainingSeconds);
  const roundCountdownClassName = [
    "round-countdown",
    roundActive ? "round-countdown-active" : "",
    roundActive && (athleticsRace ? athleticsRemainingSeconds : remainingSeconds) <= 30 ? "round-countdown-low" : ""
  ].filter(Boolean).join(" ");
  const objectiveText = roundPreparation
    ? "Choose gear or answer questions for rewards before the round starts."
    : zombieSelection
      ? `Everyone is Human. Answer questions for energy; Zombies are chosen in ${preparationRemainingSeconds}s.`
    : athleticsRace
      ? athleticsRecoveryActive
        ? "You fell! Answer 3 questions to get back on the course."
        : athleticsPlayer?.status === "finished"
        ? `Finished in ${formatDuration((athleticsPlayer.finishTimeMs ?? 0) / 1000)}. Watch the remaining racers.`
        : athleticsPlayer?.lapTransitionUntil && Date.now() < Date.parse(athleticsPlayer.lapTransitionUntil)
          ? `Lap ${athleticsPlayer.completedLaps} complete. The next lap is getting ready.`
        : athleticsMode === "zeus" && athleticsZeusFrozen
          ? "Lightning freeze active. Answer correctly to break it."
          : athleticsMode === "zeus" && athleticsWarning?.targeted
            ? `Dodge Zeus's warning ring in ${athleticsWarningRemainingSeconds}s.`
            : athleticsMode === "hunters-runners" && athleticsPlayer?.role === "hunter"
              ? `Answer for foam ammo. Defend your station and tag runners without stopping them.`
              : athleticsMode === "hunters-runners"
                ? `Climb to the summit. ${athleticsRemainingRunners} runner${athleticsRemainingRunners === 1 ? "" : "s"} still racing.`
                : athleticsMode === "chaos-climb"
                  ? "Watch the seeded hazard waves. Answer to charge abilities and keep climbing."
                  : athleticsEnergy <= ATHLETICS_CRITICAL_ENERGY
                    ? "Energy is low. Answer on a platform, then keep climbing."
                    : "Jump from platform to platform. Answer anytime to refill energy."
    : session.settings.gameMode === "flag"
      ? flagStatusText(session)
    : session.settings.gameMode === "zombie"
      ? zombieStatusText(session, player)
      : "Most tags wins. Respawns come next, then answer accuracy breaks ties.";
  const sessionResult = getSessionResultText(session);
  const isFlagSpectator = !player.isAlive && session.settings.gameMode === "flag";
  const isAthleticsSpectator = athleticsRace && athleticsPlayer?.status === "finished" && Boolean(spectatorPlayer);
  const arenaPlayer = isAthleticsSpectator || isFlagSpectator ? spectatorPlayer ?? player : player;
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
  const athleticsHud = athleticsRace && athleticsPlayer ? {
    mode: athleticsMode,
    role: athleticsPlayer.role,
    modeLabel: athleticsModeConfig.shortLabel,
    startRemainingSeconds: athleticsStartRemainingSeconds,
    remainingSeconds: athleticsRemainingSeconds,
    checkpointIndex: athleticsPlayer.checkpointIndex,
    completedLaps: athleticsPlayer.completedLaps ?? 0,
    requiredLaps: athleticsRequiredLaps,
    routeProgress: athleticsPlayer.routeProgress,
    rank: athleticsStanding?.rank ?? athleticsStandings.length,
    totalRacers: Math.max(1, athleticsStandings.length),
    energy: athleticsEnergy,
    maxEnergy: ATHLETICS_MAX_ENERGY,
    criticalEnergy: ATHLETICS_CRITICAL_ENERGY,
    canAnswer: Boolean(playerToken) && !isSocketReconnecting && !teacherPaused,
    status: athleticsPlayer.status,
    recoveryActive: athleticsRecoveryActive,
    recoveryCorrectAnswers: athleticsPlayer.recoveryCorrectAnswers ?? 0,
    recoveryRequiredAnswers: athleticsPlayer.recoveryRequiredAnswers ?? 3,
    hunterAmmo: athleticsPlayer.hunterAmmo ?? 0,
    hunterHits: athleticsPlayer.hunterHits ?? 0,
    abilityCharge: athleticsPlayer.abilityCharge ?? 0,
    abilityMax: 3,
    abilityReady: athleticsAbility,
    shieldCharges: athleticsPlayer.shieldCharges ?? 0,
    zeusFrozen: athleticsZeusFrozen,
    zeusWarningSeconds: athleticsWarning?.targeted ? athleticsWarningRemainingSeconds : 0,
    remainingRunners: athleticsRemainingRunners,
    chaosEventLabel
  } : undefined;
  const athleticsMovementLocked = athleticsRace && (
    athleticsStartRemainingSeconds > 0
    || Boolean(athleticsPlayer?.lapTransitionUntil && Date.now() < Date.parse(athleticsPlayer.lapTransitionUntil))
    || Boolean(athleticsPlayer?.respawnPenaltyUntil && Date.now() < Date.parse(athleticsPlayer.respawnPenaltyUntil))
    || Boolean(athleticsPlayer?.recoveryActive)
    || athleticsZeusFrozen
    || Boolean(athleticsPlayer?.staggerUntil && Date.now() < Date.parse(athleticsPlayer.staggerUntil))
  );

  const activateAthleticsAbility = (ability: AthleticsAbility) => {
    if (!athleticsRace || !athleticsPlayer || !athleticsAbilityCharged || athleticsAbility !== ability) return;
    void sendAthleticsAction("ability", {
      x: player.x ?? 0,
      z: player.z ?? 0,
      y: player.y,
      facing: player.facing ?? 0
    }, ability);
  };

  const downloadWorksheet = async () => {
    if (isDownloadingWorksheet || practiceQuestions.length === 0) return;
    setIsDownloadingWorksheet(true);
    try {
      const { generatePracticeWorksheetPdf } = await import("../../../practiceWorksheet");
      const blob = await generatePracticeWorksheetPdf({
        studentName: player.nickname,
        setName: worksheetSetName,
        summary: learningSummary,
        practiceQuestions
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildPracticeWorksheetFilename(player.nickname);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The practice worksheet could not be created.";
      status.setError(message);
    } finally {
      setIsDownloadingWorksheet(false);
    }
  };

  return (
    <section className={[
      "game-layout",
      isCompactViewport ? "compact-game-layout" : "",
      athleticsRace ? "athletics-game-layout" : "",
      gamePreferences.highContrastHud ? "high-contrast-hud" : "",
      session.status === "waiting" ? "waiting-game-layout" : ""
    ].filter(Boolean).join(" ")}>
      <div className="game-stage">
        {session.status !== "waiting" && !teacherPaused && <GameAnnouncementOverlay announcement={roundPreparation || zombieSelection || roundEnded ? undefined : session.announcement} serverTime={session.serverTime} />}
        <div className={`game-utility-bar${session.status === "waiting" ? " lobby-utility-bar" : ""}`}>
          {session.status === "waiting" ? (
            <div className="lobby-brand">
              <QuizStrikeLogo size="lobby" />
              <small>{athleticsRace && athleticsMode !== "classic" ? athleticsModeConfig.label : gameModeLabel(session.settings.gameMode)} · Room {session.sessionCode}</small>
            </div>
          ) : <span>{athleticsRace && athleticsMode !== "classic" ? athleticsModeConfig.label : gameModeLabel(session.settings.gameMode)}</span>}
          <button type="button" disabled={teacherPaused} onClick={() => { setSettingsOpen(true); setQuizOpen(false); setBuyOpen(false); setScoreboardOpen(false); }}><Settings size={16} aria-hidden="true" />Settings</button>
          <button type="button" onClick={onExit}>Leave game</button>
        </div>
        {session.status === "waiting" ? (
          <div className="arena-waiting-surface" aria-hidden="true" />
        ) : (
          <Suspense fallback={<ArenaLoading />}>
            <ArenaPreview
              key={`${session.id}:${player.id}`}
              session={session}
              currentPlayer={arenaPlayer}
              view="fps"
              suppressHint
              quality={gamePreferences.arenaQuality}
              gamepadEnabled={gamePreferences.gamepadEnabled}
              controlsDisabled={isFlagSpectator || isAthleticsSpectator || athleticsMovementLocked || !roundActive || !player.isAlive}
              inputPaused={gameplayInputPaused}
              hitConfirmPulse={hitConfirmPulse}
              onMove={roundActive && player.isAlive && !isFlagSpectator && !isAthleticsSpectator && !athleticsMovementLocked ? sendArenaPosition : undefined}
              onFire={roundActive && player.isAlive
                ? athleticsRace && athleticsMode === "hunters-runners" && athleticsPlayer?.role === "hunter"
                  ? (position) => { void sendAthleticsAction("fire", position); }
                  : canFire && !athleticsRace
                    ? sendArenaFire
                    : undefined
                : undefined}
              onInteract={session.settings.gameMode === "flag" && roundActive && player.isAlive ? sendFlagAction : undefined}
              onOpenQuestion={athleticsRace ? openAthleticsQuestion : undefined}
              onAbilityFromTouch={athleticsAbility && athleticsAbilityCharged ? () => activateAthleticsAbility(athleticsAbility) : undefined}
              athleticsHud={athleticsHud}
              loadDecalAsset={loadStudentDecal}
            />
          </Suspense>
        )}
        <RewardVfxOverlay cue={rewardVfx} onComplete={() => setRewardVfx(null)} />
        {teacherPaused && <TeacherPauseOverlay />}
        {session.status !== "waiting" && (<>
        <div className={roundCountdownClassName} role="timer" aria-label={`Round time remaining ${roundTimeLabel}`}>
          <Timer size={18} aria-hidden="true" />
          <span>{athleticsRace ? (athleticsStartRemainingSeconds > 0 ? "Get set" : "Race time") : roundPreparation ? "Get ready" : zombieSelection ? "Choose Zombies" : "Time left"}</span>
          <strong>{roundTimeLabel}</strong>
        </div>
        <div className="arena-objective-strip">
          <span className={`status-pill status-${session.status}`}>{athleticsRace && athleticsPlayer?.status === "finished" ? "Finished" : roundPreparation ? "Get ready" : zombieSelection ? "Choosing Zombies" : sessionStatusLabel(session.status)}</span>
          <span className="objective-primary">{objectiveText}</span>
          {session.settings.gameMode === "flag" && session.flag?.state === "placed" && (
            <span className={`flag-objective-countdown${flagRemainingSeconds <= 10 ? " urgent" : ""}`} role="timer" aria-label={`Active flag time remaining ${formatDuration(flagRemainingSeconds)}`}>
              <Timer size={14} aria-hidden="true" />
              <strong>{formatDuration(flagRemainingSeconds)}</strong>
            </span>
          )}
          <span className={`mode-pill mode-${session.settings.gameMode}`}>
            {athleticsRace && athleticsMode !== "classic" ? athleticsModeConfig.shortLabel : gameModeLabel(session.settings.gameMode)}
            {session.settings.gameMode === "flag" ? ` · Round ${session.currentRound}/${session.settings.roundCount}` : ""}
          </span>
        </div>
        {athleticsRace && athleticsMode !== "classic" && !isAthleticsSpectator && !isFlagSpectator && (
          <div className={`athletics-mode-action-bar athletics-mode-${athleticsMode}`} aria-label={`${athleticsModeConfig.label} controls`}>
            <div className="athletics-mode-action-copy">
              <span className="eyebrow">{athleticsModeConfig.instructionTitle}</span>
              <strong>{athleticsPlayer?.role === "hunter" ? "Defend the station" : athleticsModeConfig.label}</strong>
              <small>{athleticsPlayer?.role === "hunter" ? `${athleticsPlayer.hunterAmmo ?? 0} foam ammo · ${athleticsPlayer.hunterHits ?? 0} hits` : `${athleticsPlayer?.abilityCharge ?? 0}/3 ability charge`}</small>
            </div>
            {athleticsPlayer?.role !== "hunter" && athleticsAbility && (
              <button
                type="button"
                className="athletics-ability-button"
                disabled={!roundActive || !athleticsAbilityCharged || athleticsZeusFrozen}
                onClick={() => activateAthleticsAbility(athleticsAbility)}
              >
                <Zap size={16} aria-hidden="true" />
                {getChaosAbilityLabel(athleticsAbility)}
              </button>
            )}
            {athleticsMode === "zeus" && athleticsWarning?.targeted && (
              <span className="athletics-warning-chip" role="status">⚡ STRIKE IN {athleticsWarningRemainingSeconds}s</span>
            )}
            {athleticsMode === "chaos-climb" && chaosEventLabel && (
              <span className="athletics-warning-chip athletics-chaos-event-chip" role="status">💥 {chaosEventLabel}</span>
            )}
          </div>
        )}
        {isFlagSpectator || isAthleticsSpectator ? (
          <section className="spectator-dock" aria-label="Spectator controls" data-testid="spectator-dock">
            <div className="spectator-state">
              <span className="spectator-state-icon">{isAthleticsSpectator ? <Trophy size={20} aria-hidden="true" /> : <Snowflake size={20} aria-hidden="true" />}</span>
              <span>
                <small>{isAthleticsSpectator ? "Finished the course" : "Frozen for this round"}</small>
                <strong>{isAthleticsSpectator ? "Watch the live racers" : "Back in the next round"}</strong>
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
                  isAthleticsSpectator
                    ? <span className="spectator-team spectator-team-athletics">{athleticsSpectatorStanding ? `Lap ${Math.min(athleticsRequiredLaps, athleticsSpectatorStanding.completedLaps + 1)}/${athleticsRequiredLaps} · ${Math.round(athleticsSpectatorStanding.routeProgress * 100)}%` : "Racing"}</span>
                    : <span className={`spectator-team spectator-team-${spectatorPlayer.team}`}>
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
            {isAthleticsSpectator && spectatorPlayer ? (
              <div className="spectator-player-stats athletics-spectator-stats" aria-label={`${spectatorPlayer.nickname} race status`}>
                <span>
                  <Footprints size={16} aria-hidden="true" />
                  <span><small>Lap</small><strong>{Math.min(athleticsRequiredLaps, (athleticsSpectatorStanding?.completedLaps ?? spectatorPlayer.athletics?.completedLaps ?? 0) + 1)}/{athleticsRequiredLaps}</strong></span>
                </span>
                <span>
                  <Target size={16} aria-hidden="true" />
                  <span><small>Checkpoint</small><strong>{athleticsSpectatorStanding?.checkpointIndex ?? spectatorPlayer.athletics?.checkpointIndex ?? 0}</strong></span>
                </span>
                <span>
                  <Timer size={16} aria-hidden="true" />
                  <span><small>Progress</small><strong>{Math.round((athleticsSpectatorStanding?.routeProgress ?? spectatorPlayer.athletics?.routeProgress ?? 0) * 100)}%</strong></span>
                </span>
                <span className="spectator-gear">
                  <Trophy size={16} aria-hidden="true" />
                  <span><small>Place</small><strong>{athleticsSpectatorStanding?.rank ?? "—"}</strong></span>
                </span>
              </div>
            ) : spectatorPlayer && spectatorGear ? (
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
        ) : !athleticsRace ? (
        <div className="hud player-status-hud">
          <span className={player.isAlive ? "hud-stat hud-warmth" : "hud-stat hud-warmth low"}>
            <HeartPulse size={18} aria-hidden="true" />
            <span>
              <small>Health</small>
              <strong>{warmth}</strong>
            </span>
          </span>
          {isZombieHuman ? (
            <span key={`energy-${currencyPulse}`} className={`hud-stat hud-energy${movementEnergy <= 20 ? " low" : ""}${currencyPulse ? " hud-value-pulse" : ""}`}>
              <Zap size={18} aria-hidden="true" />
              <span>
                <small>Energy</small>
                <strong>{movementEnergy}/{ZOMBIE_HUMAN_MAX_ENERGY}</strong>
              </span>
            </span>
          ) : (
            <span key={`currency-${currencyPulse}`} className={`hud-stat hud-currency${currencyPulse ? " hud-value-pulse" : ""}`}>
              <CircleDollarSign size={18} aria-hidden="true" />
              <span>
                <small>Money</small>
                <strong>${player.money}</strong>
              </span>
            </span>
          )}
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
                  <strong>{movementEnergy > 0 ? "Move and survive" : "Answer to move"}</strong>
                </span>
              </span>
            </>
          ) : (<>
          <span className="hud-stat">
            <Target size={18} aria-hidden="true" />
            <span>
              <small>Snowballs left</small>
              <strong>{snowballs}</strong>
            </span>
          </span>
          </>)}
        </div>
        ) : null}
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
                {athleticsRecoveryActive && (
                  <div className="panel respawn-card respawn-card-overlay athletics-recovery-card" role="status" aria-live="polite">
                    <div className="panel-title">
                      <div>
                        <span className="menu-eyebrow">Fall recovery</span>
                        <h2>You fell! Answer 3 questions to get back on the course.</h2>
                      </div>
                      <span>{athleticsPlayer?.recoveryCorrectAnswers ?? 0}/{athleticsPlayer?.recoveryRequiredAnswers ?? 3}</span>
                    </div>
                    <div className="respawn-meter" aria-label="Recovery question progress">
                      <span style={{ width: `${Math.min(100, ((athleticsPlayer?.recoveryCorrectAnswers ?? 0) / Math.max(1, athleticsPlayer?.recoveryRequiredAnswers ?? 3)) * 100)}%` }} />
                    </div>
                    <p>Recovery Questions {athleticsPlayer?.recoveryCorrectAnswers ?? 0} / {athleticsPlayer?.recoveryRequiredAnswers ?? 3} · only correct answers count. You’ll return to the previous safe platform.</p>
                  </div>
                )}
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
                <QuizPanel
                  question={question}
                  player={player}
                  session={session}
                  playerToken={playerToken}
                  onAnswer={answer}
                  answeringChoice={answeringChoice}
                  answerFeedback={answerFeedback}
                />
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
            {scoreboardOpen && <Scoreboard players={session.players} localPlayerId={player.id} gameMode={session.settings.gameMode} athleticsRequiredLaps={athleticsRequiredLaps} />}
            {settingsOpen && <GamePreferencesPanel preferences={gamePreferences} onChange={updateGamePreferences} />}
          </div>
        )}
        {(session.status === "waiting" || roundEnded || isSocketReconnecting || (!player.isAlive && session.settings.gameMode !== "flag" && !athleticsRace) || status.error || feedback) && (
          <div className={`student-alerts${session.status === "waiting" ? " has-character-creator" : ""}`} aria-live="polite">
            {session.status === "waiting" && (
              <div className="panel pre-round-card creator-ready-room">
                <header className="lobby-selection-header">
                  <div className="lobby-instruction">
                    <span>Before the game</span>
                    <h2>{athleticsRace ? "Choose your lane, then wait for the host to start." : "Choose your team, then wait for the host to start."}</h2>
                    <p className="lobby-ready-note">{athleticsRace ? "You’re connected. Style your runner while the others join. The course opens on the host’s start signal." : "You’re connected. Pick a team and style your player while the others join."}</p>
                    <div className="lobby-status-row">
                      <span className="waiting-status"><span className="waiting-pulse" />Waiting for host…</span>
                      <span className="lobby-player-count"><Users size={15} />{connectedPlayers.length} {connectedPlayers.length === 1 ? "player" : "players"} joined</span>
                    </div>
                  </div>
                  {athleticsRace ? (
                    <div className="athletics-lobby-card" role="note">
                      <Footprints className="athletics-lobby-mark" size={22} aria-hidden="true" />
                      <span><strong>Skyline Adventure Park</strong><small>{ATHLETICS_STADIUM_COURSE.sections.length} chapters · {ATHLETICS_STADIUM_COURSE.checkpoints.length} checkpoints · answer anytime for energy</small></span>
                    </div>
                  ) : <div className="team-choice-grid" aria-label="Choose your team">
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
                    {session.settings.teamAssignment !== "players_choose" && <small className="team-lock-note">The host is assigning the teams.</small>}
                  </div>}
                </header>
                <Suspense fallback={<ArenaLoading label="Loading character creator" />}>
                  <CharacterCreator
                    appearance={player.appearance}
                    team={player.team}
                    policy={session.settings.characterCustomization}
                    nonCombat={athleticsRace}
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
              <div
                className="panel pre-round-card student-end-summary student-learning-report"
                role="region"
                aria-labelledby="student-learning-report-title"
                aria-busy={isLearningReportLoading}
              >
                <div className="student-learning-report-heading">
                  <div>
                    <span className="menu-eyebrow">Your learning report</span>
                    <h2 id="student-learning-report-title">Game over</h2>
                  </div>
                  <span className="student-match-result">{sessionResult}</span>
                </div>
                <p className="student-learning-report-intro">Here is what your answers say about what to practise next.</p>
                {athleticsRace && (
                  <section className="athletics-result-card" aria-label="Your race result">
                    <div className="athletics-result-kicker"><Trophy size={18} aria-hidden="true" /> Skyline Adventure Park result</div>
                    <div className="athletics-result-grid">
                      <span><small>Place</small><strong>{athleticsPlayer?.status === "finished" && athleticsStanding?.rank ? `#${athleticsStanding.rank}` : "DNF"}</strong></span>
                      <span><small>Time</small><strong>{athleticsPlayer?.finishTimeMs === undefined ? "DNF" : formatDuration(athleticsPlayer.finishTimeMs / 1000)}</strong></span>
                      <span><small>Laps</small><strong>{athleticsPlayer?.completedLaps ?? 0}/{athleticsRequiredLaps}</strong></span>
                      <span><small>Questions</small><strong>{athleticsPlayer?.questionIndex ?? 0}/{athleticsQuestionCount}</strong></span>
                      <span><small>Falls</small><strong>{athleticsPlayer?.falls ?? 0}</strong></span>
                    </div>
                  </section>
                )}
                {isLearningReportLoading && learningSummary.totalAttempts === 0 ? (
                  <p className="student-learning-report-loading" role="status">Preparing your personal summary...</p>
                ) : (
                  <>
                    <div className="student-summary-metrics student-learning-metrics" aria-label="Your learning results">
                      <span><strong>{learningSummary.totalAttempts}</strong> Questions answered</span>
                      <span><strong>{learningSummary.correctAttempts}</strong> Correct</span>
                      <span><strong>{learningSummary.incorrectAttempts}</strong> Incorrect</span>
                      <span><strong>{learningSummary.accuracy === null ? "—" : `${learningSummary.accuracy}%`}</strong> Accuracy</span>
                      <span><strong>{learningSummary.questionsToReview}</strong> Questions to review</span>
                    </div>
                    {learningSummary.totalAttempts === 0 ? (
                      <p className="student-learning-report-note">No questions answered this game.</p>
                    ) : (
                      <p className="student-learning-report-note">
                        {learningSummary.questionsToReview === 0
                          ? "Great job. A short review sheet is ready for reinforcement."
                          : `${learningSummary.questionsToReview} question${learningSummary.questionsToReview === 1 ? "" : "s"} ${learningSummary.questionsToReview === 1 ? "is" : "are"} ready to review.`}
                      </p>
                    )}
                    <div className="student-worksheet-actions">
                      <button className="primary" type="button" onClick={() => void downloadWorksheet()} disabled={isDownloadingWorksheet || practiceQuestions.length === 0}>
                        <Download size={18} aria-hidden="true" />
                        {isDownloadingWorksheet ? "Creating worksheet..." : "Download Practice Worksheet"}
                      </button>
                      {isLearningReportLoading && <small className="student-learning-report-sync-note" role="status">Syncing your saved answers...</small>}
                      {practiceQuestions.length === 0 && <small>No question-set data is available for a worksheet yet.</small>}
                      {learningReportError && <small className="student-learning-report-sync-note">Your on-screen summary is based on the answers available in this session.</small>}
                    </div>
                    {!athleticsRace && <div className="student-competition-summary" aria-label="Match results">
                      <span><strong>{Math.round(player.quizMoneyEarned ?? 0)}</strong> rewards earned</span>
                      <span><strong>{formatRewards(player.moneySpent ?? 0)}</strong> spent on gear</span>
                      <span><strong>{Math.round(player.money)}</strong> rewards left</span>
                      <span><strong>{player.score}</strong> final score</span>
                    </div>}
                  </>
                )}
                <div className="button-row">
                  <button className="primary" onClick={returnToJoin}>Join another game</button>
                  <button onClick={onExit}>Back to QuizStrike</button>
                </div>
              </div>
            )}
            {isSocketReconnecting && (
              <p className="connection-banner" data-testid="student-realtime-reconnecting">
                <WifiOff size={16} aria-hidden="true" />
                Live game connection lost. Trying to reconnect...
              </p>
            )}
            {!player.isAlive && session.settings.gameMode !== "flag" && !athleticsRace && (
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
      {session.status !== "waiting" && <div className={`action-bar control-prompts${athleticsRace ? " athletics-action-bar" : ""}`}>
        <button aria-label={athleticsRace ? "Answer movement energy question" : "Questions"} title={athleticsRace ? "Answer question · Q" : "Questions · Q"} disabled={roundEnded || teacherPaused} onClick={() => {
          if (athleticsRace) openAthleticsQuestion();
          else {
            gameAudio.playEvent(quizOpen ? "modal_close" : "quiz_open");
            setQuizOpen(!quizOpen);
            setBuyOpen(false);
            setScoreboardOpen(false);
          }
        }}><BookOpen size={19} aria-hidden="true" /><span>{athleticsRace ? "Question" : "Q Questions"}</span></button>
        {!athleticsRace && <button aria-label="Buy gear" disabled={roundEnded || teacherPaused || !player.isAlive} onClick={() => { gameAudio.play("menu_toggle"); setBuyOpen(!buyOpen); setQuizOpen(false); setScoreboardOpen(false); }}><Package size={19} aria-hidden="true" /><span>B Gear · 1–6 choose</span></button>}
        <button aria-label="Scoreboard" title="Scoreboard · hold Tab" disabled={teacherPaused} onPointerDown={() => { gameAudio.play("menu_toggle"); setScoreboardOpen(true); setQuizOpen(false); setBuyOpen(false); setSettingsOpen(false); }} onPointerUp={() => setScoreboardOpen(false)} onPointerCancel={() => setScoreboardOpen(false)} onBlur={() => setScoreboardOpen(false)}><Trophy size={19} aria-hidden="true" /><span>Scoreboard</span></button>
        <button aria-label="Settings" title="Settings" disabled={teacherPaused} onClick={() => { gameAudio.play("menu_toggle"); setSettingsOpen((open) => !open); setQuizOpen(false); setBuyOpen(false); setScoreboardOpen(false); }}><Settings size={19} aria-hidden="true" /><span>Settings</span></button>
      </div>}
    </section>
  );
}
