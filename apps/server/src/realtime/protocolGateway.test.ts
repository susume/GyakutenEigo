import assert from "node:assert/strict";
import test from "node:test";
import { PROTOCOL_VERSION } from "@quizstrike/shared";
import { adaptLegacyPayload, createProtocolError, resolveProtocolAdmission } from "./protocolGateway.js";

test("protocol admission accepts the canonical version and rejects explicit incompatibility", () => {
  assert.deepEqual(resolveProtocolAdmission(PROTOCOL_VERSION), {
    accepted: true,
    protocolVersion: PROTOCOL_VERSION
  });
  assert.equal(resolveProtocolAdmission(PROTOCOL_VERSION + 1).accepted, false);
  assert.equal(resolveProtocolAdmission(0).accepted, false);
});

test("protocol errors are user-safe, timestamped, and request-correlated", () => {
  const error = createProtocolError("INVALID_MESSAGE", "Invalid position.", true, "request-1");
  assert.equal(error.type, "protocol_error");
  assert.equal(error.requestId, "request-1");
  assert.equal(error.recoverable, true);
  assert.ok(error.occurredAt > 0);
  assert.equal("stack" in error, false);
});

test("legacy adapter removes repeated room credentials without relaxing canonical fields", () => {
  assert.deepEqual(adaptLegacyPayload("player_position", {
    code: "ABC123",
    playerId: "player-1",
    playerToken: "secret",
    x: 1,
    z: 2
  }), { x: 1, z: 2 });
});
