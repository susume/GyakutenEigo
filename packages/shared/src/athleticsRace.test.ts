import test from "node:test";
import assert from "node:assert/strict";
import {
  ATHLETICS_CHECKPOINT_COUNT,
  ATHLETICS_COLLISION_PROXIES,
  ATHLETICS_COURSE_BOUNDS,
  ATHLETICS_CORRECT_ENERGY,
  ATHLETICS_DEFAULT_TIME_LIMIT_SECONDS,
  ATHLETICS_JUMP_APEX_HEIGHT,
  ATHLETICS_JUMP_GRAVITY,
  ATHLETICS_JUMP_VELOCITY,
  ATHLETICS_JUMP_HORIZONTAL_SPEED,
  ATHLETICS_JUMP_LANDING_MARGIN,
  ATHLETICS_MOVEMENT_DRAIN_PER_SECOND,
  ATHLETICS_PLAYER_RADIUS,
  ATHLETICS_PLAYER_EYE_HEIGHT,
  ATHLETICS_MAX_ENERGY,
  ATHLETICS_STADIUM_COURSE,
  awardAthleticsEnergy,
  getAthleticsCourseGeometryIssues,
  getAthleticsCourseGeometryMetrics,
  getAthleticsObstacles,
  getAthleticsQuestionPoolIndex,
  getAthleticsQuestionsPerLap,
  getAthleticsTotalQuestionCount,
  getAthleticsCheckpointProgress,
  getAthleticsCheckpointRouteProgress,
  getAthleticsCheckpointSurfaceIndex,
  getAthleticsNextGateProgress,
  getAthleticsPointAtProgress,
  getAthleticsMovingObstaclePosition,
  getAthleticsPhysicalSupport,
  getAthleticsPreviousSafeSurfaceIndex,
  getAthleticsRecoveryPosition,
  getAthleticsRespawnPosition,
  getAthleticsRouteProgress,
  getAthleticsRouteLength,
  getAthleticsRouteTangent,
  getAthleticsStartPosition,
  getAthleticsSurfaceAirGap,
  getAthleticsSurfaceIndexAtPosition,
  getAthleticsSurfaceRouteProgress,
  getAthleticsSurfaceVolumeOverlap,
  getAthleticsTransitionJumpEnvelope,
  getAthleticsJumpHorizontalReach,
  getAthleticsTransitionAirGap,
  isAthleticsFinish,
  isAthleticsBelowRecoverableRoute,
  isAthleticsCourseFinish,
  isAthleticsOnRoute,
  resolveAthleticsMovementEnergy,
  resolveAthleticsStandings
} from "./athleticsRace.js";
import { ATHLETICS_ARENA_MAP_ID, resolveAnswerReward, resolveAuthoritativeMovement, sanitizeSessionSettings } from "./index.js";

