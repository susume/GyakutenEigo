import assert from "node:assert/strict";
import test from "node:test";
import { emitArenaVfx, getArenaVfxColor, getArenaVfxStyle, subscribeArenaVfx, type ArenaVfxKind } from "./ArenaVfx";

test("arena VFX events are delivered until the listener unsubscribes", () => {
  const received: unknown[] = [];
  const unsubscribe = subscribeArenaVfx((event) => received.push(event));
  const event = { kind: "objective" as const, x: 12, z: -8, team: "blue" as const };
  emitArenaVfx(event);
  assert.deepEqual(received, [event]);
  unsubscribe();
  emitArenaVfx({ kind: "impact", x: 0, z: 0 });
  assert.equal(received.length, 1);
});

test("weapon fire remains cold snow-colored for both teams", () => {
  assert.equal(getArenaVfxColor({ kind: "weapon_fire", x: 0, z: 0, team: "blue" }), "#b9f4ff");
  assert.equal(getArenaVfxColor({ kind: "weapon_fire", x: 0, z: 0, team: "red" }), "#b9f4ff");
});

test("secondary effects stay inside the strict world-coverage budget", () => {
  const kinds: ArenaVfxKind[] = [
    "weapon_fire",
    "healing",
    "flag_plant",
    "flag_capture",
    "objective_progress",
    "round_start",
    "round_end",
    "heavy_fire",
    "zoom",
    "cooldown"
  ];
  for (const kind of kinds) {
    const style = getArenaVfxStyle(kind);
    assert.ok(style.radius <= 6, `${kind} exceeded the radius budget`);
    assert.ok(style.lifetime <= 1100, `${kind} exceeded the lifetime budget`);
  }
});
