import test from "node:test";
import assert from "node:assert/strict";
import { ApiRequestTimeoutError, buildApiUrlCandidates, fetchFromApiCandidates, resolveApiOrigin } from "./endpoints.js";

test("production-like builds prefer the page origin even when an external override is present", () => {
  assert.equal(
    resolveApiOrigin({
      pageOrigin: "https://gyakuteneigo.com/",
      configuredOrigin: "https://gyakuteneigo-api.onrender.com",
      allowConfiguredOrigin: false
    }),
    "https://gyakuteneigo.com"
  );
});

test("development builds can explicitly target a local API origin", () => {
  assert.equal(
    resolveApiOrigin({
      pageOrigin: "http://localhost:5173",
      configuredOrigin: "http://localhost:4000/",
      allowConfiguredOrigin: true
    }),
    "http://localhost:4000"
  );
});

test("an explicit rollout override can temporarily target the hosted API", () => {
  assert.equal(
    resolveApiOrigin({
      pageOrigin: "https://gyakuteneigo.com",
      configuredOrigin: "https://gyakuteneigo-api.onrender.com",
      allowConfiguredOrigin: true
    }),
    "https://gyakuteneigo-api.onrender.com"
  );
});

test("buildApiUrlCandidates normalizes and de-duplicates hosted endpoints", () => {
  assert.deepEqual(
    buildApiUrlCandidates("https://api.example.com/", "https://api.example.com", "https://fallback.example.com"),
    ["https://api.example.com", "https://fallback.example.com"]
  );
});

test("fetchFromApiCandidates retries the fallback only after a network failure", async () => {
  const requested: string[] = [];
  const result = await fetchFromApiCandidates({
    candidates: ["https://primary.example.com", "https://fallback.example.com"],
    activeUrl: "https://primary.example.com",
    path: "/api/health",
    fetcher: (async (url: string | URL | Request) => {
      requested.push(String(url));
      if (requested.length === 1) throw new TypeError("blocked by network");
      return new Response('{"ok":true}', { status: 200 });
    }) as typeof fetch
  });

  assert.deepEqual(requested, [
    "https://primary.example.com/api/health",
    "https://fallback.example.com/api/health"
  ]);
  assert.equal(result.url, "https://fallback.example.com");
  assert.equal(result.response.status, 200);
});

test("fetchFromApiCandidates bounds a stalled endpoint before trying the fallback", async () => {
  const requested: string[] = [];
  const result = await fetchFromApiCandidates({
    candidates: ["https://primary.example.com", "https://fallback.example.com"],
    activeUrl: "https://primary.example.com",
    path: "/api/health",
    attemptTimeoutMs: 5,
    fetcher: (async (url: string | URL | Request) => {
      requested.push(String(url));
      if (requested.length === 1) return new Promise<Response>(() => undefined);
      return new Response('{"ok":true}', { status: 200 });
    }) as typeof fetch
  });

  assert.deepEqual(requested, [
    "https://primary.example.com/api/health",
    "https://fallback.example.com/api/health"
  ]);
  assert.equal(result.url, "https://fallback.example.com");
});

test("fetchFromApiCandidates surfaces a timeout after every endpoint stalls", async () => {
  await assert.rejects(
    fetchFromApiCandidates({
      candidates: ["https://primary.example.com"],
      activeUrl: "https://primary.example.com",
      path: "/api/health",
      attemptTimeoutMs: 5,
      fetcher: (() => new Promise<Response>(() => undefined)) as typeof fetch
    }),
    ApiRequestTimeoutError
  );
});
