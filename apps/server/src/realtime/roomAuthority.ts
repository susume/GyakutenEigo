import type { RoomOwnershipLease, RoomOwnershipStore } from "../scaling/runtimeInfrastructure.js";

export interface RoomAuthorityOptions {
  instanceId: string;
  leaseMs: number;
  ownership: RoomOwnershipStore;
}

/** Owns the local view of room leases without coupling it to the runtime composition root. */
export class RoomAuthority {
  private readonly leases = new Map<string, RoomOwnershipLease>();

  constructor(private readonly options: RoomAuthorityOptions) {}

  acquire(roomId: string) {
    const lease = this.options.ownership.acquire(roomId, this.options.instanceId, this.options.leaseMs);
    if (!lease) return false;
    this.leases.set(roomId, lease);
    console.info(`[ownership] acquired room=${roomId} instance=${this.options.instanceId} fence=${lease.fencingToken}`);
    return true;
  }

  owns(roomId: string) {
    const lease = this.leases.get(roomId);
    const owner = this.options.ownership.owner(roomId);
    return Boolean(
      lease
      && owner
      && owner.ownerInstanceId === this.options.instanceId
      && owner.fencingToken === lease.fencingToken
    );
  }

  renewAll() {
    for (const [roomId, lease] of this.leases) {
      const renewed = this.options.ownership.renew(
        roomId,
        this.options.instanceId,
        lease.fencingToken,
        this.options.leaseMs
      );
      if (renewed) {
        this.leases.set(roomId, renewed);
        continue;
      }
      this.leases.delete(roomId);
      console.error(`[ownership] lost room=${roomId} instance=${this.options.instanceId}; authoritative processing paused`);
    }
  }

  release(roomId: string) {
    const lease = this.leases.get(roomId);
    if (!lease) return false;
    const released = this.options.ownership.release(roomId, this.options.instanceId, lease.fencingToken);
    this.leases.delete(roomId);
    return released;
  }

  releaseAll() {
    const released = this.options.ownership.releaseAll(this.options.instanceId);
    this.leases.clear();
    return released;
  }
}
