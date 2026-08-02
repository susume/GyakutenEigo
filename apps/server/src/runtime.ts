import "dotenv/config";
import compression from "compression";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server, type Socket } from "socket.io";
import { resolveClientOrigins } from "./origins.js";
import { AppearanceSecurityService, inspectProcessedDecal } from "./appearanceSecurity.js";
import { DecalStore } from "./decalStore.js";
import { CombatService } from "./combat.js";
import { BotNavigationService } from "./botNavigation.js";
import { registerAuthRoutes } from "./routes/authRoutes.js";
import {
  registerClassRoute,
  registerFolderRoutes,
  registerTeacherDashboardRoute,
  type TeacherLibraryRouteDependencies
} from "./routes/teacherLibrary.js";
import { registerQuizSetCreationRoutes, registerQuizSetMutationRoutes, type QuizSetRouteDependencies } from "./routes/quizSets.js";
import { registerQuestionRoutes, type QuestionRouteDependencies } from "./routes/questions.js";
import { registerReportRoutes, type ReportRouteDependencies } from "./routes/reports.js";
import { registerSessionRoutes, type SessionRouteDependencies } from "./routes/sessionRoutes.js";
import { registerPlayerRoutes, type PlayerRouteDependencies } from "./routes/playerRoutes.js";
import { registerAppearanceRoutes, type AppearanceRouteDependencies } from "./routes/appearanceRoutes.js";
import { createBotRuntime, type BotRuntimeDependencies } from "./botRuntime.js";
import { createRoundRuntime, type RoundRuntimeDependencies } from "./roundRuntime.js";
import { ConnectionLifecycleService } from "./connectionLifecycle.js";
import { PersistenceScheduler } from "./persistence/persistenceScheduler.js";
import { PlayerPositionHistory } from "./playerPositionHistory.js";
import { NetworkMetrics } from "./networkMetrics.js";
import { loadServerConfig } from "./config.js";
import { announcementForFreezeStreak, incrementFreezeStreak } from "./freezeStreaks.js";
import { NormalizedLibrary } from "./persistence/normalizedLibrary.js";
import {
  createRoomEventPublisher,
  createRoomBroadcaster,
  parseSocketCommand,
  registerProtocolHandshake,
  sendProtocolError
} from "./realtime/protocolGateway.js";
import { RoomAuthority } from "./realtime/roomAuthority.js";
import {
  IdempotentEventConsumer,
  InMemoryJoinCodeDirectory,
  InMemoryRealtimeEventBus,
  InMemoryRoomOwnershipStore,
  InMemoryRoomStateStore,
  LifecycleTimers,
} from "./scaling/runtimeInfrastructure.js";
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
  ARENA_PLAYER_CROUCH_EYE_HEIGHT,
  ARENA_PLAYER_EYE_HEIGHT,
  DEFAULT_PLAYER_HEALTH,
  GEAR_ITEMS,
  getGearFireCooldownMs,
  getGearHitRadius,
  getGearRange,
  getCosmeticProgress,
  getLockedAppearanceItems,
  getPlayerMoveSpeedMultiplier,
  getPlayerPerks,
  getPlayerWeaponId,
  getPlayerWeaponIdForMode,
  isWeaponGearId,
  getArenaObstacles,
  getArenaEyeHeight,
  getArenaGroundHeightForPlayer,
  getArenaRecoveryGroundHeight,
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
  resolveProjectileTarget,
  resolveSnowballPurchase,
  resolveSnowballUse,
  resolveZombieSprintEnergy,
  sanitizeSessionSettings,
  sanitizePlayerAppearance,
  sanitizeCharacterCustomizationSettings,
  getPlayerAppearanceError,
  type AnswerLog,
  type ArenaPosition,
  type BotDifficulty,
  type ClassSummary,
  type GameSession,
  type GameAnnouncement,
  type GameEvent,
  type FlagPlantedEvent,
  type FreezeStreakAnnouncementEvent,
  type PlayerSession,
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
const config = loadServerConfig();
const port = config.port;
const isProduction = config.isProduction;
const jwtSecret = config.jwtSecret;
const databaseUrl = config.databaseUrl;
const prisma = databaseUrl ? new PrismaClient() : undefined;
const normalizedLibrary = prisma ? new NormalizedLibrary(prisma) : undefined;
const clientOrigins = resolveClientOrigins({
  configuredOrigins: config.configuredOrigins,
  isProduction
});
const corsOrigin = clientOrigins.length > 0 ? clientOrigins : true;

