import test from "node:test";
import assert from "node:assert/strict";
import {
  ATHLETICS_MODES,
  CHAOS_HAZARD_LIMIT,
  CHAOS_HAZARD_WARNING_MS,
  isCpuHunterThreatAhead,
  createChaosWave,
  getAthleticsModeConfig,
  getAthleticsModeSeed,
  getChaosEventForWave,
  getChaosEventModifiers,
  getChaosHazardPosition,
  getHunterCount,
  resolveChaosHazardImpact,
  resolveHunterQuizReward,
  resolveRunnerQuizReward,
  resolveZeusAnswer,
  resolveZeusStrike,
  consumeRunnerAbility,
  assignHuntersAndRunners,
  getZeusAttackProfile,
  getZeusAttackTier,
  selectZeusTargets
} from "./athleticsModes.js";
import { buildCsvReport, type SessionReport } from "./index.js";

test("Athletics mode selection is additive and legacy values resolve to Classic", () => {
  assert.deepEqual([...ATHLETICS_MODES], ["classic", "zeus", "hunters-runners", "chaos-climb"]);
  assert.equal(getAthleticsModeConfig(undefined).id, "classic");
  assert.equal(getAthleticsModeConfig("unknown").id, "classic");
  assert.equal(getAthleticsModeConfig("zeus").shortLabel, "Zeus");
  assert.equal(getAthleticsModeSeed("room-1", 1, "zeus"), getAthleticsModeSeed("room-1", 1, "zeus"));
  assert.notEqual(getAthleticsModeSeed("room-1", 1, "zeus"), getAthleticsModeSeed("room-1", 1, "chaos-climb"));
});

test("Hunters & Runners keeps a classroom-sized hunter share and deterministic role changes", () => {
  assert.equal(getHunterCount(0), 0);
  assert.equal(getHunterCount(1), 0);
  assert.equal(getHunterCount(4), 1);
  assert.equal(getHunterCount(10), 3);
  assert.equal(getHunterCount(30), 8);

  const playerIds = Array.from({ length: 30 }, (_, index) => `player-${index}`);
  const firstRound = assignHuntersAndRunners(playerIds, 1);
  const secondRound = assignHuntersAndRunners(playerIds, 2);
  const firstHunters = playerIds.filter((id) => firstRound[id] === "hunter");
  const secondHunters = playerIds.filter((id) => secondRound[id] === "hunter");
  assert.equal(firstHunters.length, 8);
  assert.equal(secondHunters.length, 8);
  assert.deepEqual(firstHunters.filter((id) => secondRound[id] === "hunter"), []);
  assert.deepEqual(assignHuntersAndRunners(playerIds, 1), firstRound);
});

test("Answer-powered Hunter ammo and Runner abilities are bounded", () => {
  assert.deepEqual(resolveHunterQuizReward({ isCorrect: true, currentAmmo: 0, currentStreak: 0 }), { ammo: 3, streak: 1, bonusAmmo: 0 });
  assert.deepEqual(resolveHunterQuizReward({ isCorrect: true, currentAmmo: 3, currentStreak: 2 }), { ammo: 8, streak: 3, bonusAmmo: 2 });
  assert.deepEqual(resolveHunterQuizReward({ isCorrect: false, currentAmmo: 8, currentStreak: 3 }), { ammo: 8, streak: 0, bonusAmmo: 0 });
  assert.deepEqual(resolveHunterQuizReward({ isCorrect: true, currentAmmo: 12, currentStreak: 20 }), { ammo: 12, streak: 21, bonusAmmo: 2 });

  assert.deepEqual(resolveRunnerQuizReward({ isCorrect: true, currentCharge: 2 }), { charge: 3, abilityReady: "shield" });
  assert.deepEqual(resolveRunnerQuizReward({ isCorrect: false, currentCharge: 2, currentAbility: "dash" }), { charge: 2, abilityReady: "dash" });
  assert.deepEqual(consumeRunnerAbility({ ability: "shield", charge: 3 }), { ok: true, charge: 0, ability: "dash" });
  assert.equal(consumeRunnerAbility({ ability: "shield", charge: 2 }).ok, false);
});

