import "dotenv/config";
import bcrypt from "bcryptjs";
import compression from "compression";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { Prisma, PrismaClient } from "@prisma/client";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server, type Socket } from "socket.io";
import { resolveClientOrigins } from "./origins.js";
import { getPausedRoundAction, planRoundConclusion } from "./roundFlow.js";
import { inspectProcessedDecal } from "./appearanceSecurity.js";
import { DecalStore, type StoredDecalMime } from "./decalStore.js";
import { PlayerPositionHistory } from "./playerPositionHistory.js";
import { NetworkMetrics } from "./networkMetrics.js";
import { announcementForFreezeStreak, incrementFreezeStreak } from "./freezeStreaks.js";
import { NormalizedLibrary } from "./persistence/normalizedLibrary.js";
import {
  MAX_SAVED_REPORTS,
  canMoveFolder,
  formatReportDisplayName,
  hasDuplicateSiblingName,
  normalizeFolderName,
  oldestReportsToDelete,
  sanitizeExportFilename
} from "./teacherLibrary.js";
import {
  APPEARANCE_UPDATE_COOLDOWN_MS,
  DECAL_MAX_PROCESSED_BYTES,
  DEFAULT_PLAYER_APPEARANCE,
  ZOMBIE_HUMAN_MAX_ENERGY,
  ZOMBIE_HUMAN_WALK_MAX_SPEED,
  awardZombieHumanEnergy,
  canPlayerFireInMode,
  clampArenaAimPitch,
  clampArenaPosition,
  ARENA_SCALE,
  ARENA_PLAYER_CROUCH_EYE_HEIGHT,
  ARENA_PLAYER_EYE_HEIGHT,
  DESERT_CITADEL_MAIN_LEVEL_Y,
  DESERT_CITADEL_ROOFTOP_LEVEL_Y,
  IRON_JUNCTION_LOADING_LEVEL_Y,
  IRON_JUNCTION_OVERPASS_LEVEL_Y,
  TEMPLE_RUNOFF_MAIN_LEVEL_Y,
  DEFAULT_PLAYER_HEALTH,
  GEAR_ITEMS,
  getGearFireCooldownMs,
  getGearHitRadius,
  getGearRange,
  getCosmeticProgress,
  getLockedAppearanceItems,
  getPlayerHealthMax,
  getPlayerMoveSpeedMultiplier,
  getPlayerPerks,
  getPlayerWeaponId,
  getPlayerWeaponIdForMode,
  isWeaponGearId,
  getArenaObstacles,
  getArenaEyeHeight,
  getArenaGroundHeightForPlayer,
  getArenaRecoveryGroundHeight,
  findBotNavigationPath,
  getRoundRemainingSeconds,
  getRoundResetLoadout,
  getZombieBestPlayers,
  resolveTeamRoundWinner,
  getTeamSpawnForMap,
  selectTeamSpawnForMap,
  PlayerQuestionGate,
  RESPAWN_CORRECT_ANSWERS_REQUIRED,
  buildReportRows,
  buildCsvReport,
  canStartRound,
  isChoice,
  isMainRoundAnswer,
  isRoundActive,
  isRoundPreparationPhase,
  isZombieSelectionPhase,
  createInitialFlagState,
  randomizeBalancedTeams,
  selectLateJoinTeam,
  resolveAnswerReward,
  resolveFlagCapture,
  resolveFlagCountdown,
  resolveFlagDropForPlayer,
  resolveFlagPickup,
  resolveFlagPlacement,
  resolveGearPurchase,
  resolvePracticeRespawn,
  resolveAuthoritativeMovement,
  resolveBotRespawn,
  resolveBotRoamStep,
  resolveProjectileTarget,
  resolveSnowballPurchase,
  resolveSnowballUse,
  resolveTagAction,
  resolveZombieConversion,
  resolveZombieSprintEnergy,
  sanitizeSessionSettings,
  sanitizePlayerAppearance,
  sanitizeCharacterCustomizationSettings,
  getPlayerAppearanceError,
  selectInitialZombies,
  type AnswerLog,
  hasLineOfSight,
  type ArenaPosition,
  type BotDifficulty,
  type Choice,
  type ClassSummary,
  type GameSession,
  type GameAnnouncement,
  type GameEvent,
  type FlagPlantedEvent,
  type FreezeStreakAnnouncementEvent,
  type PlayerSession,
  type PlayerAppearance,
  type PublicQuestion,
  type Question,
  type QuizFolder,
  type QuizResult,
  type QuizSet,
  type ReportMetadata,
  type SessionReport,
  type SessionSettings,
  type TeacherUser,
  type Team
} from "@quizstrike/shared";
import {
  BOT_DIFFICULTIES,
  chooseBotRole,
  chooseBotTarget,
  createBotMemory,
  getBotWeaponPreference,
  isTargetInsideBotAwareness,
  nextBotRandom,
  randomBetween,
  resolveBotAim,
  resolveBotPerceptionFocus,
  resolveBotSpacingGoal,
  resolveBotState,
  shouldAdvanceBotPatrolRoute,
  shouldBotAttemptFlagInteraction,
  type BotMemory,
  type BotState
} from "./botAI.js";

interface StoredUser extends TeacherUser {
  passwordHash: string;
}

interface AuthedRequest extends Request {
  user?: TeacherUser;
}

export const app = express();
export const server = createServer(app);
const port = Number(process.env.PORT ?? 4000);
const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET ?? "local-dev-only-change-me";
const databaseUrl = process.env.DATABASE_URL?.trim();
const prisma = databaseUrl ? new PrismaClient() : undefined;
const normalizedLibrary = prisma ? new NormalizedLibrary(prisma) : undefined;
const clientOrigins = resolveClientOrigins({
  configuredOrigins: process.env.CLIENT_ORIGIN ?? process.env.CORS_ORIGIN,
  isProduction
});
const corsOrigin = clientOrigins.length > 0 ? clientOrigins : true;

if (isProduction && jwtSecret === "local-dev-only-change-me") {
  throw new Error("JWT_SECRET must be set before running QuizStrike online.");
}

if (isProduction && !databaseUrl) {
  console.warn("DATABASE_URL is not configured; QuizStrike is running online with in-memory storage.");
}

if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

export const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true, maxAge: 86_400 },
  httpCompression: { threshold: 1024 },
  perMessageDeflate: false
});
const networkMetrics = new NetworkMetrics();

const users = new Map<string, StoredUser>();
const classes = new Map<string, ClassSummary & { teacherId: string }>();
const quizSets = new Map<string, QuizSet>();
const folders = new Map<string, QuizFolder>();
const sessions = new Map<string, GameSession>();
const answers: AnswerLog[] = [];
type StoredReport = ReportMetadata & { report: SessionReport };
const reports = new Map<string, StoredReport>();
const playerQuestionHistory = new Map<string, Set<string>>();
const playerQuestionGate = new PlayerQuestionGate();
const quizRateLimits = new Map<string, number[]>();
const fireRequestIds = new Map<string, Map<string, number>>();
const playerMoveTimestamps = new Map<string, number>();
const playerNextFireAt = new Map<string, number>();
const botRespawnAt = new Map<string, number>();
const botNextAttackAt = new Map<string, number>();
const botMemoryById = new Map<string, BotMemory>();
const botPreviousPositions = new Map<string, { x: number; y?: number; z: number }>();
const playerPositionHistory = new PlayerPositionHistory(350);
const appearanceUpdateTimestamps = new Map<string, number>();
const playerSockets = new Map<string, Set<string>>();
const playerDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

const decalStore = new DecalStore();
const decalUploadTimestamps = new Map<string, number[]>();
// The provider boundary is documented in the web package, but no moderated server
// adapter ships with this build. Keep the policy fail-closed even if an unrelated
// environment variable is present.
const aiSkinProviderConfigured = false;

type SocketPlayerBinding = { sessionCode: string; playerId: string };
const playerSocketKey = (sessionCode: string, playerId: string) => `${sessionCode}:${playerId}`;
const gameplayRoom = (sessionCode: string) => `${sessionCode}:players`;

const emitFlagPlanted = (session: GameSession, player: PlayerSession) => {
  const flag = session.flag;
  if (!flag || flag.state !== "placed" || flag.placedAtMs === undefined || flag.expiresAtMs === undefined) return;
  const event: FlagPlantedEvent = {
    type: "flag_planted",
    eventId: id(),
    objectiveId: flag.objectiveId ?? `${session.id}:round:${session.currentRound}`,
    plantedByPlayerId: player.id,
    plantedAt: flag.placedAtMs,
    expiresAt: flag.expiresAtMs
  };
  io.to(session.sessionCode).emit("flag_planted", event);
};

const emitFreezeStreakAnnouncement = (session: GameSession, player: PlayerSession, streak: number) => {
  const announcement = announcementForFreezeStreak(streak);
  if (!announcement) return;
  const event: FreezeStreakAnnouncementEvent = {
    type: "freeze_streak_announcement",
    eventId: id(),
    playerId: player.id,
    playerName: player.nickname,
    streak,
    announcementKey: announcement.key,
    occurredAt: Date.now()
  };
  io.to(session.sessionCode).emit("freeze_streak_announcement", event);
};

const resetFreezeStreak = (player: PlayerSession) => {
  player.freezeStreak = 0;
};

const recordValidatedFreeze = (session: GameSession, attacker: PlayerSession, target: PlayerSession) => {
  resetFreezeStreak(target);
  const nextStreak = incrementFreezeStreak(attacker.freezeStreak);
  attacker.freezeStreak = nextStreak;
  emitFreezeStreakAnnouncement(session, attacker, nextStreak);
};

type PersistedRuntimeState = {
  users: StoredUser[];
  classes: Array<ClassSummary & { teacherId: string }>;
  quizSets: QuizSet[];
  folders: QuizFolder[];
  sessions: GameSession[];
  answers: AnswerLog[];
  /** Legacy fallback only. New writes are stored in the normalized Report table. */
  reports?: StoredReport[];
};

const runtimeSnapshotId = "primary";
let persistenceQueue = Promise.resolve();
let persistenceTimer: ReturnType<typeof setTimeout> | undefined;

const getPersistedRuntimeState = (): PersistedRuntimeState => ({
  users: [...users.values()],
  classes: [...classes.values()],
  quizSets: [...quizSets.values()],
  folders: [...folders.values()],
  sessions: [...sessions.values()],
  answers: [...answers]
});

const hydrateRuntimeState = async () => {
  if (!prisma) return;

  const snapshot = await prisma.runtimeSnapshot.findUnique({ where: { id: runtimeSnapshotId } });
  if (!snapshot) return;

  const state = snapshot.data as unknown as Partial<PersistedRuntimeState>;
  const savedUsers = Array.isArray(state.users) ? state.users : [];
  const savedClasses = Array.isArray(state.classes) ? state.classes : [];
  const savedQuizSets = Array.isArray(state.quizSets) ? state.quizSets : [];
  const savedFolders = Array.isArray(state.folders) ? state.folders : [];
  const savedSessions = Array.isArray(state.sessions) ? state.sessions : [];
  const savedAnswers = Array.isArray(state.answers) ? state.answers : [];
  const savedReports = Array.isArray(state.reports) ? state.reports : [];

  users.clear();
  classes.clear();
  quizSets.clear();
  folders.clear();
  sessions.clear();
  answers.length = 0;
  reports.clear();

  for (const user of savedUsers) if (user?.id) users.set(user.id, user);
  for (const klass of savedClasses) if (klass?.id) classes.set(klass.id, klass);
  for (const quiz of savedQuizSets) if (quiz?.id) quizSets.set(quiz.id, quiz);
  for (const folder of savedFolders) if (folder?.id) folders.set(folder.id, folder);
  for (const session of savedSessions) {
    if (!session?.id) continue;
    session.settings = sanitizeSessionSettings(session.settings);
    session.players = Array.isArray(session.players)
      ? session.players.map((player) => ({
          ...player,
          cosmeticXp: Number.isFinite(player.cosmeticXp)
            ? Math.max(0, Math.floor(player.cosmeticXp!))
            : Math.max(0, player.correctAnswers ?? 0) * 100,
          appearance: { ...sanitizePlayerAppearance(player.appearance), decalAssetId: undefined }
        }))
      : [];
    sessions.set(session.id, session);
  }
  answers.push(...savedAnswers.filter((answer) => answer?.id));
  // Read legacy report snapshots for backwards compatibility. New report writes
  // are normalized and are intentionally not re-embedded in RuntimeSnapshot.
  for (const report of savedReports) if (report?.id && report.report) reports.set(report.id, report);

  console.log(`Restored ${users.size} teachers, ${quizSets.size} quiz sets, and ${sessions.size} sessions from PostgreSQL.`);
};

const persistRuntimeState = () => {
  if (!prisma) return;
  const data = getPersistedRuntimeState();
  persistenceQueue = persistenceQueue
    .catch(() => undefined)
    .then(async () => {
      const jsonData = data as unknown as Prisma.InputJsonValue;
      await prisma.runtimeSnapshot.upsert({
        where: { id: runtimeSnapshotId },
        create: { id: runtimeSnapshotId, data: jsonData },
        update: { data: jsonData }
      });
    })
    .catch((error: unknown) => {
      console.error("Failed to persist QuizStrike runtime state.", error);
    });
};

const schedulePersistence = () => {
  if (!prisma || persistenceTimer) return;
  persistenceTimer = setTimeout(() => {
    persistenceTimer = undefined;
    persistRuntimeState();
  }, 1000);
};

const flushPersistence = () => {
  if (persistenceTimer) clearTimeout(persistenceTimer);
  persistenceTimer = undefined;
  persistRuntimeState();
};

const botNames = ["Atlas", "Nova", "Echo", "Pixel", "Orbit", "Scout", "Comet", "River"];
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
const BOT_TICK_MS = 300;
const FIRE_REQUEST_TTL_MS = 30_000;
const BOT_RESPAWN_MS = 8000;
const BOT_DIFFICULTY: BotDifficulty = process.env.BOT_DIFFICULTY === "beginner" || process.env.BOT_DIFFICULTY === "advanced"
  ? process.env.BOT_DIFFICULTY
  : "standard";
const PLAYER_MAX_SPEED = 22;
const PLAYER_DISCONNECT_GRACE_MS = 5000;
const ROUND_RESULT_ANNOUNCEMENT_MS = 4000;
const testPhaseDuration = (name: string, fallback: number) => {
  if (process.env.NODE_ENV !== "test") return fallback;
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) ? Math.max(20, configured) : fallback;
};
const ROUND_PREPARATION_MS = testPhaseDuration("QUIZSTRIKE_TEST_ROUND_PREPARATION_MS", 35_000);
const ZOMBIE_SELECTION_MS = testPhaseDuration("QUIZSTRIKE_TEST_ZOMBIE_SELECTION_MS", 20_000);
const SESSION_BROADCAST_WINDOW_MS = 75;
const ROUND_START_ANNOUNCEMENT_MS = 2500;
const GAME_OVER_ANNOUNCEMENT_MS = 7000;

app.use(cors({ origin: corsOrigin, credentials: true, maxAge: 86_400 }));
app.use(compression({ threshold: 1024 }));
app.use("/api/sessions/:code/players/:playerId/decals", express.raw({ type: ["image/png", "image/webp"], limit: DECAL_MAX_PROCESSED_BYTES }));
app.use(express.json({ limit: "1mb" }));

const now = () => new Date().toISOString();
const id = () => randomUUID();
const cleanEmail = (email: string) => email.trim().toLowerCase();
const routeParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const publicUser = (user: StoredUser): TeacherUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role
});

const getNicknameError = (value: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return "";
  return blockedNicknameTerms.some((term) => normalized.includes(term))
    ? "Please choose a classroom-friendly nickname."
    : "";
};

const makeToken = (user: TeacherUser) =>
  jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: "8h" });

type PlayerTokenPayload = {
  sub?: string;
  sessionCode?: string;
  scope?: string;
};

const makePlayerToken = (session: GameSession, player: PlayerSession) =>
  jwt.sign({ sub: player.id, sessionCode: session.sessionCode, scope: "student" }, jwtSecret, { expiresIn: "8h" });

const makeCosmeticProgressToken = (player: PlayerSession) =>
  jwt.sign(
    { scope: "cosmetic-progress", xp: Math.max(0, Math.floor(player.cosmeticXp ?? 0)) },
    jwtSecret,
    { expiresIn: "365d" }
  );

const readCosmeticProgressToken = (token: unknown) => {
  if (typeof token !== "string" || token.length > 2_048) return 0;
  try {
    const payload = jwt.verify(token, jwtSecret) as { scope?: string; xp?: number };
    return payload.scope === "cosmetic-progress" && Number.isFinite(payload.xp)
      ? Math.min(1_000_000, Math.max(0, Math.floor(payload.xp!)))
      : 0;
  } catch {
    return 0;
  }
};

const getTeacherFromToken = (token: string | undefined): TeacherUser | undefined => {
  if (!token) return undefined;
  try {
    const payload = jwt.verify(token, jwtSecret) as { sub?: string };
    const user = payload.sub ? users.get(payload.sub) : undefined;
    return user ? publicUser(user) : undefined;
  } catch {
    return undefined;
  }
};

const getBearerUser = (req: Request): TeacherUser | undefined => {
  const header = req.header("authorization");
  return header?.startsWith("Bearer ") ? getTeacherFromToken(header.slice("Bearer ".length)) : undefined;
};

const requireTeacher = (req: AuthedRequest, res: Response, next: () => void) => {
  const user = getBearerUser(req);
  if (!user) {
    res.status(401).json({ error: "Teacher login required." });
    return;
  }
  req.user = user;
  next();
};

const generateSessionCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while ([...sessions.values()].some((session) => session.sessionCode === code));
  return code;
};

const createDefaultSettings = (input: Partial<SessionSettings> = {}): SessionSettings => {
  const settings = sanitizeSessionSettings(input);
  if (!aiSkinProviderConfigured) settings.characterCustomization.aiEnabled = false;
  return settings;
};

const sessionSpawn = (session: GameSession, team: Team, index = 0) =>
  getTeamSpawnForMap(session.settings.mapId, team, index);

const selectSessionSpawn = (session: GameSession, team: Team, preferredIndex = 0) =>
  selectTeamSpawnForMap(session.settings.mapId, team, session.players, preferredIndex);

const getSessionByCode = (code: string) =>
  [...sessions.values()].find((session) => session.sessionCode.toUpperCase() === code.toUpperCase());

