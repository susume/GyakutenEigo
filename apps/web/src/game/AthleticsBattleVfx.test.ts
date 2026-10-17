import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ATHLETICS_BATTLE_RADIUS, type GameSession } from "@quizstrike/shared";
import { createAthleticsBattleVfx, emitAthleticsBattleImpact } from "./AthleticsBattleVfx";

const fixture = (): GameSession => ({
  status: "active", settings: { athleticsBattleEnabled: true },
  athletics: { battleBlasts: [{ id: "blast", playerId: "student", origin: { x: 0, y: 4, z: 0 }, direction: { x: 0, y: 0, z: -1 }, launchedAt: 1000, distance: 0 }] },
  players: [{ id: "student", x: 0, y: 4, z: 0, athletics: { battleChargeStartedAt: new Date(1000).toISOString() } },
    { id: "stunned", x: 0, y: 4, z: -12, athletics: { battleStunnedUntil: new Date(6000).toISOString() } }]
} as unknown as GameSession);

test("battle VFX follow authoritative shots, charges and stuns and reuse bounded resources", () => {
  const scene = new THREE.Scene(); const visuals = createAthleticsBattleVfx(scene);
  const session = fixture(); visuals.update(session, 1500);
  const root = scene.getObjectByName("athletics-battle-vfx")!;
  const shot = root.getObjectByName("battle-projectile-0")!;
  assert.equal(shot.position.z, -23);
  assert.equal(shot.children[0].scale.x * shot.scale.x, ATHLETICS_BATTLE_RADIUS, "the visible core matches the hit radius");
  assert.equal(root.getObjectByName("battle-charge-0")!.visible, true);
  assert.equal(root.getObjectByName("battle-stun-1")!.visible, true);
  const objectCount = root.children.length;
  for (let index = 0; index < 100; index++) emitAthleticsBattleImpact({ blastId: "blast", position: { x: 0, y: 4, z: -12 } });
  visuals.update(session, 1600);
  assert.equal(root.children.length, objectCount, "volleys reuse the pool instead of allocating more objects");
  session.athletics!.battleBlasts = [];
  session.players[0].athletics!.battleChargeStartedAt = undefined;
  visuals.update(session, 6500);
  assert.equal(root.getObjectByName("battle-projectile-0")!.visible, false);
  assert.equal(root.getObjectByName("battle-charge-0")!.visible, false);
  assert.equal(root.getObjectByName("battle-stun-1")!.visible, false);
  visuals.dispose();
  assert.equal(scene.children.length, 0);
  emitAthleticsBattleImpact({ blastId: "blast", position: { x: 0, y: 0, z: 0 } });
  assert.equal(scene.children.length, 0, "disposed renderers release event listeners");
});

test("projectile visuals keep their launch ray when the shooter and other students move", () => {
  const scene = new THREE.Scene(); const visuals = createAthleticsBattleVfx(scene); const session = fixture();
  visuals.update(session, 1100);
  session.players[0].x = 20; session.players[0].facing = Math.PI / 2;
  session.players[1].x = 0.8;
  visuals.update(session, 1500);
  const shot = scene.getObjectByName("battle-projectile-0")!;
  assert.deepEqual(shot.position.toArray(), [0, 4, -23]);
  assert.deepEqual(new THREE.Vector3(0, 0, -1).applyQuaternion(shot.quaternion).toArray(), [0, 0, -1]);
  visuals.dispose();
});

test("reduced-motion battle effects keep trajectory and stun information without rotating or throwing sparks", () => {
  const scene = new THREE.Scene(); const visuals = createAthleticsBattleVfx(scene, true); const session = fixture();
  visuals.update(session, 1500);
  emitAthleticsBattleImpact({ blastId: "blast", position: { x: 0, y: 4, z: -12 } });
  visuals.update(session, 1600);
  const root = scene.getObjectByName("athletics-battle-vfx")!;
  const impact = root.getObjectByName("battle-impact-0")!;
  assert.equal(impact.visible, true);
  assert.ok(impact.children.slice(2).every((spark) => !spark.visible));
  assert.equal(root.getObjectByName("battle-stun-1")!.rotation.y, 0);
  session.status = "ended"; visuals.update(session, 1700); assert.equal(root.visible, false);
  visuals.dispose();
});

test("an impact cannot resurrect a projectile from a delayed snapshot or replay its burst", () => {
  const scene = new THREE.Scene(); const visuals = createAthleticsBattleVfx(scene); const session = fixture();
  visuals.update(session, 1500);
  const cue = { blastId: "blast", position: { x: 0, y: 4, z: -12 } };
  emitAthleticsBattleImpact(cue);
  visuals.update(session, 1600);
  const root = scene.getObjectByName("athletics-battle-vfx")!;
  assert.equal(root.getObjectByName("battle-projectile-0")!.visible, false);
  emitAthleticsBattleImpact(cue);
  assert.equal(root.getObjectByName("battle-impact-1")!.visible, false, "duplicate events must not replay impacts");
  visuals.dispose();
});

test("stale or disconnected snapshots cannot leave expired blasts and charge orbs on screen", () => {
  const scene = new THREE.Scene(); const visuals = createAthleticsBattleVfx(scene); const session = fixture();
  visuals.update(session, 8000);
  const root = scene.getObjectByName("athletics-battle-vfx")!;
  assert.equal(root.getObjectByName("battle-projectile-0")!.visible, false);
  assert.equal(root.getObjectByName("battle-charge-0")!.visible, false);
  session.players[0].connectionState = "disconnected";
  visuals.update(session, 1500);
  assert.equal(root.getObjectByName("battle-charge-0")!.visible, false);
  visuals.dispose();
});
