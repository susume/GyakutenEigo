import test from "node:test";
import assert from "node:assert/strict";
import {
  ATHLETICS_CHECKPOINT_COUNT,
  ATHLETICS_COLLISION_PROXIES,
  ATHLETICS_COURSE_BOUNDS,
  ATHLETICS_CORRECT_ENERGY,
  ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS,
  ATHLETICS_PLAYER_EYE_HEIGHT,
  ATHLETICS_MAX_ENERGY,
  ATHLETICS_STADIUM_COURSE,
  awardAthleticsEnergy,
  getAthleticsObstacles,
  getAthleticsQuestionPoolIndex,
  getAthleticsQuestionsPerLap,
  getAthleticsTotalQuestionCount,
  getAthleticsCheckpointProgress,
  getAthleticsCheckpointRouteProgress,
  getAthleticsNextGateProgress,
  getAthleticsPointAtProgress,
  getAthleticsMovingObstaclePosition,
  getAthleticsRespawnPosition,
  getAthleticsRouteProgress,
  getAthleticsRouteLength,
  getAthleticsRouteTangent,
  getAthleticsStartPosition,
  isAthleticsFinish,
  isAthleticsBelowRecoverableRoute,
  isAthleticsCourseFinish,
  isAthleticsOnRoute,
  resolveAthleticsMovementEnergy,
  resolveAthleticsStandings
} from "./athleticsRace.js";
import { ATHLETICS_ARENA_MAP_ID, resolveAnswerReward, resolveAuthoritativeMovement, sanitizeSessionSettings } from "./index.js";

test("Skyline Adventure Park exposes a compact authored vertical route", () => {
  assert.equal(ATHLETICS_STADIUM_COURSE.id, "stadium_loop");
  assert.equal(ATHLETICS_STADIUM_COURSE.sections.length, 6);
  assert.equal(ATHLETICS_STADIUM_COURSE.checkpoints.length, ATHLETICS_CHECKPOINT_COUNT);
  assert.ok(ATHLETICS_STADIUM_COURSE.route.at(-1)!.y > ATHLETICS_STADIUM_COURSE.route[0]!.y);
  assert.equal(ATHLETICS_STADIUM_COURSE.route.length, 65);
  assert.ok(getAthleticsRouteLength() >= 1100 && getAthleticsRouteLength() <= 1400);
  assert.ok(ATHLETICS_STADIUM_COURSE.surfaces.length >= 60 && ATHLETICS_STADIUM_COURSE.surfaces.length <= 80);
  assert.equal(ATHLETICS_STADIUM_COURSE.shortcuts.length, 3);
  assert.equal(ATHLETICS_STADIUM_COURSE.movingObstacles.length, 6);
  for (const point of ATHLETICS_STADIUM_COURSE.route) {
    assert.ok(Math.abs(point.x) <= ATHLETICS_COURSE_BOUNDS.limitX);
    assert.ok(Math.abs(point.z) <= ATHLETICS_COURSE_BOUNDS.limitZ);
  }
  ATHLETICS_STADIUM_COURSE.checkpoints.forEach((progress, index, checkpoints) => {
    assert.ok(progress > (checkpoints[index - 1] ?? -1));
    assert.equal(progress, getAthleticsCheckpointRouteProgress(index + 1));
  });
  for (const shortcut of ATHLETICS_STADIUM_COURSE.shortcuts) {
    assert.ok(shortcut.startProgress < shortcut.endProgress);
    assert.ok(shortcut.surfaces.length >= 1 && shortcut.surfaces.length <= 4);
  }
  assert.equal(ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS, 270);
  assert.equal(getAthleticsCheckpointProgress(0, 7), 0);
  assert.equal(getAthleticsCheckpointProgress(7, 7), 1);
  assert.equal(getAthleticsNextGateProgress({ questionIndex: 0, checkpointIndex: 0 }, 7), 1 / 7);
  assert.equal(getAthleticsNextGateProgress({ questionIndex: 1, checkpointIndex: 0 }, 7), 1 / 7);
  assert.equal(getAthleticsNextGateProgress({ questionIndex: 1, checkpointIndex: 1 }, 7), 2 / 7);
  assert.equal(getAthleticsNextGateProgress({ questionIndex: 7, checkpointIndex: 6 }, 7), 1);
});

