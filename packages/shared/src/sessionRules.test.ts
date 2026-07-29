import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SESSION_SETTINGS,
  DEFAULT_PLAYER_HEALTH,
  FLAG_MODE_DEFAULTS,
  HEAVY_GUN_DAMAGE,
  HEAVY_GUN_COOLDOWN_MS,
  HEAVY_GUN_DEEP_SCOPED_HIT_RADIUS,
  HEAVY_GUN_RANGE,
  QUICK_BLASTER_COOLDOWN_MS,
  QUICK_BLASTER_RANGE,
  RESPAWN_CORRECT_ANSWERS_REQUIRED,
  ZOMBIE_HUMAN_CORRECT_ENERGY,
  ZOMBIE_HUMAN_MAX_ENERGY,
  ARENA_LIMIT_X,
  ARENA_LIMIT_Z,
  ARENA_MAX_AIM_PITCH,
  ARENA_MIN_AIM_PITCH,
  ARENA_SCALE,
  ARENA_PLAYER_CROUCH_EYE_HEIGHT,
  ARENA_PLAYER_EYE_HEIGHT,
  TEMPLE_RUNOFF_MAIN_LEVEL_Y,
  TEMPLE_RUNOFF_UPPER_LEVEL_Y,
  STARTER_BLASTER_RANGE,
  FREE_FOR_ALL_SPAWNS,
  buildCsvReport,
  calculateClassAccuracy,
  buildReportRows,
  buildScoreboardRows,
  clampArenaPosition,
  clampArenaAimPitch,
  canStartRound,
  canPlayerFireInMode,
  canPlaceFlag,
  createInitialFlagState,
  awardZombieHumanEnergy,
  GEAR_ITEMS,
  getDefaultInitialZombieCount,
  getGearDamage,
  getGearFireCooldownMs,
  getGearHitRadius,
  getGearRange,
  getGearMoveSpeedMultiplier,
  getGearZoomFovMultiplier,
  getPlayerHealthMax,
  getPlayerMoveSpeedMultiplier,
  getPlayerPerks,
  getPlayerWeaponId,
  getPlayerWeaponIdForMode,
  getRoundResetLoadout,
  getArenaObstacles,
  getArenaGroundHeight,
  getArenaGroundHeightForPlayer,
  getArenaFloorSurfaces,
  getArenaBounds,
  findBotNavigationPath,
  getRoundRemainingSeconds,
  getZombieBestPlayers,
  resolveTeamRoundWinner,
  getTeamSpawn,
  getTeamSpawnForMap,
  getTeamSpawnsForMap,
  selectTeamSpawn,
  selectTeamSpawnForMap,
  TEAM_SPAWNS,
  isRoundActive,
  isRoundBuyPhase,
  isRoundPreparationPhase,
  isZombieSelectionPhase,
  isInsideTeamBase,
  isNearTeamSpawn,
  isGearAutoFireEnabled,
  randomizeBalancedTeams,
  selectLateJoinTeam,
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
  resolveAnswerReward,
  resolveTagAction,
  resolveZombieConversion,
  resolveZombieSprintEnergy,
  selectInitialZombies,
  sanitizeSessionSettings,
  type PlayerSession,
  type AnswerLog,
  type GameSession,
  type SessionReport
} from "./index.js";

const makePlayer = (overrides: Partial<PlayerSession> = {}): PlayerSession => ({
  id: "player-1",
  gameSessionId: "session-1",
  nickname: "Ada",
  team: "blue",
  money: 15000,
  isAlive: true,
  score: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  gear: "starter_blaster",
  joinedAt: "2026-07-03T00:00:00.000Z",
  ...overrides
});

const makeSession = (overrides: Partial<GameSession> = {}): GameSession => ({
  id: "session-1",
  teacherId: "teacher-1",
  quizSetId: "quiz-1",
  sessionCode: "ABC123",
  status: "waiting",
  maxPlayers: 20,
  currentRound: 1,
  settings: DEFAULT_SESSION_SETTINGS,
  players: [],
  createdAt: "2026-07-03T00:00:00.000Z",
  ...overrides
});

const makeAnswer = (overrides: Partial<AnswerLog> = {}): AnswerLog => ({
  id: "answer-1",
  gameSessionId: "session-1",
  playerSessionId: "player-1",
  questionId: "question-1",
  selectedChoice: "A",
  isCorrect: true,
  moneyAwarded: 400,
  answeredAt: "2026-07-03T00:01:00.000Z",
  ...overrides
});

test("canStartRound requires at least one real learner", () => {
  assert.deepEqual(canStartRound(makeSession()), { ok: false, reason: "no_real_players" });
  assert.deepEqual(canStartRound(makeSession({ players: [makePlayer({ isBot: true })] })), {
    ok: false,
    reason: "no_real_players"
  });
  assert.deepEqual(canStartRound(makeSession({ players: [makePlayer()] })), { ok: true });
  assert.deepEqual(canStartRound(makeSession({ status: "ended", players: [makePlayer()] })), {
    ok: false,
    reason: "session_ended"
  });
});

test("isRoundActive opens economy only during an active round", () => {
  assert.equal(isRoundActive(makeSession({ status: "waiting" })), false);
  assert.equal(isRoundActive(makeSession({ status: "active" })), true);
  assert.equal(isRoundActive(makeSession({ status: "ended" })), false);
});

test("round preparation opens the Tag and Flag quiz-and-shop window", () => {
  const transition = { nextRound: 2, startsAt: "2026-07-15T00:00:35.000Z", phase: "preparation" as const };
  assert.equal(isRoundBuyPhase(makeSession({ status: "paused", roundTransition: transition })), true);
  assert.equal(isRoundPreparationPhase(makeSession({ status: "paused", roundTransition: transition })), true);
  assert.equal(isRoundBuyPhase(makeSession({ status: "active", roundTransition: transition })), false);
  assert.equal(isRoundPreparationPhase(makeSession({
    status: "paused",
    settings: { ...DEFAULT_SESSION_SETTINGS, gameMode: "classic" },
    roundTransition: transition
  })), true);
  assert.equal(isRoundPreparationPhase(makeSession({
    status: "paused",
    settings: { ...DEFAULT_SESSION_SETTINGS, gameMode: "zombie" },
    roundTransition: { ...transition, phase: "zombie_selection" }
  })), false);
  assert.equal(isZombieSelectionPhase(makeSession({
    status: "paused",
    settings: { ...DEFAULT_SESSION_SETTINGS, gameMode: "zombie" },
    roundTransition: { ...transition, phase: "zombie_selection" }
  })), true);
});

test("buildReportRows excludes bots and practice answers from class accuracy", () => {
  const realPlayer = makePlayer({ id: "real", nickname: "Real Learner", correctAnswers: 4, wrongAnswers: 2 });
  const bot = makePlayer({ id: "bot", nickname: "Atlas Bot 1", isBot: true, correctAnswers: 0, wrongAnswers: 0 });
  const rows = buildReportRows({
    players: [realPlayer, bot],
    answers: [
      makeAnswer({ id: "main-correct", playerSessionId: "real", isCorrect: true, moneyAwarded: 500, context: "main" }),
      makeAnswer({ id: "practice-wrong", playerSessionId: "real", isCorrect: false, moneyAwarded: 0, context: "practice" }),
      makeAnswer({ id: "bot-wrong", playerSessionId: "bot", isCorrect: false, moneyAwarded: 0, context: "main" })
    ]
  });

  assert.deepEqual(rows, [
    {
      nickname: "Real Learner",
      team: "blue",
      correctAnswers: 1,
      wrongAnswers: 0,
      accuracy: 100,
      money: realPlayer.money,
      quizMoney: 500,
      score: realPlayer.score
    }
  ]);
});

test("calculateClassAccuracy weights attempted answers and ignores no-attempt learners", () => {
  assert.equal(calculateClassAccuracy([
    { correctAnswers: 1, wrongAnswers: 0 },
    { correctAnswers: 0, wrongAnswers: 0 }
  ]), 100);
  assert.equal(calculateClassAccuracy([
    { correctAnswers: 1, wrongAnswers: 0 },
    { correctAnswers: 0, wrongAnswers: 1 }
  ]), 50);
  assert.equal(calculateClassAccuracy([{ correctAnswers: 0, wrongAnswers: 0 }]), null);
});

