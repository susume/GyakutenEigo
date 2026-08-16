import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ArenaVfxPool, emitArenaVfx, getArenaVfxBudget, getArenaVfxColor, getArenaVfxStyle, getArenaVfxTextureKeys, subscribeArenaVfx, type ArenaVfxKind } from "./ArenaVfx";

test("arena VFX events are delivered until the listener unsubscribes", () => {
  const received: unknown[] = [];
  const unsubscribe = subscribeArenaVfx((event) => received.push(event));
  const event = { kind: "objective" as const, x: 12, z: -8, team: "blue" as const };
  emitArenaVfx(event);
  assert.deepEqual(received, [event]);
  unsubscribe();
  emitArenaVfx({ kind: "impact", x: 0, z: 0 });
  assert.equal(received.length, 1);
});

test("weapon fire remains cold snow-colored for both teams", () => {
  assert.equal(getArenaVfxColor({ kind: "weapon_fire", x: 0, z: 0, team: "blue" }), "#b9f4ff");
  assert.equal(getArenaVfxColor({ kind: "weapon_fire", x: 0, z: 0, team: "red" }), "#b9f4ff");
});

test("environment effects select readable surface colors and textures", () => {
  assert.equal(getArenaVfxColor({ kind: "footstep", x: 0, z: 0, surface: "sand" }), "#d6b77a");
  assert.equal(getArenaVfxColor({ kind: "footstep", x: 0, z: 0, surface: "water" }), "#7dd3fc");
  assert.deepEqual(getArenaVfxTextureKeys({ kind: "footstep", x: 0, z: 0, surface: "metal" }), ["spark", undefined]);
  assert.deepEqual(getArenaVfxTextureKeys({ kind: "impact", x: 0, z: 0, surface: "snow" }), ["snow", "circle"]);
});

test("secondary effects stay inside the strict world-coverage budget", () => {
  const kinds: ArenaVfxKind[] = [
    "weapon_fire",
    "healing",
    "flag_plant",
    "flag_capture",
    "objective_progress",
    "round_start",
    "round_end",
    "heavy_fire",
    "zoom",
    "cooldown"
  ];
  for (const kind of kinds) {
    const style = getArenaVfxStyle(kind);
    assert.ok(style.radius <= 6, `${kind} exceeded the radius budget`);
    assert.ok(style.lifetime <= 1100, `${kind} exceeded the lifetime budget`);
  }
});

test("pooled VFX stays bounded, culls distant remote cues, and recycles", () => {
  assert.deepEqual(getArenaVfxBudget(0), { maxActive: 6, maxSprites: 6, maxDistance: 120 });
  assert.deepEqual(getArenaVfxBudget(1), { maxActive: 12, maxSprites: 24, maxDistance: 200 });
  assert.deepEqual(getArenaVfxBudget(2), { maxActive: 16, maxSprites: 48, maxDistance: 280 });
  const scene = new THREE.Scene();
  const pool = new ArenaVfxPool(scene, 0);
  pool.setViewPosition({ x: 0, z: 0 });
  assert.equal(pool.emit({ kind: "impact", x: 200, z: 0 }), false);
  assert.equal(pool.emit({ kind: "reward_burst", x: 200, z: 0, local: true }), true);
  for (let index = 0; index < 20; index += 1) pool.emit({ kind: "impact", x: index, z: index });
  assert.ok(pool.activeCount <= 6);
  assert.ok(pool.particleCount <= 10);
  pool.update(performance.now() + 2_000);
  assert.equal(pool.activeCount, 0);
  pool.dispose();
});

test("the pool uses free capacity before evicting an active effect", () => {
  const scene = new THREE.Scene();
  const pool = new ArenaVfxPool(scene, 0);
  pool.emit({ kind: "victory", x: 0, z: 0 }, 0);
  pool.emit({ kind: "footstep", x: 1, z: 0 }, 0);
  for (let index = 2; index < 6; index += 1) pool.emit({ kind: "victory", x: index, z: 0 }, 0);
  assert.equal(pool.activeCount, 6);
  pool.update(200);
  assert.equal(pool.activeCount, 5);
  pool.emit({ kind: "victory", x: 7, z: 0 }, 200);
  assert.equal(pool.activeCount, 6);
  pool.dispose();
});

test("low-priority ambience cannot evict a major cue near the end of its lifetime", () => {
  const scene = new THREE.Scene();
  const pool = new ArenaVfxPool(scene, 0);
  for (let index = 0; index < 6; index += 1) pool.emit({ kind: "victory", x: index, z: 0 }, 0);
  assert.equal(pool.emit({ kind: "footstep", x: 7, z: 0 }, 900), false);
  assert.equal(pool.activeCount, 6);
  assert.equal(pool.getStats().dropped, 1);
  pool.dispose();
});

test("sprite textures and rotation are updated through SpriteMaterial", () => {
  const scene = new THREE.Scene();
  const circle = new THREE.Texture();
  const pool = new ArenaVfxPool(scene, 0, { circle });
  pool.emit({ kind: "footstep", x: 0, z: 0, surface: "water" }, 0);
  const group = scene.children[0] as THREE.Group;
  const sprite = group.children.find((child): child is THREE.Sprite => child instanceof THREE.Sprite);
  assert.ok(sprite);
  assert.equal(sprite.material.map, circle);
  const initialRotation = sprite.material.rotation;
  pool.update(90);
  assert.notEqual(sprite.material.rotation, initialRotation);
  pool.dispose();
  circle.dispose();
});