test("Zeus attack tiers escalate, select targets deterministically, and resolve dodge/freeze rules", () => {
  assert.equal(getZeusAttackTier(0.1), "lower");
  assert.equal(getZeusAttackTier(0.4), "middle");
  assert.equal(getZeusAttackTier(0.7), "upper");
  assert.equal(getZeusAttackTier(0.9), "rage");
  assert.ok(getZeusAttackProfile(0.9, 8).warningDurationMs < getZeusAttackProfile(0.1, 8).warningDurationMs);
  assert.ok(getZeusAttackProfile(0.9, 8).cooldownMs < getZeusAttackProfile(0.1, 8).cooldownMs);

  const candidates = [
    { id: "a", routeProgress: 0.4, x: 0, y: 4, z: 0 },
    { id: "b", routeProgress: 0.5, x: 4, y: 4, z: 0 },
    { id: "c", routeProgress: 0.6, x: 8, y: 4, z: 0 }
  ];
  const selected = selectZeusTargets({ candidates, attackIndex: 3, targetCount: 1, recentTargetIds: ["a"] });
  assert.equal(selected.length, 1);
  assert.notEqual(selected[0]?.id, "a");
  assert.deepEqual(selectZeusTargets({ candidates, attackIndex: 3, targetCount: 2 }), selectZeusTargets({ candidates, attackIndex: 3, targetCount: 2 }));
  assert.equal(resolveZeusStrike({ targetPosition: { x: 1, z: 1 }, warningPosition: { x: 0, z: 0 }, radius: 2 }).hit, true);
  assert.equal(resolveZeusStrike({ targetPosition: { x: 3, z: 3 }, warningPosition: { x: 0, z: 0 }, radius: 2 }).hit, false);
  assert.equal(resolveZeusAnswer({ isCorrect: true, nowMs: 10_000 }).released, true);
  assert.equal(resolveZeusAnswer({ isCorrect: false, nowMs: 10_000 }).frozen, true);
});

test("Chaos waves are seeded, path-bound, capped, and resolve shielded impacts", () => {
  const nowMs = Date.parse("2026-08-31T00:00:00.000Z");
  const first = createChaosWave({ seed: 12345, waveIndex: 4, nowMs, playerCount: 30 });
  const repeat = createChaosWave({ seed: 12345, waveIndex: 4, nowMs, playerCount: 30 });
  assert.deepEqual(first, repeat);
  assert.ok(first.length > 0);
  assert.ok(first.length <= CHAOS_HAZARD_LIMIT);
  assert.equal(new Set(first.map((hazard) => hazard.id)).size, first.length);
  assert.ok(first.every((hazard) => hazard.startProgress >= 0 && hazard.startProgress <= 1 && hazard.endProgress >= 0 && hazard.endProgress <= 1));
  assert.equal(createChaosWave({ seed: 12345, waveIndex: 4, nowMs, eventType: "giant-ball" })[0]?.kind, "giant-ball");
  assert.ok(createChaosWave({ seed: 12345, waveIndex: 4, nowMs, eventType: "object-stampede" }).length >= 2);
  assert.equal(createChaosWave({ seed: 12345, waveIndex: 4, nowMs, activeHazardCount: CHAOS_HAZARD_LIMIT, playerCount: 30 }).length, 0);
  assert.equal(getChaosEventForWave({ seed: 12345, waveIndex: 3, nowMs }), undefined);
  assert.ok(getChaosEventForWave({ seed: 12345, waveIndex: 4, nowMs })?.label);

  const route = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 0 }, { x: 20, y: 20, z: 0 }];
  const position = getChaosHazardPosition(first[0]!, route, nowMs);
  assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z));
  assert.equal(resolveChaosHazardImpact({
    hazard: { radius: 2, knockback: 4 },
    playerPosition: { x: 0, z: 0 },
    hazardPosition: { x: 1, z: 1 },
    shieldCharges: 1
  }).shielded, true);
  assert.equal(resolveChaosHazardImpact({
    hazard: { radius: 2, knockback: 4 },
    playerPosition: { x: 0, z: 0 },
    hazardPosition: { x: 1, z: 1 },
    shieldCharges: 0
  }).knockback, 4);
  assert.equal(resolveChaosHazardImpact({
    hazard: { radius: 2, knockback: 4 },
    playerPosition: { x: 0, y: 24, z: 0 },
    hazardPosition: { x: 1, y: 1, z: 1 },
    shieldCharges: 0
  }).hit, false, "hazards on another vertical course level must not collide");
  assert.equal(getChaosEventModifiers("speed-round").hazardSpeedMultiplier, 1.35);
  assert.ok(getChaosHazardPosition(first[0]!, route, nowMs + 250, 1.35).progress >= getChaosHazardPosition(first[0]!, route, nowMs + 250).progress);
  assert.equal(getChaosEventModifiers("low-gravity").jumpHeightCap, 7.2);
  assert.equal(getChaosEventModifiers("wind-gust").knockbackMultiplier, 1.15);
});