const getQuizQuestion = (questionId: string) => {
  for (const quiz of quizSets.values()) {
    const match = quiz.questions.find((question) => question.id === questionId);
    if (match) return match;
  }
  return undefined;
};

const publicQuestion = (question: Question): PublicQuestion => {
  const { correctChoice: _correctChoice, ...safeQuestion } = question;
  return safeQuestion;
};

const getPlayerToken = (req: Request) => {
  const headerToken = req.header("x-player-token");
  if (headerToken) return headerToken;
  const bodyToken = typeof req.body?.playerToken === "string" ? req.body.playerToken : "";
  return bodyToken;
};

const hasPlayerAccess = (session: GameSession, player: PlayerSession, token: unknown) => {
  if (typeof token !== "string" || !token) return false;
  try {
    const payload = jwt.verify(token, jwtSecret) as PlayerTokenPayload;
    return payload.scope === "student" && payload.sub === player.id && payload.sessionCode === session.sessionCode;
  } catch {
    return false;
  }
};

const requirePlayerAccess = (req: Request, res: Response, session: GameSession, player: PlayerSession) => {
  if (hasPlayerAccess(session, player, getPlayerToken(req))) return true;
  res.status(401).json({ error: "Student session token is required." });
  return false;
};

const canReadRoomAsset = (req: Request, session: GameSession) => {
  const teacher = getBearerUser(req);
  if (teacher?.id === session.teacherId) return true;
  const token = getPlayerToken(req);
  return session.players.some((player) => !player.isBot && hasPlayerAccess(session, player, token));
};

const deleteDecal = (assetId: string | undefined) => {
  decalStore.delete(assetId);
};

const clearPlayerAppearance = (session: GameSession, player: PlayerSession) => {
  decalStore.deletePlayer(session.id, player.id);
  player.appearance = { ...DEFAULT_PLAYER_APPEARANCE };
};

const purgeSessionDecals = (session: GameSession) => {
  decalStore.deleteSession(session.id);
  for (const player of session.players) {
    if (player.appearance?.decalAssetId) player.appearance = { ...player.appearance, decalAssetId: undefined };
    appearanceUpdateTimestamps.delete(player.id);
    decalUploadTimestamps.delete(player.id);
  }
};

const pruneExpiredDecals = () => {
  const removed = decalStore.pruneExpired();
  const touchedSessions = new Set<GameSession>();
  for (const asset of removed) {
    const session = sessions.get(asset.sessionId);
    const player = session?.players.find((candidate) => candidate.id === asset.playerId);
    if (!session || player?.appearance?.decalAssetId !== asset.id) continue;
    player.appearance = { ...player.appearance, decalAssetId: undefined };
    touchedSessions.add(session);
  }
  touchedSessions.forEach(broadcastSession);
};

const checkDecalUploadRate = (playerId: string) => {
  const cutoff = Date.now() - 60_000;
  const recent = (decalUploadTimestamps.get(playerId) ?? []).filter((timestamp) => timestamp >= cutoff);
  if (recent.length >= 3) return false;
  recent.push(Date.now());
  decalUploadTimestamps.set(playerId, recent);
  return true;
};

const selectNextQuestion = (session: GameSession, playerId: string): PublicQuestion | undefined => {
  const quiz = quizSets.get(session.quizSetId);
  if (!quiz || quiz.questions.length === 0) return undefined;

  let attempted = playerQuestionHistory.get(playerId);
  if (!attempted) {
    attempted = new Set<string>();
    playerQuestionHistory.set(playerId, attempted);
  }

  if (attempted.size >= quiz.questions.length) attempted.clear();

  const unattempted = quiz.questions.filter((question) => !attempted.has(question.id));
  const pool = unattempted.length > 0 ? unattempted : quiz.questions;
  const question = pool[Math.floor(Math.random() * pool.length)];
  attempted.add(question.id);
  return publicQuestion(question);
};

const issueNextQuestion = (session: GameSession, playerId: string): PublicQuestion | undefined => {
  const question = selectNextQuestion(session, playerId);
  if (question) playerQuestionGate.issue(playerId, question.id);
  return question;
};

const stampSession = (session: GameSession) => {
  session.serverTime = now();
  return session;
};

const pendingSessionBroadcasts = new Map<string, GameSession>();
let sessionBroadcastTimer: ReturnType<typeof setTimeout> | undefined;
type LivePositionPayload = {
  playerId: string;
  x: number;
  y?: number;
  z: number;
  facing: number;
  energy?: number;
  crouching?: boolean;
  jumping?: boolean;
};
const pendingPositionBroadcasts = new Map<string, Map<string, LivePositionPayload>>();
let positionBroadcastTimer: ReturnType<typeof setTimeout> | undefined;

const flushSessionBroadcasts = () => {
  sessionBroadcastTimer = undefined;
  for (const session of pendingSessionBroadcasts.values()) {
    io.to(session.sessionCode).emit("session_state", stampSession(session));
  }
  pendingSessionBroadcasts.clear();
};

const broadcastSession = (session: GameSession) => {
  pendingSessionBroadcasts.set(session.sessionCode, session);
  sessionBroadcastTimer ??= setTimeout(flushSessionBroadcasts, SESSION_BROADCAST_WINDOW_MS);
  schedulePersistence();
};

const broadcastPlayerState = (session: GameSession, players: PlayerSession[]) => {
  const uniquePlayers = [...new Map(players.map((player) => [player.id, player])).values()];
  io.to(session.sessionCode).emit("player_state", {
    players: uniquePlayers,
    flag: session.flag,
    recentEvents: session.events?.slice(0, 2)
  });
  schedulePersistence();
};

const emitToPlayers = (
  session: GameSession,
  playerIds: Array<string | undefined>,
  eventName: string,
  payload: unknown
) => {
  const socketIds = new Set<string>();
  for (const playerId of playerIds) {
    if (!playerId) continue;
    for (const socketId of playerSockets.get(playerSocketKey(session.sessionCode, playerId)) ?? []) {
      socketIds.add(socketId);
    }
  }
  for (const socketId of socketIds) io.to(socketId).emit(eventName, payload);
};

const appendEvent = (
  session: GameSession,
  event: Omit<GameEvent, "id" | "createdAt">
) => {
  const nextEvent: GameEvent = {
    id: id(),
    createdAt: now(),
    ...event
  };
  session.events = [nextEvent, ...(session.events ?? [])].slice(0, 40);
  const directAudience = [nextEvent.playerId, nextEvent.targetId];
  if (nextEvent.type === "elimination" || !directAudience.some(Boolean)) io.to(session.sessionCode).emit("game_event", nextEvent);
  else emitToPlayers(session, directAudience, "game_event", nextEvent);
  return nextEvent;
};

const makeAnnouncement = (
  kind: GameAnnouncement["kind"],
  title: string,
  message: string,
  detail?: string,
  durationMs?: number
): GameAnnouncement => ({
  id: id(),
  kind,
  title,
  message,
  detail,
  expiresAt: durationMs ? new Date(Date.now() + durationMs).toISOString() : undefined
});

const teamName = (team: Team) => team === "red" ? "Red Team" : "Blue Team";

const finishSession = (
  session: GameSession,
  message = "Round ended. Report is ready.",
  announcement = makeAnnouncement("game_over", "Game Over", message, undefined, GAME_OVER_ANNOUNCEMENT_MS)
) => {
  if (session.status === "ended") return;
  session.status = "ended";
  session.endedAt = now();
  session.roundTransition = undefined;
  session.announcement = announcement;
  for (const player of session.players) {
    if (!player.isBot) continue;
    botMemoryById.delete(player.id);
    botNextAttackAt.delete(player.id);
    botRespawnAt.delete(player.id);
    botPreviousPositions.delete(player.id);
  }
  botAlertsBySession.delete(session.sessionCode);
  purgeSessionDecals(session);
  appendEvent(session, { type: "end", message });
  saveSessionReport(session);
  broadcastSession(session);
};

const mirrorNormalized = (operation: Promise<unknown>, label: string) => {
  void operation.catch((error: unknown) => console.error(`Failed to mirror ${label} into normalized storage.`, error));
};

const finishZombieSession = (session: GameSession, outcome: string) => {
  const bestPlayers = getZombieBestPlayers(session.players, 6);
  const detail = bestPlayers.length > 0
    ? `Best players: ${bestPlayers.map((player) => player.nickname).join(", ")}`
    : "No survivor ranking was available.";
  finishSession(
    session,
    `${outcome} ${detail}`,
    makeAnnouncement("game_over", "Game Over", outcome, detail, GAME_OVER_ANNOUNCEMENT_MS)
  );
};

const inactiveRoundMessage = (session: GameSession) =>
  session.status === "ended"
    ? "The round has ended. This action was not counted."
    : isRoundPreparationPhase(session)
      ? "Preparation is open. Buy gear or answer questions before the round begins."
    : isZombieSelectionPhase(session)
      ? "Zombie selection is underway. Answer questions to build running energy."
    : session.status === "paused"
      ? "The round has ended. The next round is starting shortly."
      : "The teacher has not started the round yet.";

const resetRoundPlayer = (session: GameSession, player: PlayerSession, index: number): PlayerSession => {
  if (player.isBot) {
    botMemoryById.delete(player.id);
    botNextAttackAt.delete(player.id);
    botRespawnAt.delete(player.id);
    botPreviousPositions.delete(player.id);
  }
  const spawn = player.isBot ? getBotSpawn(session, player.team, index) : selectSessionSpawn(session, player.team, index);
  const loadout = getRoundResetLoadout({ player, startingSnowballs: session.settings.startingSnowballs });
  const isZombieHuman = session.settings.gameMode === "zombie" && player.role !== "zombie";
  return {
    ...player,
    ...spawn,
    role: session.settings.gameMode === "zombie" ? player.role ?? "human" : player.role,
    health: getPlayerHealthMax({ ...player, ...loadout }),
    ...loadout,
    energy: session.settings.gameMode === "zombie"
      ? player.role === "zombie" ? ZOMBIE_HUMAN_MAX_ENERGY : 0
      : player.energy,
    snowballs: isZombieHuman ? 0 : loadout.snowballs,
    isAlive: true,
    crouching: false,
    jumping: false,
    freezeStreak: 0,
    respawnCorrectAnswers: 0
  };
};

const prepareModeStateForRound = (session: GameSession) => {
  if (session.settings.gameMode === "flag") {
    if (session.settings.teamAssignment === "random") {
      session.players = randomizeBalancedTeams(session.players, Date.now());
    }
    session.flag = createInitialFlagState(sessionSpawn(session, "red"), `${session.id}:round:${session.currentRound}`);
  } else if (session.settings.gameMode === "zombie") {
    session.players = session.players.map((player) => ({
      ...player,
      role: "human",
      team: "blue",
      zombieConvertedAt: undefined,
      energy: 0,
      isAlive: true
    }));
    session.flag = undefined;
  } else {
    session.flag = undefined;
  }
};

const prepareRoundState = (session: GameSession, preserveStats = true) => {
  prepareModeStateForRound(session);
  session.roundWins = session.roundWins ?? { blue: 0, red: 0 };
  session.players = session.players.map((player, index) => {
    const wasOutForRound = !player.isAlive;
    const reset = resetRoundPlayer(session, player, index);
    return preserveStats
      ? {
          ...reset,
          respawns: wasOutForRound ? (player.respawns ?? 0) + 1 : (player.respawns ?? 0),
          roundTags: 0,
          roundRespawns: 0,
          roundQuizMoneyEarned: 0
        }
      : {
          ...reset,
          score: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          tags: 0,
          respawns: 0,
          roundTags: 0,
          roundRespawns: 0,
          roundQuizMoneyEarned: 0
        };
  });
};

const activatePreparedRound = (session: GameSession) => {
  session.status = "active";
  session.roundTransition = undefined;
  session.startedAt = now();
  session.endsAt = new Date(Date.now() + session.settings.roundDurationSeconds * 1000).toISOString();
};

const startRoundState = (session: GameSession, preserveStats = true) => {
  prepareRoundState(session, preserveStats);
  activatePreparedRound(session);
};

const openRoundPreparation = (session: GameSession, preserveStats = true) => {
  prepareRoundState(session, preserveStats);
  const startsAt = new Date(Date.now() + ROUND_PREPARATION_MS).toISOString();
  session.status = "paused";
  session.startedAt = undefined;
  session.endsAt = undefined;
  session.roundTransition = { nextRound: session.currentRound, startsAt, phase: "preparation" };
  session.announcement = {
    ...makeAnnouncement(
      "preparation",
      "Preparation Time",
      "Buy gear with B, or answer questions with Q to earn more money.",
      `Round ${session.currentRound} begins in 35 seconds.`,
      ROUND_PREPARATION_MS
    ),
    expiresAt: startsAt
  };
};

const flushPositionBroadcasts = () => {
  positionBroadcastTimer = undefined;
  for (const [sessionCode, positions] of pendingPositionBroadcasts) {
    io.to(gameplayRoom(sessionCode)).volatile.emit("player_positions", [...positions.values()]);
  }
  pendingPositionBroadcasts.clear();
};

const broadcastPlayerPosition = (session: GameSession, position: LivePositionPayload) => {
  const positions = pendingPositionBroadcasts.get(session.sessionCode) ?? new Map<string, LivePositionPayload>();
  positions.set(position.playerId, position);
  pendingPositionBroadcasts.set(session.sessionCode, positions);
  positionBroadcastTimer ??= setTimeout(flushPositionBroadcasts, 50);
};

const openZombieSelectionPhase = (session: GameSession, preserveStats = true) => {
  prepareRoundState(session, preserveStats);
  const startsAt = new Date(Date.now() + ZOMBIE_SELECTION_MS).toISOString();
  session.status = "paused";
  session.startedAt = undefined;
  session.endsAt = undefined;
  session.roundTransition = { nextRound: session.currentRound, startsAt, phase: "zombie_selection" };
  session.announcement = {
    ...makeAnnouncement(
      "preparation",
      "Everyone Starts Human",
      "Answer questions now to charge your running energy. Zombies will be chosen at random.",
      "Zombie selection in 20 seconds.",
      ZOMBIE_SELECTION_MS
    ),
    expiresAt: startsAt
  };
};

const finishRound = (session: GameSession, winner: Team | undefined, reason: string) => {
  if (session.status !== "active") return;
  const conclusion = planRoundConclusion({
    currentRound: session.currentRound,
    roundCount: session.settings.roundCount,
    roundWins: session.roundWins ?? { blue: 0, red: 0 },
    winner,
    reason
  });
  session.roundWins = conclusion.roundWins;
  appendEvent(session, {
    type: "end",
    message: conclusion.eventMessage,
    team: winner
  });

  if (conclusion.matchResult) {
    const title = conclusion.matchWinner ? `${teamName(conclusion.matchWinner)} wins!` : "The match is a draw";
    finishSession(
      session,
      conclusion.matchResult,
      makeAnnouncement("game_over", title, "Game Over", conclusion.matchResult, GAME_OVER_ANNOUNCEMENT_MS)
    );
    return;
  }

  const nextRound = conclusion.nextRound!;
  const resultTitle = winner ? `${teamName(winner)} wins Round ${session.currentRound}!` : `Round ${session.currentRound} is a draw`;
  const resultMessage = session.settings.gameMode === "flag" || session.settings.gameMode === "classic"
    ? `${reason}. Round ${nextRound} preparation begins shortly.`
    : `${reason}. Round ${nextRound} begins shortly.`;
  const startsAt = new Date(Date.now() + ROUND_RESULT_ANNOUNCEMENT_MS).toISOString();
  session.status = "paused";
  session.endsAt = now();
  session.announcement = {
    ...makeAnnouncement("round_result", resultTitle, resultMessage, undefined, ROUND_RESULT_ANNOUNCEMENT_MS),
    expiresAt: startsAt
  };
  session.roundTransition = { nextRound, startsAt, phase: "result" };
  broadcastSession(session);
};

const startPendingRound = (session: GameSession) => {
  if (session.status !== "paused" || !session.roundTransition) return;
  const transition = session.roundTransition;
  session.currentRound = transition.nextRound;
  if (getPausedRoundAction({ gameMode: session.settings.gameMode, phase: transition.phase }) === "open_preparation") {
    openRoundPreparation(session);
    appendEvent(session, { type: "start", message: `Round ${session.currentRound} preparation opened.` });
    broadcastSession(session);
    return;
  }

  if (transition.phase === "zombie_selection") {
    session.players = selectInitialZombies(session.players, session.settings.initialZombieCount).map((player) => (
      player.role === "zombie"
        ? { ...player, snowballs: session.settings.startingSnowballs }
        : player
    ));
    activatePreparedRound(session);
  } else if (transition.phase === "preparation" || transition.phase === "buy") {
    activatePreparedRound(session);
  } else {
    startRoundState(session);
  }
  session.announcement = makeAnnouncement(
    "round_start",
    session.settings.gameMode === "zombie" ? "Zombies Revealed!" : `Round ${session.currentRound} has begun!`,
    session.settings.gameMode === "flag"
      ? "Red carries and protects the flag. Blue defends and captures."
      : session.settings.gameMode === "zombie"
        ? "Red Zombies hunt. Blue Humans use their stored energy to run and survive."
        : "Most tags wins. Respawns, then quiz earnings break ties.",
    undefined,
    ROUND_START_ANNOUNCEMENT_MS
  );
  appendEvent(session, {
    type: "start",
    message: session.settings.gameMode === "zombie"
      ? "Zombies were chosen at random. The survival round started."
      : `Round ${session.currentRound} started.`
  });
  broadcastSession(session);
};

const finishZombieMatchIfComplete = (session: GameSession) => {
  if (session.settings.gameMode !== "zombie" || session.status !== "active") return;
  const humansRemaining = session.players.some(
    (player) => player.connectionState !== "disconnected" && player.isAlive && player.role !== "zombie"
  );
  if (!humansRemaining) finishZombieSession(session, "Zombies converted everyone.");
};

const evaluateFlagEliminationWin = (session: GameSession) => {
  if (session.settings.gameMode !== "flag" || session.status !== "active") return;
  const redActive = session.players.some((player) => player.team === "red" && player.connectionState !== "disconnected" && player.isAlive);
  const blueActive = session.players.some((player) => player.team === "blue" && player.connectionState !== "disconnected" && player.isAlive);
  if (!blueActive) {
    finishRound(session, "red", "Red Team knocked out Blue Team");
    return;
  }
  if (!redActive && session.flag?.state !== "placed") {
    finishRound(session, "blue", "Blue Team knocked out Red Team before the flag was placed");
  }
};