test("Skyline Adventure Park exposes seven separated athletic districts", () => {
  assert.equal(ATHLETICS_STADIUM_COURSE.id, "stadium_loop");
  assert.equal(ATHLETICS_STADIUM_COURSE.sections.length, 7);
  assert.equal(ATHLETICS_STADIUM_COURSE.checkpoints.length, ATHLETICS_CHECKPOINT_COUNT);
  assert.ok(ATHLETICS_STADIUM_COURSE.route[64]!.y > ATHLETICS_STADIUM_COURSE.route[0]!.y);
  assert.equal(ATHLETICS_STADIUM_COURSE.route.length, 138);
  assert.ok(getAthleticsRouteLength() >= 1100 && getAthleticsRouteLength() <= 1250);
  assert.ok(ATHLETICS_STADIUM_COURSE.surfaces.length >= 130 && ATHLETICS_STADIUM_COURSE.surfaces.length <= 150);
  assert.equal(ATHLETICS_STADIUM_COURSE.shortcuts.length, 3);
  assert.equal(ATHLETICS_STADIUM_COURSE.movingObstacles.length, 19);
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

test("Athletics has distinct connected, balance, jumping, and timing challenges", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  const metrics = getAthleticsCourseGeometryMetrics(course);
  assert.deepEqual(getAthleticsCourseGeometryIssues(course), []);
  assert.equal(metrics.mainRoutePlatformCount, 138);
  assert.equal(metrics.transitionCount, 138);
  assert.equal(metrics.genuineJumpTransitionCount, 34);
  assert.equal(metrics.jumpTransitionAirGapPercentage, 100);
  assert.ok(metrics.jumpTransitionPercentage > 20);
  assert.equal(metrics.connectedNonJumpTransitionCount, 104);
  assert.equal(metrics.movingPlatformTransitionCount, 9);
  assert.ok(metrics.medianAirGap >= 4);
  assert.ok(metrics.averagePlatformWidth < 16 && metrics.averagePlatformDepth < 15);
  assert.ok(course.transitions.slice(0, 9).every((transition) => getAthleticsTransitionAirGap(transition, course) <= .001));
  assert.ok(course.surfaces.slice(11, 21).every((surface) => surface.width === 4 && surface.material === "wood"));
  assert.ok(course.surfaces.slice(28, 32).every((surface) => surface.kind === "stair"));
  assert.equal(course.challenges?.filter((entry) => entry.kind === "hurdle").length, 7);
  assert.equal(course.challenges?.filter((entry) => entry.kind === "slalom").length, 6);
  for (const challenge of course.challenges ?? []) {
    const proxy = getAthleticsObstacles().find((entry) => entry.id === challenge.id);
    assert.ok(proxy, challenge.id + " needs a solid collision proxy");
    assert.equal(proxy.maxY, challenge.y + challenge.height);
  }
  for (let i = 0; i < course.surfaces.length; i += 1) {
    for (let j = i + 2; j < course.surfaces.length; j += 1) {
      if (i === 0 && j === course.surfaces.length - 1) continue;
      assert.ok(getAthleticsSurfaceAirGap(course.surfaces[i]!, course.surfaces[j]!) > .001,
        course.surfaces[i]!.id + " must not cross above or below " + course.surfaces[j]!.id);
    }
  }
});

test("Athletics geometry QA rejects route crossings even at different heights", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  const brokenCourse = { ...course, surfaces: course.surfaces.map((surface, index) => index === 60
    ? { ...surface, x: course.surfaces[2]!.x, z: course.surfaces[2]!.z } : surface) };
  assert.ok(getAthleticsCourseGeometryIssues(brokenCourse).some((issue) => issue.includes("route-platform-003") && issue.includes("route-platform-061")));
});

test("zigzag and floating districts demand precision and six shuttle crossings", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  for (const surface of course.surfaces.slice(22, 28)) {
    assert.ok(surface.width <= 8 && surface.depth <= 8);
  }
  for (const transition of course.transitions.slice(22, 26)) {
    const envelope = getAthleticsTransitionJumpEnvelope(transition, course);
    assert.ok(envelope.airGap >= 9, transition.id);
    assert.ok(envelope.airGap <= envelope.horizontalReach, transition.id);
  }
  assert.ok(course.surfaces.slice(33, 43).every((surface) => surface.width <= 8 && surface.depth <= 6));
  const shuttles = course.movingObstacles.filter((obstacle) => obstacle.kind === "platform");
  assert.equal(shuttles.length, 6);
  for (const shuttle of shuttles) {
    assert.ok(shuttle.width <= 6 && shuttle.depth <= 7);
    assert.ok(shuttle.amplitude >= 6 && shuttle.periodMs <= 4100);
    const crossing = course.transitions.find((transition) => transition.movingObstacleId === shuttle.id)!;
    assert.equal(crossing.type, "moving_jump");
    const envelope = getAthleticsTransitionJumpEnvelope(crossing, course);
    assert.ok(envelope.airGap > envelope.horizontalReach, "a direct jump must require boarding the shuttle");
  }
});

