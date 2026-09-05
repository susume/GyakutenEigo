import assert from "node:assert/strict";
import test from "node:test";
import { SpeakingProviderWorkload, SpeakingWorkloadError } from "./speakingWorkload.js";

const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
};

test("speaking provider workload bounds active calls and prioritizes turns over evaluation", async () => {
  const workload = new SpeakingProviderWorkload({ maxConcurrent: 1, maxEvaluationConcurrent: 1, maxQueue: 4, maxQueueWaitMs: 1_000 });
  const first = deferred();
  const order: string[] = [];
  const running = workload.run("evaluation", async () => { order.push("evaluation"); await first.promise; return "evaluation"; });
  const queuedEvaluation = workload.run("evaluation", async () => { order.push("queued-evaluation"); return "queued-evaluation"; });
  const queuedTurn = workload.run("conversation", async () => { order.push("conversation"); return "conversation"; });
  assert.equal(workload.snapshot().active, 1);
  first.release();
  await Promise.all([running, queuedEvaluation, queuedTurn]);
  assert.deepEqual(order, ["evaluation", "conversation", "queued-evaluation"]);
  assert.equal(workload.snapshot().active, 0);
  assert.equal(workload.snapshot().completed, 3);
  assert.equal(workload.snapshot().activeByOperation.evaluation, 0);
});

test("speaking provider workload exposes queue-full and queue-timeout failures", async () => {
  const workload = new SpeakingProviderWorkload({ maxConcurrent: 1, maxQueue: 0, maxQueueWaitMs: 100 });
  const first = deferred();
  const running = workload.run("conversation", () => first.promise.then(() => "done"));
  await assert.rejects(workload.run("help", async () => "not-run"), (error: unknown) => {
    assert.ok(error instanceof SpeakingWorkloadError);
    assert.equal(error.code, "queue_full");
    return true;
  });
  first.release();
  await running;

  const timeoutWorkload = new SpeakingProviderWorkload({ maxConcurrent: 1, maxQueue: 2, maxQueueWaitMs: 100 });
  const blocker = deferred();
  const active = timeoutWorkload.run("conversation", () => blocker.promise.then(() => "done"));
  await assert.rejects(timeoutWorkload.run("help", async () => "not-run"), (error: unknown) => {
    assert.ok(error instanceof SpeakingWorkloadError);
    assert.equal(error.code, "queue_timeout");
    return true;
  });
  assert.equal(timeoutWorkload.snapshot().timeouts, 1);
  blocker.release();
  await active;
});
