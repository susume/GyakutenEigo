import assert from "node:assert/strict";
import test from "node:test";
import { AthleticsBattleInput, getAthleticsBattlePointerSource } from "./AthleticsBattleInput";
import type { AthleticsBattleAction } from "@quizstrike/shared";

const setup = (pendingStart?: Promise<boolean>) => {
  let now = 0; let allowed = true; let latestProgress: number | null = null; let hum = false;
  const actions: [AthleticsBattleAction, string][] = [];
  const input = new AthleticsBattleInput({
    canCharge: () => allowed, now: () => now, id: () => `charge-${actions.length}`,
    send: async (action, id) => { actions.push([action, id]); return action === "battle_charge" ? pendingStart ?? true : true; },
    progress: (value) => { latestProgress = value; }, charging: (active) => { hum = active; }
  });
  return { input, actions, time: (value: number) => { now = value; input.update(); }, clock: (value: number) => { now = value; }, block: () => { allowed = false; input.update(); }, progress: () => latestProgress, hum: () => hum };
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test("a full hold fires once, ignores key repeat, and requires a release before another shot", async () => {
  const f = setup(); f.input.setHeld("keyboard", true); await flush();
  f.input.setHeld("keyboard", true);
  f.time(1999); assert.equal(f.actions.length, 1); assert.ok(f.hum());
  f.time(2000); assert.equal(f.actions[1][0], "battle_fire"); assert.equal(f.hum(), false);
  f.time(9000); f.input.setHeld("keyboard", true); assert.equal(f.actions.length, 2);
  f.input.setHeld("keyboard", false); f.input.setHeld("keyboard", true); await flush();
  assert.equal(f.actions[2][0], "battle_charge"); assert.equal(f.progress(), 0);
});

test("release cancels, releasing one of two held controls preserves the charge, and reset stops audio", async () => {
  const f = setup(); f.input.setHeld("mouse", true); f.input.setHeld("keyboard", true); await flush();
  f.time(1000); f.input.setHeld("mouse", false); assert.equal(f.actions.length, 1);
  f.input.setHeld("keyboard", false); assert.equal(f.actions[1][0], "battle_cancel"); assert.equal(f.hum(), false);
  f.input.setHeld("touch", true); await flush(); f.input.reset();
  assert.equal(f.actions.at(-1)![0], "battle_cancel"); assert.equal(f.progress(), null);
});

test("server acknowledgement anchors the hold clock and late acknowledgement cannot revive a cancelled charge", async () => {
  let resolve!: (value: boolean) => void;
  const f = setup(new Promise<boolean>((done) => { resolve = done; }));
  f.input.setHeld("mouse", true); f.time(2800); resolve(true); await flush();
  f.time(3000); assert.equal(f.actions.length, 1);
  f.time(4799); assert.equal(f.actions.length, 1);
  f.time(4800); assert.equal(f.actions[1][0], "battle_fire");
  let lateResolve!: (value: boolean) => void;
  const late = setup(new Promise<boolean>((done) => { lateResolve = done; }));
  late.input.setHeld("keyboard", true); late.input.reset(); lateResolve(true); await flush(); late.time(10000);
  assert.deepEqual(late.actions.map(([action]) => action), ["battle_charge", "battle_cancel"]);
  assert.equal(late.hum(), false);
});

test("stun, a panel opening, or energy dropping cancels a hold and its hum", async () => {
  const f = setup(); f.input.setHeld("keyboard", true); await flush(); f.time(1500); f.block();
  f.time(4000); assert.deepEqual(f.actions.map(([action]) => action), ["battle_charge", "battle_cancel"]);
  assert.equal(f.hum(), false);
});

test("releasing after a complete charge fires even if the next render frame has not run", async () => {
  const f = setup(); f.input.setHeld("keyboard", true); await flush();
  f.clock(2005);
  f.input.setHeld("keyboard", false);
  assert.deepEqual(f.actions.map(([action]) => action), ["battle_charge", "battle_fire"]);
  f.time(2100); assert.equal(f.actions.length, 2);
});

test("charging works on classroom LAN pages where randomUUID is unavailable", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: {} });
  try {
    const ids: string[] = [];
    const input = new AthleticsBattleInput({ canCharge: () => true, send: async (_action, id) => { ids.push(id); return true; }, progress: () => undefined, charging: () => undefined });
    input.setHeld("keyboard", true); await flush(); input.reset();
    assert.equal(ids.length, 2);
    assert.ok(ids[0].length > 0 && ids[0].length <= 128);
    assert.equal(ids[0], ids[1]);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
    else Reflect.deleteProperty(globalThis, "crypto");
  }
});

test("unrelated touch releases do not interrupt the charging finger, and cancellation never fires", async () => {
  const f = setup();
  f.input.setHeld(getAthleticsBattlePointerSource(1), true); await flush();
  f.time(1500);
  f.input.setHeld(getAthleticsBattlePointerSource(2), false);
  f.input.setHeld(getAthleticsBattlePointerSource(3), false, true);
  assert.equal(f.hum(), true);
  assert.equal(f.actions.length, 1);
  f.clock(3100);
  f.input.setHeld(getAthleticsBattlePointerSource(1), false, true);
  assert.deepEqual(f.actions.map(([action]) => action), ["battle_charge", "battle_cancel"]);
});
