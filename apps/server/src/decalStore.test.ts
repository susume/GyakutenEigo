import test from "node:test";
import assert from "node:assert/strict";
import { DecalStore, type StoredDecal } from "./decalStore.js";

const makeAsset = (overrides: Partial<StoredDecal> = {}): StoredDecal => ({
  id: "asset-1",
  sessionId: "session-1",
  playerId: "player-1",
  mimeType: "image/png",
  bytes: new Uint8Array(4),
  createdAt: 1_000,
  ...overrides
});

test("decal store replaces only a player's pending asset", () => {
  const store = new DecalStore(100, 10_000);
  assert.equal(store.put(makeAsset()).ok, true);
  assert.equal(store.put(makeAsset({ id: "active", bytes: new Uint8Array(5), createdAt: 2_000 }), "asset-1").ok, true);
  const result = store.put(makeAsset({ id: "new-pending", bytes: new Uint8Array(6), createdAt: 3_000 }), "active");
  assert.deepEqual(result, { ok: true, removedAssetIds: ["asset-1"] });
  assert.deepEqual(store.listSession("session-1").map((asset) => asset.assetId), ["new-pending", "active"]);
});

test("decal store enforces a room byte quota without deleting existing assets", () => {
  const store = new DecalStore(8, 10_000);
  store.put(makeAsset({ id: "one", playerId: "p1", bytes: new Uint8Array(5) }));
  const result = store.put(makeAsset({ id: "two", playerId: "p2", bytes: new Uint8Array(4) }));
  assert.deepEqual(result, { ok: false, reason: "room_quota_exceeded" });
  assert.equal(store.get("one")?.bytes.byteLength, 5);
  assert.equal(store.get("two"), undefined);
});

test("decal metadata contains no image bytes and reports expiry", () => {
  const store = new DecalStore(100, 5_000);
  store.put(makeAsset());
  assert.deepEqual(store.listSession("session-1"), [{
    assetId: "asset-1",
    playerId: "player-1",
    mimeType: "image/png",
    byteLength: 4,
    createdAt: 1_000,
    expiresAt: 6_000
  }]);
  assert.equal("bytes" in store.listSession("session-1")[0], false);
});

test("decal store deletes all room or player assets", () => {
  const store = new DecalStore();
  store.put(makeAsset({ id: "p1" }));
  store.put(makeAsset({ id: "p2", playerId: "player-2" }));
  store.put(makeAsset({ id: "other", sessionId: "session-2" }));
  assert.deepEqual(store.deletePlayer("session-1", "player-1"), ["p1"]);
  assert.deepEqual(store.deleteSession("session-1"), ["p2"]);
  assert.ok(store.get("other"));
});

test("decal store prunes expired assets", () => {
  const store = new DecalStore(100, 1_000);
  store.put(makeAsset({ id: "old", createdAt: 1_000 }));
  store.put(makeAsset({ id: "new", playerId: "player-2", createdAt: 2_500 }));
  assert.deepEqual(store.pruneExpired(2_001).map((asset) => asset.id), ["old"]);
  assert.equal(store.get("new")?.id, "new");
});
