import test from "node:test";
import assert from "node:assert/strict";
import { ATHLETICS_STADIUM_COURSE, getAthleticsPhysicalSupport, ATHLETICS_PLAYER_EYE_HEIGHT } from "./athleticsRace.js";
import { getZeusCycle, startZeusGreen, getZeusLight, isZeusStopEnforced, ZEUS_STOP_GRACE_MS, ZEUS_SUMMIT_CHECKPOINT_COUNT, ZEUS_SUMMIT_SURFACE_INDEX } from "./zeusDaruma.js";

test("Zeus predicts STOP at the chant deadline, gives reaction time, and waits for the server to resume GO", () => {
  const green = startZeusGreen(123, 0, 1000);
  const stopAt = Date.parse(green.phaseEndsAt!);
  assert.equal(getZeusLight(green, stopAt - 1), "green");
  assert.equal(getZeusLight(green, stopAt), "red");
  assert.equal(isZeusStopEnforced(green, stopAt + ZEUS_STOP_GRACE_MS - 1), false);
  assert.equal(isZeusStopEnforced(green, stopAt + ZEUS_STOP_GRACE_MS), true);
  const red = { ...green, phase: "red" as const, phaseEndsAt: new Date(stopAt + 4000).toISOString(), graceEndsAt: new Date(stopAt + ZEUS_STOP_GRACE_MS).toISOString() };
  assert.equal(getZeusLight(red, stopAt + 6000), "red");
  assert.equal(isZeusStopEnforced(undefined, stopAt), false);
});

test("Zeus's summit is a physically occupied ascent checkpoint before the descent", () => {
  const summit = ATHLETICS_STADIUM_COURSE.surfaces[ZEUS_SUMMIT_SURFACE_INDEX]!;
  assert.equal(ZEUS_SUMMIT_CHECKPOINT_COUNT, 6);
  assert.equal(summit.y, Math.max(...ATHLETICS_STADIUM_COURSE.route.map((point) => point.y)));
  assert.equal(getAthleticsPhysicalSupport({ x: summit.x, y: summit.y + ATHLETICS_PLAYER_EYE_HEIGHT, z: summit.z }).surfaceIndex, ZEUS_SUMMIT_SURFACE_INDEX);
  assert.notEqual(ZEUS_SUMMIT_SURFACE_INDEX, ATHLETICS_STADIUM_COURSE.finishSurfaceIndex);
});

test("Zeus opens with slower chants then varies their delivery deterministically", () => {
  assert.equal(getZeusCycle(123, 0).chantId, "slow");
  assert.equal(getZeusCycle(123, 1).chantId, "slow");
  const cycles = Array.from({ length: 20 }, (_, i) => getZeusCycle(123, i));
  assert.equal(new Set(cycles.map((cycle) => cycle.chantId)).size, 3);
  assert.deepEqual(cycles[8], getZeusCycle(123, 8));
});
