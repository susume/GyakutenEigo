import assert from "node:assert/strict";
import test from "node:test";
import {
  ATHLETICS_PLAYER_EYE_HEIGHT,
  ATHLETICS_STADIUM_COURSE,
  getAthleticsMovingObstaclePosition,
  getAthleticsPhysicalSupport,
  getAthleticsRecoveryPosition,
  getAthleticsRouteDistance,
  isAthleticsOnRoute
} from "@quizstrike/shared";
import {
  decideAthleticsFall,
  isAthleticsCheckpointOccupied,
  isAthleticsFinishOccupied,
  isAthleticsPlayableSupport
} from "./athleticsAuthority.js";

const decisionFor = (
  position: { x: number; y: number; z: number },
  support = getAthleticsPhysicalSupport(position, ATHLETICS_STADIUM_COURSE, ATHLETICS_PLAYER_EYE_HEIGHT, 0)
) => decideAthleticsFall({
  support,
  airborne: false,
  routeDistance: getAthleticsRouteDistance(position),
  routeWidth: ATHLETICS_STADIUM_COURSE.routeWidth,
  onRoute: isAthleticsOnRoute(position),
  belowRecoverableRoute: false
});

test("server fall authority accepts every authored main-route landing and exact recovery point", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  assert.equal(course.surfaces.length, 65);
  for (const [index, surface] of course.surfaces.entries()) {
    const position = { x: surface.x, y: surface.y + ATHLETICS_PLAYER_EYE_HEIGHT, z: surface.z };
    const support = getAthleticsPhysicalSupport(position, course, ATHLETICS_PLAYER_EYE_HEIGHT, 0);
    assert.equal(support.kind, "main_surface", `${surface.id} must be physically supported`);
    assert.equal(support.surfaceIndex, index, `${surface.id} resolved to the wrong authored landing`);
    assert.equal(isAthleticsPlayableSupport(support), true);
    assert.deepEqual(decisionFor(position, support), { recover: false, reason: "authored_support" });

    // Keep a racer grounded for several authoritative ticks, then accept a
    // small in-footprint move. Deliberately hostile route metrics prove that
    // physical support, rather than route-height projection, owns safety.
    for (let tick = 0; tick < 5; tick += 1) {
      assert.deepEqual(decideAthleticsFall({
        support,
        airborne: false,
        routeDistance: 999,
        routeWidth: course.routeWidth,
        onRoute: false,
        belowRecoverableRoute: true
      }), { recover: false, reason: "authored_support" });
    }
    const angle = surface.rotationY ?? 0;
    const localMove = { x: 0.45, z: 0.35 };
    const movedPosition = {
      x: surface.x + Math.cos(angle) * localMove.x - Math.sin(angle) * localMove.z,
      y: position.y,
      z: surface.z + Math.sin(angle) * localMove.x + Math.cos(angle) * localMove.z
    };
    const movedSupport = getAthleticsPhysicalSupport(movedPosition, course, ATHLETICS_PLAYER_EYE_HEIGHT, 0);
    assert.equal(movedSupport.kind, "main_surface", `${surface.id} small movement must remain supported`);
    assert.equal(movedSupport.surfaceIndex, index);

    const crouchedSupport = getAthleticsPhysicalSupport({
      ...movedPosition,
      y: surface.y + 2.65
    }, course, 2.65, 0);
    assert.equal(crouchedSupport.kind, "main_surface", `${surface.id} crouch must remain supported`);
    assert.equal(crouchedSupport.surfaceIndex, index);

    // A real airborne interval is allowed to exist before the eventual fall
    // decision. The recovery latch below models the server's recoveryActive
    // state and proves one fall increments the counter exactly once.
    const airborneSupport = getAthleticsPhysicalSupport({
      x: movedPosition.x + Math.cos(angle) * (surface.width / 2 + 2),
      y: movedPosition.y + 2.5,
      z: movedPosition.z + Math.sin(angle) * (surface.width / 2 + 2)
    }, course, ATHLETICS_PLAYER_EYE_HEIGHT, 0);
    assert.equal(airborneSupport.kind, "airborne", `${surface.id} leaving the footprint should be airborne`);
    assert.deepEqual(decideAthleticsFall({
      support: airborneSupport,
      airborne: true,
      requestedY: movedPosition.y + 2.5,
      routeDistance: 999,
      routeWidth: course.routeWidth,
      onRoute: false,
      belowRecoverableRoute: true
    }), { recover: false, reason: "airborne" });

    let recoveryActive = false;
    let falls = 0;
    const fallenDecision = decideAthleticsFall({
      support: { kind: "airborne", supportY: 0 },
      airborne: false,
      requestedY: 0,
      routeDistance: 999,
      routeWidth: course.routeWidth,
      onRoute: false,
      belowRecoverableRoute: true
    });
    if (fallenDecision.recover && !recoveryActive) {
      recoveryActive = true;
      falls += 1;
    }
    assert.equal(falls, 1, `${surface.id} should start one recovery`);
    for (let tick = 0; tick < 4; tick += 1) {
      if (fallenDecision.recover && !recoveryActive) falls += 1;
    }
    assert.equal(falls, 1, `${surface.id} must not duplicate its recovery start`);

    const respawn = getAthleticsRecoveryPosition(index, 0, course);
    const respawnSupport = getAthleticsPhysicalSupport(respawn, course, ATHLETICS_PLAYER_EYE_HEIGHT, 0);
    assert.equal(respawnSupport.kind, "main_surface", `${surface.id} recovery must remain supported`);
    assert.equal(respawnSupport.surfaceIndex, index, `${surface.id} recovery resolved to the wrong landing`);

    // Completing recovery clears the latch at the exact authored target. The
    // next several ticks and a normal retry move remain safe.
    recoveryActive = false;
    for (let tick = 0; tick < 5; tick += 1) {
      assert.deepEqual(decideAthleticsFall({
        support: respawnSupport,
        airborne: false,
        routeDistance: 999,
        routeWidth: course.routeWidth,
        onRoute: false,
        belowRecoverableRoute: true
      }), { recover: false, reason: "authored_support" });
    }
    const retryPosition = {
      x: respawn.x + Math.cos(angle) * 0.35,
      y: respawn.y,
      z: respawn.z + Math.sin(angle) * 0.35
    };
    const retrySupport = getAthleticsPhysicalSupport(retryPosition, course, ATHLETICS_PLAYER_EYE_HEIGHT, 0);
    assert.equal(retrySupport.kind, "main_surface", `${surface.id} should accept movement after recovery`);
    assert.equal(retrySupport.surfaceIndex, index);
    assert.equal(falls, 1, `${surface.id} fall count must remain exactly one`);
  }
});