if (isProduction && !databaseUrl) {
  console.warn("DATABASE_URL is not configured; QuizStrike is running online with in-memory storage.");
}

if (config.trustProxy) {
  app.set("trust proxy", 1);
}

export const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true, maxAge: 86_400 },
  httpCompression: { threshold: 1024 },
  perMessageDeflate: false
});
const networkMetrics = new NetworkMetrics({ enabled: config.networkDebug, intervalMs: config.networkReportIntervalMs });
const lifecycleTimers = new LifecycleTimers();
const roomOwnership = new InMemoryRoomOwnershipStore();
const roomAuthority = new RoomAuthority({
  ownership: roomOwnership,
  instanceId: config.instanceId,
  leaseMs: config.roomLeaseMs
});
const realtimeEventBus = new InMemoryRealtimeEventBus();
const distributedEventConsumer = new IdempotentEventConsumer();
const ROOM_EVENTS_CHANNEL = "quizstrike:room-events";
let unsubscribeRoomEvents: (() => void) | undefined;
let isDraining = false;

void realtimeEventBus.subscribe(ROOM_EVENTS_CHANNEL, async (event) => {
  await distributedEventConsumer.consume(event, (accepted) => {
    if (!accepted.roomId) return;
    io.to(accepted.roomId).emit(accepted.eventType, accepted.payload);
  });
}).then((unsubscribe) => {
  unsubscribeRoomEvents = unsubscribe;
});

const publishRoomEvent = createRoomEventPublisher({
  eventBus: realtimeEventBus,
  channel: ROOM_EVENTS_CHANNEL,
  instanceId: config.instanceId
});
const acquireRoomAuthority = (roomId: string) => roomAuthority.acquire(roomId);
const ownsRoom = (roomId: string) => roomAuthority.owns(roomId);
const renewRoomAuthorities = () => roomAuthority.renewAll();

const users = new Map<string, StoredUser>();
const classes = new Map<string, ClassSummary & { teacherId: string }>();
const quizSets = new Map<string, QuizSet>();
const folders = new Map<string, QuizFolder>();
const sessions = new InMemoryRoomStateStore<GameSession>();
const joinCodeDirectory = new InMemoryJoinCodeDirectory();
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
const botNavigation = new BotNavigationService(botMemoryById, botPreviousPositions, playerPositionHistory);
const playerSockets = new Map<string, Set<string>>();
const playerDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
  publishRoomEvent(session.sessionCode, "flag_planted", event.eventId, event);
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
  publishRoomEvent(session.sessionCode, "freeze_streak_announcement", event.eventId, event);
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
  /** Legacy compatibility reads only; normalized tables own all new writes. */
  users?: StoredUser[];
  classes?: Array<ClassSummary & { teacherId: string }>;
  quizSets?: QuizSet[];
  folders?: QuizFolder[];
  sessions: GameSession[];
  answers: AnswerLog[];
  /** Legacy fallback only. New writes are stored in the normalized Report table. */
  reports?: StoredReport[];
};

const runtimeSnapshotId = "primary";

const getPersistedRuntimeState = (): PersistedRuntimeState => ({
  sessions: [...sessions.values()],
  answers: [...answers]
});

const persistenceScheduler = new PersistenceScheduler({
  prisma,
  runtimeSnapshotId,
  getSnapshot: getPersistedRuntimeState
});

