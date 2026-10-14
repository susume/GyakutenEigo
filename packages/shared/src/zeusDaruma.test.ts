import test from "node:test";
import assert from "node:assert/strict";
import { ATHLETICS_STADIUM_COURSE, getAthleticsPhysicalSupport, ATHLETICS_PLAYER_EYE_HEIGHT } from "./athleticsRace.js";
import { getZeusCycle, getZeusStrikeRecovery, startZeusGreen, getZeusLight, isZeusStopEnforced, getZeusStopCountdown, getZeusChantStartAt, shouldPlayZeusChant, ZEUS_CHANTS, ZEUS_STOP_WARNING_MS, ZEUS_STOP_GRACE_MS, ZEUS_STRIKE_ENERGY_RETAINED, ZEUS_SUMMIT_CHECKPOINT_COUNT, ZEUS_SUMMIT_SURFACE_INDEX } from "./zeusDaruma.js";

test("Zeus mistakes preserve every earned checkpoint and return to the current level's safe start", () => {
  // These are the authored level starts, not the most recent individual jump.
  const expectedSurfaces = [0, 10, 21, 32, 43, 54];
  for (const [checkpointIndex, expectedSurface] of expectedSurfaces.entries()) {
    for (const laneIndex of [0, 1, 7, 39]) {
      const recovery = getZeusStrikeRecovery({ checkpointIndex, energy: 741, laneIndex, totalPlayers: 40 });
      assert.equal(recovery.surfaceIndex, expectedSurface);
      assert.equal(getAthleticsPhysicalSupport(recovery.spawn).surfaceIndex, expectedSurface, "every spawn must land safely on the authored checkpoint");
      assert.equal(recovery.checkpointIndex, checkpointIndex);
      assert.equal(recovery.routeProgress, ATHLETICS_STADIUM_COURSE.sections[checkpointIndex]!.startProgress);
      assert.equal(recovery.energy, 741 * ZEUS_STRIKE_ENERGY_RETAINED, "the small cost preserves fractional fuel without extra rounding");
    }
  }
});

test("Zeus energy penalties stay finite and never refill an empty runner", () => {
  for (const [energy, expected] of [[0, 0], [1, .9], [1000, 900], [-10, 0], [Infinity, 0], [NaN, 0], [undefined, 0]] as const) {
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

test("the chants players actually hear use all six rhythms without consecutive repeats", () => {
  for (const seed of [0xffffffff, ...Array.from({ length: 256 }, (_, i) => i)]) {
    const cycles = Array.from({ length: 183 }, (_, i) => getZeusCycle(seed, i));
    const heard = cycles.filter((_, i) => shouldPlayZeusChant(i));
    for (let i = 1; i < heard.length; i++) {
      assert.notEqual(heard[i]!.chantId, heard[i - 1]!.chantId, `seed ${seed}, spoken chant ${i}`);
      assert.ok(heard[i]!.greenMs >= 14000 && heard[i]!.greenMs <= 17600);
      assert.ok(heard[i]!.redMs >= 2200 && heard[i]!.redMs <= 2600);
    }
    for (let i = 1; i < heard.length; i += 6) assert.equal(new Set(heard.slice(i, i + 6).map((cycle) => cycle.chantId)).size, 6);
  }
  assert.notDeepEqual(Array.from({ length: 6 }, (_, i) => getZeusCycle(123, (i + 1) * 3).chantId), Array.from({ length: 6 }, (_, i) => getZeusCycle(456, (i + 1) * 3).chantId));
});

test("Zeus leaves most playtime for climbing and keeps narration to about once a minute", () => {
  for (const seed of [0, 1, 123, 456, 0xffffffff]) {
    const cycles = Array.from({ length: 60 }, (_, index) => getZeusCycle(seed, index));
    const climbingMs = cycles.reduce((sum, cycle) => sum + cycle.greenMs, 0);
    const totalMs = cycles.reduce((sum, cycle) => sum + cycle.greenMs + cycle.redMs, 0);
    const voiceCount = cycles.filter((_, index) => shouldPlayZeusChant(index)).length;
    assert.ok(climbingMs / totalMs > .84, "children spend at least 84% of time climbing");
    assert.ok(voiceCount / (totalMs / 60000) < 1.3, "the voice does not repeat constantly");
    assert.equal(shouldPlayZeusChant(0), true, "the first cycle teaches the chant");
    assert.equal(shouldPlayZeusChant(1), false);
    assert.equal(shouldPlayZeusChant(2), false);
  }
});

test("Zeus's countdown warns before STOP without changing the movement signal early", () => {
  const green = startZeusGreen(123, 0, 1000);
  const stopAt = Date.parse(green.phaseEndsAt!);
  assert.equal(getZeusStopCountdown(green, stopAt - ZEUS_STOP_WARNING_MS - 1), null);
  assert.equal(getZeusStopCountdown(green, stopAt - ZEUS_STOP_WARNING_MS), 3);
  assert.equal(getZeusStopCountdown(green, stopAt - 2000), 2);
  assert.equal(getZeusStopCountdown(green, stopAt - 1), 1);
  assert.equal(getZeusLight(green, stopAt - 1), "green");
  assert.equal(getZeusStopCountdown(green, stopAt), null);
  assert.equal(getZeusLight(green, stopAt), "red");
  assert.equal(getZeusStopCountdown({ ...green, phase: "red" }, stopAt - 1), null);
  assert.equal(getZeusStopCountdown(undefined, stopAt), null);
});

test("occasional Zeus chants finish at STOP and stay aligned across teacher pauses", () => {
  for (let index = 0; index < 20; index++) {
    const green = startZeusGreen(123, index, 1000);
    const start = getZeusChantStartAt(green);
    assert.equal(start + ZEUS_CHANTS[green.chantId!].durationMs, Date.parse(green.phaseEndsAt!));
    assert.ok(start - Date.parse(green.phaseStartedAt!) > 8000, "a quiet climbing stretch comes first");
    const resumed = { ...green, phaseStartedAt: new Date(46000).toISOString(), phaseEndsAt: new Date(Date.parse(green.phaseEndsAt!) + 45000).toISOString() };
    assert.equal(getZeusChantStartAt(resumed), start + 45000);
  }
  assert.ok(Number.isNaN(getZeusChantStartAt(undefined)));
});
