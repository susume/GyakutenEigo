import assert from "node:assert/strict";
import test from "node:test";
import {
  ARENA_PLAYER_EYE_HEIGHT,
  getArenaGroundHeight,
  getArenaFloorSurfaces,
  getArenaObjectiveGroundY,
  getArenaObstacles,
  getArenaStairFlightsForMap,
  getCaptureZonesForMap,
  getSearchRetrieveItemsForMap,
  getTeamSpawnsForMap,
  findBotNavigationPath,
  scaleArenaValue,
  type ArenaMapId
} from "@quizstrike/shared";

const mapFrontObjectiveIds: Record<ArenaMapId, readonly string[]> = {
  desert_citadel: [
    "desert-shaded-souk",
    "desert-royal-causeway",
    "desert-royal-causeway",
    "desert-dry-cistern",
    "desert-crown-rampart"
  ],
  iron_junction: [
    "iron-warehouse-loading",
    "iron-grand-junction",
    "iron-maintenance-pit",
    "iron-mountain-tunnel"
  ],
  temple_runoff: [
    "jungle-ruins",
    "lower-waterway",
    "rain-court",
    "temple-terrace"
  ]
};

const mapFrontGoalOffsets: Record<ArenaMapId, readonly { x: number; z: number }[]> = {
  desert_citadel: [
    { x: 20, z: 0 },
    { x: 0, z: 18 },
    { x: 0, z: -18 },
    { x: 24, z: 0 },
    { x: 30, z: 4 }
  ],
  iron_junction: [
    { x: 58, z: 0 },
    { x: 0, z: 0 },
    { x: 0, z: 0 },
    { x: 0, z: 0 }
  ],
  temple_runoff: [
    { x: 22, z: 62 },
    { x: 18, z: 0 },
    { x: -40, z: 0 },
    { x: -16, z: 0 }
  ]
};

const maps = Object.keys(mapFrontObjectiveIds) as ArenaMapId[];

test("all three arenas preserve evenly loaded spawn fronts for a 40-player opening", () => {
  for (const mapId of maps) {
    const spawns = getTeamSpawnsForMap(mapId);
    const obstacles = getArenaObstacles(mapId);
    const zones = getCaptureZonesForMap(mapId);
    const frontGoals = mapFrontObjectiveIds[mapId].map((id, index) => {
      const zone = zones.find((candidate) => candidate.id === id);
      assert.ok(zone, `${mapId} is missing front objective ${id}`);
      const offset = mapFrontGoalOffsets[mapId][index]!;
      const x = zone.x + scaleArenaValue(offset.x);
      const z = zone.z + scaleArenaValue(offset.z);
      return { x, y: getArenaGroundHeight(mapId, x, z) + ARENA_PLAYER_EYE_HEIGHT, z, facing: 0 };
    });

    assert.equal(spawns.blue.length, 20, `${mapId} blue wave should contain 20 players`);
    assert.equal(spawns.red.length, 20, `${mapId} red wave should contain 20 players`);
    assert.equal(getArenaStairFlightsForMap(mapId).length > 0, true, `${mapId} should expose shared elevation transitions`);

    for (const team of ["blue", "red"] as const) {
      const teamSpawns = spawns[team];
      const frontByZ = new Map(
        [...new Set(teamSpawns.map((spawn) => spawn.z))]
          .sort((first, second) => first - second)
          .map((z, index) => [z, index] as const)
      );
      const fronts = new Map<number, number>();
      for (const spawn of teamSpawns) {
        const front = frontByZ.get(spawn.z)!;
        fronts.set(front, (fronts.get(front) ?? 0) + 1);
      }
      assert.deepEqual(
        [...fronts.values()].sort((a, b) => a - b),
        Array.from({ length: frontByZ.size }, () => teamSpawns.length / frontByZ.size),
        `${mapId} ${team} front load should be even`
      );

      for (let first = 0; first < teamSpawns.length; first += 1) {
        for (let second = first + 1; second < teamSpawns.length; second += 1) {
          assert.ok(
            Math.hypot(teamSpawns[first].x - teamSpawns[second].x, teamSpawns[first].z - teamSpawns[second].z) >= 4.5,
            `${mapId} ${team} spawn wave is too tightly packed`
          );
        }
        const frontGoal = frontGoals[frontByZ.get(teamSpawns[first]!.z)! % frontGoals.length]!;
        const path = findBotNavigationPath({ from: teamSpawns[first]!, to: frontGoal, obstacles, mapId });
        assert.ok(path.length > 0, `${mapId} ${team} spawn ${first + 1} cannot reach its assigned front`);
        assert.ok(Math.hypot(path.at(-1)!.x - frontGoal.x, path.at(-1)!.z - frontGoal.z) < 0.01);
        assert.equal(path.at(-1)!.y, frontGoal.y, `${mapId} ${team} spawn ${first + 1} reaches the wrong floor`);
      }
    }
  }
});

test("capture and retrieve objectives resolve to the same authoritative floors used by movement", () => {
  for (const mapId of maps) {
    for (const objective of getCaptureZonesForMap(mapId)) {
      const groundY = getArenaObjectiveGroundY(mapId, objective, 0);
      assert.ok(
        getArenaFloorSurfaces(mapId, objective.x, objective.z).some((surface) => Math.abs(surface - groundY) < 0.01),
        `${mapId} ${objective.id} is not on a legal floor`
      );
    }
    for (const item of getSearchRetrieveItemsForMap(mapId)) {
      const groundY = getArenaObjectiveGroundY(mapId, item, 1.4);
      assert.ok(
        getArenaFloorSurfaces(mapId, item.x, item.z).some((surface) => Math.abs(surface - groundY) < 0.01),
        `${mapId} ${item.id} is not on a legal floor`
      );
    }
  }
});

test("flag markers preserve a stored lower-floor elevation under Temple Runoff's bridge", () => {
  const x = scaleArenaValue(0);
  const z = scaleArenaValue(0);
  const surfaces = getArenaFloorSurfaces("temple_runoff", x, z);
  assert.ok(surfaces.length > 1, "the test coordinate should contain stacked walkable floors");
  assert.equal(
    getArenaObjectiveGroundY(
      "temple_runoff",
      { x, y: surfaces[0]! + ARENA_PLAYER_EYE_HEIGHT, z },
      ARENA_PLAYER_EYE_HEIGHT
    ),
    surfaces[0]
  );
});
