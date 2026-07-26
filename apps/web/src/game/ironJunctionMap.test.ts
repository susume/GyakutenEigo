import assert from "node:assert/strict";
import test from "node:test";
import {
  ARENA_PLAYER_BODY_HEIGHT,
  ARENA_PLAYER_EYE_HEIGHT,
  ARENA_SCALE,
  IRON_JUNCTION_LOADING_LEVEL_Y,
  IRON_JUNCTION_OVERPASS_LEVEL_Y,
  findBotNavigationPath,
  getArenaBounds,
  getArenaFloorSurfaces,
  getArenaGroundHeightForPlayer,
  getArenaObstacles,
  getTeamSpawnsForMap,
  hasLineOfSight
} from "@quizstrike/shared";
import { IRON_JUNCTION, blocks, cylinders, props } from "./ironJunctionMap.js";

const raw = (value: number) => value * ARENA_SCALE;

test("Iron Junction 2.0 expands the district and defines all six major areas", () => {
  assert.equal(IRON_JUNCTION.footprint.width, raw(560));
  assert.equal(IRON_JUNCTION.footprint.depth, raw(500));
  assert.deepEqual(getArenaBounds("iron_junction"), { limitX: raw(280), limitZ: raw(250) });
  assert.equal(IRON_JUNCTION.districts.length, 6);
  for (const id of [
    "warehouse-north-wall",
    "depot-east-wall",
    "tunnel-roof-west",
    "junction-overpass",
    "dispatch-north-wall",
    "junction-locomotive"
  ]) {
    assert.ok(blocks.some((block) => block.id === id), `${id} should exist`);
  }
});

test("Iron Junction uses four architectural trains and sparse props", () => {
  const trains = blocks.filter((block) => block.style === "railcar");
  assert.equal(trains.length, 4);
  assert.ok(trains.every((train) => train.w >= raw(42) && train.d >= raw(13)));
  assert.ok(props.length <= 18);
  assert.equal(props.filter((prop) => prop.kind === "crate").length, 1);
});

test("Iron Junction supports ground, loading, and overpass floors at one X/Z", () => {
  const x = raw(10);
  const z = raw(25);
  assert.deepEqual(
    getArenaFloorSurfaces("iron_junction", x, z),
    [0, IRON_JUNCTION_LOADING_LEVEL_Y, IRON_JUNCTION_OVERPASS_LEVEL_Y]
  );
  assert.equal(getArenaGroundHeightForPlayer("iron_junction", x, z, ARENA_PLAYER_EYE_HEIGHT), 0);
  assert.equal(
    getArenaGroundHeightForPlayer(
      "iron_junction",
      x,
      z,
      IRON_JUNCTION_LOADING_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT
    ),
    IRON_JUNCTION_LOADING_LEVEL_Y
  );
  assert.equal(
    getArenaGroundHeightForPlayer(
      "iron_junction",
      x,
      z,
      IRON_JUNCTION_OVERPASS_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT
    ),
    IRON_JUNCTION_OVERPASS_LEVEL_Y
  );
  assert.ok(IRON_JUNCTION_LOADING_LEVEL_Y / ARENA_PLAYER_BODY_HEIGHT > 1.5);
  assert.ok((IRON_JUNCTION_OVERPASS_LEVEL_Y - IRON_JUNCTION_LOADING_LEVEL_Y) / ARENA_PLAYER_BODY_HEIGHT > 1.9);
});

test("Iron Junction provides 20 non-overlapping protected spawns per team", () => {
  const spawns = getTeamSpawnsForMap("iron_junction");
  const obstacles = getArenaObstacles("iron_junction");
  assert.equal(spawns.blue.length, 20);
  assert.equal(spawns.red.length, 20);
  assert.equal(new Set(spawns.blue.map((spawn) => `${spawn.x}:${spawn.z}`)).size, 20);
  for (const spawn of [...spawns.blue, ...spawns.red]) {
    const overlaps = obstacles.filter((obstacle) => {
      if (obstacle.kind === "circle") return Math.hypot(spawn.x - obstacle.x, spawn.z - obstacle.z) <= obstacle.radius + 0.45;
      return (
        spawn.x >= obstacle.x - obstacle.width / 2 - 0.45
        && spawn.x <= obstacle.x + obstacle.width / 2 + 0.45
        && spawn.z >= obstacle.z - obstacle.depth / 2 - 0.45
        && spawn.z <= obstacle.z + obstacle.depth / 2 + 0.45
      );
    });
    assert.deepEqual(overlaps, [], `${spawn.id} overlaps collision`);
  }
});

test("Iron Junction visual colliders all have authoritative server proxies", () => {
  const authoritativeIds = new Set(getArenaObstacles("iron_junction").map((obstacle) => obstacle.id));
  const visualIds = [
    ...blocks.filter((block) => block.collides).map((block) => block.id),
    ...cylinders.filter((cylinder) => cylinder.collides).map((cylinder) => cylinder.id)
  ];
  assert.deepEqual(visualIds.filter((id) => !authoritativeIds.has(id)), []);
});

