import assert from "node:assert/strict";
import test from "node:test";
import { emitArenaVfx, subscribeArenaVfx } from "./ArenaVfx";

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