test("Zeus allows normal jumps but cannot strike another course storey", () => {
  const warningPosition = { x: 0, y: 20, z: 0 };
  assert.equal(resolveZeusStrike({ targetPosition: { x: 0, y: 23.4, z: 0 }, warningPosition, radius: 3 }).hit, true);
  assert.equal(resolveZeusStrike({ targetPosition: { x: 0, y: 40, z: 0 }, warningPosition, radius: 3 }).hit, false);
  assert.ok(getZeusAttackProfile(1, 30).warningDurationMs >= 1600);
});

test("Chaos telegraphs precede locally bounded travel and use course distance", () => {
  const nowMs = 10_000;
  for (let waveIndex = 1; waveIndex <= 20; waveIndex += 1) {
    for (const [index, hazard] of createChaosWave({ seed: 123, waveIndex, nowMs, playerCount: 40 }).entries()) {
      assert.equal(Date.parse(hazard.spawnAt) - nowMs, CHAOS_HAZARD_WARNING_MS + index * 900);
      assert.ok(hazard.startProgress > hazard.endProgress, "all props approach against race direction");
      assert.ok(Date.parse(hazard.expiresAt) - Date.parse(hazard.spawnAt) >= 4500);
      assert.ok(Math.abs(hazard.endProgress - hazard.startProgress) <= 0.071);
      assert.equal(getChaosHazardPosition(hazard, [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }], nowMs).progress, 0);
    }
  }
  const hazard = { startProgress: .5, endProgress: 1, laneOffset: 0, spawnAt: new Date(0).toISOString(), expiresAt: new Date(1000).toISOString() };
  // Unequal segments must project at x=50, rather than the middle vertex x=10.
  const route = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }];
  assert.equal(getChaosHazardPosition(hazard, route, 0).x, 50);
  assert.equal(getChaosHazardPosition({ ...hazard, laneOffset: 2 }, route, 1000).z, 2);
  assert.equal(getChaosEventModifiers("wind-gust").movementSpeedMultiplier, 1);
});

test("CPU Hunter attacks come from the front, at readable range and the same storey", () => {
  const runner = { x: 0, y: 4.21, z: 0, facing: 0 };
  assert.equal(isCpuHunterThreatAhead({ x: 0, y: 4.21, z: -20 }, runner), true);
  assert.equal(isCpuHunterThreatAhead({ x: 0, y: 4.21, z: 20 }, runner), false);
  assert.equal(isCpuHunterThreatAhead({ x: 20, y: 4.21, z: 0 }, runner), false);
  assert.equal(isCpuHunterThreatAhead({ x: 0, y: 24.21, z: -20 }, runner), false);
  assert.equal(isCpuHunterThreatAhead({ x: 0, y: 4.21, z: -5 }, runner), false);
  assert.equal(isCpuHunterThreatAhead({ x: 0, y: 4.21, z: -60 }, runner), false);
  assert.equal(isCpuHunterThreatAhead({ x: -20, y: 4.21, z: 0 }, { ...runner, facing: Math.PI / 2 }), true);
});

test("every Chaos prop can be jumped over and sped-up waves have fixed launch timing", () => {
  const normal = createChaosWave({ seed: 123, waveIndex: 4, nowMs: 0, playerCount: 30 });
  const fast = createChaosWave({ seed: 123, waveIndex: 4, nowMs: 0, playerCount: 30, eventType: "speed-round" });
  normal.forEach((hazard, index) => {
    const groundY = hazard.kind === "giant-ball" ? hazard.radius : 1.1;
    assert.equal(resolveChaosHazardImpact({ hazard, playerPosition: { x: 0, y: 4.21 + 4.5, z: 0 }, hazardPosition: { x: 0, y: groundY, z: 0 } }).hit, false);
    assert.equal(hazard.spawnAt, fast[index]!.spawnAt);
    assert.ok(Date.parse(fast[index]!.expiresAt) < Date.parse(hazard.expiresAt));
  });
});

test("non-Classic Athletics reports export mode-specific results", () => {
  const report = {
    session: { sessionCode: "ATHLETICS", settings: { gameMode: "athletics", athleticsMode: "hunters-runners" } },
    rows: [{
      nickname: "Runner",
      team: "blue",
      correctAnswers: 4,
      wrongAnswers: 1,
      accuracy: 80,
      money: 0,
      quizMoney: 0,
      score: 12,
      racePlace: 1,
        raceStatus: "hunter",
      raceFalls: 0,
      raceCheckpoint: 6,
      raceLapsCompleted: 1,
      raceLapsRequired: 1,
      athleticsMode: "hunters-runners",
      athleticsRole: "hunter",
      athleticsHunterHits: 4
    }],
    missedQuestions: []
  } as unknown as SessionReport;
  const csv = buildCsvReport(report);
  assert.match(csv, /Athletics Mode,Role,Hunter Hits,Score/);
  assert.match(csv, /hunters-runners,hunter,4,12/);
});