const hydrateRuntimeState = async () => {
  if (!prisma) return;

  const [snapshot, durable] = await Promise.all([
    prisma.runtimeSnapshot.findUnique({ where: { id: runtimeSnapshotId } }),
    normalizedLibrary!.loadTeacherData()
  ]);

  const state = (snapshot?.data ?? {}) as unknown as Partial<PersistedRuntimeState>;
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
  joinCodeDirectory.clear();
  answers.length = 0;
  reports.clear();

  // Normalized rows are authoritative for durable teacher data. Snapshot rows
  // are a temporary compatibility fallback only when backfill has not created
  // a corresponding normalized record yet.
  for (const user of durable.users) users.set(user.id, user);
  for (const klass of durable.classes) classes.set(klass.id, klass);
  for (const quiz of durable.quizSets) quizSets.set(quiz.id, quiz);
  for (const folder of durable.folders) folders.set(folder.id, folder);
  for (const user of savedUsers) if (user?.id && !users.has(user.id)) users.set(user.id, user);
  for (const klass of savedClasses) if (klass?.id && !classes.has(klass.id)) classes.set(klass.id, klass);
  for (const quiz of savedQuizSets) if (quiz?.id && !quizSets.has(quiz.id)) quizSets.set(quiz.id, quiz);
  for (const folder of savedFolders) if (folder?.id && !folders.has(folder.id)) folders.set(folder.id, folder);
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
    if (!joinCodeDirectory.reserve(session.sessionCode, session.id)) {
      console.error(`[runtime] duplicate restored join code rejected for session ${session.id}`);
      sessions.delete(session.id);
    } else if (!acquireRoomAuthority(session.id)) {
      console.error(`[ownership] restored room ${session.id} has another owner; simulation remains paused`);
    }
  }
  answers.push(...savedAnswers.filter((answer) => answer?.id));
  // Read legacy report snapshots for backwards compatibility. New report writes
  // are normalized and are intentionally not re-embedded in RuntimeSnapshot.
  for (const report of savedReports) if (report?.id && report.report) reports.set(report.id, report);

  console.log(`Restored ${users.size} teachers, ${quizSets.size} quiz sets, and ${sessions.size} sessions from PostgreSQL.`);
};

const schedulePersistence = () => persistenceScheduler.schedule();
const flushPersistence = () => persistenceScheduler.flush();

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
const BOT_DIFFICULTY: BotDifficulty = config.botDifficulty;
const PLAYER_MAX_SPEED = 22;
const PLAYER_DISCONNECT_GRACE_MS = 5000;
const ROUND_RESULT_ANNOUNCEMENT_MS = 4000;
const testPhaseDuration = (name: string, fallback: number) => {
  if (config.environment !== "test") return fallback;
  const configured = name === "QUIZSTRIKE_TEST_ROUND_PREPARATION_MS"
    ? config.testRoundPreparationMs
    : config.testZombieSelectionMs;
  return configured ?? fallback;
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
  } while (joinCodeDirectory.resolve(code));
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

const getSessionByCode = (code: string) => {
  const roomId = joinCodeDirectory.resolve(code);
  return roomId ? sessions.get(roomId) : undefined;
};

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

const roomBroadcaster = createRoomBroadcaster({
  io,
  stampSession,
  schedulePersistence,
  sessionBroadcastWindowMs: SESSION_BROADCAST_WINDOW_MS
});
const { broadcastSession, broadcastPlayerState } = roomBroadcaster;
const appearanceSecurity = new AppearanceSecurityService({
  decalStore: new DecalStore(),
  sessions,
  broadcastSession
});
const decalStore = appearanceSecurity.decalStore;
const appearanceUpdateTimestamps = appearanceSecurity.appearanceUpdateTimestamps;
const decalUploadTimestamps = appearanceSecurity.decalUploadTimestamps;
const deleteDecal = (assetId: string | undefined) => appearanceSecurity.deleteDecal(assetId);
const clearPlayerAppearance = (session: GameSession, player: PlayerSession) => appearanceSecurity.clearPlayerAppearance(session, player);
const purgeSessionDecals = (session: GameSession) => appearanceSecurity.purgeSessionDecals(session);
const pruneExpiredDecals = () => appearanceSecurity.pruneExpiredDecals();
const checkDecalUploadRate = (playerId: string) => appearanceSecurity.checkDecalUploadRate(playerId);

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