test("Power Stairs replaces every pink landing with moving support and recovers on a stable checkpoint", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  const ledges = course.surfaces.slice(44, 54);
  assert.ok(ledges.every((surface) => surface.width <= 8 && surface.depth <= 8));
  assert.equal(ledges.length, 10);
  for (const surface of ledges) {
    const float = course.movingObstacles.find((obstacle) => obstacle.id === surface.movingObstacleId)!;
    assert.ok(float && float.axis === "y" && float.amplitude >= 2.8);
    assert.equal(ATHLETICS_COLLISION_PROXIES.some((proxy) => proxy.id === surface.id), false,
      "the original landing must not leave a stationary invisible floor");
    for (const fraction of [.25, .75]) {
      const nowMs = float.periodMs * fraction - (float.phaseMs ?? 0);
      const point = getAthleticsMovingObstaclePosition(float, nowMs);
      const support = getAthleticsPhysicalSupport({ ...point, y: point.y + float.height + ATHLETICS_PLAYER_EYE_HEIGHT }, course, ATHLETICS_PLAYER_EYE_HEIGHT, nowMs);
      assert.equal(support.kind, "moving_platform");
      assert.equal(support.obstacleId, float.id);
      assert.equal(support.surfaceId, surface.id);
      assert.equal(getAthleticsPhysicalSupport({ ...surface, y: surface.y + ATHLETICS_PLAYER_EYE_HEIGHT }, course, ATHLETICS_PLAYER_EYE_HEIGHT, nowMs).kind, "airborne");
    }
    assert.equal(getAthleticsPreviousSafeSurfaceIndex(getAthleticsSurfaceRouteProgress(course.surfaces.indexOf(surface))), 43);
    const recovery = getAthleticsRecoveryPosition(course.surfaces.indexOf(surface));
    assert.equal(getAthleticsPhysicalSupport(recovery).surfaceIndex, 43);
  }
  for (let index = 1; index < ledges.length; index++) {
    assert.ok(Math.abs(ledges[index]!.x - ledges[index - 1]!.x) >= 8);
    assert.ok(getAthleticsSurfaceAirGap(ledges[index - 1]!, ledges[index]!) >= 7);
  }
  const lift = course.movingObstacles.find((obstacle) => obstacle.id === "power-stairs-lift")!;
  assert.ok(lift.width <= 8 && lift.depth <= 6 && lift.periodMs <= 4000);
  const board = { ...lift, y: lift.y - lift.amplitude + lift.height };
  const exit = { ...lift, y: lift.y + lift.amplitude + lift.height };
  assert.ok(getAthleticsSurfaceAirGap(course.surfaces[49]!, board)
    <= getAthleticsJumpHorizontalReach(board.y - course.surfaces[49]!.y));
  assert.ok(getAthleticsSurfaceAirGap(exit, course.surfaces[50]!)
    <= getAthleticsJumpHorizontalReach(course.surfaces[50]!.y - exit.y));
});

test("every floating ascent jump has a landing window while the destination moves during flight", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  const deckAt = (surface: typeof course.surfaces[number], nowMs: number) => {
    const mover = course.movingObstacles.find((obstacle) => obstacle.id === surface.movingObstacleId);
    if (!mover) return surface;
    const point = getAthleticsMovingObstaclePosition(mover, nowMs);
    return { ...surface, ...point, y: point.y + mover.height };
  };
  const lift = course.movingObstacles.find((obstacle) => obstacle.id === "power-stairs-lift")!;
  const liftAnchor = { ...course.surfaces[49]!, ...lift, y: lift.y + lift.height,
    kind: "platform" as const, movingObstacleId: lift.id, rotationY: 0 };
  let restrictedJumps = 0;
  for (let index = 43; index <= 53; index++) {
    const pairs = index === 49 ? [[course.surfaces[49]!, liftAnchor], [liftAnchor, course.surfaces[50]!]]
      : [[course.surfaces[index]!, course.surfaces[index + 1]!]];
    for (const [from, to] of pairs) {
      let landingWindows = 0;
      for (let startMs = 0; startMs < 60_000; startMs += 100) {
        const start = deckAt(from!, startMs);
        const gap = getAthleticsSurfaceAirGap(start, deckAt(to!, startMs));
        let previousDifference = start.y - deckAt(to!, startMs).y;
        for (let flight = .02; flight <= 1.6; flight += .02) {
          const footY = start.y + ATHLETICS_JUMP_VELOCITY * flight - .5 * ATHLETICS_JUMP_GRAVITY * flight * flight;
          const difference = footY - deckAt(to!, startMs + flight * 1000).y;
          if (flight > ATHLETICS_JUMP_VELOCITY / ATHLETICS_JUMP_GRAVITY && previousDifference >= 0 && difference <= 0) {
            if (gap + ATHLETICS_JUMP_LANDING_MARGIN <= (flight - .02) * ATHLETICS_JUMP_HORIZONTAL_SPEED) landingWindows++;
            break;
          }
          previousDifference = difference;
        }
      }
      assert.ok(landingWindows >= 30, `${from!.id} to ${to!.id} needs usable timed jump windows`);
      if (landingWindows < 600) restrictedJumps++;
    }
  }
  assert.ok(restrictedJumps >= 6, "the rising and falling decks must make timing matter");
});

