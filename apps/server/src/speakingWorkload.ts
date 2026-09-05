import type { SpeakingProviderOperation } from "./speakingProviders.js";

export type SpeakingWorkloadOptions = {
  maxConcurrent?: number;
  maxEvaluationConcurrent?: number;
  maxQueue?: number;
  maxQueueWaitMs?: number;
  now?: () => number;
};

export type SpeakingWorkloadMetrics = {
  maxConcurrent: number;
  maxEvaluationConcurrent: number;
  maxQueue: number;
  queueDepth: number;
  peakQueueDepth: number;
  active: number;
  peakActive: number;
  activeByOperation: Record<SpeakingProviderOperation, number>;
  queuedByOperation: Record<SpeakingProviderOperation, number>;
  completed: number;
  timeouts: number;
  providerErrors: number;
  overloadRejections: number;
  queueWaitMsTotal: number;
  operationMsTotal: Record<SpeakingProviderOperation, number>;
};

export class SpeakingWorkloadError extends Error {
  constructor(
    public readonly code: "queue_full" | "queue_timeout",
    public readonly retryAfterSeconds: number,
    message = "Speaking provider capacity is temporarily full."
  ) {
    super(message);
    this.name = "SpeakingWorkloadError";
  }
}

type WorkItem<T> = {
  operation: SpeakingProviderOperation;
  priority: number;
  queuedAt: number;
  work: () => Promise<T>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const OPERATIONS: SpeakingProviderOperation[] = ["transcription", "conversation", "help", "evaluation"];
const defaultCount = (value: number | undefined, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value!))) : fallback;

const operationPriority = (operation: SpeakingProviderOperation) => {
  // A turn must become a response before background evaluation; transcription
  // is ordered first when both are waiting for the same capacity window.
  if (operation === "transcription") return 40;
  if (operation === "conversation") return 30;
  if (operation === "help") return 20;
  return 10;
};

export class SpeakingProviderWorkload {
  private readonly maxConcurrent: number;
  private readonly maxEvaluationConcurrent: number;
  private readonly maxQueue: number;
  private readonly maxQueueWaitMs: number;
  private readonly now: () => number;
  private readonly queue: Array<WorkItem<unknown>> = [];
  private readonly activeByOperation = Object.fromEntries(OPERATIONS.map((operation) => [operation, 0])) as Record<SpeakingProviderOperation, number>;
  private readonly queuedByOperation = Object.fromEntries(OPERATIONS.map((operation) => [operation, 0])) as Record<SpeakingProviderOperation, number>;
  private readonly operationMsTotal = Object.fromEntries(OPERATIONS.map((operation) => [operation, 0])) as Record<SpeakingProviderOperation, number>;
  private active = 0;
  private completed = 0;
  private timeouts = 0;
  private providerErrors = 0;
  private overloadRejections = 0;
  private queueWaitMsTotal = 0;
  private peakQueueDepth = 0;
  private peakActive = 0;

  constructor(options: SpeakingWorkloadOptions = {}) {
    this.maxConcurrent = defaultCount(options.maxConcurrent, 8, 1, 64);
    this.maxEvaluationConcurrent = defaultCount(options.maxEvaluationConcurrent, Math.max(1, Math.floor(this.maxConcurrent / 3)), 1, this.maxConcurrent);
    this.maxQueue = defaultCount(options.maxQueue, 80, 0, 1_000);
    this.maxQueueWaitMs = defaultCount(options.maxQueueWaitMs, 5_000, 100, 120_000);
    this.now = options.now ?? Date.now;
  }

  private canStart(operation: SpeakingProviderOperation) {
    return this.active < this.maxConcurrent && (operation !== "evaluation" || this.activeByOperation.evaluation < this.maxEvaluationConcurrent);
  }

  private takeNext() {
    let candidateIndex = -1;
    for (let index = 0; index < this.queue.length; index += 1) {
      const candidate = this.queue[index]!;
      if (!this.canStart(candidate.operation)) continue;
      if (candidateIndex < 0 || candidate.priority > this.queue[candidateIndex]!.priority || (candidate.priority === this.queue[candidateIndex]!.priority && candidate.queuedAt < this.queue[candidateIndex]!.queuedAt)) candidateIndex = index;
    }
    return candidateIndex < 0 ? undefined : this.queue.splice(candidateIndex, 1)[0];
  }

