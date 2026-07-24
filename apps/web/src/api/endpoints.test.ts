import test from "node:test";
import assert from "node:assert/strict";
import { ApiRequestTimeoutError, buildApiUrlCandidates, fetchFromApiCandidates } from "./endpoints.js";

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
