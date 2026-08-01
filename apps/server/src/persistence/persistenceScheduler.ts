import type { Prisma, PrismaClient } from "@prisma/client";

export interface PersistenceSchedulerOptions {
  prisma?: PrismaClient;
  runtimeSnapshotId: string;
  getSnapshot: () => unknown;
  debounceMs?: number;
}

/** Serializes legacy runtime-snapshot writes and owns their debounce timer. */
export class PersistenceScheduler {
  private queue = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly options: PersistenceSchedulerOptions) {}

  persistNow() {
    const prisma = this.options.prisma;
    if (!prisma) return;
    const data = this.options.getSnapshot() as Prisma.InputJsonValue;
    this.queue = this.queue
      .catch(() => undefined)
      .then(async () => {
        await prisma.runtimeSnapshot.upsert({
          where: { id: this.options.runtimeSnapshotId },
          create: { id: this.options.runtimeSnapshotId, data },
          update: { data }
        });
      })
      .catch((error: unknown) => {
        console.error("Failed to persist QuizStrike runtime state.", error);
      });
  }

  schedule() {
    if (!this.options.prisma || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.persistNow();
    }, this.options.debounceMs ?? 1000);
  }

  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.persistNow();
  }

  get pending() {
    return this.queue;
  }

  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
