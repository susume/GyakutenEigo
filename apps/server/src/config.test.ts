import assert from "node:assert/strict";
import test from "node:test";
import { loadServerConfig } from "./config.js";

test("server configuration parses safe defaults and bounded numeric values", () => {
  const config = loadServerConfig({ NODE_ENV: "test", PORT: "4500", ROOM_LEASE_MS: "12000", ROOM_LEASE_RENEW_MS: "4000" });
  assert.equal(config.port, 4500);
  assert.equal(config.runtimeStore, "in-memory");
  assert.equal(config.roomLeaseMs, 12_000);
  assert.equal(config.roomLeaseRenewMs, 4_000);
  assert.ok(config.instanceId);
});

test("production secrets and unavailable Redis mode fail closed", () => {
  assert.throws(() => loadServerConfig({ NODE_ENV: "production" }), /JWT_SECRET/);
  assert.throws(() => loadServerConfig({ NODE_ENV: "test", RUNTIME_STORE: "redis" }), /not available/);
});