test("Skyline Descent requires steering on its narrow continuous lane and jumping its hurdles", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  for (const index of [76, 92, 108, 124]) {
    const surface = course.surfaces[index]!;
    const position = { x: surface.x, y: surface.y + ATHLETICS_PLAYER_EYE_HEIGHT, z: surface.z };
    assert.equal(getAthleticsPhysicalSupport(position).surfaceIndex, index);
    assert.notEqual(getAthleticsPhysicalSupport({ ...position, x: -54 }).kind, "main_surface",
      "running straight must no longer bypass the weaving lane");
  }
  const hurdles = course.challenges!.filter((challenge) => challenge.id.startsWith("descent-hurdle-"));
  assert.equal(hurdles.length, 3);
  for (const hurdle of hurdles) {
    const cross = (rise: number) => resolveAuthoritativeMovement({
      current: { x: hurdle.x, y: hurdle.y + ATHLETICS_PLAYER_EYE_HEIGHT + rise, z: hurdle.z - 1, facing: 0 },
      requested: { x: hurdle.x, y: hurdle.y + ATHLETICS_PLAYER_EYE_HEIGHT + rise, z: hurdle.z + 1, facing: 0 },
      elapsedMs: 300, maxSpeed: 22, obstacles: getAthleticsObstacles(), groundY: hurdle.y,
      eyeHeight: ATHLETICS_PLAYER_EYE_HEIGHT, mapId: ATHLETICS_ARENA_MAP_ID
    });
    assert.equal(cross(0).blocked, true, hurdle.id);
    assert.equal(cross(2).z, hurdle.z + 1, hurdle.id);
  }
});

test("solid sprint hurdles require a jump and slalom posts require steering", () => {
  const hurdlePad = ATHLETICS_STADIUM_COURSE.surfaces[2]!;
  const crossHurdle = (rise: number) => resolveAuthoritativeMovement({
    current: { x: hurdlePad.x + 2, y: hurdlePad.y + ATHLETICS_PLAYER_EYE_HEIGHT, z: hurdlePad.z, facing: -Math.PI / 2 },
    requested: { x: hurdlePad.x - 2, y: hurdlePad.y + ATHLETICS_PLAYER_EYE_HEIGHT + rise, z: hurdlePad.z, facing: -Math.PI / 2 },
    elapsedMs: 300, maxSpeed: 22, obstacles: getAthleticsObstacles(), groundY: hurdlePad.y,
    eyeHeight: ATHLETICS_PLAYER_EYE_HEIGHT, mapId: ATHLETICS_ARENA_MAP_ID
  });
  assert.equal(crossHurdle(0).blocked, true);
  assert.equal(crossHurdle(2).x, hurdlePad.x - 2);
  const slalomPad = ATHLETICS_STADIUM_COURSE.challenges!.find((challenge) => challenge.kind === "slalom")!;
  const passPost = (offset: number) => resolveAuthoritativeMovement({
    current: { x: slalomPad.x + offset, y: slalomPad.y + ATHLETICS_PLAYER_EYE_HEIGHT, z: slalomPad.z - 3, facing: 0 },
    requested: { x: slalomPad.x + offset, y: slalomPad.y + ATHLETICS_PLAYER_EYE_HEIGHT, z: slalomPad.z + 3, facing: 0 },
    elapsedMs: 300, maxSpeed: 22, obstacles: getAthleticsObstacles(), groundY: slalomPad.y,
    eyeHeight: ATHLETICS_PLAYER_EYE_HEIGHT, mapId: ATHLETICS_ARENA_MAP_ID
  });
  assert.equal(passPost(0).blocked, true);
  assert.equal(passPost(4).z, slalomPad.z + 3);
  assert.equal(passPost(-4).z, slalomPad.z + 3);
});

