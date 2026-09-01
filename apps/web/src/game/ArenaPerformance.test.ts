import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  AutoGraphicsQualityController,
  evaluateArenaBudget,
  estimateSceneTextureBytes,
  getArenaRenderBudget
} from "./ArenaPerformance";
import { resolveArenaQuality } from "./gamePreferences";

const sample = (fps: number, frameMsP95 = fps >= 55 ? 16 : 32) => ({
  frames: 60,
  sampleSeconds: 1,
  fps,
  frameMsP95
});

test("auto graphics lowers quality after sustained poor gameplay performance", () => {
  const controller = new AutoGraphicsQualityController("high", { cooldownMs: 0 });
  assert.equal(controller.update(sample(34), 1), undefined);
  assert.equal(controller.update(sample(34), 2), undefined);
  assert.deepEqual(controller.update(sample(34), 3), { quality: "balanced", direction: "lower" });
});

test("one isolated slow frame does not lower quality", () => {
  const controller = new AutoGraphicsQualityController("balanced", { cooldownMs: 0 });
  assert.equal(controller.update(sample(60, 17), 1), undefined);
  assert.equal(controller.update(sample(34, 23), 2), undefined);
  assert.equal(controller.quality, "balanced");
});

test("quality changes use hysteresis and a cooldown instead of oscillating", () => {
  const controller = new AutoGraphicsQualityController("high", { cooldownMs: 10 });
  assert.equal(controller.update(sample(34), 1), undefined);
  assert.equal(controller.update(sample(34), 2), undefined);
  assert.deepEqual(controller.update(sample(34), 3), { quality: "balanced", direction: "lower" });
  assert.equal(controller.update(sample(60, 16), 4), undefined);
  for (let now = 5; now < 12; now += 1) assert.equal(controller.update(sample(60, 16), now), undefined);
  assert.deepEqual(controller.update(sample(60, 16), 13), { quality: "high", direction: "raise" });
});

test("cooldown remains in force while Auto moves through multiple quality levels", () => {
  const controller = new AutoGraphicsQualityController("high", { poorSampleCount: 1, cooldownMs: 20 });
  assert.deepEqual(controller.update(sample(30), 1), { quality: "balanced", direction: "lower" });
  assert.equal(controller.update(sample(30), 10), undefined);
  assert.equal(controller.update(sample(30), 20), undefined);
  assert.deepEqual(controller.update(sample(30), 21), { quality: "performance", direction: "lower" });
});

test("manual quality is not sent through the auto controller", () => {
  assert.equal(resolveArenaQuality("performance", 3), "performance");
  assert.equal(resolveArenaQuality("balanced", 3), "balanced");
  assert.equal(resolveArenaQuality("high", 1), "high");
});

test("balanced render budgets accept the Athletics reference profile", () => {
  const budget = getArenaRenderBudget("balanced");
  const evaluation = evaluateArenaBudget({
    fps: 73,
    frameMsP95: 16.8,
    drawCalls: 1414,
    triangles: 575266,
    shadowCasters: 48,
    activeParticles: 12
  }, budget);
  assert.equal(evaluation.withinBudget, true);
  assert.deepEqual(evaluation.violations, []);
});

test("budget evaluation names every exceeded guardrail", () => {
  const budget = getArenaRenderBudget("performance");
  const evaluation = evaluateArenaBudget({
    fps: 30,
    frameMsP95: 40,
    drawCalls: 2000,
    triangles: 900000,
    textureMb: 40,
    shadowCasters: 300,
    activeParticles: 40
  }, budget);
  assert.deepEqual(evaluation.violations, ["fps", "frame-p95", "draw-calls", "triangles", "textures", "shadow-casters", "particles"]);
});

test("texture budget estimation counts shared scene maps once", () => {
  const scene = new THREE.Scene();
  const texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16, THREE.RGBAFormat);
  texture.generateMipmaps = false;
  const material = new THREE.MeshBasicMaterial({ map: texture });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  assert.equal(estimateSceneTextureBytes(scene), 32 * 16 * 4);
  material.dispose();
  texture.dispose();
});
