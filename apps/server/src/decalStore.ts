export type StoredDecalMime = "image/png" | "image/webp";

export interface StoredDecal {
  id: string;
  sessionId: string;
  playerId: string;
  mimeType: StoredDecalMime;
  bytes: Uint8Array;
  createdAt: number;
}

export interface DecalMetadata {
  assetId: string;
  playerId: string;
  mimeType: StoredDecalMime;
  byteLength: number;
  createdAt: number;
  expiresAt: number;
}

export const DEFAULT_DECAL_ROOM_MAX_BYTES = 32 * 1024 * 1024;
export const DEFAULT_DECAL_RETENTION_MS = 8 * 60 * 60 * 1000;

export type StoreDecalResult =
  | { ok: true; removedAssetIds: string[] }
  | { ok: false; reason: "room_quota_exceeded" };

export class DecalStore {
  private readonly assets = new Map<string, StoredDecal>();

  constructor(
    readonly roomMaxBytes = DEFAULT_DECAL_ROOM_MAX_BYTES,
    readonly retentionMs = DEFAULT_DECAL_RETENTION_MS
  ) {}

  get(assetId: string) {
    return this.assets.get(assetId);
  }

  delete(assetId: string | undefined) {
    return assetId ? this.assets.delete(assetId) : false;
  }

  put(asset: StoredDecal, protectedAssetId?: string): StoreDecalResult {
    const replaceable = [...this.assets.values()].filter(
      (candidate) => candidate.sessionId === asset.sessionId
        && candidate.playerId === asset.playerId
        && candidate.id !== protectedAssetId
        && candidate.id !== asset.id
    );
    const replaceableBytes = replaceable.reduce((total, candidate) => total + candidate.bytes.byteLength, 0);
    const projectedBytes = this.getSessionBytes(asset.sessionId) - replaceableBytes + asset.bytes.byteLength;
    if (projectedBytes > this.roomMaxBytes) return { ok: false, reason: "room_quota_exceeded" };
    replaceable.forEach((candidate) => this.assets.delete(candidate.id));
    this.assets.set(asset.id, asset);
    return { ok: true, removedAssetIds: replaceable.map((candidate) => candidate.id) };
  }

  listSession(sessionId: string): DecalMetadata[] {
    return [...this.assets.values()]
      .filter((asset) => asset.sessionId === sessionId)
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((asset) => ({
        assetId: asset.id,
        playerId: asset.playerId,
        mimeType: asset.mimeType,
        byteLength: asset.bytes.byteLength,
        createdAt: asset.createdAt,
        expiresAt: asset.createdAt + this.retentionMs
      }));
  }

  getSessionBytes(sessionId: string) {
    return this.listSession(sessionId).reduce((total, asset) => total + asset.byteLength, 0);
  }

  deletePlayer(sessionId: string, playerId: string) {
    const removed: string[] = [];
    for (const [assetId, asset] of this.assets) {
      if (asset.sessionId !== sessionId || asset.playerId !== playerId) continue;
      this.assets.delete(assetId);
      removed.push(assetId);
    }
    return removed;
  }

  deleteSession(sessionId: string) {
    const removed: string[] = [];
    for (const [assetId, asset] of this.assets) {
      if (asset.sessionId !== sessionId) continue;
      this.assets.delete(assetId);
      removed.push(assetId);
    }
    return removed;
  }

  pruneExpired(nowMs = Date.now()) {
    const removed: StoredDecal[] = [];
    for (const [assetId, asset] of this.assets) {
      if (asset.createdAt + this.retentionMs > nowMs) continue;
      this.assets.delete(assetId);
      removed.push(asset);
    }
    return removed;
  }
}