test("Athletics route and shortcuts fit the reliable classic jump envelope", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  const transitions = [
    ...course.transitions,
    ...course.shortcuts.flatMap((shortcut) => shortcut.transitions)
  ];

  for (const transition of transitions) {
    const envelope = getAthleticsTransitionJumpEnvelope(transition, course);
    assert.ok(Number.isFinite(envelope.airGap), `${transition.id} must reference two authored surfaces`);
    if (envelope.flightTimeSeconds === undefined) {
      assert.ok(transition.movingObstacleId, `${transition.id} needs a named lift above the jump apex`);
      continue;
    }
    const shuttle = course.movingObstacles.find((entry) => entry.id === transition.movingObstacleId && entry.kind === "platform");
    if (shuttle) {
      const from = course.surfaces.find((entry) => entry.id === transition.fromSurfaceId)!;
      const to = course.surfaces.find((entry) => entry.id === transition.toSurfaceId)!;
      for (const fraction of [.25, .5, .75]) {
        const position = getAthleticsMovingObstaclePosition(shuttle, shuttle.periodMs * fraction - (shuttle.phaseMs ?? 0));
        const deck = { ...position, y: position.y + shuttle.height, width: shuttle.width, depth: shuttle.depth };
        assert.ok(getAthleticsSurfaceAirGap(from, deck) <= getAthleticsJumpHorizontalReach(deck.y - from.y));
        assert.ok(getAthleticsSurfaceAirGap(deck, to) <= getAthleticsJumpHorizontalReach(to.y - deck.y));
      }
      continue;
    }
    assert.ok(
      envelope.airGap <= envelope.horizontalReach + 0.001,
      `${transition.id} air gap ${envelope.airGap.toFixed(2)} exceeds reliable reach ${envelope.horizontalReach.toFixed(2)}`
    );
  }
});

test("Athletics geometry QA rejects a static platform above the jump apex", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  const brokenCourse = {
    ...course,
    surfaces: course.surfaces.map((surface, index) => (
      index === 23
        ? { ...surface, y: surface.y + ATHLETICS_JUMP_APEX_HEIGHT + 1 }
        : surface
    ))
  };

  const issues = getAthleticsCourseGeometryIssues(brokenCourse);
  assert.ok(
    issues.some((issue) => issue.includes("main-transition-023") && issue.includes("without a vertical lift")),
    "geometry QA should reject an unaided rise above the jump apex"
  );
});