test("resolveAnswerReward caps correct-answer money and adds fast bonus only when allowed", () => {
  const result = resolveAnswerReward({
    player: makePlayer(),
    settings: DEFAULT_SESSION_SETTINGS,
    isCorrect: true,
    responseTimeMs: 6000
  });

  assert.equal(result.moneyAwarded, 500);
  assert.equal(result.nextMoney, 15500);
  assert.equal(result.scoreDelta, 12);
  assert.equal(result.correctDelta, 1);
  assert.equal(result.wrongDelta, 0);
});

test("resolveAnswerReward records correct practice answers without money while eliminated by default", () => {
  const result = resolveAnswerReward({
    player: makePlayer({ isAlive: false, money: 2000 }),
    settings: DEFAULT_SESSION_SETTINGS,
    isCorrect: true,
    responseTimeMs: 500
  });

  assert.equal(result.moneyAwarded, 0);
  assert.equal(result.nextMoney, 2000);
  assert.equal(result.scoreDelta, 0);
  assert.equal(result.correctDelta, 1);
});

test("resolvePracticeRespawn revives an eliminated player after three correct practice answers", () => {
  const almostReady = resolvePracticeRespawn({
    player: makePlayer({ isAlive: false, health: 0, respawnCorrectAnswers: RESPAWN_CORRECT_ANSWERS_REQUIRED - 1 }),
    settings: DEFAULT_SESSION_SETTINGS,
    isCorrect: true
  });

  assert.equal(almostReady.respawned, true);
  assert.equal(almostReady.player.isAlive, true);
  assert.equal(almostReady.player.health, DEFAULT_PLAYER_HEALTH);
  assert.equal(almostReady.player.snowballs, DEFAULT_SESSION_SETTINGS.startingSnowballs);
  assert.equal(almostReady.player.respawnCorrectAnswers, 0);
  assert.deepEqual(
    { x: almostReady.player.x, y: almostReady.player.y, z: almostReady.player.z, facing: almostReady.player.facing },
    getTeamSpawn("blue")
  );
});

test("resolvePracticeRespawn tracks eliminated progress without respawning early", () => {
  const result = resolvePracticeRespawn({
    player: makePlayer({ isAlive: false, health: 0, respawnCorrectAnswers: 1 }),
    settings: DEFAULT_SESSION_SETTINGS,
    isCorrect: false
  });

  assert.equal(result.respawned, false);
  assert.equal(result.progress, 1);
  assert.equal(result.required, RESPAWN_CORRECT_ANSWERS_REQUIRED);
  assert.equal(result.player.isAlive, false);
});

test("resolveAnswerReward applies wrong-answer penalties only to active players", () => {
  const active = resolveAnswerReward({
    player: makePlayer({ money: 300 }),
    settings: { ...DEFAULT_SESSION_SETTINGS, wrongAnswerPenalty: 500 },
    isCorrect: false
  });
  const eliminated = resolveAnswerReward({
    player: makePlayer({ isAlive: false, money: 300 }),
    settings: { ...DEFAULT_SESSION_SETTINGS, wrongAnswerPenalty: 500 },
    isCorrect: false
  });

  assert.equal(active.nextMoney, 0);
  assert.equal(active.wrongDelta, 1);
  assert.equal(eliminated.nextMoney, 300);
  assert.equal(eliminated.wrongDelta, 1);
});

test("sanitizeSessionSettings keeps classroom settings inside safe bounds", () => {
  const settings = sanitizeSessionSettings({
    startingMoney: 999999,
    correctAnswerReward: -100,
    fastAnswerBonus: 999999,
    fastAnswerThresholdMs: 1,
    wrongAnswerPenalty: 999999,
    roundDurationSeconds: 10,
    maxPlayers: 999,
    deadPlayersCanPractice: "yes" as unknown as boolean,
    deadPlayersEarnMoney: true,
    snowballPackPrice: 999999,
    snowballsPerPack: -10,
    startingSnowballs: 999999
  });

  assert.deepEqual(settings, {
    mapId: "desert_citadel",
    gameMode: "flag",
    botDifficulty: "standard",
    roundCount: FLAG_MODE_DEFAULTS.roundCount,
    flagHoldSeconds: FLAG_MODE_DEFAULTS.flagHoldSeconds,
    teamAssignment: "players_choose",
    initialZombieCount: undefined,
    startingMoney: 16000,
    correctAnswerReward: 0,
    fastAnswerBonus: 5000,
    fastAnswerThresholdMs: 1000,
    wrongAnswerPenalty: 16000,
    roundDurationSeconds: 60,
    maxPlayers: 40,
    deadPlayersCanPractice: true,
    deadPlayersEarnMoney: true,
    snowballPackPrice: 5000,
    snowballsPerPack: 1,
    startingSnowballs: 99,
    characterCustomization: DEFAULT_SESSION_SETTINGS.characterCustomization
  });
});

test("getRoundRemainingSeconds clamps active round countdowns between zero and the configured duration", () => {
  const session = {
    id: "session-1",
    teacherId: "teacher-1",
    quizSetId: "quiz-1",
    sessionCode: "ABC123",
    status: "active" as const,
    maxPlayers: 20,
    currentRound: 1,
    settings: { ...DEFAULT_SESSION_SETTINGS, roundDurationSeconds: 120 },
    players: [],
    createdAt: "2026-07-03T00:00:00.000Z",
    startedAt: "2026-07-03T00:00:00.000Z"
  };

  assert.equal(getRoundRemainingSeconds(session, "2026-07-03T00:01:00.000Z"), 60);
  assert.equal(getRoundRemainingSeconds(session, "2026-07-03T00:03:00.000Z"), 0);
  assert.equal(getRoundRemainingSeconds(session, "2026-07-02T23:59:30.000Z"), 120);
  assert.equal(getRoundRemainingSeconds({ ...session, status: "waiting" }, "2026-07-03T00:01:00.000Z"), 120);
});

test("resolveSnowballUse spends one snowball per launch and blocks empty launchers", () => {
  assert.deepEqual(resolveSnowballUse(makePlayer({ snowballs: 3 })), { ok: true, nextSnowballs: 2 });
  assert.deepEqual(resolveSnowballUse(makePlayer({ snowballs: 0 })), { ok: false, reason: "out_of_snowballs" });
  assert.deepEqual(resolveSnowballUse(makePlayer({ snowballs: 0.4 })), { ok: false, reason: "out_of_snowballs" });
  assert.deepEqual(resolveSnowballUse(makePlayer({ isAlive: false, snowballs: 3 })), {
    ok: false,
    reason: "attacker_eliminated"
  });
});

test("resolveProjectileTarget finds bots and players along the swept snowball path", () => {
  const attacker = makePlayer({ id: "attacker", team: "blue", x: 0, z: 0, facing: -Math.PI / 2 });
  const bot = makePlayer({ id: "bot-1", team: "red", isBot: true, x: 12, z: 0, health: 100 });
  const player = makePlayer({ id: "player-2", team: "red", x: 16, z: 0.25, health: 100 });

  assert.deepEqual(resolveProjectileTarget({ attacker, candidates: [player, bot], obstacles: [] }), {
    ok: true,
    targetId: "bot-1"
  });
});

test("pitch-aware projectiles hit between elevated and lower combat levels", () => {
  const upperAttacker = makePlayer({
    id: "upper-attacker",
    team: "blue",
    x: 0,
    y: 22.21,
    z: 0,
    facing: -Math.PI / 2
  });
  const lowerTarget = makePlayer({
    id: "lower-target",
    team: "red",
    x: 30,
    y: ARENA_PLAYER_EYE_HEIGHT,
    z: 0
  });
  const downwardPitch = Math.atan2(
    Number(lowerTarget.y) - Number(upperAttacker.y),
    30
  );

  assert.deepEqual(
    resolveProjectileTarget({
      attacker: upperAttacker,
      candidates: [lowerTarget],
      obstacles: [],
      range: 40
    }),
    { ok: false, reason: "no_valid_target" }
  );
  assert.deepEqual(
    resolveProjectileTarget({
      attacker: upperAttacker,
      candidates: [lowerTarget],
      obstacles: [],
      range: 40,
      aimPitch: downwardPitch
    }),
    { ok: true, targetId: "lower-target" }
  );

  const lowerAttacker = makePlayer({
    id: "lower-attacker",
    team: "blue",
    x: 0,
    y: ARENA_PLAYER_EYE_HEIGHT,
    z: 0,
    facing: -Math.PI / 2
  });
  const upperTarget = makePlayer({
    id: "upper-target",
    team: "red",
    x: 30,
    y: 22.21,
    z: 0
  });
  assert.deepEqual(
    resolveProjectileTarget({
      attacker: lowerAttacker,
      candidates: [upperTarget],
      obstacles: [],
      range: 40,
      aimPitch: Math.atan2(
        Number(upperTarget.y) - Number(lowerAttacker.y),
        30
      )
    }),
    { ok: true, targetId: "upper-target" }
  );
});

