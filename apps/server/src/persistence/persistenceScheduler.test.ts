import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { PersistenceScheduler } from "./persistenceScheduler.js";

test("a slow checkpoint is followed by one write of the latest state", async () => {
  let markFirstWriteStarted!: () => void;
  const firstWriteStarted = new Promise<void>((resolve) => { markFirstWriteStarted = resolve; });
  let finishFirstWrite!: () => void;
  const firstWriteBlocked = new Promise<void>((resolve) => { finishFirstWrite = resolve; });
  const written: unknown[] = [];
  const prisma = {
    runtimeSnapshot: {
      async upsert({ update }: Prisma.RuntimeSnapshotUpsertArgs) {
        written.push(update.data);
        if (written.length === 1) {
          markFirstWriteStarted();
          await firstWriteBlocked;
        }
      }
    }
  } as unknown as PrismaClient;
  let revision = 1;
  const scheduler = new PersistenceScheduler({
    prisma,
    runtimeSnapshotId: "primary",
    getSnapshot: () => ({ revision })
  });

  scheduler.flush();
  await firstWriteStarted;
  revision = 2;
  scheduler.flush();
  revision = 3;
  scheduler.flush();
  const pending = scheduler.pending;
  assert.deepEqual(written, [{ revision: 1 }]);

  finishFirstWrite();
  await pending;
  assert.deepEqual(written, [{ revision: 1 }, { revision: 3 }]);
});
