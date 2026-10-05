import test from "node:test";
import assert from "node:assert/strict";
import { ATHLETICS_STADIUM_COURSE, getAthleticsPhysicalSupport, ATHLETICS_PLAYER_EYE_HEIGHT } from "./athleticsRace.js";
import { getZeusCycle, getZeusStrikeRecovery, startZeusGreen, getZeusLight, isZeusStopEnforced, ZEUS_CHANTS, ZEUS_CHANT_LEAD_MS, ZEUS_STOP_GRACE_MS, ZEUS_SUMMIT_CHECKPOINT_COUNT, ZEUS_SUMMIT_SURFACE_INDEX } from "./zeusDaruma.js";

test("Zeus strikes return each ascent level to the previous level's safe start", () => {
  // These are the authored level starts, not the most recent individual jump.
  const expectedSurfaces = [0, 0, 10, 21, 32, 43];
  for (const [checkpointIndex, expectedSurface] of expectedSurfaces.entries()) {
    for (const laneIndex of [0, 1, 7, 39]) {
      const recovery = getZeusStrikeRecovery({ checkpointIndex, energy: 741, laneIndex, totalPlayers: 40 });
      assert.equal(recovery.surfaceIndex, expectedSurface);
      assert.equal(getAthleticsPhysicalSupport(recovery.spawn).surfaceIndex, expectedSurface, "every spawn must land safely on the authored checkpoint");
      assert.equal(recovery.checkpointIndex, Math.max(0, checkpointIndex - 1));
      assert.equal(recovery.routeProgress, ATHLETICS_STADIUM_COURSE.sections[Math.max(0, checkpointIndex - 1)]!.startProgress);
      assert.equal(recovery.energy, 370.5, "fractional fuel is halved without an extra rounding penalty");
    }
  }
});

test("Zeus energy penalties stay finite and never refill an empty runner", () => {
  for (const [energy, expected] of [[0, 0], [1, .5], [1000, 500], [-10, 0], [Infinity, 0], [NaN, 0], [undefined, 0]] as const) {
    assert.equal(getZeusStrikeRecovery({ checkpointIndex: 3, energy }).energy, expected);
  }
});

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
  assert.equal(new Set(cycles.map((cycle) => cycle.chantId)).size, 6);
  assert.deepEqual(cycles[8], getZeusCycle(123, 8));
});

test("Zeus gives each room all six rhythms without consecutive repeats after the teaching cycles", () => {
  for (const seed of [0, 1, 123, 456, 0xffffffff]) {
    const cycles = Array.from({ length: 62 }, (_, i) => getZeusCycle(seed, i));
    for (let i = 2; i < cycles.length; i++) {
      assert.notEqual(cycles[i]!.chantId, cycles[i - 1]!.chantId, `seed ${seed}, cycle ${i}`);
      assert.equal(cycles[i]!.greenMs, ZEUS_CHANT_LEAD_MS + ZEUS_CHANTS[cycles[i]!.chantId].durationMs);
    }
    for (let i = 2; i < cycles.length; i += 6) assert.equal(new Set(cycles.slice(i, i + 6).map((cycle) => cycle.chantId)).size, 6);
  }
  assert.notDeepEqual(Array.from({ length: 6 }, (_, i) => getZeusCycle(123, i + 2).chantId), Array.from({ length: 6 }, (_, i) => getZeusCycle(456, i + 2).chantId));
});