test("sloped projectile sightlines clear low cover but remain blocked by tall cover", () => {
  const attacker = makePlayer({
    id: "upper-attacker",
    team: "blue",
    x: 0,
    y: 22.21,
    z: 0,
    facing: -Math.PI / 2
  });
  const target = makePlayer({
    id: "lower-target",
    team: "red",
    x: 30,
    y: ARENA_PLAYER_EYE_HEIGHT,
    z: 0
  });
  const aimPitch = Math.atan2(Number(target.y) - Number(attacker.y), 30);
  const lowCover = {
    id: "low-cover",
    kind: "rect" as const,
    x: 15,
    z: 0,
    width: 2,
    depth: 8,
    minY: 0,
    maxY: 10
  };
  const tallCover = { ...lowCover, id: "tall-cover", maxY: 16 };

  assert.deepEqual(
    resolveProjectileTarget({
      attacker,
      candidates: [target],
      obstacles: [lowCover],
      range: 40,
      aimPitch
    }),
    { ok: true, targetId: "lower-target" }
  );
  assert.deepEqual(
    resolveProjectileTarget({
      attacker,
      candidates: [target],
      obstacles: [tallCover],
      range: 40,
      aimPitch
    }),
    { ok: false, reason: "blocked_by_cover" }
  );
});

test("server aim pitch remains bounded to the playable camera range", () => {
  assert.equal(clampArenaAimPitch(-99), ARENA_MIN_AIM_PITCH);
  assert.equal(clampArenaAimPitch(99), ARENA_MAX_AIM_PITCH);
  assert.equal(clampArenaAimPitch(Number.NaN), 0);
});

test("resolveProjectileTarget rewinds across a bot's last authoritative movement step", () => {
  const attacker = makePlayer({ id: "attacker", team: "blue", x: 0, z: 0, facing: -Math.PI / 2 });
  const bot = {
    ...makePlayer({ id: "moving-bot", team: "red", isBot: true, x: 12, z: 4 }),
    previousX: 12,
    previousZ: 0
  };

  assert.deepEqual(resolveProjectileTarget({ attacker, candidates: [bot], obstacles: [] }), {
    ok: true,
    targetId: "moving-bot"
  });
});

test("resolveProjectileTarget rejects misses, invalid targets, and friendly fire", () => {
  const attacker = makePlayer({ id: "attacker", team: "blue", x: 0, z: 0, facing: -Math.PI / 2 });
  const teammate = makePlayer({ id: "teammate", team: "blue", x: 6, z: 0 });
  const missed = makePlayer({ id: "missed", team: "red", x: 10, z: 3 });
  const outOfRange = makePlayer({ id: "far", team: "red", x: 40, z: 0 });

  assert.deepEqual(resolveProjectileTarget({ attacker, candidates: [missed] }), { ok: false, reason: "no_valid_target" });
  assert.deepEqual(resolveProjectileTarget({ attacker, candidates: [outOfRange] }), { ok: false, reason: "no_valid_target" });
  assert.deepEqual(resolveProjectileTarget({ attacker, candidates: [teammate] }), { ok: false, reason: "no_valid_target" });
  assert.deepEqual(resolveProjectileTarget({ attacker, candidates: [missed], requestedTargetId: "unknown" }), {
    ok: false,
    reason: "invalid_target"
  });
});

test("authoritative projectile and bot targeting ignore disconnected players", () => {
  const attacker = makePlayer({ id: "attacker", team: "blue", x: 0, z: 0, facing: -Math.PI / 2 });
  const disconnected = makePlayer({ id: "disconnected", team: "red", connectionState: "disconnected", x: 8, z: 0 });
  assert.deepEqual(resolveProjectileTarget({ attacker, candidates: [disconnected], obstacles: [] }), {
    ok: false,
    reason: "no_valid_target"
  });
  const bot = makePlayer({ id: "bot", isBot: true, team: "red", x: 0, z: 0 });
  assert.deepEqual(resolveBotAttackTarget({ bot, candidates: [disconnected], obstacles: [] }), {
    ok: false,
    reason: "no_valid_target"
  });
});

test("resolveProjectileTarget ignores opponents hidden behind arena cover", () => {
  const attacker = makePlayer({ id: "attacker", team: "blue", x: 0, z: 0, facing: -Math.PI / 2 });
  const target = makePlayer({ id: "target", team: "red", x: 12, z: 0 });

  assert.deepEqual(
    resolveProjectileTarget({
      attacker,
      candidates: [target],
      obstacles: [{ id: "wall", kind: "rect", x: 6, z: 0, width: 2, depth: 6 }]
    }),
    { ok: false, reason: "blocked_by_cover" }
  );
});

test("resolveAuthoritativeMovement clamps speed and rejects movement through cover", () => {
  assert.deepEqual(
    resolveAuthoritativeMovement({
      current: { x: 0, z: 0, facing: 0 },
      requested: { x: 100, z: 0, facing: 1 },
      elapsedMs: 1000,
      maxSpeed: 10,
      obstacles: []
    }),
    { x: 10, z: 0, facing: 1, limited: true }
  );

  assert.deepEqual(
    resolveAuthoritativeMovement({
      current: { x: 0, z: 0, facing: 0 },
      requested: { x: 8, z: 0, facing: 1 },
      elapsedMs: 1000,
      maxSpeed: 10,
      obstacles: [{ id: "wall", kind: "rect", x: 4, z: 0, width: 2, depth: 8 }]
    }),
    { x: 0, z: 0, facing: 1, blocked: true }
  );
});

test("authoritative movement mirrors client axis sliding instead of getting stuck behind a corner", () => {
  const obstacle = { id: "corner", kind: "rect" as const, x: 0, z: 0, width: 2, depth: 2 };
  const result = resolveAuthoritativeMovement({
    current: { x: -2, z: -2, facing: 0 },
    requested: { x: 2, z: 2, facing: 1 },
    elapsedMs: 1000,
    maxSpeed: 10,
    obstacles: [obstacle]
  });

  assert.deepEqual(result, { x: 2, z: 2, facing: 1, blocked: true });
  assert.deepEqual(
    resolveAuthoritativeMovement({
      current: { x: -1.4, z: 0, facing: 0 },
      requested: { x: -2.4, z: 0, facing: 0 },
      elapsedMs: 100,
      maxSpeed: 20,
      obstacles: [obstacle]
    }),
    { x: -2.4, z: 0, facing: 0 }
  );
});

test("resolveAuthoritativeMovement allows jump-height movement over jumpable low cover", () => {
  const lowCover = [{ id: "low-cover", kind: "rect" as const, x: 3, z: 0, width: 2, depth: 2, jumpable: true }];

  assert.equal(
    resolveAuthoritativeMovement({
      current: { x: 0, z: 0, facing: 0 },
      requested: { x: 6, z: 0, facing: 0 },
      elapsedMs: 1000,
      maxSpeed: 22,
      obstacles: lowCover
    }).blocked,
    true
  );

  assert.equal(
    resolveAuthoritativeMovement({
      current: { x: 0, z: 0, facing: 0 },
      requested: { x: 6, z: 0, y: 5.4, facing: 0 },
      elapsedMs: 1000,
      maxSpeed: 22,
      obstacles: lowCover
    }).x,
    6
  );
});

test("authoritative movement remains free while standing on top of an object", () => {
  const objectTopY = 3;
  const obstacle = [{
    id: "viewing-crate",
    kind: "rect" as const,
    x: 0,
    z: 0,
    width: 4,
    depth: 4,
    minY: 0,
    maxY: objectTopY
  }];
  const standingY = objectTopY + ARENA_PLAYER_EYE_HEIGHT;

  const result = resolveAuthoritativeMovement({
    current: { x: 0, y: standingY, z: 0, facing: 0 },
    requested: { x: 0.5, y: standingY, z: 0, facing: 0 },
    elapsedMs: 100,
    maxSpeed: 22,
    obstacles: obstacle,
    groundY: 0
  });

  assert.equal(result.x, 0.5);
  assert.equal(result.blocked, undefined);

  const crouchedResult = resolveAuthoritativeMovement({
    current: { x: 0, y: objectTopY + ARENA_PLAYER_CROUCH_EYE_HEIGHT, z: 0, facing: 0 },
    requested: { x: 0.5, y: objectTopY + ARENA_PLAYER_CROUCH_EYE_HEIGHT, z: 0, facing: 0 },
    elapsedMs: 100,
    maxSpeed: 22,
    obstacles: obstacle,
    groundY: 0,
    eyeHeight: ARENA_PLAYER_CROUCH_EYE_HEIGHT
  });

  assert.equal(crouchedResult.x, 0.5);
  assert.equal(crouchedResult.blocked, undefined);
});

