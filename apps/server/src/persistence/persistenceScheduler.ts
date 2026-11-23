import type { Prisma, PrismaClient } from "@prisma/client";

export interface PersistenceSchedulerOptions {
  prisma?: PrismaClient;
  runtimeSnapshotId: string;
  getSnapshot: () => unknown;
  debounceMs?: number;
}

/** Serializes legacy runtime-snapshot writes and owns their debounce timer. */
export class PersistenceScheduler {
  private write: Promise<void> | undefined;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly options: PersistenceSchedulerOptions) {}

  private persistNow() {
    const prisma = this.options.prisma;
    if (!prisma) return;
    this.dirty = true;
    this.write ??= Promise.resolve().then(async () => {
      // Capture only the latest state after a slow write frees the connection.
      while (this.dirty) {
        this.dirty = false;
        try {
          const data = this.options.getSnapshot() as Prisma.InputJsonValue;
          await prisma.runtimeSnapshot.upsert({
            where: { id: this.options.runtimeSnapshotId },
            create: { id: this.options.runtimeSnapshotId, data },
            update: { data }
          });
        } catch (error) {
          console.error("Failed to persist QuizStrike runtime state.", error);
        }
      }
      this.write = undefined;
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
    this.clearTimer();
    this.persistNow();
  }

  get pending() {
    return this.write ?? Promise.resolve();
  }

  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
