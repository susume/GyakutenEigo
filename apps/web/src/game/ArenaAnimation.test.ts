import assert from "node:assert/strict";
import test from "node:test";
import { emitArenaAnimation, subscribeArenaAnimation } from "./ArenaAnimation";

test("arena animation cues are delivered until the listener unsubscribes", () => {
  const received: unknown[] = [];
  const unsubscribe = subscribeArenaAnimation((event) => received.push(event));
  const event = { kind: "flag_capture" as const, playerId: "player-1", team: "blue" as const };
  emitArenaAnimation(event);
  assert.deepEqual(received, [event]);
  unsubscribe();
  emitArenaAnimation({ kind: "victory", team: "blue" });
  assert.equal(received.length, 1);
});