test("resolveBotAttackTarget chooses the nearest visible real opponent", () => {
  const bot = makePlayer({ id: "bot", isBot: true, team: "red", x: 0, z: 0 });
  const visible = makePlayer({ id: "visible", team: "blue", x: 0, z: 6 });
  const covered = makePlayer({ id: "covered", team: "blue", x: 4, z: 0 });
  const teammate = makePlayer({ id: "friend", team: "red", x: 2, z: 0 });

  assert.deepEqual(
    resolveBotAttackTarget({
      bot,
      candidates: [teammate, covered, visible],
      obstacles: [{ id: "low-wall", kind: "rect", x: 2, z: 0, width: 1, depth: 4 }]
    }),
    { ok: true, targetId: "visible" }
  );
});

test("resolveTeamRoundWinner ranks Classic Tag rounds by tags, respawns, then quiz earnings", () => {
  assert.equal(resolveTeamRoundWinner([
    makePlayer({ team: "blue", score: 100, roundTags: 2, roundRespawns: 8, roundQuizMoneyEarned: 5000 }),
    makePlayer({ team: "red", score: 5, roundTags: 4, roundRespawns: 0, roundQuizMoneyEarned: 0 })
  ]), "red");
  assert.equal(resolveTeamRoundWinner([
    makePlayer({ team: "blue", roundTags: 3, roundRespawns: 2, roundQuizMoneyEarned: 100 }),
    makePlayer({ team: "red", roundTags: 3, roundRespawns: 1, roundQuizMoneyEarned: 5000 })
  ]), "blue");
  assert.equal(resolveTeamRoundWinner([
    makePlayer({ team: "blue", roundTags: 2, roundRespawns: 1, roundQuizMoneyEarned: 1200 }),
    makePlayer({ team: "red", roundTags: 2, roundRespawns: 1, roundQuizMoneyEarned: 900 })
  ]), "blue");
  assert.equal(resolveTeamRoundWinner([
    makePlayer({ team: "blue", roundTags: 2, roundRespawns: 1, roundQuizMoneyEarned: 900 }),
    makePlayer({ team: "red", roundTags: 2, roundRespawns: 1, roundQuizMoneyEarned: 900 })
  ]), undefined);
});

test("getZombieBestPlayers ranks surviving humans before the last players converted", () => {
  const players = [
    makePlayer({ id: "initial", nickname: "Initial Zombie", role: "zombie" }),
    makePlayer({ id: "early", nickname: "Early", role: "zombie", zombieConvertedAt: "2026-07-15T10:00:00.000Z" }),
    makePlayer({ id: "late", nickname: "Late", role: "zombie", zombieConvertedAt: "2026-07-15T10:02:00.000Z" }),
    makePlayer({ id: "survivor", nickname: "Survivor", role: "human" })
  ];

  assert.deepEqual(getZombieBestPlayers(players, 3).map((player) => player.nickname), ["Survivor", "Late", "Early"]);
  assert.deepEqual(
    getZombieBestPlayers(players.filter((player) => player.role === "zombie"), 6).map((player) => player.nickname),
    ["Late", "Early"]
  );
});

test("resolveBotPursuitTarget sends bots toward the nearest connected real opponent", () => {
  const bot = makePlayer({ id: "bot", isBot: true, team: "red", x: 0, z: 0 });
  const near = makePlayer({ id: "near", team: "blue", x: 8, z: 4 });
  const far = makePlayer({ id: "far", team: "blue", x: 30, z: 0 });
  const disconnected = makePlayer({ id: "offline", team: "blue", x: 1, z: 0, connectionState: "disconnected" });

  assert.deepEqual(resolveBotPursuitTarget({ bot, candidates: [far, disconnected, near] }), { x: 8, z: 4 });
});

test("resolveBotRoamStep detours around cover instead of freezing in place", () => {
  const result = resolveBotRoamStep({
    current: { x: 0, z: 0, facing: 0 },
    desired: { x: 8, z: 0, facing: 1 },
    elapsedMs: 450,
    speed: 40,
    obstacles: [{ id: "wall", kind: "rect", x: 4, z: 0, width: 2, depth: 8 }]
  });

  assert.equal(result.blocked, undefined);
  assert.ok(Math.abs(result.x) < 0.000001);
  assert.notEqual(result.z, 0);
});

test("bot roam routes escape every map spawn instead of wedging against base cover", () => {
  for (const mapId of ["desert_citadel", "iron_junction", "temple_runoff"] as const) {
    for (const team of ["blue", "red"] as const) {
      const goal = {
        x: (team === "red" ? -142 : 142) * ARENA_SCALE,
        z: 0,
        facing: 0
      };
      for (const [spawnIndex, spawn] of getTeamSpawnsForMap(mapId)[team].entries()) {
        let current = { x: spawn.x, z: spawn.z, facing: spawn.facing };
        const obstacles = getArenaObstacles(mapId);
        const path = findBotNavigationPath({ from: current, to: goal, obstacles, mapId });
        assert.ok(path.length > 0, `${mapId} ${team} spawn ${spawnIndex} had no route`);
        for (const waypoint of path) {
          for (let tick = 0; tick < 100 && Math.hypot(waypoint.x - current.x, waypoint.z - current.z) >= 2; tick += 1) {
            current = resolveBotRoamStep({
              current,
              desired: { ...waypoint, facing: goal.facing },
              elapsedMs: 300,
              speed: 19.5,
              obstacles,
              detourDirection: spawnIndex % 2 === 0 ? 1 : -1,
              mapId
            });
          }
        }
        assert.ok(Math.hypot(goal.x - current.x, goal.z - current.z) < 2, `${mapId} ${team} spawn ${spawnIndex} remained stuck`);
      }
    }
  }
});

test("resolveBotRespawn revives bots only after the respawn time", () => {
  const bot = makePlayer({ id: "bot", isBot: true, team: "red", isAlive: false, health: 0, snowballs: 0 });
  const spawn = getTeamSpawn("red");

  assert.equal(resolveBotRespawn({ bot, spawn, nowMs: 900, respawnAtMs: 1000, startingSnowballs: 10 }).respawned, false);
  assert.deepEqual(resolveBotRespawn({ bot, spawn, nowMs: 1000, respawnAtMs: 1000, startingSnowballs: 10 }), {
    respawned: true,
    player: {
      ...bot,
      ...spawn,
      isAlive: true,
      health: DEFAULT_PLAYER_HEALTH,
      snowballs: 10,
      respawnCorrectAnswers: 0
    }
  });
});

test("resolveSnowballPurchase exchanges money for a teacher-priced snowball pack", () => {
  assert.deepEqual(
    resolveSnowballPurchase({
      player: makePlayer({ money: 1200, snowballs: 2 }),
      settings: { ...DEFAULT_SESSION_SETTINGS, snowballPackPrice: 600, snowballsPerPack: 10 }
    }),
    { ok: true, nextMoney: 600, nextSnowballs: 12, snowballsAdded: 10 }
  );
  assert.deepEqual(
    resolveSnowballPurchase({
      player: makePlayer({ money: 200, snowballs: 2 }),
      settings: { ...DEFAULT_SESSION_SETTINGS, snowballPackPrice: 600, snowballsPerPack: 10 }
    }),
    { ok: false, reason: "not_enough_money" }
  );
});

test("resolveGearPurchase is idempotent for currently equipped gear", () => {
  const player = makePlayer({ money: 1200, gear: "quick_blaster" });
  const gear = GEAR_ITEMS.find((item) => item.id === "quick_blaster")!;

  assert.deepEqual(resolveGearPurchase({ player, gear }), {
    ok: true,
    alreadyEquipped: true,
    nextMoney: 1200,
    nextHealth: player.health,
    gearChanged: false
  });
});

test("resolveGearPurchase charges once for new gear in base", () => {
  const player = makePlayer({ money: 3000, gear: "starter_blaster", ...getTeamSpawn("blue") });
  const gear = GEAR_ITEMS.find((item) => item.id === "quick_blaster")!;

  assert.deepEqual(resolveGearPurchase({ player, gear }), {
    ok: true,
    alreadyEquipped: false,
    nextMoney: 0,
    nextHealth: player.health,
    gearChanged: true
  });
});