type BotAlert = { position: { x: number; z: number }; createdAtMs: number; sourceId: string };
const botAlertsBySession = new Map<string, Map<Team, BotAlert>>();

const mirrorNormalized = (operation: Promise<unknown>, label: string) => {
  void operation.catch((error: unknown) => console.error(`Failed to mirror ${label} into normalized storage.`, error));
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

const roundRuntimeDependencies: RoundRuntimeDependencies = {
  now,
  makeAnnouncement,
  appendEvent,
  broadcastSession,
  sessionSpawn,
  selectSessionSpawn,
  getBotSpawn,
  botMemoryById,
  botNextAttackAt,
  botRespawnAt,
  botPreviousPositions,
  botAlertsBySession,
  purgeSessionDecals,
  saveSession: normalizedLibrary ? (session, quizSetName) => normalizedLibrary.saveSession(session, quizSetName) : undefined,
  getQuizSetName: (quizSetId) => quizSets.get(quizSetId)?.title ?? "Quiz Set",
  mirrorNormalized,
  saveSessionReport,
  roundResultAnnouncementMs: ROUND_RESULT_ANNOUNCEMENT_MS,
  gameOverAnnouncementMs: GAME_OVER_ANNOUNCEMENT_MS,
  roundPreparationMs: ROUND_PREPARATION_MS,
  zombieSelectionMs: ZOMBIE_SELECTION_MS,
  zombieHumanMaxEnergy: ZOMBIE_HUMAN_MAX_ENERGY,
  roundStartAnnouncementMs: ROUND_START_ANNOUNCEMENT_MS
};
const roundRuntime = createRoundRuntime(roundRuntimeDependencies);
const {
  finishSession,
  finishZombieSession,
  inactiveRoundMessage,
  startRoundState,
  openRoundPreparation,
  openZombieSelectionPhase,
  finishRound,
  startPendingRound,
  finishZombieMatchIfComplete,
  evaluateFlagEliminationWin
} = roundRuntime;

const combatService = new CombatService({
  io,
  gameplayRoom,
  sessionSpawn: (session, team) => sessionSpawn(session, team),
  appendEvent,
  emitToPlayers,
  broadcastPlayerState,
  finishZombieMatchIfComplete,
  evaluateFlagEliminationWin,
  resetFreezeStreak,
  recordValidatedFreeze,
  botPreviousPositions,
  botRespawnAt,
  botRespawnMs: BOT_RESPAWN_MS,
  now
});
const applyValidatedDamage = (session: GameSession, attacker: PlayerSession, target: PlayerSession) =>
  combatService.applyValidatedDamage(session, attacker, target);

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

const connectionLifecycle = new ConnectionLifecycleService({
  io,
  playerSockets,
  disconnectTimers: playerDisconnectTimers,
  playerSocketKey,
  getSessionByCode,
  appendEvent,
  broadcastSession,
  evaluateFlagEliminationWin,
  finishZombieMatchIfComplete,
  resetFreezeStreak,
  playerQuestionHistory,
  playerQuestionGate,
  quizRateLimits,
  fireRequestIds,
  playerMoveTimestamps,
  playerNextFireAt,
  botRespawnAt,
  botNextAttackAt,
  botMemoryById,
  botPreviousPositions,
  playerPositionHistory,
  appearanceUpdateTimestamps,
  decalUploadTimestamps,
  deletePlayerDecals: (sessionId, playerId) => decalStore.deletePlayer(sessionId, playerId),
  botAlertsBySession,
  gracePeriodMs: PLAYER_DISCONNECT_GRACE_MS
});
const clearPlayerDisconnectTimer = (session: GameSession, playerId: string) => connectionLifecycle.clearPlayerDisconnectTimer(session, playerId);
const markPlayerDisconnected = (session: GameSession, player: PlayerSession) => connectionLifecycle.markPlayerDisconnected(session, player);
const removePlayerRuntimeState = (session: GameSession, player: PlayerSession) => connectionLifecycle.removePlayerRuntimeState(session, player);
const evictPlayerSockets = (session: GameSession, player: PlayerSession) => connectionLifecycle.evictPlayerSockets(session, player);

const getBotBrain = (bot: PlayerSession, index: number, nowMs: number) => {
  return botNavigation.getBotBrain(bot, index, nowMs);
};

const botPosition = (player: PlayerSession): ArenaPosition => botNavigation.botPosition(player);

const playersWithRewind = (players: PlayerSession[], nowMs = Date.now()) => botNavigation.playersWithRewind(players, nowMs);

const horizontalDistance = (a: ArenaPosition, b: ArenaPosition) => botNavigation.horizontalDistance(a, b);

const isBotEnemy = (session: GameSession, bot: PlayerSession, candidate: PlayerSession) => botNavigation.isBotEnemy(session, bot, candidate);

const canBotSee = (
  session: GameSession,
  bot: PlayerSession,
  target: PlayerSession,
  profile: (typeof BOT_DIFFICULTIES)[keyof typeof BOT_DIFFICULTIES],
  obstacles: ReturnType<typeof getArenaObstacles>
) => {
  return botNavigation.canBotSee(session, bot, target, profile, obstacles);
};

const findBotCover = (
  session: GameSession,
  bot: PlayerSession,
  threat: PlayerSession | undefined,
  obstacles: ReturnType<typeof getArenaObstacles>
) => {
  return botNavigation.findBotCover(session, bot, threat, obstacles);
};

const applyBotSpacing = (session: GameSession, bot: PlayerSession, desired: { x: number; y?: number; z: number }) => {
  return botNavigation.applyBotSpacing(session, bot, desired);
};

const getBotObjectiveGoal = (session: GameSession, bot: PlayerSession, brain: BotMemory, state: BotState) => {
  return botNavigation.getBotObjectiveGoal(session, bot, brain, state);
};

const botRuntimeDependencies: BotRuntimeDependencies = {
  io,
  gameplayRoom,
  sessions,
  ownsRoom,
  startPendingRound,
  finishRound,
  finishZombieSession,
  broadcastSession,
  appendEvent,
  broadcastPlayerPosition,
  sessionSpawn,
  getBotSpawn,
  getBotBrain,
  botPosition,
  playersWithRewind,
  horizontalDistance,
  isBotEnemy,
  canBotSee,
  findBotCover,
  applyBotSpacing,
  getBotObjectiveGoal,
  emitFlagPlanted,
  applyValidatedDamage,
  botNextAttackAt,
  botRespawnAt,
  botPreviousPositions,
  botAlertsBySession,
  botDifficulty: BOT_DIFFICULTY,
  botTickMs: BOT_TICK_MS
};
const botRuntime = createBotRuntime(botRuntimeDependencies);
export const advanceBots = () => botRuntime.advanceBots();


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
  environment: config.environment,
  storage: prisma ? "postgres" : "memory",
  time: now()
});

