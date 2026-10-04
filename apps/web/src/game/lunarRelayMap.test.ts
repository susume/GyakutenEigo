import assert from "node:assert/strict";
import test from "node:test";
import {
  ARENA_PLAYER_EYE_HEIGHT, ATHLETICS_PLAYER_RADIUS, LUNAR_RELAY_STAIR_FLIGHTS, findBotNavigationPath,
  getArenaBounds, getArenaFloorSurfaces, getArenaGroundHeightForPlayer,
  getArenaObstacles, getCaptureZonesForMap, getSearchRetrieveItemsForMap,
  getSearchRetrieveDeliveryZonesForMap, getTeamBaseZones, getTeamSpawnsForMap,
  hasLineOfSight, resolveAuthoritativeMovement, sanitizeSessionSettings, scaleArenaValue
} from "@quizstrike/shared";
import { getArenaMap } from "./arenaMaps.js";
import { getArenaMap as getCatalogMap } from "./arenaMapCatalog.js";
import { blocks } from "./lunarRelayMap.js";
import {
  FPS_CROUCH_EYE_HEIGHT, FPS_STANDING_EYE_HEIGHT, FPS_MAX_AUTO_STEP_HEIGHT,
  findFpsBlockingSurfaceIndex, findFpsGroundSupportY, getFpsBodyVerticalBounds, getFpsPlayerGroundY
} from "./ArenaCamera.js";

const mapId = "lunar_relay" as const;
const point = (x: number, z: number, floor = 0) => ({ x: scaleArenaValue(x), z: scaleArenaValue(z), y: floor + ARENA_PLAYER_EYE_HEIGHT, facing: 0 });
const clientSources = blocks.filter(block => block.collides);
const clientSurfaces = clientSources.map(block => ({
  min: { x: block.x - block.w / 2, y: (block.y ?? block.h / 2) - block.h / 2, z: block.z - block.d / 2 },
  max: { x: block.x + block.w / 2, y: (block.y ?? block.h / 2) + block.h / 2, z: block.z + block.d / 2 }
}));
const clientBlockingIndex = (x: number, z: number, footY: number, eyeHeight = FPS_STANDING_EYE_HEIGHT) => {
  const body = getFpsBodyVerticalBounds(footY + eyeHeight, eyeHeight);
  return findFpsBlockingSurfaceIndex(clientSurfaces, clientSources, {
    min: { x: x - ATHLETICS_PLAYER_RADIUS, y: body.minY, z: z - ATHLETICS_PLAYER_RADIUS },
    max: { x: x + ATHLETICS_PLAYER_RADIUS, y: body.maxY, z: z + ATHLETICS_PLAYER_RADIUS }
  }, body);
};

test("Lunar Relay survives session sanitization and has matching setup and runtime metadata", () => {
  for (const gameMode of ["flag", "zombie", "classic"] as const) assert.equal(sanitizeSessionSettings({ gameMode, mapId }).mapId, mapId);
  assert.equal(getArenaMap(mapId).title, getCatalogMap(mapId).title);
  assert.deepEqual(getArenaBounds(mapId), { limitX: scaleArenaValue(240), limitZ: scaleArenaValue(180) });
  const delivery = getSearchRetrieveDeliveryZonesForMap(mapId);
  const bases = getTeamBaseZones(mapId);
  for (const team of ["blue", "red"] as const) {
    assert.ok(delivery[team].x >= bases[team].minX && delivery[team].x <= bases[team].maxX);
  }
});

test("Lunar Relay visual cover exactly matches server collision, including every stair riser", () => {
  const obstacles = getArenaObstacles(mapId);
  assert.equal(obstacles.length, blocks.filter(block => block.collides).length);
  for (const block of blocks.filter(block => block.collides)) {
    const obstacle = obstacles.find(candidate => candidate.id === block.id);
    assert.ok(obstacle?.kind === "rect");
    assert.deepEqual([obstacle.x, obstacle.z, obstacle.width, obstacle.depth], [block.x, block.z, block.w, block.d]);
    assert.ok(Math.abs(obstacle.minY! - ((block.y ?? block.h / 2) - block.h / 2)) < .0001);
    assert.ok(Math.abs(obstacle.maxY! - ((block.y ?? block.h / 2) + block.h / 2)) < .0001);
  }
  assert.ok(LUNAR_RELAY_STAIR_FLIGHTS.every(flight => (flight.endY - flight.startY) / flight.steps <= .8));
});

