import assert from "node:assert/strict";
import test from "node:test";
import {
  GAMEPLAY_ANNOUNCEMENTS,
  GameplayAnnouncementManager
} from "./GameplayAnnouncements";

test("gameplay announcement manifest contains the required phrases and asset paths", () => {
  assert.equal(GAMEPLAY_ANNOUNCEMENTS.FLAG_PLANTED.subtitle, "The flag has been planted.");
  assert.equal(GAMEPLAY_ANNOUNCEMENTS.STREAK_MONSTER.subtitle, "Muh-Muh-Muh-Monster!");
  assert.equal(GAMEPLAY_ANNOUNCEMENTS.STREAK_GODLIKE.subtitle, "Guh-Guh-Guh-Godlike!");
  assert.ok(GAMEPLAY_ANNOUNCEMENTS.FLAG_PLANTED.assetPath.endsWith("flag-planted.mp3"));
});

test("announcement manager deduplicates events, rejects stale events, and bounds the queue", () => {
  let now = 10_000;
  const manager = new GameplayAnnouncementManager({
    now: () => now,
    maxQueueSize: 2,
    playAsset: async () => new Promise(() => undefined),
    playFallback: () => undefined
  });

  assert.equal(manager.enqueue({ eventId: "one", announcementKey: "STREAK_HEATING_UP", occurredAt: now }), true);
  assert.equal(manager.enqueue({ eventId: "one", announcementKey: "STREAK_HEATING_UP", occurredAt: now }), false);
  now += 9_000;
  assert.equal(manager.enqueue({ eventId: "stale", announcementKey: "STREAK_HEATING_UP", occurredAt: 10_000 }), false);
  now = 10_000;
  assert.equal(manager.enqueue({ eventId: "two", announcementKey: "STREAK_DOMINATING", occurredAt: now }), true);
  assert.equal(manager.enqueue({ eventId: "three", announcementKey: "STREAK_UNSTOPPABLE", occurredAt: now }), true);
  assert.ok(manager.queuedCount <= 2);
});

test("cleanup clears pending announcements", () => {
  const manager = new GameplayAnnouncementManager({
    playAsset: async () => new Promise(() => undefined),
    playFallback: () => undefined
  });
  manager.enqueue({ eventId: "one", announcementKey: "FLAG_PLANTED", occurredAt: Date.now() });
  manager.clear();
  assert.equal(manager.queuedCount, 0);
  assert.equal(manager.playing, false);
});