registerAuthRoutes(app, {
  users,
  normalizedLibrary,
  cleanEmail,
  publicUser,
  makeToken,
  makeId: id,
  schedulePersistence,
  requireTeacher,
  healthPayload
});

const teacherLibraryRouteDependencies: TeacherLibraryRouteDependencies = {
  requireTeacher,
  classes,
  quizSets,
  folders,
  sessions,
  normalizedLibrary,
  durableReportMetadataForTeacher,
  normalizeFolderName,
  hasDuplicateSiblingName,
  canMoveFolder,
  routeParam,
  now,
  id,
  schedulePersistence,
  stampSession
};

registerTeacherDashboardRoute(app, teacherLibraryRouteDependencies);
registerFolderRoutes(app, teacherLibraryRouteDependencies);

const quizSetRouteDependencies: QuizSetRouteDependencies = {
  requireTeacher,
  quizSets,
  folders,
  sessions,
  normalizedLibrary,
  assertTeacherOwnsQuiz,
  routeParam,
  isChoice,
  now,
  id,
  schedulePersistence
};
const questionRouteDependencies: QuestionRouteDependencies = {
  requireTeacher,
  getQuizQuestion,
  assertTeacherOwnsQuiz,
  normalizedLibrary,
  routeParam,
  isChoice,
  schedulePersistence
};
const reportRouteDependencies: ReportRouteDependencies = {
  requireTeacher,
  normalizedLibrary,
  reports,
  durableReportMetadataForTeacher,
  reportMetadataForTeacher,
  routeParam,
  schedulePersistence
};