const clearPlayerDisconnectTimer = (session: GameSession, playerId: string) => {
  const key = playerSocketKey(session.sessionCode, playerId);
  const timer = playerDisconnectTimers.get(key);
  if (timer) clearTimeout(timer);
  playerDisconnectTimers.delete(key);
};

const schedulePlayerDisconnectResolution = (session: GameSession, playerId: string) => {
  const key = playerSocketKey(session.sessionCode, playerId);
  clearPlayerDisconnectTimer(session, playerId);
  const timer = setTimeout(() => {
    playerDisconnectTimers.delete(key);
    const player = session.players.find((candidate) => candidate.id === playerId);
    if (!player || player.connectionState !== "disconnected") return;
    resetFreezeStreak(player);
    evaluateFlagEliminationWin(session);
    finishZombieMatchIfComplete(session);
  }, PLAYER_DISCONNECT_GRACE_MS);
  playerDisconnectTimers.set(key, timer);
};

const markPlayerDisconnected = (session: GameSession, player: PlayerSession) => {
  if (player.connectionState === "disconnected") return;
  player.connectionState = "disconnected";
  if (session.flag && player.id === session.flag.carrierId) {
    session.flag = resolveFlagDropForPlayer(session.flag, player, {
      x: player.x ?? 0,
      z: player.z ?? 0
    });
  }
  appendEvent(session, {
    type: "timer",
    message: `${player.nickname} went Offline.`,
    playerId: player.id,
    team: player.team
  });
  broadcastSession(session);
  schedulePlayerDisconnectResolution(session, player.id);
};

const removePlayerRuntimeState = (session: GameSession, player: PlayerSession) => {
  clearPlayerDisconnectTimer(session, player.id);
  playerQuestionHistory.delete(player.id);
  playerQuestionGate.clear(player.id);
  quizRateLimits.delete(player.id);
  fireRequestIds.delete(player.id);
  playerMoveTimestamps.delete(player.id);
  playerNextFireAt.delete(player.id);
  botRespawnAt.delete(player.id);
  botNextAttackAt.delete(player.id);
  botMemoryById.delete(player.id);
  botPreviousPositions.delete(player.id);
  playerPositionHistory.clear(player.id);
  appearanceUpdateTimestamps.delete(player.id);
  decalUploadTimestamps.delete(player.id);
  decalStore.deletePlayer(session.id, player.id);

  const alerts = botAlertsBySession.get(session.sessionCode);
  if (alerts) {
    for (const [team, alert] of alerts) {
      if (alert.sourceId === player.id) alerts.delete(team);
    }
    if (alerts.size === 0) botAlertsBySession.delete(session.sessionCode);
  }
};

const evictPlayerSockets = (session: GameSession, player: PlayerSession) => {
  const key = playerSocketKey(session.sessionCode, player.id);
  const socketIds = playerSockets.get(key) ?? new Set<string>();
  for (const socketId of socketIds) {
    const playerSocket = io.sockets.sockets.get(socketId);
    if (!playerSocket) continue;
    playerSocket.emit("player_removed", {
      message: "Your teacher removed you from this game. You can return to the join screen."
    });
    playerSocket.leave(session.sessionCode);
    const binding = playerSocket.data.playerBinding as SocketPlayerBinding | undefined;
    if (binding?.sessionCode === session.sessionCode && binding.playerId === player.id) {
      delete playerSocket.data.playerBinding;
    }
  }
  playerSockets.delete(key);
};

const assertTeacherOwnsQuiz = (userId: string, quizSetId: string) => {
  const quiz = quizSets.get(quizSetId);
  return quiz?.teacherId === userId ? quiz : undefined;
};

const makeReport = (session: GameSession): SessionReport => {
  const sessionAnswers = answers.filter((answer) => answer.gameSessionId === session.id);
  const reportAnswers = sessionAnswers.filter(isMainRoundAnswer);
  const rows = buildReportRows({ players: session.players, answers: reportAnswers });

  const missedCounts = new Map<string, number>();
  for (const answer of reportAnswers) {
    if (!answer.isCorrect) missedCounts.set(answer.questionId, (missedCounts.get(answer.questionId) ?? 0) + 1);
  }

  const missedQuestions = [...missedCounts.entries()]
    .map(([questionId, misses]) => {
      const question = getQuizQuestion(questionId);
      return { questionId, prompt: question?.prompt ?? "Unknown question", misses };
    })
    .sort((a, b) => b.misses - a.misses);

  return { session, rows, missedQuestions };
};

const saveSessionReport = (session: GameSession) => {
  const quiz = quizSets.get(session.quizSetId);
  const createdAt = now();
  const metadata: ReportMetadata = {
    id: id(),
    teacherId: session.teacherId,
    sessionId: session.id,
    sessionCode: session.sessionCode,
    quizSetId: session.quizSetId,
    quizSetName: quiz?.title ?? "Quiz Set",
    displayName: formatReportDisplayName(createdAt, quiz?.title ?? "Quiz Set", session.sessionCode),
    createdAt
  };
  const storedReport: StoredReport = { ...metadata, report: makeReport(session) };
  const existing = [...reports.values()].find((report) => report.sessionId === session.id && report.teacherId === session.teacherId);
  const persistedReport = existing
    ? { ...storedReport, id: existing.id, createdAt: existing.createdAt, displayName: existing.displayName }
    : storedReport;
  reports.set(persistedReport.id, persistedReport);
  for (const report of oldestReportsToDelete([...reports.values()], session.teacherId, MAX_SAVED_REPORTS)) reports.delete(report.id);
  void normalizedLibrary?.saveReport(persistedReport, persistedReport.report).catch((error: unknown) => {
    console.error("Failed to persist normalized session report.", error);
  });
  schedulePersistence();
  return persistedReport;
};

const reportMetadataForTeacher = (teacherId: string) => [...reports.values()]
  .filter((report) => report.teacherId === teacherId)
  .map(({ report: _report, ...metadata }) => metadata)
  .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));

const durableReportMetadataForTeacher = async (teacherId: string) => {
  if (!normalizedLibrary) return reportMetadataForTeacher(teacherId);
  const durable = await normalizedLibrary.listReportMetadata(teacherId);
  return durable.length > 0 ? durable : reportMetadataForTeacher(teacherId);
};

const getBotSpawn = (session: GameSession, team: Team, index: number) => {
  return sessionSpawn(session, team, index);
};

const applyValidatedDamage = (session: GameSession, attacker: PlayerSession, target: PlayerSession) => {
  if (!canPlayerFireInMode(session.settings.gameMode, attacker.role)) {
    return { ok: false as const, reason: "humans_cannot_fire" as const };
  }
  const zombieAttack = session.settings.gameMode === "zombie" && attacker.role === "zombie";
  const combatAttacker = session.settings.gameMode === "zombie"
    ? { ...attacker, gear: "starter_blaster", weapon: "starter_blaster" }
    : attacker;
  const tagResult = resolveTagAction({ attacker: combatAttacker, target });
  if (!tagResult.ok) return tagResult;

  target.health = tagResult.nextHealth;
  // A validated hit interrupts the target's uninterrupted freeze streak. Only
  // an authoritative elimination below advances the attacker's streak.
  resetFreezeStreak(target);
  if (zombieAttack && tagResult.eliminated) {
    const conversion = resolveZombieConversion({ attacker, target });
    if (!conversion.ok) return conversion;
    Object.assign(target, conversion.player);
    target.zombieConvertedAt = now();
    attacker.tags = (attacker.tags ?? attacker.score) + conversion.tagCredit;
    attacker.roundTags = (attacker.roundTags ?? 0) + conversion.tagCredit;
    attacker.score += conversion.tagCredit;
    recordValidatedFreeze(session, attacker, target);
    appendEvent(session, {
      type: "tag",
      message: `${attacker.nickname} converted ${target.nickname} to Zombie Mode.`,
      playerId: attacker.id,
      targetId: target.id,
      team: attacker.team
    });
    emitToPlayers(session, [attacker.id, target.id], "damage_result", {
      ok: true,
      attackerId: attacker.id,
      targetId: target.id,
      attackerX: attacker.x ?? sessionSpawn(session, attacker.team).x,
      attackerZ: attacker.z ?? sessionSpawn(session, attacker.team).z,
      targetX: target.x ?? sessionSpawn(session, target.team).x,
      targetZ: target.z ?? sessionSpawn(session, target.team).z,
      targetFacing: target.facing ?? sessionSpawn(session, target.team).facing,
      damage: tagResult.damage,
      health: target.health,
      snowballs: attacker.snowballs,
      eliminated: true,
      converted: true,
      moneyAwarded: 0
    });
    io.to(gameplayRoom(session.sessionCode)).emit("world_impact", {
      attackerId: attacker.id,
      targetId: target.id,
      x: target.x ?? sessionSpawn(session, target.team).x,
      z: target.z ?? sessionSpawn(session, target.team).z,
      shield: false
    });
    broadcastPlayerState(session, [attacker, target]);
    finishZombieMatchIfComplete(session);
    return { ok: true as const, damage: tagResult.damage, nextHealth: DEFAULT_PLAYER_HEALTH, eliminated: true, moneyAwarded: 0, scoreDelta: 1 };
  }
  if (tagResult.eliminated) {
    const knockedOutPosition = {
      x: target.x ?? sessionSpawn(session, target.team).x,
      z: target.z ?? sessionSpawn(session, target.team).z
    };
    const baseSpawn = sessionSpawn(session, target.team);
    target.isAlive = false;
    target.respawnCorrectAnswers = 0;
    if (session.flag) {
      session.flag = resolveFlagDropForPlayer(session.flag, target, knockedOutPosition);
    }
    target.x = baseSpawn.x;
    target.y = baseSpawn.y;
    target.z = baseSpawn.z;
    target.facing = baseSpawn.facing;
    target.crouching = false;
    target.jumping = false;
    if (target.isBot) {
      botPreviousPositions.delete(target.id);
      if (session.settings.gameMode !== "flag") botRespawnAt.set(target.id, Date.now() + BOT_RESPAWN_MS);
    }
    attacker.money = Math.min(16000, attacker.money + tagResult.moneyAwarded);
    attacker.score += tagResult.scoreDelta;
    attacker.tags = (attacker.tags ?? 0) + 1;
    attacker.roundTags = (attacker.roundTags ?? 0) + 1;
    recordValidatedFreeze(session, attacker, target);
  }

  appendEvent(session, {
    type: tagResult.eliminated ? "elimination" : "tag",
    message: tagResult.eliminated
      ? `${attacker.nickname} has frozen ${target.nickname}.`
      : `${attacker.nickname} tagged ${target.nickname} for ${tagResult.damage} warmth.`,
    playerId: attacker.id,
    targetId: target.id,
    team: attacker.team
  });

  broadcastPlayerState(session, [attacker, target]);
  emitToPlayers(session, [attacker.id, target.id], "damage_result", {
    ok: true,
    attackerId: attacker.id,
    targetId: target.id,
    attackerX: attacker.x ?? sessionSpawn(session, attacker.team).x,
    attackerZ: attacker.z ?? sessionSpawn(session, attacker.team).z,
    targetX: target.x ?? sessionSpawn(session, target.team).x,
    targetZ: target.z ?? sessionSpawn(session, target.team).z,
    targetFacing: target.facing ?? sessionSpawn(session, target.team).facing,
    damage: tagResult.damage,
    health: target.health,
    snowballs: attacker.snowballs,
    eliminated: tagResult.eliminated,
    moneyAwarded: tagResult.moneyAwarded
  });
  io.to(gameplayRoom(session.sessionCode)).emit("world_impact", {
    attackerId: attacker.id,
    targetId: target.id,
    x: target.x ?? sessionSpawn(session, target.team).x,
    z: target.z ?? sessionSpawn(session, target.team).z,
    shield: !tagResult.eliminated
  });
  if (tagResult.eliminated) {
    emitToPlayers(session, [attacker.id, target.id], "elimination_update", {
      attackerId: attacker.id,
      targetId: target.id,
      moneyAwarded: tagResult.moneyAwarded
    });
  }

  evaluateFlagEliminationWin(session);
  finishZombieMatchIfComplete(session);

  return tagResult;
};

const applyAuthoritativePosition = (
  session: GameSession,
  player: PlayerSession,
  requested: {
    x?: number;
    z?: number;
    y?: number;
    facing?: number;
    sprinting?: boolean;
    crouching?: boolean;
    jumping?: boolean;
  },
  nowMs = Date.now()
) => {
  const fallback = sessionSpawn(session, player.team);
  const lastMoveAt = playerMoveTimestamps.get(player.id) ?? nowMs - BOT_TICK_MS;
  const elapsedMs = nowMs - lastMoveAt;
  const requestedX = Number.isFinite(Number(requested.x)) ? Number(requested.x) : player.x ?? fallback.x;
  const requestedZ = Number.isFinite(Number(requested.z)) ? Number(requested.z) : player.z ?? fallback.z;
  const currentX = player.x ?? fallback.x;
  const currentZ = player.z ?? fallback.z;
  const currentEyeHeight = player.crouching === true
    ? ARENA_PLAYER_CROUCH_EYE_HEIGHT
    : ARENA_PLAYER_EYE_HEIGHT;
  const requestedCrouching = typeof requested.crouching === "boolean"
    ? requested.crouching
    : player.crouching === true;
  const requestedEyeHeight = requestedCrouching
    ? ARENA_PLAYER_CROUCH_EYE_HEIGHT
    : ARENA_PLAYER_EYE_HEIGHT;
  let currentEyeY = player.y ?? fallback.y ?? getArenaEyeHeight(session.settings.mapId, currentX, currentZ);
  const recoveryGroundY = getArenaRecoveryGroundHeight(
    session.settings.mapId,
    currentX,
    currentZ,
    currentEyeY,
    currentEyeHeight
  );
  if (recoveryGroundY !== undefined) {
    currentEyeY = recoveryGroundY + currentEyeHeight;
    player.y = currentEyeY;
  }
  const requestedEyeY = Number.isFinite(Number(requested.y)) ? Number(requested.y) : currentEyeY;
  const requestedGroundY = getArenaGroundHeightForPlayer(
    session.settings.mapId,
    requestedX,
    requestedZ,
    requestedEyeY,
    requestedEyeHeight
  );
  const requestedStandingY = requestedGroundY + requestedEyeHeight;
  const requestedMovementY = Number.isFinite(Number(requested.y))
    ? Math.min(requestedStandingY + 4.5, Math.max(requestedStandingY, Number(requested.y)))
    : requestedStandingY;
  const currentPosition = {
    x: currentX,
    y: currentEyeY,
    z: currentZ,
    facing: player.facing ?? fallback.facing
  };
  playerPositionHistory.record(player.id, currentPosition, lastMoveAt);
  const sprintPolicy = resolveZombieSprintEnergy({
    gameMode: session.settings.gameMode,
    role: player.role,
    sprinting: requested.sprinting === true,
    currentEnergy: player.energy,
    elapsedMs,
    movedDistance: 0
  });
  const isZombieHuman = session.settings.gameMode === "zombie" && player.role !== "zombie";
  const hasMovementEnergy = !isZombieHuman || (player.energy ?? 0) > 0;
  const position = resolveAuthoritativeMovement({
    current: currentPosition,
    requested: {
      x: requestedX,
      z: requestedZ,
      y: requestedMovementY,
      facing: Number(requested.facing)
    },
    elapsedMs,
    maxSpeed: (
      !hasMovementEnergy
        ? 0
        : isZombieHuman && !sprintPolicy.canSprint
          ? ZOMBIE_HUMAN_WALK_MAX_SPEED
          : PLAYER_MAX_SPEED
    ) * getPlayerMoveSpeedMultiplier(player),
    obstacles: getArenaObstacles(session.settings.mapId),
    groundY: requestedGroundY,
    eyeHeight: requestedEyeHeight,
    mapId: session.settings.mapId
  });
  playerMoveTimestamps.set(player.id, nowMs);
  player.x = position.x;
  player.y = position.y ?? requestedStandingY;
  player.z = position.z;
  player.facing = position.facing;
  player.crouching = requestedCrouching;
  if (typeof requested.jumping === "boolean") {
    player.jumping = requested.jumping && !requestedCrouching;
  }
  if (session.settings.gameMode === "zombie" && player.role !== "zombie") {
    player.energy = resolveZombieSprintEnergy({
      gameMode: session.settings.gameMode,
      role: player.role,
      sprinting: requested.sprinting === true,
      currentEnergy: player.energy,
      elapsedMs,
      movedDistance: Math.hypot(position.x - currentPosition.x, position.z - currentPosition.z)
    }).nextEnergy;
  }
  playerPositionHistory.record(player.id, {
    x: player.x,
    y: player.y,
    z: player.z
  }, nowMs);
  return position;
};

type BotAlert = { position: { x: number; z: number }; createdAtMs: number; sourceId: string };
const botAlertsBySession = new Map<string, Map<Team, BotAlert>>();

const getBotBrain = (bot: PlayerSession, index: number, nowMs: number) => {
  let brain = botMemoryById.get(bot.id);
  if (!brain) {
    brain = createBotMemory(bot.id, index, nowMs);
    botMemoryById.set(bot.id, brain);
  }
  return brain;
};

const botPosition = (player: PlayerSession): ArenaPosition => ({
  x: player.x ?? 0,
  y: player.y ?? 0,
  z: player.z ?? 0,
  facing: player.facing ?? 0
});

const playersWithRewind = (players: PlayerSession[], nowMs = Date.now()) => players.map((player) => {
  const previous = player.isBot
    ? botPreviousPositions.get(player.id)
    : playerPositionHistory.rewind(player.id, nowMs);
  return previous
    ? { ...player, previousX: previous.x, previousY: previous.y, previousZ: previous.z }
    : player;
});

const horizontalDistance = (a: ArenaPosition, b: ArenaPosition) => Math.hypot(a.x - b.x, a.z - b.z);

const isBotEnemy = (session: GameSession, bot: PlayerSession, candidate: PlayerSession) => {
  if (candidate.id === bot.id || candidate.connectionState === "disconnected" || !candidate.isAlive) return false;
  if (session.settings.gameMode === "zombie") return candidate.role !== bot.role;
  return candidate.team !== bot.team;
};

const isInsideBotFov = (from: PlayerSession, to: PlayerSession, halfAngle: number) => {
  const fromPosition = botPosition(from);
  const targetPosition = botPosition(to);
  const distance = horizontalDistance(fromPosition, targetPosition);
  if (distance <= 0.001) return true;
  const forward = { x: -Math.sin(fromPosition.facing ?? 0), z: -Math.cos(fromPosition.facing ?? 0) };
  const direction = { x: (targetPosition.x - fromPosition.x) / distance, z: (targetPosition.z - fromPosition.z) / distance };
  return forward.x * direction.x + forward.z * direction.z >= Math.cos(halfAngle);
};

