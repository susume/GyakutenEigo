import assert from "node:assert/strict";
import test from "node:test";
import {
  IdempotentEventConsumer,
  InMemoryJoinCodeDirectory,
  InMemoryRealtimeEventBus,
  InMemoryRoomOwnershipStore,
  InMemoryRoomStateStore,
  LifecycleTimers
} from "./runtimeInfrastructure.js";

test("in-memory room state and join-code directory preserve single-instance behavior", () => {
  const rooms = new InMemoryRoomStateStore<{ code: string }>();
  rooms.set("room-1", { code: "ABC123" });
  assert.equal(rooms.get("room-1")?.code, "ABC123");
  assert.equal([...rooms.values()].length, 1);
  assert.equal(rooms.delete("room-1"), true);

  const codes = new InMemoryJoinCodeDirectory();
  assert.equal(codes.reserve("abc123", "room-1"), true);
  assert.equal(codes.reserve("ABC123", "room-2"), false);
  assert.equal(codes.resolve("AbC123"), "room-1");
  assert.equal(codes.release("ABC123", "room-2"), false);
  assert.equal(codes.release("ABC123", "room-1"), true);
});

test("event bus fan-out and idempotent consumers tolerate duplicate delivery", async () => {
  const bus = new InMemoryRealtimeEventBus();
  const consumer = new IdempotentEventConsumer();
  let deliveries = 0;
  await bus.subscribe("room", async (event) => {
    await consumer.consume(event, () => { deliveries += 1; });
  });
  const event = { eventId: "event-1", originInstanceId: "instance-a", roomId: "room-1", eventType: "match_ended", occurredAt: 1, payload: {} };
  await bus.publish("room", event);
  await bus.publish("room", event);
  assert.equal(deliveries, 1);
  await bus.close();
});

test("room leases renew, expire, fence stale owners, and permit takeover", () => {
  const ownership = new InMemoryRoomOwnershipStore();
  const first = ownership.acquire("room", "a", 100, 1_000);
  assert.ok(first);
  assert.equal(ownership.acquire("room", "b", 100, 1_050), undefined);
  const renewed = ownership.renew("room", "a", first.fencingToken, 100, 1_050);
  assert.equal(renewed?.expiresAt, 1_150);
  assert.equal(ownership.owner("room", 1_151), undefined);
  const takeover = ownership.acquire("room", "b", 100, 1_151);
  assert.ok(takeover);
  assert.notEqual(takeover.fencingToken, first.fencingToken);
  assert.equal(ownership.release("room", "a", first.fencingToken), false);
  assert.equal(ownership.releaseAll("b"), 1);
});

test("deadline reconstruction fires immediately after an expired deadline and cleanup is bounded", async () => {
  const timers = new LifecycleTimers();
  let fired = false;
  timers.deadline(900, () => { fired = true; }, 1_000);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(fired, true);
  timers.interval(() => undefined, 1_000, true);
  assert.equal(timers.size, 1);
  timers.clearAll();
  assert.equal(timers.size, 0);
});

