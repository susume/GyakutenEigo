import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { Prisma, PrismaClient } from "@prisma/client";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server, type Socket } from "socket.io";
import { resolveClientOrigins } from "./origins.js";
import { getPausedRoundAction, planRoundConclusion } from "./roundFlow.js";
import {
  clampArenaPosition,
  ARENA_SCALE,
  DEFAULT_PLAYER_HEALTH,
  GEAR_ITEMS,
  getGearFireCooldownMs,
  getGearHitRadius,
  getGearRange,
  getPlayerHealthMax,
  getPlayerMoveSpeedMultiplier,
  getPlayerPerks,
  getPlayerWeaponId,
  isWeaponGearId,
  getArenaObstacles,
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
  isRoundBuyPhase,
  createInitialFlagState,
  randomizeBalancedTeams,
  resolveAnswerReward,
  resolveFlagCapture,
  resolveFlagCountdown,
  resolveFlagDropForPlayer,
  resolveFlagPickup,
  resolveFlagPlacement,
  resolveGearPurchase,
  resolvePracticeRespawn,
  resolveAuthoritativeMovement,
  resolveBotAttackTarget,
  resolveBotPursuitTarget,
  resolveBotRespawn,
  resolveBotRoamStep,
  resolveProjectileTarget,
  resolveSnowballPurchase,
  resolveSnowballUse,
  resolveTagAction,
  resolveZombieConversion,
  sanitizeSessionSettings,
  selectInitialZombies,
  type AnswerLog,
  type Choice,
  type ClassSummary,
  type GameSession,
  type GameAnnouncement,
  type GameEvent,
  type PlayerSession,
  type PublicQuestion,
  type Question,
  type QuizResult,
  type QuizSet,
  type SessionReport,
  type SessionSettings,
  type TeacherUser,
  type Team
} from "@quizstrike/shared";

interface StoredUser extends TeacherUser {
  passwordHash: string;
}

interface AuthedRequest extends Request {
  user?: TeacherUser;
}

const app = express();
const server = createServer(app);
const port = Number(process.env.PORT ?? 4000);
const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET ?? "local-dev-only-change-me";
const databaseUrl = process.env.DATABASE_URL?.trim();
const prisma = databaseUrl ? new PrismaClient() : undefined;
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

const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true, maxAge: 86_400 }
});

const users = new Map<string, StoredUser>();
const classes = new Map<string, ClassSummary & { teacherId: string }>();
const quizSets = new Map<string, QuizSet>();
const sessions = new Map<string, GameSession>();
const answers: AnswerLog[] = [];
const playerQuestionHistory = new Map<string, Set<string>>();
const playerQuestionGate = new PlayerQuestionGate();
const quizRateLimits = new Map<string, number[]>();
const fireRequestIds = new Map<string, Map<string, number>>();
const playerMoveTimestamps = new Map<string, number>();
const playerNextFireAt = new Map<string, number>();
const botRespawnAt = new Map<string, number>();
const botNextAttackAt = new Map<string, number>();
const playerSockets = new Map<string, Set<string>>();
const playerDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

type SocketPlayerBinding = { sessionCode: string; playerId: string };
const playerSocketKey = (sessionCode: string, playerId: string) => `${sessionCode}:${playerId}`;

type PersistedRuntimeState = {
  users: StoredUser[];
  classes: Array<ClassSummary & { teacherId: string }>;
  quizSets: QuizSet[];
  sessions: GameSession[];
  answers: AnswerLog[];
};

const runtimeSnapshotId = "primary";
let persistenceQueue = Promise.resolve();
let persistenceTimer: ReturnType<typeof setTimeout> | undefined;

