import test from "node:test";
import assert from "node:assert/strict";
import {
  ATHLETICS_CHECKPOINT_COUNT,
  ATHLETICS_CORRECT_ENERGY,
  ATHLETICS_MAX_ENERGY,
  ATHLETICS_STADIUM_COURSE,
  awardAthleticsEnergy,
  getAthleticsQuestionPoolIndex,
  getAthleticsQuestionsPerLap,
  getAthleticsTotalQuestionCount,
  getAthleticsCheckpointProgress,
  getAthleticsNextGateProgress,
  getAthleticsPointAtProgress,
  getAthleticsRespawnPosition,
  getAthleticsRouteProgress,
  getAthleticsStartPosition,
  isAthleticsFinish,
  isAthleticsCourseFinish,
  isAthleticsOnRoute,
  resolveAthleticsMovementEnergy,
  resolveAthleticsStandings
} from "./athleticsRace.js";
import { ATHLETICS_ARENA_MAP_ID, resolveAnswerReward, sanitizeSessionSettings } from "./index.js";

test("Skyline Adventure Park exposes a large vertical route and independent checkpoints", () => {
  assert.equal(ATHLETICS_STADIUM_COURSE.id, "stadium_loop");
  assert.equal(ATHLETICS_STADIUM_COURSE.sections.length, 10);
  assert.equal(ATHLETICS_STADIUM_COURSE.checkpoints.length, ATHLETICS_CHECKPOINT_COUNT);
  assert.ok(ATHLETICS_STADIUM_COURSE.route.at(-1)!.y > ATHLETICS_STADIUM_COURSE.route[0]!.y);
  assert.ok(ATHLETICS_STADIUM_COURSE.surfaces.length >= 90);
  assert.ok(ATHLETICS_STADIUM_COURSE.movingObstacles.length >= 5);
  assert.equal(getAthleticsCheckpointProgress(0, 7), 0);
  assert.equal(getAthleticsCheckpointProgress(7, 7), 1);
  assert.equal(getAthleticsNextGateProgress({ questionIndex: 0, checkpointIndex: 0 }, 7), 1 / 7);
  assert.equal(getAthleticsNextGateProgress({ questionIndex: 1, checkpointIndex: 0 }, 7), 1 / 7);
  assert.equal(getAthleticsNextGateProgress({ questionIndex: 1, checkpointIndex: 1 }, 7), 2 / 7);
  assert.equal(getAthleticsNextGateProgress({ questionIndex: 7, checkpointIndex: 6 }, 7), 1);
});

test("route projection is monotonic for authored points and rejects off-course shortcuts", () => {
  const progressSamples = [0, 0.14, 0.28, 0.43, 0.58, 0.72, 0.84, 1].map((progress) => {
    const point = getAthleticsPointAtProgress(progress);
    return getAthleticsRouteProgress(point);
  });
  progressSamples.forEach((progress, index) => {
    assert.ok(progress >= (progressSamples[index - 1] ?? 0) - 0.001);
  });
  assert.ok(isAthleticsOnRoute(getAthleticsPointAtProgress(0.6)));
  assert.equal(isAthleticsOnRoute({ x: 220, z: 220 }), false);
  const summitApproach = getAthleticsPointAtProgress(0.96);
  assert.equal(isAthleticsOnRoute({ ...summitApproach, y: summitApproach.y + 4.21 }), true);
  assert.equal(isAthleticsOnRoute({ ...summitApproach, y: 0 }), false);
});

test("start lanes stay on the route and respawns land just behind the last safe checkpoint", () => {
  const left = getAthleticsStartPosition(0, 3);
  const right = getAthleticsStartPosition(2, 3);
  assert.notEqual(`${left.x}:${left.z}`, `${right.x}:${right.z}`);
  assert.ok(isAthleticsOnRoute(left));
  assert.ok(isAthleticsOnRoute(right));

  const respawn = getAthleticsRespawnPosition(3, 7, 1);
  assert.ok(isAthleticsOnRoute(respawn));
  assert.ok(getAthleticsRouteProgress(respawn) < getAthleticsCheckpointProgress(3, 7));
  assert.ok(getAthleticsRouteProgress(respawn) > getAthleticsCheckpointProgress(2, 7));
});

test("forty-player Athletics starts never overlap", () => {
  const starts = Array.from({ length: 40 }, (_, index) => getAthleticsStartPosition(index, 40));
  assert.equal(new Set(starts.map((start) => `${start.x.toFixed(3)}:${start.z.toFixed(3)}`)).size, 40);
  starts.forEach((start) => assert.ok(isAthleticsOnRoute(start)));
});

test("finish is earned by reaching the summit, while the legacy predicate remains compatible", () => {
  assert.equal(isAthleticsCourseFinish(getAthleticsPointAtProgress(0.99)), true);
  assert.equal(isAthleticsCourseFinish(getAthleticsPointAtProgress(0.8)), false);
  assert.equal(isAthleticsFinish(getAthleticsPointAtProgress(0.99), 6, 7), false);
  assert.equal(isAthleticsFinish(getAthleticsPointAtProgress(0.99), 7, 7), true);
});