test("Athletics ground spawn can move out from underneath elevated switchbacks", () => {
  const start = getAthleticsStartPosition(0, 1);
  const tangent = getAthleticsRouteTangent(0);
  const directions = [
    ["forward", tangent.x, tangent.z],
    ["back", -tangent.x, -tangent.z],
    ["right", -tangent.z, tangent.x],
    ["left", tangent.z, -tangent.x]
  ] as const;

  for (const [label, x, z] of directions) {
    const result = resolveAuthoritativeMovement({
      current: start,
      requested: { x: start.x + x * 2, y: start.y, z: start.z + z * 2, facing: start.facing },
      elapsedMs: 200,
      maxSpeed: 22,
      obstacles: getAthleticsObstacles(),
      groundY: 0,
      eyeHeight: ATHLETICS_PLAYER_EYE_HEIGHT,
      mapId: ATHLETICS_ARENA_MAP_ID
    });

    assert.notEqual(`${result.x}:${result.z}`, `${start.x}:${start.z}`, `${label} movement should not be blocked at the ground spawn`);
  }
});

test("Athletics recovers racers stranded below a raised route", () => {
  const raisedProgress = 0.1;
  const routePoint = getAthleticsPointAtProgress(raisedProgress);
  assert.ok(routePoint.y > 2);
  assert.equal(isAthleticsBelowRecoverableRoute({ y: ATHLETICS_PLAYER_EYE_HEIGHT }, raisedProgress), true);
  assert.equal(isAthleticsBelowRecoverableRoute({ y: routePoint.y + ATHLETICS_PLAYER_EYE_HEIGHT }, raisedProgress), false);
  assert.equal(isAthleticsBelowRecoverableRoute({ y: routePoint.y + ATHLETICS_PLAYER_EYE_HEIGHT - 1.5 }, raisedProgress), false);
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

test("authored shortcuts and moving platforms remain collision-backed and route-bounded", () => {
  const shortcut = ATHLETICS_STADIUM_COURSE.shortcuts[1]!;
  const shortcutPoint = shortcut.route[2]!;
  const shortcutProgress = getAthleticsRouteProgress(shortcutPoint);
  assert.ok(shortcutProgress >= shortcut.startProgress && shortcutProgress <= shortcut.endProgress);
  assert.ok(isAthleticsOnRoute(shortcutPoint));
  assert.equal(isAthleticsOnRoute({ ...shortcutPoint, y: shortcutPoint.y + 20 }), false);

  const expectedStaticProxyCount = 4
    + ATHLETICS_STADIUM_COURSE.surfaces.length
    + ATHLETICS_STADIUM_COURSE.shortcuts.reduce((total, branch) => total + branch.surfaces.length, 0);
  assert.equal(ATHLETICS_COLLISION_PROXIES.length, expectedStaticProxyCount);

  const moving = ATHLETICS_STADIUM_COURSE.movingObstacles[0]!;
  const initial = getAthleticsMovingObstaclePosition(moving, 0);
  const quarterPeriod = getAthleticsMovingObstaclePosition(moving, moving.periodMs / 4);
  assert.notEqual(`${initial.x}:${initial.y}:${initial.z}`, `${quarterPeriod.x}:${quarterPeriod.y}:${quarterPeriod.z}`);
  const runtimeObstacles = getAthleticsObstacles(moving.periodMs / 4);
  const movingProxy = runtimeObstacles.find((obstacle) => obstacle.id === moving.id);
  assert.ok(movingProxy);
  assert.equal(movingProxy?.kind, "rect");
  assert.equal(movingProxy?.maxY, quarterPeriod.y + moving.height);
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

  const authoredRespawn = getAthleticsRespawnPosition(3);
  assert.ok(getAthleticsRouteProgress(authoredRespawn) < ATHLETICS_STADIUM_COURSE.checkpoints[2]!);
  assert.ok(getAthleticsRouteProgress(authoredRespawn) > ATHLETICS_STADIUM_COURSE.checkpoints[1]!);
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
