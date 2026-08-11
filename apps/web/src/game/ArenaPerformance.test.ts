import assert from "node:assert/strict";
import test from "node:test";
import { AutoGraphicsQualityController } from "./ArenaPerformance";
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
