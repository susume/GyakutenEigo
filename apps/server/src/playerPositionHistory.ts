export type HistoricalPosition = {
  x: number;
  y?: number;
  z: number;
};

type TimedPosition = HistoricalPosition & { atMs: number };

export class PlayerPositionHistory {
  private readonly samples = new Map<string, TimedPosition[]>();

  constructor(
    private readonly maxAgeMs: number,
    private readonly maxSamples = 8
  ) {}

  record(playerId: string, position: HistoricalPosition, atMs: number) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || !Number.isFinite(atMs)) return;
    const samples = this.samples.get(playerId) ?? [];
    const cutoff = atMs - this.maxAgeMs;
    const recent = samples.filter((sample) => sample.atMs >= cutoff);
    recent.push({ ...position, atMs });
    this.samples.set(playerId, recent.slice(-this.maxSamples));
  }

  rewind(playerId: string, nowMs: number): HistoricalPosition | undefined {
    const samples = this.samples.get(playerId);
    if (!samples?.length) return undefined;
    const cutoff = nowMs - this.maxAgeMs;
    const sample = samples.find((candidate) => candidate.atMs >= cutoff);
    return sample ? { x: sample.x, y: sample.y, z: sample.z } : undefined;
  }

  clear(playerId: string) {
    this.samples.delete(playerId);
  }
}
