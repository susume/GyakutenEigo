import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SESSION_SETTINGS,
  DEFAULT_PLAYER_HEALTH,
  FLAG_MODE_DEFAULTS,
  HEAVY_GUN_DAMAGE,
  HEAVY_GUN_COOLDOWN_MS,
  HEAVY_GUN_DEEP_SCOPED_HIT_RADIUS,
  QUICK_BLASTER_COOLDOWN_MS,
  RESPAWN_CORRECT_ANSWERS_REQUIRED,
  ARENA_LIMIT_X,
  ARENA_LIMIT_Z,
  ARENA_SCALE,
  FREE_FOR_ALL_SPAWNS,
  buildCsvReport,
  buildReportRows,
  buildScoreboardRows,
  clampArenaPosition,
  canStartRound,
  canPlaceFlag,
  createInitialFlagState,
  GEAR_ITEMS,
  getDefaultInitialZombieCount,
  getGearDamage,
  getGearFireCooldownMs,
  getGearHitRadius,
  getGearRange,
  getGearMoveSpeedMultiplier,
  getGearZoomFovMultiplier,
  getRoundRemainingSeconds,
  getTeamSpawn,
  selectTeamSpawn,
  TEAM_SPAWNS,
  isRoundActive,
  isInsideTeamBase,
  isGearAutoFireEnabled,
  randomizeBalancedTeams,
  resolveFlagCapture,
  resolveFlagCountdown,
  resolveFlagDropForPlayer,
  resolveFlagPickup,
  resolveFlagPlacement,
  resolveGearPurchase,
  resolvePracticeRespawn,
  resolveAuthoritativeMovement,
  resolveBotAttackTarget,
  resolveBotRespawn,
  resolveBotRoamStep,
  resolveProjectileTarget,
  resolveSnowballPurchase,
  resolveSnowballUse,
  resolveAnswerReward,
  resolveTagAction,
  resolveZombieConversion,
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
    { x: almostReady.player.x, z: almostReady.player.z, facing: almostReady.player.facing },
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
    gameMode: "flag",
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
    startingSnowballs: 99
  });
});

test("getRoundRemainingSeconds clamps active round countdowns to zero", () => {
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

  assert.deepEqual(resolveProjectileTarget({ attacker, candidates: [player, bot] }), {
    ok: true,
    targetId: "bot-1"
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
      maxSpeed: 10
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

test("resolveBotRoamStep keeps bot movement out of arena cover", () => {
  assert.deepEqual(
    resolveBotRoamStep({
      current: { x: 0, z: 0, facing: 0 },
      desired: { x: 8, z: 0, facing: 1 },
      elapsedMs: 450,
      speed: 40,
      obstacles: [{ id: "wall", kind: "rect", x: 4, z: 0, width: 2, depth: 8 }]
    }),
    { x: 0, z: 0, facing: 1, blocked: true }
  );
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
  const player = makePlayer({ money: 1200, gear: "starter_blaster", ...getTeamSpawn("blue") });
  const gear = GEAR_ITEMS.find((item) => item.id === "quick_blaster")!;

  assert.deepEqual(resolveGearPurchase({ player, gear }), {
    ok: true,
    alreadyEquipped: false,
    nextMoney: 0,
    nextHealth: player.health,
    gearChanged: true
  });
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
  assert.equal(getGearFireCooldownMs("quick_blaster") < getGearFireCooldownMs("starter_blaster"), true);
  assert.equal(getGearFireCooldownMs("power_blaster") > getGearFireCooldownMs("starter_blaster"), true);
  assert.equal(getGearFireCooldownMs("starter_blaster") <= 220, true);
  assert.equal(getGearFireCooldownMs("quick_blaster"), QUICK_BLASTER_COOLDOWN_MS);
  assert.equal(getGearFireCooldownMs("quick_blaster") > 95, true);
  assert.equal(isGearAutoFireEnabled("quick_blaster"), true);
  assert.equal(isGearAutoFireEnabled("starter_blaster"), false);
  assert.equal(getGearDamage("starter_blaster"), 15);
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
      "Session Code,Student,Team,Correct,Wrong,Accuracy %,Current Money,Quiz Money,Score",
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

test("clampArenaPosition preserves the large classroom arena footprint", () => {
  assert.deepEqual(clampArenaPosition({ x: 999, z: -999, facing: 1.25 }), { x: ARENA_LIMIT_X, z: -ARENA_LIMIT_Z, facing: 1.25 });
  assert.deepEqual(clampArenaPosition({ x: -999, z: 999, facing: Number.NaN }), { x: -ARENA_LIMIT_X, z: ARENA_LIMIT_Z, facing: 0 });
});

test("Desert Citadel provides enough protected team and free-for-all spawns", () => {
  assert.equal(TEAM_SPAWNS.blue.length, 24);
  assert.equal(TEAM_SPAWNS.red.length, 24);
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
      maxSpeed: 1
    });
    return firstStep.blocked ? [`${group}:${spawn.id}`] : [];
  });

  assert.deepEqual(blocked, []);
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
    moneyAwarded: 100,
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

  const captured = resolveFlagCapture(placed, blue);
  assert.equal(captured.state, "captured");
  assert.equal(captured.capturedById, "blue");

  const dropped = resolveFlagDropForPlayer(carried, red, { x: 5, z: 6 });
  assert.equal(dropped.state, "dropped");
  assert.deepEqual(dropped.position, { x: 5, z: 6 });
});

test("zombie mode selects initial zombies and converts humans once", () => {
  const players = Array.from({ length: 8 }, (_, index) => makePlayer({ id: `p-${index}`, team: "blue", role: "human" }));
  assert.equal(getDefaultInitialZombieCount(2), 1);
  assert.equal(getDefaultInitialZombieCount(8), 2);

  const selected = selectInitialZombies(players, undefined, 3);
  assert.equal(selected.filter((player) => player.role === "zombie").length, 2);
  assert.equal(selected.filter((player) => player.role === "human").length, 6);
  assert.equal(selected.find((player) => player.role === "zombie")?.gear, "starter_blaster");

  const zombie = makePlayer({ id: "zombie", team: "red", role: "zombie", gear: "starter_blaster", isAlive: true });
  const human = makePlayer({ id: "human", team: "blue", role: "human", isAlive: true, respawns: 0 });
  const conversion = resolveZombieConversion({ attacker: zombie, target: human });
  assert.equal(conversion.ok, true);
  if (conversion.ok) {
    assert.equal(conversion.player.role, "zombie");
    assert.equal(conversion.player.team, "red");
    assert.equal(conversion.player.respawns, 1);
    assert.equal(conversion.player.gear, "starter_blaster");
  }
  assert.deepEqual(resolveZombieConversion({ attacker: zombie, target: { ...human, role: "zombie" } }), {
    ok: false,
    reason: "target_not_human"
  });
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
