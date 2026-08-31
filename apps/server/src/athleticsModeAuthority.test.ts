import test from "node:test";
import assert from "node:assert/strict";
import {
  createAthleticsModeRoundState,
  createAuthoritativeChaosWave,
  getAthleticsMode,
  getAthleticsModeIntro,
  getHunterStation,
  getZeusTargetPlan,
  resolveHunterHitsForRound,
  resolveChaosHit,
  resolveHunterQuiz,
  resolveRunnerQuiz,
  resolveZeusHit
} from "./athleticsModeAuthority.js";

const playerIds = Array.from({ length: 10 }, (_, index) => `student-${index}`);
const nowMs = Date.parse("2026-08-31T00:00:00.000Z");

test("server mode state defaults safely and creates deterministic round state", () => {
  assert.equal(getAthleticsMode(undefined), "classic");
  assert.equal(getAthleticsMode("not-a-mode"), "classic");
  assert.equal(getAthleticsModeIntro("zeus").title, "ZEUS MODE");
  assert.equal(getAthleticsModeIntro("hunters-runners").message, "RUN OR HUNT");
  assert.equal(getAthleticsModeIntro("chaos-climb").title, "CHAOS CLIMB");

  const classic = createAthleticsModeRoundState({ sessionId: "session-1", playerIds, mode: undefined, nowMs });
  assert.equal(classic.mode, "classic");
  assert.equal(classic.modeRoundsTotal, 1);
  assert.equal(classic.runnerIds.length, playerIds.length);
  assert.equal(classic.hunterIds.length, 0);
  assert.equal(classic.zeus, undefined);
  assert.equal(classic.chaos, undefined);

  const zeus = createAthleticsModeRoundState({ sessionId: "session-1", playerIds, mode: "zeus", nowMs });
  assert.equal(zeus.zeus?.phase, "idle");
  assert.equal(zeus.zeus?.attackIndex, 0);

  const chaos = createAthleticsModeRoundState({ sessionId: "session-1", playerIds, mode: "chaos-climb", nowMs });
  assert.equal(chaos.chaos?.seed, chaos.modeSeed);
  assert.equal(chaos.chaos?.activeHazards.length, 0);
  assert.equal(chaos.chaos?.nextWaveAt, new Date(nowMs + 2_800).toISOString());
});

test("server keeps Hunters & Runners balanced and changes the defender group", () => {
  const first = createAthleticsModeRoundState({ sessionId: "session-2", playerIds, mode: "hunters-runners", round: 1, nowMs });
  const second = createAthleticsModeRoundState({ sessionId: "session-2", playerIds, mode: "hunters-runners", round: 2, nowMs });
  assert.equal(first.modeRoundsTotal, 2);
  assert.equal(first.hunterIds.length, 3);
  assert.equal(second.hunterIds.length, 3);
  assert.equal(second.rolesSwapped, true);
  assert.ok(first.hunterIds.every((id) => second.roles[id] === "runner"));
  assert.ok(second.hunterIds.every((id) => first.roles[id] === "runner"));
  assert.equal(getHunterStation(0, first.hunterIds.length).radius, 7);
  assert.ok(getHunterStation(2, first.hunterIds.length).progress > getHunterStation(0, first.hunterIds.length).progress);
  assert.equal(resolveHunterHitsForRound({ role: "hunter", round: 1, previousHits: 9 }), 0);
  assert.equal(resolveHunterHitsForRound({ role: "runner", round: 2, previousHits: 4 }), 4);
  assert.equal(resolveHunterHitsForRound({ role: "hunter", round: 2 }), 0);
});

test("server authority wrappers preserve the shared resource and impact rules", () => {
  assert.deepEqual(resolveHunterQuiz({ isCorrect: true, ammo: 0, streak: 0 }), { ammo: 3, streak: 1, bonusAmmo: 0 });
  assert.deepEqual(resolveRunnerQuiz({ isCorrect: true, charge: 2 }), { charge: 3, abilityReady: "shield" });
  assert.equal(resolveZeusHit({ targetPosition: { x: 0, z: 0 }, warningPosition: { x: 1, z: 0 }, radius: 2 }).hit, true);
  assert.equal(resolveChaosHit({
    hazard: { radius: 1, knockback: 3 },
    playerPosition: { x: 0, z: 0 },
    hazardPosition: { x: 0, z: 0 },
    shieldCharges: 1
  }).shielded, true);
});

test("server Zeus plans and Chaos waves are deterministic", () => {
  const candidates = playerIds.slice(0, 4).map((id, index) => ({ id, routeProgress: index / 4, x: index, y: 4, z: index * 2 }));
  const plan = getZeusTargetPlan({ candidates, attackIndex: 4, recentTargetIds: [], highestProgress: 0.7 });
  assert.equal(plan.profile.tier, "upper");
  assert.equal(plan.targets.length, 2);
  assert.deepEqual(plan.targets, getZeusTargetPlan({ candidates, attackIndex: 4, recentTargetIds: [], highestProgress: 0.7 }).targets);

  const first = createAuthoritativeChaosWave({ seed: 99, waveIndex: 4, nowMs, activeHazardCount: 0, playerCount: playerIds.length });
  const repeat = createAuthoritativeChaosWave({ seed: 99, waveIndex: 4, nowMs, activeHazardCount: 0, playerCount: playerIds.length });
  assert.deepEqual(first, repeat);
  assert.ok(first.event?.label);
  assert.ok(first.hazards.length > 0);
});
