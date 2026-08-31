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
import { registerSpeakingRoutes } from "./routes/speakingRoutes.js";
import { createSpeakingProviders } from "./speakingProviders.js";
import {
  registerClassRoute,
  registerFolderRoutes,
  registerTeacherDashboardRoute,
  type TeacherLibraryRouteDependencies
} from "./routes/teacherLibrary.js";
import { registerQuizSetCreationRoutes, registerQuizSetMutationRoutes, type QuizSetRouteDependencies } from "./routes/quizSets.js";
import { registerQuestionRoutes, type QuestionAudioAsset, type QuestionRouteDependencies } from "./routes/questions.js";
import { registerReportRoutes, type ReportRouteDependencies } from "./routes/reports.js";
import { registerSessionRoutes, type SessionRouteDependencies } from "./routes/sessionRoutes.js";
import { registerPlayerRoutes, type PlayerRouteDependencies } from "./routes/playerRoutes.js";
import { registerAppearanceRoutes, type AppearanceRouteDependencies } from "./routes/appearanceRoutes.js";
import { createBotRuntime, type BotRuntimeDependencies } from "./botRuntime.js";
import { createRoundRuntime, type RoundRuntimeDependencies } from "./roundRuntime.js";
import { ConnectionLifecycleService } from "./connectionLifecycle.js";
import { PersistenceScheduler } from "./persistence/persistenceScheduler.js";
import { PlayerPositionHistory } from "./playerPositionHistory.js";
import { pauseSessionForTeacher, resumeSessionForTeacher } from "./teacherPause.js";
import { shiftTeacherPauseRuntimeTimers } from "./teacherPauseRuntime.js";
import { NetworkMetrics } from "./networkMetrics.js";
import { loadServerConfig } from "./config.js";
import { announcementForFreezeStreak, incrementFreezeStreak, MAX_FREEZE_STREAK_ANNOUNCEMENT } from "./freezeStreaks.js";
import { NormalizedLibrary } from "./persistence/normalizedLibrary.js";
import {
  createRoomEventPublisher,
  createRoomBroadcaster,
  parseSocketCommand,
  registerProtocolHandshake,
  sendProtocolError
} from "./realtime/protocolGateway.js";
import { RoomAuthority } from "./realtime/roomAuthority.js";
import { createCompetitionState } from "./routes/competitionRoutes.js";
import { registerCompetitionRoutes } from "./routes/competitionRoutes.js";
import { scheduleCompetitionNotifications, type Competition, type CompetitionAuditLog, type CompetitionNotification } from "./competitionDomain.js";
import { createTournamentState, type Tournament, type TournamentAuditEvent } from "./tournamentDomain.js";
import { registerTournamentRoutes } from "./routes/tournamentRoutes.js";
import { canTeacherUseStudySet, registerStudySetRoutes } from "./routes/studySets.js";
import { normalizeLegacyStudySet } from "./studySetCompatibility.js";
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
  getAthleticsObstacles,
  ATHLETICS_ARENA_MAP_ID,
  getArenaEyeHeight,
  getArenaGroundHeightForPlayer,
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
  resolveZombieMovementEnergy,
  type AthleticsAbility,
  type AthleticsHazardDefinition,
  sanitizeSessionSettings,
  sanitizePlayerAppearance,
  sanitizeCharacterCustomizationSettings,
  getPlayerAppearanceError,
  buildLearningPulse,
  isTeacherPaused,
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
  type StudentLearningReport,
  type SessionSettings,
  type SnowballPackSize,
  type LearningPulse,
  type AthleticsActionCommand,
  type TeacherUser,
  type Team
} from "@quizstrike/shared";
import {
  ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS,
  ATHLETICS_COURSE_BOUNDS,
  ATHLETICS_STADIUM_COURSE,
  ATHLETICS_CHECKPOINT_COUNT,
  ATHLETICS_LAP_TRANSITION_MS,
  ATHLETICS_START_COUNTDOWN_MS,
  ATHLETICS_WRONG_ANSWER_PENALTY_MS,
  ATHLETICS_CORRECT_ENERGY,
  ATHLETICS_JUMP_ENERGY_COST,
  ATHLETICS_MAX_ENERGY,
  ATHLETICS_PLAYER_EYE_HEIGHT,
  ATHLETICS_RECOVERY_CORRECT_ANSWERS_REQUIRED,
  ATHLETICS_RECOVERY_MIN_ENERGY,
  ATHLETICS_RECOVERY_SETTLE_MS,
  awardAthleticsEnergy,
  getAthleticsGroundHeight,
  getAthleticsPhysicalSupport,
  getAthleticsCheckpointSurfaceIndex,
  getAthleticsQuestionPoolIndex,
  getAthleticsQuestionsPerLap,
  getAthleticsPointAtProgress,
  getAthleticsRecoveryPosition,
  getAthleticsPreviousSafeSurfaceIndex,
  getAthleticsRouteTangent,
  getAthleticsRouteProgress,
  getAthleticsRouteDistance,
  getAthleticsRouteHeight,
  getAthleticsSurfaceRouteProgress,
  isAthleticsBelowRecoverableRoute,
  isAthleticsOnRoute,
  getAthleticsStartPosition,
  getAthleticsTotalQuestionCount,
  normalizeAthleticsEnergy,
  resolveAthleticsMovementEnergy,
  resolveAthleticsStandings,
  CHAOS_HAZARD_LIMIT,
  CHAOS_WAVE_INTERVAL_MS,
  HUNTER_PROJECTILE_COOLDOWN_MS,
  HUNTER_PROJECTILE_RADIUS,
  HUNTER_PROJECTILE_RANGE,
  HUNTER_PROJECTILE_TRAVEL_MS,
  HUNTER_STAGGER_MS,
  HUNTER_KNOCKBACK_DISTANCE,
  RUNNER_ABILITY_METER_MAX,
  ZEUS_FREEZE_WRONG_EXTENSION_MS,
  consumeRunnerAbility,
  createChaosWave,
  getChaosEventForWave,
  getChaosEventModifiers,
  getChaosHazardPosition,
  getHunterStationProgress,
  getZeusAttackProfile,
  resolveChaosHazardImpact,
  resolveHunterQuizReward,
  resolveRunnerQuizReward,
  resolveZeusAnswer,
  resolveZeusStrike,
  type AthleticsPlayerState,
  type AthleticsPhysicalSupport,
  type AthleticsRecoveryReason
} from "@quizstrike/shared";
import {
  athleticsModeLimits,
  createAthleticsModeRoundState,
  getAthleticsMode,
  getAthleticsModeIntro,
  getZeusTargetPlan,
  resolveHunterHitsForRound,
  type PendingHunterProjectile
} from "./athleticsModeAuthority.js";
import {
  decideAthleticsFall,
  isAthleticsCheckpointOccupied,
  isAthleticsFinishOccupied,
  isAthleticsPlayableSupport
} from "./athleticsAuthority.js";
import {
  BOT_DIFFICULTIES,
  type BotMemory,
  type BotState
} from "./botAI.js";
import { buildStudentLearningAttempts } from "./studentLearningReport.js";
import { ContributionService } from "./contributionService.js";

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
const contribution = new ContributionService(() => quizSets.values(), normalizedLibrary);
const questionAudioAssets = new Map<string, QuestionAudioAsset>();
const folders = new Map<string, QuizFolder>();
const sessions = new InMemoryRoomStateStore<GameSession>();
const joinCodeDirectory = new InMemoryJoinCodeDirectory();
const answers: AnswerLog[] = [];
type StoredReport = ReportMetadata & { report: SessionReport };
const reports = new Map<string, StoredReport>();
const competitionState = createCompetitionState({ id: "official-quizstrike", name: "QuizStrike Classroom" });
const tournamentState = createTournamentState();
const playerQuestionHistory = new Map<string, Set<string>>();
const playerQuestionGate = new PlayerQuestionGate();
const quizRateLimits = new Map<string, number[]>();
const fireRequestIds = new Map<string, Map<string, number>>();
const playerMoveTimestamps = new Map<string, number>();
const playerNextFireAt = new Map<string, number>();
const athleticsActionNextAt = new Map<string, number>();
const athleticsProjectiles = new Map<string, PendingHunterProjectile[]>();
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
const teacherRoom = (sessionCode: string) => `${sessionCode}:teachers`;

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
    // The server keeps counting the uninterrupted streak, but the announcer
    // stays on the highest rank until the player is tagged.
    streak: Math.min(MAX_FREEZE_STREAK_ANNOUNCEMENT, Math.max(0, Math.floor(streak))),
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
  competitions?: Competition[];
  competitionNotifications?: CompetitionNotification[];
  competitionAuditLogs?: CompetitionAuditLog[];
  tournaments?: Tournament[];
  tournamentAuditEvents?: TournamentAuditEvent[];
};

const runtimeSnapshotId = "primary";

