import assert from "node:assert/strict";
import test from "node:test";
import { ServerHelloSchema } from "@quizstrike/shared";

test("client connection accepts only structurally valid server handshakes", () => {
  assert.equal(ServerHelloSchema.safeParse({
    type: "server_hello",
    protocolVersion: 1,
    minimumSupportedVersion: 1,
    maximumSupportedVersion: 1,
    connectionId: "socket-1",
    serverTime: Date.now()
  }).success, true);
  assert.equal(ServerHelloSchema.safeParse({ type: "server_hello", protocolVersion: 99 }).success, false);
});

