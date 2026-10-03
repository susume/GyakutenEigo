import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CHAOS_HAZARD_WARNING_MS, createChaosWave, getChaosHazardPosition, ATHLETICS_STADIUM_COURSE, type GameSession } from "@quizstrike/shared";
import { createAthleticsModeVisuals } from "./athleticsModeVisuals";

test("Chaos renders a warning before its hazard, then removes both at expiry", () => {
  const scene = new THREE.Scene();
  const visuals = createAthleticsModeVisuals({ scene, mode: "chaos-climb" });
  const nowMs = 10_000;
  const hazards = createChaosWave({ seed: 123, waveIndex: 1, nowMs });
  const session = { athletics: { chaos: { activeHazards: hazards } } } as GameSession;
  const hazard = scene.getObjectByName("athletics-chaos-hazard-0")!;
  const warning = scene.getObjectByName("athletics-chaos-warning-0")!;
  visuals.update(session, nowMs + CHAOS_HAZARD_WARNING_MS - 1);
  assert.equal(warning.visible, true);
  assert.equal(hazard.visible, false);
  visuals.update(session, nowMs + CHAOS_HAZARD_WARNING_MS);
  assert.equal(warning.visible, true);
  assert.equal(hazard.visible, true);
  const travelTime = nowMs + CHAOS_HAZARD_WARNING_MS + 1000;
  visuals.update(session, travelTime);
  const expected = getChaosHazardPosition(hazards[0]!, ATHLETICS_STADIUM_COURSE.route, travelTime);
  assert.equal(hazard.position.x, expected.x);
  assert.equal(hazard.position.y, expected.y);
  assert.equal(hazard.position.z, expected.z);
  assert.equal(warning.position.x, expected.x);
  // Changing the event cannot rewind an in-flight object.
  session.athletics!.chaos!.currentEvent = { id: "speed", type: "speed-round", label: "Speed", startedAt: new Date(nowMs).toISOString(), expiresAt: new Date(travelTime + 100).toISOString() };
  visuals.update(session, travelTime);
  assert.equal(hazard.position.x, expected.x);
  assert.equal(hazard.position.z, expected.z);
  visuals.update(session, Date.parse(hazards[0]!.expiresAt));
  assert.equal(warning.visible, false);
  assert.equal(hazard.visible, false);
  visuals.dispose();
  assert.equal(scene.children.length, 0);
});

test("Zeus warning stays at its actual radius while its countdown closes", () => {
  const scene = new THREE.Scene();
  const visuals = createAthleticsModeVisuals({ scene, mode: "zeus" });
  const session = { athletics: { zeus: { phase: "charging", currentAttack: {
    warningPositions: { runner: { x: 5, y: 24.21, z: 10 } }, strikeRadius: 3.4,
    warningStartedAt: new Date(1000).toISOString(), strikeAt: new Date(3000).toISOString()
  } } } } as GameSession;
  visuals.update(session, 2000);
  const warning = scene.getObjectByName("athletics-zeus-warning-0")!;
  assert.ok(Math.abs(warning.position.y - 20.22) < 0.001);
  assert.equal(warning.children[0]!.scale.x, 3.4);
  assert.equal(warning.children[1]!.scale.x, 1.7);
  visuals.update(session, 2500);
  assert.equal(warning.children[0]!.scale.x, 3.4);
  assert.equal(warning.children[1]!.scale.x, .85);
  visuals.dispose();
});
