import { BoundedEventIdCache } from "@quizstrike/shared";

export interface MatchSessionStore<TState> {
  get(matchId: string): TState | undefined;
  set(matchId: string, state: TState): void;
  delete(matchId: string): boolean;
  clear(): void;
  values(): IterableIterator<TState>;
  readonly size: number;
}

export type RoomStateStore<TState> = MatchSessionStore<TState>;

export class InMemoryRoomStateStore<TState> implements RoomStateStore<TState> {
  private readonly states = new Map<string, TState>();

  get(roomId: string) { return this.states.get(roomId); }
  set(roomId: string, state: TState) { this.states.set(roomId, state); }
  delete(roomId: string) { return this.states.delete(roomId); }
  clear() { this.states.clear(); }
  values() { return this.states.values(); }
  get size() { return this.states.size; }
}

export interface JoinCodeDirectory {
  reserve(code: string, roomId: string): boolean;
  resolve(code: string): string | undefined;
  release(code: string, roomId: string): boolean;
  clear(): void;
}

export class InMemoryJoinCodeDirectory implements JoinCodeDirectory {
  private readonly codes = new Map<string, string>();

  reserve(code: string, roomId: string) {
    const key = code.toUpperCase();
    const existing = this.codes.get(key);
    if (existing && existing !== roomId) return false;
    this.codes.set(key, roomId);
    return true;
  }

  resolve(code: string) { return this.codes.get(code.toUpperCase()); }

  release(code: string, roomId: string) {
    const key = code.toUpperCase();
    if (this.codes.get(key) !== roomId) return false;
    return this.codes.delete(key);
  }

  clear() { this.codes.clear(); }
}

export interface DistributedEvent<TPayload = unknown> {
  eventId: string;
  originInstanceId: string;
  roomId?: string;
  eventType: string;
  occurredAt: number;
  payload: TPayload;
}

export type RealtimeEventHandler = (event: DistributedEvent) => void | Promise<void>;

export interface RealtimeEventBus {
  publish(channel: string, event: DistributedEvent): Promise<void>;
  subscribe(channel: string, handler: RealtimeEventHandler): Promise<() => void>;
  close(): Promise<void>;
}

export class InMemoryRealtimeEventBus implements RealtimeEventBus {
  private readonly handlers = new Map<string, Set<RealtimeEventHandler>>();
  private closed = false;

  async publish(channel: string, event: DistributedEvent) {
    if (this.closed) throw new Error("Realtime event bus is closed.");
    const handlers = [...(this.handlers.get(channel) ?? [])];
    await Promise.all(handlers.map((handler) => handler(event)));
  }

  async subscribe(channel: string, handler: RealtimeEventHandler) {
    if (this.closed) throw new Error("Realtime event bus is closed.");
    const handlers = this.handlers.get(channel) ?? new Set<RealtimeEventHandler>();
    handlers.add(handler);
    this.handlers.set(channel, handlers);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.handlers.delete(channel);
    };
  }

  async close() {
    this.closed = true;
    this.handlers.clear();
  }
}

export class IdempotentEventConsumer {
  private readonly eventIds: BoundedEventIdCache;

  constructor(capacity = 512, ttlMs = 5 * 60_000, now?: () => number) {
    this.eventIds = new BoundedEventIdCache(capacity, ttlMs, now);
  }

  async consume(event: DistributedEvent, handler: RealtimeEventHandler) {
    if (!this.eventIds.accept(event.eventId)) return false;
    await handler(event);
    return true;
  }

  clear() { this.eventIds.clear(); }
}

export interface RoomOwnershipLease {
  roomId: string;
  ownerInstanceId: string;
  fencingToken: number;
  expiresAt: number;
}

export interface RoomOwnershipStore {
  acquire(roomId: string, instanceId: string, leaseMs: number, now?: number): RoomOwnershipLease | undefined;
  renew(roomId: string, instanceId: string, fencingToken: number, leaseMs: number, now?: number): RoomOwnershipLease | undefined;
  owner(roomId: string, now?: number): RoomOwnershipLease | undefined;
  release(roomId: string, instanceId: string, fencingToken: number): boolean;
  releaseAll(instanceId: string): number;
}

export class InMemoryRoomOwnershipStore implements RoomOwnershipStore {
  private readonly leases = new Map<string, RoomOwnershipLease>();
  private nextFencingToken = 1;

  acquire(roomId: string, instanceId: string, leaseMs: number, now = Date.now()) {
    const current = this.owner(roomId, now);
    if (current && current.ownerInstanceId !== instanceId) return undefined;
    const lease: RoomOwnershipLease = {
      roomId,
      ownerInstanceId: instanceId,
      fencingToken: current?.fencingToken ?? this.nextFencingToken++,
      expiresAt: now + Math.max(1, leaseMs)
    };
    this.leases.set(roomId, lease);
    return { ...lease };
  }

  renew(roomId: string, instanceId: string, fencingToken: number, leaseMs: number, now = Date.now()) {
    const current = this.owner(roomId, now);
    if (!current || current.ownerInstanceId !== instanceId || current.fencingToken !== fencingToken) return undefined;
    const renewed = { ...current, expiresAt: now + Math.max(1, leaseMs) };
    this.leases.set(roomId, renewed);
    return { ...renewed };
  }

  owner(roomId: string, now = Date.now()) {
    const lease = this.leases.get(roomId);
    if (!lease) return undefined;
    if (lease.expiresAt <= now) {
      this.leases.delete(roomId);
      return undefined;
    }
    return { ...lease };
  }

  release(roomId: string, instanceId: string, fencingToken: number) {
    const lease = this.leases.get(roomId);
    if (!lease || lease.ownerInstanceId !== instanceId || lease.fencingToken !== fencingToken) return false;
    return this.leases.delete(roomId);
  }

  releaseAll(instanceId: string) {
    let released = 0;
    for (const [roomId, lease] of this.leases) {
      if (lease.ownerInstanceId !== instanceId) continue;
      this.leases.delete(roomId);
      released += 1;
    }
    return released;
  }
}

export class LifecycleTimers {
  private readonly intervals = new Set<ReturnType<typeof setInterval>>();
  private readonly timeouts = new Set<ReturnType<typeof setTimeout>>();

  interval(handler: () => void, delayMs: number, unref = false) {
    const timer = setInterval(handler, delayMs);
    if (unref && "unref" in timer) timer.unref();
    this.intervals.add(timer);
    return timer;
  }

  deadline(deadlineMs: number, handler: () => void, now = Date.now()) {
    const timer = setTimeout(() => {
      this.timeouts.delete(timer);
      handler();
    }, Math.max(0, deadlineMs - now));
    this.timeouts.add(timer);
    return timer;
  }

  clearAll() {
    for (const timer of this.intervals) clearInterval(timer);
    for (const timer of this.timeouts) clearTimeout(timer);
    this.intervals.clear();
    this.timeouts.clear();
  }

  get size() { return this.intervals.size + this.timeouts.size; }
}