const canBotSee = (
  session: GameSession,
  bot: PlayerSession,
  target: PlayerSession,
  profile: (typeof BOT_DIFFICULTIES)[keyof typeof BOT_DIFFICULTIES],
  obstacles: ReturnType<typeof getArenaObstacles>
) => {
  const distance = horizontalDistance(botPosition(bot), botPosition(target));
  return distance <= profile.viewDistance
    && Math.abs((target.y ?? 0) - (bot.y ?? 0)) <= 5.5
    && isTargetInsideBotAwareness({
      distance,
      inFieldOfView: isInsideBotFov(bot, target, profile.viewHalfAngle)
    })
    && hasLineOfSight({ from: botPosition(bot), to: botPosition(target), obstacles });
};

const scaledPoint = (x: number, z: number) => ({ x: x * ARENA_SCALE, z: z * ARENA_SCALE });
const scaledLevelPoint = (x: number, z: number, groundY = 0) => ({
  x: x * ARENA_SCALE,
  y: groundY + ARENA_PLAYER_EYE_HEIGHT,
  z: z * ARENA_SCALE
});

const botBasePoint = (team: Team, mapId?: string) =>
  mapId === "desert_citadel"
    ? scaledPoint((team === "blue" ? -1 : 1) * 235, team === "blue" ? 58 : -58)
    : scaledPoint(
    (team === "blue" ? -1 : 1)
      * (mapId === "temple_runoff" ? 205 : mapId === "iron_junction" ? 248 : 142),
    0
  );
const botEnemyBasePoint = (team: Team, mapId?: string) =>
  mapId === "desert_citadel"
    ? scaledPoint((team === "blue" ? 1 : -1) * 235, team === "blue" ? -58 : 58)
    : scaledPoint(
    (team === "blue" ? 1 : -1)
      * (mapId === "temple_runoff" ? 205 : mapId === "iron_junction" ? 248 : 142),
    0
  );

const getIronJunctionPatrolPoints = (team: Team) => {
  const direction = team === "blue" ? 1 : -1;
  const longitudinal = [-185, -85, 65, 175].map((value) => value * direction);
  const upper = team === "blue"
    ? [
        scaledLevelPoint(-205, -57),
        scaledLevelPoint(-150, -57, IRON_JUNCTION_LOADING_LEVEL_Y),
        scaledLevelPoint(-105, -94, IRON_JUNCTION_OVERPASS_LEVEL_Y),
        scaledLevelPoint(20, 25, IRON_JUNCTION_OVERPASS_LEVEL_Y)
      ]
    : [
        scaledLevelPoint(165, 25),
        scaledLevelPoint(125, 25, IRON_JUNCTION_OVERPASS_LEVEL_Y),
        scaledLevelPoint(80, 25, IRON_JUNCTION_OVERPASS_LEVEL_Y),
        scaledLevelPoint(-20, 25, IRON_JUNCTION_OVERPASS_LEVEL_Y)
      ];
  const stages = longitudinal.map((x, stage) => [
    scaledLevelPoint(x, stage % 2 === 0 ? 0 : 42),
    scaledLevelPoint(x, -112 + stage * 8),
    scaledLevelPoint(x, 112 + stage * 12),
    scaledLevelPoint(x, 202 + stage * 5),
    upper[stage]
  ]);
  return stages.flat();
};

const getDesertCitadelPatrolPoints = (team: Team) => {
  const direction = team === "blue" ? 1 : -1;
  const xStages = [-182, -108, -20, 96].map((x) => x * direction);
  const upper = team === "blue"
    ? [
        scaledLevelPoint(-45, 0, DESERT_CITADEL_MAIN_LEVEL_Y),
        scaledLevelPoint(-116, 76, DESERT_CITADEL_ROOFTOP_LEVEL_Y),
        scaledLevelPoint(30, 40, DESERT_CITADEL_MAIN_LEVEL_Y),
        scaledLevelPoint(90, 70, DESERT_CITADEL_ROOFTOP_LEVEL_Y)
      ]
    : [
        scaledLevelPoint(90, 70, DESERT_CITADEL_ROOFTOP_LEVEL_Y),
        scaledLevelPoint(30, 40, DESERT_CITADEL_MAIN_LEVEL_Y),
        scaledLevelPoint(-116, 76, DESERT_CITADEL_ROOFTOP_LEVEL_Y),
        scaledLevelPoint(-45, 0, DESERT_CITADEL_MAIN_LEVEL_Y)
      ];
  const stages = xStages.map((x, stage) => {
    return [
      scaledLevelPoint(x, 0),
      scaledLevelPoint(x, stage < 3 ? 78 : 70),
      scaledLevelPoint(x, -118),
      scaledLevelPoint(x, stage === 0 || stage === 3 ? 133 : 60),
      upper[stage]
    ];
  });
  return stages.flat();
};

const getTempleRunoffPatrolPoints = (team: Team) => {
  const direction = team === "blue" ? 1 : -1;
  const xStages = [-190, -108, -12, 92, 190].map((x) => x * direction);
  return xStages.flatMap((x) => [
    scaledLevelPoint(x, -154, TEMPLE_RUNOFF_MAIN_LEVEL_Y),
    scaledLevelPoint(x, -86, TEMPLE_RUNOFF_MAIN_LEVEL_Y),
    scaledLevelPoint(x, 0),
    scaledLevelPoint(x, 86, TEMPLE_RUNOFF_MAIN_LEVEL_Y),
    scaledLevelPoint(x, 154, TEMPLE_RUNOFF_MAIN_LEVEL_Y)
  ]);
};

const getBotPatrolPoints = (team: Team, mapId?: string) => mapId === "temple_runoff"
  ? getTempleRunoffPatrolPoints(team)
  : mapId === "iron_junction"
    ? getIronJunctionPatrolPoints(team)
  : mapId === "desert_citadel"
    ? getDesertCitadelPatrolPoints(team)
  : [
      scaledPoint(0, -84),
      scaledPoint(team === "blue" ? -42 : 42, -28),
      scaledPoint(0, 28),
      scaledPoint(team === "blue" ? 42 : -42, 84),
      botBasePoint(team, mapId)
    ];

const findBotCover = (
  session: GameSession,
  bot: PlayerSession,
  threat: PlayerSession | undefined,
  obstacles: ReturnType<typeof getArenaObstacles>
) => {
  if (!threat) return undefined;
  const origin = botPosition(bot);
  const threatPosition = botPosition(threat);
  const candidates: Array<{ x: number; z: number; score: number }> = [];
  for (const obstacle of obstacles) {
    const awayX = obstacle.x - threatPosition.x;
    const awayZ = obstacle.z - threatPosition.z;
    const awayDistance = Math.hypot(awayX, awayZ) || 1;
    const padding = obstacle.kind === "circle" ? obstacle.radius + 4 : Math.max(obstacle.width, obstacle.depth) / 2 + 4;
    const points = [
      { x: obstacle.x + (awayX / awayDistance) * padding, z: obstacle.z + (awayZ / awayDistance) * padding },
      { x: obstacle.x - (awayZ / awayDistance) * padding, z: obstacle.z + (awayX / awayDistance) * padding },
      { x: obstacle.x + (awayZ / awayDistance) * padding, z: obstacle.z - (awayX / awayDistance) * padding }
    ];
    for (const point of points) {
      const candidate = clampArenaPosition({ ...point, facing: origin.facing ?? 0 }, session.settings.mapId);
      if (hasLineOfSight({ from: threatPosition, to: candidate, obstacles })) continue;
      const score = horizontalDistance(origin, candidate) - horizontalDistance(threatPosition, candidate) * 0.25;
      candidates.push({ ...candidate, score });
    }
  }
  return candidates.sort((a, b) => a.score - b.score)[0];
};

const applyBotSpacing = (session: GameSession, bot: PlayerSession, desired: { x: number; y?: number; z: number }) => {
  const spaced = resolveBotSpacingGoal({
    botId: bot.id,
    botPosition: botPosition(bot),
    desired,
    teammates: session.players.filter((player) => player.isAlive && player.team === bot.team)
  });
  return clampArenaPosition({ ...spaced, ...(Number.isFinite(desired.y) ? { y: desired.y } : {}), facing: bot.facing ?? 0 }, session.settings.mapId);
};

const getBotObjectiveGoal = (session: GameSession, bot: PlayerSession, brain: BotMemory, state: BotState) => {
  const flag = session.flag;
  const carrier = flag?.carrierId ? session.players.find((player) => player.id === flag.carrierId) : undefined;
  if (flag?.state === "carried" && carrier?.id === bot.id) return botEnemyBasePoint(bot.team, session.settings.mapId);
  if (state === "escort_flag_carrier" && carrier && carrier.team === bot.team) return { x: carrier.x ?? 0, z: (carrier.z ?? 0) + brain.strafeDirection * 8 };
  if (state === "attack_flag_carrier" && carrier && carrier.team !== bot.team) return botPosition(carrier);
  if (state === "defend_objective" && flag && ["placed", "being_captured"].includes(flag.state)) return flag.position;
  if (state === "move_to_objective" || state === "defend_objective") {
    if (flag && bot.team === "red" && ["available", "dropped"].includes(flag.state)) return flag.position;
    if (flag && flag.state === "carried" && carrier) return botPosition(carrier);
    return bot.team === "blue" ? botBasePoint(bot.team, session.settings.mapId) : botEnemyBasePoint(bot.team, session.settings.mapId);
  }
  if (state === "flank") {
    if (session.settings.mapId === "desert_citadel") {
      const lowerRoute = brain.routeIndex % 2 === 0;
      return lowerRoute
        ? scaledLevelPoint(brain.strafeDirection * 42, -118)
        : scaledLevelPoint(brain.strafeDirection * 72, 78);
    }
    const side = brain.routeIndex % 2 === 0 ? -1 : 1;
    return scaledPoint(side * 82, brain.strafeDirection * 72);
  }
  if (state === "search" && brain.lastSeenPosition) return brain.lastSeenPosition;
  if (state === "retreat" || state === "regroup" || state === "take_cover") return botBasePoint(bot.team, session.settings.mapId);
  const patrol = getBotPatrolPoints(bot.team, session.settings.mapId);
  return patrol[brain.routeIndex % patrol.length];
};

const shouldBotObjectiveAction = (session: GameSession, bot: PlayerSession) => {
  if (session.settings.gameMode !== "flag" || !session.flag) return false;
  const previous = session.flag.state;
  session.flag = resolveFlagPickup(session.flag, bot);
  session.flag = resolveFlagPlacement({
    flag: session.flag,
    player: bot,
    nowMs: Date.now(),
    holdSeconds: session.settings.flagHoldSeconds
  });
  session.flag = resolveFlagCapture(session.flag, bot);
  if (previous === session.flag.state) return false;
  if (session.flag.state === "placed") emitFlagPlanted(session, bot);
  appendEvent(session, {
    type: "timer",
    message: session.flag.state === "carried"
      ? `${bot.nickname} picked up the flag.`
      : session.flag.state === "placed"
        ? "The flag has been placed. Red must protect it."
        : session.flag.state === "captured"
          ? "Blue captured the flag."
          : "Flag updated.",
    playerId: bot.id,
    team: bot.team
  });
  const countdown = resolveFlagCountdown(session.flag, Date.now());
  if (countdown.winner) {
    finishRound(
      session,
      countdown.winner,
      countdown.reason === "flag_captured" ? "Blue Team captured the flag" : "Red Team protected the flag"
    );
  }
  return true;
};

const botFire = (
  session: GameSession,
  bot: PlayerSession,
  target: PlayerSession,
  brain: BotMemory,
  profile: (typeof BOT_DIFFICULTIES)[keyof typeof BOT_DIFFICULTIES],
  currentMs: number,
  obstacles: ReturnType<typeof getArenaObstacles>
) => {
  if (!canPlayerFireInMode(session.settings.gameMode, bot.role)) return false;
  if ((botNextAttackAt.get(bot.id) ?? 0) > currentMs) return false;
  const weaponId = getPlayerWeaponIdForMode(session.settings.gameMode, bot);
  const preference = getBotWeaponPreference(weaponId);
  const distance = horizontalDistance(botPosition(bot), botPosition(target));
  if (distance > getGearRange(weaponId)) return false;
  const aim = resolveBotAim({
    memory: brain,
    from: botPosition(bot),
    target: botPosition(target),
    currentFacing: bot.facing ?? 0,
    profile,
    movementPenalty: brain.state === "engage_enemy" ? 0.025 : 0.07,
    distance,
    nowMs: currentMs
  });
  bot.facing = aim.facing;
  if (!aim.aligned) return false;
  const botEyeY = bot.y
    ?? getArenaEyeHeight(session.settings.mapId, bot.x ?? 0, bot.z ?? 0);
  const targetEyeY = target.y
    ?? getArenaEyeHeight(session.settings.mapId, target.x ?? 0, target.z ?? 0);
  const aimPitch = clampArenaAimPitch(
    Math.atan2(targetEyeY - botEyeY, Math.max(0.001, distance))
  );
  const snowballUse = resolveSnowballUse(bot);
  if (!snowballUse.ok) return false;
  bot.snowballs = snowballUse.nextSnowballs;
  io.to(gameplayRoom(session.sessionCode)).emit("remote_weapon_fire", {
    playerId: bot.id,
    x: bot.x ?? sessionSpawn(session, bot.team).x,
    y: botEyeY,
    z: bot.z ?? sessionSpawn(session, bot.team).z,
    facing: bot.facing ?? sessionSpawn(session, bot.team).facing,
    pitch: aimPitch,
    gearId: weaponId,
    scoped: weaponId === "power_blaster" && brain.role === "overwatch",
    zoomLevel: weaponId === "power_blaster" && brain.role === "overwatch" ? 1 : 0
  });
  const targetSelection = resolveProjectileTarget({
    attacker: bot,
    candidates: playersWithRewind(session.players),
    requestedTargetId: target.id,
    range: getGearRange(weaponId),
    hitRadius: getGearHitRadius(weaponId, weaponId === "power_blaster" && brain.role === "overwatch" ? 1 : 0),
    obstacles,
    aimPitch
  });
  const shotDelay = Math.max(
    getGearFireCooldownMs(weaponId),
    weaponId === "quick_blaster" ? 360 : weaponId === "power_blaster" ? 1750 : 620
  );
  brain.burstShotsRemaining = brain.burstShotsRemaining > 1 ? brain.burstShotsRemaining - 1 : preference.burstSize;
  botNextAttackAt.set(
    bot.id,
    currentMs + (brain.burstShotsRemaining > 1 ? shotDelay : shotDelay + profile.firePauseMs + randomBetween(brain, 0, 260))
  );
  if (!targetSelection.ok) return true;
  const selectedTarget = session.players.find((player) => player.id === targetSelection.targetId);
  if (selectedTarget) applyValidatedDamage(session, bot, selectedTarget);
  return true;
};

