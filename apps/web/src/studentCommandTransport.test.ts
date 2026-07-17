import assert from "node:assert/strict";
import test from "node:test";
import type { Socket } from "socket.io-client";
import { sendStudentCommand, StudentCommandTransportError } from "./studentCommandTransport.js";

const mockSocket = (connected: boolean, response?: unknown, timeoutError?: Error) => ({
  connected,
  timeout: () => ({
    emitWithAck: async () => {
      if (timeoutError) throw timeoutError;
      return response;
    }
  })
}) as unknown as Socket;

test("uses the live socket acknowledgement when connected", async () => {
  let fallbackCalls = 0;
  const result = await sendStudentCommand(
    mockSocket(true, { ok: true, data: { message: "Equipped." } }),
    "buy_gear",
    { gearId: "smg" },
    async () => {
      fallbackCalls += 1;
      return { message: "HTTP" };
    }
  );

  assert.deepEqual(result, { message: "Equipped." });
  assert.equal(fallbackCalls, 0);
});

test("uses HTTP only when the live socket is disconnected", async () => {
  const result = await sendStudentCommand(
    mockSocket(false),
    "answer_question",
    { questionId: "q1", selectedChoice: "A" },
    async () => ({ result: "HTTP" })
  );

  assert.deepEqual(result, { result: "HTTP" });
});

test("does not retry an ambiguous timed-out purchase", async () => {
  let fallbackCalls = 0;

  await assert.rejects(
    () => sendStudentCommand(
      mockSocket(true, undefined, new Error("timeout")),
      "buy_snowballs",
      {},
      async () => {
        fallbackCalls += 1;
        return { message: "HTTP" };
      }
    ),
    StudentCommandTransportError
  );
  assert.equal(fallbackCalls, 0);
});

test("surfaces authoritative command errors", async () => {
  await assert.rejects(
    () => sendStudentCommand(
      mockSocket(true, { ok: false, status: 400, error: "Not enough money for that gear." }),
      "buy_gear",
      { gearId: "awp" },
      async () => ({ message: "HTTP" })
    ),
    (error: unknown) => error instanceof StudentCommandTransportError
      && error.status === 400
      && error.message === "Not enough money for that gear."
  );
});