registerQuizSetMutationRoutes(app, quizSetRouteDependencies);
registerReportRoutes(app, reportRouteDependencies);

registerClassRoute(app, teacherLibraryRouteDependencies);

registerQuizSetCreationRoutes(app, quizSetRouteDependencies);
registerQuestionRoutes(app, questionRouteDependencies);

const sessionRouteDependencies: SessionRouteDependencies = {
  requireTeacher,
  isDraining: () => isDraining,
  assertTeacherOwnsQuiz,
  createDefaultSettings,
  id,
  now,
  generateSessionCode,
  appendEvent,
  sessions,
  joinCodeDirectory,
  acquireRoomAuthority,
  releaseRoomAuthority: (roomId) => roomAuthority.release(roomId),
  normalizedLibrary,
  mirrorNormalized,
  schedulePersistence,
  stampSession,
  getSessionByCode,
  routeParam,
  canStartRound,
  openRoundPreparation,
  openZombieSelectionPhase,
  startRoundState,
  makeAnnouncement,
  roundStartAnnouncementMs: ROUND_START_ANNOUNCEMENT_MS,
  respawnCorrectAnswersRequired: RESPAWN_CORRECT_ANSWERS_REQUIRED,
  broadcastSession,
  finishZombieSession,
  finishSession,
  finishRound,
  makeReport,
  getBotSpawn,
  selectSessionSpawn,
  botNames,
  botDifficulty: BOT_DIFFICULTY,
  defaultPlayerHealth: DEFAULT_PLAYER_HEALTH,
  defaultPlayerAppearance: DEFAULT_PLAYER_APPEARANCE,
  reportStore: reports,
  getBearerUser,
  getPlayerToken,
  hasPlayerAccess,
  getStoredSessionReport: async (session) => {
    const durable = await normalizedLibrary?.getReportForSession(session.teacherId, session.id);
    return durable ? { metadata: durable.metadata, report: durable.report } : undefined;
  },
  reportMetadataForTeacher,
  saveSessionReport,
  sanitizeExportFilename,
  buildCsvReport
};

registerSessionRoutes(app, sessionRouteDependencies);



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
  if (normalizedLibrary) {
    mirrorNormalized(normalizedLibrary.saveAnswer(answer, question), "answer history");
    mirrorNormalized(normalizedLibrary.savePlayer(player), "player learning progress");
  }

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


const playerRouteDependencies: PlayerRouteDependencies = {
  requireTeacher,
  getSessionByCode,
  routeParam,
  getNicknameError,
  id,
  now,
  selectLateJoinTeam,
  selectSessionSpawn,
  defaultPlayerHealth: DEFAULT_PLAYER_HEALTH,
  zombieHumanMaxEnergy: ZOMBIE_HUMAN_MAX_ENERGY,
  defaultPlayerAppearance: DEFAULT_PLAYER_APPEARANCE,
  readCosmeticProgressToken,
  makePlayerToken,
  makeCosmeticProgressToken,
  clearPlayerDisconnectTimer,
  issueNextQuestion,
  appendEvent,
  broadcastSession,
  normalizedLibrary,
  mirrorNormalized,
  requirePlayerAccess,
  stampSession,
  evictPlayerSockets,
  removePlayerRuntimeState,
  resolveFlagDropForPlayer,
  evaluateFlagEliminationWin,
  finishZombieMatchIfComplete,
  resetFreezeStreak,
  sendStudentCommand,
  answerQuestion,
  buyGear,
  buySnowballs
};