test("Athletics answers refill movement energy and movement/jumps spend it", () => {
  assert.equal(awardAthleticsEnergy({ isCorrect: true, currentEnergy: 0 }), ATHLETICS_CORRECT_ENERGY);
  assert.equal(awardAthleticsEnergy({ isCorrect: false, currentEnergy: 420 }), 420);
  assert.equal(awardAthleticsEnergy({ isCorrect: true, currentEnergy: ATHLETICS_MAX_ENERGY }), ATHLETICS_MAX_ENERGY);
  const resolution = resolveAthleticsMovementEnergy({
    currentEnergy: 300,
    elapsedMs: 500,
    movedDistance: 6,
    sprinting: true,
    jumped: true
  });
  assert.equal(resolution.canMove, true);
  assert.equal(resolution.jumpCost > 0, true);
  assert.ok(resolution.nextEnergy < 300);
  assert.equal(resolveAthleticsMovementEnergy({ currentEnergy: 0, elapsedMs: 500, movedDistance: 0, sprinting: false, jumped: false }).canMove, false);
});

test("standings order finishers first, then active progress, then DNF", () => {
  const makeAthletics = (overrides: Partial<NonNullable<Parameters<typeof resolveAthleticsStandings>[0][number]["athletics"]>>) => ({
    questionIndex: 2,
    checkpointIndex: 1,
    routeProgress: 0.4,
    gateOpen: true,
    falls: 0,
    lastSafeCheckpointIndex: 1,
    checkpointSplitsMs: [],
    completedLaps: 0,
    lapSplitsMs: [],
    status: "racing" as const,
    ...overrides
  });
  const standings = resolveAthleticsStandings([
    { id: "racing-a", isBot: false, connectionState: "connected", athletics: makeAthletics({ routeProgress: 0.55 }) },
    { id: "finished-slow", isBot: false, connectionState: "connected", athletics: makeAthletics({ status: "finished", finishTimeMs: 12_000 }) },
    { id: "dnf", isBot: false, connectionState: "connected", athletics: makeAthletics({ status: "dnf" }) },
    { id: "finished-fast", isBot: false, connectionState: "connected", athletics: makeAthletics({ status: "finished", finishTimeMs: 9_000 }) },
    { id: "racing-b", isBot: false, connectionState: "connected", athletics: makeAthletics({ routeProgress: 0.3 }) }
  ]);
  assert.deepEqual(standings.map((standing) => standing.playerId), ["finished-fast", "finished-slow", "racing-a", "racing-b", "dnf"]);
  assert.deepEqual(standings.map((standing) => standing.rank), [1, 2, 3, 4, 5]);
});

test("standings rank completed laps ahead of physical progress within an earlier lap", () => {
  const makeAthletics = (completedLaps: number, checkpointIndex: number, routeProgress: number) => ({
    questionIndex: completedLaps * 8 + checkpointIndex,
    checkpointIndex,
    routeProgress,
    gateOpen: true,
    falls: 0,
    lastSafeCheckpointIndex: checkpointIndex,
    checkpointSplitsMs: [],
    completedLaps,
    lapSplitsMs: [],
    status: "racing" as const
  });
  const standings = resolveAthleticsStandings([
    { id: "lap-two", athletics: makeAthletics(1, 1, 0.1) },
    { id: "lap-one", athletics: makeAthletics(0, 7, 0.98) }
  ]);
  assert.deepEqual(standings.map((standing) => standing.playerId), ["lap-two", "lap-one"]);
});

test("multi-lap questions distribute then cycle predictably without soft-locking", () => {
  assert.equal(getAthleticsQuestionsPerLap(24, 3), 8);
  assert.equal(getAthleticsTotalQuestionCount(24, 3), 24);
  assert.equal(getAthleticsQuestionsPerLap(5, 3), 2);
  assert.equal(getAthleticsTotalQuestionCount(5, 3), 6);
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => getAthleticsQuestionPoolIndex(index, 5)), [0, 1, 2, 3, 4, 0]);
});

test("Course Laps defaults safely and rejects out-of-range or non-integer input", () => {
  const athleticsSettings = sanitizeSessionSettings({ gameMode: "athletics", mapId: "iron_junction" });
  assert.equal(athleticsSettings.mapId, ATHLETICS_ARENA_MAP_ID);
  assert.equal(athleticsSettings.athleticsCourseLaps, 1);
  assert.equal(sanitizeSessionSettings({ gameMode: "athletics", athleticsCourseLaps: 2 }).athleticsCourseLaps, 2);
  assert.equal(sanitizeSessionSettings({ gameMode: "athletics", athleticsCourseLaps: 10 }).athleticsCourseLaps, 10);
  assert.equal(sanitizeSessionSettings({ gameMode: "classic", mapId: ATHLETICS_ARENA_MAP_ID }).mapId, "desert_citadel");
  for (const value of [0, -1, 11, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(sanitizeSessionSettings({ gameMode: "athletics", athleticsCourseLaps: value }).athleticsCourseLaps, 1);
  }
});

test("Athletics answers never award combat money or score", () => {
  const settings = sanitizeSessionSettings({ gameMode: "athletics" });
  const player = { money: 999, isAlive: true };
  assert.deepEqual(resolveAnswerReward({ player, settings, isCorrect: true }), {
    moneyAwarded: 0,
    nextMoney: 999,
    scoreDelta: 0,
    correctDelta: 1,
    wrongDelta: 0
  });
  assert.deepEqual(resolveAnswerReward({ player, settings, isCorrect: false }), {
    moneyAwarded: 0,
    nextMoney: 999,
    scoreDelta: 0,
    correctDelta: 0,
    wrongDelta: 1
  });
});
