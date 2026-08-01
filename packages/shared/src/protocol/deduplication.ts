export class BoundedEventIdCache {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly capacity = 128,
    private readonly ttlMs = 2 * 60_000,
    private readonly now: () => number = () => Date.now()
  ) {}

  accept(eventId: string) {
    const current = this.now();
    this.prune(current);
    if (this.seen.has(eventId)) return false;
    this.seen.set(eventId, current);
    while (this.seen.size > Math.max(1, this.capacity)) {
      const oldest = this.seen.keys().next().value as string | undefined;
      if (!oldest) break;
      this.seen.delete(oldest);
    }
    return true;
  }

  clear() {
    this.seen.clear();
  }

  get size() {
    return this.seen.size;
  }

  private prune(current: number) {
    for (const [eventId, seenAt] of this.seen) {
      if (current - seenAt <= this.ttlMs) break;
      this.seen.delete(eventId);
    }
  }
}