registerPlayerRoutes(app, playerRouteDependencies);

const appearanceRouteDependencies: AppearanceRouteDependencies = {
  getSessionByCode,
  routeParam,
  requireTeacher,
  requirePlayerAccess,
  appearanceUpdateTimestamps,
  appearanceUpdateCooldownMs: APPEARANCE_UPDATE_COOLDOWN_MS,
  getPlayerAppearanceError,
  sanitizePlayerAppearance,
  getLockedAppearanceItems,
  getCosmeticProgress,
  decalStore,
  checkDecalUploadRate,
  inspectProcessedDecal,
  decalMaxProcessedBytes: DECAL_MAX_PROCESSED_BYTES,
  id,
  deleteDecal,
  broadcastSession,
  stampSession,
  sanitizeCharacterCustomizationSettings: (input) => sanitizeCharacterCustomizationSettings(input as Parameters<typeof sanitizeCharacterCustomizationSettings>[0]),
  aiSkinProviderConfigured,
  clearPlayerAppearance,
  appendEvent,
  canReadRoomAsset
};

registerAppearanceRoutes(app, appearanceRouteDependencies);

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
  if (isDraining) {
    sendProtocolError(socket, "INVALID_STATE", "This server instance is restarting. Reconnect shortly.", true);
    socket.disconnect(true);
    return;
  }
  networkMetrics.attach(socket);
  registerProtocolHandshake(socket, {
    serverVersion: "0.1.0",
    onLegacyClient: (socketId) => console.warn(`[protocol] accepted temporary version-0 client ${socketId}`)
  });
  socket.on("join_session_room", (payload: unknown = {}) => {
    const command = parseSocketCommand(socket, "join_session_room", payload);
    if (!command) return;
    const code = command.code;
    const session = getSessionByCode(code);
    if (!session) return;
    if (!ownsRoom(session.id)) {
      sendProtocolError(socket, "INVALID_STATE", "This instance is not authoritative for the requested room. Reconnect through the room-affine route.", true);
      return;
    }

    if (command.playerId) {
      const player = session.players.find((candidate) => candidate.id === command.playerId);
      if (!player || !hasPlayerAccess(session, player, command.playerToken)) return;

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
      const teacher = getTeacherFromToken(command.teacherToken);
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
      const command = parseSocketCommand(socket, "answer_question", payload);
      if (!command) {
        acknowledge({ ok: false, status: 400, error: "The answer command was invalid." });
        return;
      }
      const student = getBoundStudent(socket);
      acknowledge(
        student
          ? commandAck(answerQuestion(student.session, student.player, command))
          : { ok: false, status: 401, error: "Reconnect to the game before answering." }
      );
    }
  );

  socket.on(
    "buy_gear",
    (payload: { gearId?: unknown }, acknowledge: (response: StudentCommandAck<GearPurchaseResponse>) => void) => {
      if (typeof acknowledge !== "function") return;
      const command = parseSocketCommand(socket, "buy_gear", payload);
      if (!command) {
        acknowledge({ ok: false, status: 400, error: "The purchase command was invalid." });
        return;
      }
      const student = getBoundStudent(socket);
      acknowledge(
        student
          ? commandAck(buyGear(student.session, student.player, command.gearId))
          : { ok: false, status: 401, error: "Reconnect to the game before buying gear." }
      );
    }
  );

  socket.on(
    "buy_snowballs",
    (payload: Record<string, never>, acknowledge: (response: StudentCommandAck<SnowballPurchaseResponse>) => void) => {
      if (typeof acknowledge !== "function") return;
      if (!parseSocketCommand(socket, "buy_snowballs", payload)) {
        acknowledge({ ok: false, status: 400, error: "The purchase command was invalid." });
        return;
      }
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

  socket.on("player_position", (payload: unknown = {}) => {
    const command = parseSocketCommand(socket, "player_position", payload);
    if (!command) return;
    const student = getBoundStudent(socket);
    if (!student) return;
    const { session, player } = student;
    if (!player.isAlive) return;
    const position = applyAuthoritativePosition(session, player, command);
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

  socket.on("fire_action", (payload: unknown = {}) => {
    const command = parseSocketCommand(socket, "fire_action", payload);
    if (!command) return;
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

    const fireRequest = registerFireRequest(attacker.id, command.requestId);
    if (!fireRequest.ok) {
      console.warn(`Rejected ${fireRequest.reason} from ${attacker.id}`);
      socket.emit("damage_result", { ok: false, reason: fireRequest.reason, snowballs: attacker.snowballs ?? 0 });
      return;
    }

    applyAuthoritativePosition(session, attacker, command);

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
    const aimPitch = clampArenaAimPitch(command.pitch);
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
      scoped: command.scoped === true,
      zoomLevel: command.zoomLevel ?? 0
    });

    const targetSelection = resolveProjectileTarget({
      attacker,
      candidates: playersWithRewind(session.players, currentMs),
      requestedTargetId: command.targetId,
      range: getGearRange(weaponId),
      hitRadius: getGearHitRadius(weaponId, command.zoomLevel ?? command.scoped === true),
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

  socket.on("flag_action", (payload: unknown = {}) => {
    const command = parseSocketCommand(socket, "flag_action", payload);
    if (!command) return;
    const student = getBoundStudent(socket);
    if (!student) return;
    const { session, player } = student;
    if (session.status !== "active" || session.settings.gameMode !== "flag" || !player.isAlive) return;
    const position = applyAuthoritativePosition(session, player, command);
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
  connectionLifecycle.detachSocketBinding(socket);
}

const startServer = async () => {
  try {
    await hydrateRuntimeState();
    lifecycleTimers.interval(advanceBots, BOT_TICK_MS);
    lifecycleTimers.interval(pruneExpiredDecals, 15 * 60 * 1000, true);
    lifecycleTimers.interval(renewRoomAuthorities, config.roomLeaseRenewMs, true);
    server.listen(port, () => {
      console.log(`QuizStrike Classroom server listening on http://localhost:${port}`);
      console.info(`[runtime] instance=${config.instanceId} store=${config.runtimeStore} stickySessions=required`);
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
  isDraining = true;
  console.log(`[shutdown] received=${signal} instance=${config.instanceId}; draining and saving classroom state`);
  lifecycleTimers.clearAll();
  networkMetrics.close();
  for (const timer of playerDisconnectTimers.values()) clearTimeout(timer);
  playerDisconnectTimers.clear();
  roomBroadcaster.clearTimer();
  if (positionBroadcastTimer) clearTimeout(positionBroadcastTimer);
  positionBroadcastTimer = undefined;
  const released = roomAuthority.releaseAll();
  console.info(`[shutdown] releasedRoomLeases=${released}`);
  flushPersistence();
  const forceExit = setTimeout(() => {
    console.error(`[shutdown] timeout after ${config.shutdownTimeoutMs}ms`);
    process.exit(1);
  }, config.shutdownTimeoutMs);
  forceExit.unref();

  void persistenceScheduler.pending.finally(async () => {
    unsubscribeRoomEvents?.();
    await realtimeEventBus.close().catch(() => undefined);
    io.close();
    server.close(async () => {
      if (prisma) await prisma.$disconnect().catch(() => undefined);
      clearTimeout(forceExit);
      console.info("[shutdown] complete");
      process.exit(0);
    });
  });
};

if (config.autoStart) {
  void startServer();
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