test("Athletics edge-gap geometry respects touching, separation, and rotation", () => {
  const first = { x: 0, z: 0, width: 10, depth: 4 };
  assert.equal(getAthleticsSurfaceAirGap(first, { x: 0, z: 1, width: 10, depth: 4 }), 0);
  assert.equal(getAthleticsSurfaceAirGap(first, { x: 0, z: 7, width: 10, depth: 4 }), 3);
  assert.equal(getAthleticsSurfaceAirGap(first, { x: 0, z: 7, width: 10, depth: 4, rotationY: Math.PI / 2 }), 0);
  assert.equal(getAthleticsSurfaceVolumeOverlap({ ...first, y: 4 }, { ...first, y: 4 }), true);
  assert.equal(getAthleticsSurfaceVolumeOverlap({ ...first, y: 4 }, { ...first, y: 6 }), false);
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

test("Athletics server support accepts a legitimate player-radius edge landing", () => {
  const surface = ATHLETICS_STADIUM_COURSE.surfaces[0]!;
  const angle = surface.rotationY ?? 0;
  const localX = surface.width / 2 - ATHLETICS_PLAYER_RADIUS - 0.02;
  const support = getAthleticsPhysicalSupport({
    x: surface.x + Math.cos(angle) * localX,
    y: surface.y + ATHLETICS_PLAYER_EYE_HEIGHT,
    z: surface.z - Math.sin(angle) * localX
  });

  assert.equal(support.kind, "main_surface");
  assert.equal(support.surfaceId, surface.id);
});

test("Athletics recovers racers stranded below a raised route", () => {
  const raisedProgress = getAthleticsSurfaceRouteProgress(22);
  const routePoint = getAthleticsPointAtProgress(raisedProgress);
  assert.ok(routePoint.y > 2);
  assert.equal(isAthleticsBelowRecoverableRoute({ y: ATHLETICS_PLAYER_EYE_HEIGHT }, raisedProgress), true);
  assert.equal(isAthleticsBelowRecoverableRoute({ y: routePoint.y + ATHLETICS_PLAYER_EYE_HEIGHT }, raisedProgress), false);
  assert.equal(isAthleticsBelowRecoverableRoute({ y: routePoint.y + ATHLETICS_PLAYER_EYE_HEIGHT - 1.5 }, raisedProgress), false);
});

test("Athletics recovery respawns inside the previous authored landing and faces the next jump", () => {
  const safeSurfaceIndex = 12;
  const safeProgress = getAthleticsSurfaceRouteProgress(safeSurfaceIndex);
  const respawn = getAthleticsRecoveryPosition(safeSurfaceIndex, 0);
  const surface = ATHLETICS_STADIUM_COURSE.surfaces[safeSurfaceIndex]!;
  const distanceFromCentre = Math.hypot(respawn.x - surface.x, respawn.z - surface.z);

  assert.equal(getAthleticsPreviousSafeSurfaceIndex(safeProgress + 0.001), safeSurfaceIndex);
  assert.ok(distanceFromCentre < Math.min(surface.width, surface.depth) / 2 - 1.5);
  assert.equal(respawn.y, surface.y + ATHLETICS_PLAYER_EYE_HEIGHT);
  assert.equal(getAthleticsSurfaceIndexAtPosition(respawn), safeSurfaceIndex);
  const crouchEyeHeight = 2.65;
  assert.equal(
    getAthleticsSurfaceIndexAtPosition(
      { x: surface.x, y: surface.y + crouchEyeHeight, z: surface.z },
      ATHLETICS_STADIUM_COURSE,
      crouchEyeHeight
    ),
    safeSurfaceIndex,
    "crouching on a safe platform must remain a safe landing"
  );
  assert.ok(getAthleticsSurfaceRouteProgress(safeSurfaceIndex + 1) > safeProgress);
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
  const summitApproach = getAthleticsPointAtProgress(getAthleticsSurfaceRouteProgress(63));
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
    + ATHLETICS_STADIUM_COURSE.surfaces.filter((surface) => !surface.movingObstacleId).length
    + (ATHLETICS_STADIUM_COURSE.challenges?.length ?? 0)
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

test("physical support classification covers main, shortcut, moving, crouch, and checkpoint occupancy", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  for (const [index, surface] of course.surfaces.entries()) {
    if (surface.movingObstacleId) continue; // Moving support is sampled across its travel above.
    const standing = getAthleticsPhysicalSupport({
      x: surface.x,
      y: surface.y + ATHLETICS_PLAYER_EYE_HEIGHT,
      z: surface.z
    }, course, ATHLETICS_PLAYER_EYE_HEIGHT, 0);
    assert.equal(standing.kind, "main_surface", `${surface.id} should be a main support`);
    assert.equal(standing.surfaceIndex, index);

    const crouchingEyeHeight = 2.65;
    const crouching = getAthleticsPhysicalSupport({
      x: surface.x,
      y: surface.y + crouchingEyeHeight,
      z: surface.z
    }, course, crouchingEyeHeight, 0);
    assert.equal(crouching.kind, "main_surface", `${surface.id} crouch support should remain valid`);
    assert.equal(crouching.surfaceIndex, index);
  }

  for (const shortcut of course.shortcuts) {
    for (const surface of shortcut.surfaces) {
      const support = getAthleticsPhysicalSupport({
        x: surface.x,
        y: surface.y + ATHLETICS_PLAYER_EYE_HEIGHT,
        z: surface.z
      }, course, ATHLETICS_PLAYER_EYE_HEIGHT, 0);
      assert.equal(support.kind, "shortcut_surface", `${surface.id} should be a shortcut support`);
      assert.equal(support.surfaceId, surface.id);
    }
  }

  assert.deepEqual(
    course.checkpoints.map((_, index) => getAthleticsCheckpointSurfaceIndex(index, course)),
    [10, 21, 32, 43, 54, 64, 137]
  );
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
  starts.forEach((start, index) => {
    assert.ok(isAthleticsOnRoute(start));
    assert.equal(getAthleticsPhysicalSupport(start).surfaceIndex, 0);
    for (const other of starts.slice(index + 1)) {
      assert.ok(Math.hypot(start.x - other.x, start.z - other.z) >= ATHLETICS_PLAYER_RADIUS * 2);
    }
  });
});

test("the circuit finish is the start runway after the return stage", () => {
  assert.equal(isAthleticsCourseFinish(getAthleticsPointAtProgress(0)), true);
  assert.equal(isAthleticsCourseFinish(getAthleticsPointAtProgress(0.99)), false);
  assert.equal(isAthleticsCourseFinish(getAthleticsPointAtProgress(0.8)), false);
  assert.equal(isAthleticsFinish(getAthleticsPointAtProgress(0), 6, 7), false);
  assert.equal(isAthleticsFinish(getAthleticsPointAtProgress(0), 7, 7), true);
});

test("connected runway and return seams support the player while outside edges remain unsafe", () => {
  for (const point of [{ x: -18, z: 123 }, { x: -36, z: 123 }, { x: -24, z: 105 }, { x: 0, z: 110 }]) {
    assert.equal(getAthleticsPhysicalSupport({ ...point, y: ATHLETICS_PLAYER_EYE_HEIGHT }).kind, "main_surface");
  }
  assert.equal(getAthleticsPhysicalSupport({ x: 0, z: 137, y: ATHLETICS_PLAYER_EYE_HEIGHT }).kind, "park_floor");
});

test("stage seven descends to a touching finish join without a teleport or jump gap", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  assert.equal(course.closedLoop, true);
  assert.equal(course.finishSurfaceIndex, 0);
  for (let index = 64; index < course.surfaces.length - 1; index += 1) {
    const from = course.surfaces[index]!;
    const to = course.surfaces[index + 1]!;
    assert.ok(to.y <= from.y);
    assert.ok(from.y - to.y <= .8);
    assert.ok(getAthleticsSurfaceAirGap(from, to) <= .03);
  }
  assert.equal(course.transitions.at(-1)?.toSurfaceId, course.surfaces[0]!.id);
  assert.equal(getAthleticsSurfaceAirGap(course.surfaces.at(-1)!, course.surfaces[0]!), 0);
});

test("Athletics answers refill movement energy and movement/jumps spend it", () => {
  assert.equal(awardAthleticsEnergy({ isCorrect: true, currentEnergy: 0 }), ATHLETICS_CORRECT_ENERGY);
  assert.equal(awardAthleticsEnergy({ isCorrect: false, currentEnergy: 420 }), 420);
  assert.equal(awardAthleticsEnergy({ isCorrect: true, currentEnergy: ATHLETICS_MAX_ENERGY }), ATHLETICS_MAX_ENERGY);
  const resolution = resolveAthleticsMovementEnergy({
    currentEnergy: 300,
    elapsedMs: 500,
    movedDistance: 6,
    jumped: true
  });
  const noSprintFlagResolution = resolveAthleticsMovementEnergy({
    currentEnergy: 300,
    elapsedMs: 500,
    movedDistance: 6,
    jumped: true
  });
  assert.equal(resolution.canMove, true);
  assert.equal(resolution.jumpCost > 0, true);
  assert.ok(resolution.nextEnergy < 300);
  assert.equal(resolution.movementCost, noSprintFlagResolution.movementCost);
  assert.equal(resolution.movementCost, ATHLETICS_MOVEMENT_DRAIN_PER_SECOND * 0.5);
  assert.equal(resolveAthleticsMovementEnergy({ currentEnergy: 0, elapsedMs: 500, movedDistance: 0, jumped: false }).canMove, false);
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