  private pump() {
    while (true) {
      const item = this.takeNext();
      if (!item) return;
      this.queuedByOperation[item.operation] -= 1;
      clearTimeout(item.timeoutId);
      this.queueWaitMsTotal += Math.max(0, this.now() - item.queuedAt);
      void this.start(item);
    }
  }

  private async start(item: WorkItem<unknown>) {
    this.active += 1;
    this.peakActive = Math.max(this.peakActive, this.active);
    this.activeByOperation[item.operation] += 1;
    const startedAt = this.now();
    try {
      const value = await item.work();
      this.completed += 1;
      item.resolve(value);
    } catch (error) {
      this.providerErrors += 1;
      item.reject(error);
    } finally {
      this.operationMsTotal[item.operation] += Math.max(0, this.now() - startedAt);
      this.active -= 1;
      this.activeByOperation[item.operation] -= 1;
      this.pump();
    }
  }

  run<T>(operation: SpeakingProviderOperation, work: () => Promise<T>): Promise<T> {
    if (this.canStart(operation) && this.queue.length === 0) {
      return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => undefined, 0);
        clearTimeout(timeoutId);
        void this.start({ operation, priority: operationPriority(operation), queuedAt: this.now(), work, resolve: (value) => resolve(value as T), reject, timeoutId });
      });
    }
    if (this.queue.length >= this.maxQueue) {
      this.overloadRejections += 1;
      return Promise.reject(new SpeakingWorkloadError("queue_full", Math.max(1, Math.ceil(this.maxQueueWaitMs / 1_000))));
    }
    return new Promise<T>((resolve, reject) => {
      const queuedAt = this.now();
      const timeoutId = setTimeout(() => {
        const index = this.queue.findIndex((candidate) => candidate.timeoutId === timeoutId);
        if (index < 0) return;
        this.queue.splice(index, 1);
        this.queuedByOperation[operation] -= 1;
        this.overloadRejections += 1;
        this.timeouts += 1;
        reject(new SpeakingWorkloadError("queue_timeout", Math.max(1, Math.ceil(this.maxQueueWaitMs / 1_000)), "Speaking provider capacity is busy. Please try again in a moment."));
      }, this.maxQueueWaitMs);
      this.queue.push({ operation, priority: operationPriority(operation), queuedAt, work, resolve: (value) => resolve(value as T), reject, timeoutId });
      this.peakQueueDepth = Math.max(this.peakQueueDepth, this.queue.length);
      this.queuedByOperation[operation] += 1;
      this.pump();
    });
  }

  snapshot(): SpeakingWorkloadMetrics {
    return {
      maxConcurrent: this.maxConcurrent,
      maxEvaluationConcurrent: this.maxEvaluationConcurrent,
      maxQueue: this.maxQueue,
      queueDepth: this.queue.length,
      peakQueueDepth: this.peakQueueDepth,
      active: this.active,
      peakActive: this.peakActive,
      activeByOperation: { ...this.activeByOperation },
      queuedByOperation: { ...this.queuedByOperation },
      completed: this.completed,
      timeouts: this.timeouts,
      providerErrors: this.providerErrors,
      overloadRejections: this.overloadRejections,
      queueWaitMsTotal: this.queueWaitMsTotal,
      operationMsTotal: { ...this.operationMsTotal }
    };
  }
}

const envInteger = (name: string, fallback: number) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
};

export const createSpeakingProviderWorkload = (options: SpeakingWorkloadOptions = {}) => new SpeakingProviderWorkload({
  maxConcurrent: options.maxConcurrent ?? envInteger("SPEAKING_PROVIDER_CONCURRENCY", 8),
  maxEvaluationConcurrent: options.maxEvaluationConcurrent ?? envInteger("SPEAKING_EVALUATION_CONCURRENCY", 2),
  maxQueue: options.maxQueue ?? envInteger("SPEAKING_PROVIDER_QUEUE_MAX", 80),
  maxQueueWaitMs: options.maxQueueWaitMs ?? envInteger("SPEAKING_PROVIDER_QUEUE_WAIT_MS", 5_000),
  now: options.now
});
