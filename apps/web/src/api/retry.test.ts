import test from "node:test";
import assert from "node:assert/strict";
import { retryOnce } from "./retry.js";

test("retryOnce retries one temporary failure and reports the retry", async () => {
  const attempts: number[] = [];
  let retryReported = false;

  const result = await retryOnce({
    request: async (attempt) => {
      attempts.push(attempt);
      if (attempt === 0) throw new Error("temporarily unavailable");
      return "ready";
    },
    shouldRetry: () => true,
    onRetry: () => {
      retryReported = true;
    },
    delayMs: 1,
    sleep: async () => undefined
  });

  assert.equal(result, "ready");
  assert.deepEqual(attempts, [0, 1]);
  assert.equal(retryReported, true);
});

test("retryOnce does not retry permanent failures", async () => {
  const permanent = new Error("invalid password");
  let attempts = 0;

  await assert.rejects(
    retryOnce({
      request: async () => {
        attempts += 1;
        throw permanent;
      },
      shouldRetry: () => false
    }),
    permanent
  );

  assert.equal(attempts, 1);
});