test("classic-style stores can allow weapon purchases away from a team base", () => {
  const player = makePlayer({ money: 6000, gear: "starter_blaster", x: 0, z: 0 });
  const gear = GEAR_ITEMS.find((item) => item.id === "power_blaster")!;

  assert.equal(resolveGearPurchase({ player, gear }).ok, false);
  assert.deepEqual(resolveGearPurchase({ player, gear, requireBase: false }), {
    ok: true,
    alreadyEquipped: false,
    nextMoney: 0,
    nextHealth: player.health,
    gearChanged: true
  });
});

test("resolveGearPurchase cannot downgrade a purchased launcher to the default", () => {
  const player = makePlayer({ money: 6000, gear: "power_blaster", ...getTeamSpawn("blue") });
  const starter = GEAR_ITEMS.find((item) => item.id === "starter_blaster")!;
  assert.deepEqual(resolveGearPurchase({ player, gear: starter }), { ok: false, reason: "starter_weapon" });
});

test("warm vest adds 50 warmth when purchased in base", () => {
  const player = makePlayer({ money: 1000, health: DEFAULT_PLAYER_HEALTH, gear: "starter_blaster", ...getTeamSpawn("blue") });
  const gear = GEAR_ITEMS.find((item) => item.id === "shield_vest")!;

  assert.equal(gear.healthBonus, 50);
  const result = resolveGearPurchase({ player, gear });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.nextHealth, 150);
});

test("gear store items expose real combat and movement mechanics", () => {
  assert.equal(GEAR_ITEMS.find((item) => item.id === "quick_blaster")?.cost, 3000);
  assert.equal(GEAR_ITEMS.find((item) => item.id === "power_blaster")?.cost, 6000);
  assert.equal(getGearRange("starter_blaster"), STARTER_BLASTER_RANGE);
  assert.equal(getGearRange("quick_blaster"), QUICK_BLASTER_RANGE);
  assert.equal(getGearRange("power_blaster"), HEAVY_GUN_RANGE);
  assert.equal(getGearFireCooldownMs("quick_blaster") > getGearFireCooldownMs("starter_blaster"), true);
  assert.equal(getGearFireCooldownMs("power_blaster") > getGearFireCooldownMs("starter_blaster"), true);
  assert.equal(getGearFireCooldownMs("starter_blaster") <= 220, true);
  assert.equal(getGearFireCooldownMs("quick_blaster"), QUICK_BLASTER_COOLDOWN_MS);
  assert.equal(getGearFireCooldownMs("quick_blaster") >= 240, true);
  assert.equal(isGearAutoFireEnabled("quick_blaster"), true);
  assert.equal(isGearAutoFireEnabled("starter_blaster"), false);
  assert.equal(getGearDamage("starter_blaster"), 15);
  assert.equal(getGearDamage("quick_blaster"), 22);
  assert.equal(getGearMoveSpeedMultiplier("speed_shoes"), 1.15);
  assert.equal(getGearZoomFovMultiplier("power_blaster") < getGearZoomFovMultiplier("starter_blaster"), true);
  assert.equal(getGearMoveSpeedMultiplier("unknown_gear"), 1);
  assert.equal(getGearZoomFovMultiplier("unknown_gear"), 1);
});

test("snow goggles are removed from the gear store", () => {
  assert.equal(GEAR_ITEMS.some((item) => item.id === "focus_scope"), false);
});

test("heavy launcher uses named AWP-style combat settings", () => {
  assert.equal(DEFAULT_SESSION_SETTINGS.gameMode, "flag");
  assert.equal(DEFAULT_SESSION_SETTINGS.roundCount, FLAG_MODE_DEFAULTS.roundCount);
  assert.equal(DEFAULT_SESSION_SETTINGS.roundDurationSeconds, FLAG_MODE_DEFAULTS.roundDurationSeconds);
  assert.equal(DEFAULT_SESSION_SETTINGS.flagHoldSeconds, FLAG_MODE_DEFAULTS.flagHoldSeconds);
  assert.equal(getGearDamage("power_blaster"), HEAVY_GUN_DAMAGE);
  assert.equal(getGearDamage("power_blaster"), 100);
  assert.equal(getGearFireCooldownMs("power_blaster"), HEAVY_GUN_COOLDOWN_MS);
  assert.equal(getGearFireCooldownMs("power_blaster") > 1200, true);
  assert.equal(getGearZoomFovMultiplier("power_blaster") < 1, true);
  assert.equal(getGearHitRadius("power_blaster", 2), HEAVY_GUN_DEEP_SCOPED_HIT_RADIUS);
  assert.equal(getGearHitRadius("power_blaster", 2) > getGearHitRadius("power_blaster", 1), true);
  assert.equal(getGearRange("power_blaster") > getGearRange("starter_blaster"), true);
});

test("quick, starter, and heavy launchers all share projectile targeting with gear-specific range", () => {
  const attacker = makePlayer({ id: "attacker", team: "blue", x: 0, z: 0, facing: -Math.PI / 2 });
  const nearBot = makePlayer({ id: "near-bot", team: "red", isBot: true, x: 12, z: 0, health: 100 });
  const farBot = makePlayer({ id: "far-bot", team: "red", isBot: true, x: 44, z: 0, health: 100 });

  for (const gear of ["starter_blaster", "quick_blaster", "power_blaster"] as const) {
    const result = resolveProjectileTarget({
      attacker,
      candidates: [nearBot],
      range: getGearRange(gear),
      hitRadius: getGearHitRadius(gear),
      obstacles: []
    });
    assert.deepEqual(result, { ok: true, targetId: "near-bot" });
  }

  assert.deepEqual(
    resolveProjectileTarget({
      attacker,
      candidates: [farBot],
      range: getGearRange("starter_blaster"),
      hitRadius: getGearHitRadius("starter_blaster"),
      obstacles: []
    }),
    { ok: false, reason: "no_valid_target" }
  );
  assert.deepEqual(
    resolveProjectileTarget({
      attacker,
      candidates: [farBot],
      range: getGearRange("power_blaster"),
      hitRadius: getGearHitRadius("power_blaster"),
      obstacles: []
    }),
    { ok: true, targetId: "far-bot" }
  );
});

test("starter snowball hits remove 15 warmth", () => {
  const attacker = makePlayer({ id: "attacker", team: "blue", gear: "starter_blaster", x: -1, z: 0 });
  const target = makePlayer({ id: "target", team: "red", health: 100, x: 2, z: 0 });

  const result = resolveTagAction({ attacker, target });

  assert.deepEqual(result, {
    ok: true,
    damage: 15,
    nextHealth: 85,
    eliminated: false,
    moneyAwarded: 0,
    scoreDelta: 0
  });
});

test("removed gear does not widen snowball hit validation", () => {
  const attacker = makePlayer({ id: "attacker", team: "blue", gear: "starter_blaster", x: 0, z: 0, facing: 0 });
  const target = makePlayer({ id: "target", team: "red", x: 1.9, z: -8 });

  assert.deepEqual(
    resolveProjectileTarget({
      attacker,
      candidates: [attacker, target],
      hitRadius: getGearHitRadius("starter_blaster"),
      obstacles: []
    }),
    { ok: false, reason: "no_valid_target" }
  );
});

test("speed shoes increase server-authoritative movement distance", () => {
  const current = { x: 0, z: 0, facing: 0 };
  const requested = { x: 100, z: 0, facing: 0 };
  const normal = resolveAuthoritativeMovement({
    current,
    requested,
    elapsedMs: 1000,
    maxSpeed: 22 * getGearMoveSpeedMultiplier("starter_blaster"),
    obstacles: []
  });
  const boosted = resolveAuthoritativeMovement({
    current,
    requested,
    elapsedMs: 1000,
    maxSpeed: 22 * getGearMoveSpeedMultiplier("speed_shoes"),
    obstacles: []
  });

  assert.equal(normal.x, 22);
  assert.equal(Number(boosted.x.toFixed(2)), 25.3);
});

test("zero authoritative speed blocks position changes", () => {
  const result = resolveAuthoritativeMovement({
    current: { x: 5, z: -4, facing: 0 },
    requested: { x: 80, z: 60, facing: 1 },
    elapsedMs: 1000,
    maxSpeed: 0,
    obstacles: []
  });

  assert.deepEqual(result, { x: 5, z: -4, facing: 1, limited: true });
});

