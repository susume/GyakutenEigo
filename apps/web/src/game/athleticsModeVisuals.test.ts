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

test("Zeus turns his visible sky head with the shared signal and disappears when defeated", () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1.6, 0.1, 620);
  const visuals = createAthleticsModeVisuals({ scene, mode: "zeus", camera });
  const green = { athletics: { zeus: { phase: "green", phaseStartedAt: new Date(1000).toISOString(), phaseEndsAt: new Date(7000).toISOString() } } } as GameSession;
  const head = scene.getObjectByName("athletics-zeus-head")!;
  const sky = scene.getObjectByName("athletics-zeus-sky")!;
  visuals.update(green, 2000);
  assert.equal(head.rotation.y, Math.PI);
  assert.equal(sky.userData.light, "green");
  visuals.update(green, 7500);
  assert.equal(head.rotation.y, 0, "the head turns at the chant deadline, even before the next snapshot");
  assert.equal(sky.userData.light, "red");
  camera.position.set(80, 50, -90);
  camera.rotation.y = Math.PI / 2;
  visuals.update(green, 7501);
  const projection = sky.position.clone().project(camera);
  assert.ok(projection.x > 0 && projection.x < 1, "course bends keep the head visible beside the HUD");
  assert.ok(projection.y > 0 && projection.y < 1, "head stays in the sky above the course");
  camera.aspect = 375 / 812;
  camera.updateProjectionMatrix();
  visuals.update(green, 7502);
  const phoneProjection = sky.position.clone().project(camera);
  assert.ok(phoneProjection.x > 0.45 && phoneProjection.x < 0.7, "phone head stays beside the central course guidance");
  assert.ok(phoneProjection.y > 0 && phoneProjection.y < 0.12, "phone head sits beneath the top HUD");
  green.athletics!.zeus!.phase = "defeated";
  visuals.update(green, 8000);
  visuals.update(green, 9200);
  assert.equal(sky.visible, false);
  visuals.dispose();
  assert.equal(scene.children.length, 0);
});

test("Zeus sky renders above scenery with its own depth and restores renderer state", () => {
  const scene = new THREE.Scene();
  const background = new THREE.Color("#66aaff");
  scene.background = background;
  const light = new THREE.AmbientLight();
  scene.add(light);
  const camera = new THREE.PerspectiveCamera();
  const visuals = createAthleticsModeVisuals({ scene, mode: "zeus", camera });
  const head = scene.getObjectByName("athletics-zeus-head")!;
  const face = head.children.find((object) => object instanceof THREE.Mesh) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  assert.equal(face.layers.mask, 2, "sky is excluded from the course pass");
  assert.equal(face.material.depthTest, true, "the back of Zeus still hides his face");
  assert.equal(light.layers.mask, 3, "sky retains the course lighting");
  const events: string[] = [];
  const renderer = {
    autoClear: true,
    info: { autoReset: true },
    shadowMap: { autoUpdate: true },
    clearDepth: () => { events.push("clear depth"); },
    render: () => {
      events.push("sky");
      assert.equal(camera.layers.mask, 2);
      assert.equal(scene.background, null);
      assert.equal(renderer.autoClear, false);
      assert.equal(renderer.info.autoReset, false, "draw counts include both passes");
      assert.equal(renderer.shadowMap.autoUpdate, false);
    }
  };
  visuals.renderOverlay!(renderer as unknown as THREE.WebGLRenderer);
  assert.deepEqual(events, ["clear depth", "sky"]);
  const assertRestored = () => {
    assert.equal(camera.layers.mask, 1);
    assert.equal(scene.background, background);
    assert.equal(renderer.autoClear, true);
    assert.equal(renderer.info.autoReset, true);
    assert.equal(renderer.shadowMap.autoUpdate, true);
  };
  assertRestored();
  renderer.render = () => { throw new Error("lost context"); };
  assert.throws(() => visuals.renderOverlay!(renderer as unknown as THREE.WebGLRenderer), /lost context/);
  assertRestored();
  visuals.dispose();
  assert.equal(light.layers.mask, 1);
  assert.deepEqual(scene.children, [light]);
});