test("server fall authority handles moving platforms across sampled positions without route projection", () => {
  const course = ATHLETICS_STADIUM_COURSE;
  let movingPlatformSamples = 0;
  for (const obstacle of course.movingObstacles) {
    if (obstacle.kind === "barrier") continue;
    const normalizePhaseTime = (value: number) => ((value % obstacle.periodMs) + obstacle.periodMs) % obstacle.periodMs;
    const phaseSamples = [
      ["minimum", normalizePhaseTime(obstacle.periodMs * 0.75 - (obstacle.phaseMs ?? 0))],
      ["centre", normalizePhaseTime(obstacle.periodMs - (obstacle.phaseMs ?? 0))],
      ["maximum", normalizePhaseTime(obstacle.periodMs * 0.25 - (obstacle.phaseMs ?? 0))]
    ] as const;
    for (const [phase, nowMs] of phaseSamples) {
      const position = getAthleticsMovingObstaclePosition(obstacle, nowMs);
      const supportPosition = { x: position.x, y: position.y + obstacle.height + ATHLETICS_PLAYER_EYE_HEIGHT, z: position.z };
      const support = getAthleticsPhysicalSupport(supportPosition, course, ATHLETICS_PLAYER_EYE_HEIGHT, nowMs);
      assert.equal(support.kind, "moving_platform", `${obstacle.id} ${phase} phase must be supported`);
      assert.equal(support.obstacleId, obstacle.id, `${obstacle.id} ${phase} phase resolved to the wrong moving support`);
      const decision = decideAthleticsFall({
        support,
        airborne: false,
        routeDistance: 999,
        routeWidth: course.routeWidth,
        onRoute: false,
        belowRecoverableRoute: true
      });
      assert.deepEqual(decision, { recover: false, reason: "moving_support" });
      movingPlatformSamples += 1;
    }
  }
  assert.equal(movingPlatformSamples, 15);
});