export const advanceBots = () => {
  const currentMs = Date.now();
  for (const session of sessions.values()) {
    if (session.status === "paused") {
      const startsAtMs = session.roundTransition ? Date.parse(session.roundTransition.startsAt) : Number.NaN;
      if (Number.isFinite(startsAtMs) && currentMs >= startsAtMs) startPendingRound(session);
      continue;
    }
    if (session.status !== "active") continue;
    const announcementExpiresAtMs = session.announcement?.expiresAt
      ? Date.parse(session.announcement.expiresAt)
      : Number.NaN;
    if (Number.isFinite(announcementExpiresAtMs) && currentMs >= announcementExpiresAtMs) {
      session.announcement = undefined;
      broadcastSession(session);
    }
    if (session.settings.gameMode === "flag" && session.flag) {
      const flagCountdown = resolveFlagCountdown(session.flag, currentMs);
      if (flagCountdown.winner) {
        finishRound(
          session,
          flagCountdown.winner,
          flagCountdown.reason === "flag_captured" ? "Blue Team captured the flag" : "Red Team protected the flag"
        );
        continue;
      }
    }
    if (getRoundRemainingSeconds(session) <= 0) {
      if (session.settings.gameMode === "flag") {
        finishRound(session, "blue", "Time expired before Red placed the flag");
      } else if (session.settings.gameMode === "zombie") {
        finishZombieSession(session, "Humans survived until time expired.");
      } else {
        const winner = resolveTeamRoundWinner(session.players);
        finishRound(
          session,
          winner,
          winner
            ? "More tags, respawns, or quiz earnings when time expired"
            : "Teams tied on tags, respawns, and quiz earnings when time expired"
        );
      }
      continue;
    }
    let moved = false;
    session.players.forEach((bot, index) => {
      if (!bot.isBot) return;
      if (!bot.isAlive) {
        if (session.settings.gameMode === "flag") return;
        const respawn = resolveBotRespawn({
          bot,
          spawn: getBotSpawn(session, bot.team, index),
          nowMs: currentMs,
          respawnAtMs: botRespawnAt.get(bot.id),
          startingSnowballs: session.settings.startingSnowballs
        });
        if (respawn.respawned) {
          Object.assign(bot, respawn.player);
          bot.respawns = (bot.respawns ?? 0) + 1;
          bot.roundRespawns = (bot.roundRespawns ?? 0) + 1;
          botRespawnAt.delete(bot.id);
          botPreviousPositions.delete(bot.id);
          appendEvent(session, { type: "respawn", message: `${bot.nickname} returned to the arena.`, playerId: bot.id, team: bot.team });
          moved = true;
        }
        return;
      }
      const brain = getBotBrain(bot, index, currentMs);
      const profile = BOT_DIFFICULTIES[session.settings.botDifficulty ?? BOT_DIFFICULTY];
      const obstacles = getArenaObstacles(session.settings.mapId);
      const isZombieHumanBot = session.settings.gameMode === "zombie" && bot.role !== "zombie";
      if (isZombieHumanBot && (bot.energy ?? 0) <= 0) {
        bot.energy = awardZombieHumanEnergy({
          gameMode: "zombie",
          role: "human",
          isCorrect: true,
          currentEnergy: bot.energy
        });
      }
      const remainingSeconds = getRoundRemainingSeconds(session);
      const aliveTeammates = session.players.filter((player) => player.isAlive && player.team === bot.team);
      const nearbyAllies = aliveTeammates.filter((player) => player.id !== bot.id && horizontalDistance(botPosition(bot), botPosition(player)) < 30).length;
      const enemyPlayers = session.players.filter((player) => isBotEnemy(session, bot, player));
      const flagCarrier = session.flag?.carrierId ? session.players.find((player) => player.id === session.flag?.carrierId) : undefined;
      const objectiveUrgent = session.settings.gameMode === "flag" && Boolean(
        (bot.team === "red" && (session.flag?.state === "available" || session.flag?.state === "dropped"))
        ||
        (flagCarrier && flagCarrier.team !== bot.team)
        || (session.flag?.state === "placed" && (session.flag.expiresAtMs ?? currentMs + 99_999) - currentMs < 12_000)
        || remainingSeconds < 20
      );

      let visibleTargets: PlayerSession[] = [];
      if (currentMs >= brain.nextThinkAtMs) {
        brain.nextThinkAtMs = currentMs + profile.thinkIntervalMs + Math.floor(nextBotRandom(brain) * 120);
        brain.role = chooseBotRole({
          gameMode: session.settings.gameMode,
          team: bot.team,
          flagState: session.flag?.state,
          flagCarrierTeam: flagCarrier?.team,
          index,
          teammateCount: aliveTeammates.length,
          remainingSeconds,
          personality: brain.personality
        });
        const perceivedTargets = enemyPlayers
          .map((player) => ({ player, distance: horizontalDistance(botPosition(bot), botPosition(player)) }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 8)
          .filter((candidate) => canBotSee(session, bot, candidate.player, profile, obstacles));
        const perception = resolveBotPerceptionFocus({
          visibleTargetIds: perceivedTargets.map((candidate) => candidate.player.id),
          currentTargetId: brain.visibleTargetId,
          visibleSinceAtMs: brain.visibleSinceAtMs,
          nowMs: currentMs,
          reactionMs: profile.reactionMs
        });
        brain.visibleTargetId = perception.focusId;
        brain.visibleSinceAtMs = perception.visibleSinceAtMs;
        const focus = perceivedTargets.find((candidate) => candidate.player.id === perception.focusId)?.player;
        if (focus) {
          brain.lastSeenTargetId = focus.id;
          brain.lastSeenPosition = { x: focus.x ?? 0, z: focus.z ?? 0 };
          brain.lastSeenAtMs = currentMs;
        }
        if (perception.reacted) {
          visibleTargets = perceivedTargets.map((candidate) => candidate.player);
          const alerts = botAlertsBySession.get(session.sessionCode) ?? new Map<Team, BotAlert>();
          alerts.set(bot.team, {
            position: {
              x: (focus?.x ?? 0) + randomBetween(brain, -6, 6),
              z: (focus?.z ?? 0) + randomBetween(brain, -6, 6)
            },
            createdAtMs: currentMs,
            sourceId: bot.id
          });
          botAlertsBySession.set(session.sessionCode, alerts);
        }
        if (perceivedTargets.length === 0) {
          const alert = botAlertsBySession.get(session.sessionCode)?.get(bot.team);
          if (alert && currentMs - alert.createdAtMs < profile.memoryMs * 0.65 && alert.sourceId !== bot.id) {
            brain.lastSeenPosition = alert.position;
            brain.lastSeenAtMs = alert.createdAtMs;
          }
        }
        const targetChoice = chooseBotTarget({
          candidates: visibleTargets.map((candidate) => ({
            id: candidate.id,
            distance: horizontalDistance(botPosition(bot), botPosition(candidate)),
            health: candidate.health ?? DEFAULT_PLAYER_HEALTH,
            visible: true,
            isFlagCarrier: session.flag?.carrierId === candidate.id,
            attackingObjective: session.settings.gameMode === "flag" && session.flag?.state === "carried" && candidate.team === "red",
            alliesNearTarget: enemyPlayers.filter((ally) => horizontalDistance(botPosition(ally), botPosition(candidate)) < 14).length
          })),
          currentTargetId: brain.targetId,
          nowMs: currentMs,
          commitUntilMs: brain.targetCommitUntilMs,
          role: brain.role,
          personality: brain.personality,
          weaponRange: getGearRange(getPlayerWeaponIdForMode(session.settings.gameMode, bot))
        });
        if (targetChoice) {
          brain.targetId = targetChoice.id;
          brain.targetCommitUntilMs = currentMs + profile.targetCommitMs;
        } else if (!brain.lastSeenAtMs || currentMs - brain.lastSeenAtMs > profile.memoryMs) {
          brain.targetId = undefined;
          brain.lastSeenPosition = undefined;
          brain.lastSeenTargetId = undefined;
        }
        const target = brain.targetId ? session.players.find((player) => player.id === brain.targetId && isBotEnemy(session, bot, player)) : undefined;
        const targetVisible = Boolean(target && visibleTargets.some((player) => player.id === target.id));
        brain.state = resolveBotState({
          current: brain.state,
          health: bot.health ?? DEFAULT_PLAYER_HEALTH,
          maxHealth: getPlayerHealthMax(bot),
          targetVisible,
          hasLastKnownTarget: Boolean(brain.lastSeenPosition && brain.lastSeenAtMs && currentMs - brain.lastSeenAtMs <= profile.memoryMs),
          objectiveUrgent,
          role: brain.role,
          personality: brain.personality,
          alliesNearby: nearbyAllies,
          enemiesVisible: visibleTargets.length,
          flankAvailable: enemyPlayers.length > 0,
          randomValue: nextBotRandom(brain)
        });
        if (session.flag?.state === "carried" && flagCarrier && flagCarrier.team !== bot.team && brain.role === "interceptor" && !targetVisible) {
          brain.state = "attack_flag_carrier";
          brain.targetId = flagCarrier.id;
        }
      }

      const target = brain.targetId ? session.players.find((player) => player.id === brain.targetId && isBotEnemy(session, bot, player)) : undefined;
      const oldX = bot.x ?? sessionSpawn(session, bot.team).x;
      const oldY = bot.y;
      const oldZ = bot.z ?? sessionSpawn(session, bot.team).z;
      const oldFacing = bot.facing ?? 0;
      const preference = getBotWeaponPreference(getPlayerWeaponIdForMode(session.settings.gameMode, bot));
      let goal = getBotObjectiveGoal(session, bot, brain, brain.state);
      if (target && ["engage_enemy", "flank", "take_cover"].includes(brain.state)) {
        if (brain.state === "take_cover") {
          goal = findBotCover(session, bot, target, obstacles) ?? goal;
        } else if (brain.state === "engage_enemy" || brain.state === "flank") {
          const targetPosition = botPosition(target);
          const distance = horizontalDistance(botPosition(bot), targetPosition);
          if (distance > preference.preferredDistance) {
            const directionX = (targetPosition.x - oldX) / Math.max(distance, 1);
            const directionZ = (targetPosition.z - oldZ) / Math.max(distance, 1);
            goal = { x: targetPosition.x - directionX * preference.preferredDistance, z: targetPosition.z - directionZ * preference.preferredDistance };
          } else if (distance < preference.minimumDistance) {
            const directionX = (targetPosition.x - oldX) / Math.max(distance, 1);
            const directionZ = (targetPosition.z - oldZ) / Math.max(distance, 1);
            goal = { x: oldX - directionX * 8, z: oldZ - directionZ * 8 };
          } else {
            goal = {
              x: targetPosition.x + (-(targetPosition.z - oldZ) / Math.max(distance, 1)) * brain.strafeDirection * 12,
              z: targetPosition.z + ((targetPosition.x - oldX) / Math.max(distance, 1)) * brain.strafeDirection * 12
            };
          }
        }
      }
      let rawGoal = clampArenaPosition({ ...goal, facing: bot.facing ?? 0 }, session.settings.mapId);
      if (shouldAdvanceBotPatrolRoute({
        state: brain.state,
        hasTarget: Boolean(target),
        distanceToGoal: horizontalDistance(botPosition(bot), rawGoal)
      })) {
        brain.routeIndex += session.settings.mapId === "iron_junction"
          || session.settings.mapId === "desert_citadel"
          || session.settings.mapId === "temple_runoff"
          ? 5
          : 1;
        brain.navigationPath = undefined;
        goal = getBotObjectiveGoal(session, bot, brain, brain.state);
        rawGoal = clampArenaPosition({ ...goal, facing: bot.facing ?? 0 }, session.settings.mapId);
      }
      const navigationGoalChanged = !brain.navigationGoal
        || horizontalDistance({ ...brain.navigationGoal, facing: 0 }, rawGoal) > 10;
      if (navigationGoalChanged) brain.navigationPath = undefined;
      brain.navigationGoal = { x: rawGoal.x, z: rawGoal.z };
      while (brain.navigationPath?.length && horizontalDistance(botPosition(bot), { ...brain.navigationPath[0], facing: 0 }) < 3) {
        brain.navigationPath.shift();
      }
      if (!hasLineOfSight({ from: botPosition(bot), to: rawGoal, obstacles, padding: 0.7 })) {
        if (!brain.navigationPath?.length) {
          brain.navigationPath = findBotNavigationPath({
            from: botPosition(bot),
            to: rawGoal,
            obstacles,
            mapId: session.settings.mapId
          });
        }
        goal = brain.navigationPath?.[0] ?? rawGoal;
      } else {
        brain.navigationPath = undefined;
        goal = rawGoal;
      }
      const desired = applyBotSpacing(session, bot, clampArenaPosition({ ...goal, facing: bot.facing ?? 0 }, session.settings.mapId));
      desired.facing = Math.atan2(oldX - desired.x, oldZ - desired.z);
      const next = resolveBotRoamStep({
        current: { x: oldX, y: oldY, z: oldZ, facing: bot.facing ?? desired.facing },
        desired,
        elapsedMs: BOT_TICK_MS,
        speed: (
          isZombieHumanBot && (bot.energy ?? 0) <= 0
            ? 0
            : session.settings.gameMode === "zombie"
              ? bot.role === "zombie" ? 14.8 : 10.8
              : 19.5
        ) * getPlayerMoveSpeedMultiplier(bot),
        obstacles,
        detourDirection: brain.strafeDirection,
        mapId: session.settings.mapId
      });
      botPreviousPositions.set(bot.id, { x: oldX, y: oldY, z: oldZ });
      bot.x = next.x;
      const botGroundY = getArenaGroundHeightForPlayer(
        session.settings.mapId,
        next.x,
        next.z,
        oldY,
        ARENA_PLAYER_EYE_HEIGHT,
        1.4
      );
      bot.y = botGroundY + ARENA_PLAYER_EYE_HEIGHT;
      bot.z = next.z;
      const movedDistance = Math.hypot(next.x - oldX, next.z - oldZ);
      if (isZombieHumanBot) {
        bot.energy = resolveZombieSprintEnergy({
          gameMode: "zombie",
          role: "human",
          sprinting: true,
          currentEnergy: bot.energy,
          elapsedMs: BOT_TICK_MS,
          movedDistance
        }).nextEnergy;
      }
      if (movedDistance > 0.1) bot.facing = Math.atan2(next.x - oldX, next.z - oldZ);
      else bot.facing = next.facing;
      if (movedDistance > 0.01 || Math.abs((bot.facing ?? 0) - oldFacing) > 0.01) {
        broadcastPlayerPosition(session, {
          playerId: bot.id,
          x: bot.x,
          y: bot.y,
          z: bot.z,
          facing: bot.facing
        });
      }
      bot.snowballs = bot.snowballs ?? session.settings.startingSnowballs;
      moved = moved || movedDistance > 0.1;
      if (next.blocked || (horizontalDistance(botPosition(bot), { ...goal, y: bot.y }) > 5 && movedDistance < 0.1)) {
        brain.blockedTicks += 1;
        brain.noProgressTicks += 1;
      } else {
        brain.blockedTicks = 0;
        brain.noProgressTicks = 0;
      }
      if (brain.blockedTicks >= 3 || brain.noProgressTicks >= 8) {
        brain.state = "unstuck";
        brain.routeIndex += 1;
        brain.blockedTicks = 0;
        brain.noProgressTicks = 0;
        brain.nextThinkAtMs = currentMs;
      } else if (brain.state === "unstuck" && movedDistance > 0.1) {
        brain.state = "regroup";
      }

      const currentTargetVisible = Boolean(target && canBotSee(session, bot, target, profile, obstacles));
      if (target && currentTargetVisible && ["engage_enemy", "take_cover"].includes(brain.state)) {
        botFire(session, bot, target, brain, profile, currentMs, obstacles);
      }
      if (session.settings.gameMode === "flag" && session.flag && shouldBotAttemptFlagInteraction({
        flagState: session.flag.state,
        carrierId: session.flag.carrierId,
        botId: bot.id,
        botPosition: botPosition(bot),
        flagPosition: session.flag.position,
        interactionRadius: 7,
        placedAtMs: session.flag.placedAtMs,
        nowMs: currentMs,
        captureDelayMs: profile.objectiveCaptureDelayMs
      })) {
        moved = shouldBotObjectiveAction(session, bot) || moved;
      }
    });
    if (moved) broadcastSession(session);
  }
};

const checkQuizRateLimit = (playerId: string) => {
  const windowMs = 2500;
  const limit = 5;
  const current = Date.now();
  const hits = (quizRateLimits.get(playerId) ?? []).filter((hit) => current - hit < windowMs);
  if (hits.length >= limit) {
    quizRateLimits.set(playerId, hits);
    return false;
  }
  hits.push(current);
  quizRateLimits.set(playerId, hits);
  return true;
};

const registerFireRequest = (playerId: string, requestId: unknown) => {
  if (typeof requestId !== "string" || requestId.trim().length < 8 || requestId.length > 120) {
    return { ok: false, reason: "invalid_projectile" as const };
  }

  const current = Date.now();
  const cleanRequestId = requestId.trim();
  let playerRequests = fireRequestIds.get(playerId);
  if (!playerRequests) {
    playerRequests = new Map<string, number>();
    fireRequestIds.set(playerId, playerRequests);
  }
  for (const [seenRequestId, seenAt] of playerRequests) {
    if (current - seenAt > FIRE_REQUEST_TTL_MS) playerRequests.delete(seenRequestId);
  }
  if (playerRequests.has(cleanRequestId)) return { ok: false, reason: "duplicate_projectile" as const };
  playerRequests.set(cleanRequestId, current);
  return { ok: true as const };
};

const healthPayload = () => ({
  ok: true,
  service: "quizstrike-server",
  environment: process.env.NODE_ENV ?? "development",
  storage: prisma ? "postgres" : "memory",
  time: now()
});

app.get(["/health", "/api/health"], (_req, res) => {
  res.json(healthPayload());
});

app.post("/api/auth/signup", async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  const email = cleanEmail(String(req.body.email ?? ""));
  const password = String(req.body.password ?? "");

  if (name.length < 2 || !email.includes("@") || password.length < 8) {
    res.status(400).json({ error: "Enter a name, valid email, and password of at least 8 characters." });
    return;
  }

  if ([...users.values()].some((user) => user.email === email)) {
    res.status(409).json({ error: "A teacher with that email already exists." });
    return;
  }

  const user: StoredUser = {
    id: id(),
    name,
    email,
    role: "teacher",
    passwordHash: await bcrypt.hash(password, 10)
  };
  users.set(user.id, user);
  schedulePersistence();
  const teacher = publicUser(user);
  res.status(201).json({ user: teacher, token: makeToken(teacher) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = cleanEmail(String(req.body.email ?? ""));
  const password = String(req.body.password ?? "");
  const user = [...users.values()].find((candidate) => candidate.email === email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Email or password was not recognized." });
    return;
  }

  const teacher = publicUser(user);
  res.json({ user: teacher, token: makeToken(teacher) });
});

app.get("/api/me", requireTeacher, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

app.get("/api/teacher/dashboard", requireTeacher, async (req: AuthedRequest, res) => {
  const teacherId = req.user!.id;
  try {
    res.json({
      classes: [...classes.values()].filter((item) => item.teacherId === teacherId),
      quizSets: [...quizSets.values()].filter((item) => item.teacherId === teacherId),
      sessions: [...sessions.values()].filter((item) => item.teacherId === teacherId).map(stampSession),
      folders: [...folders.values()].filter((item) => item.teacherId === teacherId),
      reports: await durableReportMetadataForTeacher(teacherId)
    });
  } catch (error) {
    console.error("Failed to load teacher dashboard reports.", error);
    res.status(500).json({ error: "Teacher library could not be loaded." });
  }
});

app.post("/api/folders", requireTeacher, (req: AuthedRequest, res) => {
  const teacherId = req.user!.id;
  const normalized = normalizeFolderName(req.body?.name);
  if (!normalized.ok) {
    res.status(400).json({ error: normalized.error });
    return;
  }
  const parentId = typeof req.body?.parentId === "string" && req.body.parentId.trim() ? req.body.parentId.trim() : undefined;
  if (parentId) {
    const parent = folders.get(parentId);
    if (!parent || parent.teacherId !== teacherId) {
      res.status(404).json({ error: "Destination folder not found." });
      return;
    }
  }
  if (hasDuplicateSiblingName(folders.values(), teacherId, parentId, normalized.name)) {
    res.status(409).json({ error: "A folder with that name already exists here." });
    return;
  }
  const createdAt = now();
  const folder: QuizFolder = { id: id(), teacherId, parentId, name: normalized.name, createdAt, updatedAt: createdAt };
  folders.set(folder.id, folder);
  if (normalizedLibrary) mirrorNormalized(normalizedLibrary.saveFolder(folder), "folder creation");
  schedulePersistence();
  res.status(201).json({ folder });
});

app.patch("/api/folders/:id", requireTeacher, (req: AuthedRequest, res) => {
  const folder = folders.get(routeParam(req.params.id));
  if (!folder || folder.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Folder not found." });
    return;
  }
  const normalized = req.body?.name === undefined ? { ok: true as const, name: folder.name } : normalizeFolderName(req.body.name);
  if (!normalized.ok) {
    res.status(400).json({ error: normalized.error });
    return;
  }
  const parentId = req.body?.parentId === undefined
    ? folder.parentId
    : typeof req.body.parentId === "string" && req.body.parentId.trim() ? req.body.parentId.trim() : undefined;
  const move = canMoveFolder(folders.values(), folder, parentId);
  if (!move.ok) {
    res.status(400).json({ error: move.error });
    return;
  }
  if (hasDuplicateSiblingName(folders.values(), folder.teacherId, parentId, normalized.name, folder.id)) {
    res.status(409).json({ error: "A folder with that name already exists here." });
    return;
  }
  folder.name = normalized.name;
  folder.parentId = parentId;
  folder.updatedAt = now();
  if (normalizedLibrary) mirrorNormalized(normalizedLibrary.saveFolder(folder), "folder update");
  schedulePersistence();
  res.json({ folder });
});

app.delete("/api/folders/:id", requireTeacher, (req: AuthedRequest, res) => {
  const folder = folders.get(routeParam(req.params.id));
  if (!folder || folder.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Folder not found." });
    return;
  }
  const hasChildren = [...folders.values()].some((candidate) => candidate.parentId === folder.id);
  const hasQuizSets = [...quizSets.values()].some((quiz) => quiz.teacherId === folder.teacherId && quiz.folderId === folder.id);
  if (hasChildren || hasQuizSets) {
    res.status(409).json({ error: "Move or delete the items inside this folder before deleting it." });
    return;
  }
  folders.delete(folder.id);
  if (normalizedLibrary) mirrorNormalized(normalizedLibrary.deleteFolder(folder.teacherId, folder.id), "folder deletion");
  schedulePersistence();
  res.json({ deletedFolderId: folder.id });
});

app.patch("/api/quiz-sets/:id", requireTeacher, (req: AuthedRequest, res) => {
  const quiz = assertTeacherOwnsQuiz(req.user!.id, routeParam(req.params.id));
  if (!quiz) {
    res.status(404).json({ error: "Quiz set not found." });
    return;
  }
  const title = String(req.body?.title ?? quiz.title).trim();
  if (title.length < 2 || title.length > 160) {
    res.status(400).json({ error: "Quiz title must be between 2 and 160 characters." });
    return;
  }
  quiz.title = title;
  quiz.updatedAt = now();
  if (normalizedLibrary) mirrorNormalized(normalizedLibrary.updateQuizSetLibrary(quiz.teacherId, quiz.id, { title }), "quiz set rename");
  schedulePersistence();
  res.json({ quizSet: quiz });
});

app.post("/api/quiz-sets/:id/move", requireTeacher, (req: AuthedRequest, res) => {
  const quiz = assertTeacherOwnsQuiz(req.user!.id, routeParam(req.params.id));
  if (!quiz) {
    res.status(404).json({ error: "Quiz set not found." });
    return;
  }
  const folderId = typeof req.body?.folderId === "string" && req.body.folderId.trim() ? req.body.folderId.trim() : undefined;
  if (folderId) {
    const folder = folders.get(folderId);
    if (!folder || folder.teacherId !== quiz.teacherId) {
      res.status(400).json({ error: "Quiz sets can only move into one of your folders." });
      return;
    }
  }
  quiz.folderId = folderId;
  quiz.updatedAt = now();
  if (normalizedLibrary) mirrorNormalized(normalizedLibrary.updateQuizSetLibrary(quiz.teacherId, quiz.id, { folderId: folderId ?? null }), "quiz set move");
  schedulePersistence();
  res.json({ quizSet: quiz });
});

app.delete("/api/quiz-sets/:id", requireTeacher, (req: AuthedRequest, res) => {
  const quiz = assertTeacherOwnsQuiz(req.user!.id, routeParam(req.params.id));
  if (!quiz) {
    res.status(404).json({ error: "Quiz set not found." });
    return;
  }
  const activeSession = [...sessions.values()].find((session) => session.quizSetId === quiz.id && session.status !== "ended");
  if (activeSession) {
    res.status(409).json({ error: "This quiz set is used by an active game and cannot be deleted yet." });
    return;
  }
  quizSets.delete(quiz.id);
  if (normalizedLibrary) mirrorNormalized(normalizedLibrary.deleteQuizSet(quiz.teacherId, quiz.id), "quiz set deletion");
  schedulePersistence();
  res.json({ deletedQuizSetId: quiz.id });
});

app.get("/api/reports", requireTeacher, async (req: AuthedRequest, res) => {
  res.json({ reports: await durableReportMetadataForTeacher(req.user!.id) });
});

app.get("/api/reports/:id", requireTeacher, async (req: AuthedRequest, res) => {
  const reportId = routeParam(req.params.id);
  const durable = await normalizedLibrary?.getReport(req.user!.id, reportId);
  const report = durable ?? reports.get(reportId);
  const reportTeacherId = durable?.metadata.teacherId ?? (report as StoredReport | undefined)?.teacherId;
  if (!report || reportTeacherId !== req.user!.id) {
    res.status(404).json({ error: "Report not found." });
    return;
  }
  res.json({ report: report.report, metadata: durable?.metadata ?? reportMetadataForTeacher(req.user!.id).find((item) => item.id === reportId) });
});

app.delete("/api/reports/:id", requireTeacher, async (req: AuthedRequest, res) => {
  const reportId = routeParam(req.params.id);
  const deletedDurable = normalizedLibrary ? await normalizedLibrary.deleteReport(req.user!.id, reportId) : false;
  const report = reports.get(reportId);
  if (!deletedDurable && (!report || report.teacherId !== req.user!.id)) {
    res.status(404).json({ error: "Report not found or already deleted." });
    return;
  }
  reports.delete(reportId);
  schedulePersistence();
  res.json({ deletedReportId: reportId });
});

app.post("/api/classes", requireTeacher, (req: AuthedRequest, res) => {
  const name = String(req.body.name ?? "").trim();
  if (name.length < 2) {
    res.status(400).json({ error: "Class name is required." });
    return;
  }
  const klass = {
    id: id(),
    teacherId: req.user!.id,
    name,
    description: String(req.body.description ?? "").trim() || undefined,
    createdAt: now()
  };
  classes.set(klass.id, klass);
  if (normalizedLibrary) mirrorNormalized(normalizedLibrary.saveClass(klass), "class creation");
  schedulePersistence();
  res.status(201).json({ class: klass });
});

app.post("/api/quiz-sets", requireTeacher, (req: AuthedRequest, res) => {
  const title = String(req.body.title ?? "").trim();
  if (title.length < 2) {
    res.status(400).json({ error: "Quiz title is required." });
    return;
  }
  const quizSet: QuizSet = {
    id: id(),
    teacherId: req.user!.id,
    classId: String(req.body.classId ?? "") || undefined,
    folderId: String(req.body.folderId ?? "") || undefined,
    title,
    description: String(req.body.description ?? "").trim() || undefined,
    questions: [],
    createdAt: now()
  };
  quizSets.set(quizSet.id, quizSet);
  if (normalizedLibrary) mirrorNormalized(normalizedLibrary.saveQuizSet(quizSet), "quiz set creation");
  schedulePersistence();
  res.status(201).json({ quizSet });
});

app.get("/api/quiz-sets/:id", requireTeacher, (req: AuthedRequest, res) => {
  const quiz = assertTeacherOwnsQuiz(req.user!.id, routeParam(req.params.id));
  if (!quiz) {
    res.status(404).json({ error: "Quiz set not found." });
    return;
  }
  res.json({ quizSet: quiz });
});

app.post("/api/quiz-sets/:id/questions", requireTeacher, (req: AuthedRequest, res) => {
  const quiz = assertTeacherOwnsQuiz(req.user!.id, routeParam(req.params.id));
  if (!quiz) {
    res.status(404).json({ error: "Quiz set not found." });
    return;
  }
  if (!isChoice(req.body.correctChoice)) {
    res.status(400).json({ error: "Correct choice must be A, B, C, or D." });
    return;
  }

  const question: Question = {
    id: id(),
    quizSetId: quiz.id,
    prompt: String(req.body.prompt ?? "").trim(),
    choiceA: String(req.body.choiceA ?? "").trim(),
    choiceB: String(req.body.choiceB ?? "").trim(),
    choiceC: String(req.body.choiceC ?? "").trim(),
    choiceD: String(req.body.choiceD ?? "").trim(),
    correctChoice: req.body.correctChoice,
    explanation: String(req.body.explanation ?? "").trim() || undefined,
    difficulty: String(req.body.difficulty ?? "").trim() || undefined,
    createdAt: now()
  };

  if (!question.prompt || !question.choiceA || !question.choiceB || !question.choiceC || !question.choiceD) {
    res.status(400).json({ error: "Question prompt and four choices are required." });
    return;
  }

  quiz.questions.push(question);
  if (normalizedLibrary) mirrorNormalized(normalizedLibrary.saveQuestion(question), "question creation");
  schedulePersistence();
  res.status(201).json({ question, quizSet: quiz });
});

app.put("/api/questions/:id", requireTeacher, (req: AuthedRequest, res) => {
  const question = getQuizQuestion(routeParam(req.params.id));
  if (!question) {
    res.status(404).json({ error: "Question not found." });
    return;
  }
  const quiz = assertTeacherOwnsQuiz(req.user!.id, question.quizSetId);
  if (!quiz) {
    res.status(403).json({ error: "This question belongs to another teacher." });
    return;
  }
  if (isChoice(req.body.correctChoice)) question.correctChoice = req.body.correctChoice;
  question.prompt = String(req.body.prompt ?? question.prompt).trim();
  question.choiceA = String(req.body.choiceA ?? question.choiceA).trim();
  question.choiceB = String(req.body.choiceB ?? question.choiceB).trim();
  question.choiceC = String(req.body.choiceC ?? question.choiceC).trim();
  question.choiceD = String(req.body.choiceD ?? question.choiceD).trim();
  question.explanation = String(req.body.explanation ?? question.explanation ?? "").trim() || undefined;
  question.difficulty = String(req.body.difficulty ?? question.difficulty ?? "").trim() || undefined;
  schedulePersistence();
  res.json({ question, quizSet: quiz });
});

app.delete("/api/questions/:id", requireTeacher, (req: AuthedRequest, res) => {
  const question = getQuizQuestion(routeParam(req.params.id));
  if (!question) {
    res.status(404).json({ error: "Question not found." });
    return;
  }
  const quiz = assertTeacherOwnsQuiz(req.user!.id, question.quizSetId);
  if (!quiz) {
    res.status(403).json({ error: "This question belongs to another teacher." });
    return;
  }
  quiz.questions = quiz.questions.filter((item) => item.id !== question.id);
  schedulePersistence();
  res.json({ quizSet: quiz });
});

app.post("/api/sessions", requireTeacher, (req: AuthedRequest, res) => {
  const quiz = assertTeacherOwnsQuiz(req.user!.id, String(req.body.quizSetId ?? ""));
  if (!quiz || quiz.questions.length === 0) {
    res.status(400).json({ error: "Choose a quiz set with at least one question." });
    return;
  }
  const settings = createDefaultSettings(req.body.settings);
  const session: GameSession = {
    id: id(),
    teacherId: req.user!.id,
    classId: String(req.body.classId ?? "") || undefined,
    quizSetId: quiz.id,
    sessionCode: generateSessionCode(),
    status: "waiting",
    maxPlayers: settings.maxPlayers,
    currentRound: 1,
    settings,
    players: [],
    events: [],
    createdAt: now()
  };
  appendEvent(session, { type: "join", message: `Session ${session.sessionCode} created.` });
  sessions.set(session.id, session);
  schedulePersistence();
  res.status(201).json({ session: stampSession(session) });
});

app.post("/api/sessions/:code/start", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  const startCheck = canStartRound(session);
  if (!startCheck.ok) {
    res
      .status(400)
      .json({ error: startCheck.reason === "session_ended" ? "This session has ended." : "Add at least one student before starting." });
    return;
  }
  session.currentRound = 1;
  session.roundWins = { blue: 0, red: 0 };
  if (session.settings.gameMode === "flag" || session.settings.gameMode === "classic") {
    openRoundPreparation(session, false);
    appendEvent(session, {
      type: "start",
      message: `${session.settings.gameMode === "flag" ? "Flag Mode" : "Classic Tag"} round 1 preparation opened.`
    });
  } else if (session.settings.gameMode === "zombie") {
    openZombieSelectionPhase(session, false);
    appendEvent(session, {
      type: "start",
      message: "Zombie Mode preparation started. Everyone is Human for 20 seconds."
    });
  } else {
    startRoundState(session, false);
    session.announcement = makeAnnouncement(
      "round_start",
      session.settings.gameMode === "zombie" ? "Zombie Mode has begun!" : `Round ${session.currentRound} has begun!`,
      session.settings.gameMode === "zombie"
        ? "Red Zombies shoot to convert. Blue Humans answer correctly for running energy and survive without weapons."
        : "Most tags wins. Respawns, then quiz earnings break ties.",
      undefined,
      ROUND_START_ANNOUNCEMENT_MS
    );
    appendEvent(session, {
      type: "start",
      message: session.settings.gameMode === "zombie"
        ? "Zombie Mode started. Only Red Zombies can shoot; Blue Humans answer questions for running energy."
        : `Round started. Answer ${RESPAWN_CORRECT_ANSWERS_REQUIRED} practice questions to respawn if frozen out.`
    });
  }
  broadcastSession(session);
  res.json({ session: stampSession(session) });
});

app.post("/api/sessions/:code/end", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  if (session.settings.gameMode === "zombie") {
    finishZombieSession(session, "The teacher ended Zombie Mode.");
  } else {
    finishSession(session, "Teacher ended the round. Report is ready.");
  }
  res.json({ report: makeReport(session) });
});

app.post("/api/sessions/:code/end-round", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  if (session.settings.gameMode === "zombie") {
    res.status(400).json({ error: "Zombie Mode is a single survival round. Use End Game to stop it." });
    return;
  }
  if (session.status !== "active") {
    res.status(409).json({ error: "A round must be active before it can be ended early." });
    return;
  }
  finishRound(session, undefined, "Teacher ended the round early");
  const responseSession = stampSession(session);
  res.json({
    session: responseSession,
    ...(responseSession.status === "ended" ? { report: makeReport(session) } : {})
  });
});