test("buildCsvReport escapes classroom report rows for spreadsheet export", () => {
  const report: SessionReport = {
    session: {
      id: "session-1",
      teacherId: "teacher-1",
      quizSetId: "quiz-1",
      sessionCode: "ABC123",
      status: "ended",
      maxPlayers: 20,
      currentRound: 1,
      settings: DEFAULT_SESSION_SETTINGS,
      players: [],
      createdAt: "2026-07-03T00:00:00.000Z"
    },
    rows: [
      {
        nickname: "Ada, A.",
        team: "blue",
        correctAnswers: 3,
        wrongAnswers: 1,
        accuracy: 75,
        money: 1200,
        quizMoney: 1800,
        score: 34
      }
    ],
    missedQuestions: [{ questionId: "q1", prompt: "What is \"safe\" input?", misses: 2 }]
  };

  assert.equal(
    buildCsvReport(report),
    [
      "Session Code,Student,Team,Correct,Wrong,Accuracy %,Wallet,Quiz Rewards,Score",
      "ABC123,\"Ada, A.\",blue,3,1,75,1200,1800,34",
      "",
      "Most Missed Question,Misses",
      "\"What is \"\"safe\"\" input?\",2"
    ].join("\n")
  );
});

test("isInsideTeamBase allows buying only in the player's own base zone", () => {
  assert.equal(isInsideTeamBase("blue", getTeamSpawn("blue")), true);
  assert.equal(isInsideTeamBase("red", getTeamSpawn("red")), true);
  assert.equal(isInsideTeamBase("blue", getTeamSpawn("red")), false);
  assert.equal(isInsideTeamBase("red", { x: 0, z: 0 }), false);
});

test("team spawn shop zones extend just beyond the home-base boundary", () => {
  const blueEdgeSpawn = TEAM_SPAWNS.blue.reduce((closest, spawn) => spawn.x > closest.x ? spawn : closest);
  const spawnShopPosition = { x: blueEdgeSpawn.x + 9, z: blueEdgeSpawn.z };
  assert.equal(isInsideTeamBase("blue", spawnShopPosition), false);
  assert.equal(isNearTeamSpawn("blue", spawnShopPosition), true);
  const weapon = GEAR_ITEMS.find((item) => item.id === "quick_blaster")!;
  assert.equal(resolveGearPurchase({
    player: makePlayer({ team: "blue", ...spawnShopPosition }),
    gear: weapon,
    requireBase: true
  }).ok, true);
});

test("clampArenaPosition preserves the large classroom arena footprint", () => {
  assert.deepEqual(clampArenaPosition({ x: 999, z: -999, facing: 1.25 }), { x: ARENA_LIMIT_X, z: -ARENA_LIMIT_Z, facing: 1.25 });
  assert.deepEqual(clampArenaPosition({ x: -999, z: 999, facing: Number.NaN }), { x: -ARENA_LIMIT_X, z: ARENA_LIMIT_Z, facing: 0 });
});

test("Desert Citadel provides enough protected team and free-for-all spawns", () => {
  assert.equal(TEAM_SPAWNS.blue.length, 20);
  assert.equal(TEAM_SPAWNS.red.length, 20);
  assert.equal(FREE_FOR_ALL_SPAWNS.length, 60);
  assert.equal(TEAM_SPAWNS.blue.every((spawn) => isInsideTeamBase("blue", spawn)), true);
  assert.equal(TEAM_SPAWNS.red.every((spawn) => isInsideTeamBase("red", spawn)), true);
});

test("Desert Citadel team spawns do not overlap base blockout buildings", () => {
  const baseObstacles = [
    { id: "west-barracks", minX: -163.15, maxX: -136.85, minZ: -61.65, maxZ: -42.35 },
    { id: "west-armoury", minX: -163.15, maxX: -134.85, minZ: 42.35, maxZ: 61.65 },
    { id: "east-stables", minX: 134.35, maxX: 163.65, minZ: -61.15, maxZ: -42.85 },
    { id: "east-storage", minX: 135.35, maxX: 162.65, minZ: 42.35, maxZ: 61.65 }
  ].map((obstacle) => ({
    id: obstacle.id,
    minX: obstacle.minX * ARENA_SCALE,
    maxX: obstacle.maxX * ARENA_SCALE,
    minZ: obstacle.minZ * ARENA_SCALE,
    maxZ: obstacle.maxZ * ARENA_SCALE
  }));

  const overlapping = [...TEAM_SPAWNS.blue, ...TEAM_SPAWNS.red].flatMap((spawn) =>
    baseObstacles
      .filter((obstacle) => spawn.x >= obstacle.minX && spawn.x <= obstacle.maxX && spawn.z >= obstacle.minZ && spawn.z <= obstacle.maxZ)
      .map((obstacle) => `${spawn.id}:${obstacle.id}`)
  );

  assert.deepEqual(overlapping, []);
});

test("Desert Citadel spawn points begin on walkable ground", () => {
  const spawns = [
    ...TEAM_SPAWNS.blue.map((spawn) => ({ group: "blue", spawn })),
    ...TEAM_SPAWNS.red.map((spawn) => ({ group: "red", spawn })),
    ...FREE_FOR_ALL_SPAWNS.map((spawn) => ({ group: "free-for-all", spawn }))
  ];

  const blocked = spawns.flatMap(({ group, spawn }) => {
    const firstStep = resolveAuthoritativeMovement({
      current: spawn,
      requested: { ...spawn, x: spawn.x + 0.05, z: spawn.z + 0.05 },
      elapsedMs: 100,
      maxSpeed: 1,
      obstacles: getArenaObstacles("desert_citadel"),
      mapId: "desert_citadel"
    });
    return firstStep.blocked ? [`${group}:${spawn.id}`] : [];
  });

  assert.deepEqual(blocked, []);
});

test("Iron Junction uses its own map spawn labels and collision proxies", () => {
  const blueSpawn = getTeamSpawnForMap("iron_junction", "blue");
  const redSpawn = getTeamSpawnForMap("iron_junction", "red");
  const ironObstacles = getArenaObstacles("iron_junction");

  assert.equal(blueSpawn.x < 0, true);
  assert.equal(redSpawn.x > 0, true);
  assert.equal(ironObstacles.some((obstacle) => obstacle.id === "junction-locomotive"), true);
  assert.notEqual(ironObstacles, getArenaObstacles("desert_citadel"));
  assert.equal(sanitizeSessionSettings({ mapId: "iron_junction" }).mapId, "iron_junction");
});

test("Temple Runoff supports 20 safe spawns per team and authoritative map selection", () => {
  const spawns = getTeamSpawnsForMap("temple_runoff");
  const obstacles = getArenaObstacles("temple_runoff");

  assert.equal(spawns.blue.length, 20);
  assert.equal(spawns.red.length, 20);
  assert.equal(new Set(spawns.blue.map((spawn) => `${spawn.x}:${spawn.z}`)).size, 20);
  assert.equal(new Set(spawns.red.map((spawn) => `${spawn.x}:${spawn.z}`)).size, 20);
  assert.equal(new Set(spawns.blue.map((spawn) => spawn.label)).size, 4);
  assert.equal(spawns.blue.filter((spawn) => spawn.y === TEMPLE_RUNOFF_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT).length, 20);
  assert.equal(obstacles.some((obstacle) => obstacle.id === "rain-god-statue"), true);
  assert.equal(obstacles.some((obstacle) => obstacle.id === "blue-temple-gatehouse"), true);
  assert.notEqual(obstacles, getArenaObstacles("desert_citadel"));
  assert.equal(sanitizeSessionSettings({ mapId: "temple_runoff" }).mapId, "temple_runoff");
  const safeLateJoinSpawn = selectTeamSpawnForMap("temple_runoff", "blue", [
    makePlayer({ id: "existing-opponent", team: "red", x: spawns.blue[0].x, z: spawns.blue[0].z })
  ]);
  assert.equal(
    safeLateJoinSpawn.y,
    getArenaGroundHeight("temple_runoff", safeLateJoinSpawn.x, safeLateJoinSpawn.z) + ARENA_PLAYER_EYE_HEIGHT
  );

  for (const spawn of [...spawns.blue, ...spawns.red]) {
    const firstStep = resolveAuthoritativeMovement({
      current: spawn,
      requested: { ...spawn, x: spawn.x + (spawn.x < 0 ? 0.05 : -0.05) },
      elapsedMs: 100,
      maxSpeed: 1,
      obstacles,
      mapId: "temple_runoff"
    });
    assert.equal(firstStep.blocked, undefined, `${spawn.id} should not overlap collision`);
  }
});

