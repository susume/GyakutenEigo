import assert from "node:assert/strict";
import test from "node:test";
import { HudManager, type HudClock, type HudVitals } from "./HudManager";
import { getPlayerHealthMax } from "@quizstrike/shared";

test("browser timers are invoked without binding the clock as their receiver", (context) => {
  context.mock.method(globalThis, "setTimeout", function (this: unknown) {
    assert.ok(this === undefined || this === globalThis);
    return 1 as unknown as ReturnType<typeof setTimeout>;
  });
  context.mock.method(globalThis, "clearTimeout", function (this: unknown) {
    assert.ok(this === undefined || this === globalThis);
  });
  const manager = new HudManager();
  manager.dispatch({ type: "combat" });
  manager.dispose();
});

function harness() {
  let now = 0, nextId = 0;
  const timers = new Map<number, { callback: () => void; at: number }>();
  const clock: HudClock = { now: () => now,
    schedule: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, at: now + delay }); return id as unknown as ReturnType<typeof setTimeout>; },
    cancel: (id) => { timers.delete(id as unknown as number); }
  };
  const manager = new HudManager(clock);
  const vitals: HudVitals = { health: 100, maxHealth: 100, energy: 100, maxEnergy: 100, alive: true, active: true, alwaysVisible: false };
  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].callback();
    }
    now = target;
  };
  return { manager, vitals, advance, timers };
}

test("full vitals fade, combat interrupts fading and extends its deadline", () => {
  const { manager, vitals, advance } = harness();
  manager.dispatch({ type: "vitals", vitals }); advance(2500);
  assert.equal(manager.getSnapshot().healthVisible, false);
  manager.dispatch({ type: "combat" }); advance(4000);
  manager.dispatch({ type: "combat" }); advance(4999);
  assert.equal(manager.getSnapshot().inCombat, true);
  advance(1);
  assert.deepEqual(manager.getSnapshot(), { healthVisible: false, energyVisible: false, inCombat: false });
});

test("damage and depleted energy remain visible independently", () => {
  const { manager, vitals, advance } = harness();
  manager.dispatch({ type: "vitals", vitals }); advance(3000);
  manager.dispatch({ type: "vitals", vitals: { ...vitals, health: 20 } });
  assert.equal(manager.getSnapshot().inCombat, true); advance(5000);
  assert.equal(manager.getSnapshot().healthVisible, true);
  assert.equal(manager.getSnapshot().energyVisible, false);
  manager.dispatch({ type: "vitals", vitals: { ...vitals, energy: 0 } }); advance(3000);
  assert.equal(manager.getSnapshot().healthVisible, false);
  assert.equal(manager.getSnapshot().energyVisible, true);
});

test("armor and speed perks use the gameplay health maximum when deciding whether to fade", () => {
  const { manager, vitals, advance } = harness();
  const maxHealth = getPlayerHealthMax({ gear: "starter_blaster", perks: ["shield_vest", "speed_shoes"] });
  assert.equal(maxHealth, 200);
  manager.dispatch({ type: "vitals", vitals: { ...vitals, health: 200, maxHealth } });
  advance(2500);
  assert.equal(manager.getSnapshot().healthVisible, false);
  manager.dispatch({ type: "vitals", vitals: { ...vitals, health: 150, maxHealth } });
  advance(5000);
  assert.equal(manager.getSnapshot().healthVisible, true);
});

test("identical network snapshots do not keep resetting idle visibility", () => {
  const { manager, vitals, advance } = harness();
  manager.dispatch({ type: "vitals", vitals }); advance(2000);
  manager.dispatch({ type: "vitals", vitals: { ...vitals } }); advance(500);
  assert.equal(manager.getSnapshot().healthVisible, false);
});

test("inactive, eliminated and accessibility contexts keep vitals visible", () => {
  for (const update of [{ active: false }, { alive: false }, { alwaysVisible: true }]) {
    const { manager, vitals, advance } = harness();
    manager.dispatch({ type: "vitals", vitals: { ...vitals, ...update } }); advance(20000);
    assert.equal(manager.getSnapshot().healthVisible, true);
    assert.equal(manager.getSnapshot().energyVisible, true);
  }
});

test("subscriptions only notify on visibility changes, teardown cancels deadlines", () => {
  const { manager, vitals, advance, timers } = harness();
  let calls = 0;
  const unsubscribe = manager.subscribe(() => calls++);
  manager.dispatch({ type: "vitals", vitals }); advance(2500);
  assert.equal(calls, 1);
  manager.dispatch({ type: "combat" }); assert.equal(timers.size, 1);
  unsubscribe(); manager.dispose();
  assert.equal(timers.size, 0); advance(10000); assert.equal(calls, 2);
});