app.post("/api/sessions/:code/bots", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  if (session.status === "ended") {
    res.status(400).json({ error: "This session has ended." });
    return;
  }
  const remainingSlots = session.maxPlayers - session.players.length;
  if (remainingSlots <= 0) {
    res.status(400).json({ error: "This session is full." });
    return;
  }

  const requestedCount = req.body?.count === undefined ? 1 : Number(req.body.count);
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    res.status(400).json({ error: "Choose at least one bot." });
    return;
  }
  const difficulty: BotDifficulty = req.body?.difficulty === "beginner" || req.body?.difficulty === "advanced"
    ? req.body.difficulty
    : req.body?.difficulty === "standard"
      ? "standard"
      : session.settings.botDifficulty ?? BOT_DIFFICULTY;
  const count = Math.min(requestedCount, remainingSlots);
  session.settings.botDifficulty = difficulty;
  const bots: PlayerSession[] = [];
  const firstBotIndex = session.players.filter((player) => player.isBot).length;
  for (let offset = 0; offset < count; offset += 1) {
    const blueCount = session.players.filter((player) => player.team === "blue").length;
    const redCount = session.players.filter((player) => player.team === "red").length;
    const team: Team = blueCount <= redCount ? "blue" : "red";
    const botIndex = firstBotIndex + offset;
    const spawn = session.status === "active" ? getBotSpawn(session, team, botIndex) : selectSessionSpawn(session, team, botIndex);
    const bot: PlayerSession = {
      id: id(),
      gameSessionId: session.id,
      nickname: `${botNames[botIndex % botNames.length]} Bot ${botIndex + 1}`,
      team,
      money: session.settings.startingMoney,
      quizMoneyEarned: 0,
      roundQuizMoneyEarned: 0,
      moneySpent: 0,
      isAlive: true,
      isBot: true,
      role: "human",
      tags: 0,
      roundTags: 0,
      respawns: 0,
      roundRespawns: 0,
      connectionState: "connected",
      health: DEFAULT_PLAYER_HEALTH,
      snowballs: session.settings.startingSnowballs,
      respawnCorrectAnswers: 0,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      facing: spawn.facing,
      score: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      gear: "starter_blaster",
      weapon: "starter_blaster",
      perks: [],
      appearance: { ...DEFAULT_PLAYER_APPEARANCE },
      joinedAt: now()
    };
    session.players.push(bot);
    bots.push(bot);
  }
  appendEvent(session, {
    type: "join",
    message: `${count} ${difficulty} test bot${count === 1 ? "" : "s"} added to the room.`,
    team: undefined
  });
  broadcastSession(session);
  res.status(201).json({ session: stampSession(session), bots, difficulty });
});

app.delete("/api/sessions/:code/players/:playerId", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  if (session.status === "ended") {
    res.status(400).json({ error: "Players cannot be removed after the session has ended." });
    return;
  }

  const playerId = routeParam(req.params.playerId);
  const playerIndex = session.players.findIndex((candidate) => candidate.id === playerId);
  if (playerIndex < 0) {
    res.status(404).json({ error: "Player not found." });
    return;
  }

  const player = session.players[playerIndex]!;
  if (session.flag?.carrierId === player.id) {
    session.flag = resolveFlagDropForPlayer(session.flag, player, {
      x: player.x ?? 0,
      z: player.z ?? 0
    });
  }
  evictPlayerSockets(session, player);
  removePlayerRuntimeState(session, player);
  session.players.splice(playerIndex, 1);
  appendEvent(session, {
    type: "timer",
    message: `${player.nickname} was removed by the teacher.`,
    team: player.team
  });

  const statusBeforeEvaluation = session.status;
  evaluateFlagEliminationWin(session);
  finishZombieMatchIfComplete(session);
  if (session.status === statusBeforeEvaluation) broadcastSession(session);

  res.json({ session: stampSession(session), removedPlayerId: player.id });
});

app.get("/api/sessions/:code", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  const teacher = getBearerUser(req);
  const playerToken = getPlayerToken(req);
  const canRead = teacher?.id === session.teacherId
    || session.players.some((player) => !player.isBot && hasPlayerAccess(session, player, playerToken));
  if (!canRead) {
    res.status(401).json({ error: "A teacher or student session token is required." });
    return;
  }
  res.json({ session: stampSession(session) });
});

app.get("/api/sessions/:code/report", requireTeacher, async (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  const stored = [...reports.values()].find((candidate) => candidate.sessionId === session.id && candidate.teacherId === req.user!.id);
  const durable = await normalizedLibrary?.getReportForSession(req.user!.id, session.id);
  res.json({ report: durable?.report ?? stored?.report ?? makeReport(session), metadata: durable?.metadata ?? (stored ? reportMetadataForTeacher(req.user!.id).find((item) => item.id === stored.id) : undefined) });
});