test("Temple Runoff resolves stacked floors from player height instead of choosing the highest surface", () => {
  const x = 0;
  const z = 0;
  assert.deepEqual(getArenaFloorSurfaces("temple_runoff", x, z), [0, TEMPLE_RUNOFF_UPPER_LEVEL_Y]);
  assert.equal(getArenaGroundHeightForPlayer("temple_runoff", x, z, ARENA_PLAYER_EYE_HEIGHT), 0);
  assert.equal(
    getArenaGroundHeightForPlayer("temple_runoff", x, z, TEMPLE_RUNOFF_UPPER_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT),
    TEMPLE_RUNOFF_UPPER_LEVEL_Y
  );
  for (let frame = 0; frame < 600; frame += 1) {
    assert.equal(getArenaGroundHeightForPlayer("temple_runoff", x, z, ARENA_PLAYER_EYE_HEIGHT), 0);
  }
});

test("Temple Runoff exposes eight continuous canal ramps and three upper-level connections", () => {
  for (const rawX of [-136, -52, 55, 136]) {
    assert.deepEqual(
      [24, 36, 48].map((rawZ) => getArenaGroundHeight("temple_runoff", rawX * ARENA_SCALE, rawZ * ARENA_SCALE)),
      [0, TEMPLE_RUNOFF_MAIN_LEVEL_Y / 2, TEMPLE_RUNOFF_MAIN_LEVEL_Y]
    );
    assert.deepEqual(
      [-24, -36, -48].map((rawZ) => getArenaGroundHeight("temple_runoff", rawX * ARENA_SCALE, rawZ * ARENA_SCALE)),
      [0, TEMPLE_RUNOFF_MAIN_LEVEL_Y / 2, TEMPLE_RUNOFF_MAIN_LEVEL_Y]
    );
  }
  assert.deepEqual(
    [-82, -70, -58].map((rawZ) => getArenaGroundHeight("temple_runoff", 0, rawZ * ARENA_SCALE)),
    [TEMPLE_RUNOFF_MAIN_LEVEL_Y, 12.5, TEMPLE_RUNOFF_UPPER_LEVEL_Y]
  );
  assert.deepEqual(getArenaBounds("temple_runoff"), { limitX: 235 * ARENA_SCALE, limitZ: 200 * ARENA_SCALE });
});

test("Temple Runoff bot navigation keeps elevation and reaches the lower canal through a ramp", () => {
  const path = findBotNavigationPath({
    from: { x: -80 * ARENA_SCALE, y: TEMPLE_RUNOFF_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: -70 * ARENA_SCALE, facing: 0 },
    to: { x: -90 * ARENA_SCALE, y: ARENA_PLAYER_EYE_HEIGHT, z: 0, facing: 0 },
    obstacles: getArenaObstacles("temple_runoff"),
    mapId: "temple_runoff"
  });
  assert.ok(path.length > 0);
  assert.equal(path.at(-1)?.y, ARENA_PLAYER_EYE_HEIGHT);
  assert.ok(path.some((point) => Number(point.y) < TEMPLE_RUNOFF_MAIN_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT));
});

test("projectiles do not tag players through Temple Runoff's vertical floor separation", () => {
  const attacker = makePlayer({ id: "upper-attacker", team: "blue", x: 0, y: TEMPLE_RUNOFF_UPPER_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT, z: 0, facing: -Math.PI / 2 });
  const lowerTarget = makePlayer({ id: "lower-target", team: "red", x: 8, y: ARENA_PLAYER_EYE_HEIGHT, z: 0 });
  const result = resolveProjectileTarget({ attacker, candidates: [lowerTarget], obstacles: [] });
  assert.deepEqual(result, { ok: false, reason: "no_valid_target" });
});

test("selectTeamSpawn avoids nearby visible enemies when alternatives exist", () => {
  const blocked = TEAM_SPAWNS.blue[0];
  const selected = selectTeamSpawn("blue", [
    makePlayer({ id: "enemy", team: "red", x: blocked.x + 1, z: blocked.z + 1 })
  ]);

  assert.notDeepEqual(selected, getTeamSpawn("blue", 0));
  assert.equal(isInsideTeamBase("blue", selected), true);
});

test("resolveTagAction applies gear damage and eliminates only opponents in range", () => {
  const attacker = makePlayer({ id: "attacker", team: "blue", gear: "power_blaster", x: -1, z: 0 });
  const target = makePlayer({ id: "target", team: "red", health: 25, x: 2, z: 0 });

  const result = resolveTagAction({ attacker, target });

  assert.deepEqual(result, {
    ok: true,
    damage: HEAVY_GUN_DAMAGE,
    nextHealth: 0,
    eliminated: true,
    moneyAwarded: 400,
    scoreDelta: 5
  });
});

test("resolveTagAction rejects invalid tag attempts before changing state", () => {
  const attacker = makePlayer({ id: "attacker", team: "blue", x: 0, z: 0 });
  const teammate = makePlayer({ id: "teammate", team: "blue", x: 1, z: 0 });
  const farOpponent = makePlayer({ id: "far", team: "red", x: 40, z: 0 });
  const eliminated = makePlayer({ id: "out", team: "red", isAlive: false, x: 1, z: 0 });

  assert.deepEqual(resolveTagAction({ attacker, target: teammate }), { ok: false, reason: "same_team" });
  assert.deepEqual(resolveTagAction({ attacker, target: farOpponent }), { ok: false, reason: "out_of_range" });
  assert.deepEqual(resolveTagAction({ attacker, target: eliminated }), { ok: false, reason: "target_eliminated" });
  assert.deepEqual(resolveTagAction({ attacker: { ...attacker, isAlive: false }, target: farOpponent }), {
    ok: false,
    reason: "attacker_eliminated"
  });
  assert.equal(DEFAULT_PLAYER_HEALTH, 100);
});

test("sanitizeSessionSettings validates flag and zombie mode settings", () => {
  const settings = sanitizeSessionSettings({
    gameMode: "zombie",
    roundCount: 99,
    flagHoldSeconds: 1,
    teamAssignment: "random",
    initialZombieCount: 30
  });

  assert.equal(settings.gameMode, "zombie");
  assert.equal(settings.roundCount, 30);
  assert.equal(settings.flagHoldSeconds, 5);
  assert.equal(settings.teamAssignment, "random");
  assert.equal(settings.initialZombieCount, 20);
});

test("randomizeBalancedTeams keeps teams balanced and authoritative", () => {
  const players = Array.from({ length: 7 }, (_, index) => makePlayer({ id: `p-${index}`, team: "blue" }));
  const assigned = randomizeBalancedTeams(players, 4);
  const red = assigned.filter((player) => player.team === "red").length;
  const blue = assigned.filter((player) => player.team === "blue").length;

  assert.equal(Math.abs(red - blue) <= 1, true);
  assert.equal(assigned.map((player) => player.id).sort().join(","), players.map((player) => player.id).sort().join(","));
});

test("late join assignment fills the smaller team and randomizes ties", () => {
  assert.equal(selectLateJoinTeam([{ team: "red" }, { team: "red" }, { team: "blue" }], 0.9), "blue");
  assert.equal(selectLateJoinTeam([{ team: "red" }, { team: "blue" }], 0.1), "blue");
  assert.equal(selectLateJoinTeam([{ team: "red" }, { team: "blue" }], 0.9), "red");
});

test("flag state supports pickup, placement, countdown, drop, and capture", () => {
  const red = makePlayer({ id: "red", team: "red", isAlive: true, ...getTeamSpawn("red") });
  const blue = makePlayer({ id: "blue", team: "blue", isAlive: true, ...getTeamSpawn("blue") });
  const initialFlag = createInitialFlagState(getTeamSpawn("red"));
  const carried = resolveFlagPickup(initialFlag, red);

  assert.equal(carried.state, "carried");
  assert.equal(carried.carrierId, "red");
  assert.equal(canPlaceFlag(red, carried, getTeamSpawn("blue")), true);

  const placed = resolveFlagPlacement({
    flag: carried,
    player: { ...red, ...getTeamSpawn("blue") },
    nowMs: 1_000,
    holdSeconds: 30
  });
  assert.equal(placed.state, "placed");
  assert.equal(placed.expiresAtMs, 31_000);
  assert.deepEqual(resolveFlagCountdown(placed, 31_000), { winner: "red", reason: "flag_protected" });

  const captured = resolveFlagCapture(placed, { ...blue, ...placed.position });
  assert.equal(captured.state, "captured");
  assert.equal(captured.capturedById, "blue");

  const dropped = resolveFlagDropForPlayer(carried, red, { x: 5, z: 6 });
  assert.equal(dropped.state, "dropped");
  assert.deepEqual(dropped.position, { x: 5, z: 6 });
});