const getPersistedRuntimeState = (): PersistedRuntimeState => ({
  users: [...users.values()],
  classes: [...classes.values()],
  quizSets: [...quizSets.values()],
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
  const savedSessions = Array.isArray(state.sessions) ? state.sessions : [];
  const savedAnswers = Array.isArray(state.answers) ? state.answers : [];

  users.clear();
  classes.clear();
  quizSets.clear();
  sessions.clear();
  answers.length = 0;

  for (const user of savedUsers) if (user?.id) users.set(user.id, user);
  for (const klass of savedClasses) if (klass?.id) classes.set(klass.id, klass);
  for (const quiz of savedQuizSets) if (quiz?.id) quizSets.set(quiz.id, quiz);
  for (const session of savedSessions) if (session?.id) sessions.set(session.id, session);
  answers.push(...savedAnswers.filter((answer) => answer?.id));

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
const BOT_TICK_MS = 450;
const FIRE_REQUEST_TTL_MS = 30_000;
const BOT_ATTACK_COOLDOWN_FLOOR_MS = 1700;
const BOT_RESPAWN_MS = 8000;
const PLAYER_MAX_SPEED = 22;
const PLAYER_DISCONNECT_GRACE_MS = 5000;
const ROUND_RESULT_ANNOUNCEMENT_MS = 4000;
const FLAG_BUY_PHASE_MS = 6000;
const SESSION_BROADCAST_WINDOW_MS = 75;
const ROUND_START_ANNOUNCEMENT_MS = 2500;
const GAME_OVER_ANNOUNCEMENT_MS = 7000;

app.use(cors({ origin: corsOrigin, credentials: true, maxAge: 86_400 }));
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

const getBearerUser = (req: Request): TeacherUser | undefined => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;

  try {
    const payload = jwt.verify(header.slice("Bearer ".length), jwtSecret) as { sub?: string };
    const user = payload.sub ? users.get(payload.sub) : undefined;
    return user ? publicUser(user) : undefined;
  } catch {
    return undefined;
  }
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

const createDefaultSettings = (input: Partial<SessionSettings> = {}): SessionSettings => sanitizeSessionSettings(input);

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
  appendEvent(session, { type: "end", message });
  broadcastSession(session);
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
    : isRoundBuyPhase(session)
      ? "The buy phase is open. The round begins shortly."
    : session.status === "paused"
      ? "The round has ended. The next round is starting shortly."
      : "The teacher has not started the round yet.";

const resetRoundPlayer = (session: GameSession, player: PlayerSession, index: number): PlayerSession => {
  const spawn = player.isBot ? getBotSpawn(session, player.team, index) : selectSessionSpawn(session, player.team, index);
  const loadout = getRoundResetLoadout({ player, startingSnowballs: session.settings.startingSnowballs });
  return {
    ...player,
    ...spawn,
    role: session.settings.gameMode === "zombie" ? player.role ?? "human" : player.role,
    health: getPlayerHealthMax({ ...player, ...loadout }),
    ...loadout,
    isAlive: true,
    respawnCorrectAnswers: 0
  };
};

const prepareModeStateForRound = (session: GameSession) => {
  if (session.settings.gameMode === "flag") {
    if (session.settings.teamAssignment === "random") {
      session.players = randomizeBalancedTeams(session.players, Date.now());
    }
    session.flag = createInitialFlagState(sessionSpawn(session, "red"));
  } else if (session.settings.gameMode === "zombie") {
    session.players = selectInitialZombies(session.players, session.settings.initialZombieCount);
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
      ? { ...reset, respawns: wasOutForRound ? (player.respawns ?? 0) + 1 : (player.respawns ?? 0) }
      : { ...reset, score: 0, correctAnswers: 0, wrongAnswers: 0, tags: 0, respawns: 0 };
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

const openFlagBuyPhase = (session: GameSession, preserveStats = true) => {
  prepareRoundState(session, preserveStats);
  const startsAt = new Date(Date.now() + FLAG_BUY_PHASE_MS).toISOString();
  session.status = "paused";
  session.startedAt = undefined;
  session.endsAt = undefined;
  session.roundTransition = { nextRound: session.currentRound, startsAt, phase: "buy" };
  session.announcement = {
    ...makeAnnouncement(
      "buy_phase",
      "Buy Phase",
      "Press B, then use number keys 1–5 to buy supplies and gear.",
      `Round ${session.currentRound} begins in 6 seconds.`,
      FLAG_BUY_PHASE_MS
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
  const resultMessage = session.settings.gameMode === "flag"
    ? `${reason}. Round ${nextRound} buy phase begins shortly.`
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
  if (getPausedRoundAction({ gameMode: session.settings.gameMode, phase: transition.phase }) === "open_buy_phase") {
    openFlagBuyPhase(session);
    appendEvent(session, { type: "start", message: `Round ${session.currentRound} buy phase opened.` });
    broadcastSession(session);
    return;
  }

  if (transition.phase === "buy") activatePreparedRound(session);
  else startRoundState(session);
  session.announcement = makeAnnouncement(
    "round_start",
    `Round ${session.currentRound} has begun!`,
    session.settings.gameMode === "flag"
      ? "Red carries and protects the flag. Blue defends and captures."
      : "Answer questions, earn supplies, and tag the other team.",
    undefined,
    ROUND_START_ANNOUNCEMENT_MS
  );
  appendEvent(session, { type: "start", message: `Round ${session.currentRound} started.` });
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

const getBotSpawn = (session: GameSession, team: Team, index: number) => {
  return sessionSpawn(session, team, index);
};

const applyValidatedDamage = (session: GameSession, attacker: PlayerSession, target: PlayerSession) => {
  if (session.settings.gameMode === "zombie" && attacker.role === "zombie") {
    const conversion = resolveZombieConversion({ attacker, target });
    if (!conversion.ok) return conversion;
    Object.assign(target, conversion.player);
    target.zombieConvertedAt = now();
    attacker.tags = (attacker.tags ?? attacker.score) + conversion.tagCredit;
    attacker.score += conversion.tagCredit;
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
      damage: DEFAULT_PLAYER_HEALTH,
      health: target.health,
      snowballs: attacker.snowballs,
      eliminated: false,
      moneyAwarded: 0
    });
    io.to(session.sessionCode).emit("world_impact", {
      attackerId: attacker.id,
      targetId: target.id,
      x: target.x ?? sessionSpawn(session, target.team).x,
      z: target.z ?? sessionSpawn(session, target.team).z,
      shield: true
    });
    broadcastSession(session);
    finishZombieMatchIfComplete(session);
    return { ok: true as const, damage: DEFAULT_PLAYER_HEALTH, nextHealth: DEFAULT_PLAYER_HEALTH, eliminated: false, moneyAwarded: 0, scoreDelta: 1 };
  }

  const tagResult = resolveTagAction({ attacker, target });
  if (!tagResult.ok) return tagResult;

  target.health = tagResult.nextHealth;
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
    target.z = baseSpawn.z;
    target.facing = baseSpawn.facing;
    if (target.isBot && session.settings.gameMode !== "flag") botRespawnAt.set(target.id, Date.now() + BOT_RESPAWN_MS);
    attacker.money = Math.min(16000, attacker.money + tagResult.moneyAwarded);
    attacker.score += tagResult.scoreDelta;
    attacker.tags = (attacker.tags ?? 0) + 1;
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

  broadcastSession(session);
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
  io.to(session.sessionCode).emit("world_impact", {
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
  requested: { x?: number; z?: number; y?: number; facing?: number },
  nowMs = Date.now()
) => {
  const fallback = sessionSpawn(session, player.team);
  const lastMoveAt = playerMoveTimestamps.get(player.id) ?? nowMs - BOT_TICK_MS;
  const position = resolveAuthoritativeMovement({
    current: {
      x: player.x ?? fallback.x,
      z: player.z ?? fallback.z,
      facing: player.facing ?? fallback.facing
    },
    requested: {
      x: Number(requested.x),
      z: Number(requested.z),
      y: Number(requested.y),
      facing: Number(requested.facing)
    },
    elapsedMs: nowMs - lastMoveAt,
    maxSpeed: PLAYER_MAX_SPEED * getPlayerMoveSpeedMultiplier(player),
    obstacles: getArenaObstacles(session.settings.mapId)
  });
  playerMoveTimestamps.set(player.id, nowMs);
  player.x = position.x;
  player.z = position.z;
  player.facing = position.facing;
  return position;
};

const advanceBots = () => {
  const seconds = Date.now() / 1000;
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
        finishRound(session, winner, winner ? "Higher team score when time expired" : "Teams were tied when time expired");
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
          botRespawnAt.delete(bot.id);
          appendEvent(session, { type: "respawn", message: `${bot.nickname} returned to the arena.`, playerId: bot.id, team: bot.team });
          moved = true;
        }
        return;
      }
      const oldX = bot.x ?? sessionSpawn(session, bot.team).x;
      const oldZ = bot.z ?? sessionSpawn(session, bot.team).z;
      const pursuitTarget = resolveBotPursuitTarget({ bot, candidates: session.players });
      const laneOffset = (index % 5) - 2;
      const speed = 0.42 + (index % 3) * 0.07;
      const angle = seconds * speed + index * 1.37;
      const centerX = (bot.team === "blue" ? -48 : 48) * ARENA_SCALE;
      const centerZ = (bot.team === "blue" ? -8 : 8) * ARENA_SCALE;
      const desired = clampArenaPosition({
        x: pursuitTarget?.x ?? centerX + Math.sin(angle) * ((52 + Math.abs(laneOffset) * 8) * ARENA_SCALE),
        z: pursuitTarget?.z ?? centerZ + Math.cos(angle * 0.82) * ((64 - Math.abs(laneOffset) * 6) * ARENA_SCALE),
        facing: Math.atan2(oldX - bot.x!, oldZ - bot.z!)
      });
      const next = resolveBotRoamStep({
        current: { x: oldX, z: oldZ, facing: bot.facing ?? desired.facing },
        desired,
        elapsedMs: BOT_TICK_MS,
        speed: 24,
        obstacles: getArenaObstacles(session.settings.mapId)
      });
      bot.x = next.x;
      bot.z = next.z;
      bot.facing = Math.atan2(next.x - oldX, next.z - oldZ);
      bot.snowballs = bot.snowballs ?? session.settings.startingSnowballs;
      moved = true;

      if ((botNextAttackAt.get(bot.id) ?? 0) > currentMs) return;
      const attackTarget = resolveBotAttackTarget({ bot, candidates: session.players, obstacles: getArenaObstacles(session.settings.mapId) });
      if (!attackTarget.ok) return;
      const target = session.players.find((player) => player.id === attackTarget.targetId);
      if (!target) return;
      const snowballUse = resolveSnowballUse(bot);
      if (!snowballUse.ok) return;
      bot.snowballs = snowballUse.nextSnowballs;
      bot.facing = Math.atan2((bot.x ?? 0) - (target.x ?? 0), (bot.z ?? 0) - (target.z ?? 0));
      botNextAttackAt.set(bot.id, currentMs + Math.max(BOT_ATTACK_COOLDOWN_FLOOR_MS, getGearFireCooldownMs(getPlayerWeaponId(bot))));
      applyValidatedDamage(session, bot, target);
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

app.get("/api/teacher/dashboard", requireTeacher, (req: AuthedRequest, res) => {
  const teacherId = req.user!.id;
  res.json({
    classes: [...classes.values()].filter((item) => item.teacherId === teacherId),
    quizSets: [...quizSets.values()].filter((item) => item.teacherId === teacherId),
    sessions: [...sessions.values()].filter((item) => item.teacherId === teacherId).map(stampSession)
  });
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
    title,
    description: String(req.body.description ?? "").trim() || undefined,
    questions: [],
    createdAt: now()
  };
  quizSets.set(quizSet.id, quizSet);
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
  if (session.settings.gameMode === "flag") {
    openFlagBuyPhase(session, false);
    appendEvent(session, { type: "start", message: "Flag Mode round 1 buy phase opened." });
  } else {
    startRoundState(session, false);
    session.announcement = makeAnnouncement(
      "round_start",
      session.settings.gameMode === "zombie" ? "Zombie Mode has begun!" : `Round ${session.currentRound} has begun!`,
      session.settings.gameMode === "zombie"
        ? "Zombies tag humans. Humans: survive as long as you can."
        : "Answer questions, earn supplies, and tag the other team.",
      undefined,
      ROUND_START_ANNOUNCEMENT_MS
    );
    appendEvent(session, {
      type: "start",
      message: session.settings.gameMode === "zombie"
        ? "Zombie Mode started. Zombies tag humans with Snowball Launchers."
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

app.post("/api/sessions/:code/bots", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  if (session.players.length >= session.maxPlayers) {
    res.status(400).json({ error: "This session is full." });
    return;
  }

  const blueCount = session.players.filter((player) => player.team === "blue").length;
  const redCount = session.players.filter((player) => player.team === "red").length;
  const team: Team = blueCount <= redCount ? "blue" : "red";
  const botIndex = session.players.filter((player) => player.isBot).length;
  const spawn = session.status === "active" ? getBotSpawn(session, team, botIndex) : selectSessionSpawn(session, team, botIndex);
  const bot: PlayerSession = {
    id: id(),
    gameSessionId: session.id,
    nickname: `${botNames[botIndex % botNames.length]} Bot ${botIndex + 1}`,
    team,
    money: session.settings.startingMoney,
    isAlive: true,
    isBot: true,
    role: "human",
    tags: 0,
    respawns: 0,
    connectionState: "connected",
    health: DEFAULT_PLAYER_HEALTH,
    snowballs: session.settings.startingSnowballs,
    respawnCorrectAnswers: 0,
    x: spawn.x,
    z: spawn.z,
    facing: spawn.facing,
    score: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    gear: "starter_blaster",
    weapon: "starter_blaster",
    perks: [],
    joinedAt: now()
  };
  session.players.push(bot);
  appendEvent(session, { type: "join", message: `${bot.nickname} joined for testing.`, playerId: bot.id, team });
  broadcastSession(session);
  res.status(201).json({ session: stampSession(session), bot });
});

app.get("/api/sessions/:code", (req, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  res.json({ session: stampSession(session) });
});

app.get("/api/sessions/:code/report", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  res.json({ report: makeReport(session) });
});

app.get("/api/sessions/:code/report.csv", requireTeacher, (req: AuthedRequest, res) => {
  const session = getSessionByCode(routeParam(req.params.code));
  if (!session || session.teacherId !== req.user!.id) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  res
    .status(200)
    .type("text/csv")
    .setHeader("Content-Disposition", `attachment; filename="quizstrike-${session.sessionCode}-report.csv"`)
    .send(buildCsvReport(makeReport(session)));
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
    res.status(200).json({ session: stampSession(session), player: returningPlayer, playerToken, question });
    return;
  }
  if (returningPlayer) {
    res.status(409).json({ error: "That nickname is already taken in this session." });
    return;
  }
  if (session.status === "active") {
    res.status(409).json({ error: "This session has already started." });
    return;
  }
  if (session.players.length >= session.maxPlayers) {
    res.status(400).json({ error: "This session is full." });
    return;
  }
  const blueCount = session.players.filter((player) => player.team === "blue").length;
  const redCount = session.players.filter((player) => player.team === "red").length;
  const team: Team = blueCount <= redCount ? "blue" : "red";
  const spawn = selectSessionSpawn(session, team);
  const player: PlayerSession = {
    id: id(),
    gameSessionId: session.id,
    nickname,
    team,
    money: session.settings.startingMoney,
    isAlive: true,
    role: "human",
    tags: 0,
    respawns: 0,
    connectionState: "connected",
    health: DEFAULT_PLAYER_HEALTH,
    snowballs: session.settings.startingSnowballs,
    respawnCorrectAnswers: 0,
    x: spawn.x,
    z: spawn.z,
    facing: spawn.facing,
    score: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    gear: "starter_blaster",
    weapon: "starter_blaster",
    perks: [],
    joinedAt: now()
  };
  session.players.push(player);
  const playerToken = makePlayerToken(session, player);
  appendEvent(session, {
    type: "join",
    message: session.settings.gameMode === "zombie"
      ? `${player.nickname} joined the Zombie Mode lobby.`
      : `${player.nickname} joined ${team === "blue" ? "Blue" : "Red"} Team.`,
    playerId: player.id,
    team
  });
  broadcastSession(session);
  res.status(201).json({ session: stampSession(session), player, playerToken, question: issueNextQuestion(session, player.id) });
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
    session.status === "active" && (player.isAlive || session.settings.deadPlayersCanPractice)
      ? issueNextQuestion(session, player.id)
      : undefined;
  broadcastSession(session);
  res.json({ session: stampSession(session), player, question });
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
  player.team = requestedTeam;
  const spawn = selectSessionSpawn(session, player.team);
  player.x = spawn.x;
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
): StudentCommandResult<{ result: QuizResult }> => {
  if (session.status !== "active") {
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
  player.score += reward.scoreDelta;
  player.correctAnswers += reward.correctDelta;
  player.wrongAnswers += reward.wrongDelta;
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
  if (respawn.respawned) player.respawns = (player.respawns ?? 0) + 1;

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
  broadcastSession(session);
  return { ok: true, data: { result } };
};

const buyGear = (session: GameSession, player: PlayerSession, gearId: unknown): StudentCommandResult<GearPurchaseResponse> => {
  const gear = GEAR_ITEMS.find((item) => item.id === gearId);
  if (!isRoundActive(session) && !isRoundBuyPhase(session)) {
    return failStudentCommand(400, "The round has ended. Gear buying is closed.");
  }
  if (!gear) {
    return failStudentCommand(400, "That gear item does not exist.");
  }
  const purchase = resolveGearPurchase({
    player,
    gear,
    requireBase: session.settings.gameMode === "flag"
  });
  if (!purchase.ok) {
    return failStudentCommand(
      400,
      purchase.reason === "player_eliminated"
        ? "Students out for the round cannot buy gear."
        : purchase.reason === "starter_weapon"
          ? "The Starter Snowball Launcher is your default weapon and cannot replace purchased gear."
        : purchase.reason === "outside_base"
          ? "Return to your team base to buy gear."
          : "Not enough money for that gear."
    );
  }
  if (purchase.alreadyEquipped) {
    return { ok: true, data: { player, gear, message: `${gear.name} already equipped.` } };
  }
  player.money = purchase.nextMoney;
  if (isWeaponGearId(gear.id)) {
    player.weapon = gear.id;
    player.gear = gear.id;
  } else {
    player.perks = [...new Set([...getPlayerPerks(player), gear.id])];
    player.gear = getPlayerWeaponId(player);
  }
  if (purchase.nextHealth !== undefined) player.health = purchase.nextHealth;
  appendEvent(session, { type: "buy", message: `${player.nickname} equipped ${gear.name}.`, playerId: player.id, team: player.team });
  broadcastSession(session);
  return { ok: true, data: { player, gear, message: `${gear.name} equipped.` } };
};

const buySnowballs = (session: GameSession, player: PlayerSession): StudentCommandResult<SnowballPurchaseResponse> => {
  if (!isRoundActive(session) && !isRoundBuyPhase(session)) {
    return failStudentCommand(400, "The round has ended. Snowball buying is closed.");
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
  player.money = purchase.nextMoney;
  player.snowballs = purchase.nextSnowballs;
  appendEvent(session, {
    type: "buy",
    message: `${player.nickname} bought ${purchase.snowballsAdded} snowballs.`,
    playerId: player.id,
    team: player.team
  });
  broadcastSession(session);
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

io.on("connection", (socket) => {
  socket.on("join_session_room", (payload: string | { code?: string; playerId?: string; playerToken?: string }) => {
    const code = typeof payload === "string" ? payload : String(payload.code ?? "");
    const session = getSessionByCode(code);
    if (!session) return;

    if (typeof payload !== "string" && payload.playerId) {
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

  socket.on("player_position", (payload: { code?: string; playerId?: string; playerToken?: string; x?: number; z?: number; y?: number; facing?: number }) => {
    const code = String(payload.code ?? "");
    const session = getSessionByCode(code);
    const player = session?.players.find((candidate) => candidate.id === payload.playerId);
    if (!session || !player || !hasPlayerAccess(session, player, payload.playerToken)) return;
    if (!player.isAlive) return;
    const position = applyAuthoritativePosition(session, player, payload);
    socket.to(session.sessionCode).volatile.emit("player_position", {
      playerId: player.id,
      x: position.x,
      z: position.z,
      facing: position.facing
    });
  });

  socket.on("fire_action", (payload: { code?: string; playerId?: string; playerToken?: string; requestId?: string; x?: number; z?: number; y?: number; facing?: number; targetId?: string; scoped?: boolean; zoomLevel?: number }) => {
    const session = getSessionByCode(String(payload.code ?? ""));
    const attacker = session?.players.find((candidate) => candidate.id === payload.playerId);
    if (!session || !attacker || !hasPlayerAccess(session, attacker, payload.playerToken)) return;
    if (session.status !== "active") {
      socket.emit("error_message", { error: inactiveRoundMessage(session) });
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
    const weaponId = getPlayerWeaponId(attacker);
    playerNextFireAt.set(attacker.id, currentMs + getGearFireCooldownMs(weaponId));
    socket.to(session.sessionCode).emit("remote_weapon_fire", {
      playerId: attacker.id,
      x: attacker.x ?? sessionSpawn(session, attacker.team).x,
      z: attacker.z ?? sessionSpawn(session, attacker.team).z,
      facing: attacker.facing ?? sessionSpawn(session, attacker.team).facing,
      gearId: weaponId,
      scoped: payload.scoped === true,
      zoomLevel: payload.zoomLevel ?? 0
    });

    const targetSelection = resolveProjectileTarget({
      attacker,
      candidates: session.players,
      requestedTargetId: typeof payload.targetId === "string" && payload.targetId.trim() ? payload.targetId : undefined,
      range: getGearRange(weaponId),
      hitRadius: getGearHitRadius(weaponId, typeof payload.zoomLevel === "number" ? payload.zoomLevel : payload.scoped === true),
      obstacles: getArenaObstacles(session.settings.mapId)
    });
    if (!targetSelection.ok) {
      broadcastSession(session);
      socket.emit("damage_result", { ok: false, reason: targetSelection.reason, snowballs: attacker.snowballs });
      return;
    }

    const target = session.players.find((candidate) => candidate.id === targetSelection.targetId);
    if (!target) {
      broadcastSession(session);
      socket.emit("damage_result", { ok: false, reason: "invalid_target", snowballs: attacker.snowballs });
      return;
    }

    const tagResult = applyValidatedDamage(session, attacker, target);
    if (!tagResult.ok) {
      broadcastSession(session);
      socket.emit("damage_result", { ok: false, reason: tagResult.reason, snowballs: attacker.snowballs });
      return;
    }
  });

  socket.on("flag_action", (payload: { code?: string; playerId?: string; playerToken?: string; x?: number; z?: number; y?: number; facing?: number }) => {
    const session = getSessionByCode(String(payload.code ?? ""));
    const player = session?.players.find((candidate) => candidate.id === payload.playerId);
    if (!session || !player || !hasPlayerAccess(session, player, payload.playerToken)) return;
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
      socket.emit("player_position", { playerId: player.id, x: position.x, z: position.z, facing: position.facing });
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
    server.listen(port, () => {
      console.log(`QuizStrike Classroom server listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("QuizStrike could not restore durable classroom data.", error);
    process.exitCode = 1;
  }
};

void startServer();

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

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