app.get("/api/sessions/:code/report.csv", requireTeacher, async (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  const stored = [...reports.values()].find((candidate) => candidate.sessionId === session.id && candidate.teacherId === req.user!.id);
  const durable = await normalizedLibrary?.getReportForSession(req.user!.id, session.id);
  const fallbackStored = stored ?? saveSessionReport(session);
  const metadata = durable?.metadata ?? fallbackStored;
  const report = durable?.report ?? fallbackStored.report;
  res
    .status(200)
    .type("text/csv")
    .setHeader("Content-Disposition", `attachment; filename="${sanitizeExportFilename(metadata.displayName)}.csv"`)
    .send(buildCsvReport(report));
});

app.post("/api/sessions/:code/join", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const nickname = String(req.body.nickname ?? "").trim();
  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  if (session.status === "ended") {
    res.status(400).json({ error: "This session has ended." });
    return;
  }
  if (nickname.length < 2 || nickname.length > 20) {
    res.status(400).json({ error: "Nickname must be 2 to 20 characters." });
    return;
  }
  const nicknameError = getNicknameError(nickname);
  if (nicknameError) {
    res.status(400).json({ error: nicknameError });
    return;
  }
  const returningPlayer = session.players.find(
    (player) => !player.isBot && player.nickname.toLowerCase() === nickname.toLowerCase()
  );
  if (returningPlayer?.connectionState === "disconnected") {
    clearPlayerDisconnectTimer(session, returningPlayer.id);
    returningPlayer.connectionState = "connected";
    const playerToken = makePlayerToken(session, returningPlayer);
    const question = returningPlayer.isAlive || session.settings.deadPlayersCanPractice
      ? issueNextQuestion(session, returningPlayer.id)
      : undefined;
    appendEvent(session, {
      type: "timer",
      message: `${returningPlayer.nickname} rejoined the game.`,
      playerId: returningPlayer.id,
      team: returningPlayer.team
    });
    broadcastSession(session);
    res.status(200).json({
      session: stampSession(session),
      player: returningPlayer,
      playerToken,
      cosmeticProgressToken: makeCosmeticProgressToken(returningPlayer),
      question
    });
    return;
  }
  if (returningPlayer) {
    res.status(409).json({ error: "That nickname is already taken in this session." });
    return;
  }
  if (session.players.length >= session.maxPlayers) {
    res.status(400).json({ error: "This session is full." });
    return;
  }
  const isLateJoin = session.status !== "waiting";
  const blueCount = session.players.filter((player) => player.team === "blue").length;
  const redCount = session.players.filter((player) => player.team === "red").length;
  const team: Team = isLateJoin
    ? selectLateJoinTeam(session.players)
    : blueCount <= redCount ? "blue" : "red";
  const zombieRole = isLateJoin && session.settings.gameMode === "zombie"
    ? team === "red" ? "zombie" : "human"
    : "human";
  const spawn = selectSessionSpawn(session, team);
  const player: PlayerSession = {
    id: id(),
    gameSessionId: session.id,
    nickname,
    team,
    money: session.settings.startingMoney,
    quizMoneyEarned: 0,
    roundQuizMoneyEarned: 0,
    moneySpent: 0,
    isAlive: true,
    role: zombieRole,
    tags: 0,
    roundTags: 0,
    respawns: 0,
    roundRespawns: 0,
    cosmeticXp: readCosmeticProgressToken(req.body.cosmeticProgressToken),
    connectionState: "connected",
    health: DEFAULT_PLAYER_HEALTH,
    energy: isLateJoin && session.settings.gameMode === "zombie"
      ? zombieRole === "zombie" ? ZOMBIE_HUMAN_MAX_ENERGY : 0
      : undefined,
    snowballs: isLateJoin && session.settings.gameMode === "zombie" && zombieRole === "human"
      ? 0
      : session.settings.startingSnowballs,
    respawnCorrectAnswers: 0,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    facing: spawn.facing,
    score: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    gear: "starter_blaster",
    weapon: "starter_blaster",
    perks: [],
    appearance: { ...DEFAULT_PLAYER_APPEARANCE },
    joinedAt: now()
  };
  session.players.push(player);
  const playerToken = makePlayerToken(session, player);
  appendEvent(session, {
    type: "join",
    message: isLateJoin
      ? `${player.nickname} joined the live game on ${team === "blue" ? "Blue" : "Red"} Team.`
      : session.settings.gameMode === "zombie"
      ? `${player.nickname} joined the Zombie Mode lobby.`
      : `${player.nickname} joined ${team === "blue" ? "Blue" : "Red"} Team.`,
    playerId: player.id,
    team
  });
  broadcastSession(session);
  res.status(201).json({
    session: stampSession(session),
    player,
    playerToken,
    cosmeticProgressToken: makeCosmeticProgressToken(player),
    question: issueNextQuestion(session, player.id)
  });
});

app.get("/api/sessions/:code/players/:playerId/rejoin", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === routeParam(req.params.playerId));
  if (!session || !player || player.isBot) {
    res.status(404).json({ error: "This student session is no longer available." });
    return;
  }
  if (!requirePlayerAccess(req, res, session, player)) return;

  clearPlayerDisconnectTimer(session, player.id);
  player.connectionState = "connected";
  const question =
    session.status !== "ended" && (player.isAlive || session.settings.deadPlayersCanPractice)
      ? issueNextQuestion(session, player.id)
      : undefined;
  broadcastSession(session);
  res.json({
    session: stampSession(session),
    player,
    cosmeticProgressToken: makeCosmeticProgressToken(player),
    question
  });
});

app.post("/api/sessions/:code/players/:playerId/team", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === routeParam(req.params.playerId));
  const requestedTeam = req.body.team === "red" || req.body.team === "blue" ? req.body.team : undefined;
  if (!session || !player) {
    res.status(404).json({ error: "Player session not found." });
    return;
  }
  if (!requirePlayerAccess(req, res, session, player)) return;
  if (session.status !== "waiting" || session.settings.teamAssignment !== "players_choose") {
    res.status(400).json({ error: "Team changes are closed for this round." });
    return;
  }
  if (!requestedTeam) {
    res.status(400).json({ error: "Choose Red Team or Blue Team." });
    return;
  }
  if (player.team !== requestedTeam) resetFreezeStreak(player);
  player.team = requestedTeam;
  const spawn = selectSessionSpawn(session, player.team);
  player.x = spawn.x;
  player.y = spawn.y;
  player.z = spawn.z;
  player.facing = spawn.facing;
  appendEvent(session, {
    type: "join",
    message: `${player.nickname} chose ${requestedTeam === "red" ? "Red Team" : "Blue Team"}.`,
    playerId: player.id,
    team: player.team
  });
  broadcastSession(session);
  res.json({ session: stampSession(session), player });
});

app.put("/api/sessions/:code/players/:playerId/appearance", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === routeParam(req.params.playerId));
  if (!session || !player || player.isBot) {
    res.status(404).json({ error: "Player session not found." });
    return;
  }
  if (!requirePlayerAccess(req, res, session, player)) return;
  const policy = session.settings.characterCustomization;
  if (session.status !== "waiting" || !policy.enabled) {
    res.status(423).json({ error: "Character customization is locked." });
    return;
  }
  const lastUpdate = appearanceUpdateTimestamps.get(player.id) ?? 0;
  if (Date.now() - lastUpdate < APPEARANCE_UPDATE_COOLDOWN_MS) {
    res.status(429).json({ error: "Please wait a moment before saving again." });
    return;
  }
  const input = req.body?.appearance ?? req.body;
  const validationError = getPlayerAppearanceError(input);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  const appearance = sanitizePlayerAppearance(input as Partial<PlayerAppearance>);
  const lockedItems = getLockedAppearanceItems(appearance, getCosmeticProgress(player).level);
  if (lockedItems.length > 0) {
    res.status(403).json({ error: `${lockedItems[0].name} unlocks at cosmetic level ${lockedItems[0].unlockLevel}.` });
    return;
  }
  if (appearance.decalAssetId) {
    const decal = decalStore.get(appearance.decalAssetId);
    if (!policy.uploadsEnabled || !decal || decal.sessionId !== session.id || decal.playerId !== player.id) {
      res.status(400).json({ error: "That decal is not available for this player." });
      return;
    }
  }
  if (player.appearance?.decalAssetId !== appearance.decalAssetId) deleteDecal(player.appearance?.decalAssetId);
  player.appearance = appearance;
  appearanceUpdateTimestamps.set(player.id, Date.now());
  broadcastSession(session);
  res.json({ session: stampSession(session), player });
});

app.post("/api/sessions/:code/players/:playerId/decals", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === routeParam(req.params.playerId));
  if (!session || !player || player.isBot) {
    res.status(404).json({ error: "Player session not found." });
    return;
  }
  if (!requirePlayerAccess(req, res, session, player)) return;
  const policy = session.settings.characterCustomization;
  if (session.status !== "waiting" || !policy.enabled || !policy.uploadsEnabled) {
    res.status(423).json({ error: "Uploaded decals are not enabled for this room." });
    return;
  }
  if (!checkDecalUploadRate(player.id)) {
    res.status(429).json({ error: "Upload limit reached. Try again in one minute." });
    return;
  }
  const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const mimeType = inspectProcessedDecal(bytes, req.header("content-type")?.split(";")[0]);
  if (!mimeType || bytes.length === 0 || bytes.length > DECAL_MAX_PROCESSED_BYTES) {
    res.status(415).json({ error: "Upload a processed PNG or WebP decal within the size limit." });
    return;
  }
  const assetId = id();
  const stored = decalStore.put(
    { id: assetId, sessionId: session.id, playerId: player.id, mimeType: mimeType as StoredDecalMime, bytes, createdAt: Date.now() },
    player.appearance?.decalAssetId
  );
  if (!stored.ok) {
    res.status(413).json({ error: "This room's sticker storage is full. Ask your teacher to remove an older sticker." });
    return;
  }
  res.status(201).json({ assetId, mimeType, bytes: bytes.length });
});

app.get("/api/sessions/:code/decals", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  const assets = decalStore.listSession(session.id).map((asset) => {
    const player = session.players.find((candidate) => candidate.id === asset.playerId);
    return {
      ...asset,
      nickname: player?.nickname ?? "Former player",
      createdAt: new Date(asset.createdAt).toISOString(),
      expiresAt: new Date(asset.expiresAt).toISOString(),
      isActive: player?.appearance?.decalAssetId === asset.assetId
    };
  });
  res.json({ assets, totalBytes: decalStore.getSessionBytes(session.id), maxBytes: decalStore.roomMaxBytes });
});

app.get("/api/sessions/:code/decals/:assetId", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const decal = decalStore.get(routeParam(req.params.assetId));
  if (!session || !decal || decal.sessionId !== session.id) {
    res.status(404).json({ error: "Decal not found." });
    return;
  }
  if (!canReadRoomAsset(req, session)) {
    res.status(401).json({ error: "Room access is required." });
    return;
  }
  res.setHeader("Cache-Control", "private, max-age=3600, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).type(decal.mimeType).send(decal.bytes);
});

app.put("/api/sessions/:code/customization", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  if (session.status !== "waiting") {
    res.status(423).json({ error: "Customization settings are locked after the match starts." });
    return;
  }
  const requested = sanitizeCharacterCustomizationSettings(req.body);
  if (requested.aiEnabled && !aiSkinProviderConfigured) {
    res.status(400).json({ error: "AI designs require a configured secure server provider." });
    return;
  }
  if (!requested.uploadsEnabled) {
    for (const player of session.players) {
      if (player.appearance?.decalAssetId) {
        player.appearance = { ...player.appearance, decalAssetId: undefined };
      }
    }
    decalStore.deleteSession(session.id);
  }
  session.settings.characterCustomization = requested;
  broadcastSession(session);
  res.json({ session: stampSession(session), aiProviderConfigured: aiSkinProviderConfigured });
});

app.delete("/api/sessions/:code/players/:playerId/appearance", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === routeParam(req.params.playerId));
  if (!session || session.teacherId !== req.user!.id || !player) {
    res.status(404).json({ error: "Player session not found." });
    return;
  }
  clearPlayerAppearance(session, player);
  appendEvent(session, { type: "timer", message: `Teacher cleared ${player.nickname}'s custom appearance.`, playerId: player.id, team: player.team });
  broadcastSession(session);
  res.json({ session: stampSession(session), player });
});

app.delete("/api/sessions/:code/players/:playerId/decal", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === routeParam(req.params.playerId));
  if (!session || session.teacherId !== req.user!.id || !player) {
    res.status(404).json({ error: "Player session not found." });
    return;
  }
  decalStore.deletePlayer(session.id, player.id);
  player.appearance = { ...sanitizePlayerAppearance(player.appearance), decalAssetId: undefined };
  appendEvent(session, { type: "timer", message: `Teacher removed ${player.nickname}'s custom sticker.`, playerId: player.id, team: player.team });
  broadcastSession(session);
  res.json({ session: stampSession(session), player });
});

app.delete("/api/sessions/:code/decals/:assetId", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const assetId = routeParam(req.params.assetId);
  const decal = decalStore.get(assetId);
  if (!session || session.teacherId !== req.user!.id || !decal || decal.sessionId !== session.id) {
    res.status(404).json({ error: "Decal not found." });
    return;
  }
  decalStore.delete(assetId);
  const player = session.players.find((candidate) => candidate.id === decal.playerId);
  if (player?.appearance?.decalAssetId === assetId) player.appearance = { ...player.appearance, decalAssetId: undefined };
  appendEvent(session, { type: "timer", message: `Teacher removed ${player?.nickname ?? "a player's"} custom sticker.`, playerId: player?.id, team: player?.team });
  broadcastSession(session);
  res.json({ session: stampSession(session) });
});

app.post("/api/sessions/:code/appearance/reset", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  session.players.forEach((player) => clearPlayerAppearance(session, player));
  decalStore.deleteSession(session.id);
  appendEvent(session, { type: "timer", message: "Teacher reset all custom appearances." });
  broadcastSession(session);
  res.json({ session: stampSession(session) });
});

app.get("/api/sessions/:code/players/:playerId/question", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === routeParam(req.params.playerId));
  if (!session || !player) {
    res.status(404).json({ error: "Player session not found." });
    return;
  }
  if (!requirePlayerAccess(req, res, session, player)) return;
  if (!player.isAlive && !session.settings.deadPlayersCanPractice) {
    res.status(400).json({ error: "Practice questions are disabled while out for the round." });
    return;
  }
  const question = issueNextQuestion(session, player.id);
  if (!question) {
    res.status(404).json({ error: "No questions are available in this session." });
    return;
  }
  res.json({ question });
});

type StudentCommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

type GearPurchaseResponse = {
  player: PlayerSession;
  gear: (typeof GEAR_ITEMS)[number];
  message: string;
};

type SnowballPurchaseResponse = { player: PlayerSession; message: string };

const failStudentCommand = (status: number, error: string): StudentCommandResult<never> => ({ ok: false, status, error });

const answerQuestion = (
  session: GameSession,
  player: PlayerSession,
  body: { questionId?: unknown; selectedChoice?: unknown }
): StudentCommandResult<{ result: QuizResult; cosmeticProgressToken: string }> => {
  if (session.status !== "active" && !isRoundPreparationPhase(session) && !isZombieSelectionPhase(session)) {
    return failStudentCommand(400, inactiveRoundMessage(session));
  }
  if (!player.isAlive && !session.settings.deadPlayersCanPractice) {
    return failStudentCommand(400, "Practice questions are disabled while out for the round.");
  }
  if (!checkQuizRateLimit(player.id)) {
    return failStudentCommand(429, "Slow down before answering another question.");
  }
  const question = getQuizQuestion(String(body.questionId ?? ""));
  const selectedChoice = body.selectedChoice;
  if (!question || question.quizSetId !== session.quizSetId || !isChoice(selectedChoice)) {
    return failStudentCommand(400, "Question or answer choice is invalid.");
  }

  const gatedQuestion = playerQuestionGate.consume(player.id, question.id);
  if (!gatedQuestion.ok) {
    return failStudentCommand(409, "Answer the currently assigned question before submitting.");
  }

  const responseTimeMs = gatedQuestion.responseTimeMs;
  const isCorrect = question.correctChoice === selectedChoice;
  const answerContext: AnswerLog["context"] = player.isAlive ? "main" : "practice";
  const reward = resolveAnswerReward({ player, settings: session.settings, isCorrect, responseTimeMs });
  player.money = reward.nextMoney;
  player.quizMoneyEarned = (player.quizMoneyEarned ?? 0) + reward.moneyAwarded;
  player.roundQuizMoneyEarned = (player.roundQuizMoneyEarned ?? 0) + reward.moneyAwarded;
  player.score += reward.scoreDelta;
  player.correctAnswers += reward.correctDelta;
  player.wrongAnswers += reward.wrongDelta;
  const previousEnergy = player.energy ?? 0;
  player.energy = awardZombieHumanEnergy({
    gameMode: session.settings.gameMode,
    role: player.role,
    isCorrect,
    currentEnergy: player.energy
  });
  const energyAwarded = Math.max(0, player.energy - previousEnergy);
  if (reward.correctDelta > 0) player.cosmeticXp = Math.max(0, player.cosmeticXp ?? 0) + reward.correctDelta * 100;
  const respawn =
    session.settings.gameMode === "flag"
      ? {
          player,
          respawned: false,
          progress: player.respawnCorrectAnswers ?? 0,
          required: RESPAWN_CORRECT_ANSWERS_REQUIRED
        }
      : resolvePracticeRespawn({ player, settings: session.settings, isCorrect });
  Object.assign(player, respawn.player);
  if (respawn.respawned) {
    player.respawns = (player.respawns ?? 0) + 1;
    player.roundRespawns = (player.roundRespawns ?? 0) + 1;
    player.crouching = false;
    player.jumping = false;
  }

  const answer: AnswerLog = {
    id: id(),
    gameSessionId: session.id,
    playerSessionId: player.id,
    questionId: question.id,
    selectedChoice,
    isCorrect,
    moneyAwarded: reward.moneyAwarded,
    answeredAt: now(),
    responseTimeMs,
    context: answerContext
  };
  answers.push(answer);

  const feedback = isCorrect
    ? respawn.respawned
      ? "Respawned! Three correct practice answers brought you back."
      : energyAwarded > 0
        ? `Correct! +${energyAwarded} running energy`
      : reward.moneyAwarded > 0
        ? `Correct! +$${reward.moneyAwarded}`
        : session.settings.gameMode === "flag" && !player.isAlive
          ? "Correct practice answer. You will return when the next round begins."
        : `Correct practice answer. Respawn progress ${respawn.progress}/${respawn.required}.`
    : "Incorrect. Try another question.";

  appendEvent(session, {
    type: "answer",
    message: `${player.nickname} answered ${isCorrect ? "correctly" : "incorrectly"}${respawn.respawned ? " and respawned" : ""}.`,
    playerId: player.id,
    team: player.team
  });
  if (respawn.respawned) {
    appendEvent(session, {
      type: "respawn",
      message: `${player.nickname} respawned after ${RESPAWN_CORRECT_ANSWERS_REQUIRED} correct practice answers.`,
      playerId: player.id,
      team: player.team
    });
  }

  const result: QuizResult = {
    isCorrect,
    correctChoice: question.correctChoice,
    moneyAwarded: reward.moneyAwarded,
    feedback,
    explanation: question.explanation,
    player,
    nextQuestion: issueNextQuestion(session, player.id),
    respawned: respawn.respawned,
    respawnProgress: respawn.respawned ? 0 : respawn.progress,
    respawnRequired: respawn.required
  };
  broadcastPlayerState(session, [player]);
  return { ok: true, data: { result, cosmeticProgressToken: makeCosmeticProgressToken(player) } };
};

