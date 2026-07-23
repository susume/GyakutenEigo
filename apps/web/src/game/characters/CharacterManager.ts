import * as THREE from "three";
import type { PlayerSession } from "@quizstrike/shared";
import { CharacterController } from "./CharacterController.js";
import { CharacterFactory } from "./CharacterFactory.js";
import type { ArenaAnimationCue, ArenaAnimationEvent } from "../ArenaAnimation.js";

export interface CharacterVisualState {
  x: number;
  z: number;
  facing: number;
}

export interface CharacterManagerOptions {
  isFps: boolean;
  currentPlayerId?: string;
  makeBadgeMaterial: (player: PlayerSession) => THREE.SpriteMaterial;
}

type CharacterRecord = {
  controller: CharacterController;
  badge: THREE.Sprite;
  ring?: THREE.Mesh;
  gear: string;
  badgeAlive: boolean;
  alive: boolean;
  team: PlayerSession["team"];
  appearanceSignature: string;
};

export interface CharacterManagerStats {
  total: number;
  visible: number;
  alive: number;
  averageSpeed: number;
  lod: Record<"LOD0" | "LOD1" | "LOD2" | "LOD3", number>;
}

export class CharacterManager {
  private readonly records = new Map<string, CharacterRecord>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly factory: CharacterFactory,
    private readonly options: CharacterManagerOptions
  ) {}

  sync(players: PlayerSession[], getVisualState: (player: PlayerSession, index: number) => CharacterVisualState, objectiveCarrierId?: string) {
    const seen = new Set<string>();
    players.forEach((player, index) => {
      if (this.options.isFps && player.id === this.options.currentPlayerId) return;
      seen.add(player.id);
      const state = getVisualState(player, index);
      let record = this.records.get(player.id);
      if (!record) {
        this.add(player, state);
        record = this.records.get(player.id);
      }
      if (!record) return;
      const appearanceSignature = JSON.stringify(player.appearance ?? null);
      if (record.gear !== player.gear || record.team !== player.team || record.appearanceSignature !== appearanceSignature) {
        this.removeRecord(record);
        this.records.delete(player.id);
        this.add(player, state);
        record = this.records.get(player.id);
      }
      if (!record) return;
      if (!record.alive && player.isAlive) record.controller.triggerAnimation("respawn");
      record.alive = player.isAlive;
      record.team = player.team;
      record.controller.carryingObjective = objectiveCarrierId === player.id;
      if (!player.isAlive) {
        record.controller.model.root.visible = false;
        record.badge.visible = false;
        if (record.ring) record.ring.visible = false;
        return;
      }
      if (record.badgeAlive !== player.isAlive) {
        const previousMaterial = record.badge.material;
        record.badge.material = this.options.makeBadgeMaterial(player);
        if (!Array.isArray(previousMaterial)) {
          const mappedMaterial = previousMaterial as THREE.Material & { map?: THREE.Texture | null };
          mappedMaterial.map?.dispose();
          previousMaterial.dispose();
        }
        record.badgeAlive = player.isAlive;
      }
      record.controller.setTarget(state.x, state.z, state.facing, player.isAlive);
      record.controller.model.root.visible = true;
      record.badge.visible = true;
      if (record.ring) record.ring.visible = player.id === this.options.currentPlayerId;
    });

    for (const [playerId, record] of this.records) {
      if (seen.has(playerId)) continue;
      this.removeRecord(record);
      this.records.delete(playerId);
    }
  }

  triggerAnimation(event: ArenaAnimationEvent) {
    if (event.playerId) {
      this.records.get(event.playerId)?.controller.triggerAnimation(event.kind);
      return;
    }
    for (const record of this.records.values()) {
      if (!event.team || record.team === event.team) record.controller.triggerAnimation(event.kind);
    }
  }

  triggerPlayerAnimation(playerId: string, cue: ArenaAnimationCue) {
    this.records.get(playerId)?.controller.triggerAnimation(cue);
  }

  update(delta: number, elapsed: number, camera: THREE.Camera) {
    for (const record of this.records.values()) {
      if (!record.controller.model.root.visible) continue;
      record.controller.update(delta, elapsed, camera);
      const { current, alive } = record.controller;
      record.badge.position.set(current.x, 6.2, current.z);
      record.badge.scale.set(alive ? 8.2 : 7.2, alive ? 3 : 2.6, 1);
      record.badge.lookAt(camera.position);
      if (record.ring) record.ring.position.set(current.x, 0.08, current.z);
    }
  }

  getStats(): CharacterManagerStats {
    const stats: CharacterManagerStats = {
      total: this.records.size,
      visible: 0,
      alive: 0,
      averageSpeed: 0,
      lod: { LOD0: 0, LOD1: 0, LOD2: 0, LOD3: 0 }
    };
    let speedTotal = 0;
    for (const record of this.records.values()) {
      if (!record.controller.model.root.visible) continue;
      stats.visible += 1;
      if (record.controller.alive) stats.alive += 1;
      stats.lod[record.controller.model.lod.level] += 1;
      speedTotal += record.controller.speed;
    }
    stats.averageSpeed = stats.visible === 0 ? 0 : Number((speedTotal / stats.visible).toFixed(2));
    return stats;
  }

  private add(player: PlayerSession, state: CharacterVisualState) {
    const model = this.factory.createCharacter({ playerId: player.id, team: player.team, gear: player.gear, appearance: player.appearance });
    const controller = new CharacterController(model, state.x, state.z, state.facing, player.isAlive);
    this.scene.add(model.root);

    const badge = new THREE.Sprite(this.options.makeBadgeMaterial(player));
    badge.position.set(state.x, 6.2, state.z);
    badge.scale.set(8.2, 3, 1);
    this.scene.add(badge);

    let ring: THREE.Mesh | undefined;
    if (player.id === this.options.currentPlayerId && !this.options.isFps) {
      ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.8, 0.25, 8, 42),
        new THREE.MeshBasicMaterial({ color: "#172033" })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(state.x, 0.08, state.z);
      this.scene.add(ring);
    }

    this.records.set(player.id, {
      controller,
      badge,
      ring,
      gear: player.gear,
      badgeAlive: player.isAlive,
      alive: player.isAlive,
      team: player.team,
      appearanceSignature: JSON.stringify(player.appearance ?? null)
    });
  }

  dispose() {
    for (const record of this.records.values()) this.removeRecord(record);
    this.records.clear();
  }

  private removeRecord(record: CharacterRecord) {
    record.controller.model.dispose();
    this.scene.remove(record.controller.model.root);
    this.scene.remove(record.badge);
    const badgeMaterial = Array.isArray(record.badge.material) ? record.badge.material : [record.badge.material];
    badgeMaterial.forEach((material) => {
      const mapped = material as THREE.Material & { map?: THREE.Texture | null };
      mapped.map?.dispose();
      material.dispose();
    });
    if (record.ring) {
      this.scene.remove(record.ring);
      record.ring.geometry.dispose();
      const ringMaterials = Array.isArray(record.ring.material) ? record.ring.material : [record.ring.material];
      ringMaterials.forEach((material) => material.dispose());
    }
  }
}
