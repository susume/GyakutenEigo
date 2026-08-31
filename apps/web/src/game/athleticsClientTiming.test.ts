import assert from "node:assert/strict";
import test from "node:test";
import {
  getAthleticsDashMultiplier,
  getAthleticsJumpVelocityMultiplier,
  isServerDeadlineActive
} from "./athleticsClientTiming.js";

test("Athletics ability deadlines use the server epoch clock and expire", () => {
  const nowMs = Date.parse("2026-08-31T12:00:00.000Z");
  const activeUntil = new Date(nowMs + 1_000).toISOString();
  const expiredAt = new Date(nowMs - 1).toISOString();

  assert.equal(isServerDeadlineActive(activeUntil, nowMs), true);
  assert.equal(isServerDeadlineActive(expiredAt, nowMs), false);
  assert.equal(getAthleticsDashMultiplier(activeUntil, nowMs), 1.42);
  assert.equal(getAthleticsDashMultiplier(expiredAt, nowMs), 1);
});

test("Super Jump is stronger than low gravity and returns to normal", () => {
  const nowMs = Date.parse("2026-08-31T12:00:00.000Z");
  const activeUntil = new Date(nowMs + 2_500).toISOString();

  assert.equal(getAthleticsJumpVelocityMultiplier({ jumpBoostUntil: activeUntil, chaosJumpHeightCap: 7.2, nowMs }), 1.42);
  assert.equal(getAthleticsJumpVelocityMultiplier({ chaosJumpHeightCap: 7.2, nowMs }), 1.26);
  assert.equal(getAthleticsJumpVelocityMultiplier({ nowMs }), 1);
});