const buyGear = (session: GameSession, player: PlayerSession, gearId: unknown): StudentCommandResult<GearPurchaseResponse> => {
  const gear = GEAR_ITEMS.find((item) => item.id === gearId);
  if (!isRoundActive(session) && !isRoundPreparationPhase(session)) {
    return failStudentCommand(400, "The round has ended. Gear buying is closed.");
  }
  if (!gear) {
    return failStudentCommand(400, "That gear item does not exist.");
  }
  if (session.settings.gameMode === "zombie" && isWeaponGearId(gear.id)) {
    return failStudentCommand(400, "Zombie Mode only allows the Starter Snowball Launcher.");
  }
  const purchase = resolveGearPurchase({
    player,
    gear,
    requireBase: session.settings.gameMode === "flag" && !isRoundPreparationPhase(session),
    mapId: session.settings.mapId
  });
  if (!purchase.ok) {
    return failStudentCommand(
      400,
      purchase.reason === "player_eliminated"
        ? "Students out for the round cannot buy gear."
        : purchase.reason === "starter_weapon"
          ? "The Starter Snowball Launcher is your default weapon and cannot replace purchased gear."
        : purchase.reason === "outside_base"
          ? "Return to your team base or one of your team's spawn points to buy gear."
          : "Not enough money for that gear."
    );
  }
  if (purchase.alreadyEquipped) {
    return { ok: true, data: { player, gear, message: `${gear.name} already equipped.` } };
  }
  const moneySpent = player.money - purchase.nextMoney;
  player.money = purchase.nextMoney;
  player.moneySpent = (player.moneySpent ?? 0) + moneySpent;
  if (isWeaponGearId(gear.id)) {
    player.weapon = gear.id;
    player.gear = gear.id;
  } else {
    player.perks = [...new Set([...getPlayerPerks(player), gear.id])];
    player.gear = getPlayerWeaponId(player);
  }
  if (purchase.nextHealth !== undefined) player.health = purchase.nextHealth;
  appendEvent(session, { type: "buy", message: `${player.nickname} equipped ${gear.name}.`, playerId: player.id, team: player.team });
  broadcastPlayerState(session, [player]);
  return { ok: true, data: { player, gear, message: `${gear.name} equipped.` } };
};

const buySnowballs = (session: GameSession, player: PlayerSession): StudentCommandResult<SnowballPurchaseResponse> => {
  if (!isRoundActive(session) && !isRoundPreparationPhase(session)) {
    return failStudentCommand(400, "The round has ended. Snowball buying is closed.");
  }
  if (session.settings.gameMode === "zombie" && player.role !== "zombie") {
    return failStudentCommand(400, "Humans cannot buy snowballs in Zombie Mode.");
  }
  const purchase = resolveSnowballPurchase({ player, settings: session.settings });
  if (!purchase.ok) {
    return failStudentCommand(
      400,
      purchase.reason === "player_eliminated"
        ? "Students out for the round cannot buy snowballs."
        : "Not enough money for snowballs."
    );
  }
  const moneySpent = player.money - purchase.nextMoney;
  player.money = purchase.nextMoney;
  player.moneySpent = (player.moneySpent ?? 0) + moneySpent;
  player.snowballs = purchase.nextSnowballs;
  appendEvent(session, {
    type: "buy",
    message: `${player.nickname} bought ${purchase.snowballsAdded} snowballs.`,
    playerId: player.id,
    team: player.team
  });
  broadcastPlayerState(session, [player]);
  return { ok: true, data: { player, message: `+${purchase.snowballsAdded} snowballs ready.` } };
};

const sendStudentCommand = <T>(res: Response, result: StudentCommandResult<T>) => {
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.data);
};

type StudentCommandAck<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

const commandAck = <T>(result: StudentCommandResult<T>): StudentCommandAck<T> =>
  result.ok ? { ok: true, data: result.data } : { ok: false, status: result.status, error: result.error };

const getBoundStudent = (socket: Socket) => {
  const binding = socket.data.playerBinding as SocketPlayerBinding | undefined;
  if (!binding) return undefined;
  const session = getSessionByCode(binding.sessionCode);
  const player = session?.players.find((candidate) => candidate.id === binding.playerId);
  return session && player ? { session, player } : undefined;
};

app.post("/api/sessions/:code/players/:playerId/answer", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === routeParam(req.params.playerId));
  if (!session || !player) {
    res.status(404).json({ error: "Player session not found." });
    return;
  }
  if (!requirePlayerAccess(req, res, session, player)) return;
  sendStudentCommand(res, answerQuestion(session, player, req.body));
});

app.post("/api/sessions/:code/players/:playerId/buy", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === routeParam(req.params.playerId));
  if (!session || !player) {
    res.status(404).json({ error: "Player session not found." });
    return;
  }
  if (!requirePlayerAccess(req, res, session, player)) return;
  sendStudentCommand(res, buyGear(session, player, req.body.gearId));
});

app.post("/api/sessions/:code/players/:playerId/buy-snowballs", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  const player = session?.players.find((candidate) => candidate.id === routeParam(req.params.playerId));
  if (!session || !player) {
    res.status(404).json({ error: "Player session not found." });
    return;
  }
  if (!requirePlayerAccess(req, res, session, player)) return;
  sendStudentCommand(res, buySnowballs(session, player));
});

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  const bodyError = error as { type?: string; status?: number };
  if (bodyError.type === "entity.too.large" || bodyError.status === 413) {
    res.status(413).json({ error: "That upload is too large. Choose a smaller image and try again." });
    return;
  }
  if (bodyError.type === "entity.parse.failed") {
    res.status(400).json({ error: "The request could not be read. Check the file or form and try again." });
    return;
  }
  next(error);
});

io.on("connection", (socket) => {
  networkMetrics.attach(socket);
  socket.on("join_session_room", (payload: { code?: string; playerId?: string; playerToken?: string; teacherToken?: string } = {}) => {
    if (!payload || typeof payload !== "object") return;
    const code = String(payload.code ?? "");
    const session = getSessionByCode(code);
    if (!session) return;

    if (payload.playerId) {
      const player = session.players.find((candidate) => candidate.id === payload.playerId);
      if (!player || !hasPlayerAccess(session, player, payload.playerToken)) return;

      const currentBinding = socket.data.playerBinding as SocketPlayerBinding | undefined;
      if (currentBinding && playerSocketKey(currentBinding.sessionCode, currentBinding.playerId) !== playerSocketKey(session.sessionCode, player.id)) {
        detachSocketBinding(socket);
      }

      const key = playerSocketKey(session.sessionCode, player.id);
      const sockets = playerSockets.get(key) ?? new Set<string>();
      sockets.add(socket.id);
      playerSockets.set(key, sockets);
      socket.data.playerBinding = { sessionCode: session.sessionCode, playerId: player.id } satisfies SocketPlayerBinding;
      clearPlayerDisconnectTimer(session, player.id);
      if (player.connectionState === "disconnected") {
        player.connectionState = "connected";
        appendEvent(session, { type: "timer", message: `${player.nickname} reconnected.`, playerId: player.id, team: player.team });
        broadcastSession(session);
      }
      socket.join(gameplayRoom(session.sessionCode));
    } else {
      const teacher = getTeacherFromToken(payload.teacherToken);
      if (!teacher || teacher.id !== session.teacherId) return;
    }

    socket.join(session.sessionCode);
    socket.emit("session_state", stampSession(session));
  });

  socket.on(
    "answer_question",
    (
      payload: { questionId?: unknown; selectedChoice?: unknown },
      acknowledge: (response: StudentCommandAck<{ result: QuizResult }>) => void
    ) => {
      if (typeof acknowledge !== "function") return;
      const student = getBoundStudent(socket);
      acknowledge(
        student
          ? commandAck(answerQuestion(student.session, student.player, payload ?? {}))
          : { ok: false, status: 401, error: "Reconnect to the game before answering." }
      );
    }
  );

  socket.on(
    "buy_gear",
    (payload: { gearId?: unknown }, acknowledge: (response: StudentCommandAck<GearPurchaseResponse>) => void) => {
      if (typeof acknowledge !== "function") return;
      const student = getBoundStudent(socket);
      acknowledge(
        student
          ? commandAck(buyGear(student.session, student.player, payload?.gearId))
          : { ok: false, status: 401, error: "Reconnect to the game before buying gear." }
      );
    }
  );

  socket.on(
    "buy_snowballs",
    (_payload: Record<string, never>, acknowledge: (response: StudentCommandAck<SnowballPurchaseResponse>) => void) => {
      if (typeof acknowledge !== "function") return;
      const student = getBoundStudent(socket);
      acknowledge(
        student
          ? commandAck(buySnowballs(student.session, student.player))
          : { ok: false, status: 401, error: "Reconnect to the game before buying snowballs." }
      );
    }
  );

  socket.on("disconnect", () => {
    const binding = socket.data.playerBinding as SocketPlayerBinding | undefined;
    if (!binding) return;
    const key = playerSocketKey(binding.sessionCode, binding.playerId);
    const sockets = playerSockets.get(key);
    sockets?.delete(socket.id);
    if (sockets && sockets.size > 0) return;
    playerSockets.delete(key);
    const session = getSessionByCode(binding.sessionCode);
    const player = session?.players.find((candidate) => candidate.id === binding.playerId);
    if (session && player) markPlayerDisconnected(session, player);
  });

  socket.on("player_position", (payload: {
    x?: number;
    z?: number;
    y?: number;
    facing?: number;
    sprinting?: boolean;
    crouching?: boolean;
    jumping?: boolean;
  } = {}) => {
    const student = getBoundStudent(socket);
    if (!student) return;
    const { session, player } = student;
    if (!player.isAlive) return;
    const position = applyAuthoritativePosition(session, player, payload);
    const authoritativePosition = {
      playerId: player.id,
      x: position.x,
      y: player.y,
      z: position.z,
      facing: position.facing,
      energy: player.energy,
      crouching: player.crouching === true,
      jumping: player.jumping === true
    };
    broadcastPlayerPosition(session, authoritativePosition);
  });

  socket.on("fire_action", (payload: { requestId?: string; x?: number; z?: number; y?: number; facing?: number; pitch?: number; targetId?: string; scoped?: boolean; zoomLevel?: number } = {}) => {
    const student = getBoundStudent(socket);
    if (!student) return;
    const { session, player: attacker } = student;
    if (session.status !== "active") {
      socket.emit("error_message", { error: inactiveRoundMessage(session) });
      return;
    }
    if (!canPlayerFireInMode(session.settings.gameMode, attacker.role)) {
      socket.emit("damage_result", { ok: false, reason: "humans_cannot_fire", snowballs: attacker.snowballs ?? 0 });
      return;
    }

    const fireRequest = registerFireRequest(attacker.id, payload.requestId);
    if (!fireRequest.ok) {
      console.warn(`Rejected ${fireRequest.reason} from ${attacker.id}`);
      socket.emit("damage_result", { ok: false, reason: fireRequest.reason, snowballs: attacker.snowballs ?? 0 });
      return;
    }

    applyAuthoritativePosition(session, attacker, payload);

    const currentMs = Date.now();
    const nextAllowedFireAt = playerNextFireAt.get(attacker.id) ?? 0;
    if (currentMs < nextAllowedFireAt) {
      socket.emit("damage_result", { ok: false, reason: "fire_cooldown", snowballs: attacker.snowballs ?? 0 });
      return;
    }

    const snowballUse = resolveSnowballUse(attacker);
    if (!snowballUse.ok) {
      console.warn(`Rejected ${snowballUse.reason} fire_action from ${attacker.id}`);
      socket.emit("damage_result", { ok: false, reason: snowballUse.reason, snowballs: attacker.snowballs ?? 0 });
      return;
    }
    attacker.snowballs = snowballUse.nextSnowballs;
    const weaponId = getPlayerWeaponIdForMode(session.settings.gameMode, attacker);
    const aimPitch = clampArenaAimPitch(payload.pitch);
    playerNextFireAt.set(attacker.id, currentMs + getGearFireCooldownMs(weaponId));
    socket.to(gameplayRoom(session.sessionCode)).emit("remote_weapon_fire", {
      playerId: attacker.id,
      x: attacker.x ?? sessionSpawn(session, attacker.team).x,
      y: attacker.y ?? getArenaEyeHeight(
        session.settings.mapId,
        attacker.x ?? sessionSpawn(session, attacker.team).x,
        attacker.z ?? sessionSpawn(session, attacker.team).z
      ),
      z: attacker.z ?? sessionSpawn(session, attacker.team).z,
      facing: attacker.facing ?? sessionSpawn(session, attacker.team).facing,
      pitch: aimPitch,
      gearId: weaponId,
      scoped: payload.scoped === true,
      zoomLevel: payload.zoomLevel ?? 0
    });

    const targetSelection = resolveProjectileTarget({
      attacker,
      candidates: playersWithRewind(session.players, currentMs),
      requestedTargetId: typeof payload.targetId === "string" && payload.targetId.trim() ? payload.targetId : undefined,
      range: getGearRange(weaponId),
      hitRadius: getGearHitRadius(weaponId, typeof payload.zoomLevel === "number" ? payload.zoomLevel : payload.scoped === true),
      obstacles: getArenaObstacles(session.settings.mapId),
      aimPitch
    });
    if (!targetSelection.ok) {
      broadcastPlayerState(session, [attacker]);
      socket.emit("damage_result", { ok: false, reason: targetSelection.reason, snowballs: attacker.snowballs });
      return;
    }

    const target = session.players.find((candidate) => candidate.id === targetSelection.targetId);
    if (!target) {
      broadcastPlayerState(session, [attacker]);
      socket.emit("damage_result", { ok: false, reason: "invalid_target", snowballs: attacker.snowballs });
      return;
    }

    const tagResult = applyValidatedDamage(session, attacker, target);
    if (!tagResult.ok) {
      broadcastPlayerState(session, [attacker]);
      socket.emit("damage_result", { ok: false, reason: tagResult.reason, snowballs: attacker.snowballs });
      return;
    }
  });

  socket.on("flag_action", (payload: { x?: number; z?: number; y?: number; facing?: number } = {}) => {
    const student = getBoundStudent(socket);
    if (!student) return;
    const { session, player } = student;
    if (session.status !== "active" || session.settings.gameMode !== "flag" || !player.isAlive) return;
    const position = applyAuthoritativePosition(session, player, payload);
    const previousState = session.flag?.state;
    session.flag = resolveFlagPickup(session.flag ?? createInitialFlagState(sessionSpawn(session, "red")), player);
    session.flag = resolveFlagPlacement({
      flag: session.flag,
      player,
      nowMs: Date.now(),
      holdSeconds: session.settings.flagHoldSeconds
    });
    session.flag = resolveFlagCapture(session.flag, player);
    if (session.flag.state !== previousState) {
      if (session.flag.state === "placed") emitFlagPlanted(session, player);
      const message =
        session.flag.state === "carried"
          ? `${player.nickname} picked up the flag.`
          : session.flag.state === "placed"
            ? "The flag has been placed. Red must protect it."
            : session.flag.state === "captured"
              ? "Blue captured the flag."
              : "Flag updated.";
      appendEvent(session, { type: "timer", message, playerId: player.id, team: player.team });
      const countdown = resolveFlagCountdown(session.flag, Date.now());
      if (countdown.winner) {
        finishRound(
          session,
          countdown.winner,
          countdown.reason === "flag_captured" ? "Blue Team captured the flag" : "Red Team protected the flag"
        );
      } else {
        broadcastSession(session);
      }
    } else {
      const flagState = session.flag.state;
      socket.emit("error_message", {
        error: player.team === "red"
          ? flagState === "available" || flagState === "dropped"
            ? "Move next to the flag, then press E to pick it up."
            : flagState === "carried" && session.flag.carrierId !== player.id
              ? "A Red teammate is carrying the flag."
              : "Carry the flag into the Blue base, then press E to place it."
          : flagState === "placed"
            ? "Move next to the placed flag, then press E to capture it."
            : "Blue can capture after Red places the flag."
      });
      socket.emit("player_position", { playerId: player.id, x: position.x, y: player.y, z: position.z, facing: position.facing });
    }
  });
});

function detachSocketBinding(socket: Socket) {
  const binding = socket.data.playerBinding as SocketPlayerBinding | undefined;
  if (!binding) return;
  const key = playerSocketKey(binding.sessionCode, binding.playerId);
  const sockets = playerSockets.get(key);
  sockets?.delete(socket.id);
  if (!sockets || sockets.size === 0) {
    playerSockets.delete(key);
    const session = getSessionByCode(binding.sessionCode);
    const player = session?.players.find((candidate) => candidate.id === binding.playerId);
    if (session && player) markPlayerDisconnected(session, player);
  }
  delete socket.data.playerBinding;
}

const startServer = async () => {
  try {
    await hydrateRuntimeState();
    setInterval(advanceBots, BOT_TICK_MS);
    setInterval(pruneExpiredDecals, 15 * 60 * 1000).unref();
    server.listen(port, () => {
      console.log(`QuizStrike Classroom server listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("QuizStrike could not restore durable classroom data.", error);
    process.exitCode = 1;
  }
};

let isShuttingDown = false;
const shutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}; saving classroom state before shutdown.`);
  flushPersistence();
  void persistenceQueue.finally(() => {
    server.close(() => {
      const disconnect = prisma ? prisma.$disconnect() : Promise.resolve();
      void disconnect.finally(() => process.exit(0));
    });
  });
};

if (process.env.QUIZSTRIKE_NO_AUTOSTART !== "true") {
  void startServer();
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
