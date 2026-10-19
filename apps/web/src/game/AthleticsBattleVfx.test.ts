import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ATHLETICS_BATTLE_RADIUS, type GameSession } from "@quizstrike/shared";
import { createAthleticsBattleVfx, emitAthleticsBattleImpact, emitAthleticsBattleLaunch } from "./AthleticsBattleVfx";

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

test("a local charge visibly builds a casting seal beside the aim line and cancels cleanly", () => {
  const scene = new THREE.Scene(); const visuals = createAthleticsBattleVfx(scene); const session = fixture();
  const local = { playerId: "student", position: { x: 0, y: 4, z: 0 }, facing: 0, pitch: 0.4, progress: 0 as number | null };
  visuals.update(session, 1000, local);
  const charge = scene.getObjectByName("battle-charge-0")!;
  const startingSize = new THREE.Box3().setFromObject(charge).getSize(new THREE.Vector3());
  local.progress = 1;
  visuals.update(session, 3000, local);
  const chargedSize = new THREE.Box3().setFromObject(charge).getSize(new THREE.Vector3());
  assert.ok(chargedSize.x > startingSize.x * 1.5, "the buildup is large enough to read in first person");
  assert.ok(chargedSize.x > 2, "the casting circle has a prominent world-space silhouette");
  assert.ok(charge.position.x > 0.5, "the core stays beside the crosshair");
  const aim = new THREE.Vector3(0, Math.sin(local.pitch), -Math.cos(local.pitch));
  assert.ok(new THREE.Vector3(0, 0, -1).applyQuaternion(charge.quaternion).distanceTo(aim) < 1e-8, "the seal follows pitched aim");
  assert.ok(charge.getObjectByName("battle-casting-sigil"));
  local.progress = null;
  visuals.update(session, 3100, local);
  assert.equal(charge.visible, false, "local release overrides an old charging snapshot immediately");
  visuals.dispose();
});

test("launch rings release once along the shot direction and never replay on a stale snapshot", () => {
  const scene = new THREE.Scene(); const visuals = createAthleticsBattleVfx(scene); const session = fixture();
  visuals.update(session, 1100);
  const launch = scene.getObjectByName("battle-launch-0")!;
  assert.equal(launch.visible, true);
  assert.deepEqual(launch.position.toArray(), [0, 4, -3]);
  const earlyScale = launch.scale.x;
  visuals.update(session, 1300);
  assert.ok(launch.scale.x > earlyScale, "the release ring expands away from the caster");
  assert.equal(scene.getObjectByName("battle-launch-1")!.visible, false, "another snapshot does not duplicate the burst");
  visuals.update(session, 1450);
  assert.equal(launch.visible, false);
  visuals.update(session, 1500);
  assert.equal(launch.visible, false);
  visuals.dispose();
});

test("the full casting circle fits inside a narrow phone view", () => {
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(72, 375 / 812, 0.1, 620);
  camera.position.set(0, 4, 0); camera.updateMatrixWorld();
  const visuals = createAthleticsBattleVfx(scene, true, camera); const session = fixture();
  visuals.update(session, 3000, { playerId: "student", position: { x: 0, y: 4, z: 0 }, facing: 0, pitch: 0, progress: 1 });
  const sigil = scene.getObjectByName("battle-casting-sigil")!;
  const bounds = new THREE.Box3().setFromObject(sigil);
  assert.ok(bounds.min.clone().project(camera).x > -1);
  assert.ok(bounds.max.clone().project(camera).x < 1, "the circle remains visible instead of being cropped at the right edge");
  visuals.dispose();
});

test("fire events show the release even when a short-lived blast never reaches a snapshot", () => {
  const scene = new THREE.Scene(); const visuals = createAthleticsBattleVfx(scene); const session = fixture();
  const blast = session.athletics!.battleBlasts![0];
  session.athletics!.battleBlasts = [];
  visuals.update(session, 1000);
  emitAthleticsBattleLaunch(blast);
  visuals.update(session, 1100);
  assert.equal(scene.getObjectByName("battle-launch-0")!.visible, true);
  session.athletics!.battleBlasts = [blast];
  visuals.update(session, 1150);
  emitAthleticsBattleLaunch(blast);
  assert.equal(scene.getObjectByName("battle-launch-1")!.visible, false, "event and snapshot share one release");
  visuals.dispose();
  emitAthleticsBattleLaunch(blast);
  assert.equal(scene.children.length, 0, "leaving the arena removes the launch listener");
});

test("reduced motion keeps the casting seal and release cue still without gathering particles", () => {
  const scene = new THREE.Scene(); const visuals = createAthleticsBattleVfx(scene, true); const session = fixture();
  const local = { playerId: "student", position: { x: 0, y: 4, z: 0 }, facing: 0, pitch: 0, progress: 0.8 };
  visuals.update(session, 1100, local);
  const sigil = scene.getObjectByName("battle-casting-sigil")!;
  const launch = scene.getObjectByName("battle-launch-0")!;
  const releaseSize = launch.scale.x;
  visuals.update(session, 1150, local);
  assert.equal(sigil.rotation.z, 0);
  assert.equal(scene.getObjectByName("battle-gathering-energy")!.visible, false);
  assert.equal(launch.scale.x, releaseSize);
  assert.equal(launch.visible, true);
  visuals.update(session, 1250, local);
  assert.equal(launch.visible, false);
  visuals.dispose();
});

test("shield glows show stationary readers and recovery protection, then fade without lingering after expiry", () => {
  const scene = new THREE.Scene(); const visuals = createAthleticsBattleVfx(scene, true); const session = fixture();
  const reader = session.players[0]; const recovering = session.players[1];
  reader.athletics!.battleStudyPosition = { x: 0, y: 4, z: 0 };
  recovering.athletics!.battleStunnedUntil = new Date(2000).toISOString();
  recovering.athletics!.battleImmuneUntil = new Date(5000).toISOString();
  visuals.update(session, 1500);
  const readerGlow = scene.getObjectByName("battle-protection-0")!;
  const recoveryGlow = scene.getObjectByName("battle-protection-1")!;
  assert.equal(readerGlow.visible, true);
  assert.equal(recoveryGlow.visible, false, "stun stars are shown until movement returns");
  visuals.update(session, 2000);
  assert.equal(recoveryGlow.visible, true);
  assert.equal(recoveryGlow.rotation.y, 0, "reduced motion keeps shields still");
  visuals.update(session, 4900);
  assert.ok((recoveryGlow.children[0] as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>).material.opacity < 0.08);
  reader.x = 1;
  visuals.update(session, 5000);
  assert.equal(readerGlow.visible, false, "moving away from the reading position removes the glow");
  assert.equal(recoveryGlow.visible, false);
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
