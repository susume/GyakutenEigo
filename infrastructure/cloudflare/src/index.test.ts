import assert from "node:assert/strict";
import test from "node:test";
import { getProxyTimeoutMs, isProxyPath, proxyRequest, resolveBackendUrl } from "./index.js";

const env = { BACKEND_ORIGIN: "https://gyakuteneigo-api.onrender.com" };

test("proxy path guard includes API and Socket.IO traffic but not frontend routes", () => {
  assert.equal(isProxyPath("/api/health"), true);
  assert.equal(isProxyPath("/api"), true);
  assert.equal(isProxyPath("/socket.io/?EIO=4&transport=polling"), true);
  assert.equal(isProxyPath("/socket.io"), true);
  assert.equal(isProxyPath("/join"), false);
  assert.equal(isProxyPath("/apiary"), false);
});

test("backend target preserves path and query while using the configured origin", () => {
  assert.equal(
    resolveBackendUrl("https://gyakuteneigo.com/api/health?check=1", env.BACKEND_ORIGIN).toString(),
    "https://gyakuteneigo-api.onrender.com/api/health?check=1"
  );
});

test("API proxy forwards method, body, query, and authentication headers without caching", async () => {
  let forwarded: Request | undefined;
  const response = await proxyRequest(
    new Request("https://gyakuteneigo.com/api/sessions/ABC123/join?source=check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer teacher-token",
        "X-Player-Token": "player-token"
      },
      body: JSON.stringify({ nickname: "Student" })
    }),
    env,
    async (request) => {
      forwarded = request;
      return new Response('{"ok":true}', { status: 200, headers: { "Content-Type": "application/json" } });
    }
  );

  assert.equal(forwarded?.url, "https://gyakuteneigo-api.onrender.com/api/sessions/ABC123/join?source=check");
  assert.equal(forwarded?.method, "POST");
  assert.equal(forwarded?.headers.get("Authorization"), "Bearer teacher-token");
  assert.equal(forwarded?.headers.get("X-Player-Token"), "player-token");
  assert.equal(forwarded?.headers.get("Content-Type"), "application/json");
  assert.deepEqual(await forwarded?.json(), { nickname: "Student" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("Socket.IO upgrade responses are returned directly and upgrade headers are preserved", async () => {
  let forwarded: Request | undefined;
  const upgradeResponse = { status: 101 } as Response;
  const response = await proxyRequest(
    new Request("https://gyakuteneigo.com/socket.io/?EIO=4&transport=websocket", {
      headers: { Upgrade: "websocket", Connection: "Upgrade", "X-Player-Token": "player-token" }
    }),
    env,
    async (request) => {
      forwarded = request;
      return upgradeResponse;
    }
  );

  assert.equal(forwarded?.url, "https://gyakuteneigo-api.onrender.com/socket.io/?EIO=4&transport=websocket");
  assert.equal(forwarded?.headers.get("Upgrade"), "websocket");
  assert.equal(forwarded?.headers.get("Connection"), "Upgrade");
  assert.equal(forwarded?.headers.get("X-Player-Token"), "player-token");
  assert.equal(response, upgradeResponse);
});

test("non-proxy requests are passed through unchanged", async () => {
  const request = new Request("https://gyakuteneigo.com/join");
  let received: Request | undefined;
  await proxyRequest(request, env, async (candidate) => {
    received = candidate;
    return new Response("pages", { status: 200 });
  });
  assert.equal(received, request);
});

test("invalid backend origins fail closed", async () => {
  for (const backendOrigin of ["https://example.com/backend/path", "http://example.com"]) {
    let fetchCalled = false;
    const response = await proxyRequest(
      new Request("https://gyakuteneigo.com/api/health"),
      { BACKEND_ORIGIN: backendOrigin },
      async () => {
        fetchCalled = true;
        throw new Error("fetch should not be called");
      }
    );
    assert.equal(response.status, 500);
    assert.equal((await response.json() as { error: string }).error, "Game server proxy configuration is invalid.");
    assert.equal(fetchCalled, false);
  }
});

test("Socket.IO polling can outlive the Engine.IO heartbeat window", () => {
  assert.equal(getProxyTimeoutMs("/api/health"), 25_000);
  assert.equal(getProxyTimeoutMs("/api/speaking/sessions/session-1/turn"), 45_000);
  assert.equal(getProxyTimeoutMs("/socket.io/"), 60_000);
  assert.ok(getProxyTimeoutMs("/socket.io/") > 45_000);
});
