import assert from "node:assert/strict";
import test from "node:test";
import { consumeSpeakingRateLimit } from "./speakingAdmission.js";

test("speaking admission allows a normal 40-student burst and reports remaining capacity", () => {
  const windows = new Map<string, { startedAtMs: number; count: number }>();
  const decisions = Array.from({ length: 40 }, () => consumeSpeakingRateLimit(windows, "join-valid:classroom", 60, 60_000, 10_000));
  assert.ok(decisions.every((decision) => decision.allowed));
  assert.equal(decisions.at(-1)?.remaining, 20);
  assert.equal(windows.get("join-valid:classroom")?.count, 40);
});

test("speaking admission rejects invalid-code abuse with a retry window", () => {
  const windows = new Map<string, { startedAtMs: number; count: number }>();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal(consumeSpeakingRateLimit(windows, "join-invalid:127.0.0.1", 10, 60_000, 20_000).allowed, true);
  }
  const rejected = consumeSpeakingRateLimit(windows, "join-invalid:127.0.0.1", 10, 60_000, 20_500);
  assert.equal(rejected.allowed, false);
  assert.ok(rejected.retryAfterSeconds >= 59);
  assert.equal(rejected.remaining, 0);
  assert.equal(consumeSpeakingRateLimit(windows, "join-invalid:127.0.0.1", 10, 60_000, 80_001).allowed, true);
});
