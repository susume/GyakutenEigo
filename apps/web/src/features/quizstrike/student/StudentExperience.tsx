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
  ZOMBIE_HUMAN_CORRECT_ENERGY,
  ZOMBIE_HUMAN_MAX_ENERGY,
  canPlayerFireInMode,
  getCosmeticProgress,
  getArenaGroundHeight,
  ARENA_PLAYER_EYE_HEIGHT,
  getPlayerWeaponIdForMode,
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
import Scoreboard from "./Scoreboard";
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
  return "Team Tag";
};

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

const getPlayerWarmth = (player: PlayerSession) => Math.max(0, Math.round(player.health ?? (player.isAlive ? 100 : 0)));

type FeedbackCue = "success" | "warning" | "error";

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
    : `Humans ${humans} · Zombies ${zombies} · Answer for energy, then run`;
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
  const preparationRemainingSeconds = useDeadlineRemainingSeconds(
    roundPreparation || zombieSelection ? session?.roundTransition?.startsAt : undefined,
    session?.serverTime
  );
  const socketRef = useRef<Socket | null>(null);
  const previousAliveRef = useRef<boolean | null>(null);
  const previousPreparationRef = useRef(false);
  const lastCountdownCueRef = useRef("");
  const answerFeedbackTimerRef = useRef<number | undefined>(undefined);
  // State updates are asynchronous; this synchronous guard closes the small
  // keyboard/pointer window before `answeringChoice` re-renders.
  const answerSubmissionLockRef = useRef(false);
  const learningReportRequestKeyRef = useRef("");
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
    let disposed = false;
    let socket: Socket | null = null;
    let positionFlushTimer: number | undefined;
    let hasConnected = false;
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
    const emitPlayerVfx = (kind: ArenaVfxKind, playerId = activePlayerId, source = lastVisualSession) => {
      const target = source.players.find((candidate) => candidate.id === playerId);
      emitArenaVfx({ kind, x: target?.x ?? 0, z: target?.z ?? 0, team: target?.team });
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
        setAnsweringChoice(null);
        setAnswerFeedback(null);
        setQuestion(null);
      }
      hasConnected = true;
      setIsSocketReconnecting(false);
    });
    connectedSocket.on("connect_error", () => setIsSocketReconnecting(true));
    connectedSocket.on("disconnect", () => {
      if (!removedByTeacher) setIsSocketReconnecting(true);
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
    connectedSocket.on("player_state", (payload: { players?: PlayerSession[]; flag?: GameSession["flag"]; recentEvents?: GameSession["events"] }) => {
      if (!Array.isArray(payload.players)) return;
      setSession((current) => current ? {
        ...current,
        players: current.players.map((candidate) => payload.players?.find((next) => next.id === candidate.id) ?? candidate),
        ...(payload.flag ? { flag: payload.flag } : {}),
        ...(payload.recentEvents ? { events: payload.recentEvents } : {})
      } : current);
      setPlayer((current) => current ? payload.players?.find((next) => next.id === current.id) ?? current : current);
    });
    connectedSocket.on("remote_weapon_fire", (payload: { playerId?: string; x?: number; y?: number; z?: number; facing?: number; pitch?: number; gearId?: string }) => {
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
    connectedSocket.on("world_impact", (payload: { attackerId?: string; targetId?: string; x?: number; z?: number; shield?: boolean }) => {
      if (payload.attackerId === activePlayerId || payload.targetId === activePlayerId || !Number.isFinite(payload.x) || !Number.isFinite(payload.z)) return;
      const local = lastVisualSession.players.find((candidate) => candidate.id === activePlayerId);
      if (!local || !Number.isFinite(local.x) || !Number.isFinite(local.z)) return;
      gameAudio.playEvent(payload.shield ? "shield_impact" : "world_impact", getCombatAudioSpatial({
        attacker: { x: payload.x!, z: payload.z! },
        target: { x: local.x!, z: local.z!, facing: local.facing ?? 0 }
      }));
    });
    connectedSocket.on("game_event", (event: GameEvent) => {
      if (event.type === "join") gameAudio.playEvent("player_join");
      if (event.type === "start") gameAudio.playEvent("round_start");
      if (event.type === "buy") gameAudio.playEvent("results_confirm");
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
    connectedSocket.on("player_position", receivePlayerPosition);
    connectedSocket.on("player_positions", (positions: LivePositionUpdate[]) => {
      if (!Array.isArray(positions)) return;
      positions.forEach(receivePlayerPosition);
    });
    connectedSocket.on("damage_result", (result: DamageResultPayload) => {
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
    connectedSocket.on("elimination_update", (event: EliminationPayload) => {
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
      setFeedback("");
      setIsSocketReconnecting(false);
      setStatusError(payload.message ?? "The host removed you from this game.");
      connectedSocket.disconnect();
    });

    };
    void setupSocket();
    return () => {
      disposed = true;
      if (positionFlushTimer !== undefined) window.clearTimeout(positionFlushTimer);
      setIsSocketReconnecting(false);
      if (socketRef.current === socket) socketRef.current = null;
      socket?.disconnect();
    };
  }, [sessionCode, playerId, playerToken, openRespawnPractice, setAnsweringChoice, setBuyOpen, setFeedback, setIncomingHitCue, setIsSocketReconnecting, setQuizOpen, setRewardPulse, setScoreboardOpen, setSettingsOpen, setStatusError]);

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
  const gameplayInputPaused = quizOpen || buyOpen || settingsOpen || isSocketReconnecting;

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
    setFeedback("");
    status.clear();
  };

  const answer = async (choice: Choice) => {
    if (!session || !player || !question || !playerToken || answeringChoice || answerFeedback || answerSubmissionLockRef.current) return;
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
      storeCosmeticProgressToken(payload.cosmeticProgressToken);
      setPlayer(payload.result.player);
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
      if (payload.result.respawned) {
        emitArenaVfx({ kind: "healing", x: payload.result.player.x ?? 0, z: payload.result.player.z ?? 0, team: payload.result.player.team });
        emitArenaVfx({ kind: "spawn", x: payload.result.player.x ?? 0, z: payload.result.player.z ?? 0, team: payload.result.player.team });
        emitArenaAnimation({ kind: "respawn", playerId: payload.result.player.id, team: payload.result.player.team });
      }
      if (answerFeedbackTimerRef.current !== undefined) window.clearTimeout(answerFeedbackTimerRef.current);
      answerFeedbackTimerRef.current = window.setTimeout(() => {
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
      answerSubmissionLockRef.current = false;
      status.report(err);
    } finally {
      setAnsweringChoice(null);
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
              <div className="student-control"><kbd>WASD</kbd><span>Move</span></div>
              <div className="student-control"><kbd>Arrow keys / swipe</kbd><span>Look around</span></div>
              <div className="student-control"><kbd>F</kbd><span>Fire</span></div>
              <div className="student-control"><kbd>C</kbd><span>Zoom</span></div>
              <div className="student-control"><kbd>E</kbd><span>Environment button</span></div>
              <div className="student-control"><kbd>Q</kbd><span>Questions</span></div>
              <div className="student-control"><kbd>B / 1-5</kbd><span>Open and choose gear</span></div>
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
      gamePreferences.highContrastHud ? "high-contrast-hud" : "",
      session.status === "waiting" ? "waiting-game-layout" : ""
    ].filter(Boolean).join(" ")}>
      <div className="game-stage">
        {session.status !== "waiting" && <GameAnnouncementOverlay announcement={roundPreparation || zombieSelection || roundEnded ? undefined : session.announcement} serverTime={session.serverTime} />}
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
                <QuizPanel
                  question={question}
                  player={player}
                  session={session}
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
                    <h2>Choose your team, then wait for the host to start.</h2>
                    <p className="lobby-ready-note">You’re connected. Pick a team and style your player while the others join.</p>
                    <div className="lobby-status-row">
                      <span className="waiting-status"><span className="waiting-pulse" />Waiting for host…</span>
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
                    {session.settings.teamAssignment !== "players_choose" && <small className="team-lock-note">The host is assigning the teams.</small>}
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
                    <div className="student-competition-summary" aria-label="Match results">
                      <span><strong>{Math.round(player.quizMoneyEarned ?? 0)}</strong> rewards earned</span>
                      <span><strong>{formatRewards(player.moneySpent ?? 0)}</strong> spent on gear</span>
                      <span><strong>{Math.round(player.money)}</strong> rewards left</span>
                      <span><strong>{player.score}</strong> final score</span>
                    </div>
                  </>
                )}
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
        <button aria-label="Questions" disabled={roundEnded} onClick={() => { gameAudio.playEvent(quizOpen ? "modal_close" : "quiz_open"); setQuizOpen(!quizOpen); setBuyOpen(false); setScoreboardOpen(false); }}><BookOpen size={19} aria-hidden="true" /><span>Q Questions</span></button>
        <button aria-label="Buy gear" disabled={roundEnded || !player.isAlive} onClick={() => { gameAudio.play("menu_toggle"); setBuyOpen(!buyOpen); setQuizOpen(false); setScoreboardOpen(false); }}><Package size={19} aria-hidden="true" /><span>B Gear · 1–5 choose</span></button>
        <button aria-label="Scoreboard" onPointerDown={() => { gameAudio.play("menu_toggle"); setScoreboardOpen(true); setQuizOpen(false); setBuyOpen(false); setSettingsOpen(false); }} onPointerUp={() => setScoreboardOpen(false)} onPointerCancel={() => setScoreboardOpen(false)} onBlur={() => setScoreboardOpen(false)}><Trophy size={19} aria-hidden="true" /><span>Hold Tab · Scoreboard</span></button>
        <button aria-label="Settings" onClick={() => { gameAudio.play("menu_toggle"); setSettingsOpen((open) => !open); setQuizOpen(false); setBuyOpen(false); setScoreboardOpen(false); }}><Settings size={19} aria-hidden="true" /><span>Settings</span></button>
      </div>}
    </section>
  );
}