test("Iron Junction bot navigation reaches the upper route without merging floors", () => {
  const path = findBotNavigationPath({
    from: { x: raw(178), y: ARENA_PLAYER_EYE_HEIGHT, z: raw(25), facing: 0 },
    to: {
      x: raw(20),
      y: IRON_JUNCTION_OVERPASS_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT,
      z: raw(25),
      facing: 0
    },
    obstacles: getArenaObstacles("iron_junction"),
    mapId: "iron_junction"
  });
  assert.ok(path.length > 0);
  assert.equal(path.at(-1)?.y, IRON_JUNCTION_OVERPASS_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT);
  assert.ok(path.some((point) => Number(point.y) > IRON_JUNCTION_LOADING_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT));
});

test("Iron Junction required routes remain connected across teams and levels", () => {
  const obstacles = getArenaObstacles("iron_junction");
  const spawns = getTeamSpawnsForMap("iron_junction");
  const ground = (x: number, z: number) => ({ x: raw(x), y: ARENA_PLAYER_EYE_HEIGHT, z: raw(z), facing: 0 });
  const loading = (x: number, z: number) => ({
    x: raw(x),
    y: IRON_JUNCTION_LOADING_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT,
    z: raw(z),
    facing: 0
  });
  const upper = (x: number, z: number) => ({
    x: raw(x),
    y: IRON_JUNCTION_OVERPASS_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT,
    z: raw(z),
    facing: 0
  });
  const yard = ground(0, 58);
  const warehouse = ground(-110, -110);
  const tunnel = ground(-35, 218);
  const overpass = upper(-40, 25);
  const requiredRoutes = [
    ["Blue spawn → rail yard", spawns.blue[0], yard],
    ["Blue spawn → warehouse", spawns.blue[5], warehouse],
    ["Blue spawn → tunnel", spawns.blue[15], tunnel],
    ["Red spawn → rail yard", spawns.red[0], yard],
    ["Red spawn → warehouse", spawns.red[5], warehouse],
    ["Red spawn → upper route", spawns.red[10], overpass],
    ["Rail yard → overpass", yard, overpass],
    ["Overpass → warehouse mezzanine", overpass, loading(-140, -57)],
    ["Warehouse → tunnel", warehouse, tunnel],
    ["Tunnel → rail yard", tunnel, yard],
    ["Ground → upper", ground(178, 25), overpass],
    ["Upper → ground", overpass, ground(178, 25)]
  ] as const;
  for (const [label, from, to] of requiredRoutes) {
    const path = findBotNavigationPath({ from, to, obstacles, mapId: "iron_junction" });
    assert.ok(path.length > 0, `${label} should have a navigation path`);
    assert.ok(Math.hypot(path.at(-1)!.x - to.x, path.at(-1)!.z - to.z) < 0.01, `${label} should reach its destination`);
  }
});

test("Iron Junction scale matches target sprint timings", () => {
  const spawns = getTeamSpawnsForMap("iron_junction");
  const central = { x: 0, z: raw(58) };
  const sprintSpeed = 14.8;
  const blueToCenter = Math.hypot(spawns.blue[0].x - central.x, spawns.blue[0].z - central.z) / sprintSpeed;
  const baseToBase = Math.hypot(spawns.blue[0].x - spawns.red[0].x, spawns.blue[0].z - spawns.red[0].z) / sprintSpeed;
  assert.ok(blueToCenter >= 10 && blueToCenter <= 15, `spawn to center was ${blueToCenter.toFixed(1)}s`);
  assert.ok(baseToBase >= 20 && baseToBase <= 30, `fast base route was ${baseToBase.toFixed(1)}s`);
});

test("Iron Junction overpass offers Heavy Blaster angles without controlling the yard", () => {
  const obstacles = getArenaObstacles("iron_junction");
  const from = {
    x: raw(-45),
    y: IRON_JUNCTION_OVERPASS_LEVEL_Y + ARENA_PLAYER_EYE_HEIGHT,
    z: raw(25)
  };
  const yardSamples = [-160, -100, -40, 20, 80, 140].flatMap((x) =>
    [-42, 0, 42, 82].map((z) => ({ x: raw(x), y: ARENA_PLAYER_EYE_HEIGHT, z: raw(z) }))
  );
  const visibleSamples = yardSamples.filter((to) => hasLineOfSight({ from, to, obstacles, padding: 0 }));
  assert.ok(visibleSamples.length >= 2, "the upper route should expose useful firing angles");
  assert.ok(visibleSamples.length <= 8, "the upper route should not control the full yard");
  for (const spawn of [getTeamSpawnsForMap("iron_junction").blue[0], getTeamSpawnsForMap("iron_junction").red[0]]) {
    assert.equal(hasLineOfSight({ from, to: spawn, obstacles, padding: 0 }), false);
  }
});