test("Lunar Relay's ground underpass stays playable beneath the separate relay objective", () => {
  assert.deepEqual(getArenaFloorSurfaces(mapId, 0, 0), [0, 10]);
  assert.equal(getArenaGroundHeightForPlayer(mapId, 0, 0, ARENA_PLAYER_EYE_HEIGHT), 0);
  assert.equal(getArenaGroundHeightForPlayer(mapId, 0, 0, 10 + ARENA_PLAYER_EYE_HEIGHT), 10);
  const obstacles = getArenaObstacles(mapId);
  const current = point(-40, 0);
  const result = resolveAuthoritativeMovement({ current, requested: point(40, 0), elapsedMs: 1000, maxSpeed: 100, obstacles, groundY: 0, mapId });
  assert.notEqual(result.blocked, true);
  assert.equal(result.x, point(40, 0).x);
  assert.equal(result.y, ARENA_PLAYER_EYE_HEIGHT);
  assert.equal(hasLineOfSight({ from: point(0, 0), to: point(0, 0, 10), obstacles }), false, "the deck blocks shots between floors");
});

test("crouching preserves the Lunar minimap's bridge and underpass floor identity", () => {
  for (const groundY of [0, 10]) {
    assert.equal(getFpsPlayerGroundY(mapId, { x: 0, z: 0, y: groundY + FPS_STANDING_EYE_HEIGHT }), groundY);
    assert.equal(getFpsPlayerGroundY(mapId, { x: 0, z: 0, y: groundY + FPS_CROUCH_EYE_HEIGHT, crouching: true }), groundY);
  }
});

test("authoritative movement walks all four stair flights and their landings without jumping", () => {
  const obstacles = getArenaObstacles(mapId);
  for (const flight of LUNAR_RELAY_STAIR_FLIGHTS) {
    const center = flight.axis === "x" ? flight.x : flight.z;
    const startAlong = center - flight.direction * (flight.length / 2 + 2);
    const samples = Math.ceil(scaleArenaValue(flight.length + 4) / .35);
    let current = point(flight.axis === "x" ? startAlong : flight.x, flight.axis === "z" ? startAlong : flight.z);
    for (let i = 1; i <= samples; i++) {
      const along = startAlong + flight.direction * (flight.length + 4) * i / samples;
      const requested = point(flight.axis === "x" ? along : flight.x, flight.axis === "z" ? along : flight.z);
      const groundY = getArenaGroundHeightForPlayer(mapId, requested.x, requested.z, current.y, ARENA_PLAYER_EYE_HEIGHT, .8);
      requested.y = groundY + ARENA_PLAYER_EYE_HEIGHT;
      const result = resolveAuthoritativeMovement({ current, requested, elapsedMs: 100, maxSpeed: 20, obstacles, groundY, mapId });
      assert.notEqual(result.blocked, true, `${flight.id} sample ${i} is blocked`);
      assert.equal(result.x, requested.x); assert.equal(result.z, requested.z);
      current = { ...current, ...result };
    }
    assert.equal(current.y, 10 + ARENA_PLAYER_EYE_HEIGHT);
  }
});

test("the FPS client walks each Lunar stair flight up and down while standing or crouching", () => {
  for (const flight of LUNAR_RELAY_STAIR_FLIGHTS) {
    for (const eyeHeight of [FPS_STANDING_EYE_HEIGHT, FPS_CROUCH_EYE_HEIGHT]) {
      for (const descending of [false, true]) {
        for (const lateral of [-flight.width / 4, 0, flight.width / 4]) {
          // Normal and maximum-frame movement distances exercise body contact
          // before the player's center reaches the next physical tread.
          for (const increment of [.12, .7]) {
            const span = scaleArenaValue(flight.length + 4);
            const samples = Math.ceil(span / increment);
            let footY = descending ? flight.endY : flight.startY;
            for (let sample = 0; sample <= samples; sample++) {
              const progress = descending ? 1 - sample / samples : sample / samples;
              const along = (flight.axis === "x" ? flight.x : flight.z)
                + flight.direction * ((progress - .5) * (flight.length + 4));
              const x = scaleArenaValue(flight.axis === "x" ? along : flight.x + lateral);
              const z = scaleArenaValue(flight.axis === "z" ? along : flight.z + lateral);
              const support = findFpsGroundSupportY(clientSurfaces, clientSources, x, z, ATHLETICS_PLAYER_RADIUS, footY, true);
              const mapped = getArenaGroundHeightForPlayer(mapId, x, z, footY + eyeHeight, eyeHeight);
              const nextFootY = Math.max(mapped, support ?? mapped);
              assert.ok(Math.abs(nextFootY - footY) <= FPS_MAX_AUTO_STEP_HEIGHT,
                `${flight.id} ${descending ? "descent" : "ascent"} sample ${sample} exceeds step height`);
              const blockingIndex = clientBlockingIndex(x, z, nextFootY, eyeHeight);
              assert.equal(blockingIndex, -1,
                `${flight.id} ${descending ? "descent" : "ascent"} blocked by ${clientSources[blockingIndex]?.id} at sample ${sample}`);
              footY = nextFootY;
            }
            assert.equal(footY, descending ? flight.startY : flight.endY);
          }
        }
      }
    }
  }
});