test("server fall authority keeps airborne gaps safe until floor or a real fall threshold", () => {
  const airborne = decideAthleticsFall({
    support: { kind: "airborne", supportY: 0 },
    airborne: true,
    requestedY: 8,
    routeDistance: 999,
    routeWidth: ATHLETICS_STADIUM_COURSE.routeWidth,
    onRoute: false,
    belowRecoverableRoute: true
  });
  assert.deepEqual(airborne, { recover: false, reason: "airborne" });

  assert.deepEqual(decideAthleticsFall({
    support: { kind: "park_floor", supportY: 0 },
    airborne: false,
    routeDistance: 0,
    routeWidth: ATHLETICS_STADIUM_COURSE.routeWidth,
    onRoute: true,
    belowRecoverableRoute: false
  }), { recover: true, reason: "park_floor" });

  assert.deepEqual(decideAthleticsFall({
    support: { kind: "airborne", supportY: 0 },
    airborne: false,
    requestedY: 0,
    routeDistance: 0,
    routeWidth: ATHLETICS_STADIUM_COURSE.routeWidth,
    onRoute: true,
    belowRecoverableRoute: false
  }), { recover: true, reason: "below_world" });

  assert.deepEqual(decideAthleticsFall({
    support: { kind: "airborne", supportY: 0 },
    airborne: false,
    routeDistance: ATHLETICS_STADIUM_COURSE.routeWidth + 3,
    routeWidth: ATHLETICS_STADIUM_COURSE.routeWidth,
    onRoute: false,
    belowRecoverableRoute: false
  }), { recover: true, reason: "outside_route_bounds" });

  assert.deepEqual(decideAthleticsFall({
    support: { kind: "park_floor", supportY: 0 },
    airborne: false,
    requestedY: ATHLETICS_PLAYER_EYE_HEIGHT,
    routeDistance: 999,
    routeWidth: ATHLETICS_STADIUM_COURSE.routeWidth,
    onRoute: false,
    belowRecoverableRoute: true,
    settleGuardActive: true
  }), { recover: false, reason: "settle_guard" });
});

test("physical support wins over route height, even when projection says below course", () => {
  const surface = ATHLETICS_STADIUM_COURSE.surfaces[54]!;
  const support = getAthleticsPhysicalSupport({
    x: surface.x,
    y: surface.y + ATHLETICS_PLAYER_EYE_HEIGHT,
    z: surface.z
  }, ATHLETICS_STADIUM_COURSE, ATHLETICS_PLAYER_EYE_HEIGHT, 0);
  assert.equal(support.kind, "main_surface");
  assert.deepEqual(decideAthleticsFall({
    support,
    airborne: false,
    routeDistance: 500,
    routeWidth: ATHLETICS_STADIUM_COURSE.routeWidth,
    onRoute: false,
    belowRecoverableRoute: true
  }), { recover: false, reason: "authored_support" });
});

test("checkpoint and finish authority require the matching physical main surface", () => {
  const checkpointSupport = { kind: "main_surface" as const, supportY: 21, surfaceIndex: 10 };
  assert.equal(isAthleticsCheckpointOccupied(checkpointSupport, 10), true);
  assert.equal(isAthleticsCheckpointOccupied(checkpointSupport, 11), false);
  assert.equal(isAthleticsCheckpointOccupied({ kind: "main_surface", supportY: 19, surfaceIndex: 9 }, 10), false);
  assert.equal(isAthleticsCheckpointOccupied({ kind: "moving_platform", supportY: 21, obstacleId: "ride-district-lift" }, 10), false);
  assert.equal(isAthleticsFinishOccupied({ kind: "main_surface", supportY: 110, surfaceIndex: 64 }, 64), true);
  assert.equal(isAthleticsFinishOccupied({ kind: "shortcut_surface", supportY: 110, surfaceId: "shortcut" }, 64), false);
});