test("round reset preserves living loadouts and re-arms knocked-out players", () => {
  assert.deepEqual(
    getRoundResetLoadout({ player: makePlayer({ isAlive: true, gear: "quick_blaster", snowballs: 27 }), startingSnowballs: 10 }),
    { gear: "quick_blaster", snowballs: 27 }
  );
  assert.deepEqual(
    getRoundResetLoadout({ player: makePlayer({ isAlive: false, gear: "power_blaster", snowballs: 0 }), startingSnowballs: 10 }),
    { gear: "starter_blaster", snowballs: 10 }
  );
});

test("AWP damage does not freeze a player with a warm vest in one hit", () => {
  const attacker = makePlayer({ team: "blue", gear: "power_blaster", x: -1, z: 0 });
  const vestTarget = makePlayer({ team: "red", gear: "shield_vest", health: 150, x: 2, z: 0 });
  const result = resolveTagAction({ attacker, target: vestTarget });
  assert.deepEqual(result, {
    ok: true,
    damage: 100,
    nextHealth: 50,
    eliminated: false,
    moneyAwarded: 0,
    scoreDelta: 0
  });
});

test("weapon slot survives independent vest and shoe purchases", () => {
  const player = makePlayer({ gear: "power_blaster", weapon: "power_blaster", perks: ["shield_vest"] });
  assert.equal(getPlayerWeaponId(player), "power_blaster");
  assert.deepEqual(getPlayerPerks(player), ["shield_vest"]);
  assert.equal(getPlayerHealthMax(player), 150);
  assert.equal(getPlayerMoveSpeedMultiplier({ ...player, perks: ["shield_vest", "speed_shoes"] }), 1.15);
  const vest = GEAR_ITEMS.find((item) => item.id === "shield_vest")!;
  const shoes = GEAR_ITEMS.find((item) => item.id === "speed_shoes")!;
  const vestPurchase = resolveGearPurchase({ player, gear: vest, requireBase: false });
  assert.equal(vestPurchase.ok, true);
  if (vestPurchase.ok) assert.equal(vestPurchase.alreadyEquipped, true);
  assert.equal(resolveGearPurchase({ player: { ...player, perks: ["shield_vest"] }, gear: shoes, requireBase: false }).ok, true);
});

test("flag interactions require the student to be next to the flag", () => {
  const initialFlag = createInitialFlagState(getTeamSpawn("red"));
  const distantRed = makePlayer({ id: "red", team: "red", isAlive: true, ...getTeamSpawn("blue") });
  assert.equal(resolveFlagPickup(initialFlag, distantRed).state, "available");

  const placed = {
    ...initialFlag,
    state: "placed" as const,
    position: getTeamSpawn("blue")
  };
  const distantBlue = makePlayer({ id: "blue", team: "blue", isAlive: true, ...getTeamSpawn("red") });
  assert.equal(resolveFlagCapture(placed, distantBlue).state, "placed");
});

test("zombie mode selects initial zombies, preserves prepared human energy, and converts humans once", () => {
  const players = Array.from({ length: 8 }, (_, index) => makePlayer({
    id: `p-${index}`,
    team: "blue",
    role: "human",
    energy: index + 10
  }));
  assert.equal(getDefaultInitialZombieCount(2), 1);
  assert.equal(getDefaultInitialZombieCount(8), 2);

  const selected = selectInitialZombies(players, undefined, 3);
  assert.equal(selected.filter((player) => player.role === "zombie").length, 2);
  assert.equal(selected.filter((player) => player.role === "human").length, 6);
  assert.equal(selected.find((player) => player.role === "zombie")?.gear, "starter_blaster");
  assert.equal(selected.every((player) => player.role === "zombie" ? player.team === "red" : player.team === "blue"), true);
  assert.equal(selected.every((player) => player.role === "zombie"
    ? player.energy === ZOMBIE_HUMAN_MAX_ENERGY
    : player.energy === players.find((candidate) => candidate.id === player.id)?.energy), true);

  const zombie = makePlayer({ id: "zombie", team: "red", role: "zombie", gear: "starter_blaster", isAlive: true });
  const standingHuman = makePlayer({ id: "human", team: "blue", role: "human", isAlive: true, health: 40, respawns: 0 });
  assert.deepEqual(resolveZombieConversion({ attacker: zombie, target: standingHuman }), {
    ok: false,
    reason: "target_not_knocked_out"
  });
  const human = { ...standingHuman, health: 0 };
  const conversion = resolveZombieConversion({ attacker: zombie, target: human });
  assert.equal(conversion.ok, true);
  if (conversion.ok) {
    assert.equal(conversion.player.role, "zombie");
    assert.equal(conversion.player.team, "red");
    assert.equal(conversion.player.respawns, 1);
    assert.equal(conversion.player.gear, "starter_blaster");
    assert.equal(conversion.player.energy, ZOMBIE_HUMAN_MAX_ENERGY);
  }
  assert.deepEqual(resolveZombieConversion({ attacker: zombie, target: { ...human, role: "zombie" } }), {
    ok: false,
    reason: "target_not_human"
  });
});

test("Zombie Mode always resolves combat to the default launcher", () => {
  const upgradedPlayer = makePlayer({
    gear: "power_blaster",
    weapon: "power_blaster",
    perks: ["shield_vest"]
  });

  assert.equal(getPlayerWeaponIdForMode("zombie", upgradedPlayer), "starter_blaster");
  assert.equal(getPlayerWeaponIdForMode("flag", upgradedPlayer), "power_blaster");
  assert.equal(getPlayerWeaponIdForMode("classic", upgradedPlayer), "power_blaster");
});

test("zombie mode gives Humans question-powered running energy and reserves firing for Zombies", () => {
  assert.equal(canPlayerFireInMode("zombie", "human"), false);
  assert.equal(canPlayerFireInMode("zombie", "zombie"), true);
  assert.equal(canPlayerFireInMode("flag", "human"), true);

  const earnedEnergy = awardZombieHumanEnergy({
    gameMode: "zombie",
    role: "human",
    isCorrect: true,
    currentEnergy: 0
  });
  assert.equal(earnedEnergy, ZOMBIE_HUMAN_CORRECT_ENERGY);
  assert.equal(awardZombieHumanEnergy({
    gameMode: "zombie",
    role: "human",
    isCorrect: false,
    currentEnergy: earnedEnergy
  }), earnedEnergy);
  assert.equal(awardZombieHumanEnergy({
    gameMode: "zombie",
    role: "human",
    isCorrect: true,
    currentEnergy: ZOMBIE_HUMAN_MAX_ENERGY
  }), ZOMBIE_HUMAN_MAX_ENERGY);

  assert.deepEqual(resolveZombieSprintEnergy({
    gameMode: "zombie",
    role: "human",
    sprinting: true,
    currentEnergy: 0,
    elapsedMs: 500,
    movedDistance: 5
  }), { canSprint: false, nextEnergy: 0 });
  assert.deepEqual(resolveZombieSprintEnergy({
    gameMode: "zombie",
    role: "human",
    sprinting: true,
    currentEnergy: earnedEnergy,
    elapsedMs: 500,
    movedDistance: 5
  }), { canSprint: true, nextEnergy: earnedEnergy - 10 });
});

test("scoreboard rows expose tags, respawns, and readable question accuracy", () => {
  const rows = buildScoreboardRows([
    makePlayer({ id: "human", nickname: "Human", team: "blue", role: "human", tags: 3, respawns: 1, correctAnswers: 8, wrongAnswers: 2 }),
    makePlayer({ id: "bot", nickname: "Long Named Practice Bot", team: "red", role: "zombie", tags: 0, respawns: 0, correctAnswers: 0, wrongAnswers: 0, isBot: true })
  ]);

  assert.equal(rows[0].questionAccuracy, "8 / 10 (80%)");
  assert.equal(rows[0].tags, 3);
  assert.equal(rows[0].respawns, 1);
  assert.equal(rows[1].questionAccuracy, "-");
  assert.equal(rows[1].isBot, true);
  assert.equal(rows[1].role, "zombie");
});