test("all forty Lunar Relay spawns reach every combat objective on the correct floor", () => {
  const obstacles = getArenaObstacles(mapId);
  const zones = getCaptureZonesForMap(mapId);
  for (const team of ["blue", "red"] as const) {
    const spawns = getTeamSpawnsForMap(mapId)[team];
    assert.equal(spawns.length, 20);
    for (const spawn of spawns) {
      assert.equal(clientBlockingIndex(spawn.x, spawn.z, spawn.y - ARENA_PLAYER_EYE_HEIGHT), -1, `${spawn.id} starts in client collision`);
      for (const zone of zones) {
        const goal = { ...zone, y: zone.y + ARENA_PLAYER_EYE_HEIGHT, facing: 0 };
        const path = findBotNavigationPath({ from: spawn, to: goal, obstacles, mapId });
        assert.ok(path.length > 0, `${spawn.id} cannot reach ${zone.id}`);
        assert.ok(Math.hypot(path.at(-1)!.x - goal.x, path.at(-1)!.z - goal.z) < .01);
        assert.equal(path.at(-1)!.y, goal.y);
        assert.equal(clientBlockingIndex(goal.x, goal.z, zone.y), -1, `${zone.id} intersects client collision`);
        // A valid bot grid route must also admit a human-sized client body
        // throughout its segments, not just have a reachable final waypoint.
        let previous = spawn;
        let footY = spawn.y - ARENA_PLAYER_EYE_HEIGHT;
        for (const waypoint of path) {
          const samples = Math.max(1, Math.ceil(Math.hypot(waypoint.x - previous.x, waypoint.z - previous.z) / .6));
          for (let sample = 1; sample <= samples; sample++) {
            const x = previous.x + (waypoint.x - previous.x) * sample / samples;
            const z = previous.z + (waypoint.z - previous.z) * sample / samples;
            const support = findFpsGroundSupportY(clientSurfaces, clientSources, x, z, ATHLETICS_PLAYER_RADIUS, footY, true);
            const mapped = getArenaGroundHeightForPlayer(mapId, x, z, footY + FPS_STANDING_EYE_HEIGHT, FPS_STANDING_EYE_HEIGHT);
            const nextFootY = Math.max(mapped, support ?? mapped);
            assert.ok(nextFootY - footY <= FPS_MAX_AUTO_STEP_HEIGHT, `${spawn.id} → ${zone.id} requires a jump`);
            footY = nextFootY;
            const blockingIndex = clientBlockingIndex(x, z, footY);
            assert.equal(blockingIndex, -1, `${spawn.id} → ${zone.id} blocked by ${clientSources[blockingIndex]?.id} at ${x.toFixed(2)},${z.toFixed(2)} floor ${footY}`);
          }
          previous = { ...previous, ...waypoint };
        }
        assert.equal(footY, zone.y);
      }
    }
  }
  for (const item of getSearchRetrieveItemsForMap(mapId)) {
    assert.ok(getArenaFloorSurfaces(mapId, item.x, item.z).some(y => Math.abs(y + 1.4 - item.y!) < .001));
  }
});

test("mirrored Lunar Relay starts have comparable bot routes and shielded spawn sightlines", () => {
  const obstacles = getArenaObstacles(mapId);
  const spawns = getTeamSpawnsForMap(mapId);
  const length = (from: typeof spawns.blue[number], path: ReturnType<typeof findBotNavigationPath>) => {
    let previous = from, total = 0;
    for (const step of path) { total += Math.hypot(step.x - previous.x, step.z - previous.z); previous = { ...previous, ...step }; }
    return total;
  };
  for (let index = 0; index < 20; index++) {
    assert.equal(hasLineOfSight({ from: spawns.blue[index], to: spawns.red[index], obstacles }), false);
  }
  for (const zone of getCaptureZonesForMap(mapId)) {
    const goal = { ...zone, y: zone.y + ARENA_PLAYER_EYE_HEIGHT, facing: 0 };
    const blue = length(spawns.blue[0], findBotNavigationPath({ from: spawns.blue[0], to: goal, obstacles, mapId }));
    const red = length(spawns.red[0], findBotNavigationPath({ from: spawns.red[0], to: goal, obstacles, mapId }));
    assert.ok(Math.max(blue, red) / Math.min(blue, red) < 1.1, `${zone.id} route imbalance: ${blue} / ${red}`);
  }
});