const getPersistedRuntimeState = (): PersistedRuntimeState => ({
  sessions: [...sessions.values()].map((session) => {
    const { learningPulse: _learningPulse, serverTime: _serverTime, ...persistedSession } = session;
    return persistedSession as GameSession;
  }),
  answers: [...answers],
  competitions: [...competitionState.competitions.values()],
  competitionNotifications: [...competitionState.notifications.values()],
  competitionAuditLogs: [...competitionState.auditLogs],
  tournaments: [...tournamentState.tournaments.values()],
  tournamentAuditEvents: [...tournamentState.auditEvents]
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
  const savedCompetitions = Array.isArray(state.competitions) ? state.competitions : [];
  const savedCompetitionNotifications = Array.isArray(state.competitionNotifications) ? state.competitionNotifications : [];
  const savedCompetitionAuditLogs = Array.isArray(state.competitionAuditLogs) ? state.competitionAuditLogs : [];
  const savedTournaments = Array.isArray(state.tournaments) ? state.tournaments : [];
  const savedTournamentAuditEvents = Array.isArray(state.tournamentAuditEvents) ? state.tournamentAuditEvents : [];

  users.clear();
  classes.clear();
  quizSets.clear();
  folders.clear();
  sessions.clear();
  joinCodeDirectory.clear();
  answers.length = 0;
  reports.clear();
  tournamentState.tournaments.clear();
  tournamentState.auditEvents.length = 0;
  if (savedCompetitions.length > 0) {
    competitionState.competitions.clear();
    for (const competition of savedCompetitions) if (competition?.id && competition?.slug) competitionState.competitions.set(competition.id, competition);
    competitionState.notifications.clear();
    for (const notification of savedCompetitionNotifications) if (notification?.id && notification?.key) competitionState.notifications.set(notification.key, notification);
    competitionState.auditLogs.length = 0;
    competitionState.auditLogs.push(...savedCompetitionAuditLogs.filter((log) => log?.id && log?.competitionId));
  }
  for (const tournament of savedTournaments) if (tournament?.id && tournament?.slug) tournamentState.tournaments.set(tournament.id, tournament);
  tournamentState.auditEvents.push(...savedTournamentAuditEvents.filter((event) => event?.id && event?.tournamentId));

  // Normalized rows are authoritative for durable teacher data. Snapshot rows
  // are a temporary compatibility fallback only when backfill has not created
  // a corresponding normalized record yet.
  for (const user of durable.users) users.set(user.id, user);
  for (const klass of durable.classes) classes.set(klass.id, klass);
  for (const quiz of durable.quizSets) quizSets.set(quiz.id, normalizeLegacyStudySet(quiz));
  for (const folder of durable.folders) folders.set(folder.id, folder);
  for (const user of savedUsers) if (user?.id && !users.has(user.id)) users.set(user.id, user);
  for (const klass of savedClasses) if (klass?.id && !classes.has(klass.id)) classes.set(klass.id, klass);
  for (const quiz of savedQuizSets) if (quiz?.id && !quizSets.has(quiz.id)) quizSets.set(quiz.id, normalizeLegacyStudySet(quiz));
  for (const folder of savedFolders) if (folder?.id && !folders.has(folder.id)) folders.set(folder.id, folder);
  for (const session of savedSessions) {
    if (!session?.id) continue;
    session.learningPulse = undefined;
    session.serverTime = undefined;
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
const ROUND_TICK_MS = 250;
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
    ? "Choose a classroom-friendly name."
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

const athleticsLaneIndex = (session: GameSession, preferredIndex: number) =>
  preferredIndex === 0 && session.players.length > 0 ? session.players.length : preferredIndex;

const sessionSpawn = (session: GameSession, team: Team, index = 0) =>
  session.settings.gameMode === "athletics"
    ? getAthleticsStartPosition(index, Math.max(1, session.maxPlayers))
    : getTeamSpawnForMap(session.settings.mapId, team, index);

const selectSessionSpawn = (session: GameSession, team: Team, preferredIndex = 0) =>
  session.settings.gameMode === "athletics"
    ? getAthleticsStartPosition(athleticsLaneIndex(session, preferredIndex), Math.max(1, session.maxPlayers))
    : selectTeamSpawnForMap(session.settings.mapId, team, session.players, preferredIndex);

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
  const {
    correctChoice: _correctChoice,
    explanation: _explanation,
    ...safeQuestion
  } = question;
  return safeQuestion;
};

const getSessionQuestions = (session: GameSession) => session.questionSnapshot ?? quizSets.get(session.quizSetId)?.questions ?? [];
const getSessionQuestion = (session: GameSession, questionId: string) => getSessionQuestions(session).find((question) => question.id === questionId);

const makeAthleticsPlayerState = (laneIndex = 0): AthleticsPlayerState => ({
  questionIndex: 0,
  checkpointIndex: 0,
  routeProgress: 0,
  // A question is available from the safe start platform. This field is now
  // presentation compatibility for clients built before fuel replaced gates.
  gateOpen: true,
  falls: 0,
  lastSafeCheckpointIndex: 0,
  lastSafeSurfaceIndex: 0,
  currentSupportedSurfaceIndex: 0,
  currentSupportKind: "main_surface",
  lastSupportedAtMs: Date.now(),
  recoveryActive: false,
  recoveryCorrectAnswers: 0,
  recoveryRequiredAnswers: ATHLETICS_RECOVERY_CORRECT_ANSWERS_REQUIRED,
  movementEpoch: 0,
  checkpointSplitsMs: [],
  completedLaps: 0,
  lapSplitsMs: [],
  laneIndex,
  status: "racing",
  abilityCharge: 0,
  shieldCharges: 0
});

const ensureAthleticsPlayerState = (
  session: GameSession,
  player: PlayerSession,
  laneIndex?: number
) => {
  if (session.settings.gameMode !== "athletics") return undefined;
  if (!player.athletics) player.athletics = makeAthleticsPlayerState(laneIndex ?? session.players.indexOf(player));
  player.athletics.completedLaps ??= 0;
  player.athletics.lapSplitsMs ??= [];
  player.athletics.lastSafeSurfaceIndex ??= 0;
  player.athletics.movementEpoch ??= 0;
  player.athletics.recoveryCorrectAnswers ??= 0;
  player.athletics.recoveryRequiredAnswers ??= ATHLETICS_RECOVERY_CORRECT_ANSWERS_REQUIRED;
  player.athletics.recoveryActive ??= false;
  player.athletics.abilityCharge ??= 0;
  player.athletics.shieldCharges ??= 0;
  if (getAthleticsMode(session.settings.athleticsMode ?? session.athletics?.mode) === "hunters-runners") player.athletics.role ??= "runner";
  if (player.athletics.recoveryActive) {
    player.athletics.currentSupportedSurfaceIndex = undefined;
    player.athletics.currentSupportKind = "airborne";
  } else {
    player.athletics.currentSupportedSurfaceIndex ??= player.athletics.lastSafeSurfaceIndex;
    player.athletics.currentSupportKind ??= "main_surface";
  }
  if (laneIndex !== undefined && player.athletics.laneIndex === undefined) player.athletics.laneIndex = laneIndex;
  return player.athletics;
};

const getAthleticsRaceConfig = (session: GameSession) => {
  const questionPoolSize = Math.max(1, getSessionQuestions(session).length);
  const requiredLaps = session.athletics?.requiredLaps ?? session.settings.athleticsCourseLaps ?? 1;
  const questionsPerLap = session.athletics?.questionsPerLap
    ?? (requiredLaps === 1 && session.athletics?.questionCount
      ? session.athletics.questionCount
      : getAthleticsQuestionsPerLap(questionPoolSize, requiredLaps));
  return {
    questionPoolSize,
    requiredLaps,
    questionsPerLap,
    questionCount: session.athletics?.questionCount ?? questionsPerLap * requiredLaps,
    checkpointCount: ATHLETICS_CHECKPOINT_COUNT
  };
};

const getAthleticsHunterStationPosition = (stationIndex: number, stationCount: number) => {
  const progress = getHunterStationProgress(stationIndex, stationCount);
  const point = getAthleticsPointAtProgress(progress);
  const tangent = getAthleticsRouteTangent(progress);
  // Stations sit just outside the runner line and never use the finish pad.
  return {
    x: point.x + tangent.z * 5.5,
    y: point.y + ATHLETICS_PLAYER_EYE_HEIGHT,
    z: point.z - tangent.x * 5.5,
    facing: Math.atan2(-tangent.x, -tangent.z)
  };
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
  const questions = getSessionQuestions(session);
  if (questions.length === 0) return undefined;

  let attempted = playerQuestionHistory.get(playerId);
  if (!attempted) {
    attempted = new Set<string>();
    playerQuestionHistory.set(playerId, attempted);
  }

  if (attempted.size >= questions.length) attempted.clear();

  const unattempted = questions.filter((question) => !attempted.has(question.id));
  const pool = unattempted.length > 0 ? unattempted : questions;
  const question = pool[Math.floor(Math.random() * pool.length)];
  attempted.add(question.id);
  return publicQuestion(question);
};

const issueAthleticsRecoveryQuestion = (session: GameSession, player: PlayerSession, athletics: AthleticsPlayerState) => {
  const questions = getSessionQuestions(session);
  if (questions.length === 0) return undefined;
  const recoveryIndex = getAthleticsQuestionPoolIndex(
    athletics.questionIndex + (athletics.recoveryCorrectAnswers ?? 0),
    questions.length
  );
  const question = questions[recoveryIndex];
  if (!question) return undefined;
  playerQuestionGate.issue(player.id, question.id);
  return publicQuestion(question);
};

const issueNextQuestion = (session: GameSession, playerId: string): PublicQuestion | undefined => {
  if (session.settings.gameMode === "athletics") {
    const player = session.players.find((candidate) => candidate.id === playerId);
    const athletics = player ? ensureAthleticsPlayerState(session, player) : undefined;
    const questions = getSessionQuestions(session);
    if (!player || !athletics || athletics.status !== "racing") return undefined;
    if (athletics.recoveryActive) return issueAthleticsRecoveryQuestion(session, player, athletics);
    const race = getAthleticsRaceConfig(session);
    // Zeus reuses the normal question gate while a player is electrified. It
    // must not advance the race question until the freeze is cleared.
    if (athletics.zeusFrozen) {
      const question = questions[getAthleticsQuestionPoolIndex(athletics.questionIndex, questions.length)];
      if (!question) return undefined;
      playerQuestionGate.issue(player.id, question.id);
      return publicQuestion(question);
    }
    if (athletics.questionIndex >= race.questionCount || athletics.lapTransitionUntil) return undefined;
    const question = questions[getAthleticsQuestionPoolIndex(athletics.questionIndex, questions.length)];
    if (!question) return undefined;
    playerQuestionGate.issue(player.id, question.id);
    return publicQuestion(question);
  }
  const question = selectNextQuestion(session, playerId);
  if (question) playerQuestionGate.issue(playerId, question.id);
  return question;
};

const canReadQuestionAudio = (req: Request, questionId: string) => {
  const teacher = getBearerUser(req);
  const sourceQuiz = [...quizSets.values()].find((quiz) => quiz.questions.some((question) => question.id === questionId));
  if (teacher && sourceQuiz && (
    sourceQuiz.teacherId === teacher.id
    || (sourceQuiz.visibility === "PUBLIC" && sourceQuiz.status !== "ARCHIVED")
  )) return true;
  return [...sessions.values()].some((session) => getSessionQuestions(session).some((item) => item.id === questionId) && canReadRoomAsset(req, session));
};
const isQuestionAudioUsedByActiveSession = (questionId: string) => [...sessions.values()].some((session) => (
  session.status !== "ended"
  && getSessionQuestions(session).some((question) => question.id === questionId && question.audioUrl?.startsWith("/api/question-audio/"))
));

const learningPulseCache = new Map<string, { sourceSignature: string; pulse: LearningPulse }>();

const getLearningPulse = (session: GameSession): LearningPulse => {
  const questions = getSessionQuestions(session);
  const sourceSignature = JSON.stringify({
    questions: questions.map((question) => [question.id, question.prompt]),
    botIds: session.players.filter((player) => player.isBot).map((player) => player.id).sort()
  });
  const cached = learningPulseCache.get(session.id);
  if (cached?.sourceSignature === sourceSignature) return cached.pulse;
  const pulse = buildLearningPulse({
    sessionId: session.id,
    players: session.players,
    answers,
    questions
  });
  learningPulseCache.set(session.id, { sourceSignature, pulse });
  return pulse;
};

const stampSession = (session: GameSession): GameSession => {
  const { learningPulse: _learningPulse, questionSnapshot: _questionSnapshot, ...publicSession } = session;
  return { ...publicSession, serverTime: now() };
};

const stampTeacherSession = (session: GameSession): GameSession => ({
  ...stampSession(session),
  learningPulse: getLearningPulse(session)
});

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
  stampTeacherSession,
  getLearningPulse,
  teacherRoom,
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

const getQuizSetForUse = (userId: string, quizSetId: string) => {
  const quiz = quizSets.get(quizSetId);
  return canTeacherUseStudySet(quiz, userId) ? quiz : undefined;
};

const makeReport = (session: GameSession): SessionReport => {
  const sessionAnswers = answers.filter((answer) => answer.gameSessionId === session.id);
  const reportAnswers = sessionAnswers.filter(isMainRoundAnswer);
  const raceStandings = session.settings.gameMode === "athletics"
    ? resolveAthleticsStandings(session.players.map((player) => {
        ensureAthleticsPlayerState(session, player);
        return player;
      }))
    : [];
  const raceStandingByPlayerId = new Map(raceStandings.map((standing) => [standing.playerId, standing]));
  const reportPlayers = session.players.filter((player) => !player.isBot);
  const rows = buildReportRows({ players: session.players, answers: reportAnswers }).map((row, playerIndex) => {
    if (session.settings.gameMode !== "athletics") return row;
    const player = reportPlayers[playerIndex];
    const athletics = player?.athletics;
    const standing = player ? raceStandingByPlayerId.get(player.id) : undefined;
    const athleticsMode = getAthleticsMode(session.settings.athleticsMode ?? session.athletics?.mode);
    return {
      ...row,
      ...(standing && athletics?.status === "finished" ? { racePlace: player?.athletics?.finishPosition ?? standing.rank } : {}),
      ...(athletics?.finishTimeMs === undefined ? {} : { raceTimeMs: athletics.finishTimeMs }),
      raceStatus: athleticsMode === "hunters-runners" && athletics?.role === "hunter"
        ? "hunter" as const
        : athletics?.status === "finished" ? "finished" as const : "dnf" as const,
      raceFalls: athletics?.falls ?? 0,
      raceCheckpoint: athletics?.checkpointIndex ?? 0,
      raceLapsCompleted: athletics?.completedLaps ?? 0,
      raceLapsRequired: getAthleticsRaceConfig(session).requiredLaps,
      athleticsMode,
      ...(athletics?.role === undefined ? {} : { athleticsRole: athletics.role }),
      ...(athletics?.hunterHits === undefined ? {} : { athleticsHunterHits: athletics.hunterHits })
    };
  });

  const missedCounts = new Map<string, number>();
  for (const answer of reportAnswers) {
    if (!answer.isCorrect) missedCounts.set(answer.questionId, (missedCounts.get(answer.questionId) ?? 0) + 1);
  }

  const missedQuestions = [...missedCounts.entries()]
    .map(([questionId, misses]) => {
      const question = getSessionQuestion(session, questionId);
      return { questionId, prompt: question?.prompt ?? "Unknown question", misses };
    })
    .sort((a, b) => b.misses - a.misses);

  return { session, rows, missedQuestions };
};

const makeStudentLearningReport = (session: GameSession, player: PlayerSession): StudentLearningReport => {
  const quiz = quizSets.get(session.quizSetId);
  const sessionQuestions = getSessionQuestions(session);
  const sessionAttempts = buildStudentLearningAttempts({
    gameSessionId: session.id,
    playerSessionId: player.id,
    gameQuizSet: quiz ? { ...quiz, questions: sessionQuestions } : undefined,
    allQuizSets: quizSets.values(),
    answers
  });

  return {
    sessionId: session.id,
    sessionCode: session.sessionCode,
    playerId: player.id,
    studentName: player.nickname,
    ...(quiz ? {
      quizSet: {
        id: quiz.id,
        title: quiz.title,
        ...(quiz.description ? { description: quiz.description } : {}),
        questions: sessionQuestions.map(publicQuestion)
      }
    } : {}),
    attempts: sessionAttempts
  };
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

const deleteHistoryForTeacher = async (teacherId: string) => {
  const endedSessions = [...sessions.values()].filter((session) => session.teacherId === teacherId && session.status === "ended");
  const persistedCount = await normalizedLibrary?.deleteTeacherHistory(teacherId) ?? 0;
  const endedSessionIds = new Set(endedSessions.map((session) => session.id));

  for (const session of endedSessions) {
    sessions.delete(session.id);
    joinCodeDirectory.release(session.sessionCode, session.id);
    roomAuthority.release(session.id);
    purgeSessionDecals(session);
    pendingPositionBroadcasts.delete(session.sessionCode);
    botAlertsBySession.delete(session.sessionCode);
    learningPulseCache.delete(session.id);
    for (const player of session.players) {
      playerQuestionHistory.delete(player.id);
      const socketKey = playerSocketKey(session.sessionCode, player.id);
      playerSockets.delete(socketKey);
      const disconnectTimer = playerDisconnectTimers.get(socketKey);
      if (disconnectTimer) clearTimeout(disconnectTimer);
      playerDisconnectTimers.delete(socketKey);
    }
  }

  for (const [reportId, report] of reports) {
    if (report.teacherId === teacherId) reports.delete(reportId);
  }
  for (let index = answers.length - 1; index >= 0; index -= 1) {
    if (endedSessionIds.has(answers[index]!.gameSessionId)) answers.splice(index, 1);
  }
  schedulePersistence();
  return Math.max(persistedCount, endedSessions.length);
};

const getBotSpawn = (session: GameSession, team: Team, index: number) => {
  return sessionSpawn(session, team, index);
};

const roundRuntimeDependencies: RoundRuntimeDependencies = {
  now,
  nowMs: Date.now,
  sessions,
  ownsRoom,
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
  recordGameCompleted: (session) => contribution.recordGameCompleted(session),
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
  finishZombieMatchIfComplete,
  evaluateFlagEliminationWin
} = roundRuntime;

const startAthleticsRace = (session: GameSession) => {
  const questionPoolSize = Math.max(1, getSessionQuestions(session).length);
  const requiredLaps = session.settings.athleticsCourseLaps ?? 1;
  const questionsPerLap = getAthleticsQuestionsPerLap(questionPoolSize, requiredLaps);
  const questionCount = getAthleticsTotalQuestionCount(questionPoolSize, requiredLaps);
  const modeState = createAthleticsModeRoundState({
    sessionId: session.id,
    playerIds: session.players.map((player) => player.id),
    mode: session.settings.athleticsMode,
    round: 1,
    nowMs: Date.now()
  });
  const startAtMs = Date.now() + ATHLETICS_START_COUNTDOWN_MS;
  const startAt = new Date(startAtMs).toISOString();
  const timeLimitSeconds = Math.max(
    60,
    Number.isFinite(session.settings.roundDurationSeconds)
      ? session.settings.roundDurationSeconds
      : ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS
  );
  session.status = "active";
  session.controlState = "running";
  session.teacherPausedAt = undefined;
  session.startedAt = startAt;
  session.endsAt = new Date(startAtMs + timeLimitSeconds * 1000).toISOString();
  session.roundTransition = undefined;
  session.flag = undefined;
  session.athletics = {
    courseId: session.settings.athleticsCourseId ?? "stadium_loop",
    mode: modeState.mode,
    modeSeed: modeState.modeSeed,
    modeRound: modeState.modeRound,
    questionsPerLap,
    questionCount,
    requiredLaps,
    status: "countdown",
    startAt,
    finishOrder: [],
    runnerIds: modeState.runnerIds,
    hunterIds: modeState.hunterIds,
    modeRoundsTotal: modeState.modeRoundsTotal,
    rolesSwapped: modeState.rolesSwapped,
    ...(modeState.zeus ? { zeus: modeState.zeus } : {}),
    ...(modeState.chaos ? { chaos: modeState.chaos } : {})
  };
  const playerCount = Math.max(1, session.players.length);
  const hunterCount = Math.max(1, modeState.hunterIds.length);
  session.players = session.players.map((player, index) => {
    const role = modeState.roles[player.id] ?? "runner";
    const stationIndex = modeState.hunterIds.indexOf(player.id);
    const spawn = role === "hunter"
      ? getAthleticsHunterStationPosition(Math.max(0, stationIndex), hunterCount)
      : getAthleticsStartPosition(index, playerCount);
    playerQuestionGate.clear(player.id);
    const athletics = makeAthleticsPlayerState(index);
    athletics.role = role;
    athletics.stationIndex = role === "hunter" ? Math.max(0, stationIndex) : undefined;
    athletics.hunterAmmo = role === "hunter" ? 0 : undefined;
    athletics.hunterHits = resolveHunterHitsForRound({ role, round: 1 });
    athletics.hunterQuizStreak = role === "hunter" ? 0 : undefined;
    athletics.abilityCharge = 0;
    athletics.abilityReady = undefined;
    athletics.shieldCharges = 0;
    return {
      ...player,
      ...spawn,
      isAlive: true,
      health: DEFAULT_PLAYER_HEALTH,
      // Give every racer a short opening burst so answering is a strategic
      // refill, not a mandatory start-line gate.
      energy: ATHLETICS_CORRECT_ENERGY * 2,
      crouching: false,
      jumping: false,
      athletics
    };
  });
  for (const player of session.players) {
    if (!player.isBot) {
      const question = getSessionQuestions(session)[player.athletics?.questionIndex ?? 0];
      if (question) playerQuestionGate.issue(player.id, question.id);
    }
  }
  session.announcement = {
    ...makeAnnouncement(
      "round_start",
      modeState.mode === "classic" ? "Get set" : getAthleticsModeIntro(modeState.mode).title,
      modeState.mode === "classic"
        ? "Jump from platform to platform. Answer anytime to refill movement energy."
        : getAthleticsModeIntro(modeState.mode).message,
      `${getAthleticsModeIntro(modeState.mode).detail} · ${Math.ceil(ATHLETICS_START_COUNTDOWN_MS / 1000)} seconds until GO · ${requiredLaps} ${requiredLaps === 1 ? "lap" : "laps"}`,
      ATHLETICS_START_COUNTDOWN_MS
    ),
    expiresAt: startAt
  };
};

const markAthleticsFinished = (session: GameSession, player: PlayerSession, nowMs: number) => {
  const athletics = ensureAthleticsPlayerState(session, player);
  if (!athletics || athletics.status !== "racing") return false;
  athletics.status = "finished";
  athletics.finishedAt = new Date(nowMs).toISOString();
  athletics.finishTimeMs = Math.max(0, nowMs - Date.parse(session.athletics?.startAt ?? new Date(nowMs).toISOString()));
  athletics.finishPosition = (session.athletics?.finishOrder.length ?? 0) + 1;
  const finishScore = session.athletics?.mode === "hunters-runners"
    && athletics.role === "runner"
    ? Math.max(3, 12 - athletics.finishPosition)
    : 0;
  if (finishScore > 0) player.score += finishScore;
  player.isAlive = false;
  player.jumping = false;
  if (session.athletics) session.athletics.finishOrder.push(player.id);
  appendEvent(session, {
    type: "end",
    message: `${player.nickname} crossed the Athletics finish line in place ${athletics.finishPosition}.`,
    playerId: player.id,
    team: player.team
  });
  emitToPlayers(session, [player.id], "athletics_finish", {
    playerId: player.id,
    finishPosition: athletics.finishPosition,
    finishTimeMs: athletics.finishTimeMs,
    ...(finishScore > 0 ? { finishScore } : {})
  });
  if (session.athletics?.mode === "zeus" && session.status !== "ended") {
    session.athletics.status = "finished";
    if (session.athletics.zeus) {
      session.athletics.zeus.phase = "defeated";
      session.athletics.zeus.currentAttack = undefined;
    }
    emitAthleticsModeEvent(session, "zeus_defeated", {
      winnerId: player.id,
      winnerName: player.nickname,
      message: "ZEUS HAS BEEN DEFEATED!"
    });
    finishSession(
      session,
      `${player.nickname} reached the summit and defeated Zeus.`,
      makeAnnouncement(
        "game_over",
        "ZEUS HAS BEEN DEFEATED!",
        `${player.nickname} reached the summit first.`,
        "Final standings and quiz results are ready.",
        GAME_OVER_ANNOUNCEMENT_MS
      )
    );
  }
  return true;
};

const startNextAthleticsLap = (session: GameSession, player: PlayerSession, nowMs: number) => {
  const athletics = ensureAthleticsPlayerState(session, player);
  if (!athletics?.lapTransitionUntil || nowMs < Date.parse(athletics.lapTransitionUntil)) return false;
  athletics.lapTransitionUntil = undefined;
  const question = player.isBot ? undefined : issueNextQuestion(session, player.id);
  emitToPlayers(session, [player.id], "athletics_lap_start", {
    completedLaps: athletics.completedLaps,
    requiredLaps: getAthleticsRaceConfig(session).requiredLaps,
    question
  });
  return true;
};

const completeAthleticsLap = (session: GameSession, player: PlayerSession, nowMs: number) => {
  const race = session.athletics;
  const athletics = ensureAthleticsPlayerState(session, player);
  if (!race || !athletics || athletics.status !== "racing" || athletics.lapTransitionUntil) return false;
  const { requiredLaps } = getAthleticsRaceConfig(session);
  athletics.completedLaps = Math.min(requiredLaps, athletics.completedLaps + 1);
  athletics.lapSplitsMs.push(Math.max(0, nowMs - Date.parse(race.startAt)));
  if (athletics.completedLaps >= requiredLaps) return markAthleticsFinished(session, player, nowMs);

  const spawn = getAthleticsStartPosition(athletics.laneIndex ?? 0, Math.max(1, session.maxPlayers));
  Object.assign(player, spawn, { jumping: false, crouching: false });
  athletics.checkpointIndex = 0;
  athletics.lastSafeCheckpointIndex = 0;
  athletics.routeProgress = 0;
  athletics.lastSafeSurfaceIndex = 0;
  athletics.currentSupportedSurfaceIndex = 0;
  athletics.currentSupportKind = "main_surface";
  athletics.lastSupportedAtMs = nowMs;
  athletics.movementEpoch = (athletics.movementEpoch ?? 0) + 1;
  athletics.recoverySettleUntil = undefined;
  athletics.recoveryReason = undefined;
  // Energy carries across laps. A lap transition must not duplicate or erase
  // earned fuel, and the start platform remains safe for the next answer.
  athletics.gateOpen = true;
  athletics.wrongAnswerPenaltyUntil = undefined;
  athletics.lapTransitionUntil = new Date(nowMs + ATHLETICS_LAP_TRANSITION_MS).toISOString();
  playerQuestionGate.clear(player.id);
  emitToPlayers(session, [player.id], "athletics_lap_complete", {
    completedLaps: athletics.completedLaps,
    requiredLaps,
    splitTimeMs: athletics.lapSplitsMs.at(-1),
    position: spawn,
    movementEpoch: athletics.movementEpoch,
    transitionUntil: athletics.lapTransitionUntil,
    transitionMs: ATHLETICS_LAP_TRANSITION_MS
  });
  appendEvent(session, {
    type: "timer",
    message: `${player.nickname} completed lap ${athletics.completedLaps}/${requiredLaps}.`,
    playerId: player.id,
    team: player.team
  });
  return true;
};

const updateAthleticsRace = (session: GameSession, player: PlayerSession, nowMs: number) => {
  if (session.settings.gameMode !== "athletics") return;
  const race = session.athletics;
  const athletics = ensureAthleticsPlayerState(session, player);
  if (!race || !athletics) return;
  if (race.status === "countdown" && nowMs >= Date.parse(race.startAt)) {
    race.status = "running";
    session.announcement = makeAnnouncement("round_start", "GO", "Jump to the next platform. Answer anytime to refill movement energy.", undefined, 2_000);
    appendEvent(session, { type: "start", message: "Athletics Race is live." });
    broadcastSession(session);
  }
  if (race.status !== "running" || athletics.status !== "racing" || athletics.recoveryActive) return;
  // Hunters defend their authored stations; they are not additional racers
  // that should be evaluated against the parkour landing/checkpoint route.
  if (getAthleticsMode(session.settings.athleticsMode ?? race.mode) === "hunters-runners" && athletics.role === "hunter") return;
  if (startNextAthleticsLap(session, player, nowMs)) {
    broadcastPlayerState(session, [player]);
    broadcastSession(session);
  }
  if (athletics.lapTransitionUntil && nowMs < Date.parse(athletics.lapTransitionUntil)) return;

  const currentPosition = { x: player.x ?? 0, y: player.y ?? 0, z: player.z ?? 0 };
  const support = getAthleticsPhysicalSupport(
    currentPosition,
    ATHLETICS_STADIUM_COURSE,
    player.crouching === true ? ARENA_PLAYER_CROUCH_EYE_HEIGHT : ATHLETICS_PLAYER_EYE_HEIGHT,
    nowMs
  );
  athletics.currentSupportedSurfaceIndex = support.kind === "main_surface" ? support.surfaceIndex : undefined;
  athletics.currentSupportKind = support.kind;
  if (isAthleticsPlayableSupport(support)) athletics.lastSupportedAtMs = nowMs;
  if (support.kind === "main_surface" && support.surfaceIndex !== undefined && !player.jumping) {
    if (support.surfaceIndex >= (athletics.lastSafeSurfaceIndex ?? 0)) {
      athletics.lastSafeSurfaceIndex = support.surfaceIndex;
    }
    // A physically occupied authored landing is the canonical progress signal.
    athletics.routeProgress = Math.max(
      athletics.routeProgress,
      getAthleticsSurfaceRouteProgress(support.surfaceIndex, ATHLETICS_STADIUM_COURSE)
    );
  } else if (support.kind === "shortcut_surface") {
    athletics.routeProgress = Math.max(athletics.routeProgress, getAthleticsRouteProgress(currentPosition));
  } else if (support.kind !== "park_floor") {
    // Projection remains useful for standings while airborne, but it cannot
    // confirm a checkpoint or replace a physical landing for fall authority.
    athletics.routeProgress = Math.max(athletics.routeProgress, getAthleticsRouteProgress(currentPosition));
  }
  const nextCheckpointSurfaceIndex = getAthleticsCheckpointSurfaceIndex(
    athletics.checkpointIndex,
    ATHLETICS_STADIUM_COURSE
  );
  const isAtNextCheckpoint = isAthleticsCheckpointOccupied(support, nextCheckpointSurfaceIndex)
    && !player.jumping;
  if (isAtNextCheckpoint) {
    athletics.checkpointIndex = Math.min(ATHLETICS_CHECKPOINT_COUNT, athletics.checkpointIndex + 1);
    athletics.lastSafeCheckpointIndex = athletics.checkpointIndex;
    athletics.gateOpen = true;
    athletics.checkpointSplitsMs.push(Math.max(0, nowMs - Date.parse(race.startAt)));
    emitToPlayers(session, [player.id], "athletics_checkpoint", {
      checkpointIndex: athletics.checkpointIndex,
      questionIndex: athletics.questionIndex,
      routeProgress: athletics.routeProgress,
      completedLaps: athletics.completedLaps,
      requiredLaps: race.requiredLaps,
      nextCheckpointProgress: ATHLETICS_STADIUM_COURSE.checkpoints[athletics.checkpointIndex],
      message: athletics.checkpointIndex >= ATHLETICS_CHECKPOINT_COUNT
        ? "Skyline checkpoint reached. Keep climbing to the summit."
        : "Checkpoint reached. Answer anytime to refill movement energy."
    });
    appendEvent(session, {
      type: "timer",
      message: `${player.nickname} reached lap ${athletics.completedLaps + 1} checkpoint ${athletics.checkpointIndex}/${ATHLETICS_CHECKPOINT_COUNT}.`,
      playerId: player.id,
      team: player.team
    });
    broadcastPlayerState(session, [player]);
    broadcastSession(session);
  }

  const isAtFinishSurface = isAthleticsFinishOccupied(
    support,
    ATHLETICS_STADIUM_COURSE.surfaces.length - 1
  )
    && !player.jumping;
  if (isAtFinishSurface) {
    if (completeAthleticsLap(session, player, nowMs)) {
      broadcastPlayerState(session, [player]);
      broadcastSession(session);
    }
  }
};

const emitAthleticsModeEvent = (session: GameSession, eventName: string, payload: unknown) => {
  io.to(gameplayRoom(session.sessionCode)).emit(eventName, payload);
  io.to(teacherRoom(session.sessionCode)).emit(eventName, payload);
};

const advanceZeusMode = (session: GameSession, nowMs: number) => {
  const race = session.athletics;
  const zeus = race?.zeus;
  if (!race || !zeus || race.status !== "running") return false;
  let changed = false;

  for (const player of session.players) {
    const athletics = ensureAthleticsPlayerState(session, player);
    if (!athletics?.zeusFrozen || !athletics.zeusFrozenUntil) continue;
    if (nowMs < Date.parse(athletics.zeusFrozenUntil)) continue;
    athletics.zeusFrozen = false;
    athletics.zeusFrozenUntil = undefined;
    changed = true;
    emitToPlayers(session, [player.id], "zeus_freeze_break", {
      playerId: player.id,
      automatic: true,
      message: "The charge faded. Keep climbing and watch for the next warning."
    });
  }

  const attack = zeus.currentAttack;
  if (attack) {
    const strikeAt = Date.parse(attack.strikeAt);
    if (!Number.isFinite(strikeAt) || nowMs < strikeAt) return changed;
    for (const targetId of attack.targetIds) {
      const target = session.players.find((player) => player.id === targetId);
      if (!target) continue;
      const targetAthletics = ensureAthleticsPlayerState(session, target);
      const warningPosition = attack.warningPositions[target.id];
      if (!targetAthletics || !warningPosition || targetAthletics.status !== "racing" || targetAthletics.recoveryActive) continue;
      const strike = resolveZeusStrike({
        targetPosition: { x: target.x ?? warningPosition.x, y: target.y, z: target.z ?? warningPosition.z },
        warningPosition,
        radius: attack.strikeRadius
      });
      if (strike.hit) {
        targetAthletics.zeusFrozen = true;
        targetAthletics.zeusFrozenUntil = new Date(nowMs + 7_500).toISOString();
        const question = issueNextQuestion(session, target.id);
        emitToPlayers(session, [target.id], "zeus_strike", {
          playerId: target.id,
          attackId: attack.id,
          hit: true,
          position: warningPosition,
          frozenUntil: targetAthletics.zeusFrozenUntil,
          question,
          message: "Lightning caught you! Answer correctly to break the freeze."
        });
      } else {
        emitToPlayers(session, [target.id], "zeus_strike", {
          playerId: target.id,
          attackId: attack.id,
          hit: false,
          position: warningPosition,
          message: "You dodged the lightning!"
        });
      }
      appendEvent(session, {
        type: "timer",
        message: strike.hit ? `${target.nickname} was caught by Zeus's lightning.` : `${target.nickname} dodged Zeus's lightning.`,
        playerId: target.id,
        team: target.team
      });
      broadcastPlayerState(session, [target]);
    }
    zeus.currentAttack = undefined;
    zeus.phase = attack.tier === "rage" ? "rage" : "idle";
    const profile = getZeusAttackProfile(
      Math.max(...session.players.map((player) => player.athletics?.routeProgress ?? 0), 0),
      Math.max(1, session.players.length)
    );
    zeus.nextAttackAt = new Date(nowMs + profile.cooldownMs).toISOString();
    changed = true;
    emitAthleticsModeEvent(session, "zeus_strike_complete", {
      attackId: attack.id,
      tier: attack.tier,
      nextAttackAt: zeus.nextAttackAt
    });
    broadcastSession(session);
    return changed;
  }

  if (zeus.nextAttackAt && nowMs < Date.parse(zeus.nextAttackAt)) return changed;
  const eligible = session.players
    .map((player) => {
      const athletics = ensureAthleticsPlayerState(session, player);
      return {
        id: player.id,
        routeProgress: athletics?.routeProgress ?? 0,
        x: player.x ?? 0,
        y: player.y ?? ATHLETICS_PLAYER_EYE_HEIGHT,
        z: player.z ?? 0,
        eligible: Boolean(athletics && athletics.status === "racing" && !athletics.recoveryActive && !athletics.zeusFrozen)
      };
    });
  if (eligible.every((candidate) => candidate.eligible === false)) return changed;
  const highestProgress = Math.max(...eligible.map((candidate) => candidate.routeProgress), 0);
  const plan = getZeusTargetPlan({
    candidates: eligible,
    attackIndex: zeus.attackIndex,
    recentTargetIds: zeus.recentTargetIds,
    highestProgress
  });
  if (plan.targets.length === 0) return changed;
  const warningStartedAt = new Date(nowMs).toISOString();
  const strikeAt = new Date(nowMs + plan.profile.warningDurationMs).toISOString();
  const attackId = `${session.id}:zeus:${zeus.attackIndex}`;
  zeus.currentAttack = {
    id: attackId,
    tier: plan.profile.tier,
    targetIds: plan.targets.map((target) => target.id),
    warningPositions: Object.fromEntries(plan.targets.map((target) => [target.id, { x: target.x, y: target.y, z: target.z }])),
    warningStartedAt,
    strikeAt,
    strikeRadius: plan.profile.strikeRadius,
    shockwave: plan.profile.shockwave
  };
  zeus.attackIndex += 1;
  zeus.phase = "charging";
  zeus.recentTargetIds = [
    ...plan.targets.map((target) => target.id),
    ...zeus.recentTargetIds
  ].filter((targetId, index, list) => list.indexOf(targetId) === index).slice(0, 6);
  zeus.nextAttackAt = undefined;
  emitAthleticsModeEvent(session, "zeus_warning", {
    attackId,
    tier: plan.profile.tier,
    targetIds: zeus.currentAttack.targetIds,
    warningPositions: zeus.currentAttack.warningPositions,
    warningStartedAt,
    strikeAt,
    warningDurationMs: plan.profile.warningDurationMs,
    strikeRadius: plan.profile.strikeRadius,
    shockwave: plan.profile.shockwave
  });
  session.announcement = makeAnnouncement(
    "round_start",
    plan.profile.tier === "rage" ? "Zeus is furious!" : "Lightning warning",
    plan.profile.tier === "rage" ? "Move now. Zeus is charging a stronger strike." : "Watch for the warning ring, then dodge.",
    `${plan.profile.warningDurationMs / 1000}s warning · ${plan.profile.targetCount > 1 ? "multiple targets" : "one target"}`,
    plan.profile.warningDurationMs
  );
  broadcastSession(session);
  return true;
};

const applyChaosImpact = (session: GameSession, player: PlayerSession, hazard: AthleticsHazardDefinition, hazardPosition: { x: number; y: number; z: number }, nowMs: number) => {
  const athletics = ensureAthleticsPlayerState(session, player);
  if (!athletics || athletics.status !== "racing" || athletics.recoveryActive) return false;
  const impact = resolveChaosHazardImpact({
    hazard,
    playerPosition: { x: player.x ?? 0, y: player.y, z: player.z ?? 0 },
    hazardPosition,
    shieldCharges: athletics.shieldCharges ?? 0
  });
  if (!impact.hit) return false;
  hazard.hitIds = [...new Set([...(hazard.hitIds ?? []), player.id])];
  if (impact.shielded) {
    athletics.shieldCharges = Math.max(0, (athletics.shieldCharges ?? 0) - 1);
    emitAthleticsModeEvent(session, "chaos_hazard_impact", {
      hazardId: hazard.id,
      hazardType: hazard.kind,
      playerId: player.id,
      x: hazardPosition.x,
      y: hazardPosition.y,
      z: hazardPosition.z,
      shielded: true,
      knockback: 0
    });
    broadcastPlayerState(session, [player]);
    return true;
  }
  const resistActive = Boolean(athletics.knockbackResistUntil && nowMs < Date.parse(athletics.knockbackResistUntil));
  const currentChaosEvent = session.athletics?.chaos?.currentEvent;
  const activeChaosEvent = currentChaosEvent && nowMs < Date.parse(currentChaosEvent.expiresAt) ? currentChaosEvent : undefined;
  const eventKnockbackMultiplier = activeChaosEvent ? getChaosEventModifiers(activeChaosEvent).knockbackMultiplier : 1;
  const knockback = impact.knockback * eventKnockbackMultiplier * (resistActive ? 0.35 : 1);
  let directionX = (player.x ?? 0) - hazardPosition.x;
  let directionZ = (player.z ?? 0) - hazardPosition.z;
  const directionLength = Math.hypot(directionX, directionZ);
  if (directionLength < 0.001) {
    const tangent = getAthleticsRouteTangent(ensureAthleticsPlayerState(session, player)?.routeProgress ?? 0);
    directionX = tangent.z;
    directionZ = -tangent.x;
  } else {
    directionX /= directionLength;
    directionZ /= directionLength;
  }
  player.x = Math.max(-ATHLETICS_COURSE_BOUNDS.limitX + 1, Math.min(ATHLETICS_COURSE_BOUNDS.limitX - 1, (player.x ?? 0) + directionX * knockback));
  player.z = Math.max(-ATHLETICS_COURSE_BOUNDS.limitZ + 1, Math.min(ATHLETICS_COURSE_BOUNDS.limitZ - 1, (player.z ?? 0) + directionZ * knockback));
  athletics.staggerUntil = new Date(nowMs + HUNTER_STAGGER_MS).toISOString();
  athletics.lastChaosHazardId = hazard.id;
  emitAthleticsModeEvent(session, "chaos_hazard_impact", {
    hazardId: hazard.id,
    hazardType: hazard.kind,
    playerId: player.id,
    x: hazardPosition.x,
    y: hazardPosition.y,
    z: hazardPosition.z,
    shielded: false,
    knockback
  });
  appendEvent(session, {
    type: "timer",
    message: `${player.nickname} was bounced by a ${hazard.kind.replace("-", " ")}.`,
    playerId: player.id,
    team: player.team
  });
  broadcastPlayerPosition(session, { playerId: player.id, x: player.x, y: player.y, z: player.z, facing: player.facing ?? 0 });
  broadcastPlayerState(session, [player]);
  return true;
};

const advanceChaosClimb = (session: GameSession, nowMs: number) => {
  const race = session.athletics;
  const chaos = race?.chaos;
  if (!race || !chaos || race.status !== "running") return false;
  let changed = false;
  const beforeCount = chaos.activeHazards.length;
  chaos.activeHazards = chaos.activeHazards.filter((hazard) => {
    const expiresAt = Date.parse(hazard.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > nowMs;
  });
  changed = chaos.activeHazards.length !== beforeCount;
  if (chaos.currentEvent && nowMs >= Date.parse(chaos.currentEvent.expiresAt)) {
    chaos.currentEvent = undefined;
    changed = true;
  }
  if (nowMs >= Date.parse(chaos.nextWaveAt) && chaos.activeHazards.length < CHAOS_HAZARD_LIMIT) {
    const nextWaveIndex = chaos.waveIndex + 1;
    const event = getChaosEventForWave({ seed: chaos.seed, waveIndex: nextWaveIndex, nowMs });
    const wave = createChaosWave({
      seed: chaos.seed,
      waveIndex: nextWaveIndex,
      nowMs,
      activeHazardCount: chaos.activeHazards.length,
      playerCount: session.players.length,
      eventType: event?.type
    });
    chaos.waveIndex = nextWaveIndex;
    chaos.activeHazards = [...chaos.activeHazards, ...wave].slice(0, CHAOS_HAZARD_LIMIT);
    chaos.nextWaveAt = new Date(nowMs + CHAOS_WAVE_INTERVAL_MS).toISOString();
    if (event) {
      chaos.currentEvent = event;
      session.announcement = makeAnnouncement(
        "round_start",
        `CHAOS EVENT: ${event.label}!`,
        event.type === "wind-gust" ? "Hold your line through the gust." : "Watch the course and react together.",
        "A short warning gives everyone time to respond.",
        2_200
      );
    }
    emitAthleticsModeEvent(session, "chaos_wave", {
      waveIndex: chaos.waveIndex,
      hazards: wave,
      event,
      nextWaveAt: chaos.nextWaveAt
    });
    changed = true;
  }
  const activeEvent = chaos.currentEvent && nowMs < Date.parse(chaos.currentEvent.expiresAt) ? chaos.currentEvent : undefined;
  const hazardSpeedMultiplier = activeEvent ? getChaosEventModifiers(activeEvent).hazardSpeedMultiplier : 1;
  for (const hazard of chaos.activeHazards) {
    if (hazard.hitIds && hazard.hitIds.length >= session.players.length) continue;
    const position = getChaosHazardPosition(hazard, ATHLETICS_STADIUM_COURSE.route, nowMs, hazardSpeedMultiplier);
    for (const player of session.players) {
      if (hazard.hitIds?.includes(player.id)) continue;
      if (applyChaosImpact(session, player, hazard, position, nowMs)) changed = true;
    }
  }
  if (changed) broadcastSession(session);
  return changed;
};

const advanceAthleticsProjectiles = (session: GameSession, nowMs: number) => {
  const pending = athleticsProjectiles.get(session.id);
  if (!pending || pending.length === 0) return false;
  let changed = false;
  const remaining: PendingHunterProjectile[] = [];
  for (const projectile of pending) {
    if (projectile.resolved || nowMs < projectile.impactAt) {
      remaining.push(projectile);
      continue;
    }
    projectile.resolved = true;
    const hunter = session.players.find((player) => player.id === projectile.hunterId);
    const target = session.players.find((player) => player.id === projectile.targetId);
    const targetAthletics = target ? ensureAthleticsPlayerState(session, target) : undefined;
    if (!hunter || !target || !targetAthletics || targetAthletics.status !== "racing" || targetAthletics.role !== "runner" || targetAthletics.recoveryActive) continue;
    const impact = resolveChaosHazardImpact({
      hazard: { radius: projectile.radius, knockback: athleticsModeLimits.hunterKnockbackDistance },
      playerPosition: { x: target.x ?? 0, y: target.y, z: target.z ?? 0 },
      hazardPosition: projectile.targetAtLaunch,
      shieldCharges: targetAthletics.shieldCharges ?? 0
    });
    if (impact.hit) {
      if (impact.shielded) targetAthletics.shieldCharges = Math.max(0, (targetAthletics.shieldCharges ?? 0) - 1);
      else {
        let dx = (target.x ?? 0) - projectile.targetAtLaunch.x;
        let dz = (target.z ?? 0) - projectile.targetAtLaunch.z;
        if (Math.hypot(dx, dz) < 0.001) {
          const tangent = getAthleticsRouteTangent(targetAthletics.routeProgress ?? 0);
          // Push across the route when the runner stayed on the telegraphed
          // point; a zero vector must not turn a confirmed hit into a no-op.
          dx = tangent.z;
          dz = -tangent.x;
        }
        const length = Math.hypot(dx, dz) || 1;
        const resist = targetAthletics.knockbackResistUntil && nowMs < Date.parse(targetAthletics.knockbackResistUntil) ? 0.35 : 1;
        dx /= length;
        dz /= length;
        target.x = Math.max(-ATHLETICS_COURSE_BOUNDS.limitX + 1, Math.min(ATHLETICS_COURSE_BOUNDS.limitX - 1, (target.x ?? 0) + dx * HUNTER_KNOCKBACK_DISTANCE * resist));
        target.z = Math.max(-ATHLETICS_COURSE_BOUNDS.limitZ + 1, Math.min(ATHLETICS_COURSE_BOUNDS.limitZ - 1, (target.z ?? 0) + dz * HUNTER_KNOCKBACK_DISTANCE * resist));
        targetAthletics.staggerUntil = new Date(nowMs + HUNTER_STAGGER_MS).toISOString();
      }
      const hunterAthletics = ensureAthleticsPlayerState(session, hunter);
      if (hunterAthletics) {
        hunterAthletics.hunterHits = (hunterAthletics.hunterHits ?? 0) + 1;
        hunter.score += impact.shielded ? 1 : 3;
      }
      targetAthletics.lastChaosHazardId = projectile.id;
      emitAthleticsModeEvent(session, "athletics_projectile_impact", {
        projectileId: projectile.id,
        hunterId: hunter.id,
        targetId: target.id,
        x: projectile.targetAtLaunch.x,
        y: projectile.targetAtLaunch.y,
        z: projectile.targetAtLaunch.z,
        shielded: impact.shielded,
        knockback: impact.shielded ? 0 : HUNTER_KNOCKBACK_DISTANCE
      });
      broadcastPlayerPosition(session, { playerId: target.id, x: target.x ?? 0, y: target.y, z: target.z ?? 0, facing: target.facing ?? 0 });
      // Hunter score/hit totals and runner impact state change together.
      broadcastPlayerState(session, [hunter, target]);
      changed = true;
    }
  }
  if (remaining.length > 0) athleticsProjectiles.set(session.id, remaining);
  else athleticsProjectiles.delete(session.id);
  return changed;
};

const startNextHuntersRunnersRound = (session: GameSession, nowMs: number) => {
  const race = session.athletics;
  if (!race || race.mode !== "hunters-runners" || (race.modeRound ?? 1) >= (race.modeRoundsTotal ?? 2)) return false;
  const nextRound = (race.modeRound ?? 1) + 1;
  const modeState = createAthleticsModeRoundState({
    sessionId: session.id,
    playerIds: session.players.map((player) => player.id),
    mode: "hunters-runners",
    round: nextRound,
    nowMs
  });
  const startAtMs = nowMs + ATHLETICS_START_COUNTDOWN_MS;
  const timeLimitSeconds = Math.max(60, session.settings.roundDurationSeconds || ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS);
  session.currentRound = nextRound;
  session.status = "active";
  session.controlState = "running";
  session.teacherPausedAt = undefined;
  session.startedAt = new Date(startAtMs).toISOString();
  session.endsAt = new Date(startAtMs + timeLimitSeconds * 1000).toISOString();
  session.roundTransition = undefined;
  session.athletics = {
    ...race,
    mode: modeState.mode,
    modeSeed: modeState.modeSeed,
    modeRound: modeState.modeRound,
    status: "countdown",
    startAt: session.startedAt,
    finishOrder: [],
    runnerIds: modeState.runnerIds,
    hunterIds: modeState.hunterIds,
    modeRoundsTotal: modeState.modeRoundsTotal,
    rolesSwapped: true
  };
  athleticsProjectiles.delete(session.id);
  const playerCount = Math.max(1, session.players.length);
  const hunterCount = Math.max(1, modeState.hunterIds.length);
  session.players = session.players.map((player, index) => {
    const role = modeState.roles[player.id] ?? "runner";
    const stationIndex = modeState.hunterIds.indexOf(player.id);
    const spawn = role === "hunter"
      ? getAthleticsHunterStationPosition(Math.max(0, stationIndex), hunterCount)
      : getAthleticsStartPosition(index, playerCount);
    playerQuestionGate.clear(player.id);
    const athletics = makeAthleticsPlayerState(index);
    athletics.role = role;
    athletics.stationIndex = role === "hunter" ? Math.max(0, stationIndex) : undefined;
    athletics.hunterAmmo = role === "hunter" ? 0 : undefined;
    athletics.hunterHits = resolveHunterHitsForRound({
      role,
      round: nextRound,
      previousHits: player.athletics?.hunterHits
    });
    athletics.hunterQuizStreak = role === "hunter" ? 0 : undefined;
    return {
      ...player,
      ...spawn,
      isAlive: true,
      health: DEFAULT_PLAYER_HEALTH,
      energy: ATHLETICS_CORRECT_ENERGY * 2,
      crouching: false,
      jumping: false,
      athletics
    };
  });
  for (const player of session.players) {
    if (!player.isBot) {
      const question = getSessionQuestions(session)[player.athletics?.questionIndex ?? 0];
      if (question) playerQuestionGate.issue(player.id, question.id);
    }
  }
  const intro = getAthleticsModeIntro("hunters-runners");
  session.announcement = {
    ...makeAnnouncement(
      "round_start",
      "ROLES SWAPPED",
      `${intro.message} · Round ${nextRound}/${modeState.modeRoundsTotal}`,
      `${intro.detail} · ${Math.ceil(ATHLETICS_START_COUNTDOWN_MS / 1000)} seconds until GO`,
      ATHLETICS_START_COUNTDOWN_MS
    ),
    expiresAt: session.startedAt
  };
  appendEvent(session, { type: "start", message: `Hunters & Runners roles swapped for round ${nextRound}.` });
  emitAthleticsModeEvent(session, "athletics_role_swap", {
    modeRound: nextRound,
    modeRoundsTotal: modeState.modeRoundsTotal,
    runnerIds: modeState.runnerIds,
    hunterIds: modeState.hunterIds,
    startAt: session.startedAt
  });
  broadcastSession(session);
  broadcastPlayerState(session, session.players);
  return true;
};

const advanceAthleticsRaces = () => {
  const currentMs = Date.now();
  for (const session of sessions.values()) {
    if (!ownsRoom(session.id) || session.settings.gameMode !== "athletics" || session.status !== "active") continue;
    if (isTeacherPaused(session)) continue;
    if (!session.athletics) continue;
    for (const player of session.players) updateAthleticsRace(session, player, currentMs);
    const mode = getAthleticsMode(session.settings.athleticsMode ?? session.athletics.mode);
    if (mode === "zeus") advanceZeusMode(session, currentMs);
    if (mode === "chaos-climb") advanceChaosClimb(session, currentMs);
    if (mode === "hunters-runners") advanceAthleticsProjectiles(session, currentMs);
    if (mode === "hunters-runners") {
      const runnerIds = session.athletics.runnerIds ?? session.players.filter((player) => player.athletics?.role === "runner").map((player) => player.id);
      const runners = session.players.filter((player) => runnerIds.includes(player.id));
      const runnersDone = runners.length > 0 && runners.every((player) => player.athletics?.status === "finished" || player.athletics?.status === "dnf");
      if (runnersDone) {
        if (startNextHuntersRunnersRound(session, currentMs)) continue;
        session.athletics.status = "finished";
        finishSession(session, "All runners completed the final Hunters & Runners round. Results are ready.");
        continue;
      }
    }
    const realRacers = session.players.filter((player) => !player.isBot);
    if (mode !== "hunters-runners" && mode !== "zeus" && realRacers.length > 0 && realRacers.every((player) => player.athletics?.status === "finished")) {
      session.athletics.status = "finished";
      finishSession(session, "Every racer crossed the line. Athletics results are ready.");
      continue;
    }
    const remaining = session.endsAt ? Date.parse(session.endsAt) - currentMs : 1;
    if (remaining > 0) continue;
    session.athletics.status = "expired";
    for (const player of session.players) {
      const athletics = ensureAthleticsPlayerState(session, player);
      if (athletics?.status === "racing") athletics.status = "dnf";
    }
    if (mode === "hunters-runners" && startNextHuntersRunnersRound(session, currentMs)) continue;
    finishSession(session, mode === "zeus" ? "The climb ended before anyone defeated Zeus. Results are ready." : "Athletics Race time expired. Results are ready.");
  }
};

const pauseSession = (session: GameSession) => pauseSessionForTeacher(session);
const resumeSession = (session: GameSession) => {
  const result = resumeSessionForTeacher(session);
  if (result.ok && result.changed) {
    shiftTeacherPauseRuntimeTimers({
      session,
      deltaMs: result.pausedDurationMs ?? 0,
      playerMoveTimestamps,
      playerNextFireAt,
      botRespawnAt,
      botNextAttackAt,
      playerQuestionGate,
      playerPositionHistory,
      botMemoryById,
      botAlertsBySession
    });
  }
  return result;
};

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

const beginAthleticsRecovery = (
  session: GameSession,
  player: PlayerSession,
  athletics: AthleticsPlayerState,
  nowMs: number,
  reason: AthleticsRecoveryReason = "below_world",
  diagnostic?: { position: { x: number; y: number; z: number }; support?: AthleticsPhysicalSupport }
) => {
  const currentPosition = {
    x: player.x ?? 0,
    y: player.y ?? ATHLETICS_PLAYER_EYE_HEIGHT,
    z: player.z ?? 0,
    facing: player.facing ?? 0
  };
  if (athletics.recoveryActive) return currentPosition;

  const routeProgressBeforeRecovery = athletics.routeProgress;
  const progressSafeIndex = getAthleticsPreviousSafeSurfaceIndex(athletics.routeProgress, ATHLETICS_STADIUM_COURSE);
  const trackedSafeIndex = Number.isInteger(athletics.lastSafeSurfaceIndex)
    ? Math.max(0, athletics.lastSafeSurfaceIndex ?? 0)
    : progressSafeIndex;
  const safeSurfaceIndex = Math.max(0, Math.min(trackedSafeIndex, progressSafeIndex));
  const safeProgress = getAthleticsSurfaceRouteProgress(safeSurfaceIndex, ATHLETICS_STADIUM_COURSE);
  const safeCheckpointIndex = ATHLETICS_STADIUM_COURSE.checkpoints.filter((progress) => progress <= safeProgress + 0.02).length;
  const requiredAnswers = athletics.recoveryRequiredAnswers ?? ATHLETICS_RECOVERY_CORRECT_ANSWERS_REQUIRED;

  athletics.falls += 1;
  athletics.lastSafeSurfaceIndex = safeSurfaceIndex;
  athletics.recoveryActive = true;
  athletics.recoveryCorrectAnswers = 0;
  athletics.recoveryRequiredAnswers = requiredAnswers;
  athletics.recoverySurfaceId = ATHLETICS_STADIUM_COURSE.surfaces[safeSurfaceIndex]?.id;
  athletics.recoveryRouteProgress = safeProgress;
  athletics.recoveryReason = reason;
  athletics.currentSupportedSurfaceIndex = undefined;
  athletics.currentSupportKind = "airborne";
  athletics.movementEpoch = (athletics.movementEpoch ?? 0) + 1;
  athletics.recoverySettleUntil = undefined;
  // A failed jump may have been measured in the air beyond the last landing.
  // Rewind only to the server-tracked landing; never advance progress here.
  athletics.routeProgress = Math.min(athletics.routeProgress, safeProgress);
  athletics.checkpointIndex = Math.min(athletics.checkpointIndex, safeCheckpointIndex);
  athletics.lastSafeCheckpointIndex = Math.min(athletics.lastSafeCheckpointIndex, athletics.checkpointIndex);
  athletics.respawnPenaltyUntil = undefined;
  player.isAlive = false;
  player.health = 0;
  player.jumping = false;
  player.crouching = false;
  playerMoveTimestamps.set(player.id, nowMs);
  if (!isProduction) {
    const diagnosticPosition = diagnostic?.position ?? currentPosition;
    const diagnosticSupport = diagnostic?.support ?? getAthleticsPhysicalSupport(
      diagnosticPosition,
      ATHLETICS_STADIUM_COURSE,
      ATHLETICS_PLAYER_EYE_HEIGHT,
      nowMs
    );
    console.info(`[athletics] recovery ${JSON.stringify({
      playerId: player.id,
      reason,
      authoritativePosition: diagnosticPosition,
      routeProgressBeforeRecovery,
      routeExpectedY: getAthleticsRouteHeight(routeProgressBeforeRecovery, ATHLETICS_STADIUM_COURSE),
      supportedSurfaceId: diagnosticSupport.surfaceId,
      supportedSurfaceIndex: diagnosticSupport.surfaceIndex,
      supportKind: diagnosticSupport.kind,
      physicalSupportY: diagnosticSupport.supportY,
      checkpointIndex: athletics.checkpointIndex,
      safeSurfaceIndex,
      safeSurfaceId: athletics.recoverySurfaceId,
      safeRouteProgress: safeProgress,
      falls: athletics.falls,
      movementEpoch: athletics.movementEpoch
    })}`);
  }
  const question = issueAthleticsRecoveryQuestion(session, player, athletics);
  emitToPlayers(session, [player.id], "athletics_recovery_start", {
    falls: athletics.falls,
    checkpointIndex: athletics.checkpointIndex,
    completedLaps: athletics.completedLaps,
    recoveryCorrectAnswers: athletics.recoveryCorrectAnswers,
    recoveryRequiredAnswers: requiredAnswers,
    recoverySurfaceId: athletics.recoverySurfaceId,
    recoveryReason: reason,
    movementEpoch: athletics.movementEpoch,
    question,
    message: "You fell! Answer 3 questions to get back on the course."
  });
  appendEvent(session, {
    type: "respawn",
    message: `${player.nickname} fell and entered the Athletics recovery challenge.`,
    playerId: player.id,
    team: player.team
  });
  broadcastPlayerState(session, [player]);
  broadcastSession(session);
  return currentPosition;
};

const completeAthleticsRecovery = (
  session: GameSession,
  player: PlayerSession,
  athletics: AthleticsPlayerState,
  nowMs: number
) => {
  const storedIndex = athletics.recoverySurfaceId
    ? ATHLETICS_STADIUM_COURSE.surfaces.findIndex((surface) => surface.id === athletics.recoverySurfaceId)
    : -1;
  const safeSurfaceIndex = storedIndex >= 0
    ? storedIndex
    : Math.max(0, Math.floor(athletics.lastSafeSurfaceIndex ?? 0));
  const safeProgress = athletics.recoveryRouteProgress
    ?? getAthleticsSurfaceRouteProgress(safeSurfaceIndex, ATHLETICS_STADIUM_COURSE);
  const respawn = getAthleticsRecoveryPosition(
    safeSurfaceIndex,
    athletics.laneIndex ?? 0,
    ATHLETICS_STADIUM_COURSE
  );
  const safeCheckpointIndex = ATHLETICS_STADIUM_COURSE.checkpoints.filter((progress) => progress <= safeProgress + 0.02).length;
  Object.assign(player, respawn, {
    isAlive: true,
    health: DEFAULT_PLAYER_HEALTH,
    jumping: false,
    crouching: false
  });
  player.respawns = (player.respawns ?? 0) + 1;
  player.roundRespawns = (player.roundRespawns ?? 0) + 1;
  player.energy = Math.max(normalizeAthleticsEnergy(player.energy), ATHLETICS_RECOVERY_MIN_ENERGY);
  athletics.lastSafeSurfaceIndex = safeSurfaceIndex;
  athletics.currentSupportedSurfaceIndex = safeSurfaceIndex;
  athletics.currentSupportKind = "main_surface";
  athletics.lastSupportedAtMs = nowMs;
  athletics.routeProgress = Math.min(athletics.routeProgress, safeProgress);
  athletics.checkpointIndex = Math.min(athletics.checkpointIndex, safeCheckpointIndex);
  athletics.lastSafeCheckpointIndex = Math.min(athletics.lastSafeCheckpointIndex, athletics.checkpointIndex);
  athletics.recoveryActive = false;
  athletics.recoveryCorrectAnswers = 0;
  athletics.recoveryRequiredAnswers = ATHLETICS_RECOVERY_CORRECT_ANSWERS_REQUIRED;
  athletics.recoverySurfaceId = undefined;
  athletics.recoveryRouteProgress = undefined;
  athletics.respawnPenaltyUntil = undefined;
  athletics.wrongAnswerPenaltyUntil = undefined;
  athletics.recoverySettleUntil = new Date(nowMs + ATHLETICS_RECOVERY_SETTLE_MS).toISOString();
  playerMoveTimestamps.set(player.id, nowMs);
  playerPositionHistory.clear(player.id);
  playerPositionHistory.record(player.id, respawn, nowMs);
  playerQuestionGate.clear(player.id);
  const question = issueNextQuestion(session, player.id);
  emitToPlayers(session, [player.id], "athletics_recovery_complete", {
    position: respawn,
    checkpointIndex: athletics.checkpointIndex,
    currentSupportedSurfaceIndex: safeSurfaceIndex,
    routeProgress: athletics.routeProgress,
    completedLaps: athletics.completedLaps,
    energy: player.energy,
    recoveryReason: athletics.recoveryReason,
    movementEpoch: athletics.movementEpoch,
    question,
    message: "Recovery complete! Back to the course."
  });
  return { position: respawn, question };
};

const applyAuthoritativePosition = (
  session: GameSession,
  player: PlayerSession,
  requested: {
    x?: number;
    z?: number;
    y?: number;
    facing?: number;
    crouching?: boolean;
    jumping?: boolean;
    movementSequence?: number;
    movementEpoch?: number;
  },
  nowMs = Date.now()
) => {
  const isAthletics = session.settings.gameMode === "athletics";
  const athletics = isAthletics ? ensureAthleticsPlayerState(session, player) : undefined;
  const fallback = sessionSpawn(session, player.team);
  const lastMoveAt = playerMoveTimestamps.get(player.id) ?? nowMs - BOT_TICK_MS;
  const elapsedMs = nowMs - lastMoveAt;
  const requestedX = Number.isFinite(Number(requested.x)) ? Number(requested.x) : player.x ?? fallback.x;
  const requestedZ = Number.isFinite(Number(requested.z)) ? Number(requested.z) : player.z ?? fallback.z;
  const currentX = player.x ?? fallback.x;
  const currentZ = player.z ?? fallback.z;
  const requestedCrouching = typeof requested.crouching === "boolean"
    ? requested.crouching
    : player.crouching === true;
  const requestedEyeHeight = requestedCrouching
    ? ARENA_PLAYER_CROUCH_EYE_HEIGHT
    : ARENA_PLAYER_EYE_HEIGHT;
  const currentEyeY = player.y ?? fallback.y ?? getArenaEyeHeight(session.settings.mapId, currentX, currentZ);
  const requestedEyeY = Number.isFinite(Number(requested.y)) ? Number(requested.y) : currentEyeY;
  const currentPosition = {
    x: currentX,
    y: currentEyeY,
    z: currentZ,
    facing: player.facing ?? fallback.facing
  };
  const requestedFacing = Number.isFinite(Number(requested.facing)) ? Number(requested.facing) : currentPosition.facing;
  if (isAthletics && athletics) {
    const requestedEpoch = Number(requested.movementEpoch);
    const currentEpoch = athletics.movementEpoch ?? 0;
    const hasEpoch = Number.isInteger(requestedEpoch) && requestedEpoch >= 0;
    const requestedSequence = Number(requested.movementSequence);
    const hasSequence = Number.isInteger(requestedSequence) && requestedSequence >= 0;
    const staleSequence = hasSequence
      && athletics.lastAcceptedMovementSequence !== undefined
      && requestedSequence <= athletics.lastAcceptedMovementSequence;
    const staleEpoch = hasEpoch && requestedEpoch !== currentEpoch;
    if (staleSequence || staleEpoch) {
      // Do not advance the movement clock for a packet that has already been
      // superseded; otherwise the next valid packet could receive an
      // artificial speed burst.
      playerMoveTimestamps.set(player.id, nowMs);
      return { ...currentPosition, facing: requestedFacing };
    }
    if (hasSequence) athletics.lastAcceptedMovementSequence = requestedSequence;
  }
  const isStationaryAthleticsHunter = Boolean(
    isAthletics
    && athletics
    && getAthleticsMode(session.settings.athleticsMode ?? session.athletics?.mode) === "hunters-runners"
    && athletics.role === "hunter"
  );
  if (isAthletics && athletics && (
    athletics.status !== "racing"
    || athletics.recoveryActive
    || athletics.zeusFrozen
    || Boolean(athletics.lapTransitionUntil && nowMs < Date.parse(athletics.lapTransitionUntil))
    || (athletics.respawnPenaltyUntil && nowMs < Date.parse(athletics.respawnPenaltyUntil))
    || (athletics.wrongAnswerPenaltyUntil && nowMs < Date.parse(athletics.wrongAnswerPenaltyUntil))
    || Boolean(athletics.staggerUntil && nowMs < Date.parse(athletics.staggerUntil))
    || (session.athletics && nowMs < Date.parse(session.athletics.startAt))
  )) {
    playerMoveTimestamps.set(player.id, nowMs);
    player.facing = requestedFacing;
    return { ...currentPosition, facing: requestedFacing };
  }
  if (isStationaryAthleticsHunter && athletics) {
    // Hunters defend authored stations rather than standing on the runner
    // route. Their station can intentionally hover beside a gap or elevated
    // platform, so route support/fall recovery must not reinterpret a valid
    // station position as a player fall.
    const station = getAthleticsHunterStationPosition(
      athletics.stationIndex ?? 0,
      Math.max(1, session.athletics?.hunterIds?.length ?? 1)
    );
    player.x = station.x;
    player.y = station.y;
    player.z = station.z;
    player.facing = requestedFacing;
    player.crouching = requestedCrouching;
    player.jumping = false;
    athletics.currentSupportedSurfaceIndex = undefined;
    athletics.currentSupportKind = "airborne";
    playerMoveTimestamps.set(player.id, nowMs);
    return { ...station, facing: requestedFacing };
  }
  if (isAthletics && athletics
    && Number.isFinite(Number(requested.y))
    && Number(requested.y) < 0.5
    && !(athletics.recoverySettleUntil && nowMs < Date.parse(athletics.recoverySettleUntil))) {
    // Older clients use a below-world y marker while retaining their last
    // x/z. It remains an explicit fall signal, but only after packet epoch
    // validation and the short exact-respawn settle guard above.
    return beginAthleticsRecovery(session, player, athletics, nowMs, "below_world", {
      position: { ...currentPosition, y: Number(requested.y) },
      support: { kind: "airborne", supportY: 0 }
    });
  }
  const requestedGroundY = isAthletics
    ? getAthleticsGroundHeight({ x: requestedX, y: requestedEyeY, z: requestedZ }, nowMs)
    : getArenaGroundHeightForPlayer(
      session.settings.mapId,
      requestedX,
      requestedZ,
      requestedEyeY,
      requestedEyeHeight
    );
  const requestedStandingY = requestedGroundY + requestedEyeHeight;
  const jumpStarted = isAthletics && requested.jumping === true && player.jumping !== true;
  const athleticsCanJump = !jumpStarted || normalizeAthleticsEnergy(player.energy) >= ATHLETICS_JUMP_ENERGY_COST;
  const acceptedRequestedY = isAthletics && jumpStarted && !athleticsCanJump ? currentEyeY : requested.y;
  const athleticsJumpBoostActive = Boolean(
    isAthletics
    && athletics?.jumpBoostUntil
    && nowMs < Date.parse(athletics.jumpBoostUntil)
  );
  const chaosEvent = isAthletics
    && getAthleticsMode(session.settings.athleticsMode ?? session.athletics?.mode) === "chaos-climb"
    ? session.athletics?.chaos?.currentEvent
    : undefined;
  const activeChaosEvent = chaosEvent && nowMs < Date.parse(chaosEvent.expiresAt) ? chaosEvent : undefined;
  const chaosEventModifiers = activeChaosEvent ? getChaosEventModifiers(activeChaosEvent) : undefined;
  const jumpHeightCap = athleticsJumpBoostActive
    ? 7.2
    : chaosEventModifiers?.jumpHeightCap ?? 4.5;
  const requestedMovementY = Number.isFinite(Number(acceptedRequestedY))
    ? Math.min(requestedStandingY + jumpHeightCap, Math.max(requestedStandingY, Number(acceptedRequestedY)))
    : requestedStandingY;
  playerPositionHistory.record(player.id, currentPosition, lastMoveAt);
  const movementEnergy = resolveZombieMovementEnergy({
    gameMode: session.settings.gameMode,
    role: player.role,
    currentEnergy: player.energy,
    elapsedMs,
    movedDistance: 0
  });
  const athleticsEnergy = normalizeAthleticsEnergy(player.energy);
  const hasMovementEnergy = isAthletics
    ? athleticsEnergy > 0
    : movementEnergy.canMove;
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
        : PLAYER_MAX_SPEED
    )
      * getPlayerMoveSpeedMultiplier(player)
      * (athletics?.dashUntil && nowMs < Date.parse(athletics.dashUntil) ? 1.42 : 1)
      * (chaosEventModifiers?.movementSpeedMultiplier ?? 1),
    obstacles: isAthletics ? getAthleticsObstacles(nowMs) : getArenaObstacles(session.settings.mapId),
    groundY: requestedGroundY,
    eyeHeight: requestedEyeHeight,
    mapId: isAthletics ? ATHLETICS_ARENA_MAP_ID : session.settings.mapId
  });
  if (isAthletics && athletics) {
    if (getAthleticsMode(session.settings.athleticsMode ?? session.athletics?.mode) === "hunters-runners" && athletics.role === "hunter") {
      const station = getAthleticsHunterStationPosition(
        athletics.stationIndex ?? 0,
        Math.max(1, session.athletics?.hunterIds?.length ?? 1)
      );
      if (Math.hypot(position.x - station.x, position.z - station.z) > athleticsModeLimits.hunterKnockbackDistance * 2.2) {
        position.x = currentPosition.x;
        position.y = currentPosition.y;
        position.z = currentPosition.z;
      }
    }
    const resolvedPosition = {
      x: position.x,
      y: position.y ?? requestedStandingY,
      z: position.z
    };
    const physicalSupport = getAthleticsPhysicalSupport(
      resolvedPosition,
      ATHLETICS_STADIUM_COURSE,
      requestedEyeHeight,
      nowMs
    );
    const resolvedJumping = athleticsCanJump
      && requested.jumping === true
      && !requestedCrouching;
    const airborne = physicalSupport.kind === "airborne"
      && (
        resolvedJumping
        || player.jumping === true
        || resolvedPosition.y > requestedGroundY + requestedEyeHeight + 0.45
      );
    const settleGuardActive = Boolean(
      athletics.recoverySettleUntil
      && nowMs < Date.parse(athletics.recoverySettleUntil)
    );
    const fallDecision = decideAthleticsFall({
      support: physicalSupport,
      airborne,
      requestedY: requested.y,
      routeDistance: getAthleticsRouteDistance(resolvedPosition),
      routeWidth: ATHLETICS_STADIUM_COURSE.routeWidth,
      onRoute: isAthleticsOnRoute(resolvedPosition),
      belowRecoverableRoute: isAthleticsBelowRecoverableRoute(resolvedPosition, athletics.routeProgress),
      settleGuardActive
    });
    if (fallDecision.recover) {
      return beginAthleticsRecovery(session, player, athletics, nowMs, fallDecision.reason, {
        position: resolvedPosition,
        support: physicalSupport
      });
    }
    const routeProgress = getAthleticsRouteProgress(resolvedPosition);
    // Out-of-route packets are rejected only when they do not have a valid
    // physical landing. This keeps elevated, rotated, shortcut, and moving
    // supports authoritative even when their route projection is imperfect.
    if (!isAthleticsPlayableSupport(physicalSupport)
      && (routeProgress < athletics.routeProgress - 0.03 || !isAthleticsOnRoute(resolvedPosition))) {
      position.x = currentPosition.x;
      position.y = currentPosition.y;
      position.z = currentPosition.z;
      position.facing = requestedFacing;
    }
  }
  playerMoveTimestamps.set(player.id, nowMs);
  player.x = position.x;
  player.y = position.y ?? requestedStandingY;
  player.z = position.z;
  player.facing = position.facing;
  player.crouching = requestedCrouching;
  if (typeof requested.jumping === "boolean") {
    player.jumping = athleticsCanJump && requested.jumping && !requestedCrouching;
  }
  if (isAthletics && athletics) {
    const support = getAthleticsPhysicalSupport({
      x: player.x ?? 0,
      y: player.y,
      z: player.z ?? 0
    }, ATHLETICS_STADIUM_COURSE, requestedEyeHeight, nowMs);
    athletics.currentSupportedSurfaceIndex = support.kind === "main_surface" ? support.surfaceIndex : undefined;
    athletics.currentSupportKind = support.kind;
    if (isAthleticsPlayableSupport(support)) athletics.lastSupportedAtMs = nowMs;
    if (support.kind === "main_surface" && support.surfaceIndex !== undefined && !player.jumping) {
      if (support.surfaceIndex >= (athletics.lastSafeSurfaceIndex ?? 0)) {
        athletics.lastSafeSurfaceIndex = support.surfaceIndex;
      }
      athletics.routeProgress = Math.max(
        athletics.routeProgress,
        getAthleticsSurfaceRouteProgress(support.surfaceIndex, ATHLETICS_STADIUM_COURSE)
      );
    } else if (support.kind !== "park_floor") {
      // Route progress is a separate, monotonic positional signal. It can be
      // useful in the air for standings, but never confirms a landing.
      athletics.routeProgress = Math.max(
        athletics.routeProgress,
        getAthleticsRouteProgress({ x: player.x ?? 0, y: player.y, z: player.z ?? 0 })
      );
    }
    player.energy = resolveAthleticsMovementEnergy({
      currentEnergy: athleticsEnergy,
      elapsedMs,
      movedDistance: Math.hypot(position.x - currentPosition.x, position.z - currentPosition.z),
      jumped: jumpStarted && athleticsCanJump
    }).nextEnergy;
  } else if (session.settings.gameMode === "zombie" && player.role !== "zombie") {
    player.energy = resolveZombieMovementEnergy({
      gameMode: session.settings.gameMode,
      role: player.role,
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

const advanceAthleticsBot = (session: GameSession, bot: PlayerSession, index: number, nowMs: number) => {
  const race = session.athletics;
  const athletics = ensureAthleticsPlayerState(session, bot, index);
  if (!race || !athletics || race.status !== "running" || athletics.status !== "racing") return false;
  const mode = getAthleticsMode(session.settings.athleticsMode ?? race.mode);
  if (athletics.recoveryActive || (athletics.zeusFrozen && mode === "zeus") || (athletics.staggerUntil && nowMs < Date.parse(athletics.staggerUntil))) return false;
  if (mode === "hunters-runners" && athletics.role === "hunter") {
    const hunterCount = Math.max(1, race.hunterIds?.length ?? 1);
    const station = getAthleticsHunterStationPosition(athletics.stationIndex ?? 0, hunterCount);
    const movedToStation = Math.hypot((bot.x ?? station.x) - station.x, (bot.z ?? station.z) - station.z) > 0.01
      || Math.abs((bot.y ?? station.y) - station.y) > 0.01;
    bot.x = station.x;
    bot.y = station.y;
    bot.z = station.z;
    bot.facing = station.facing;

    // Bot Hunters follow the same answer-powered ammo economy as students.
    // The bot path has no quiz modal, so refill only when the magazine is
    // empty instead of granting an unbounded stream of projectiles.
    if ((athletics.hunterAmmo ?? 0) <= 0) {
      const reward = resolveHunterQuizReward({
        isCorrect: true,
        currentAmmo: athletics.hunterAmmo ?? 0,
        currentStreak: athletics.hunterQuizStreak ?? 0
      });
      athletics.hunterAmmo = reward.ammo;
      athletics.hunterQuizStreak = reward.streak;
    }

    const nextAllowedAt = athleticsActionNextAt.get(bot.id) ?? 0;
    const target = session.players
      .filter((candidate) => candidate.id !== bot.id && candidate.isAlive && candidate.athletics?.status === "racing" && candidate.athletics.role === "runner")
      .map((candidate) => ({ candidate, distance: Math.hypot((candidate.x ?? 0) - station.x, (candidate.z ?? 0) - station.z) }))
      .filter(({ distance }) => distance <= HUNTER_PROJECTILE_RANGE)
      .sort((left, right) => left.distance - right.distance)[0]?.candidate;
    if (!target || (athletics.hunterAmmo ?? 0) <= 0 || nowMs < nextAllowedAt) return movedToStation;

    const dx = (target.x ?? 0) - station.x;
    const dz = (target.z ?? 0) - station.z;
    bot.facing = Math.atan2(-dx, -dz);
    athletics.hunterAmmo = Math.max(0, (athletics.hunterAmmo ?? 0) - 1);
    const projectile: PendingHunterProjectile = {
      id: `${session.id}:foam:${id()}`,
      sessionId: session.id,
      hunterId: bot.id,
      targetId: target.id,
      origin: { x: station.x, y: station.y, z: station.z },
      targetAtLaunch: { x: target.x ?? 0, y: target.y ?? ATHLETICS_PLAYER_EYE_HEIGHT, z: target.z ?? 0 },
      launchedAt: nowMs,
      impactAt: nowMs + HUNTER_PROJECTILE_TRAVEL_MS,
      radius: HUNTER_PROJECTILE_RADIUS
    };
    const projectiles = athleticsProjectiles.get(session.id) ?? [];
    projectiles.push(projectile);
    athleticsProjectiles.set(session.id, projectiles.slice(-24));
    athleticsActionNextAt.set(bot.id, nowMs + HUNTER_PROJECTILE_COOLDOWN_MS);
    emitAthleticsModeEvent(session, "athletics_projectile", {
      projectileId: projectile.id,
      hunterId: projectile.hunterId,
      targetId: projectile.targetId,
      origin: projectile.origin,
      targetAtLaunch: projectile.targetAtLaunch,
      launchedAt: new Date(projectile.launchedAt).toISOString(),
      impactAt: new Date(projectile.impactAt).toISOString(),
      travelMs: HUNTER_PROJECTILE_TRAVEL_MS,
      radius: HUNTER_PROJECTILE_RADIUS
    });
    broadcastPlayerState(session, [bot]);
    return true;
  }
  if (athletics.lapTransitionUntil && nowMs < Date.parse(athletics.lapTransitionUntil)) {
    updateAthleticsRace(session, bot, nowMs);
    return true;
  }
  const { questionCount } = getAthleticsRaceConfig(session);
  // Bots preview the whole parkour course without presenting quiz UI. They
  // still use the same energy economy so the live HUD remains meaningful.
  if (normalizeAthleticsEnergy(bot.energy) < ATHLETICS_CORRECT_ENERGY * 0.5) {
    bot.energy = questionCount > 0
      ? awardAthleticsEnergy({ isCorrect: true, currentEnergy: bot.energy })
      : ATHLETICS_MAX_ENERGY;
    athletics.questionIndex = Math.min(questionCount, athletics.questionIndex + 1);
  }
  const currentProgress = Math.max(
    athletics.routeProgress,
    getAthleticsRouteProgress({ x: bot.x ?? 0, y: bot.y ?? ATHLETICS_PLAYER_EYE_HEIGHT, z: bot.z ?? 0 })
  );
  const nextProgress = Math.min(1, currentProgress + 0.06);
  const nextPoint = getAthleticsPointAtProgress(nextProgress);
  const tangent = getAthleticsRouteTangent(nextProgress);
  const laneOffset = ((athletics.laneIndex ?? index) % 5 - 2) * 0.75;
  bot.x = nextPoint.x - tangent.z * laneOffset;
  bot.y = nextPoint.y + ATHLETICS_PLAYER_EYE_HEIGHT;
  bot.z = nextPoint.z + tangent.x * laneOffset;
  bot.facing = Math.atan2(-tangent.x, -tangent.z);
  athletics.routeProgress = nextProgress;
  updateAthleticsRace(session, bot, nowMs);
  broadcastPlayerPosition(session, { playerId: bot.id, x: bot.x, y: bot.y, z: bot.z, facing: bot.facing });
  return true;
};

const botRuntimeDependencies: BotRuntimeDependencies = {
  io,
  gameplayRoom,
  sessions,
  ownsRoom,
  finishRound,
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
  advanceAthleticsBot,
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
export const advanceRounds = () => {
  roundRuntime.advanceRounds();
  advanceAthleticsRaces();
};
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

registerSpeakingRoutes(app, {
  requireTeacher,
  now,
  id,
  environment: config.environment,
  prisma,
  providers: createSpeakingProviders()
});

registerCompetitionRoutes(app, {
  requireTeacher,
  getBearerUser,
  state: competitionState,
  now,
  schedulePersistence,
  getSessionByCode,
  getPlayerToken,
  canReadOfficialSession: (code, token) => {
    const session = getSessionByCode(code);
    return session?.players.find((player) => !player.isBot && hasPlayerAccess(session, player, token))?.nickname;
  }
});

registerTournamentRoutes(app, {
  requireTeacher,
  getBearerUser,
  state: tournamentState,
  now,
  id,
  schedulePersistence,
  assertTeacherOwnsQuiz,
  getSessionByCode,
  getStoredSessionReport: async (session) => {
    const durable = await normalizedLibrary?.getReportForSession(session.teacherId, session.id);
    return durable ? { metadata: { id: durable.metadata.id }, report: durable.report } : undefined;
  }
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
  stampSession: stampTeacherSession
};

registerTeacherDashboardRoute(app, teacherLibraryRouteDependencies);
registerFolderRoutes(app, teacherLibraryRouteDependencies);

const quizSetRouteDependencies: QuizSetRouteDependencies = {
  requireTeacher,
  quizSets,
  folders,
  sessions,
  normalizedLibrary,
  contribution,
  recordContribution: mirrorNormalized,
  assertTeacherOwnsQuiz,
  routeParam,
  isChoice,
  now,
  id,
  schedulePersistence,
  deleteQuestionAudio: async (questionId) => {
    questionAudioAssets.delete(questionId);
    if (normalizedLibrary) await normalizedLibrary.deleteQuestionAudio(questionId);
  }
};
const questionRouteDependencies: QuestionRouteDependencies = {
  requireTeacher,
  getQuizQuestion,
  canReadQuestionAudio,
  isQuestionAudioUsedByActiveSession,
  assertTeacherOwnsQuiz,
  normalizedLibrary,
  contribution,
  recordContribution: mirrorNormalized,
  getQuestionAudio: async (questionId) => {
    const inMemoryAudio = questionAudioAssets.get(questionId);
    if (inMemoryAudio) return inMemoryAudio;
    const durableAudio = normalizedLibrary ? await normalizedLibrary.getQuestionAudio(questionId) : undefined;
    if (durableAudio) questionAudioAssets.set(questionId, durableAudio);
    return durableAudio;
  },
  saveQuestionAudio: async (teacherId, questionId, asset) => {
    if (normalizedLibrary) {
      await normalizedLibrary.saveQuestionAudioForTeacher(teacherId, questionId, asset.mimeType, asset.data);
    }
    questionAudioAssets.set(questionId, asset);
  },
  deleteQuestionAudio: async (questionId) => {
    questionAudioAssets.delete(questionId);
    if (normalizedLibrary) await normalizedLibrary.deleteQuestionAudio(questionId);
  },
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
registerStudySetRoutes(app, {
  requireTeacher,
  quizSets,
  sessions,
  users,
  normalizedLibrary,
  contribution,
  recordContribution: mirrorNormalized,
  getRecognitionSummary: (teacherId) => contribution.getSummary(teacherId),
  getQuestionAudio: questionRouteDependencies.getQuestionAudio,
  saveQuestionAudio: questionRouteDependencies.saveQuestionAudio,
  deleteQuestionAudio: questionRouteDependencies.deleteQuestionAudio,
  routeParam,
  now,
  id,
  schedulePersistence
});

const sessionRouteDependencies: SessionRouteDependencies = {
  requireTeacher,
  isDraining: () => isDraining,
  getQuizSetForUse,
  recordStudySetUse: (input) => contribution.recordStudySetUse(input),
  updateStudySetUsageCounters: (quizSetId, result) => {
    if (!result.added) return;
    const quizSet = quizSets.get(quizSetId);
    if (!quizSet) return;
    quizSet.usageCount = (quizSet.usageCount ?? 0) + 1;
    if (result.externalTeacherAdded) quizSet.uniqueTeacherUsageCount = result.uniqueTeacherCount;
  },
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
  stampSession: stampTeacherSession,
  stampPublicSession: stampSession,
  getSessionByCode,
  routeParam,
  canStartRound,
  openRoundPreparation,
  openZombieSelectionPhase,
  startRoundState,
  startAthleticsRace,
  pauseSession,
  resumeSession,
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
  deleteHistoryForTeacher,
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
  const isAthletics = session.settings.gameMode === "athletics";
  const athleticsMode = isAthletics
    ? getAthleticsMode(session.settings.athleticsMode ?? session.athletics?.mode)
    : undefined;
  const athletics = isAthletics ? ensureAthleticsPlayerState(session, player) : undefined;
  const athleticsRecoveryActive = isAthletics && athletics?.recoveryActive === true;
  if (isTeacherPaused(session)) {
    return failStudentCommand(409, "The game is paused by the teacher. Wait for the game to resume.");
  }
  if (session.status !== "active" && !isRoundPreparationPhase(session) && !isZombieSelectionPhase(session)) {
    return failStudentCommand(400, inactiveRoundMessage(session));
  }
  if (isAthletics && (!athletics || athletics.status !== "racing")) {
    return failStudentCommand(400, "This racer has already finished. Watch the live results.");
  }
  if (isAthletics && !athleticsRecoveryActive && athletics?.wrongAnswerPenaltyUntil && Date.now() < Date.parse(athletics.wrongAnswerPenaltyUntil)) {
    return failStudentCommand(409, "Take a short breath, then try the same checkpoint again.");
  }
  if (isAthletics && !athleticsRecoveryActive && athletics?.lapTransitionUntil && Date.now() < Date.parse(athletics.lapTransitionUntil)) {
    return failStudentCommand(409, "The next lap is getting ready. Hold at the start line.");
  }
  if (!player.isAlive && !session.settings.deadPlayersCanPractice && !athleticsRecoveryActive) {
    return failStudentCommand(400, "Practice questions are disabled while out for the round.");
  }
  if (!checkQuizRateLimit(player.id)) {
    return failStudentCommand(429, "Slow down before answering another question.");
  }
  const question = getSessionQuestion(session, String(body.questionId ?? ""));
  const selectedChoice = body.selectedChoice;
  if (!question || question.quizSetId !== session.quizSetId || !isChoice(selectedChoice)) {
    return failStudentCommand(400, "Question or answer choice is invalid.");
  }
  const athleticsQuestions = isAthletics ? getSessionQuestions(session) : [];
  const athleticsExpectedQuestion = isAthletics && athleticsQuestions.length > 0
    ? athleticsQuestions[getAthleticsQuestionPoolIndex(
        (athletics?.questionIndex ?? 0) + (athleticsRecoveryActive ? (athletics?.recoveryCorrectAnswers ?? 0) : 0),
        athleticsQuestions.length
      )]
    : undefined;
  if (isAthletics && question.id !== athleticsExpectedQuestion?.id) {
    return failStudentCommand(409, athleticsRecoveryActive
      ? "Answer the current recovery question before submitting."
      : "Answer the current course question before submitting.");
  }

  const gatedQuestion = playerQuestionGate.consume(player.id, question.id);
  if (!gatedQuestion.ok) {
    return failStudentCommand(409, "Answer the currently assigned question before submitting.");
  }

  const responseTimeMs = gatedQuestion.responseTimeMs;
  const isCorrect = question.correctChoice === selectedChoice;
  const answerContext: AnswerLog["context"] = player.isAlive && !athleticsRecoveryActive ? "main" : "practice";
  const zeusFreezeWasActive = athleticsMode === "zeus" && athletics?.zeusFrozen === true;
  const hunterAmmoBefore = athleticsMode === "hunters-runners" && athletics?.role === "hunter"
    ? athletics.hunterAmmo ?? 0
    : 0;
  const reward = resolveAnswerReward({ player, settings: session.settings, isCorrect, responseTimeMs });
  player.money = reward.nextMoney;
  player.quizMoneyEarned = (player.quizMoneyEarned ?? 0) + reward.moneyAwarded;
  player.roundQuizMoneyEarned = (player.roundQuizMoneyEarned ?? 0) + reward.moneyAwarded;
  player.score += reward.scoreDelta;
  player.correctAnswers += reward.correctDelta;
  player.wrongAnswers += reward.wrongDelta;
  const previousEnergy = player.energy ?? 0;
  const athleticsHunter = athleticsMode === "hunters-runners" && athletics?.role === "hunter";
  player.energy = isAthletics && !athleticsRecoveryActive && !athleticsHunter
    ? awardAthleticsEnergy({ isCorrect, currentEnergy: player.energy })
    : isAthletics
      ? normalizeAthleticsEnergy(player.energy)
      : awardZombieHumanEnergy({
        gameMode: session.settings.gameMode,
        role: player.role,
        isCorrect,
        currentEnergy: player.energy
      });
  const energyAwarded = Math.max(0, player.energy - previousEnergy);
  if (reward.correctDelta > 0) player.cosmeticXp = Math.max(0, player.cosmeticXp ?? 0) + reward.correctDelta * 100;
  let respawn = athleticsRecoveryActive
    ? {
        player,
        respawned: false,
        progress: athletics?.recoveryCorrectAnswers ?? 0,
        required: athletics?.recoveryRequiredAnswers ?? ATHLETICS_RECOVERY_CORRECT_ANSWERS_REQUIRED
      }
    : session.settings.gameMode === "flag" || isAthletics
      ? {
          player,
          respawned: false,
          progress: player.respawnCorrectAnswers ?? 0,
          required: RESPAWN_CORRECT_ANSWERS_REQUIRED
        }
      : resolvePracticeRespawn({ player, settings: session.settings, isCorrect });
  Object.assign(player, respawn.player);
  let recoveryNextQuestion: PublicQuestion | undefined;
  if (respawn.respawned) {
    player.respawns = (player.respawns ?? 0) + 1;
    player.roundRespawns = (player.roundRespawns ?? 0) + 1;
    player.crouching = false;
    player.jumping = false;
  }

  if (isAthletics && athletics) {
    if (athleticsRecoveryActive) {
      if (isCorrect) {
        const requiredAnswers = athletics.recoveryRequiredAnswers ?? ATHLETICS_RECOVERY_CORRECT_ANSWERS_REQUIRED;
        athletics.recoveryCorrectAnswers = Math.min(requiredAnswers, (athletics.recoveryCorrectAnswers ?? 0) + 1);
        respawn.progress = athletics.recoveryCorrectAnswers;
        if (athletics.recoveryCorrectAnswers >= requiredAnswers) {
          const completion = completeAthleticsRecovery(session, player, athletics, Date.now());
          recoveryNextQuestion = completion.question;
          respawn = {
            player,
            respawned: true,
            progress: requiredAnswers,
            required: requiredAnswers
          };
        }
      } else {
        // Wrong answers never advance recovery. Re-issue the same gated
        // question so a client cannot skip to the next recovery item.
        playerQuestionGate.issue(player.id, question.id);
      }
    } else if (athleticsMode === "hunters-runners") {
      if (athletics.role === "hunter") {
        const hunterReward = resolveHunterQuizReward({
          isCorrect,
          currentAmmo: athletics.hunterAmmo ?? 0,
          currentStreak: athletics.hunterQuizStreak ?? 0
        });
        athletics.hunterAmmo = hunterReward.ammo;
        athletics.hunterQuizStreak = hunterReward.streak;
      } else {
        const runnerReward = resolveRunnerQuizReward({
          isCorrect,
          currentCharge: athletics.abilityCharge ?? 0,
          currentAbility: athletics.abilityReady
        });
        athletics.abilityCharge = runnerReward.charge;
        athletics.abilityReady = runnerReward.abilityReady;
      }
      if (isCorrect) {
        athletics.questionIndex = Math.min(getAthleticsRaceConfig(session).questionCount, athletics.questionIndex + 1);
        athletics.gateOpen = true;
      } else {
        // H&R questions power resources; an incorrect response should not
        // immobilize a runner or a station defender.
        playerQuestionGate.issue(player.id, question.id);
      }
    } else if (athleticsMode === "chaos-climb") {
      const runnerReward = resolveRunnerQuizReward({
        isCorrect,
        currentCharge: athletics.abilityCharge ?? 0,
        currentAbility: athletics.abilityReady
      });
      athletics.abilityCharge = runnerReward.charge;
      athletics.abilityReady = runnerReward.abilityReady;
      if (isCorrect) {
        athletics.questionIndex = Math.min(getAthleticsRaceConfig(session).questionCount, athletics.questionIndex + 1);
        athletics.gateOpen = true;
        athletics.wrongAnswerPenaltyUntil = undefined;
      } else {
        athletics.wrongAnswerPenaltyUntil = new Date(Date.now() + ATHLETICS_WRONG_ANSWER_PENALTY_MS).toISOString();
        playerQuestionGate.issue(player.id, question.id, Date.now() + ATHLETICS_WRONG_ANSWER_PENALTY_MS);
      }
    } else if (athleticsMode === "zeus" && athletics.zeusFrozen) {
      const freezeResult = resolveZeusAnswer({ isCorrect, nowMs: Date.now() });
      if (isCorrect) {
        athletics.zeusFrozen = false;
        athletics.zeusFrozenUntil = undefined;
        athletics.questionIndex = Math.min(getAthleticsRaceConfig(session).questionCount, athletics.questionIndex + 1);
        athletics.gateOpen = true;
        athletics.wrongAnswerPenaltyUntil = undefined;
        emitToPlayers(session, [player.id], "zeus_freeze_break", {
          playerId: player.id,
          automatic: false,
          message: "Correct! The lightning freeze is broken."
        });
      } else {
        const previousFreezeUntil = Date.parse(athletics.zeusFrozenUntil ?? "");
        const requestedFreezeUntil = Date.parse(freezeResult.freezeUntil);
        const extendedUntil = Math.max(
          requestedFreezeUntil,
          (Number.isFinite(previousFreezeUntil) ? previousFreezeUntil : Date.now()) + ZEUS_FREEZE_WRONG_EXTENSION_MS
        );
        athletics.zeusFrozen = true;
        athletics.zeusFrozenUntil = new Date(extendedUntil).toISOString();
        playerQuestionGate.issue(player.id, question.id);
        emitToPlayers(session, [player.id], "zeus_freeze_extended", {
          playerId: player.id,
          frozenUntil: athletics.zeusFrozenUntil,
          message: "Not quite. The lightning charge lasts longer."
        });
      }
    } else if (isCorrect) {
      athletics.questionIndex = Math.min(getAthleticsRaceConfig(session).questionCount, athletics.questionIndex + 1);
      athletics.gateOpen = true;
      athletics.wrongAnswerPenaltyUntil = undefined;
    } else {
      athletics.wrongAnswerPenaltyUntil = new Date(Date.now() + ATHLETICS_WRONG_ANSWER_PENALTY_MS).toISOString();
      playerQuestionGate.issue(player.id, question.id, Date.now() + ATHLETICS_WRONG_ANSWER_PENALTY_MS);
    }
  }

  const answer: AnswerLog = {
    id: id(),
    gameSessionId: session.id,
    playerSessionId: player.id,
    questionId: question.id,
    selectedChoice,
    correctChoice: question.correctChoice,
    isCorrect,
    moneyAwarded: reward.moneyAwarded,
    answeredAt: now(),
    responseTimeMs,
    context: answerContext
  };
  answers.push(answer);
  learningPulseCache.delete(session.id);
  // Keep the authoritative game history recoverable if a student reconnects
  // during a later round or the process is restarted before game end.
  schedulePersistence();
  if (normalizedLibrary) {
    mirrorNormalized(normalizedLibrary.saveAnswer(answer, question), "answer history");
    mirrorNormalized(normalizedLibrary.savePlayer(player), "player learning progress");
  }

  const feedback = isAthletics
    ? athleticsRecoveryActive
      ? isCorrect
        ? respawn.respawned
          ? "Recovery complete! Back to the course with enough energy to retry."
          : `Recovery Questions ${respawn.progress} / ${respawn.required}`
        : `Incorrect. Recovery Questions ${respawn.progress} / ${respawn.required}. Only correct answers count.`
      : zeusFreezeWasActive
        ? isCorrect
          ? "Correct! Lightning freeze broken. Keep climbing."
          : "Not quite. Zeus extended the freeze."
        : athleticsMode === "hunters-runners" && athletics?.role === "hunter"
          ? isCorrect
            ? `Correct! +${Math.max(0, (athletics.hunterAmmo ?? 0) - hunterAmmoBefore)} foam ammo${athletics.hunterQuizStreak && athletics.hunterQuizStreak % 3 === 0 ? " · streak bonus" : ""}.`
            : "Not quite. Answer again to load foam ammo."
        : athleticsMode === "hunters-runners"
            ? isCorrect
              ? `Correct! Ability charge ${athletics?.abilityCharge ?? 0} / ${RUNNER_ABILITY_METER_MAX}.`
              : "Not quite. No ability charge gained."
            : athleticsMode === "chaos-climb"
              ? isCorrect
                ? `Correct! +${energyAwarded} movement energy · Ability charge ${athletics?.abilityCharge ?? 0} / ${RUNNER_ABILITY_METER_MAX}.`
                : "Not quite. No energy or ability charge gained."
            : isCorrect
              ? energyAwarded > 0
                ? `Correct! +${energyAwarded} movement energy. Keep climbing.`
                : "Correct! Movement energy is full. Keep climbing."
              : "Not quite. No movement energy gained; try again when you are ready."
    : isCorrect
    ? respawn.respawned
      ? "Respawned! Three correct practice answers brought you back."
      : energyAwarded > 0
        ? `Correct! +${energyAwarded} movement energy`
      : reward.moneyAwarded > 0
        ? `Correct! +$${reward.moneyAwarded}`
        : session.settings.gameMode === "flag" && !player.isAlive
          ? "Correct practice answer. You will return when the next round begins."
        : `Correct practice answer. Respawn progress ${respawn.progress}/${respawn.required}.`
    : "Incorrect. Try another question.";
  const rewardLabel = isCorrect
    ? athleticsRecoveryActive
      ? respawn.respawned
        ? `Recovery Questions ${respawn.required} / ${respawn.required} — Back to the course!`
        : `Recovery Questions ${respawn.progress} / ${respawn.required}`
      : zeusFreezeWasActive
        ? "Lightning freeze broken"
        : athleticsMode === "hunters-runners" && athletics?.role === "hunter"
          ? `+${Math.max(0, (athletics.hunterAmmo ?? 0) - hunterAmmoBefore)} foam ammo`
          : athleticsMode === "hunters-runners"
            ? `Ability charge ${athletics?.abilityCharge ?? 0} / ${RUNNER_ABILITY_METER_MAX}`
          : athleticsMode === "chaos-climb"
            ? `Ability charge ${athletics?.abilityCharge ?? 0} / ${RUNNER_ABILITY_METER_MAX}`
      : reward.moneyAwarded > 0
        ? `+$${reward.moneyAwarded}`
        : energyAwarded > 0
          ? `+${energyAwarded} movement energy`
          : undefined
    : undefined;

  appendEvent(session, {
    type: "answer",
    message: `${player.nickname} answered ${isCorrect ? "correctly" : "incorrectly"}${respawn.respawned ? " and returned to the round" : ""}.`,
    playerId: player.id,
    team: player.team
  });
  if (respawn.respawned) {
    appendEvent(session, {
      type: "respawn",
      message: `${player.nickname} returned after ${respawn.required} correct practice answers.`,
      playerId: player.id,
      team: player.team
    });
  }

  const result: QuizResult = {
    isCorrect,
    correctChoice: question.correctChoice,
    moneyAwarded: reward.moneyAwarded,
    rewardLabel,
    feedback,
    explanation: question.explanation,
    player,
    nextQuestion: isAthletics
      ? isCorrect
        ? recoveryNextQuestion ?? issueNextQuestion(session, player.id)
        : publicQuestion(question)
      : issueNextQuestion(session, player.id),
    respawned: respawn.respawned,
    respawnProgress: respawn.respawned && !athleticsRecoveryActive ? 0 : respawn.progress,
    respawnRequired: respawn.required,
    ...(isAthletics && athletics ? {
      athletics: {
        mode: athleticsMode,
        role: athletics.role,
        questionIndex: athletics.questionIndex,
        checkpointIndex: athletics.checkpointIndex,
        routeProgress: athletics.routeProgress,
        gateOpen: athletics.gateOpen,
        status: athletics.status,
        completedLaps: athletics.completedLaps,
        recoveryActive: athletics.recoveryActive,
        recoveryCorrectAnswers: athletics.recoveryCorrectAnswers,
        recoveryRequiredAnswers: athletics.recoveryRequiredAnswers,
        ...(athletics.hunterAmmo === undefined ? {} : { hunterAmmo: athletics.hunterAmmo }),
        ...(athletics.hunterHits === undefined ? {} : { hunterHits: athletics.hunterHits }),
        ...(athletics.hunterQuizStreak === undefined ? {} : { hunterQuizStreak: athletics.hunterQuizStreak }),
        ...(athletics.abilityCharge === undefined ? {} : { abilityCharge: athletics.abilityCharge }),
        ...(athletics.abilityReady === undefined ? {} : { abilityReady: athletics.abilityReady }),
        ...(athletics.shieldCharges === undefined ? {} : { shieldCharges: athletics.shieldCharges }),
        ...(athletics.zeusFrozen === undefined ? {} : { zeusFrozen: athletics.zeusFrozen }),
        ...(athletics.zeusFrozenUntil === undefined ? {} : { zeusFrozenUntil: athletics.zeusFrozenUntil }),
        ...(athletics.finishPosition === undefined ? {} : { finishPosition: athletics.finishPosition })
      }
    } : {})
  };
  broadcastPlayerState(session, [player]);
  if (isAthletics) broadcastSession(session);
  return { ok: true, data: { result, cosmeticProgressToken: makeCosmeticProgressToken(player) } };
};

const buyGear = (session: GameSession, player: PlayerSession, gearId: unknown): StudentCommandResult<GearPurchaseResponse> => {
  if (isTeacherPaused(session)) {
    return failStudentCommand(409, "The game is paused by the teacher. Wait for the game to resume.");
  }
  if (session.settings.gameMode === "athletics") {
    return failStudentCommand(400, "Athletics Race has no weapons or shop. Use the course and checkpoint questions.");
  }
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
    return { ok: true, data: { player, gear, message: `${gear.name} is already equipped.` } };
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
  return { ok: true, data: { player, gear, message: `${gear.name} equipped. Ready for the next play.` } };
};

const buySnowballs = (session: GameSession, player: PlayerSession, requestedPackSize?: unknown): StudentCommandResult<SnowballPurchaseResponse> => {
  if (isTeacherPaused(session)) {
    return failStudentCommand(409, "The game is paused by the teacher. Wait for the game to resume.");
  }
  if (session.settings.gameMode === "athletics") {
    return failStudentCommand(400, "Athletics Race has no weapons or shop. Use the course and checkpoint questions.");
  }
  if (!isRoundActive(session) && !isRoundPreparationPhase(session)) {
    return failStudentCommand(400, "The round has ended. Snowball buying is closed.");
  }
  if (session.settings.gameMode === "zombie" && player.role !== "zombie") {
    return failStudentCommand(400, "Humans cannot buy snowballs in Zombie Mode.");
  }
  if (requestedPackSize !== undefined && requestedPackSize !== "standard" && requestedPackSize !== "large") {
    return failStudentCommand(400, "Choose a valid snowball pack.");
  }
  const packSize: SnowballPackSize = requestedPackSize ?? "standard";
  const purchase = resolveSnowballPurchase({ player, settings: session.settings, packSize });
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
  return { ok: true, data: { player, message: `+${purchase.snowballsAdded} snowballs ready to use.` } };
};

type AthleticsActionResponse = {
  player: PlayerSession;
  action: "fire" | "ability";
  message: string;
};

const handleAthleticsAction = (
  session: GameSession,
  player: PlayerSession,
  command: AthleticsActionCommand
): StudentCommandResult<AthleticsActionResponse> => {
  const mode = getAthleticsMode(session.settings.athleticsMode ?? session.athletics?.mode);
  const race = session.athletics;
  const athletics = session.settings.gameMode === "athletics"
    ? ensureAthleticsPlayerState(session, player)
    : undefined;
  if (session.settings.gameMode !== "athletics" || !race || !athletics || mode === "classic") {
    return failStudentCommand(400, "This Athletics room does not have an active ability or projectile action.");
  }
  if (isTeacherPaused(session)) {
    return failStudentCommand(409, "The game is paused by the teacher. Wait for the game to resume.");
  }
  if (session.status !== "active" || race.status !== "running") {
    return failStudentCommand(400, "The Athletics race is not currently running.");
  }
  if (!player.isAlive || athletics.status !== "racing" || athletics.recoveryActive) {
    return failStudentCommand(400, "This racer cannot use a mode action right now.");
  }

  const fireRequest = registerFireRequest(player.id, command.requestId);
  if (!fireRequest.ok) return failStudentCommand(400, fireRequest.reason);
  const currentMs = Date.now();
  const nextAllowedAt = athleticsActionNextAt.get(player.id) ?? 0;
  if (currentMs < nextAllowedAt) {
    return failStudentCommand(409, "That action is still cooling down.");
  }

  // Action coordinates are an aim hint only. Movement remains on the normal
  // player_position path, so a forged action packet cannot teleport a Hunter
  // or move a Runner while a projectile/ability is being resolved.
  const currentPosition = {
    x: player.x ?? 0,
    y: player.y ?? ATHLETICS_PLAYER_EYE_HEIGHT,
    z: player.z ?? 0
  };
  const requestedFacing = Number(command.facing);
  if (Number.isFinite(requestedFacing)) player.facing = requestedFacing;

  if (command.action === "fire") {
    if (mode !== "hunters-runners" || athletics.role !== "hunter") {
      return failStudentCommand(400, "Only Hunters can throw foam balls in this round.");
    }
    const ammo = Math.max(0, Math.floor(athletics.hunterAmmo ?? 0));
    if (ammo <= 0) return failStudentCommand(409, "Answer a question to load more foam balls.");
    const facing = player.facing ?? 0;
    const pitch = clampArenaAimPitch(Number(command.pitch));
    const horizontalAim = Math.cos(pitch);
    const forwardX = -Math.sin(facing) * horizontalAim;
    const forwardY = Math.sin(pitch);
    const forwardZ = -Math.cos(facing) * horizontalAim;
    const candidates = session.players
      .filter((candidate) => candidate.id !== player.id && candidate.isAlive && candidate.athletics?.status === "racing" && candidate.athletics.role === "runner")
      .map((candidate) => {
        const dx = (candidate.x ?? 0) - (player.x ?? 0);
        const dy = (candidate.y ?? ATHLETICS_PLAYER_EYE_HEIGHT) - (player.y ?? ATHLETICS_PLAYER_EYE_HEIGHT);
        const dz = (candidate.z ?? 0) - (player.z ?? 0);
        const distance = Math.hypot(dx, dy, dz);
        const dot = distance > 0 ? (dx * forwardX + dy * forwardY + dz * forwardZ) / distance : 1;
        return { candidate, distance, dot };
      })
      .filter((candidate) => candidate.distance <= HUNTER_PROJECTILE_RANGE && candidate.dot >= 0.35)
      .sort((left, right) => right.dot - left.dot || left.distance - right.distance);
    const selected = command.targetId
      ? candidates.find((candidate) => candidate.candidate.id === command.targetId)
      : candidates[0];
    if (!selected) {
      const requestedTargetExists = command.targetId && session.players.some((candidate) => candidate.id === command.targetId);
      return failStudentCommand(400, requestedTargetExists ? "That runner is outside your throw line." : "Aim at a runner before throwing.");
    }
    athletics.hunterAmmo = ammo - 1;
    const projectile: PendingHunterProjectile = {
      id: `${session.id}:foam:${id()}`,
      sessionId: session.id,
      hunterId: player.id,
      targetId: selected.candidate.id,
      origin: currentPosition,
      targetAtLaunch: { x: selected.candidate.x ?? 0, y: selected.candidate.y ?? ATHLETICS_PLAYER_EYE_HEIGHT, z: selected.candidate.z ?? 0 },
      launchedAt: currentMs,
      impactAt: currentMs + HUNTER_PROJECTILE_TRAVEL_MS,
      radius: HUNTER_PROJECTILE_RADIUS
    };
    const projectiles = athleticsProjectiles.get(session.id) ?? [];
    projectiles.push(projectile);
    athleticsProjectiles.set(session.id, projectiles.slice(-24));
    athleticsActionNextAt.set(player.id, currentMs + HUNTER_PROJECTILE_COOLDOWN_MS);
    emitAthleticsModeEvent(session, "athletics_projectile", {
      projectileId: projectile.id,
      hunterId: projectile.hunterId,
      targetId: projectile.targetId,
      origin: projectile.origin,
      targetAtLaunch: projectile.targetAtLaunch,
      launchedAt: new Date(projectile.launchedAt).toISOString(),
      impactAt: new Date(projectile.impactAt).toISOString(),
      travelMs: HUNTER_PROJECTILE_TRAVEL_MS,
      radius: HUNTER_PROJECTILE_RADIUS
    });
    broadcastPlayerState(session, [player]);
    broadcastSession(session);
    return {
      ok: true,
      data: { player, action: "fire", message: `Foam ball away. ${athletics.hunterAmmo} ammo left.` }
    };
  }

  const ability = command.ability as AthleticsAbility;
  if (mode !== "chaos-climb" && mode !== "hunters-runners") {
    return failStudentCommand(400, "This Athletics mode has no player abilities.");
  }
  if (mode === "hunters-runners" && athletics.role !== "runner") {
    return failStudentCommand(400, "Hunters use answer-powered ammo instead of runner abilities.");
  }
  if (athletics.abilityReady && ability !== athletics.abilityReady) {
    return failStudentCommand(409, `Your ready ability is ${athletics.abilityReady}.`);
  }
  const abilityResult = consumeRunnerAbility({
    ability,
    charge: athletics.abilityCharge ?? 0
  });
  if (!abilityResult.ok) return failStudentCommand(409, "Answer three questions to charge an ability.");
  athletics.abilityCharge = abilityResult.charge;
  athletics.abilityReady = abilityResult.ability;
  if (ability === "dash") athletics.dashUntil = new Date(currentMs + 1_000).toISOString();
  if (ability === "shield") athletics.shieldCharges = Math.min(3, (athletics.shieldCharges ?? 0) + 1);
  if (ability === "super-jump") athletics.jumpBoostUntil = new Date(currentMs + 2_500).toISOString();
  if (ability === "anchor") athletics.knockbackResistUntil = new Date(currentMs + 2_500).toISOString();
  athleticsActionNextAt.set(player.id, currentMs + 300);
  emitAthleticsModeEvent(session, "athletics_ability", {
    playerId: player.id,
    ability,
    nextAbility: athletics.abilityReady,
    charge: athletics.abilityCharge,
    shieldCharges: athletics.shieldCharges ?? 0,
    expiresAt: ability === "dash"
      ? athletics.dashUntil
      : ability === "super-jump"
        ? athletics.jumpBoostUntil
        : ability === "anchor"
          ? athletics.knockbackResistUntil
          : undefined
  });
  broadcastPlayerState(session, [player]);
  broadcastSession(session);
  return {
    ok: true,
    data: { player, action: "ability", message: `${ability.replace("-", " ")} activated.` }
  };
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
  makeStudentLearningReport,
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

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  const bodyError = error as { type?: string; status?: number };
  if (bodyError.type === "entity.too.large" || bodyError.status === 413) {
    res.status(413).json({ error: req.path.startsWith("/api/speaking/") ? "That recording is too large. Please record a shorter answer." : "That upload is too large. Choose a smaller image and try again." });
    return;
  }
  if (bodyError.type === "entity.parse.failed") {
    res.status(400).json({ error: "The request could not be read. Check the file or form and try again." });
    return;
  }
  if (res.headersSent) {
    next(error);
    return;
  }
  console.error("[api] Unhandled request failure.", error);
  res.status(500).json({ error: "QuizStrike couldn't complete that request. Try again." });
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
      // Movement sequence numbers are scoped to a live socket. Recovery uses
      // movementEpoch for cross-reconnect invalidation, so a fresh connection
      // can safely begin its sequence at zero without inheriting a stale
      // counter from a previous tablet/browser session.
      if (session.settings.gameMode === "athletics") {
        const athletics = ensureAthleticsPlayerState(session, player);
        if (athletics) athletics.lastAcceptedMovementSequence = undefined;
      }
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
      socket.join(teacherRoom(session.sessionCode));
      socket.emit("session_state", stampTeacherSession(session));
      return;
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
    (payload: { packSize?: unknown }, acknowledge: (response: StudentCommandAck<SnowballPurchaseResponse>) => void) => {
      if (typeof acknowledge !== "function") return;
      const command = parseSocketCommand(socket, "buy_snowballs", payload);
      if (!command) {
        acknowledge({ ok: false, status: 400, error: "The purchase command was invalid." });
        return;
      }
      const student = getBoundStudent(socket);
      acknowledge(
        student
          ? commandAck(buySnowballs(student.session, student.player, command.packSize))
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
    if (isTeacherPaused(session) || !player.isAlive) return;
    const position = applyAuthoritativePosition(session, player, command);
    updateAthleticsRace(session, player, Date.now());
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

  socket.on(
    "athletics_action",
    (payload: unknown = {}, acknowledge: (response: StudentCommandAck<AthleticsActionResponse>) => void) => {
      if (typeof acknowledge !== "function") return;
      const command = parseSocketCommand(socket, "athletics_action", payload);
      if (!command) {
        acknowledge({ ok: false, status: 400, error: "The Athletics action was invalid." });
        return;
      }
      const student = getBoundStudent(socket);
      acknowledge(
        student
          ? commandAck(handleAthleticsAction(student.session, student.player, command))
          : { ok: false, status: 401, error: "Reconnect to the game before using an Athletics action." }
      );
    }
  );

  socket.on("fire_action", (payload: unknown = {}) => {
    const command = parseSocketCommand(socket, "fire_action", payload);
    if (!command) return;
    const student = getBoundStudent(socket);
    if (!student) return;
    const { session, player: attacker } = student;
    if (isTeacherPaused(session)) {
      socket.emit("error_message", { error: "The game is paused by the teacher. Wait for the game to resume." });
      return;
    }
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
    if (isTeacherPaused(session) || session.status !== "active" || session.settings.gameMode !== "flag" || !player.isAlive) return;
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
    lifecycleTimers.interval(advanceRounds, ROUND_TICK_MS);
    lifecycleTimers.interval(advanceBots, BOT_TICK_MS);
    lifecycleTimers.interval(() => scheduleCompetitionNotifications(competitionState, new Date()), 60_000, true);
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
